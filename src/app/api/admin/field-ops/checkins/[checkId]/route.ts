import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { extractUserRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { DailyCheckReviewStatus } from "@prisma/client";

import { createSignedUrl, deleteFile } from "@/lib/supabase-admin";

const ALLOWED_REVIEW_STATUS = new Set<DailyCheckReviewStatus>([
  "PENDING",
  "APPROVED",
  "NEEDS_ACTION",
]);

type RouteParams = { params: Promise<{ checkId: string }> };

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams,
) {
  const session = await getServerSession(authOptions);
  const role = extractUserRole(session);

  if (!session || !role || (role !== "ADMIN" && role !== "OWNER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { checkId } = await params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const { reviewStatus, notes } = body as {
    reviewStatus?: string;
    notes?: string | null;
  };

  const data: Record<string, unknown> = {};
  const now = new Date();

  if (typeof notes === "string" || notes === null) {
    data.notes = notes;
  }

  if (reviewStatus) {
    const normalizedStatus = reviewStatus as DailyCheckReviewStatus;
    if (!ALLOWED_REVIEW_STATUS.has(normalizedStatus)) {
      return NextResponse.json({ error: "invalid_status" }, { status: 400 });
    }

    data.reviewStatus = normalizedStatus;
    if (normalizedStatus === "PENDING") {
      data.reviewedAt = null;
      data.reviewedById = null;
    } else {
      const reviewerId = (session.user as any)?.id ?? null;
      data.reviewedAt = now;
      data.reviewedById = reviewerId;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "no_changes" }, { status: 400 });
  }

  const updated = await prisma.scooperDailyCheck
    .update({
      where: { id: checkId },
      data,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })
    .catch((error) => {
      console.error("[admin-checkins] failed to update", {
        checkId,
        error,
      });
      return null;
    });

  if (!updated) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const bucket = env.STORAGE_BUCKET;
  let photoUrl: string | null = null;
  if (bucket && updated.storagePath) {
    try {
      photoUrl = await createSignedUrl(bucket, updated.storagePath, 60 * 60);
    } catch (error) {
      console.error("[admin-checkins] failed to sign url", {
        checkId: updated.id,
        error,
      });
    }
  }

  return NextResponse.json({
    id: updated.id,
    capturedAt: updated.capturedAt.toISOString(),
    reviewStatus: updated.reviewStatus,
    notes: updated.notes,
    user: updated.user,
    photoUrl,
    gpsLat: updated.gpsLat,
    gpsLng: updated.gpsLng,
    checklist: updated.checklist,
    reviewedAt: updated.reviewedAt?.toISOString() ?? null,
    reviewedById: updated.reviewedById,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams,
) {
  const session = await getServerSession(authOptions);
  const role = extractUserRole(session);

  if (!session || !role || (role !== "ADMIN" && role !== "OWNER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { checkId } = await params;
  const bucket = env.STORAGE_BUCKET;

  const record = await prisma.scooperDailyCheck.findUnique({
    where: { id: checkId },
    select: {
      id: true,
      storagePath: true,
      thumbnailPath: true,
    },
  });

  if (!record) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.scooperDailyCheck.delete({ where: { id: checkId } });

  if (bucket) {
    try {
      if (record.storagePath) {
        await deleteFile(bucket, record.storagePath);
      }
      if (record.thumbnailPath && record.thumbnailPath !== record.storagePath) {
        await deleteFile(bucket, record.thumbnailPath);
      }
    } catch (error) {
      console.error("[admin-checkins] failed to delete storage", {
        checkId: record.id,
        error,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
