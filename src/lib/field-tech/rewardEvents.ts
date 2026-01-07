import { Prisma, ScooperRewardEventType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getDayKey } from "@/lib/field-tech/dailyCheckRewards";

export const SCOOPER_VISIT_POINTS_CAP = 25;

export const SCOOPER_REWARD_EVENT_POINTS = {
  visitComplete: 8,
  sampleSurface: 2,
  sampleCross: 3,
  detectionFlag: 4,
  vetConfirmed: 25,
};

const ACTIVE_REDEMPTION_STATUSES: ("PENDING" | "APPROVED" | "FULFILLED")[] = ["PENDING", "APPROVED", "FULFILLED"];

type AwardScooperPointsInput = {
  orgId: string;
  scooperId: string;
  eventType: ScooperRewardEventType;
  sourceKey: string;
  points: number;
  serviceVisitId?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  maxPointsPerVisit?: number;
};

export async function awardScooperPoints(input: AwardScooperPointsInput) {
  const {
    orgId,
    scooperId,
    eventType,
    sourceKey,
    serviceVisitId,
    metadata,
    maxPointsPerVisit,
  } = input;

  if (!orgId || !scooperId || !sourceKey) return null;

  let points = Math.max(0, Math.floor(input.points));
  if (points <= 0) return null;

  if (maxPointsPerVisit && serviceVisitId) {
    const existingTotal = await prisma.scooperRewardEvent.aggregate({
      where: { orgId, scooperId, serviceVisitId },
      _sum: { points: true },
    });
    const usedPoints = existingTotal._sum.points ?? 0;
    const remaining = maxPointsPerVisit - usedPoints;
    if (remaining <= 0) return null;
    points = Math.min(points, remaining);
    if (points <= 0) return null;
  }

  const existing = await prisma.scooperRewardEvent.findUnique({
    where: {
      orgId_eventType_sourceKey: {
        orgId,
        eventType,
        sourceKey,
      },
    },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  return prisma.scooperRewardEvent.create({
    data: {
      orgId,
      scooperId,
      eventType,
      sourceKey,
      points,
      serviceVisitId: serviceVisitId ?? undefined,
      metadata: metadata ?? Prisma.JsonNull,
    },
  });
}

export async function ensureDailyCheckRewardEvents(
  orgId: string,
  scooperId: string,
  timeZone?: string,
) {
  const checks = await prisma.scooperDailyCheck.findMany({
    where: { userId: scooperId },
    select: { capturedAt: true, pointsAwarded: true },
  });

  if (!checks.length) return 0;

  const existing = await prisma.scooperRewardEvent.findMany({
    where: {
      orgId,
      scooperId,
      eventType: ScooperRewardEventType.DAILY_CHECK,
    },
    select: { sourceKey: true },
  });
  const existingKeys = new Set(existing.map((entry) => entry.sourceKey));
  const pointsByDay = new Map<string, number>();

  checks.forEach((check) => {
    const zonedKey = getDayKey(check.capturedAt, timeZone);
    const legacyKey = getDayKey(check.capturedAt);
    const zonedSourceKey = `daily-check:${scooperId}:${zonedKey}`;
    const legacySourceKey = `daily-check:${scooperId}:${legacyKey}`;
    if (existingKeys.has(zonedSourceKey) || existingKeys.has(legacySourceKey)) {
      return;
    }
    const points = check.pointsAwarded ?? 0;
    if (points <= 0) return;
    const current = pointsByDay.get(zonedKey) ?? 0;
    if (points > current) pointsByDay.set(zonedKey, points);
  });

  const toCreate: Prisma.ScooperRewardEventCreateManyInput[] = [];
  pointsByDay.forEach((points, dayKey) => {
    const sourceKey = `daily-check:${scooperId}:${dayKey}`;
    if (existingKeys.has(sourceKey)) return;
    toCreate.push({
      orgId,
      scooperId,
      eventType: ScooperRewardEventType.DAILY_CHECK,
      sourceKey,
      points,
      metadata: Prisma.JsonNull,
    });
  });

  if (!toCreate.length) return 0;

  await prisma.scooperRewardEvent.createMany({
    data: toCreate,
    skipDuplicates: true,
  });

  return toCreate.length;
}

export async function getScooperRewardBalance(
  orgId: string,
  scooperId: string,
  timeZone?: string,
) {
  await ensureDailyCheckRewardEvents(orgId, scooperId, timeZone);

  const [earned, spent] = await Promise.all([
    prisma.scooperRewardEvent.aggregate({
      where: { orgId, scooperId },
      _sum: { points: true },
    }),
    prisma.scooperRewardRedemption.aggregate({
      where: {
        orgId,
        scooperId,
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
