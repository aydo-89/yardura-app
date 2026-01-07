import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { scheduleRecurringVisitGeneration } from "@/lib/jobs/serviceVisitGenerator";

const schema = z.object({
  orgId: z.string().min(1),
  cron: z.string().optional(),
  lookAheadDays: z.number().int().min(0).max(30).optional(),
  jobLimit: z.number().int().min(1).max(500).optional(),
  dryRun: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = schema.parse(await request.json());
    await scheduleRecurringVisitGeneration(payload);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "validation_failed", details: error.flatten() },
        { status: 422 },
      );
    }
    console.error("dispatch.generate.schedule", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
