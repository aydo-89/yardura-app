import { addDays } from 'date-fns';
import { NextRequest, NextResponse } from 'next/server';

import { buildCustomerSetupResponse, canSetupCustomer } from '@/lib/mobile/customer-setup';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { getWeekWindow } from '@/lib/wellness/reports';
import {
  calculateReportPoints,
  calculateStreak,
  getWeekKey,
  WELLNESS_REWARD_RULES,
} from '@/lib/wellness/rewards';
import { getCustomerRewardMetrics } from '@/lib/rewards/customerRewardEvents';
import { resolveStorageUrl } from '@/lib/storage';
import { isWellnessFlaggedMedia } from '@/lib/service-visits/flagging';

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

function extractRewardPoints(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }
  const rewards = (metadata as Record<string, unknown>).wellnessRewards;
  if (!rewards || typeof rewards !== 'object') return null;
  const points = (rewards as Record<string, unknown>).pointsAwarded;
  return typeof points === 'number' ? points : null;
}

function hasVetProof(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return false;
  }
  const vetProof = (metadata as Record<string, unknown>).vetProof;
  if (!vetProof || typeof vetProof !== 'object' || Array.isArray(vetProof)) {
    return false;
  }
  const storagePath = (vetProof as Record<string, unknown>).storagePath;
  return typeof storagePath === 'string' && storagePath.length > 0;
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

function extractMediaFlagReasons(media: {
  analysisResult?: unknown;
}): string[] {
  if (!media.analysisResult || typeof media.analysisResult !== 'object') {
    return [];
  }
  const result = media.analysisResult as { flag_reason?: string | null };
  const reason = result.flag_reason?.trim();
  return reason ? [reason] : [];
}

function uniqueReasons(reasons: string[]): string[] {
  return Array.from(new Set(reasons.filter((reason) => reason)));
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
    select: { id: true, shareWellnessNotes: true, orgId: true },
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
  const weekStartParam = searchParams.get('weekStart');
  const anchorDate = weekStartParam ? new Date(weekStartParam) : new Date();
  if (Number.isNaN(anchorDate.getTime())) {
    return NextResponse.json(
      { ok: false, error: 'Invalid weekStart' },
      { status: 400 },
    );
  }

  const { weekStart, weekEnd } = getWeekWindow(anchorDate);
  const weekKey = getWeekKey(weekStart);
  const lastWeekStart = addDays(weekStart, -7);

  const dogs = await prisma.dog.findMany({
    where: {
      OR: [{ customerId: customer.id }, { userId }],
    },
    select: {
      id: true,
      name: true,
      breed: true,
      age: true,
      customerId: true,
      photoUrl: true,
    },
    orderBy: { name: 'asc' },
  });

  const unlinkedDogIds = dogs
    .filter((dog) => !dog.customerId)
    .map((dog) => dog.id);

  if (unlinkedDogIds.length) {
    await prisma.dog.updateMany({
      where: { id: { in: unlinkedDogIds } },
      data: { customerId: customer.id },
    });
  }

  const dogIds = dogs.map((dog) => dog.id);

  const visitsThisWeek = await prisma.serviceVisit.findMany({
    where: {
      customerId: customer.id,
      scheduledDate: {
        gte: weekStart,
        lte: weekEnd,
      },
    },
    select: {
      id: true,
      scheduledDate: true,
      insights: {
        where: { wellnessFlag: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { flagReason: true, wellnessFlag: true },
      },
      media: {
        where: { assetType: 'INSIGHTSCOOP', visibilityState: 'VISIBLE' },
        select: { visibilityState: true, analysisResult: true, reviewStatus: true },
      },
    },
  });

  const flaggedVisits = visitsThisWeek
    .map((visit) => {
      const insight = visit.insights?.[0];
      const insightFlag = Boolean(insight?.wellnessFlag);
      const mediaFlags = visit.media?.filter(isFlaggedMedia) ?? [];
      if (!insightFlag && mediaFlags.length === 0) return null;
      const reasons = uniqueReasons([
        ...(insight?.flagReason ? [insight.flagReason] : []),
        ...mediaFlags.flatMap(extractMediaFlagReasons),
      ]);
      return {
        scheduledDate: visit.scheduledDate,
        reasons,
      };
    })
    .filter(Boolean) as Array<{ scheduledDate: Date; reasons: string[] }>;

  const aiFlags = {
    flaggedVisitCount: flaggedVisits.length,
    flaggedDates: flaggedVisits.map((visit) => visit.scheduledDate.toISOString()),
    flagReasons: uniqueReasons(flaggedVisits.flatMap((visit) => visit.reasons)),
  };

  const reports = await prisma.weeklyWellnessReport.findMany({
    where: {
      customerId: customer.id,
      dogId: { in: dogIds },
    },
    select: {
      id: true,
      dogId: true,
      weekStart: true,
      noIssues: true,
      symptomTags: true,
      appetite: true,
      hydration: true,
      energy: true,
      stoolFrequency: true,
      vomiting: true,
      diarrhea: true,
      medsGiven: true,
      medsNotes: true,
      behaviorNotes: true,
      stoolNotes: true,
      diagnosisLabel: true,
      diagnosisSource: true,
      diagnosisNotes: true,
      reportedAt: true,
      metadata: true,
    },
  });

  const reportsByDog = new Map<string, typeof reports>();
  reports.forEach((report) => {
    const key = report.dogId ?? 'unknown';
    const list = reportsByDog.get(key) ?? [];
    list.push(report);
    reportsByDog.set(key, list);
  });

  const rewardMetrics = await getCustomerRewardMetrics({
    orgId: customer.orgId,
    customerId: customer.id,
    weekStart,
    weekEnd,
  });

  const dogsPayload = await Promise.all(dogs.map(async (dog) => {
    const dogReports = reportsByDog.get(dog.id) ?? [];
    const weekStarts = dogReports.map((report) => report.weekStart);

    const currentWeekReport = dogReports.find(
      (report) => getWeekKey(report.weekStart) === weekKey,
    );

    const streakAnchor = currentWeekReport ? weekStart : lastWeekStart;
    const streakCount = calculateStreak(weekStarts, streakAnchor);
    const streakIfSubmit = currentWeekReport
      ? streakCount
      : Math.max(1, streakCount + 1);

    const sortedReports = [...dogReports].sort(
      (a, b) => a.weekStart.getTime() - b.weekStart.getTime(),
    );
    let rollingStreak = 0;
    let prevWeekStart: Date | null = null;
    sortedReports.forEach((report) => {
      if (!prevWeekStart) {
        rollingStreak = 1;
      } else {
        const expected = addDays(prevWeekStart, 7);
        rollingStreak =
          getWeekKey(report.weekStart) === getWeekKey(expected)
            ? rollingStreak + 1
            : 1;
      }

      const pointsFromMeta = extractRewardPoints(report.metadata);
      const points =
        pointsFromMeta ??
        calculateReportPoints(
          {
            noIssues: report.noIssues,
            symptomTags: report.symptomTags,
            behaviorNotes: report.behaviorNotes,
            stoolNotes: report.stoolNotes,
            diagnosisSource: report.diagnosisSource,
            diagnosisLabel: report.diagnosisLabel,
          },
          rollingStreak,
        ).totalPoints;

      prevWeekStart = report.weekStart;
    });

    const pointsAwarded =
      currentWeekReport?.metadata != null
        ? extractRewardPoints(currentWeekReport.metadata)
        : null;

    const resolvedCurrentWeekPoints =
      currentWeekReport
        ? pointsAwarded ??
          calculateReportPoints(
            {
              noIssues: currentWeekReport.noIssues,
              symptomTags: currentWeekReport.symptomTags,
              behaviorNotes: currentWeekReport.behaviorNotes,
              stoolNotes: currentWeekReport.stoolNotes,
              diagnosisSource: currentWeekReport.diagnosisSource,
              diagnosisLabel: currentWeekReport.diagnosisLabel,
            },
            streakCount,
          ).totalPoints
        : 0;

    return {
      id: dog.id,
      name: dog.name,
      breed: dog.breed,
      age: dog.age,
      photoUrl: await resolveStorageUrl(dog.photoUrl),
      streakCount,
      streakIfSubmit,
      currentWeekReport: currentWeekReport
        ? {
            id: currentWeekReport.id,
            noIssues: currentWeekReport.noIssues,
            symptomTags: currentWeekReport.symptomTags ?? [],
            appetite: currentWeekReport.appetite ?? null,
            hydration: currentWeekReport.hydration ?? null,
            energy: currentWeekReport.energy ?? null,
            stoolFrequency:
              typeof currentWeekReport.stoolFrequency === 'number'
                ? currentWeekReport.stoolFrequency
                : null,
            vomiting: currentWeekReport.vomiting ?? false,
            diarrhea: currentWeekReport.diarrhea ?? false,
            medsGiven: currentWeekReport.medsGiven ?? false,
            medsNotes: currentWeekReport.medsNotes ?? null,
            behaviorNotes: currentWeekReport.behaviorNotes ?? null,
            stoolNotes: currentWeekReport.stoolNotes ?? null,
            diagnosisLabel: currentWeekReport.diagnosisLabel ?? null,
            diagnosisSource: currentWeekReport.diagnosisSource ?? null,
            diagnosisNotes: currentWeekReport.diagnosisNotes ?? null,
            reportedAt: currentWeekReport.reportedAt.toISOString(),
            pointsAwarded,
            vetProofSubmitted: hasVetProof(currentWeekReport.metadata),
          }
        : null,
    };
  }));

  return NextResponse.json({
    ok: true,
    data: {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      pointsRules: WELLNESS_REWARD_RULES,
      pointsBalance: rewardMetrics.balance,
      pointsThisWeek: rewardMetrics.pointsThisWeek,
      ratingCreditsTotal: rewardMetrics.ratingCreditsTotal,
      ratingCreditsThisWeek: rewardMetrics.ratingCreditsThisWeek,
      shareWellnessNotes: customer.shareWellnessNotes ?? true,
      aiFlags,
      dogs: dogsPayload,
    },
  });
}
