import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

import { buildCustomerSetupResponse, canSetupCustomer } from '@/lib/mobile/customer-setup';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { getCustomerWellnessAccess } from '@/lib/wellness/access';

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

const pathPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(500).optional().nullable(),
  timestamp: z.string().datetime().optional().nullable(),
});

const walkSchema = z.object({
  dogId: z.string().trim().optional().nullable(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationSeconds: z.number().int().min(1).max(24 * 60 * 60),
  distanceMeters: z.number().min(0).max(200000),
  path: z.array(pathPointSchema).min(2).max(5000),
  metadata: z.record(z.string(), z.any()).optional().nullable(),
});

function parseDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isPremiumAccess(access: Awaited<ReturnType<typeof getCustomerWellnessAccess>>) {
  return (
    access.tier === 'PREMIUM' ||
    access.source === 'SERVICE_PROMO' ||
    access.hasActiveService
  );
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
    return NextResponse.json({ ok: false, error: 'Customer access required' }, { status: 403 });
  }
  const canSetup = canSetupCustomer(payload.roles);

  const customer = await prisma.customer.findFirst({
    where: { userId },
    select: { id: true, orgId: true },
  });

  if (!customer) {
    return canSetup
      ? buildCustomerSetupResponse(userId)
      : NextResponse.json({ ok: false, error: 'Customer access required' }, { status: 403 });
  }

  const access = await getCustomerWellnessAccess({
    customerId: customer.id,
    orgId: customer.orgId,
  });
  if (!isPremiumAccess(access)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'premium_required',
        message: 'Upgrade to premium to track walks.',
      },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const dogId = searchParams.get('dogId');
  const from = parseDate(searchParams.get('from'));
  const to = parseDate(searchParams.get('to'));
  const limitRaw = Number(searchParams.get('limit') ?? 20);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.floor(limitRaw), 1), 100)
    : 20;

  const dateFilter = from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : null;

  const walks = await prisma.customerWellnessWalk.findMany({
    where: {
      customerId: customer.id,
      ...(dogId ? { dogId } : {}),
      ...(dateFilter ? { startedAt: dateFilter } : {}),
    },
    orderBy: { startedAt: 'desc' },
    take: limit,
    include: {
      dog: { select: { name: true } },
    },
  });

  return NextResponse.json({
    ok: true,
    data: {
      walks: walks.map((walk) => ({
        id: walk.id,
        dogId: walk.dogId,
        dogName: walk.dog?.name ?? null,
        startedAt: walk.startedAt.toISOString(),
        endedAt: walk.endedAt.toISOString(),
        durationSeconds: walk.durationSeconds,
        distanceMeters: walk.distanceMeters,
        path: walk.path,
        metadata: walk.metadata,
      })),
    },
  });
}

export async function POST(request: NextRequest) {
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
    return NextResponse.json({ ok: false, error: 'Customer access required' }, { status: 403 });
  }
  const canSetup = canSetupCustomer(payload.roles);

  const customer = await prisma.customer.findFirst({
    where: { userId },
    select: { id: true, orgId: true },
  });

  if (!customer) {
    return canSetup
      ? buildCustomerSetupResponse(userId)
      : NextResponse.json({ ok: false, error: 'Customer access required' }, { status: 403 });
  }

  const access = await getCustomerWellnessAccess({
    customerId: customer.id,
    orgId: customer.orgId,
  });
  if (!isPremiumAccess(access)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'premium_required',
        message: 'Upgrade to premium to track walks.',
      },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = walkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid request', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const startedAt = new Date(parsed.data.startedAt);
  const endedAt = new Date(parsed.data.endedAt);
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
    return NextResponse.json({ ok: false, error: 'Invalid timestamps.' }, { status: 422 });
  }
  if (endedAt <= startedAt) {
    return NextResponse.json({ ok: false, error: 'End time must be after start time.' }, { status: 422 });
  }

  if (parsed.data.dogId) {
    const dog = await prisma.dog.findFirst({
      where: { id: parsed.data.dogId, customerId: customer.id },
      select: { id: true },
    });
    if (!dog) {
      return NextResponse.json({ ok: false, error: 'Dog not found' }, { status: 404 });
    }
  }

  const created = await prisma.customerWellnessWalk.create(
    Prisma.validator<Prisma.CustomerWellnessWalkCreateArgs>()({
      data: {
        orgId: customer.orgId,
        customerId: customer.id,
        dogId: parsed.data.dogId ?? null,
        startedAt,
        endedAt,
        durationSeconds: parsed.data.durationSeconds,
        distanceMeters: parsed.data.distanceMeters,
        path: parsed.data.path as Prisma.InputJsonValue,
        metadata:
          parsed.data.metadata === null
            ? Prisma.DbNull
            : parsed.data.metadata === undefined
              ? undefined
              : (parsed.data.metadata as Prisma.InputJsonValue),
      },
      include: {
        dog: { select: { name: true } },
      },
    }),
  );

  return NextResponse.json({
    ok: true,
    data: {
      walk: {
        id: created.id,
        dogId: created.dogId,
        dogName: created.dog?.name ?? null,
        startedAt: created.startedAt.toISOString(),
        endedAt: created.endedAt.toISOString(),
        durationSeconds: created.durationSeconds,
        distanceMeters: created.distanceMeters,
        path: created.path,
        metadata: created.metadata,
      },
    },
  });
}

export const runtime = 'nodejs';
