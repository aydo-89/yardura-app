import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { buildCustomerSetupResponse, canSetupCustomer } from '@/lib/mobile/customer-setup';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { resolveStorageUrl } from '@/lib/storage';
import { getCustomerWellnessAccess } from '@/lib/wellness/access';

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

export async function GET(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  let payload: ReturnType<typeof verifyMobileToken>;
  try {
    payload = verifyMobileToken(token);
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid token' },
      { status: 401 },
    );
  }

  const userId = payload.sub;
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: 'Customer access required' },
      { status: 403 },
    );
  }
  const canSetup = canSetupCustomer(payload.roles);

  const customer = await prisma.customer.findFirst({
    where: { userId },
    select: { id: true, orgId: true },
  });

  if (!customer) {
    return canSetup
      ? buildCustomerSetupResponse(userId)
      : NextResponse.json(
          { ok: false, error: 'Customer access required' },
          { status: 403 },
        );
  }

  const dogs = await prisma.dog.findMany({
    where: {
      OR: [{ customerId: customer.id }, { userId }],
    },
    select: {
      id: true,
      name: true,
      breed: true,
      age: true,
      weight: true,
      allergies: true,
      medications: true,
      dietNotes: true,
      vetName: true,
      vetPhone: true,
      vetClinic: true,
      insuranceProvider: true,
      insurancePolicyNumber: true,
      insurancePhone: true,
      customerId: true,
      photoUrl: true,
    },
    orderBy: { name: 'asc' },
  });

  const unlinkedDogIds = dogs
    .filter((dog) => !dog.customerId)
    .map((dog) => dog.id);

  if (unlinkedDogIds.length) {
    await prisma.dog.updateMany({
      where: { id: { in: unlinkedDogIds } },
      data: { customerId: customer.id },
    });
  }

  const dogsWithPhotos = await Promise.all(
    dogs.map(async ({ customerId: _customerId, photoUrl, ...dog }) => ({
      ...dog,
      photoUrl: await resolveStorageUrl(photoUrl),
    })),
  );

  return NextResponse.json({
    ok: true,
    data: {
      dogs: dogsWithPhotos,
    },
  });
}

const dogSchema = z.object({
  name: z.string().min(1),
  breed: z.string().trim().min(1).nullable().optional(),
  age: z.number().int().min(0).max(40).nullable().optional(),
  weight: z.number().nullable().optional(),
  allergies: z.string().trim().max(300).nullable().optional(),
  medications: z.string().trim().max(300).nullable().optional(),
  dietNotes: z.string().trim().max(500).nullable().optional(),
  vetName: z.string().trim().max(200).nullable().optional(),
  vetPhone: z.string().trim().max(50).nullable().optional(),
  vetClinic: z.string().trim().max(200).nullable().optional(),
  insuranceProvider: z.string().trim().max(200).nullable().optional(),
  insurancePolicyNumber: z.string().trim().max(100).nullable().optional(),
  insurancePhone: z.string().trim().max(50).nullable().optional(),
});

export async function POST(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  let payload: ReturnType<typeof verifyMobileToken>;
  try {
    payload = verifyMobileToken(token);
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid token' },
      { status: 401 },
    );
  }

  const userId = payload.sub;
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: 'Customer access required' },
      { status: 403 },
    );
  }
  const canSetup = canSetupCustomer(payload.roles);

  const customer = await prisma.customer.findFirst({
    where: { userId },
    select: { id: true, orgId: true },
  });

  if (!customer) {
    return canSetup
      ? buildCustomerSetupResponse(userId)
      : NextResponse.json(
          { ok: false, error: 'Customer access required' },
          { status: 403 },
        );
  }

  const body = await request.json().catch(() => null);
  const parsed = dogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid dog payload', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const access = await getCustomerWellnessAccess({
    customerId: customer.id,
    orgId: customer.orgId,
  });
  const maxDogs = access.tier === 'PREMIUM' ? null : 1;
  const existingDogCount = await prisma.dog.count({
    where: { customerId: customer.id },
  });
  if (maxDogs !== null && existingDogCount >= maxDogs) {
    return NextResponse.json(
      {
        ok: false,
        error: 'limit_reached',
        message: 'Upgrade to add more dogs.',
        data: { maxDogs, tier: access.tier },
      },
      { status: 403 },
    );
  }

  const dog = await prisma.dog.create({
    data: {
      name: parsed.data.name.trim(),
      breed: parsed.data.breed ?? null,
      age: parsed.data.age ?? null,
      weight: typeof parsed.data.weight === 'number' ? parsed.data.weight : null,
      allergies: parsed.data.allergies ?? null,
      medications: parsed.data.medications ?? null,
      dietNotes: parsed.data.dietNotes ?? null,
      vetName: parsed.data.vetName ?? null,
      vetPhone: parsed.data.vetPhone ?? null,
      vetClinic: parsed.data.vetClinic ?? null,
      insuranceProvider: parsed.data.insuranceProvider ?? null,
      insurancePolicyNumber: parsed.data.insurancePolicyNumber ?? null,
      insurancePhone: parsed.data.insurancePhone ?? null,
      userId,
      customerId: customer.id,
    },
    select: {
      id: true,
      name: true,
      breed: true,
      age: true,
      weight: true,
      allergies: true,
      medications: true,
      dietNotes: true,
      vetName: true,
      vetPhone: true,
      vetClinic: true,
      insuranceProvider: true,
      insurancePolicyNumber: true,
      insurancePhone: true,
      photoUrl: true,
    },
  });

  return NextResponse.json({
    ok: true,
    data: {
      dog: { ...dog, photoUrl: await resolveStorageUrl(dog.photoUrl) },
    },
  });
}

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).optional(),
  breed: z.string().trim().min(1).nullable().optional(),
  age: z.number().int().min(0).max(40).nullable().optional(),
  weight: z.number().nullable().optional(),
  allergies: z.string().trim().max(300).nullable().optional(),
  medications: z.string().trim().max(300).nullable().optional(),
  dietNotes: z.string().trim().max(500).nullable().optional(),
  vetName: z.string().trim().max(200).nullable().optional(),
  vetPhone: z.string().trim().max(50).nullable().optional(),
  vetClinic: z.string().trim().max(200).nullable().optional(),
  insuranceProvider: z.string().trim().max(200).nullable().optional(),
  insurancePolicyNumber: z.string().trim().max(100).nullable().optional(),
  insurancePhone: z.string().trim().max(50).nullable().optional(),
});

export async function PATCH(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  let payload: ReturnType<typeof verifyMobileToken>;
  try {
    payload = verifyMobileToken(token);
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid token' },
      { status: 401 },
    );
  }

  const userId = payload.sub;
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: 'Customer access required' },
      { status: 403 },
    );
  }
  const canSetup = canSetupCustomer(payload.roles);

  const customer = await prisma.customer.findFirst({
    where: { userId },
    select: { id: true },
  });

  if (!customer) {
    return canSetup
      ? buildCustomerSetupResponse(userId)
      : NextResponse.json(
          { ok: false, error: 'Customer access required' },
          { status: 403 },
        );
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid dog payload', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const existing = await prisma.dog.findFirst({
    where: { id: parsed.data.id, userId },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ ok: false, error: 'Dog not found' }, { status: 404 });
  }

  const updated = await prisma.dog.update({
    where: { id: existing.id },
    data: {
      name: parsed.data.name,
      breed: parsed.data.breed,
      age: parsed.data.age,
      weight: typeof parsed.data.weight === 'number' ? parsed.data.weight : null,
      allergies: parsed.data.allergies ?? undefined,
      medications: parsed.data.medications ?? undefined,
      dietNotes: parsed.data.dietNotes ?? undefined,
      vetName: parsed.data.vetName ?? undefined,
      vetPhone: parsed.data.vetPhone ?? undefined,
      vetClinic: parsed.data.vetClinic ?? undefined,
      insuranceProvider: parsed.data.insuranceProvider ?? undefined,
      insurancePolicyNumber: parsed.data.insurancePolicyNumber ?? undefined,
      insurancePhone: parsed.data.insurancePhone ?? undefined,
      customerId: customer.id,
    },
    select: {
      id: true,
      name: true,
      breed: true,
      age: true,
      weight: true,
      allergies: true,
      medications: true,
      dietNotes: true,
      vetName: true,
      vetPhone: true,
      vetClinic: true,
      insuranceProvider: true,
      insurancePolicyNumber: true,
      insurancePhone: true,
      photoUrl: true,
    },
  });

  return NextResponse.json({
    ok: true,
    data: {
      dog: { ...updated, photoUrl: await resolveStorageUrl(updated.photoUrl) },
    },
  });
}

export async function DELETE(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  let payload: ReturnType<typeof verifyMobileToken>;
  try {
    payload = verifyMobileToken(token);
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid token' },
      { status: 401 },
    );
  }

  const userId = payload.sub;
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: 'Customer access required' },
      { status: 403 },
    );
  }
  const canSetup = canSetupCustomer(payload.roles);

  const customer = await prisma.customer.findFirst({
    where: { userId },
    select: { id: true },
  });

  if (!customer) {
    return canSetup
      ? buildCustomerSetupResponse(userId)
      : NextResponse.json(
          { ok: false, error: 'Customer access required' },
          { status: 403 },
        );
  }

  const { searchParams } = new URL(request.url);
  const dogId = searchParams.get('id');
  if (!dogId) {
    return NextResponse.json({ ok: false, error: 'Dog ID is required' }, { status: 400 });
  }

  const existing = await prisma.dog.findFirst({
    where: { id: dogId, userId },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ ok: false, error: 'Dog not found' }, { status: 404 });
  }

  await prisma.dog.delete({ where: { id: existing.id } });

  return NextResponse.json({ ok: true });
}
