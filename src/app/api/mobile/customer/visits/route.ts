import { NextRequest, NextResponse } from 'next/server';

import { buildCustomerSetupResponse, canSetupCustomer } from '@/lib/mobile/customer-setup';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { resolveStorageUrl } from '@/lib/storage';
import { isWellnessFlaggedMedia } from '@/lib/service-visits/flagging';

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

function isFlaggedMedia(media: {
  visibilityState?: string | null;
  analysisResult?: unknown;
  reviewStatus?: string | null;
}): boolean {
  return isWellnessFlaggedMedia(
    {
      analysisResult: media.analysisResult,
      visibilityState: media.visibilityState,
      reviewStatus: media.reviewStatus,
    },
    { requireVisible: true },
  );
}

export async function GET(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let payload: ReturnType<typeof verifyMobileToken>;
  try {
    payload = verifyMobileToken(token);
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 401 });
  }

  const userId = payload.sub;
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: 'Customer access required' },
      { status: 403 },
    );
  }
  const canSetup = canSetupCustomer(payload.roles);

  const customer = await prisma.customer.findFirst({
    where: { userId },
    select: { id: true },
  });

  if (!customer) {
    return canSetup
      ? buildCustomerSetupResponse(userId)
      : NextResponse.json(
          { ok: false, error: 'Customer access required' },
          { status: 403 },
        );
  }

  const { searchParams } = new URL(request.url);
  const limitRaw = searchParams.get('limit');
  const limit = limitRaw ? Math.min(30, Math.max(1, Number(limitRaw))) : 20;

  const visits = await prisma.serviceVisit.findMany({
    where: { customerId: customer.id },
    orderBy: { scheduledDate: 'desc' },
    take: Number.isFinite(limit) ? limit : 20,
    include: {
      assignedTo: {
        select: {
          id: true,
          name: true,
          image: true,
          scooperProfile: {
            select: {
              id: true,
              metadata: true,
            },
          },
        },
      },
      media: {
        select: {
          id: true,
          assetType: true,
          capturedAt: true,
          analysisStatus: true,
          analysisModel: true,
          analysisConfidence: true,
          analysisResult: true,
          stoolSampleId: true,
          stoolSampleView: true,
          visibilityState: true,
          reviewStatus: true,
        },
        orderBy: { capturedAt: 'asc' },
      },
      rating: {
        select: {
          id: true,
          score: true,
          comment: true,
          createdAt: true,
        },
      },
      insights: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          colorIndicator: true,
          consistencyIndicator: true,
          contentIndicator: true,
          observations: true,
          wellnessFlag: true,
          flagReason: true,
          source: true,
          sourceMediaId: true,
          autoConfidence: true,
          analysisModel: true,
        },
      },
    },
  });

  const assignedIds = Array.from(
    new Set(
      visits
        .map((visit) => visit.assignedTo?.id ?? null)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const completedCounts = assignedIds.length
    ? await prisma.serviceVisit.groupBy({
        by: ['assignedToId'],
        where: { assignedToId: { in: assignedIds }, status: 'COMPLETED' },
        _count: { _all: true },
      })
    : [];
  const completedCountMap = new Map(
    completedCounts.map((row) => [row.assignedToId ?? '', row._count._all]),
  );

  const mapped = await Promise.all(
    visits.map(async (visit) => {
    const media = visit.media ?? [];
    const insightscoopMedia = media.filter((item) => item.assetType === 'INSIGHTSCOOP');
    const flaggedMediaCount = insightscoopMedia.filter(isFlaggedMedia).length;
    const scooperProfile = visit.assignedTo?.scooperProfile;
    const scooperMetadata =
      scooperProfile && scooperProfile.metadata && typeof scooperProfile.metadata === 'object'
        ? (scooperProfile.metadata as Record<string, unknown>)
        : {};
    const avgRating =
      typeof scooperMetadata.avgRating === 'number' ? scooperMetadata.avgRating : null;
    const ratingCount =
      typeof scooperMetadata.ratingCount === 'number' ? scooperMetadata.ratingCount : null;
    const photoUrl = await resolveStorageUrl(visit.assignedTo?.image ?? null);

    return {
      id: visit.id,
      scheduledDate: visit.scheduledDate.toISOString(),
      status: visit.status,
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
      mediaCount: media.length,
      insightscoopCount: insightscoopMedia.length,
      flaggedMediaCount,
      scooper: visit.assignedTo
        ? {
            id: visit.assignedTo.id,
            name: visit.assignedTo.name ?? 'Scooper',
            photoUrl,
            avgRating,
            ratingCount,
            completedVisits: completedCountMap.get(visit.assignedTo.id) ?? 0,
          }
        : null,
      insight: visit.insights?.[0]
        ? {
            colorIndicator: visit.insights[0].colorIndicator,
            consistencyIndicator: visit.insights[0].consistencyIndicator,
            contentIndicator: visit.insights[0].contentIndicator,
            observations: visit.insights[0].observations,
            wellnessFlag: visit.insights[0].wellnessFlag,
            flagReason: visit.insights[0].flagReason,
            source: visit.insights[0].source,
            sourceMediaId: visit.insights[0].sourceMediaId,
            autoConfidence: visit.insights[0].autoConfidence,
            analysisModel: visit.insights[0].analysisModel,
          }
        : null,
    };
    }),
  );

  return NextResponse.json({
    ok: true,
    data: {
      visits: mapped,
    },
  });
}
