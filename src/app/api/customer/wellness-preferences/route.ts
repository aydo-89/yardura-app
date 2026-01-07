import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authOptions, safeGetServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const preferencesSchema = z.object({
  shareWellnessNotes: z.boolean().optional(),
  shareWellnessCaptures: z.boolean().optional(),
  autoBlurWellnessPhotos: z.boolean().optional(),
  parasiteRiskNotificationsEnabled: z.boolean().optional(),
});

export async function GET() {
  const session = (await safeGetServerSession(authOptions as any)) as
    | { user?: { email?: string | null } }
    | null;

  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const customer = await prisma.customer.findFirst({
    where: { email: session.user.email },
    select: {
      shareWellnessNotes: true,
      shareWellnessCaptures: true,
      autoBlurWellnessPhotos: true,
      parasiteRiskNotificationsEnabled: true,
    },
  });

  if (!customer) {
    return NextResponse.json({ ok: false, error: "Customer not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    data: {
      shareWellnessNotes: customer.shareWellnessNotes ?? true,
      shareWellnessCaptures: customer.shareWellnessCaptures ?? true,
      autoBlurWellnessPhotos: customer.autoBlurWellnessPhotos ?? true,
      parasiteRiskNotificationsEnabled: customer.parasiteRiskNotificationsEnabled ?? true,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const session = (await safeGetServerSession(authOptions as any)) as
    | { user?: { email?: string | null } }
    | null;

  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = preferencesSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid preferences payload", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const customer = await prisma.customer.findFirst({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!customer) {
    return NextResponse.json({ ok: false, error: "Customer not found" }, { status: 404 });
  }

  const updated = await prisma.customer.update({
    where: { id: customer.id },
    data: {
      ...(parsed.data.shareWellnessNotes !== undefined
        ? { shareWellnessNotes: parsed.data.shareWellnessNotes }
        : {}),
      ...(parsed.data.shareWellnessCaptures !== undefined
        ? { shareWellnessCaptures: parsed.data.shareWellnessCaptures }
        : {}),
      ...(parsed.data.autoBlurWellnessPhotos !== undefined
        ? { autoBlurWellnessPhotos: parsed.data.autoBlurWellnessPhotos }
        : {}),
      ...(parsed.data.parasiteRiskNotificationsEnabled !== undefined
        ? { parasiteRiskNotificationsEnabled: parsed.data.parasiteRiskNotificationsEnabled }
        : {}),
    },
    select: {
      shareWellnessNotes: true,
      shareWellnessCaptures: true,
      autoBlurWellnessPhotos: true,
      parasiteRiskNotificationsEnabled: true,
    },
  });

  return NextResponse.json({
    ok: true,
    data: {
      shareWellnessNotes: updated.shareWellnessNotes ?? true,
      shareWellnessCaptures: updated.shareWellnessCaptures ?? true,
      autoBlurWellnessPhotos: updated.autoBlurWellnessPhotos ?? true,
      parasiteRiskNotificationsEnabled: updated.parasiteRiskNotificationsEnabled ?? true,
    },
  });
}

export const runtime = "nodejs";
