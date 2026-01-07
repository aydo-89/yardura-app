import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { generateRouteDrafts } from "@/lib/dispatch/draft-generator";
import { enqueueRouteDraftGeneration } from "@/lib/jobs/routeDrafts";

const requestSchema = z.object({
  orgId: z.string().min(1),
  date: z.string().datetime().optional(),
  lookAheadDays: z.number().int().min(0).max(7).optional(),
  autopromote: z.boolean().optional(),
  enqueue: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = requestSchema.parse(await request.json());
    const date = payload.date ? new Date(payload.date) : undefined;
    const autopromote = false;

    if (payload.enqueue) {
      await enqueueRouteDraftGeneration({
        orgId: payload.orgId,
        date: date?.toISOString(),
        lookAheadDays: payload.lookAheadDays,
        autopromote,
      });
      return NextResponse.json({ ok: true, queued: true }, { status: 202 });
    }

    const result = await generateRouteDrafts({
      orgId: payload.orgId,
      date,
      lookAheadDays: payload.lookAheadDays,
      autopromote,
    });

    return NextResponse.json({
      ok: true,
      queued: false,
      draftsCreated: result.draftsCreated,
      autoPromoted: result.autoPromoted,
      suggestions: result.suggestions,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "validation_failed", details: error.flatten() },
        { status: 422 },
      );
    }
    console.error("dispatch.generateDrafts", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
