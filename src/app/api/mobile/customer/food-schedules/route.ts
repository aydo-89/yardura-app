import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { buildCustomerSetupResponse, canSetupCustomer } from '@/lib/mobile/customer-setup';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { resolveStorageUrl } from '@/lib/storage';
import { isValidTimeZone } from '@/lib/timezone';

function formatServerError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function isPrismaError(error: unknown): error is { code?: string; message?: string } {
  return Boolean(error && typeof error === 'object' && 'message' in error);
}

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function normalizeTimes(values: string[]) {
  const normalized = values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => TIME_PATTERN.test(value));
  if (!normalized.length) {
    throw new Error('Add at least one daily time.');
  }
  const unique = Array.from(new Set(normalized));
  unique.sort((a, b) => {
    const [aHour, aMin] = a.split(':').map(Number);
    const [bHour, bMin] = b.split(':').map(Number);
    return aHour * 60 + aMin - (bHour * 60 + bMin);
  });
  return unique;
}

const scheduleSchema = z.object({
  productId: z.string().trim(),
  dogId: z.string().trim().optional().nullable(),
  timesOfDay: z.array(z.string()).min(1),
  active: z.boolean().optional(),
  startsOn: z.string().datetime().optional().nullable(),
  endsOn: z.string().datetime().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
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
    select: { id: true },
  });

  if (!customer) {
    return canSetup
      ? buildCustomerSetupResponse(userId)
      : NextResponse.json({ ok: false, error: 'Customer access required' }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const dogId = searchParams.get('dogId');

  const schedules = await prisma.customerFoodSchedule.findMany({
    where: {
      customerId: customer.id,
      ...(dogId ? { dogId } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      product: true,
    },
  });

  const hydrated = await Promise.all(
    schedules.map(async (schedule) => ({
      id: schedule.id,
      dogId: schedule.dogId,
      productId: schedule.productId,
      active: schedule.active,
      timesOfDay: schedule.timesOfDay,
      timeZone: schedule.timeZone ?? null,
      startsOn: schedule.startsOn?.toISOString() ?? null,
      endsOn: schedule.endsOn?.toISOString() ?? null,
      product: {
        id: schedule.product.id,
        dogId: schedule.product.dogId,
        type: schedule.product.type,
        brand: schedule.product.brand,
        productName: schedule.product.productName,
        ingredients: schedule.product.ingredients,
        portion: schedule.product.portion,
        notes: schedule.product.notes,
        imageUrl: await resolveStorageUrl(schedule.product.imagePath),
      },
    })),
  );

  return NextResponse.json({
    ok: true,
    data: { schedules: hydrated },
  });
  } catch (error) {
    console.error('[mobile.food-schedules.get] failed', error);
    const message =
      isPrismaError(error) && error.code === 'P2021'
        ? 'Server database is updating. Please try again in a minute.'
        : formatServerError(error, 'Unable to load schedules.');
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
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

  const body = await request.json().catch(() => null);
  const parsed = scheduleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid schedule payload', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const product = await prisma.customerFoodProduct.findFirst({
    where: { id: parsed.data.productId, customerId: customer.id },
  });

  if (!product) {
    return NextResponse.json({ ok: false, error: 'Food product not found' }, { status: 404 });
  }

  const dogId = parsed.data.dogId ?? null;
  if (dogId) {
    const dog = await prisma.dog.findFirst({
      where: { id: dogId, customerId: customer.id },
      select: { id: true },
    });
    if (!dog) {
      return NextResponse.json({ ok: false, error: 'Dog not found' }, { status: 404 });
    }
  }

  let normalizedTimes: string[];
  try {
    normalizedTimes = normalizeTimes(parsed.data.timesOfDay);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid times of day.';
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }

  const headerTimeZone = request.headers.get('x-time-zone');
  const timeZone = isValidTimeZone(headerTimeZone?.trim()) ? headerTimeZone?.trim() : null;

  const schedule = await prisma.customerFoodSchedule.create({
    data: {
      orgId: customer.orgId,
      customerId: customer.id,
      dogId,
      productId: product.id,
      active: parsed.data.active ?? true,
      timesOfDay: normalizedTimes,
      timeZone,
      startsOn: parsed.data.startsOn ? new Date(parsed.data.startsOn) : null,
      endsOn: parsed.data.endsOn ? new Date(parsed.data.endsOn) : null,
      lastGeneratedAt: new Date(),
    },
  });

  return NextResponse.json({
    ok: true,
    data: {
      schedule: {
        id: schedule.id,
        dogId: schedule.dogId,
        productId: schedule.productId,
        active: schedule.active,
        timesOfDay: schedule.timesOfDay,
        timeZone: schedule.timeZone ?? null,
        startsOn: schedule.startsOn?.toISOString() ?? null,
        endsOn: schedule.endsOn?.toISOString() ?? null,
        product: {
          id: product.id,
          dogId: product.dogId,
          type: product.type,
        brand: product.brand,
        productName: product.productName,
        ingredients: product.ingredients,
        portion: product.portion,
        notes: product.notes,
        imageUrl: await resolveStorageUrl(product.imagePath),
      },
    },
    },
  });
  } catch (error) {
    console.error('[mobile.food-schedules.post] failed', error);
    const message =
      isPrismaError(error) && error.code === 'P2021'
        ? 'Server database is updating. Please try again in a minute.'
        : formatServerError(error, 'Unable to save schedule.');
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const runtime = 'nodejs';
