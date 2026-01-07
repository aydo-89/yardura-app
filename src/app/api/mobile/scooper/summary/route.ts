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
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  let payload: ReturnType<typeof verifyMobileToken>;
  try {
    payload = verifyMobileToken(token);
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid token' },
      { status: 401 },
    );
  }

  const userId = payload.sub;
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: 'Scooper access required' },
      { status: 403 },
    );
  }

  const scooperProfile = await prisma.scooperProfile.findFirst({
    where: { userId },
    select: {
      id: true,
      status: true,
      backgroundCheckStatus: true,
    },
  });

  if (!scooperProfile) {
    return NextResponse.json(
      { ok: false, error: 'Scooper access required' },
      { status: 403 },
    );
  }

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const endOfWeek = new Date(now);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const [nextVisit, todayCount, weekCount] = await Promise.all([
    prisma.serviceVisit.findFirst({
      where: {
        assignedToId: userId,
        scheduledDate: { gte: now },
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
      },
      orderBy: { scheduledDate: 'asc' },
      select: {
        id: true,
        scheduledDate: true,
        status: true,
        customerId: true,
        serviceType: true,
      },
    }),
    prisma.serviceVisit.count({
      where: {
        assignedToId: userId,
        scheduledDate: { gte: startOfDay, lte: endOfDay },
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
      },
    }),
    prisma.serviceVisit.count({
      where: {
        assignedToId: userId,
        scheduledDate: { gte: startOfDay, lte: endOfWeek },
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      nextVisit: nextVisit
        ? {
            ...nextVisit,
            scheduledDate: nextVisit.scheduledDate.toISOString(),
          }
        : null,
      todayCount,
      weekCount,
      profileStatus: scooperProfile.status,
      backgroundCheckStatus: scooperProfile.backgroundCheckStatus,
    },
  });
}
