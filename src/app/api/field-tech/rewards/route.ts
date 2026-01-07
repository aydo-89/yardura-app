import { NextRequest, NextResponse } from "next/server";
import { BackgroundCheckStatus, Prisma, ScooperStatus } from "@prisma/client";

import { getScooperAuth } from "@/lib/auth/scooper";
import { prisma } from "@/lib/prisma";
import {
  buildDailyCheckRewardSummary,
} from "@/lib/field-tech/dailyCheckRewards";
import { DEFAULT_SCOOPER_REWARDS } from "@/lib/field-tech/rewardsCatalog";
import { getScooperRewardBalance } from "@/lib/field-tech/rewardEvents";
import { getScooperTierProgress } from "@/lib/field-tech/rewardTiers";
import { SERVICE_TIME_ZONE, isValidTimeZone } from "@/lib/timezone";

async function ensureRewardCatalog(orgId: string) {
  if (!DEFAULT_SCOOPER_REWARDS.length) return;
  const slugs = DEFAULT_SCOOPER_REWARDS.map((item) => item.slug);
  await prisma.$transaction([
    ...DEFAULT_SCOOPER_REWARDS.map((item) =>
      prisma.scooperRewardItem.upsert({
        where: { orgId_slug: { orgId, slug: item.slug } },
        create: {
          orgId,
          slug: item.slug,
          name: item.name,
          description: item.description,
          pointsCost: item.pointsCost,
          category: item.category,
          imageUrl: item.imageUrl ?? null,
          isActive: true,
          metadata: (item.metadata as Prisma.InputJsonValue) ?? undefined,
        },
        update: {
          name: item.name,
          description: item.description,
          pointsCost: item.pointsCost,
          category: item.category,
          imageUrl: item.imageUrl ?? null,
          isActive: true,
          metadata: (item.metadata as Prisma.InputJsonValue) ?? undefined,
        },
      }),
    ),
    prisma.scooperRewardItem.updateMany({
      where: {
        orgId,
        slug: { notIn: slugs },
        isActive: true,
      },
      data: { isActive: false },
    }),
  ]);
}

export async function GET(request: NextRequest) {
  const auth = await getScooperAuth(request);
  const userId = auth?.userId;

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let profile = await prisma.scooperProfile.findUnique({
    where: { userId },
    select: { id: true, orgId: true, metadata: true },
  });

  if (!profile) {
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { orgId: true },
    });
    if (!userRecord?.orgId) {
      return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
    }
    profile = await prisma.scooperProfile.create({
      data: {
        orgId: userRecord.orgId,
        userId,
        status: ScooperStatus.APPLICANT,
        backgroundCheckStatus: BackgroundCheckStatus.NOT_SUBMITTED,
        vehicleVerified: false,
        metadata: Prisma.JsonNull,
      },
      select: { id: true, orgId: true, metadata: true },
    });
  }

  const headerRaw =
    request.headers.get("x-time-zone") ?? request.headers.get("x-timezone");
  const headerTimeZone = isValidTimeZone(headerRaw?.trim())
    ? headerRaw!.trim()
    : null;
  const metadata = profile.metadata && typeof profile.metadata === "object"
    ? (profile.metadata as Record<string, unknown>)
    : {};
  const storedRaw = typeof metadata.timeZone === "string" ? metadata.timeZone : null;
  const storedTimeZone = isValidTimeZone(storedRaw) ? storedRaw : null;
  const timeZone = headerTimeZone ?? storedTimeZone ?? SERVICE_TIME_ZONE;

  if (headerTimeZone && headerTimeZone !== storedTimeZone) {
    await prisma.scooperProfile.update({
      where: { id: profile.id },
      data: {
        metadata: {
          ...metadata,
          timeZone: headerTimeZone,
        },
      },
    });
  }

  await ensureRewardCatalog(profile.orgId);

  const [items, redemptions, checks, latestCheck, balanceSummary] = await Promise.all([
    prisma.scooperRewardItem.findMany({
      where: { orgId: profile.orgId, isActive: true },
      orderBy: { pointsCost: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        pointsCost: true,
        category: true,
        imageUrl: true,
        isActive: true,
        metadata: true,
      },
    }),
    prisma.scooperRewardRedemption.findMany({
      where: { scooperId: userId },
      orderBy: { requestedAt: "desc" },
      take: 12,
      select: {
        id: true,
        status: true,
        pointsCost: true,
        requestedAt: true,
        approvedAt: true,
        fulfilledAt: true,
        cancelledAt: true,
        rewardItem: {
          select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            pointsCost: true,
            category: true,
            imageUrl: true,
            isActive: true,
            metadata: true,
          },
        },
      },
    }),
    prisma.scooperDailyCheck.findMany({
      where: { userId },
      select: { capturedAt: true, pointsAwarded: true },
    }),
    prisma.scooperDailyCheck.findFirst({
      where: { userId },
      orderBy: { capturedAt: "desc" },
      select: { capturedAt: true, pointsAwarded: true },
    }),
    getScooperRewardBalance(profile.orgId, userId, timeZone),
  ]);

  const { balance, earnedPoints, spentPoints } = balanceSummary;
  const tierProgress = getScooperTierProgress(earnedPoints);
  const dailyCheck = buildDailyCheckRewardSummary(
    checks,
    latestCheck
      ? { capturedAt: latestCheck.capturedAt, pointsAwarded: latestCheck.pointsAwarded ?? null }
      : null,
    new Date(),
    spentPoints,
    timeZone,
  );

  const nextReward = items.find((item) => item.pointsCost > balance) ?? null;

  return NextResponse.json({
    balance,
    earnedPoints,
    spentPoints,
    tier: tierProgress.current,
    nextTier: tierProgress.next,
    tierProgress: {
      pointsToNext: tierProgress.pointsToNext,
      progressPct: tierProgress.progressPct,
    },
    nextReward: nextReward
      ? {
          id: nextReward.id,
          name: nextReward.name,
          pointsCost: nextReward.pointsCost,
          remainingPoints: Math.max(0, nextReward.pointsCost - balance),
        }
      : null,
    dailyCheck: {
      streakCount: dailyCheck.streakCount,
      nextMilestone: dailyCheck.nextMilestone,
    },
    items,
    redemptions,
  });
}

export const runtime = "nodejs";
