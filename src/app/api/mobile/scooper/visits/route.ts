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

  const { searchParams } = new URL(request.url);
  const limitRaw = searchParams.get('limit');
  const limit = limitRaw ? Math.min(50, Math.max(1, Number(limitRaw))) : 20;
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const where: Record<string, any> = {
    assignedToId: userId,
    status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
  };
  if (from || to) {
    where.scheduledDate = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  } else {
    where.scheduledDate = { gte: new Date() };
  }

  const visits = await prisma.serviceVisit.findMany({
    where,
    orderBy: { scheduledDate: 'asc' },
    take: Number.isFinite(limit) ? limit : 20,
    select: {
      id: true,
      scheduledDate: true,
      status: true,
      serviceType: true,
      yardSize: true,
      preferredTimeWindow: true,
      preferredTimeWindowSlug: true,
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
          state: true,
          zip: true,
        },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    data: {
      visits: visits.map((visit) => ({
        id: visit.id,
        scheduledDate: visit.scheduledDate.toISOString(),
        status: visit.status,
        serviceType: visit.serviceType,
        yardSize: visit.yardSize,
        preferredTimeWindow: visit.preferredTimeWindow ?? null,
        preferredTimeWindowSlug: visit.preferredTimeWindowSlug ?? null,
        tile: visit.tile ?? null,
        customer: visit.customer ?? null,
      })),
    },
  });
}
