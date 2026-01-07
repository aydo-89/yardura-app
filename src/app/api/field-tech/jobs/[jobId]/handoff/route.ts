import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  DisciplineEventType,
  JobStatus,
  Prisma,
  RouteStopStatus,
  ServiceStatus,
  VisitOfferStatus,
} from "@prisma/client";

import { getScooperAuth } from "@/lib/auth/scooper";
import { prisma } from "@/lib/prisma";
import { enqueueOfferPublishing } from "@/lib/jobs/marketplaceOfferPublisher";
import { createVisitOffersForVisits } from "@/lib/marketplace/offers";
import { JOB_RELEASE_LIMIT } from "@/lib/marketplace/discipline";
import { recordDisciplineEvent } from "@/lib/marketplace/discipline-events";
import { info, warn } from "@/lib/log";
import { convertUtcToZonedParts, SERVICE_TIME_ZONE } from "@/lib/timezone";

const STRIKE_GRACE_HOURS = 48;

const handoffSchema = z.object({
  reason: z.string().max(240).optional(),
});

type RouteParams = { params: Promise<{ jobId: string }> };

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

  const { jobId } = await params;
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
      const [profile, job] = await Promise.all([
        tx.scooperProfile.findUnique({
          where: { userId },
          select: {
            id: true,
            orgId: true,
            metadata: true,
          },
        }),
        tx.job.findUnique({
          where: { id: jobId },
          select: {
            id: true,
            status: true,
            frequency: true,
            tile: {
              select: {
                slug: true,
              },
            },
            serviceVisits: {
              where: {
                status: ServiceStatus.SCHEDULED,
                scheduledDate: { gte: now },
              },
              select: {
                id: true,
                assignedToId: true,
                notes: true,
                metadata: true,
                scheduledDate: true,
                routeStop: {
                  select: { id: true },
                },
              },
            },
          },
        }),
      ]);

      if (!profile) {
        throw new Error("profile_missing");
      }

      if (!job) {
        throw new Error("job_not_found");
      }

      if (job.status !== JobStatus.ACTIVE) {
        throw new Error("job_not_active");
      }

      const assignedVisits = job.serviceVisits.filter(
        (visit) => visit.assignedToId === userId,
      );

      if (!assignedVisits.length) {
        throw new Error("job_not_owned");
      }

      const hasSameDayVisit = assignedVisits.some(
        (visit) => visit.scheduledDate && isSameServiceDay(visit.scheduledDate, now),
      );
      if (hasSameDayVisit) {
        throw new Error("same_day_release");
      }

      const hasLateRelease = assignedVisits.some((visit) => {
        if (!visit.scheduledDate) return false;
        return visit.scheduledDate.getTime() - now.getTime() <= STRIKE_GRACE_HOURS * 60 * 60 * 1000;
      });

      const eventReason = parsed.data.reason?.trim()
        ? `Job handoff: ${parsed.data.reason.trim()}`
        : hasLateRelease
          ? "Job handoff (late)"
          : "Job handoff";

      const jobReleaseRecord = await recordDisciplineEvent({
        tx,
        profile,
        type: DisciplineEventType.JOB_RELEASE,
        reason: eventReason,
        jobId: job.id,
        enforceLimit: true,
        now,
      });

      if (!jobReleaseRecord.allowed) {
        throw new Error("job_handoff_limit");
      }

      const visitIds = assignedVisits.map((visit) => visit.id);

      await tx.visitOffer.updateMany({
        where: {
          serviceVisitId: { in: visitIds },
          status: VisitOfferStatus.ACCEPTED,
        },
        data: {
          status: VisitOfferStatus.RECALLED,
          cancelledAt: now,
        },
      });

      await Promise.all(
        assignedVisits.map((visit) => {
          const baseMetadata =
            visit.metadata && typeof visit.metadata === "object" && !Array.isArray(visit.metadata)
              ? { ...(visit.metadata as Record<string, unknown>) }
              : {};
          const handoffMeta =
            baseMetadata.handoff && typeof baseMetadata.handoff === "object" && !Array.isArray(baseMetadata.handoff)
              ? { ...(baseMetadata.handoff as Record<string, unknown>) }
              : {};
          handoffMeta.type = "job";
          handoffMeta.at = now.toISOString();
          if (parsed.data.reason) {
            handoffMeta.reason = parsed.data.reason;
          }
          baseMetadata.handoff = handoffMeta;

          return tx.serviceVisit.update({
            where: { id: visit.id },
            data: {
              assignedToId: null,
              metadata: asJsonValue(baseMetadata as Prisma.InputJsonValue),
              notes: parsed.data.reason
                ? [visit.notes?.trim(), `Job handoff: ${parsed.data.reason}`]
                    .filter(Boolean)
                    .join("\n\n")
                : visit.notes ?? null,
            },
          });
        }),
      );

      await tx.job.update({
        where: { id: job.id },
        data: {
          primaryScooperId: null,
        },
      });

      await tx.routeStop.updateMany({
        where: {
          serviceVisitId: { in: visitIds },
        },
        data: {
          technicianId: null,
          status: RouteStopStatus.PENDING,
        },
      });

      return {
        orgId: profile.orgId,
        tileSlug: job.tile?.slug ?? null,
        releasedVisitIds: visitIds,
        jobReleaseCount: jobReleaseRecord.currentCount,
      };
    });

    if (result.releasedVisitIds.length) {
      await createVisitOffersForVisits({
        orgId: result.orgId,
        visitIds: result.releasedVisitIds,
      });
    }

    if (result.tileSlug) {
      await enqueueOfferPublishing({
        orgId: result.orgId,
        tileSlugs: [result.tileSlug],
      });
    } else {
      await enqueueOfferPublishing({ orgId: result.orgId });
    }

    info("marketplace.jobHandoff", {
      orgId: result.orgId,
      jobId,
      tileSlug: result.tileSlug,
      jobReleaseCount: result.jobReleaseCount,
      limit: JOB_RELEASE_LIMIT,
      reason: parsed.data.reason ?? null,
    });

    return NextResponse.json({
      ok: true,
      jobReleaseCountThisQuarter: result.jobReleaseCount,
      limit: JOB_RELEASE_LIMIT,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (message === "profile_missing") {
      warn("marketplace.jobHandoff", {
        jobId,
        reason: "profile_missing",
      });
      return NextResponse.json({ error: "profile_missing" }, { status: 404 });
    }
    if (message === "job_not_found") {
      warn("marketplace.jobHandoff", {
        jobId,
        reason: "job_not_found",
      });
      return NextResponse.json({ error: "job_not_found" }, { status: 404 });
    }
    if (message === "job_not_active") {
      warn("marketplace.jobHandoff", {
        jobId,
        reason: "job_not_active",
      });
      return NextResponse.json({ error: "job_not_active" }, { status: 409 });
    }
    if (message === "job_not_owned") {
      warn("marketplace.jobHandoff", {
        jobId,
        reason: "job_not_owned",
      });
      return NextResponse.json({ error: "job_not_owned" }, { status: 409 });
    }
    if (message === "same_day_release") {
      warn("marketplace.jobHandoff", {
        jobId,
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
    if (message === "job_handoff_limit") {
      warn("marketplace.jobHandoff", {
        jobId,
        reason: "job_handoff_limit",
        limit: JOB_RELEASE_LIMIT,
      });
      return NextResponse.json(
        {
          error: "job_handoff_limit",
          limit: JOB_RELEASE_LIMIT,
          message: "Recurring job release limit reached for this quarter. Please contact dispatch.",
        },
        { status: 429 },
      );
    }
    warn("marketplace.jobHandoff", {
      jobId,
      reason: "unexpected_error",
      message,
    });
    throw error;
  }
}
