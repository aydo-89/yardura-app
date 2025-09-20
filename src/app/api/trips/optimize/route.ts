import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const allowedRoles = ['ADMIN', 'OWNER', 'SALES_MANAGER', 'FRANCHISE_OWNER', 'SALES_REP'];

const optimizeSchema = z.object({
  leadIds: z.array(z.string()).min(2, 'Select at least two stops to optimize'),
  startLeadId: z.string().optional(),
});

function forbidden(message = 'Unauthorized') {
  return NextResponse.json({ ok: false, error: message }, { status: 403 });
}

function haversineDistance(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371e3;
  const φ1 = toRad(a.latitude);
  const φ2 = toRad(b.latitude);
  const Δφ = toRad(b.latitude - a.latitude);
  const Δλ = toRad(b.longitude - a.longitude);

  const sinΔφ = Math.sin(Δφ / 2);
  const sinΔλ = Math.sin(Δλ / 2);
  const aa = sinΔφ * sinΔφ + Math.cos(φ1) * Math.cos(φ2) * sinΔλ * sinΔλ;
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));

  return R * c;
}

export async function POST(req: NextRequest) {
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

    const json = await req.json();
    const parsed = optimizeSchema.parse(json);

    const leads = await prisma.lead.findMany({
      where: { id: { in: parsed.leadIds }, orgId },
      select: {
        id: true,
        latitude: true,
        longitude: true,
      },
    });

    if (leads.length !== parsed.leadIds.length) {
      return NextResponse.json(
        { ok: false, error: 'Some selected leads are missing or belong to another organization.' },
        { status: 400 }
      );
    }

    const coordinateMap = new Map(
      leads
        .filter((lead) => lead.latitude != null && lead.longitude != null)
        .map((lead) => [lead.id, { latitude: lead.latitude!, longitude: lead.longitude! }])
    );

    if (coordinateMap.size !== leads.length) {
      return NextResponse.json(
        { ok: false, error: 'All selected leads must have latitude and longitude set before optimizing.' },
        { status: 400 }
      );
    }

    const remaining = new Set(parsed.leadIds);
    const startId = parsed.startLeadId && remaining.has(parsed.startLeadId)
      ? parsed.startLeadId
      : parsed.leadIds[0];

    const ordered: string[] = [];
    let currentId = startId;
    remaining.delete(currentId);
    ordered.push(currentId);
    let totalDistance = 0;

    while (remaining.size) {
      const currentCoord = coordinateMap.get(currentId)!;
      let nextId: string | null = null;
      let bestDistance = Infinity;

      for (const candidateId of remaining) {
        const candidateCoord = coordinateMap.get(candidateId)!;
        const distance = haversineDistance(currentCoord, candidateCoord);
        if (distance < bestDistance) {
          bestDistance = distance;
          nextId = candidateId;
        }
      }

      if (!nextId) break;

      totalDistance += bestDistance;
      remaining.delete(nextId);
      ordered.push(nextId);
      currentId = nextId;
    }

    return NextResponse.json({
      ok: true,
      data: {
        orderedLeadIds: ordered,
        totalDistanceMeters: Math.round(totalDistance),
      },
    });
  } catch (error) {
    console.error('POST /api/trips/optimize error', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: 'Validation error', details: error.flatten() },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
