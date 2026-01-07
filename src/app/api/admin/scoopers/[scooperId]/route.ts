import { NextRequest, NextResponse } from "next/server";
import { ScooperStatus, BackgroundCheckStatus } from "@prisma/client";
import { z } from "zod";

import { resolveBusinessId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { setScooperStatus } from "@/lib/marketplace";

const statusSchema = z.object({
  status: z.nativeEnum(ScooperStatus),
  backgroundCheckStatus: z.nativeEnum(BackgroundCheckStatus).optional(),
});

type RouteContext = { params: Promise<{ scooperId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { scooperId } = await params;
  const orgId = await resolveBusinessId(request);
  const payload = await request.json();
  const parsed = statusSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const profile = await prisma.scooperProfile.findUnique({
    where: { id: scooperId },
    select: { id: true, orgId: true },
  });

  if (!profile || profile.orgId !== orgId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const updated = await setScooperStatus(scooperId, parsed.data.status, {
    backgroundCheckStatus: parsed.data.backgroundCheckStatus,
  });

  return NextResponse.json({ ok: true, profile: updated });
}

export const runtime = "nodejs";
