import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const createTripSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  ownerId: z.string().optional(),
  territoryId: z.string().optional(),
  optimization: z.enum(['fastest', 'shortest']).default('fastest'),
  plannedStart: z.string().datetime().optional(),
  leadIds: z.array(z.string()).min(1, 'Select at least one stop'),
});

const allowedRoles = ['ADMIN', 'OWNER', 'SALES_MANAGER', 'FRANCHISE_OWNER', 'SALES_REP'];

function forbidden(message = 'Unauthorized') {
  return NextResponse.json({ ok: false, error: message }, { status: 403 });
}

function toStageColor(stage?: string | null) {
  switch ((stage || '').toLowerCase()) {
    case 'cold':
      return 'cyan';
    case 'contacted':
      return 'blue';
    case 'scheduled':
      return 'green';
    case 'follow_up':
    case 'follow-up':
      return 'amber';
    case 'won':
      return 'emerald';
    case 'lost':
      return 'rose';
    default:
      return 'slate';
  }
}

function hydrateTripStageColors<T extends { stops?: Array<{ lead: { pipelineStage: string | null } | null }> }>(trip: T) {
  if (!trip?.stops) return trip;
  Object.assign(trip, {
    stops: trip.stops.map((stop) =>
      stop
        ? {
            ...stop,
            lead: stop.lead
              ? {
                  ...stop.lead,
                  stageColor: toStageColor(stop.lead.pipelineStage),
                }
              : null,
          }
        : stop
    ),
  });
  return trip;
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
    const userId = (session.user as any)?.id;
    if (!orgId) {
      return NextResponse.json({ ok: false, error: 'Organization not set' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const ownerIdFilter = searchParams.get('ownerId') || undefined;
    const includeStops = searchParams.get('includeStops') !== 'false';

    const where: any = { orgId };
    if (ownerIdFilter) {
      where.ownerId = ownerIdFilter;
    } else if (role === 'SALES_REP' && userId) {
      where.OR = [{ ownerId: userId }, { createdById: userId }];
    }

    const trips = await prisma.trip.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        territory: { select: { id: true, name: true, color: true } },
        stops: includeStops
          ? {
              orderBy: { order: 'asc' },
              include: {
                lead: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    city: true,
                    state: true,
                    pipelineStage: true,
                    nextActionAt: true,
                  },
                },
              },
            }
          : false,
      },
    });

    return NextResponse.json({
      ok: true,
      data: trips.map((trip) => hydrateTripStageColors(trip as any)),
    });
  } catch (error) {
    console.error('GET /api/trips error', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
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
    const sessionUserId = (session.user as any)?.id;
    if (!orgId || !sessionUserId) {
      return NextResponse.json({ ok: false, error: 'Organization not set' }, { status: 400 });
    }

    const body = await req.json();
    const parsed = createTripSchema.parse(body);

    const ownerId = role === 'SALES_REP' ? sessionUserId : parsed.ownerId ?? sessionUserId;

    const leads = await prisma.lead.findMany({
      where: {
        id: { in: parsed.leadIds },
        orgId,
      },
      select: {
        id: true,
        latitude: true,
        longitude: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
      },
    });

    if (leads.length !== parsed.leadIds.length) {
      return NextResponse.json(
        { ok: false, error: 'Some selected leads could not be found in this organization' },
        { status: 400 }
      );
    }

    const orderedLeads = parsed.leadIds
      .map((id) => leads.find((lead) => lead.id === id))
      .filter((lead): lead is typeof leads[number] => Boolean(lead));

    const missingCoordinates = orderedLeads.filter((lead) => lead.latitude == null || lead.longitude == null);
    if (missingCoordinates.length) {
      return NextResponse.json(
        { ok: false, error: 'All stops must have latitude and longitude before creating a trip.' },
        { status: 400 }
      );
    }

    const firstLead = orderedLeads[0];
    const startLocation = {
      label: firstLead.address || `${firstLead.city ?? ''}, ${firstLead.state ?? ''}`.trim(),
      latitude: firstLead.latitude,
      longitude: firstLead.longitude,
    };

    const result = await prisma.$transaction(async (tx) => {
      const trip = await tx.trip.create({
        data: {
          orgId,
          createdById: sessionUserId,
          ownerId,
          territoryId: parsed.territoryId || undefined,
          name: parsed.name,
          optimization: parsed.optimization,
          plannedStart: parsed.plannedStart ? new Date(parsed.plannedStart) : undefined,
          startLocation,
          endLocation: undefined,
          status: 'planned',
        },
      });

      await tx.tripStop.createMany({
        data: orderedLeads.map((lead, index) => ({
          tripId: trip.id,
          leadId: lead.id,
          order: index + 1,
          status: 'pending',
          address: lead.address,
          location: {
            latitude: lead.latitude,
            longitude: lead.longitude,
          },
        })),
      });

      const hydrated = await tx.trip.findUnique({
        where: { id: trip.id },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          territory: { select: { id: true, name: true, color: true } },
          stops: {
            orderBy: { order: 'asc' },
              include: {
                lead: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    city: true,
                    state: true,
                    pipelineStage: true,
                    nextActionAt: true,
                  },
                },
              },
            },
        },
      });

      return hydrated ? hydrateTripStageColors(hydrated) : hydrated;
    });

    return NextResponse.json({ ok: true, data: result }, { status: 201 });
  } catch (error) {
    console.error('POST /api/trips error', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: 'Validation error', details: error.flatten() },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
