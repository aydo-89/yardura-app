import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { WellnessReminderCategory } from '@prisma/client';

import { buildCustomerSetupResponse, canSetupCustomer } from '@/lib/mobile/customer-setup';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

const reminderSchema = z.object({
  title: z.string().trim().min(1),
  category: z.nativeEnum(WellnessReminderCategory).optional(),
  notes: z.string().trim().max(500).optional().nullable(),
  dogId: z.string().trim().optional().nullable(),
  nextDueAt: z.string().datetime().optional(),
  frequencyDays: z.number().int().min(1).max(365).optional().nullable(),
});

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

  const searchParams = request.nextUrl.searchParams;
  const includeInactive = searchParams.get('includeInactive') === 'true';

  const reminders = await prisma.customerWellnessReminder.findMany({
    where: {
      customerId: customer.id,
      ...(includeInactive ? {} : { active: true }),
    },
    orderBy: { nextDueAt: 'asc' },
    include: {
      dog: { select: { name: true } },
    },
  });

  return NextResponse.json({
    ok: true,
    data: {
      reminders: reminders.map((reminder) => ({
        id: reminder.id,
        dogId: reminder.dogId,
        dogName: reminder.dog?.name ?? null,
        title: reminder.title,
        category: reminder.category,
        notes: reminder.notes,
        nextDueAt: reminder.nextDueAt.toISOString(),
        frequencyDays: reminder.frequencyDays,
        active: reminder.active,
        lastCompletedAt: reminder.lastCompletedAt?.toISOString() ?? null,
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
  const parsed = reminderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid reminder payload', issues: parsed.error.flatten() },
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
      return NextResponse.json(
        { ok: false, error: 'Dog not found' },
        { status: 404 },
      );
    }
  }

  const nextDueAt = parsed.data.nextDueAt
    ? new Date(parsed.data.nextDueAt)
    : (() => {
        const date = new Date();
        date.setDate(date.getDate() + 7);
        return date;
      })();

  const reminder = await prisma.customerWellnessReminder.create({
    data: {
      orgId: customer.orgId,
      customerId: customer.id,
      dogId,
      title: parsed.data.title.trim(),
      category: parsed.data.category ?? WellnessReminderCategory.CUSTOM,
      notes: parsed.data.notes ?? null,
      nextDueAt,
      frequencyDays: parsed.data.frequencyDays ?? null,
    },
    include: {
      dog: { select: { name: true } },
    },
  });

  return NextResponse.json({
    ok: true,
    data: {
      reminder: {
        id: reminder.id,
        dogId: reminder.dogId,
        dogName: reminder.dog?.name ?? null,
        title: reminder.title,
        category: reminder.category,
        notes: reminder.notes,
        nextDueAt: reminder.nextDueAt.toISOString(),
        frequencyDays: reminder.frequencyDays,
        active: reminder.active,
        lastCompletedAt: reminder.lastCompletedAt?.toISOString() ?? null,
      },
    },
  });
}
