import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { WellnessDailyLevel } from "@prisma/client";

import { authOptions, safeGetServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWeekWindow } from "@/lib/wellness/reports";

const dailyCheckInSchema = z
  .object({
    dogId: z.string().trim().optional().nullable(),
    suspectedDogIds: z.array(z.string()).optional(),
    loggedAt: z.string().datetime().optional(),
    appetite: z.nativeEnum(WellnessDailyLevel).optional().nullable(),
    energy: z.nativeEnum(WellnessDailyLevel).optional().nullable(),
    waterIntake: z.nativeEnum(WellnessDailyLevel).optional().nullable(),
    stoolFrequency: z.number().int().min(0).max(10).optional().nullable(),
    vomiting: z.boolean().optional(),
    diarrhea: z.boolean().optional(),
    medsGiven: z.boolean().optional(),
    medsNotes: z.string().trim().max(500).optional().nullable(),
    notes: z.string().trim().max(1000).optional().nullable(),
  })
  .refine(
    (data) =>
      data.appetite !== undefined ||
      data.energy !== undefined ||
      data.waterIntake !== undefined ||
      data.stoolFrequency !== undefined ||
      data.vomiting !== undefined ||
      data.diarrhea !== undefined ||
      data.medsGiven !== undefined ||
      Boolean(data.medsNotes?.trim()) ||
      Boolean(data.notes?.trim()),
    { message: "At least one check-in field is required." },
  );

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
  const limitParam = Number(searchParams.get("limit") ?? 14);
  const daysParam = Number(searchParams.get("days") ?? 0);
  const dogIdFilter = searchParams.get("dogId");
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(Math.floor(limitParam), 1), 30)
    : 14;

  const where: Record<string, unknown> = {
    customerId: customer.id,
  };

  if (dogIdFilter) {
    where.OR = [
      { dogId: dogIdFilter },
      { suspectedDogIds: { has: dogIdFilter } },
    ];
  }

  if (Number.isFinite(daysParam) && daysParam > 0) {
    const since = new Date();
    since.setDate(since.getDate() - Math.min(daysParam, 30));
    where.loggedAt = { gte: since };
  }

  const entries = await prisma.customerWellnessDailyCheckIn.findMany({
    where,
    orderBy: { loggedAt: "desc" },
    take: limit,
    include: {
      dog: { select: { name: true } },
    },
  });

  return NextResponse.json({
    ok: true,
    data: {
      entries: entries.map((entry) => ({
        id: entry.id,
        dogId: entry.dogId,
        dogName: entry.dog?.name ?? null,
        suspectedDogIds: entry.suspectedDogIds,
        loggedAt: entry.loggedAt.toISOString(),
        appetite: entry.appetite,
        energy: entry.energy,
        waterIntake: entry.waterIntake,
        stoolFrequency: entry.stoolFrequency,
        vomiting: entry.vomiting,
        diarrhea: entry.diarrhea,
        medsGiven: entry.medsGiven,
        medsNotes: entry.medsNotes,
        notes: entry.notes,
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
  const parsed = dailyCheckInSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid daily check-in payload", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const dogId = parsed.data.dogId ?? null;
  const suspectedDogIds = parsed.data.suspectedDogIds ?? [];
  const candidateDogIds = [dogId, ...suspectedDogIds].filter(Boolean) as string[];
  let validDogIds: string[] = [];

  if (candidateDogIds.length) {
    const dogs = await prisma.dog.findMany({
      where: customer.userId
        ? { id: { in: candidateDogIds }, OR: [{ customerId: customer.id }, { userId: customer.userId }] }
        : { id: { in: candidateDogIds }, customerId: customer.id },
      select: { id: true, customerId: true },
    });
    validDogIds = dogs.map((dog) => dog.id);
    const unlinked = dogs.filter((dog) => !dog.customerId).map((dog) => dog.id);
    if (unlinked.length) {
      await prisma.dog.updateMany({
        where: { id: { in: unlinked } },
        data: { customerId: customer.id },
      });
    }
  }

  const finalDogId = dogId && validDogIds.includes(dogId) ? dogId : null;
  const finalSuspectedDogIds = suspectedDogIds.filter(
    (id) => id !== finalDogId && validDogIds.includes(id),
  );

  const loggedAt = parsed.data.loggedAt ? new Date(parsed.data.loggedAt) : new Date();

  const entry = await prisma.customerWellnessDailyCheckIn.create({
    data: {
      orgId: customer.orgId,
      customerId: customer.id,
      dogId: finalDogId,
      suspectedDogIds: finalSuspectedDogIds,
      loggedAt,
      appetite: parsed.data.appetite ?? null,
      energy: parsed.data.energy ?? null,
      waterIntake: parsed.data.waterIntake ?? null,
      stoolFrequency: parsed.data.stoolFrequency ?? null,
      vomiting: parsed.data.vomiting ?? false,
      diarrhea: parsed.data.diarrhea ?? false,
      medsGiven: parsed.data.medsGiven ?? false,
      medsNotes: parsed.data.medsNotes ?? null,
      notes: parsed.data.notes ?? null,
    },
    include: {
      dog: { select: { name: true } },
    },
  });

  const { weekStart } = getWeekWindow(loggedAt);
  const reportWhere =
    finalDogId
      ? {
          customerId: customer.id,
          dogId: finalDogId,
          scope: "DOG" as const,
          weekStart,
        }
      : {
          customerId: customer.id,
          scope: "HOUSEHOLD" as const,
          weekStart,
        };

  const weeklyReport = await prisma.weeklyWellnessReport.findFirst({
    where: reportWhere,
    select: { id: true },
  });

  if (weeklyReport) {
    await prisma.weeklyWellnessReportDailyCheckIn.create({
      data: {
        reportId: weeklyReport.id,
        checkInId: entry.id,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    data: {
      entry: {
        id: entry.id,
        dogId: entry.dogId,
        dogName: entry.dog?.name ?? null,
        suspectedDogIds: entry.suspectedDogIds,
        loggedAt: entry.loggedAt.toISOString(),
        appetite: entry.appetite,
        energy: entry.energy,
        waterIntake: entry.waterIntake,
        stoolFrequency: entry.stoolFrequency,
        vomiting: entry.vomiting,
        diarrhea: entry.diarrhea,
        medsGiven: entry.medsGiven,
        medsNotes: entry.medsNotes,
        notes: entry.notes,
      },
    },
  });
}
