import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const DEFAULT_PAGE_SIZE = 25;

const createActivitySchema = z.object({
  type: z.string(),
  channel: z.string().optional(),
  occurredAt: z.string().datetime().optional(),
  result: z.string().optional(),
  notes: z.string().optional(),
  followUpAt: z.string().datetime().optional(),
  attachments: z
    .array(
      z.object({
        filename: z.string(),
        url: z.string().url(),
        mimeType: z.string().optional(),
      })
    )
    .optional(),
  location: z
    .object({ lat: z.number(), lng: z.number(), accuracy: z.number().optional() })
    .optional(),
});

function forbidden(message = 'Unauthorized') {
  return NextResponse.json({ ok: false, error: message }, { status: 403 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return forbidden();
    }

    const { id: leadId } = await params;
    if (!leadId) {
      return NextResponse.json({ ok: false, error: 'Lead ID is required' }, { status: 400 });
    }

    const orgId = (session.user as any)?.orgId;
    const userId = (session.user as any)?.id;
    const role = (session as any)?.userRole;

    if (!orgId) {
      return NextResponse.json({ ok: false, error: 'Organization not set' }, { status: 400 });
    }

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, orgId },
      select: { id: true, ownerId: true, salesRepId: true },
    });

    if (!lead) {
      return NextResponse.json({ ok: false, error: 'Lead not found' }, { status: 404 });
    }

    if (role === 'SALES_REP' && userId) {
      const ownsLead = lead.ownerId === userId || lead.salesRepId === userId;
      if (!ownsLead) {
        return forbidden();
      }
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || `${DEFAULT_PAGE_SIZE}`, 10), 100);
    const cursor = searchParams.get('cursor') || undefined;

    const activities = await prisma.leadActivity.findMany({
      where: { leadId },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { occurredAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    let nextCursor: string | null = null;
    if (activities.length > limit) {
      const nextItem = activities.pop();
      nextCursor = nextItem?.id ?? null;
    }

    return NextResponse.json({
      ok: true,
      data: {
        activities,
        pageInfo: { nextCursor },
      },
    });
  } catch (error) {
    console.error('GET /api/leads/[id]/activities error', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return forbidden();
    }

    const { id: leadId } = await params;
    if (!leadId) {
      return NextResponse.json({ ok: false, error: 'Lead ID is required' }, { status: 400 });
    }

    const orgId = (session.user as any)?.orgId;
    const userId = (session.user as any)?.id;
    const role = (session as any)?.userRole;

    if (!orgId) {
      return NextResponse.json({ ok: false, error: 'Organization not set' }, { status: 400 });
    }

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, orgId },
      select: { id: true, ownerId: true, salesRepId: true },
    });

    if (!lead) {
      return NextResponse.json({ ok: false, error: 'Lead not found' }, { status: 404 });
    }

    if (role === 'SALES_REP' && userId) {
      const ownsLead = lead.ownerId === userId || lead.salesRepId === userId;
      if (!ownsLead) {
        return forbidden();
      }
    }

    const json = await request.json();
    const parsed = createActivitySchema.parse(json);

    const occurredAt = parsed.occurredAt ? new Date(parsed.occurredAt) : new Date();
    const followUpAt = parsed.followUpAt ? new Date(parsed.followUpAt) : undefined;

    const activity = await prisma.$transaction(async (tx) => {
      const created = await tx.leadActivity.create({
        data: {
          leadId,
          orgId,
          userId,
          type: parsed.type,
          channel: parsed.channel,
          occurredAt,
          result: parsed.result,
          notes: parsed.notes,
          followUpAt,
          attachments: parsed.attachments ?? undefined,
          location: parsed.location
            ? {
                type: 'Point',
                coordinates: [parsed.location.lng, parsed.location.lat],
                accuracy: parsed.location.accuracy,
              }
            : undefined,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      await tx.lead.update({
        where: { id: leadId },
        data: {
          lastActivityId: created.id,
          lastActivityAt: created.occurredAt,
          nextActionAt: followUpAt ?? undefined,
        },
      });

      return created;
    });

    return NextResponse.json({ ok: true, data: activity }, { status: 201 });
  } catch (error) {
    console.error('POST /api/leads/[id]/activities error', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: 'Validation error', details: error.flatten() },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
