import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { WellnessReminderCategory } from "@prisma/client";

import { authOptions, safeGetServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  const session = (await safeGetServerSession(authOptions as any)) as
    | { user?: { email?: string | null } }
    | null;

  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const customer = await prisma.customer.findFirst({
    where: { email: session.user.email },
    select: { id: true, userId: true },
  });

  if (!customer) {
    return NextResponse.json({ ok: false, error: "Customer not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = reminderUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid reminder update payload", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { reminderId } = await params;
  const reminder = await prisma.customerWellnessReminder.findFirst({
    where: { id: reminderId, customerId: customer.id },
  });

  if (!reminder) {
    return NextResponse.json({ ok: false, error: "Reminder not found" }, { status: 404 });
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
        where: customer.userId
          ? { id: dogId, OR: [{ customerId: customer.id }, { userId: customer.userId }] }
          : { id: dogId, customerId: customer.id },
        select: { id: true, customerId: true },
      });
      if (!dog) {
        return NextResponse.json({ ok: false, error: "Dog not found" }, { status: 404 });
      }
      if (!dog.customerId) {
        await prisma.dog.update({
          where: { id: dogId },
          data: { customerId: customer.id },
        });
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
  _request: NextRequest,
  { params }: { params: Promise<{ reminderId: string }> },
) {
  const session = (await safeGetServerSession(authOptions as any)) as
    | { user?: { email?: string | null } }
    | null;

  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const customer = await prisma.customer.findFirst({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!customer) {
    return NextResponse.json({ ok: false, error: "Customer not found" }, { status: 404 });
  }

  const { reminderId } = await params;
  const reminder = await prisma.customerWellnessReminder.findFirst({
    where: { id: reminderId, customerId: customer.id },
    select: { id: true },
  });

  if (!reminder) {
    return NextResponse.json({ ok: false, error: "Reminder not found" }, { status: 404 });
  }

  await prisma.customerWellnessReminder.delete({
    where: { id: reminder.id },
  });

  return NextResponse.json({ ok: true });
}
