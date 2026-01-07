import { CustomerRewardEventType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { calculateReportPoints } from "@/lib/wellness/rewards";
import { getBusinessConfig } from "@/lib/business-config";
import {
  extractCareCreditsAwarded,
  resolveRatingCareCredits,
} from "@/lib/rewards/care-credits";

const ACTIVE_REDEMPTION_STATUSES: ("PENDING" | "APPROVED" | "FULFILLED")[] = [
  "PENDING",
  "APPROVED",
  "FULFILLED",
];

type AwardCustomerPointsInput = {
  orgId: string;
  customerId: string;
  eventType: CustomerRewardEventType;
  sourceKey: string;
  points: number;
  metadata?: Prisma.InputJsonValue | null;
  createdAt?: Date;
};

const extractWellnessReportPoints = (metadata: unknown): number | null => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const rewards = (metadata as Record<string, unknown>).wellnessRewards;
  if (!rewards || typeof rewards !== "object" || Array.isArray(rewards)) {
    return null;
  }
  const points = (rewards as Record<string, unknown>).pointsAwarded;
  return typeof points === "number" && Number.isFinite(points) ? points : null;
};

export async function awardCustomerRewardPoints(input: AwardCustomerPointsInput) {
  const { orgId, customerId, eventType, sourceKey, createdAt } = input;
  if (!orgId || !customerId || !sourceKey) return null;

  const points = Math.max(0, Math.floor(input.points));
  if (points <= 0) return null;

  const existing = await prisma.customerRewardEvent.findUnique({
    where: {
      orgId_eventType_sourceKey: {
        orgId,
        eventType,
        sourceKey,
      },
    },
    select: { id: true },
  });

  if (existing) return existing;

  return prisma.customerRewardEvent.create({
    data: {
      orgId,
      customerId,
      eventType,
      points,
      sourceKey,
      metadata: input.metadata ?? Prisma.JsonNull,
      createdAt: createdAt ?? undefined,
    },
  });
}

export async function ensureCustomerRewardEvents(orgId: string, customerId: string) {
  const existing = await prisma.customerRewardEvent.findMany({
    where: { orgId, customerId },
    select: { eventType: true, sourceKey: true },
  });
  const existingKeys = new Set(
    existing.map((entry) => `${entry.eventType}:${entry.sourceKey}`),
  );

  const config = await getBusinessConfig(orgId);
  const ratingFallbackCredits = resolveRatingCareCredits(config);

  const [reports, ratings] = await Promise.all([
    prisma.weeklyWellnessReport.findMany({
      where: { customerId },
      select: {
        id: true,
        weekStart: true,
        weekEnd: true,
        dogId: true,
        noIssues: true,
        symptomTags: true,
        behaviorNotes: true,
        stoolNotes: true,
        diagnosisSource: true,
        diagnosisLabel: true,
        metadata: true,
        reportedAt: true,
        createdAt: true,
      },
    }),
    prisma.serviceVisitRating.findMany({
      where: { customerId },
      select: { id: true, metadata: true, createdAt: true },
    }),
  ]);

  const toCreate: Prisma.CustomerRewardEventCreateManyInput[] = [];

  reports.forEach((report) => {
    const sourceKey = `weekly-report:${report.id}`;
    const key = `${CustomerRewardEventType.WEEKLY_REPORT}:${sourceKey}`;
    if (existingKeys.has(key)) return;

    const pointsFromMeta = extractWellnessReportPoints(report.metadata);
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
        1,
      ).totalPoints;

    if (!Number.isFinite(points) || points <= 0) return;

    toCreate.push({
      orgId,
      customerId,
      eventType: CustomerRewardEventType.WEEKLY_REPORT,
      points: Math.floor(points),
      sourceKey,
      metadata: {
        reportId: report.id,
        dogId: report.dogId ?? null,
        weekStart: report.weekStart.toISOString(),
        weekEnd: report.weekEnd.toISOString(),
      } as Prisma.InputJsonValue,
      createdAt: report.reportedAt ?? report.createdAt,
      updatedAt: report.reportedAt ?? report.createdAt,
    });
  });

  ratings.forEach((rating) => {
    const sourceKey = `visit-rating:${rating.id}`;
    const key = `${CustomerRewardEventType.VISIT_RATING}:${sourceKey}`;
    if (existingKeys.has(key)) return;

    const points = extractCareCreditsAwarded(
      rating.metadata,
      ratingFallbackCredits,
    );

    if (!Number.isFinite(points) || points <= 0) return;

    toCreate.push({
      orgId,
      customerId,
      eventType: CustomerRewardEventType.VISIT_RATING,
      points: Math.floor(points),
      sourceKey,
      metadata: {
        ratingId: rating.id,
      } as Prisma.InputJsonValue,
      createdAt: rating.createdAt,
      updatedAt: rating.createdAt,
    });
  });

  if (!toCreate.length) return 0;

  await prisma.customerRewardEvent.createMany({
    data: toCreate,
    skipDuplicates: true,
  });

  return toCreate.length;
}

export async function getCustomerRewardBalance(orgId: string, customerId: string) {
  await ensureCustomerRewardEvents(orgId, customerId);

  const [earned, spent] = await Promise.all([
    prisma.customerRewardEvent.aggregate({
      where: { orgId, customerId },
      _sum: { points: true },
    }),
    prisma.customerRewardRedemption.aggregate({
      where: {
        orgId,
        customerId,
        status: { in: ACTIVE_REDEMPTION_STATUSES },
      },
      _sum: { pointsCost: true },
    }),
  ]);

  const earnedPoints = earned._sum?.points ?? 0;
  const spentPoints = spent._sum?.pointsCost ?? 0;
  const balance = Math.max(0, earnedPoints - spentPoints);

  return { earnedPoints, spentPoints, balance };
}

export async function getCustomerRewardMetrics(input: {
  orgId: string;
  customerId: string;
  weekStart: Date;
  weekEnd: Date;
}) {
  const { orgId, customerId, weekStart, weekEnd } = input;
  await ensureCustomerRewardEvents(orgId, customerId);

  const [earned, spent, weekEarned, ratingEarned, ratingWeek] = await Promise.all([
    prisma.customerRewardEvent.aggregate({
      where: { orgId, customerId },
      _sum: { points: true },
    }),
    prisma.customerRewardRedemption.aggregate({
      where: {
        orgId,
        customerId,
        status: { in: ACTIVE_REDEMPTION_STATUSES },
      },
      _sum: { pointsCost: true },
    }),
    prisma.customerRewardEvent.aggregate({
      where: {
        orgId,
        customerId,
        createdAt: { gte: weekStart, lte: weekEnd },
      },
      _sum: { points: true },
    }),
    prisma.customerRewardEvent.aggregate({
      where: {
        orgId,
        customerId,
        eventType: CustomerRewardEventType.VISIT_RATING,
      },
      _sum: { points: true },
    }),
    prisma.customerRewardEvent.aggregate({
      where: {
        orgId,
        customerId,
        eventType: CustomerRewardEventType.VISIT_RATING,
        createdAt: { gte: weekStart, lte: weekEnd },
      },
      _sum: { points: true },
    }),
  ]);

  const earnedPoints = earned._sum?.points ?? 0;
  const spentPoints = spent._sum?.pointsCost ?? 0;
  const balance = Math.max(0, earnedPoints - spentPoints);

  return {
    balance,
    pointsThisWeek: Math.max(0, weekEarned._sum?.points ?? 0),
    ratingCreditsTotal: Math.max(0, ratingEarned._sum?.points ?? 0),
    ratingCreditsThisWeek: Math.max(0, ratingWeek._sum?.points ?? 0),
  };
}
