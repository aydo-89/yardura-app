import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { BackgroundCheckStatus, ScooperStatus } from "@prisma/client";

import { authOptions, safeGetServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveBusinessId } from "@/lib/tenant";

const patchSchema = z.object({
  status: z.nativeEnum(ScooperStatus).optional(),
  backgroundCheckStatus: z.nativeEnum(BackgroundCheckStatus).optional(),
  notes: z.string().max(2000).optional(),
});

function ensureAdmin(session: any) {
  const role = session?.userRole ?? session?.user?.role ?? null;
  if (!session?.user || !["OWNER", "ADMIN"].includes(role)) {
    throw new Error("unauthorized");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ scooperId: string }> },
) {
  const session = await safeGetServerSession(authOptions as any);
  try {
    ensureAdmin(session);
  } catch {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 403 });
  }

  const orgId = await resolveBusinessId(request);
  const { scooperId } = await params;
  if (!scooperId) {
    return NextResponse.json({ ok: false, error: "missing_scooper_id" }, { status: 400 });
  }

  const payload = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "validation_error", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const profile = await prisma.scooperProfile.findFirst({
    where: { id: scooperId, orgId },
    select: { id: true },
  });

  if (!profile) {
    return NextResponse.json({ ok: false, error: "scooper_not_found" }, { status: 404 });
  }

  const updated = await prisma.scooperProfile.update({
    where: { id: scooperId },
    data: {
      status: parsed.data.status,
      backgroundCheckStatus: parsed.data.backgroundCheckStatus,
      notes: parsed.data.notes,
    },
    select: {
      id: true,
      status: true,
      backgroundCheckStatus: true,
      notes: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ ok: true, data: updated });
}

export const runtime = "nodejs";
