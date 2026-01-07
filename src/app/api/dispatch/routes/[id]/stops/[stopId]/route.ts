import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { moveStopToRoute, removeStopFromRoute } from "@/lib/dispatch/routes";

const moveSchema = z.object({
  destinationRouteId: z.string().min(1),
  position: z.number().int().min(0).optional(),
  scheduledDate: z.string().datetime().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stopId: string }> },
) {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = moveSchema.parse(await request.json());
    const { stopId } = await params;
    const stop = await moveStopToRoute(
      stopId,
      body.destinationRouteId,
      body.position,
      body.scheduledDate ? new Date(body.scheduledDate) : undefined,
    );
    return NextResponse.json({ ok: true, stop });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "validation_failed", details: error.flatten() },
        { status: 422 },
      );
    }
    console.error("dispatch.routes.stop.move", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; stopId: string }> },
) {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { stopId } = await params;
    const stop = await removeStopFromRoute(stopId);
    return NextResponse.json({ ok: true, stop });
  } catch (error) {
    console.error("dispatch.routes.stop.delete", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
