import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { buildCustomerSetupResponse, canSetupCustomer } from '@/lib/mobile/customer-setup';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { resolveStorageUrl } from '@/lib/storage';

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

const scheduleUpdateSchema = z.object({
  dogId: z.string().trim().optional().nullable(),
  timesOfDay: z.array(z.string()).optional(),
  active: z.boolean().optional(),
  startsOn: z.string().datetime().optional().nullable(),
  endsOn: z.string().datetime().optional().nullable(),
});

type RouteParams = { params: Promise<{ scheduleId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

  const { scheduleId } = await params;
  const existing = await prisma.customerFoodSchedule.findFirst({
    where: { id: scheduleId, customerId: customer.id },
    include: { product: true },
  });

  if (!existing) {
    return NextResponse.json({ ok: false, error: 'Schedule not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = scheduleUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid schedule update', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const update: Record<string, any> = {};
  let shouldResetGeneration = false;
  if ('dogId' in parsed.data) {
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
    update.dogId = dogId;
    shouldResetGeneration = true;
  }
  if (parsed.data.timesOfDay) {
    try {
      update.timesOfDay = normalizeTimes(parsed.data.timesOfDay);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid times of day.';
      return NextResponse.json({ ok: false, error: message }, { status: 422 });
    }
    shouldResetGeneration = true;
  }
  if (parsed.data.active !== undefined) {
    update.active = parsed.data.active;
    if (!existing.active && parsed.data.active) {
      shouldResetGeneration = true;
    }
  }
  if ('startsOn' in parsed.data) {
    update.startsOn = parsed.data.startsOn ? new Date(parsed.data.startsOn) : null;
    shouldResetGeneration = true;
  }
  if ('endsOn' in parsed.data) {
    update.endsOn = parsed.data.endsOn ? new Date(parsed.data.endsOn) : null;
    shouldResetGeneration = true;
  }
  if (shouldResetGeneration) {
    update.lastGeneratedAt = new Date();
  }

  const updated = await prisma.customerFoodSchedule.update({
    where: { id: existing.id },
    data: update,
    include: { product: true },
  });

  return NextResponse.json({
    ok: true,
    data: {
      schedule: {
        id: updated.id,
        dogId: updated.dogId,
        productId: updated.productId,
        active: updated.active,
        timesOfDay: updated.timesOfDay,
        timeZone: updated.timeZone ?? null,
        startsOn: updated.startsOn?.toISOString() ?? null,
        endsOn: updated.endsOn?.toISOString() ?? null,
        product: {
          id: updated.product.id,
          dogId: updated.product.dogId,
          type: updated.product.type,
          brand: updated.product.brand,
          productName: updated.product.productName,
          ingredients: updated.product.ingredients,
          portion: updated.product.portion,
          notes: updated.product.notes,
          imageUrl: await resolveStorageUrl(updated.product.imagePath),
        },
      },
    },
  });
  } catch (error) {
    console.error('[mobile.food-schedules.patch] failed', error);
    const message =
      isPrismaError(error) && error.code === 'P2021'
        ? 'Server database is updating. Please try again in a minute.'
        : formatServerError(error, 'Unable to update schedule.');
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

  const { scheduleId } = await params;
  const schedule = await prisma.customerFoodSchedule.findFirst({
    where: { id: scheduleId, customerId: customer.id },
    select: { id: true },
  });

  if (!schedule) {
    return NextResponse.json({ ok: false, error: 'Schedule not found' }, { status: 404 });
  }

  await prisma.customerFoodSchedule.delete({
    where: { id: schedule.id },
  });

  return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[mobile.food-schedules.delete] failed', error);
    const message =
      isPrismaError(error) && error.code === 'P2021'
        ? 'Server database is updating. Please try again in a minute.'
        : formatServerError(error, 'Unable to delete schedule.');
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const runtime = 'nodejs';
