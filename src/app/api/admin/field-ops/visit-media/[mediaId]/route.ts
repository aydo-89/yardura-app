import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { extractUserRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { MediaReviewStatus, MediaVisibility } from "@prisma/client";

import { createSignedUrl, deleteFile } from "@/lib/supabase-admin";

const ALLOWED_REVIEW_STATUS = new Set<MediaReviewStatus>([
  "PENDING",
  "APPROVED",
  "NEEDS_ACTION",
]);
const ALLOWED_VISIBILITY = new Set<MediaVisibility>(["VISIBLE", "HIDDEN"]);

type RouteParams = { params: Promise<{ mediaId: string }> };

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams,
) {
  const session = await getServerSession(authOptions);
  const role = extractUserRole(session);

  if (!session || !role || (role !== "ADMIN" && role !== "OWNER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { mediaId } = await params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const { reviewStatus, visibilityState, notes } = body as {
    reviewStatus?: string;
    visibilityState?: string;
    notes?: string | null;
  };

  const data: Record<string, unknown> = {};
  const now = new Date();

  if (reviewStatus) {
    const normalizedStatus = reviewStatus as MediaReviewStatus;
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

  if (visibilityState) {
    const normalizedVisibility = visibilityState as MediaVisibility;
    if (!ALLOWED_VISIBILITY.has(normalizedVisibility)) {
      return NextResponse.json({ error: "invalid_visibility" }, { status: 400 });
    }
    data.visibilityState = normalizedVisibility;
  }

  if (typeof notes === "string" || notes === null) {
    data.moderationNotes = notes;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "no_changes" }, { status: 400 });
  }

  const updated = await prisma.serviceVisitMedia
    .update({
      where: { id: mediaId },
      data,
      select: {
        id: true,
        serviceVisitId: true,
        assetType: true,
        storagePath: true,
        capturedAt: true,
        notes: true,
        analysisStatus: true,
        analysisConfidence: true,
        reviewStatus: true,
        reviewedAt: true,
        reviewedById: true,
        visibilityState: true,
        moderationNotes: true,
      },
    })
    .catch((error) => {
      console.error("[admin-visit-media] failed to update", {
        mediaId,
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
      console.error("[admin-visit-media] failed to sign url", {
        mediaId: updated.id,
        error,
      });
    }
  }

  return NextResponse.json({
    ...updated,
    capturedAt: updated.capturedAt.toISOString(),
    reviewedAt: updated.reviewedAt?.toISOString() ?? null,
    photoUrl,
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

  const { mediaId } = await params;
  const bucket = env.STORAGE_BUCKET;

  const media = await prisma.serviceVisitMedia.findUnique({
    where: { id: mediaId },
    select: {
      id: true,
      storagePath: true,
      thumbnailPath: true,
    },
  });

  if (!media) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.serviceVisitMedia.delete({ where: { id: media.id } });

  if (bucket) {
    try {
      if (media.storagePath) {
        await deleteFile(bucket, media.storagePath);
      }
      if (media.thumbnailPath && media.thumbnailPath !== media.storagePath) {
        await deleteFile(bucket, media.thumbnailPath);
      }
    } catch (error) {
      console.error("[admin-visit-media] failed to delete storage", {
        mediaId: media.id,
        error,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
