import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FoodLogType } from "@prisma/client";

import { authOptions, safeGetServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { detectAllergens } from "@/lib/wellness/allergen-scan";

const foodLogSchema = z.object({
  type: z.nativeEnum(FoodLogType).optional(),
  dogId: z.string().trim().optional().nullable(),
  brand: z.string().trim().max(120).optional().nullable(),
  productName: z.string().trim().max(200).optional().nullable(),
  ingredients: z.string().trim().max(2000).optional().nullable(),
  portion: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  loggedAt: z.string().datetime().optional(),
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
  const limitParam = Number(searchParams.get("limit") ?? 20);
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(Math.floor(limitParam), 1), 50)
    : 20;
  const dogId = searchParams.get("dogId");

  const logs = await prisma.customerFoodLog.findMany({
    where: {
      customerId: customer.id,
      ...(dogId ? { dogId } : {}),
    },
    orderBy: { loggedAt: "desc" },
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
  const parsed = foodLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid food log payload", issues: parsed.error.flatten() },
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

  const loggedAt = parsed.data.loggedAt ? new Date(parsed.data.loggedAt) : new Date();
  const allergens = detectAllergens(parsed.data.ingredients ?? "");

  const log = await prisma.customerFoodLog.create({
    data: {
      orgId: customer.orgId,
      customerId: customer.id,
      dogId,
      loggedAt,
      type: parsed.data.type ?? FoodLogType.FOOD,
      brand: parsed.data.brand ?? null,
      productName: parsed.data.productName ?? null,
      ingredients: parsed.data.ingredients ?? null,
      portion: parsed.data.portion ?? null,
      notes: parsed.data.notes ?? null,
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
