import { NextRequest, NextResponse } from 'next/server';
import { PayoutStatus } from '@prisma/client';
import { startOfMonth } from 'date-fns';

import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';

const PAGE_SIZE = 20;

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
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
      { ok: false, error: 'Scooper access required' },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const limitParam = url.searchParams.get('limit');
  const cursor = url.searchParams.get('cursor');

  const limit = limitParam ? Math.min(50, Math.max(5, Number(limitParam))) : PAGE_SIZE;

  const payouts = await prisma.visitPayout.findMany({
    where: { scooperId: userId },
    orderBy: { generatedAt: 'desc' },
    take: limit + 1,
    ...(cursor
      ? {
          skip: 1,
          cursor: { id: cursor },
        }
      : {}),
    include: {
      serviceVisit: {
        select: {
          id: true,
          scheduledDate: true,
          metadata: true,
          tile: {
            select: {
              id: true,
              slug: true,
              name: true,
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
              addressLine1: true,
              city: true,
            },
          },
        },
      },
    },
  });

  const hasMore = payouts.length > limit;
  if (hasMore) {
    payouts.pop();
  }

  const [pendingTotal, earnedTotal, monthPaid, lifetimeEarned, monthTips, lifetimeTips, profile] = await Promise.all([
    prisma.visitPayout.aggregate({
      _sum: { totalAmountCents: true },
      where: {
        scooperId: userId,
        status: PayoutStatus.PENDING_REVIEW,
      },
    }),
    prisma.visitPayout.aggregate({
      _sum: { totalAmountCents: true },
      where: {
        scooperId: userId,
        status: PayoutStatus.READY,
        stripeTransferId: null,
        withdrawalRequestId: null,
      },
    }),
    prisma.visitPayout.aggregate({
      _sum: { totalAmountCents: true },
      where: {
        scooperId: userId,
        status: PayoutStatus.RELEASED,
        clearedAt: {
          gte: startOfMonth(new Date()),
        },
      },
    }),
    prisma.visitPayout.aggregate({
      _sum: { totalAmountCents: true },
      where: {
        scooperId: userId,
        status: {
          not: PayoutStatus.VOID,
        },
      },
    }),
    prisma.visitPayout.aggregate({
      _sum: { tipsAmountCents: true },
      where: {
        scooperId: userId,
        generatedAt: {
          gte: startOfMonth(new Date()),
        },
        status: {
          not: PayoutStatus.VOID,
        },
      },
    }),
    prisma.visitPayout.aggregate({
      _sum: { tipsAmountCents: true },
      where: {
        scooperId: userId,
        status: {
          not: PayoutStatus.VOID,
        },
      },
    }),
    prisma.scooperProfile.findUnique({
      where: { userId },
      select: { payoutAutoReleaseEnabled: true },
    }),
  ]);

  const serialized = payouts.map((payout) => ({
    id: payout.id,
    status: payout.status,
    totalAmountCents: payout.totalAmountCents,
    tipsAmountCents: payout.tipsAmountCents ?? 0,
    generatedAt: payout.generatedAt.toISOString(),
    clearedAt: payout.clearedAt ? payout.clearedAt.toISOString() : null,
    serviceVisit: payout.serviceVisit
      ? {
          id: payout.serviceVisit.id,
          scheduledDate: payout.serviceVisit.scheduledDate.toISOString(),
          metadata: payout.serviceVisit.metadata ?? null,
          tile: payout.serviceVisit.tile ?? null,
          customer: payout.serviceVisit.customer ?? null,
        }
      : null,
  }));

  return NextResponse.json({
    ok: true,
    data: {
      payouts: serialized,
      summary: {
        pendingReviewAmountCents: pendingTotal._sum.totalAmountCents ?? 0,
        earnedAmountCents: earnedTotal._sum.totalAmountCents ?? 0,
        monthPaidCents: monthPaid._sum.totalAmountCents ?? 0,
        lifetimeEarnedCents: lifetimeEarned._sum.totalAmountCents ?? 0,
        tipsMonthCents: monthTips._sum.tipsAmountCents ?? 0,
        tipsLifetimeCents: lifetimeTips._sum.tipsAmountCents ?? 0,
        autoPayoutEnabled: profile?.payoutAutoReleaseEnabled ?? true,
      },
      pagination: {
        nextCursor: hasMore ? payouts[payouts.length - 1]?.id ?? null : null,
        hasMore,
        pageSize: limit,
      },
      generatedAt: new Date().toISOString(),
    },
  });
}

export const runtime = 'nodejs';
