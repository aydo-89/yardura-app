import { NextRequest, NextResponse } from 'next/server';

import { buildCustomerSetupResponse, canSetupCustomer } from '@/lib/mobile/customer-setup';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { createServiceVisitRating } from '@/lib/ratings/service-visit-rating';
import { createChargeEntry } from '@/lib/billing/ledger';
import { upsertVisitPayoutForVisit } from '@/lib/marketplace/payouts';
import { sendScooperTipReceivedPush } from '@/lib/notifications/push';
import { PayoutStatus } from '@prisma/client';

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

const errorStatus: Record<string, number> = {
  invalid_score: 400,
  visit_not_found: 404,
  visit_not_completed: 409,
  visit_already_rated: 409,
  visit_unassigned: 409,
  scooper_not_found: 404,
  payout_released: 409,
  invalid_tip: 400,
  job_missing: 409,
};

const MAX_TIP_CENTS = 5000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ visitId: string }> },
) {
  const { visitId } = await params;
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

  const body = await request.json().catch(() => ({}));
  const score = Number(body?.score);
  const comment = typeof body?.comment === 'string' ? body.comment : null;
  const tipRaw = body?.tipCents;
  const tipCents = Number.isFinite(Number(tipRaw)) ? Math.trunc(Number(tipRaw)) : 0;

  if (!Number.isFinite(score)) {
    return NextResponse.json({ ok: false, error: 'invalid_score' }, { status: 400 });
  }
  if (tipCents < 0 || tipCents > MAX_TIP_CENTS) {
    return NextResponse.json({ ok: false, error: 'invalid_tip' }, { status: 400 });
  }

  const visitContext =
    tipCents > 0
      ? await prisma.serviceVisit.findFirst({
          where: { id: visitId, customerId: customer.id },
          select: {
            id: true,
            status: true,
            orgId: true,
            jobId: true,
            assignedToId: true,
            customer: { select: { name: true } },
            job: { select: { orgId: true } },
            visitPayout: { select: { status: true } },
          },
        })
      : null;

  if (tipCents > 0 && !visitContext) {
    return NextResponse.json({ ok: false, error: 'visit_not_found' }, { status: 404 });
  }

  if (visitContext?.visitPayout?.status === PayoutStatus.RELEASED) {
    return NextResponse.json({ ok: false, error: 'payout_released' }, { status: 409 });
  }

  try {
    const rating = await createServiceVisitRating({
      visitId,
      customerId: customer.id,
      score,
      comment,
      source: 'mobile-app',
      tipCents,
    });

    if (tipCents > 0 && visitContext) {
      if (!visitContext.jobId) {
        return NextResponse.json({ ok: false, error: 'job_missing' }, { status: 409 });
      }
      const orgId = visitContext.orgId ?? visitContext.job?.orgId ?? 'yardura';
      await createChargeEntry({
        orgId,
        jobId: visitContext.jobId,
        customerId: customer.id,
        amountCents: tipCents,
        description: 'Scooper tip',
        serviceVisitId: visitId,
        metadata: {
          source: 'visit-rating',
          tipCents,
        },
      });
      await upsertVisitPayoutForVisit(visitId, { tipsAmountCents: tipCents });
      if (visitContext.assignedToId) {
        void sendScooperTipReceivedPush({
          userId: visitContext.assignedToId,
          amountCents: tipCents,
          customerName: visitContext.customer?.name ?? null,
          visitId,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      rating: {
        id: rating.id,
        score: rating.score,
        comment: rating.comment,
        createdAt: rating.createdAt.toISOString(),
        creditApplied: rating.creditApplied,
        tipCents: tipCents > 0 ? tipCents : 0,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unable_to_rate_visit';
    const status = errorStatus[message] ?? 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}


