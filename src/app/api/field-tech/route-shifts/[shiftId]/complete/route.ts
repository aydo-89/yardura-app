import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { completeRouteShift } from "@/lib/marketplace";

const bodySchema = z.object({
  actualMiles: z.coerce.number().min(0).max(1000).optional(),
});

type RouteContext = { params: Promise<{ shiftId: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { shiftId } = await params;
  const session = await safeGetServerSession(authOptions as any);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    await completeRouteShift({
      shiftId,
      userId,
      actualMiles: parsed.data.actualMiles,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export const runtime = "nodejs";
