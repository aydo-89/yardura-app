import { NextRequest, NextResponse } from "next/server";
import { BackgroundCheckStatus, Prisma, ScooperStatus } from "@prisma/client";

import { getScooperAuth } from "@/lib/auth/scooper";
import { prisma } from "@/lib/prisma";
import { getScooperRewardBalance } from "@/lib/field-tech/rewardEvents";
import { SERVICE_TIME_ZONE, isValidTimeZone } from "@/lib/timezone";

export async function POST(request: NextRequest) {
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

  const body = await request.json().catch(() => null);
  const rewardItemId = typeof body?.rewardItemId === "string" ? body.rewardItemId : null;
  const slug = typeof body?.slug === "string" ? body.slug : null;

  if (!rewardItemId && !slug) {
    return NextResponse.json({ error: "reward_required" }, { status: 422 });
  }

  const rewardItem = await prisma.scooperRewardItem.findFirst({
    where: {
      orgId: profile.orgId,
      isActive: true,
      ...(rewardItemId ? { id: rewardItemId } : { slug }),
    },
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
  });

  if (!rewardItem) {
    return NextResponse.json({ error: "reward_not_found" }, { status: 404 });
  }

  const rewards = await getScooperRewardBalance(profile.orgId, userId, timeZone);

  if (rewards.balance < rewardItem.pointsCost) {
    return NextResponse.json(
      { error: "insufficient_points", balance: rewards.balance },
      { status: 400 },
    );
  }

  const redemption = await prisma.scooperRewardRedemption.create({
    data: {
      orgId: profile.orgId,
      scooperId: userId,
      scooperProfileId: profile.id,
      rewardItemId: rewardItem.id,
      pointsCost: rewardItem.pointsCost,
      status: "PENDING",
      metadata: {
        itemSnapshot: rewardItem,
      },
    },
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
  });

  const updatedBalance = Math.max(0, rewards.balance - rewardItem.pointsCost);

  return NextResponse.json({
    balance: updatedBalance,
    redemption,
  });
}

export const runtime = "nodejs";
