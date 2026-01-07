import { NextRequest, NextResponse } from 'next/server';

import { buildCustomerSetupResponse, canSetupCustomer } from '@/lib/mobile/customer-setup';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { getCustomerRewardBalance } from '@/lib/rewards/customerRewardEvents';

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

export async function POST(request: NextRequest) {
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

  const body = await request.json().catch(() => null);
  const rewardItemId = typeof body?.rewardItemId === 'string' ? body.rewardItemId : null;
  const slug = typeof body?.slug === 'string' ? body.slug : null;

  if (!rewardItemId && !slug) {
    return NextResponse.json({ ok: false, error: 'reward_required' }, { status: 422 });
  }

  const rewardItem = await prisma.customerRewardItem.findFirst({
    where: {
      orgId: customer.orgId,
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
    return NextResponse.json({ ok: false, error: 'reward_not_found' }, { status: 404 });
  }

  const rewards = await getCustomerRewardBalance(customer.orgId, customer.id);

  if (rewards.balance < rewardItem.pointsCost) {
    return NextResponse.json(
      { ok: false, error: 'insufficient_points', balance: rewards.balance },
      { status: 400 },
    );
  }

  const redemption = await prisma.customerRewardRedemption.create({
    data: {
      orgId: customer.orgId,
      customerId: customer.id,
      rewardItemId: rewardItem.id,
      pointsCost: rewardItem.pointsCost,
      status: 'PENDING',
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

export const runtime = 'nodejs';
