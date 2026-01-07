import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { generateServiceVisits } from "@/lib/dispatch/visit-generator";
import { enqueueVisitGeneration } from "@/lib/jobs/serviceVisitGenerator";
import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";

const requestSchema = z.object({
  orgId: z.string().min(1),
  date: z.string().datetime().optional(),
  lookAheadDays: z.number().int().min(0).max(30).optional(),
  dryRun: z.boolean().optional(),
  jobLimit: z.number().int().min(1).max(500).optional(),
  enqueue: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = requestSchema.parse(await request.json());
    const targetDate = payload.date ? new Date(payload.date) : undefined;

    if (payload.enqueue) {
      await enqueueVisitGeneration({
        orgId: payload.orgId,
        date: targetDate?.toISOString(),
        lookAheadDays: payload.lookAheadDays,
        dryRun: payload.dryRun,
        jobLimit: payload.jobLimit,
      });

      return NextResponse.json({ ok: true, queued: true }, { status: 202 });
    }

    const results = await generateServiceVisits({
      orgId: payload.orgId,
      date: targetDate,
      lookAheadDays: payload.lookAheadDays ?? 0,
      dryRun: payload.dryRun ?? false,
      jobLimit: payload.jobLimit ?? 250,
    });

    return NextResponse.json({
      ok: true,
      queued: false,
      createdCount: results.filter((entry) => entry.isNew).length,
      reusedCount: results.filter((entry) => !entry.isNew).length,
      visits: results.map(({ visit, job, isNew }) => ({
        visitId: visit.id,
        jobId: job.id,
        scheduledDate: visit.scheduledDate,
        customerId: job.customerId,
        isNew,
      })),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "validation_failed", details: error.flatten() },
        { status: 422 },
      );
    }

    console.error("dispatch.generate", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
