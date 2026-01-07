import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { buildCustomerSetupResponse, canSetupCustomer } from '@/lib/mobile/customer-setup';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { DEFAULT_CUSTOMER_REWARDS } from '@/lib/rewards/customerRewardsCatalog';
import { getCustomerRewardBalance } from '@/lib/rewards/customerRewardEvents';

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

async function ensureRewardCatalog(orgId: string) {
  if (!DEFAULT_CUSTOMER_REWARDS.length) return;
  const slugs = DEFAULT_CUSTOMER_REWARDS.map((item) => item.slug);
  await prisma.$transaction([
    ...DEFAULT_CUSTOMER_REWARDS.map((item) =>
      prisma.customerRewardItem.upsert({
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
    prisma.customerRewardItem.updateMany({
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
    return NextResponse.json({ ok: false, error: 'Customer access required' }, { status: 403 });
  }
  const canSetup = canSetupCustomer(payload.roles);

  const customer = await prisma.customer.findFirst({
    where: { userId },
    select: { id: true, orgId: true },
  });

  if (!customer) {
    return canSetup
      ? buildCustomerSetupResponse(userId)
      : NextResponse.json({ ok: false, error: 'Customer access required' }, { status: 403 });
  }

  await ensureRewardCatalog(customer.orgId);

  const [items, redemptions, balanceSummary] = await Promise.all([
    prisma.customerRewardItem.findMany({
      where: { orgId: customer.orgId, isActive: true },
      orderBy: { pointsCost: 'asc' },
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
    prisma.customerRewardRedemption.findMany({
      where: { customerId: customer.id },
      orderBy: { requestedAt: 'desc' },
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
    getCustomerRewardBalance(customer.orgId, customer.id),
  ]);

  const { balance, earnedPoints, spentPoints } = balanceSummary;
  const nextReward = items.find((item) => item.pointsCost > balance) ?? null;

  return NextResponse.json({
    balance,
    earnedPoints,
    spentPoints,
    nextReward: nextReward
      ? {
          id: nextReward.id,
          name: nextReward.name,
          pointsCost: nextReward.pointsCost,
          remainingPoints: Math.max(0, nextReward.pointsCost - balance),
        }
      : null,
    items,
    redemptions,
  });
}

export const runtime = 'nodejs';
