import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authOptions, safeGetServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const weightSchema = z.object({
  dogId: z.string().min(1),
  weightLbs: z.number().min(1).max(300),
  recordedAt: z.string().datetime().optional(),
  notes: z.string().trim().max(300).optional().nullable(),
  source: z.string().trim().max(50).optional().nullable(),
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
    select: { id: true },
  });

  if (!customer) {
    return NextResponse.json({ ok: false, error: "Customer not found" }, { status: 404 });
  }

  const searchParams = request.nextUrl.searchParams;
  const dogId = searchParams.get("dogId");
  const limitParam = Number(searchParams.get("limit") ?? 60);
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(Math.floor(limitParam), 1), 200)
    : 60;

  const entries = await prisma.dogWeightEntry.findMany({
    where: {
      customerId: customer.id,
      ...(dogId ? { dogId } : {}),
    },
    orderBy: { recordedAt: "desc" },
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
        weightLbs: entry.weightLbs,
        recordedAt: entry.recordedAt.toISOString(),
        notes: entry.notes,
        source: entry.source,
      })),
    },
  });
}

export async function POST(request: NextRequest) {
  const session = (await safeGetServerSession(authOptions as any)) as
    | { user?: { email?: string | null; id?: string | null } }
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
  const parsed = weightSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid weight payload", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const dogId = parsed.data.dogId.trim();
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

  const recordedAt = parsed.data.recordedAt
    ? new Date(parsed.data.recordedAt)
    : new Date();

  const [entry, updatedDog] = await prisma.$transaction([
    prisma.dogWeightEntry.create({
      data: {
        orgId: customer.orgId,
        customerId: customer.id,
        dogId,
        weightLbs: parsed.data.weightLbs,
        recordedAt,
        notes: parsed.data.notes ?? null,
        source: parsed.data.source ?? "OWNER_LOG",
      },
      include: { dog: { select: { name: true } } },
    }),
    prisma.dog.update({
      where: { id: dogId },
      data: { weight: parsed.data.weightLbs },
      select: { id: true, weight: true },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      entry: {
        id: entry.id,
        dogId: entry.dogId,
        dogName: entry.dog?.name ?? null,
        weightLbs: entry.weightLbs,
        recordedAt: entry.recordedAt.toISOString(),
        notes: entry.notes,
        source: entry.source,
      },
      dog: updatedDog,
    },
  });
}
