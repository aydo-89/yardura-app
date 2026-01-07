import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  Prisma,
  RouteStopStatus,
  ServiceStatus,
  VisitOfferStatus,
} from "@prisma/client";

import { getScooperAuth } from "@/lib/auth/scooper";
import { prisma } from "@/lib/prisma";
import { enqueueOfferPublishing } from "@/lib/jobs/marketplaceOfferPublisher";
import { createVisitOffersForVisits } from "@/lib/marketplace/offers";
import { EARLY_RELEASE_LIMIT, LATE_RELEASE_LIMIT } from "@/lib/marketplace/discipline";
import { DisciplineEventType } from "@prisma/client";
import { recordDisciplineEvent } from "@/lib/marketplace/discipline-events";
import { info, warn } from "@/lib/log";
import { convertUtcToZonedParts, SERVICE_TIME_ZONE } from "@/lib/timezone";

const STRIKE_GRACE_HOURS = 48;

const handoffSchema = z.object({
  reason: z.string().max(240).optional(),
});

type RouteParams = { params: Promise<{ visitId: string }> };

function asJsonValue(value: Prisma.InputJsonValue) {
  return value;
}

function isSameServiceDay(a: Date, b: Date) {
  const aParts = convertUtcToZonedParts(a, SERVICE_TIME_ZONE);
  const bParts = convertUtcToZonedParts(b, SERVICE_TIME_ZONE);
  return (
    aParts.year === bParts.year &&
    aParts.month === bParts.month &&
    aParts.day === bParts.day
  );
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await getScooperAuth(request);
  const userId = auth?.userId;

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { visitId } = await params;
  const payload = await request.json().catch(() => ({}));
  const parsed = handoffSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const now = new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const [profile, visit] = await Promise.all([
        tx.scooperProfile.findUnique({
          where: { userId },
          select: {
            id: true,
            orgId: true,
            metadata: true,
          },
        }),
        tx.serviceVisit.findUnique({
          where: { id: visitId },
          select: {
            id: true,
            status: true,
            assignedToId: true,
            notes: true,
            metadata: true,
            scheduledDate: true,
            job: {
              select: {
                id: true,
                tile: {
                  select: {
                    slug: true,
                  },
                },
              },
            },
            routeStop: {
              select: {
                id: true,
              },
            },
          },
        }),
      ]);

      if (!profile) {
        throw new Error("profile_missing");
      }

      if (!visit || visit.assignedToId !== userId) {
        throw new Error("visit_not_owned");
      }

      if (visit.status !== ServiceStatus.SCHEDULED) {
        throw new Error("visit_not_schedulable");
      }

      if (visit.scheduledDate && isSameServiceDay(visit.scheduledDate, now)) {
        throw new Error("same_day_release");
      }

      const isLateRelease = visit.scheduledDate
        ? visit.scheduledDate.getTime() - now.getTime() <= STRIKE_GRACE_HOURS * 60 * 60 * 1000
        : false;
      const disciplineLimit = isLateRelease ? LATE_RELEASE_LIMIT : EARLY_RELEASE_LIMIT;
      const disciplineType = isLateRelease
        ? DisciplineEventType.LATE_RELEASE
        : DisciplineEventType.EARLY_RELEASE;
      const eventReason = parsed.data.reason?.trim()
        ? `Visit handoff: ${parsed.data.reason.trim()}`
        : "Visit handoff";

      const releaseRecord = await recordDisciplineEvent({
        tx,
        profile,
        type: disciplineType,
        reason: eventReason,
        serviceVisitId: visit.id,
        jobId: visit.job?.id ?? null,
        enforceLimit: true,
        now,
      });

      if (!releaseRecord.allowed) {
        throw new Error(isLateRelease ? "late_release_limit" : "early_release_limit");
      }

      await tx.visitOffer.updateMany({
        where: {
          serviceVisitId: visit.id,
          status: VisitOfferStatus.ACCEPTED,
        },
        data: {
          status: VisitOfferStatus.RECALLED,
          cancelledAt: now,
        },
      });

      const baseMetadata =
        visit.metadata && typeof visit.metadata === "object" && !Array.isArray(visit.metadata)
          ? { ...(visit.metadata as Record<string, unknown>) }
          : {};
      const handoffMeta =
        baseMetadata.handoff && typeof baseMetadata.handoff === "object" && !Array.isArray(baseMetadata.handoff)
          ? { ...(baseMetadata.handoff as Record<string, unknown>) }
          : {};
      handoffMeta.type = "visit";
      handoffMeta.at = now.toISOString();
      if (parsed.data.reason) {
        handoffMeta.reason = parsed.data.reason;
      }
      baseMetadata.handoff = handoffMeta;

      await tx.serviceVisit.update({
        where: { id: visit.id },
        data: {
          assignedToId: null,
          metadata: asJsonValue(baseMetadata as Prisma.InputJsonValue),
          notes: parsed.data.reason
            ? [visit.notes?.trim(), `Handoff by scooper: ${parsed.data.reason}`]
                .filter(Boolean)
                .join("\n\n")
            : visit.notes ?? null,
        },
      });

      if (visit.routeStop) {
        await tx.routeStop.update({
          where: { id: visit.routeStop.id },
          data: {
            technicianId: null,
            status: RouteStopStatus.PENDING,
          },
        });
      }

      return {
        tileSlug: visit.job?.tile?.slug ?? null,
        orgId: profile.orgId,
        releasedVisitIds: [visit.id],
        releaseCount: releaseRecord.currentCount,
        releaseLimit: disciplineLimit,
        isLateRelease,
      };
    });

    await createVisitOffersForVisits({
      orgId: result.orgId,
      visitIds: result.releasedVisitIds,
    });

    if (result.tileSlug) {
      await enqueueOfferPublishing({
        orgId: result.orgId,
        tileSlugs: [result.tileSlug],
      });
    } else {
      await enqueueOfferPublishing({ orgId: result.orgId });
    }

    info("marketplace.visitHandoff", {
      orgId: result.orgId,
      visitId,
      tileSlug: result.tileSlug,
      releaseCount: result.releaseCount,
      releaseLimit: result.releaseLimit,
      isLateRelease: result.isLateRelease,
      reason: parsed.data.reason ?? null,
    });

    return NextResponse.json({
      ok: true,
      releaseCountThisQuarter: result.releaseCount,
      limit: result.releaseLimit,
      isLateRelease: result.isLateRelease,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (message === "profile_missing") {
      warn("marketplace.visitHandoff", {
        visitId,
        reason: "profile_missing",
      });
      return NextResponse.json({ error: "profile_missing" }, { status: 404 });
    }
    if (message === "visit_not_owned") {
      warn("marketplace.visitHandoff", {
        visitId,
        reason: "visit_not_owned",
      });
      return NextResponse.json({ error: "visit_not_owned" }, { status: 409 });
    }
    if (message === "visit_not_schedulable") {
      warn("marketplace.visitHandoff", {
        visitId,
        reason: "visit_not_schedulable",
      });
      return NextResponse.json({ error: "visit_not_schedulable" }, { status: 409 });
    }
    if (message === "same_day_release") {
      warn("marketplace.visitHandoff", {
        visitId,
        reason: "same_day_release",
      });
      return NextResponse.json(
        {
          error: "same_day_release",
          message: "Same-day releases are not available. Please contact dispatch.",
        },
        { status: 409 },
      );
    }
    if (message === "late_release_limit" || message === "early_release_limit") {
      warn("marketplace.visitHandoff", {
        visitId,
        reason: message,
        limit: message === "late_release_limit" ? LATE_RELEASE_LIMIT : EARLY_RELEASE_LIMIT,
      });
      return NextResponse.json(
        {
          error: message,
          limit: message === "late_release_limit" ? LATE_RELEASE_LIMIT : EARLY_RELEASE_LIMIT,
          message:
            message === "late_release_limit"
              ? "Late release limit reached for this quarter. Please contact dispatch."
              : "Release limit reached for this quarter. Please contact dispatch.",
        },
        { status: 429 },
      );
    }
    warn("marketplace.visitHandoff", {
      visitId,
      reason: "unexpected_error",
      message,
    });
    throw error;
  }
}
