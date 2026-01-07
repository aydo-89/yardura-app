import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FoodLogType } from '@prisma/client';

import { buildCustomerSetupResponse, canSetupCustomer } from '@/lib/mobile/customer-setup';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { env } from '@/lib/env';
import { uploadImage } from '@/lib/supabase-admin';
import { resolveStorageUrl } from '@/lib/storage';
import { getCustomerWellnessAccess, incrementWellnessUsage } from '@/lib/wellness/access';

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

function inferExtension(contentType?: string) {
  if (!contentType) return 'jpg';
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('heic')) return 'heic';
  if (contentType.includes('jpeg')) return 'jpg';
  return 'jpg';
}

function formatServerError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function isPrismaError(error: unknown): error is { code?: string; message?: string } {
  return Boolean(error && typeof error === 'object' && 'message' in error);
}

const productSchema = z
  .object({
    type: z.nativeEnum(FoodLogType).optional(),
    dogId: z.string().trim().optional().nullable(),
    brand: z.string().trim().max(120).optional().nullable(),
    productName: z.string().trim().max(200).optional().nullable(),
    ingredients: z.string().trim().max(2000).optional().nullable(),
    portion: z.string().trim().max(120).optional().nullable(),
    notes: z.string().trim().max(500).optional().nullable(),
  })
  .refine((value) => Boolean(value.brand?.trim() || value.productName?.trim()), {
    message: 'Add a product name or brand.',
    path: ['productName'],
  });

type ParsedPayload = {
  data: z.infer<typeof productSchema>;
  image?: File | null;
};

function parsePayload(value: Record<string, unknown>): ParsedPayload {
  const parsed = productSchema.safeParse(value);
  if (!parsed.success) {
    throw parsed.error;
  }
  return { data: parsed.data };
}

async function parseRequestBody(request: NextRequest): Promise<ParsedPayload> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData().catch(() => null);
    if (!formData) {
      throw new Error('Invalid form payload.');
    }
    const normalize = (value: FormDataEntryValue | null) =>
      typeof value === 'string' ? value.trim() : undefined;
    const typeRaw = normalize(formData.get('type'));
    const dogId = normalize(formData.get('dogId'));
    const payload = {
      type: typeRaw && Object.values(FoodLogType).includes(typeRaw as FoodLogType)
        ? (typeRaw as FoodLogType)
        : undefined,
      dogId: dogId && dogId !== 'null' ? dogId : null,
      brand: normalize(formData.get('brand')) || null,
      productName: normalize(formData.get('productName')) || null,
      ingredients: normalize(formData.get('ingredients')) || null,
      portion: normalize(formData.get('portion')) || null,
      notes: normalize(formData.get('notes')) || null,
    };
    const parsed = parsePayload(payload);
    return {
      data: parsed.data,
      image: formData.get('image') instanceof File ? (formData.get('image') as File) : null,
    };
  }

  const json = await request.json().catch(() => null);
  if (!json || typeof json !== 'object') {
    throw new Error('Invalid JSON payload.');
  }
  return parsePayload(json as Record<string, unknown>);
}

export async function GET(request: NextRequest) {
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

  const searchParams = request.nextUrl.searchParams;
  const dogId = searchParams.get('dogId');
  const limitParam = Number(searchParams.get('limit') ?? 30);
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(Math.floor(limitParam), 1), 50)
    : 30;

  const products = await prisma.customerFoodProduct.findMany({
    where: {
      customerId: customer.id,
      ...(dogId ? { dogId } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });

  const hydrated = await Promise.all(
    products.map(async (product) => ({
      id: product.id,
      dogId: product.dogId,
      type: product.type,
      brand: product.brand,
      productName: product.productName,
      ingredients: product.ingredients,
      portion: product.portion,
      notes: product.notes,
      imageUrl: await resolveStorageUrl(product.imagePath),
    })),
  );

  return NextResponse.json({
    ok: true,
    data: { products: hydrated },
  });
  } catch (error) {
    console.error('[mobile.food-products.get] failed', error);
    const message =
      isPrismaError(error) && error.code === 'P2021'
        ? 'Server database is updating. Please try again in a minute.'
        : formatServerError(error, 'Unable to load food products.');
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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
    select: { id: true, orgId: true },
  });

  if (!customer) {
    return canSetup
      ? buildCustomerSetupResponse(userId)
      : NextResponse.json({ ok: false, error: 'Customer access required' }, { status: 403 });
  }

  const access = await getCustomerWellnessAccess({
    customerId: customer.id,
    orgId: customer.orgId,
  });
  if (access.usage.inventoryAddsCount >= access.limits.inventoryAddsPerMonth) {
    return NextResponse.json(
      {
        ok: false,
        error: 'limit_reached',
        message: 'Monthly inventory limit reached.',
        data: { usage: access.usage, limits: access.limits, tier: access.tier },
      },
      { status: 403 },
    );
  }

  let parsed: ParsedPayload;
  try {
    parsed = await parseRequestBody(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid product payload';
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
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

  const product = await prisma.customerFoodProduct.create({
    data: {
      orgId: customer.orgId,
      customerId: customer.id,
      dogId,
      type: parsed.data.type ?? FoodLogType.FOOD,
      brand: parsed.data.brand ?? null,
      productName: parsed.data.productName ?? null,
      ingredients: parsed.data.ingredients ?? null,
      portion: parsed.data.portion ?? null,
      notes: parsed.data.notes ?? null,
    },
  });

  await incrementWellnessUsage({
    customerId: customer.id,
    orgId: customer.orgId,
    inventoryAddsDelta: 1,
  });

  let imagePath: string | null = product.imagePath ?? null;
  if (parsed.image) {
    if (!env.STORAGE_BUCKET) {
      return NextResponse.json(
        { ok: false, error: 'Storage not configured.' },
        { status: 500 },
      );
    }
    const fileBuffer = Buffer.from(await parsed.image.arrayBuffer());
    const extension = inferExtension(parsed.image.type);
    const objectId = randomUUID();
    const storagePath = `wellness/food-products/${customer.orgId}/${customer.id}/${objectId}.${extension}`;
    await uploadImage(env.STORAGE_BUCKET, storagePath, fileBuffer, parsed.image.type);
    const updated = await prisma.customerFoodProduct.update({
      where: { id: product.id },
      data: { imagePath: storagePath },
    });
    imagePath = updated.imagePath ?? null;
  }

  return NextResponse.json({
    ok: true,
    data: {
      product: {
        id: product.id,
        dogId: product.dogId,
        type: product.type,
        brand: product.brand,
        productName: product.productName,
        ingredients: product.ingredients,
        portion: product.portion,
        notes: product.notes,
        imageUrl: await resolveStorageUrl(imagePath),
      },
    },
  });
  } catch (error) {
    console.error('[mobile.food-products.post] failed', error);
    const message =
      isPrismaError(error) && error.code === 'P2021'
        ? 'Server database is updating. Please try again in a minute.'
        : formatServerError(error, 'Unable to save food product.');
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const runtime = 'nodejs';
