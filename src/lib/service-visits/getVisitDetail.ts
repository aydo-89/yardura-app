import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { createSignedUrl } from "@/lib/supabase-admin";

export interface VisitDetailForUser {
  id: string;
  status: string;
  scheduledDate: string;
  completedDate: string | null;
  serviceType: string;
  yardSize: string;
  preferredTimeWindow: string | null;
  preferredTimeWindowSlug: string | null;
  rating: {
    id: string;
    score: number;
    comment: string | null;
    createdAt: string;
  } | null;
  media: Array<{
    id: string;
    assetType: string;
    capturedAt: string;
    notes: string | null;
    url: string | null;
    analysisStatus: string;
    analysisModel: string | null;
    analysisConfidence: number | null;
    analysisRequestedAt: string | null;
    analysisCompletedAt: string | null;
    analysisError: string | null;
    analysisResult: Record<string, unknown> | null;
  }>;
  insight: {
    colorIndicator: string;
    consistencyIndicator: string;
    contentIndicator: string;
    observations: string | null;
    wellnessFlag: boolean;
    flagReason: string | null;
    recordedAt: string;
    source: string;
    sourceMediaId: string | null;
    autoConfidence: number | null;
    analysisModel: string | null;
    updatedAt: string;
  } | null;
  communications: Array<{
    id: string;
    channel: string;
    status: string;
    statusDetail: string | null;
    sentAt: string | null;
    deliveryConfirmedAt: string | null;
    templateId: string | null;
  }>;
}

export async function getVisitDetailForUser(options: {
  visitId: string;
  userId: string;
}): Promise<VisitDetailForUser | null> {
  const visit = await prisma.serviceVisit.findFirst({
    where: {
      id: options.visitId,
      userId: options.userId,
    },
    include: {
      media: {
        orderBy: { capturedAt: "asc" },
      },
      insights: true,
      rating: true,
      communications: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!visit) {
    return null;
  }

  const bucket = env.STORAGE_BUCKET;

  const media = await Promise.all(
    visit.media.map(async (item) => {
      let url: string | null = null;
      if (bucket) {
        try {
          url = await createSignedUrl(bucket, item.storagePath, 60 * 10);
        } catch (error) {
          console.error("[visit-detail] Failed to sign media URL", {
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
        url,
        analysisStatus: item.analysisStatus,
        analysisModel: item.analysisModel,
        analysisConfidence: item.analysisConfidence ?? null,
        analysisRequestedAt: item.analysisRequestedAt
          ? item.analysisRequestedAt.toISOString()
          : null,
        analysisCompletedAt: item.analysisCompletedAt
          ? item.analysisCompletedAt.toISOString()
          : null,
        analysisError: item.analysisError ?? null,
        analysisResult: (item.analysisResult as Record<string, unknown> | null) ?? null,
      };
    }),
  );

  const insight = visit.insights?.[0]
    ? {
        colorIndicator: visit.insights[0].colorIndicator,
        consistencyIndicator: visit.insights[0].consistencyIndicator,
        contentIndicator: visit.insights[0].contentIndicator,
        observations: visit.insights[0].observations,
        wellnessFlag: visit.insights[0].wellnessFlag,
        flagReason: visit.insights[0].flagReason,
        recordedAt: visit.insights[0].createdAt.toISOString(),
        source: visit.insights[0].source,
        sourceMediaId: visit.insights[0].sourceMediaId,
        autoConfidence: visit.insights[0].autoConfidence ?? null,
        analysisModel: visit.insights[0].analysisModel ?? null,
        updatedAt: visit.insights[0].updatedAt.toISOString(),
      }
    : null;

  const communications = visit.communications.map((message) => ({
    id: message.id,
    channel: message.channel,
    status: message.status,
    statusDetail: message.statusDetail,
    sentAt: message.sentAt ? message.sentAt.toISOString() : null,
    deliveryConfirmedAt: message.deliveryConfirmedAt
      ? message.deliveryConfirmedAt.toISOString()
      : null,
    templateId: message.templateId,
  }));

  return {
    id: visit.id,
    status: visit.status,
    scheduledDate: visit.scheduledDate.toISOString(),
    completedDate: visit.completedDate
      ? visit.completedDate.toISOString()
      : null,
    serviceType: visit.serviceType,
    yardSize: visit.yardSize,
    preferredTimeWindow: visit.preferredTimeWindow ?? null,
    preferredTimeWindowSlug: visit.preferredTimeWindowSlug ?? null,
    rating: visit.rating
      ? {
          id: visit.rating.id,
          score: visit.rating.score,
          comment: visit.rating.comment,
          createdAt: visit.rating.createdAt.toISOString(),
        }
      : null,
    media,
    insight,
    communications,
  };
}
