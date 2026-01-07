import { NextRequest, NextResponse } from 'next/server';
import {
  CertificationStatus,
  ScooperStatus,
  ServiceStatus,
  VisitOfferStatus,
} from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { resolveScooperOngoingLimit } from '@/lib/field-tech/ongoingCaps';
import { getScooperRewardBalance } from '@/lib/field-tech/rewardEvents';
import { getScooperTierProgress } from '@/lib/field-tech/rewardTiers';
import {
  DEFAULT_MILEAGE_RATE_CENTS,
  DEFAULT_PPE_STIPEND_CENTS,
  estimateVisitPayoutPreview,
} from '@/lib/marketplace/payouts';
import { peekStrikeCount, STRIKE_LIMIT } from '@/lib/marketplace/discipline';
import { SERVICE_TIME_ZONE } from '@/lib/timezone';

type RouteParams = Promise<{ offerId: string }>;

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

function toCertificationSet(profile: {
  certifications: Array<{ type: string; status: CertificationStatus }>;
}) {
  return new Set(
    profile.certifications
      .filter((cert) => cert.status === CertificationStatus.ACTIVE)
      .map((cert) => cert.type),
  );
}

function extractRequiredCertifications(value: unknown): string[] {
  if (!value || !Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

export async function POST(request: NextRequest, context: { params: RouteParams }) {
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

  const requestBody = await request.json().catch(() => ({}));
  const scope = requestBody?.scope === 'job' ? 'job' : 'visit';

  const { offerId } = await context.params;

  const profile = await prisma.scooperProfile.findUnique({
    where: { userId },
    include: {
      org: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      certifications: {
        select: {
          type: true,
          status: true,
        },
      },
    },
  });

  if (!profile || !profile.org) {
    return NextResponse.json({ ok: false, error: 'scooper_profile_missing' }, { status: 404 });
  }

  if (profile.status !== ScooperStatus.CERTIFIED) {
    return NextResponse.json({ ok: false, error: 'scooper_not_certified' }, { status: 403 });
  }

  const strikeStatus = peekStrikeCount(profile.metadata, new Date());
  if (strikeStatus.count >= STRIKE_LIMIT) {
    return NextResponse.json(
      {
        ok: false,
        error: 'scooper_strike_limit',
        message:
          'Strike limit reached for this quarter. Please resolve with dispatch before taking new offers.',
        limit: STRIKE_LIMIT,
        count: strikeStatus.count,
        windowStart: strikeStatus.windowStart,
      },
      { status: 429 },
    );
  }

  const offer = await prisma.visitOffer.findUnique({
    where: { id: offerId },
    include: {
      serviceVisit: {
        include: {
          job: {
            select: {
              id: true,
              frequency: true,
              primaryScooperId: true,
            },
          },
          tile: {
            select: {
              id: true,
              slug: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!offer || offer.orgId !== profile.orgId) {
    return NextResponse.json({ ok: false, error: 'offer_not_found' }, { status: 404 });
  }

  if (offer.status !== VisitOfferStatus.PENDING) {
    return NextResponse.json({ ok: false, error: 'offer_unavailable' }, { status: 409 });
  }

  if (offer.expiresAt && offer.expiresAt <= new Date() && offer.offeredToId) {
    return NextResponse.json({ ok: false, error: 'offer_expired' }, { status: 409 });
  }

  if (offer.offeredToId && offer.offeredToId !== userId) {
    return NextResponse.json({ ok: false, error: 'offer_claimed' }, { status: 409 });
  }

  const visit = offer.serviceVisit;

  if (!visit) {
    return NextResponse.json({ ok: false, error: 'visit_missing' }, { status: 400 });
  }

  if (visit.status !== ServiceStatus.SCHEDULED) {
    return NextResponse.json({ ok: false, error: 'visit_not_schedulable' }, { status: 409 });
  }

  if (visit.assignedToId && visit.assignedToId !== userId) {
    return NextResponse.json({ ok: false, error: 'visit_already_assigned' }, { status: 409 });
  }

  if (scope === 'job' && visit.job?.id && visit.job.frequency !== 'ONE_TIME') {
    const rewards = await getScooperRewardBalance(profile.orgId, userId, SERVICE_TIME_ZONE);
    const tierProgress = getScooperTierProgress(rewards.earnedPoints);
    const limit = resolveScooperOngoingLimit(tierProgress.current.slug);
    const currentCount = await prisma.job.count({
      where: {
        primaryScooperId: userId,
        status: 'ACTIVE',
      },
    });
    const alreadyAssigned = visit.job.primaryScooperId === userId;
    if (!alreadyAssigned && currentCount >= limit) {
      return NextResponse.json(
        {
          ok: false,
          error: 'ongoing_limit_reached',
          message: 'Ongoing customer limit reached for your tier.',
          limit,
          currentCount,
          tier: tierProgress.current.name,
          tierSlug: tierProgress.current.slug,
        },
        { status: 409 },
      );
    }
  }

  const requiredCerts = extractRequiredCertifications(visit.requiredCertifications);
  const activeCerts = toCertificationSet(profile);

  const missingCerts = requiredCerts.filter((cert) => !activeCerts.has(cert));
  if (missingCerts.length) {
    return NextResponse.json(
      {
        ok: false,
        error: 'certifications_missing',
        missingCertifications: missingCerts,
      },
      { status: 412 },
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      const acceptedAt = new Date();

      if (scope === 'job') {
        if (!visit.job?.id) {
          throw new Error('job_missing');
        }
        if (visit.job.frequency === 'ONE_TIME') {
          throw new Error('job_not_recurring');
        }

        const updatedJob = await tx.job.updateMany({
          where: {
            id: visit.job.id,
            OR: [{ primaryScooperId: null }, { primaryScooperId: userId }],
          },
          data: {
            primaryScooperId: userId,
          },
        });

        if (updatedJob.count === 0) {
          throw new Error('job_assignment_conflict');
        }

        await tx.serviceVisit.updateMany({
          where: {
            jobId: visit.job.id,
            status: ServiceStatus.SCHEDULED,
            scheduledDate: { gte: acceptedAt },
            OR: [{ assignedToId: null }, { assignedToId: userId }],
          },
          data: {
            assignedToId: userId,
          },
        });

        await tx.visitOffer.updateMany({
          where: {
            status: VisitOfferStatus.PENDING,
            serviceVisit: {
              jobId: visit.job.id,
              status: ServiceStatus.SCHEDULED,
              scheduledDate: { gte: acceptedAt },
              OR: [{ assignedToId: null }, { assignedToId: userId }],
            },
            OR: [{ offeredToId: null }, { offeredToId: userId }],
          },
          data: {
            status: VisitOfferStatus.ACCEPTED,
            offeredToId: userId,
            acceptedAt,
            respondedAt: acceptedAt,
          },
        });
      } else {
        const updatedOffer = await tx.visitOffer.updateMany({
          where: {
            id: offer.id,
            status: VisitOfferStatus.PENDING,
            OR: [{ offeredToId: userId }, { offeredToId: null }],
          },
          data: {
            status: VisitOfferStatus.ACCEPTED,
            offeredToId: userId,
            acceptedAt,
          },
        });

        if (updatedOffer.count === 0) {
          throw new Error('offer_already_taken');
        }

        const visitUpdate = await tx.serviceVisit.updateMany({
          where: {
            id: visit.id,
            OR: [{ assignedToId: null }, { assignedToId: userId }],
          },
          data: {
            assignedToId: userId,
          },
        });

        if (visitUpdate.count === 0) {
          throw new Error('visit_assignment_conflict');
        }
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    if (message === 'offer_already_taken') {
      return NextResponse.json({ ok: false, error: 'offer_claimed' }, { status: 409 });
    }
    if (message === 'job_assignment_conflict') {
      return NextResponse.json({ ok: false, error: 'job_already_assigned' }, { status: 409 });
    }
    if (message === 'job_not_recurring') {
      return NextResponse.json({ ok: false, error: 'job_not_recurring' }, { status: 409 });
    }
    if (message === 'job_missing') {
      return NextResponse.json({ ok: false, error: 'job_missing' }, { status: 400 });
    }
    if (message === 'visit_assignment_conflict') {
      return NextResponse.json({ ok: false, error: 'visit_already_assigned' }, { status: 409 });
    }
    throw error;
  }

  const refreshed = await prisma.serviceVisit.findUnique({
    where: { id: visit.id },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          addressLine1: true,
          city: true,
          zip: true,
        },
      },
      job: {
        select: {
          id: true,
          frequency: true,
        },
      },
      tile: {
        select: {
          id: true,
          slug: true,
          name: true,
        },
      },
    },
  });

  let payoutPreview: ReturnType<typeof estimateVisitPayoutPreview> | null = null;

  if (refreshed?.job) {
    const schedule = await prisma.visitCompSchedule.findFirst({
      where: {
        orgId: profile.orgId,
        frequency: refreshed.job.frequency,
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (schedule) {
      payoutPreview = estimateVisitPayoutPreview({
        schedule,
        revenueCents: refreshed.revenueCents ?? null,
        metadata: refreshed.metadata ?? null,
        deodorize: refreshed.deodorize,
        mileageRateCents: DEFAULT_MILEAGE_RATE_CENTS,
        ppeStipendCents: DEFAULT_PPE_STIPEND_CENTS,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    data: {
      offer: {
        id: offer.id,
        status: VisitOfferStatus.ACCEPTED,
        acceptedAt: new Date().toISOString(),
      },
      visit: refreshed,
      payoutPreview,
    },
  });
}

export const runtime = 'nodejs';
