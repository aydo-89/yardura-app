import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ payoutId: string }> },
) {
  const { payoutId } = await params;
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

  if (!payoutId) {
    return NextResponse.json({ ok: false, error: 'Missing payout id' }, { status: 400 });
  }

  const payout = await prisma.visitPayout.findFirst({
    where: { id: payoutId, scooperId: userId },
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

  if (!payout) {
    return NextResponse.json({ ok: false, error: 'Payout not found' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    data: {
      id: payout.id,
      status: payout.status,
      baseAmountCents: payout.baseAmountCents,
      bonusAmountCents: payout.bonusAmountCents,
      mileageAmountCents: payout.mileageAmountCents,
      ppeAmountCents: payout.ppeAmountCents,
      tipsAmountCents: payout.tipsAmountCents,
      adjustmentsCents: payout.adjustmentsCents,
      totalAmountCents: payout.totalAmountCents,
      milesDriven: payout.milesDriven,
      minutesOnSite: payout.minutesOnSite,
      generatedAt: payout.generatedAt.toISOString(),
      readyAt: payout.readyAt ? payout.readyAt.toISOString() : null,
      releasedAt: payout.releasedAt ? payout.releasedAt.toISOString() : null,
      clearedAt: payout.clearedAt ? payout.clearedAt.toISOString() : null,
      cancelledAt: payout.cancelledAt ? payout.cancelledAt.toISOString() : null,
      notes: payout.notes ?? null,
      serviceVisit: payout.serviceVisit
        ? {
            id: payout.serviceVisit.id,
            scheduledDate: payout.serviceVisit.scheduledDate.toISOString(),
            metadata: payout.serviceVisit.metadata ?? null,
            tile: payout.serviceVisit.tile ?? null,
            customer: payout.serviceVisit.customer ?? null,
          }
        : null,
    },
  });
}

export const runtime = 'nodejs';
