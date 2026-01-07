import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scheduleInitialVisitForJob } from "@/lib/dispatch/auto-schedule";
import { Frequency } from "@prisma/client";
import {
  getPreferredTimeWindowStart,
  normalizePreferredTimeWindowSlug,
  resolvePreferredTimeWindowLabel,
} from "@/lib/time-window";

const schema = z.object({
  orgId: z.string().min(1),
  customerId: z.string().min(1),
  jobId: z.string().optional(),
  frequency: z
    .enum(["WEEKLY", "BI_WEEKLY", "TWICE_WEEKLY", "ONE_TIME"] as const)
    .optional(),
  preferredStartDate: z.string().datetime().optional(),
  yardSize: z.string().optional(),
  dogs: z.number().int().min(1).optional(),
  technicianId: z.string().optional(),
  preferredTimeWindow: z.enum(["morning", "afternoon"] as const).optional(),
});

export async function POST(request: NextRequest) {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = schema.parse(await request.json());
    const sessionOrgId = (session.user as any)?.orgId;

    if (!sessionOrgId || sessionOrgId !== payload.orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let job = null;

    if (payload.jobId) {
      job = await prisma.job.findFirst({
        where: { id: payload.jobId, orgId: payload.orgId },
      });
      if (!job) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
      }
    } else {
      if (!payload.frequency) {
        return NextResponse.json(
          { error: "frequency required when jobId is not provided" },
          { status: 400 },
        );
      }
      job = await prisma.job.create({
        data: {
          orgId: payload.orgId,
          customerId: payload.customerId,
          frequency: payload.frequency as Frequency,
          dogCount: payload.dogs ?? null,
          dayOfWeek: null,
        },
      });
    }

    const normalizedWindowSlug = normalizePreferredTimeWindowSlug(
      payload.preferredTimeWindow ?? null,
    );

    const preferredStart = payload.preferredStartDate
      ? new Date(payload.preferredStartDate)
      : undefined;

    if (preferredStart && normalizedWindowSlug) {
      const windowStart = getPreferredTimeWindowStart(normalizedWindowSlug);
      if (windowStart) {
        preferredStart.setHours(windowStart.hour, windowStart.minute, 0, 0);
      }
    }

    const visitMetadata = normalizedWindowSlug
      ? {
          preferredTimeWindow: resolvePreferredTimeWindowLabel(normalizedWindowSlug, undefined),
          preferredTimeWindowSlug: normalizedWindowSlug,
        }
      : undefined;

    const visit = await scheduleInitialVisitForJob({
      orgId: payload.orgId,
      jobId: job.id,
      customerId: payload.customerId,
      frequency: job.frequency,
      preferredStartDate: preferredStart,
      techniciansSuggestedId: payload.technicianId ?? null,
      yardSizeHint: payload.yardSize,
      dogsCount: payload.dogs,
      metadata: visitMetadata,
      tileId: job.tileId ?? null,
      revenueCents: job.perVisitRevenueCents ?? null,
    });

    const enrichedVisit = await prisma.serviceVisit.findUnique({
      where: { id: visit.id },
      include: {
        routeStop: {
          include: {
            route: true,
          },
        },
      },
    });

    return NextResponse.json({ ok: true, visit: enrichedVisit });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "validation_failed", details: error.flatten() },
        { status: 422 },
      );
    }
    console.error("dispatch.schedule", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
