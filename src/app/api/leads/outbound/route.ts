import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const DEFAULT_PAGE_SIZE = 20;

const createLeadSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z
    .object({
      line1: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
    })
    .optional(),
  territoryId: z.string().optional(),
  pipelineStage: z.string().optional(),
  ownerId: z.string().optional(),
  campaignId: z.string().optional(),
  initialActivity: z
    .object({
      type: z.string(),
      channel: z.string().optional(),
      occurredAt: z.string().datetime().optional(),
      result: z.string().optional(),
      notes: z.string().optional(),
      followUpAt: z.string().datetime().optional(),
      location: z
        .object({ lat: z.number(), lng: z.number(), accuracy: z.number().optional() })
        .optional(),
    })
    .optional(),
});

function forbidden(message = 'Unauthorized') {
  return NextResponse.json({ ok: false, error: message }, { status: 403 });
}

function getRole(session: any): string | undefined {
  return session?.userRole || session?.role;
}

function toStageColor(stage?: string | null) {
  if (!stage) return 'default';
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

function extractLeadMetadata(pricingBreakdown: unknown) {
  if (!pricingBreakdown) {
    return {
      preferredStartDate: null,
      preferredContactMethods: null,
      howDidYouHear: null,
    };
  }
  try {
    const raw = typeof pricingBreakdown === 'string' ? JSON.parse(pricingBreakdown) : pricingBreakdown;
    const metadata = raw?.metadata ?? raw ?? {};
    return {
      preferredStartDate: metadata?.preferredStartDate ?? null,
      preferredContactMethods: metadata?.preferredContactMethods ?? null,
      howDidYouHear: metadata?.howDidYouHear ?? null,
    };
  } catch {
    return {
      preferredStartDate: null,
      preferredContactMethods: null,
      howDidYouHear: null,
    };
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return forbidden();
    }

    const role = getRole(session as any);
    const userId = (session.user as any)?.id;
    const orgId = (session.user as any)?.orgId;

    if (!orgId) {
      return NextResponse.json({ ok: false, error: 'Organization not set' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || `${DEFAULT_PAGE_SIZE}`, 10), 100);
    const cursor = searchParams.get('cursor') || undefined;
    const pipelineStage = searchParams.get('pipelineStage') || undefined;
    const ownerIdParam = searchParams.get('ownerId') || undefined;
    const territoryId = searchParams.get('territoryId') || undefined;
    const leadType = searchParams.get('leadType') || 'outbound';
    const search = searchParams.get('search') || undefined;
    const nextActionBefore = searchParams.get('nextActionBefore') || undefined;
    const includeCadence = searchParams.get('includeCadence') === 'true';

    const where: any = {
      orgId,
      leadType,
    };

    if (pipelineStage) {
      where.pipelineStage = pipelineStage;
    }

    if (territoryId) {
      where.territoryId = territoryId === 'NULL' ? null : territoryId;
    }

    if (nextActionBefore) {
      where.nextActionAt = { lte: new Date(nextActionBefore) };
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { zipCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role === 'SALES_REP' && userId) {
      where.AND = [
        {
          OR: [
            { ownerId: userId },
            { salesRepId: userId },
          ],
        },
      ];
    } else if (ownerIdParam) {
      where.ownerId = ownerIdParam === 'NULL' ? null : ownerIdParam;
    }

    const leads = await prisma.lead.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [
        { nextActionAt: 'asc' },
        { updatedAt: 'desc' },
      ],
      include: {
        territory: { select: { id: true, name: true, color: true } },
        owner: { select: { id: true, name: true, email: true } },
        salesRep: { select: { id: true, name: true, email: true } },
        lastActivity: true,
        cadenceEnrollments: includeCadence
          ? {
              where: { status: 'active' },
              select: { id: true, cadenceId: true, nextRunAt: true, status: true },
            }
          : false,
      },
    });

    let nextCursor: string | null = null;
    if (leads.length > limit) {
      const nextItem = leads.pop();
      nextCursor = nextItem?.id ?? null;
    }

    const now = Date.now();

    const mapped = leads.map((lead) => {
      const metadata = extractLeadMetadata(lead.pricingBreakdown);
      const owner = lead.owner ?? lead.salesRep ?? null;
      const slaMinutes = lead.nextActionAt ? Math.round((lead.nextActionAt.getTime() - now) / 60000) : null;

      return {
        id: lead.id,
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        leadType: lead.leadType,
        pipelineStage: lead.pipelineStage,
        stageColor: toStageColor(lead.pipelineStage),
        owner,
        territory: lead.territory,
        address: lead.address,
        city: lead.city,
        state: lead.state,
        zipCode: lead.zipCode,
        latitude: lead.latitude,
        longitude: lead.longitude,
        lastActivity: lead.lastActivity
          ? {
              id: lead.lastActivity.id,
              type: lead.lastActivity.type,
              result: lead.lastActivity.result,
              occurredAt: lead.lastActivity.occurredAt,
            }
          : null,
        submittedAt: lead.submittedAt,
        lastActivityAt: lead.lastActivityAt,
        nextActionAt: lead.nextActionAt,
        nextActionSlaMinutes: slaMinutes,
        preferredStartDate: metadata.preferredStartDate,
        preferredContactMethods: metadata.preferredContactMethods,
        howDidYouHear: metadata.howDidYouHear ?? lead.referralSource,
        cadenceEnrollments: includeCadence ? lead.cadenceEnrollments : undefined,
      };
    });

    return NextResponse.json({
      ok: true,
      data: {
        leads: mapped,
        pageInfo: { nextCursor },
      },
    });
  } catch (error) {
    console.error('GET /api/leads/outbound error', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return forbidden();
    }

    const role = getRole(session as any);
    const orgId = (session.user as any)?.orgId;
    const sessionUserId = (session.user as any)?.id;

    if (!orgId) {
      return NextResponse.json({ ok: false, error: 'Organization not set' }, { status: 400 });
    }

    const json = await req.json();
    const parsed = createLeadSchema.parse(json);

    const isManager = ['ADMIN', 'OWNER', 'SALES_MANAGER', 'FRANCHISE_OWNER'].includes(role || '');

    const ownerId = isManager ? parsed.ownerId ?? sessionUserId : sessionUserId;

    if (!ownerId) {
      return NextResponse.json({ ok: false, error: 'Owner could not be determined' }, { status: 400 });
    }

    if (parsed.territoryId) {
      const territory = await prisma.territory.findFirst({ where: { id: parsed.territoryId, orgId } });
      if (!territory) {
        return NextResponse.json({ ok: false, error: 'Territory not found' }, { status: 404 });
      }
    }

    const email = parsed.email ?? `outbound-${crypto.randomUUID()}@leads.yardura`;

    const leadData = {
      orgId,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      email,
      phone: parsed.phone,
      serviceType: 'residential' as const,
      source: 'outbound',
      leadType: 'outbound',
      pipelineStage: parsed.pipelineStage ?? 'cold',
      territoryId: parsed.territoryId,
      campaignId: parsed.campaignId,
      ownerId,
      createdById: sessionUserId,
      address: parsed.address?.line1,
      city: parsed.address?.city,
      state: parsed.address?.state,
      zipCode: parsed.address?.zip,
      latitude: parsed.address?.latitude,
      longitude: parsed.address?.longitude,
      lastActivityAt: parsed.initialActivity?.occurredAt
        ? new Date(parsed.initialActivity.occurredAt)
        : undefined,
      nextActionAt: parsed.initialActivity?.followUpAt
        ? new Date(parsed.initialActivity.followUpAt)
        : parsed.pipelineStage === 'cold'
          ? new Date(Date.now() + 24 * 60 * 60 * 1000)
          : undefined,
    } as const;

    const result = await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: leadData,
        include: {
          owner: { select: { id: true, name: true, email: true } },
          territory: { select: { id: true, name: true, color: true } },
        },
      });

      let activity = null;
      if (parsed.initialActivity) {
        activity = await tx.leadActivity.create({
          data: {
            leadId: lead.id,
            orgId,
            userId: sessionUserId,
            type: parsed.initialActivity.type,
            channel: parsed.initialActivity.channel,
            occurredAt: parsed.initialActivity.occurredAt
              ? new Date(parsed.initialActivity.occurredAt)
              : undefined,
            result: parsed.initialActivity.result,
            notes: parsed.initialActivity.notes,
            followUpAt: parsed.initialActivity.followUpAt
              ? new Date(parsed.initialActivity.followUpAt)
              : undefined,
            location: parsed.initialActivity.location
              ? {
                  type: 'Point',
                  coordinates: [
                    parsed.initialActivity.location.lng,
                    parsed.initialActivity.location.lat,
                  ],
                  accuracy: parsed.initialActivity.location.accuracy,
                }
              : undefined,
          },
        });

        await tx.lead.update({
          where: { id: lead.id },
          data: {
            lastActivityId: activity.id,
            lastActivityAt: activity.occurredAt,
            nextActionAt: parsed.initialActivity.followUpAt
              ? new Date(parsed.initialActivity.followUpAt)
              : lead.nextActionAt,
          },
        });
      }

      return { lead, activity };
    });

    return NextResponse.json({ ok: true, data: result }, { status: 201 });
  } catch (error) {
    console.error('POST /api/leads/outbound error', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: 'Validation error', details: error.flatten() },
        { status: 400 }
      );
    }

    if ((error as any)?.code === 'P2002') {
      return NextResponse.json({ ok: false, error: 'Lead already exists with that email' }, { status: 409 });
    }

    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
