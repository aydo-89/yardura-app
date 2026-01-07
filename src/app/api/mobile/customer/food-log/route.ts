import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FoodLogType } from '@prisma/client';

import { buildCustomerSetupResponse, canSetupCustomer } from '@/lib/mobile/customer-setup';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { detectAllergens } from '@/lib/wellness/allergen-scan';
import {
  SERVICE_TIME_ZONE,
  constructZonedDate,
  convertUtcToZonedParts,
  isValidTimeZone,
} from '@/lib/timezone';

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

const foodLogSchema = z.object({
  type: z.nativeEnum(FoodLogType).optional(),
  dogId: z.string().trim().optional().nullable(),
  productId: z.string().trim().optional().nullable(),
  brand: z.string().trim().max(120).optional().nullable(),
  productName: z.string().trim().max(200).optional().nullable(),
  ingredients: z.string().trim().max(2000).optional().nullable(),
  portion: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  loggedAt: z.string().datetime().optional(),
});

const SCHEDULE_MATCH_WINDOW_MS = 30 * 60 * 1000;

function resolveTimeZone(request: NextRequest): string {
  const header = request.headers.get('x-time-zone');
  return isValidTimeZone(header?.trim()) ? header!.trim() : SERVICE_TIME_ZONE;
}

function parseTimeValue(value: string) {
  const [hourRaw, minuteRaw] = value.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

async function materializeScheduledFoodLogs(
  customer: { id: string; orgId: string },
  timeZone: string,
) {
  const schedules = await prisma.customerFoodSchedule.findMany({
    where: { customerId: customer.id, active: true },
    include: { product: true },
  });

  if (!schedules.length) return;

  const now = new Date();

  for (const schedule of schedules) {
    if (!schedule.timesOfDay.length) continue;
    if (!schedule.product) continue;

    const scheduleTimeZone = isValidTimeZone(schedule.timeZone ?? '')
      ? (schedule.timeZone as string)
      : timeZone;
    const baseStart = schedule.lastGeneratedAt ?? now;
    const scheduleStart =
      schedule.startsOn && schedule.startsOn > baseStart ? schedule.startsOn : baseStart;
    const scheduleEnd = schedule.endsOn && schedule.endsOn < now ? schedule.endsOn : now;
    if (scheduleStart > scheduleEnd) {
      if (!schedule.lastGeneratedAt || schedule.lastGeneratedAt < scheduleEnd) {
        await prisma.customerFoodSchedule.update({
          where: { id: schedule.id },
          data: { lastGeneratedAt: scheduleEnd },
        });
      }
      continue;
    }

    const existingLogs = await prisma.customerFoodLog.findMany({
      where: {
        customerId: customer.id,
        productId: schedule.productId,
        dogId: schedule.dogId ?? null,
        loggedAt: {
          gte: scheduleStart,
          lte: scheduleEnd,
        },
      },
      select: { loggedAt: true },
    });
    const existingTimes = existingLogs.map((log) => log.loggedAt.getTime());

    const startParts = convertUtcToZonedParts(scheduleStart, scheduleTimeZone);
    const endParts = convertUtcToZonedParts(scheduleEnd, scheduleTimeZone);
    const startMidday = constructZonedDate(
      startParts.year,
      startParts.month,
      startParts.day,
      12,
      0,
      0,
      0,
      scheduleTimeZone,
    );
    const endMidday = constructZonedDate(
      endParts.year,
      endParts.month,
      endParts.day,
      12,
      0,
      0,
      0,
      scheduleTimeZone,
    );

    const createData: Array<{
      orgId: string;
      customerId: string;
      dogId: string | null;
      productId: string;
      loggedAt: Date;
      type: FoodLogType;
      brand: string | null;
      productName: string | null;
      ingredients: string | null;
      portion: string | null;
      notes: string | null;
      allergenMatches: string[];
    }> = [];

    for (
      let dayBase = startMidday;
      dayBase.getTime() <= endMidday.getTime();
      dayBase = new Date(dayBase.getTime() + 86400000)
    ) {
      const dayParts = convertUtcToZonedParts(dayBase, scheduleTimeZone);
      for (const timeValue of schedule.timesOfDay) {
        const parsed = parseTimeValue(timeValue);
        if (!parsed) continue;
        const scheduledAt = constructZonedDate(
          dayParts.year,
          dayParts.month,
          dayParts.day,
          parsed.hour,
          parsed.minute,
          0,
          0,
          scheduleTimeZone,
        );
        if (scheduledAt < scheduleStart || scheduledAt > scheduleEnd) continue;
        const exists = existingTimes.some(
          (time) => Math.abs(time - scheduledAt.getTime()) <= SCHEDULE_MATCH_WINDOW_MS,
        );
        if (exists) continue;
        createData.push({
          orgId: customer.orgId,
          customerId: customer.id,
          dogId: schedule.dogId ?? null,
          productId: schedule.productId,
          loggedAt: scheduledAt,
          type: schedule.product.type,
          brand: schedule.product.brand ?? null,
          productName: schedule.product.productName ?? null,
          ingredients: schedule.product.ingredients ?? null,
          portion: schedule.product.portion ?? null,
          notes: schedule.product.notes ?? null,
          allergenMatches: detectAllergens(schedule.product.ingredients ?? ''),
        });
      }
    }

    if (createData.length) {
      await prisma.customerFoodLog.createMany({ data: createData });
    }
    if (!schedule.lastGeneratedAt || schedule.lastGeneratedAt < scheduleEnd) {
      await prisma.customerFoodSchedule.update({
        where: { id: schedule.id },
        data: { lastGeneratedAt: scheduleEnd },
      });
    }
  }
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

  const timeZone = resolveTimeZone(request);
  await materializeScheduledFoodLogs(
    { id: customer.id, orgId: customer.orgId },
    timeZone,
  );

  const searchParams = request.nextUrl.searchParams;
  const limitParam = Number(searchParams.get('limit') ?? 20);
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(Math.floor(limitParam), 1), 50)
    : 20;
  const dogId = searchParams.get('dogId');

  const logs = await prisma.customerFoodLog.findMany({
    where: {
      customerId: customer.id,
      ...(dogId ? { dogId } : {}),
    },
    orderBy: { loggedAt: 'desc' },
    take: limit,
    include: {
      dog: { select: { name: true } },
    },
  });

  return NextResponse.json({
    ok: true,
    data: {
      logs: logs.map((log) => ({
        id: log.id,
        dogId: log.dogId,
        dogName: log.dog?.name ?? null,
        loggedAt: log.loggedAt.toISOString(),
        type: log.type,
        productId: log.productId ?? null,
        brand: log.brand,
        productName: log.productName,
        ingredients: log.ingredients,
        portion: log.portion,
        notes: log.notes,
        allergenMatches: log.allergenMatches,
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

  const body = await request.json().catch(() => null);
  const parsed = foodLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid food log payload', issues: parsed.error.flatten() },
      { status: 422 },
    );
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

  let product: {
    id: string;
    type: FoodLogType;
    brand: string | null;
    productName: string | null;
    ingredients: string | null;
    portion: string | null;
    notes: string | null;
  } | null = null;
  const productId = parsed.data.productId ?? null;
  if (productId) {
    product = await prisma.customerFoodProduct.findFirst({
      where: { id: productId, customerId: customer.id },
      select: {
        id: true,
        type: true,
        brand: true,
        productName: true,
        ingredients: true,
        portion: true,
        notes: true,
      },
    });
    if (!product) {
      return NextResponse.json({ ok: false, error: 'Food product not found' }, { status: 404 });
    }
  }

  const loggedAt = parsed.data.loggedAt ? new Date(parsed.data.loggedAt) : new Date();
  const ingredients = parsed.data.ingredients ?? product?.ingredients ?? null;
  const portion = parsed.data.portion ?? product?.portion ?? null;
  const allergens = detectAllergens(ingredients ?? '');

  const log = await prisma.customerFoodLog.create({
    data: {
      orgId: customer.orgId,
      customerId: customer.id,
      dogId,
      productId: product?.id ?? null,
      loggedAt,
      type: parsed.data.type ?? product?.type ?? FoodLogType.FOOD,
      brand: parsed.data.brand ?? product?.brand ?? null,
      productName: parsed.data.productName ?? product?.productName ?? null,
      ingredients,
      portion,
      notes: parsed.data.notes ?? product?.notes ?? null,
      allergenMatches: allergens,
    },
    include: {
      dog: { select: { name: true } },
    },
  });

  return NextResponse.json({
    ok: true,
    data: {
      log: {
        id: log.id,
        dogId: log.dogId,
        dogName: log.dog?.name ?? null,
        loggedAt: log.loggedAt.toISOString(),
        type: log.type,
        productId: log.productId ?? null,
        brand: log.brand,
        productName: log.productName,
        ingredients: log.ingredients,
        portion: log.portion,
        notes: log.notes,
        allergenMatches: log.allergenMatches,
      },
    },
  });
}
