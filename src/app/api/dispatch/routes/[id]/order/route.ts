import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { resequenceRouteStops } from "@/lib/dispatch/routes";

const bodySchema = z.object({
  stops: z
    .array(
      z.object({
        stopId: z.string(),
        position: z.number().int().min(0),
        scheduledArrival: z.string().datetime().optional(),
        scheduledDeparture: z.string().datetime().optional(),
      }),
    )
    .min(1),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = bodySchema.parse(await req.json());
    const { id } = await params;

    await resequenceRouteStops(
      id,
      body.stops.map((stop) => ({
        stopId: stop.stopId,
        position: stop.position,
        scheduledArrival: stop.scheduledArrival
          ? new Date(stop.scheduledArrival)
          : undefined,
        scheduledDeparture: stop.scheduledDeparture
          ? new Date(stop.scheduledDeparture)
          : undefined,
      })),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "validation_failed", details: error.flatten() },
        { status: 422 },
      );
    }
    console.error("dispatch.route.order", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
