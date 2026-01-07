import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { WellnessReminderCategory } from "@prisma/client";

import { authOptions, safeGetServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const reminderSchema = z.object({
  title: z.string().trim().min(1),
  category: z.nativeEnum(WellnessReminderCategory).optional(),
  notes: z.string().trim().max(500).optional().nullable(),
  dogId: z.string().trim().optional().nullable(),
  nextDueAt: z.string().datetime().optional(),
  frequencyDays: z.number().int().min(1).max(365).optional().nullable(),
});

export async function GET(request: NextRequest) {
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

  const searchParams = request.nextUrl.searchParams;
  const includeInactive = searchParams.get("includeInactive") === "true";

  const reminders = await prisma.customerWellnessReminder.findMany({
    where: {
      customerId: customer.id,
      ...(includeInactive ? {} : { active: true }),
    },
    orderBy: { nextDueAt: "asc" },
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
  const session = (await safeGetServerSession(authOptions as any)) as
    | { user?: { email?: string | null } }
    | null;

  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const customer = await prisma.customer.findFirst({
    where: { email: session.user.email },
    select: { id: true, orgId: true, userId: true },
  });

  if (!customer) {
    return NextResponse.json({ ok: false, error: "Customer not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = reminderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid reminder payload", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const dogId = parsed.data.dogId ?? null;
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
