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

const reminderUpdateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  category: z.nativeEnum(WellnessReminderCategory).optional(),
  notes: z.string().trim().max(500).optional().nullable(),
  dogId: z.string().trim().optional().nullable(),
  nextDueAt: z.string().datetime().optional(),
  frequencyDays: z.number().int().min(1).max(365).optional().nullable(),
  active: z.boolean().optional(),
  markComplete: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ reminderId: string }> },
) {
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
  const parsed = reminderUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid reminder update payload', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { reminderId } = await params;
  const reminder = await prisma.customerWellnessReminder.findFirst({
    where: { id: reminderId, customerId: customer.id },
  });

  if (!reminder) {
    return NextResponse.json({ ok: false, error: 'Reminder not found' }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  if (parsed.data.title) updateData.title = parsed.data.title.trim();
  if (parsed.data.category) updateData.category = parsed.data.category;
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes ?? null;
  if (parsed.data.nextDueAt) updateData.nextDueAt = new Date(parsed.data.nextDueAt);
  if (parsed.data.frequencyDays !== undefined) {
    updateData.frequencyDays = parsed.data.frequencyDays ?? null;
  }
  if (parsed.data.active !== undefined) updateData.active = parsed.data.active;

  if (parsed.data.dogId !== undefined) {
    const dogId = parsed.data.dogId;
    if (dogId) {
      const dog = await prisma.dog.findFirst({
        where: { id: dogId, customerId: customer.id },
        select: { id: true },
      });
      if (!dog) {
        return NextResponse.json({ ok: false, error: 'Dog not found' }, { status: 404 });
      }
      updateData.dogId = dogId;
    } else {
      updateData.dogId = null;
    }
  }

  if (parsed.data.markComplete) {
    const now = new Date();
    updateData.lastCompletedAt = now;
    const frequencyDays =
      parsed.data.frequencyDays ?? reminder.frequencyDays ?? null;
    if (frequencyDays) {
      const nextDueAt = new Date(now);
      nextDueAt.setDate(nextDueAt.getDate() + frequencyDays);
      updateData.nextDueAt = nextDueAt;
      updateData.active = true;
    } else {
      updateData.active = false;
    }
  }

  const updated = await prisma.customerWellnessReminder.update({
    where: { id: reminder.id },
    data: updateData,
    include: { dog: { select: { name: true } } },
  });

  return NextResponse.json({
    ok: true,
    data: {
      reminder: {
        id: updated.id,
        dogId: updated.dogId,
        dogName: updated.dog?.name ?? null,
        title: updated.title,
        category: updated.category,
        notes: updated.notes,
        nextDueAt: updated.nextDueAt.toISOString(),
        frequencyDays: updated.frequencyDays,
        active: updated.active,
        lastCompletedAt: updated.lastCompletedAt?.toISOString() ?? null,
      },
    },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ reminderId: string }> },
) {
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

  const { reminderId } = await params;
  const reminder = await prisma.customerWellnessReminder.findFirst({
    where: { id: reminderId, customerId: customer.id },
    select: { id: true },
  });

  if (!reminder) {
    return NextResponse.json({ ok: false, error: 'Reminder not found' }, { status: 404 });
  }

  await prisma.customerWellnessReminder.delete({
    where: { id: reminder.id },
  });

  return NextResponse.json({ ok: true });
}
