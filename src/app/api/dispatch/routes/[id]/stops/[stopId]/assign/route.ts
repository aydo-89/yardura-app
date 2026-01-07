import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { assignTechnicianToStop } from "@/lib/dispatch/routes";

const schema = z.object({
  technicianId: z.string().min(1).optional().nullable(),
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
    const body = schema.parse(await request.json());
    const { id, stopId } = await params;

    const stop = await assignTechnicianToStop(
      id,
      stopId,
      body.technicianId ?? null,
    );

    return NextResponse.json({ ok: true, stop });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "validation_failed", details: error.flatten() },
        { status: 422 },
      );
    }
    console.error("dispatch.routes.stop.assign", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
