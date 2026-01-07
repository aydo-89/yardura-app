import { NextRequest, NextResponse } from 'next/server';
import { ScooperStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { loadScooperOfferFeed } from '@/lib/marketplace/offers';

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
  const limit = limitParam ? Math.min(100, Math.max(1, Number(limitParam))) : 40;

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
      availabilities: {
        include: {
          tile: {
            select: {
              id: true,
              slug: true,
              name: true,
              status: true,
            },
          },
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

  if (!profile) {
    return NextResponse.json({ ok: false, error: 'scooper_profile_missing' }, { status: 404 });
  }

  if (!profile.org) {
    return NextResponse.json({ ok: false, error: 'scooper_org_missing' }, { status: 400 });
  }

  const tileIds = profile.availabilities
    .map((availability) => availability.tileId)
    .filter((id): id is string => Boolean(id));

  const homeAnchor = (() => {
    const metadata =
      profile.metadata && typeof profile.metadata === 'object' && !Array.isArray(profile.metadata)
        ? (profile.metadata as Record<string, unknown>)
        : null;
    const anchor =
      metadata && typeof metadata.homeAnchor === 'object' && metadata.homeAnchor !== null
        ? (metadata.homeAnchor as Record<string, unknown>)
        : null;
    const lat = anchor && typeof anchor.lat === 'number' ? anchor.lat : null;
    const lng = anchor && typeof anchor.lng === 'number' ? anchor.lng : null;
    if (typeof lat === 'number' && typeof lng === 'number') {
      return { lat, lng };
    }
    return null;
  })();

  if (profile.status !== ScooperStatus.CERTIFIED) {
    return NextResponse.json({
      ok: true,
      data: {
        org: profile.org,
        profileStatus: profile.status,
        offers: [],
        summary: {
          total: 0,
          direct: 0,
          broadcast: 0,
        },
      },
    });
  }

  const offers = await loadScooperOfferFeed({
    orgId: profile.org.id,
    userId,
    tileIds,
    limit,
    homeAnchor,
    certifications: profile.certifications,
  });

  const serialized = offers.map((offer) => ({
    ...offer,
    scheduledDate: offer.scheduledDate ? offer.scheduledDate.toISOString() : null,
    expiresAt: offer.expiresAt ? offer.expiresAt.toISOString() : null,
  }));

  const directCount = offers.filter((offer) => offer.isDirectOffer).length;

  return NextResponse.json({
    ok: true,
    data: {
      org: profile.org,
      profileStatus: profile.status,
      offers: serialized,
      summary: {
        total: offers.length,
        direct: directCount,
        broadcast: offers.length - directCount,
      },
      generatedAt: new Date().toISOString(),
    },
  });
}

export const runtime = 'nodejs';
