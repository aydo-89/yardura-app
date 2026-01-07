import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { extractUserRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { createSignedUrl } from "@/lib/supabase-admin";

const MAX_PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = extractUserRole(session);

  if (!session || !role || (role !== "ADMIN" && role !== "OWNER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Get the admin user's orgId from the database
  const adminUser = await prisma.user.findUnique({
    where: { email: session.user?.email ?? undefined },
    select: { orgId: true },
  });

  if (!adminUser?.orgId) {
    return NextResponse.json({ error: "Organization not found" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const reviewStatus = searchParams.get("reviewStatus");
  const status = searchParams.get("status");
  const technicianId = searchParams.get("technicianId");
  const customerId = searchParams.get("customerId");
  const scheduledAfter = searchParams.get("scheduledAfter");
  const scheduledBefore = searchParams.get("scheduledBefore");
  const cursor = searchParams.get("cursor");
  const pageSizeParam = searchParams.get("limit") ?? "20";
  const limit = Math.min(Math.max(Number.parseInt(pageSizeParam, 10) || 20, 1), MAX_PAGE_SIZE);

  // IMPORTANT: Always filter by the admin's orgId for data isolation
  const where: Record<string, unknown> = {
    orgId: adminUser.orgId,
  };
  
  if (status) {
    where.status = status;
  }
  if (technicianId) {
    where.assignedToId = technicianId;
  }
  if (customerId) {
    where.customerId = customerId;
  }
  if (scheduledAfter || scheduledBefore) {
    where.scheduledDate = {
      ...(scheduledAfter ? { gte: new Date(scheduledAfter) } : {}),
      ...(scheduledBefore ? { lte: new Date(scheduledBefore) } : {}),
    };
  }

  if (reviewStatus) {
    where.review = {
      status: reviewStatus,
    };
  }

  const bucket = env.STORAGE_BUCKET;

  const visits = await prisma.serviceVisit.findMany({
    where,
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          addressLine1: true,
          city: true,
          state: true,
          zip: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      media: {
        select: {
          id: true,
          assetType: true,
          storagePath: true,
          thumbnailPath: true,
          capturedAt: true,
          notes: true,
          analysisStatus: true,
          analysisConfidence: true,
          analysisResult: true,
          analysisModel: true,
          analysisCompletedAt: true,
          analysisError: true,
          reviewStatus: true,
          visibilityState: true,
          moderationNotes: true,
          stoolSampleId: true,
          stoolSampleView: true,
        },
      },
      insights: {
        select: {
          colorIndicator: true,
          consistencyIndicator: true,
          contentIndicator: true,
          observations: true,
          wellnessFlag: true,
          flagReason: true,
        },
      },
      review: true,
    },
    orderBy: [{ scheduledDate: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor
      ? {
          skip: 1,
          cursor: {
            id: cursor,
          },
        }
      : {}),
  });

  const hasNext = visits.length > limit;
  if (hasNext) {
    visits.pop();
  }

  const items = await Promise.all(
    visits.map(async (visit) => {
      const media = await Promise.all(
        visit.media.map(async (item) => {
          let photoUrl: string | null = null;
          if (bucket && item.storagePath) {
            try {
              photoUrl = await createSignedUrl(bucket, item.storagePath, 60 * 60);
            } catch (error) {
              console.error("[admin-visits] failed to sign media url", {
                mediaId: item.id,
                error,
              });
            }
          }

          return {
            id: item.id,
            assetType: item.assetType,
            capturedAt: item.capturedAt.toISOString(),
            notes: item.notes,
            analysisStatus: item.analysisStatus,
            analysisConfidence: item.analysisConfidence,
            analysisResult: item.analysisResult,
            analysisModel: item.analysisModel,
            analysisCompletedAt: item.analysisCompletedAt?.toISOString() ?? null,
            analysisError: item.analysisError,
            reviewStatus: item.reviewStatus,
            visibilityState: item.visibilityState,
            moderationNotes: item.moderationNotes,
            stoolSampleId: item.stoolSampleId,
            stoolSampleView: item.stoolSampleView,
            storagePath: item.storagePath,
            photoUrl,
          };
        }),
      );

      const insight = visit.insights[0] ?? null;

      return {
        id: visit.id,
        scheduledDate: visit.scheduledDate.toISOString(),
        status: visit.status,
        customer: visit.customer,
        assignedTo: visit.assignedTo,
        media,
        insight,
        review: visit.review
          ? {
              id: visit.review.id,
              status: visit.review.status,
              reviewerId: visit.review.reviewerId,
              summary: visit.review.summary,
              updatedAt: visit.review.updatedAt.toISOString(),
            }
          : null,
      };
    }),
  );

  const nextCursor = hasNext ? items[items.length - 1]?.id : null;

  return NextResponse.json({ items, nextCursor });
}
