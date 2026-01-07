import { NextRequest, NextResponse } from 'next/server';

import { resolveScooperOngoingLimit } from '@/lib/field-tech/ongoingCaps';
import { getScooperRewardBalance } from '@/lib/field-tech/rewardEvents';
import { getScooperTierProgress } from '@/lib/field-tech/rewardTiers';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { SERVICE_TIME_ZONE } from '@/lib/timezone';

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
    return NextResponse.json({ ok: false, error: 'Scooper access required' }, { status: 403 });
  }

  const scooperProfile = await prisma.scooperProfile.findFirst({
    where: { userId },
    select: { id: true, orgId: true },
  });

  if (!scooperProfile) {
    return NextResponse.json({ ok: false, error: 'Scooper access required' }, { status: 403 });
  }

  const jobs = await prisma.job.findMany({
    where: {
      primaryScooperId: userId,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      frequency: true,
      nextVisitAt: true,
      preferredTimeWindow: true,
      preferredTimeWindowSlug: true,
      customer: {
        select: {
          id: true,
          name: true,
          addressLine1: true,
          city: true,
          state: true,
          zip: true,
          dogs: {
            select: {
              id: true,
              name: true,
              breed: true,
            },
          },
        },
      },
    },
  });

  const rewards = await getScooperRewardBalance(scooperProfile.orgId, userId, SERVICE_TIME_ZONE);
  const tierProgress = getScooperTierProgress(rewards.earnedPoints);
  const currentLimit = resolveScooperOngoingLimit(tierProgress.current.slug);
  const nextLimit = tierProgress.next ? resolveScooperOngoingLimit(tierProgress.next.slug) : null;

  const serialized = jobs
    .map((job) => ({
      jobId: job.id,
      frequency: job.frequency,
      nextVisitAt: job.nextVisitAt ? job.nextVisitAt.toISOString() : null,
      preferredTimeWindow: job.preferredTimeWindow ?? null,
      preferredTimeWindowSlug: job.preferredTimeWindowSlug ?? null,
      customer: job.customer
        ? {
            id: job.customer.id,
            name: job.customer.name,
            addressLine1: job.customer.addressLine1,
            city: job.customer.city,
            state: job.customer.state,
            zip: job.customer.zip,
            dogs: job.customer.dogs.map((dog) => ({
              id: dog.id,
              name: dog.name,
              breed: dog.breed ?? null,
            })),
          }
        : null,
    }))
    .sort((a, b) => {
      if (!a.nextVisitAt && !b.nextVisitAt) return 0;
      if (!a.nextVisitAt) return 1;
      if (!b.nextVisitAt) return -1;
      return new Date(a.nextVisitAt).getTime() - new Date(b.nextVisitAt).getTime();
    });

  return NextResponse.json({
    ok: true,
    data: {
      customers: serialized,
      summary: {
        currentCount: serialized.length,
        limit: currentLimit,
        tier: {
          slug: tierProgress.current.slug,
          name: tierProgress.current.name,
        },
        nextTier: tierProgress.next
          ? {
              slug: tierProgress.next.slug,
              name: tierProgress.next.name,
              limit: nextLimit,
              pointsToNext: tierProgress.pointsToNext,
            }
          : null,
      },
    },
  });
}

export const runtime = 'nodejs';
