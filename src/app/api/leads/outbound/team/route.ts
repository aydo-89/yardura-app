import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const allowedRoles = ['ADMIN', 'OWNER', 'SALES_MANAGER', 'FRANCHISE_OWNER', 'SALES_REP'];

function forbidden(message = 'Unauthorized') {
  return NextResponse.json({ ok: false, error: message }, { status: 403 });
}

interface ParsedLocation {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
}

function parseLocation(value: unknown): ParsedLocation | null {
  if (!value || typeof value !== 'object') return null;

  const loc = value as Record<string, unknown>;

  if (typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
    return {
      latitude: loc.latitude,
      longitude: loc.longitude,
      accuracy: typeof loc.accuracy === 'number' ? loc.accuracy : null,
    };
  }

  if (loc.type === 'Point' && Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
    const [lng, lat] = loc.coordinates as number[];
    if (typeof lat === 'number' && typeof lng === 'number') {
      return {
        latitude: lat,
        longitude: lng,
        accuracy: typeof loc.accuracy === 'number' ? (loc.accuracy as number) : null,
      };
    }
  }

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return forbidden();
    }

    const role = (session as any)?.userRole;
    if (!allowedRoles.includes(role)) {
      return forbidden();
    }

    const orgId = (session.user as any)?.orgId;
    if (!orgId) {
      return NextResponse.json({ ok: false, error: 'Organization not set' }, { status: 400 });
    }

    const activities = await prisma.leadActivity.findMany({
      where: {
        orgId,
        location: { not: null },
        userId: { not: null },
      },
      orderBy: { occurredAt: 'desc' },
      take: 200,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    const seen = new Set<string>();
    const team = [] as Array<{
      userId: string;
      name?: string | null;
      email?: string | null;
      latitude: number;
      longitude: number;
      accuracy?: number | null;
      occurredAt: Date;
    }>;

    for (const activity of activities) {
      if (!activity.userId || seen.has(activity.userId)) continue;
      const parsed = parseLocation(activity.location);
      if (!parsed) continue;

      seen.add(activity.userId);
      team.push({
        userId: activity.userId,
        name: activity.user?.name,
        email: activity.user?.email,
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        accuracy: parsed.accuracy,
        occurredAt: activity.occurredAt,
      });
    }

    return NextResponse.json({ ok: true, data: team });
  } catch (error) {
    console.error('GET /api/leads/outbound/team error', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
