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

const updateSchema = z.object({
  type: z.nativeEnum(FoodLogType).optional(),
  dogId: z.string().trim().optional().nullable(),
  brand: z.string().trim().max(120).optional().nullable(),
  productName: z.string().trim().max(200).optional().nullable(),
  ingredients: z.string().trim().max(2000).optional().nullable(),
  portion: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

type ParsedPayload = {
  data: z.infer<typeof updateSchema>;
  image?: File | null;
};

function parsePayload(value: Record<string, unknown>): ParsedPayload {
  const parsed = updateSchema.safeParse(value);
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
    const normalizeOptional = (value: FormDataEntryValue | null) => {
      const cleaned = normalize(value);
      return cleaned === undefined || cleaned === '' ? null : cleaned;
    };
    const typeRaw = normalize(formData.get('type'));
    const dogId = normalize(formData.get('dogId'));
    const payload = {
      type: typeRaw && Object.values(FoodLogType).includes(typeRaw as FoodLogType)
        ? (typeRaw as FoodLogType)
        : undefined,
      dogId: dogId ? (dogId === 'null' ? null : dogId) : undefined,
      brand: normalizeOptional(formData.get('brand')),
      productName: normalizeOptional(formData.get('productName')),
      ingredients: normalizeOptional(formData.get('ingredients')),
      portion: normalizeOptional(formData.get('portion')),
      notes: normalizeOptional(formData.get('notes')),
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
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

    const { productId } = await params;
    const existing = await prisma.customerFoodProduct.findFirst({
      where: { id: productId, customerId: customer.id },
    });

    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Food product not found' }, { status: 404 });
    }

    let parsed: ParsedPayload;
    try {
      parsed = await parseRequestBody(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid product payload';
      return NextResponse.json({ ok: false, error: message }, { status: 422 });
    }

    const dogId = parsed.data.dogId !== undefined ? parsed.data.dogId ?? null : existing.dogId;
    if (dogId) {
      const dog = await prisma.dog.findFirst({
        where: { id: dogId, customerId: customer.id },
        select: { id: true },
      });
      if (!dog) {
        return NextResponse.json({ ok: false, error: 'Dog not found' }, { status: 404 });
      }
    }

    const updateData = {
      type: parsed.data.type ?? existing.type,
      dogId,
      brand: parsed.data.brand !== undefined ? parsed.data.brand ?? null : existing.brand,
      productName:
        parsed.data.productName !== undefined
          ? parsed.data.productName ?? null
          : existing.productName,
      ingredients:
        parsed.data.ingredients !== undefined
          ? parsed.data.ingredients ?? null
          : existing.ingredients,
      portion:
        parsed.data.portion !== undefined ? parsed.data.portion ?? null : existing.portion,
      notes: parsed.data.notes !== undefined ? parsed.data.notes ?? null : existing.notes,
    };

    if (!updateData.brand?.trim() && !updateData.productName?.trim()) {
      return NextResponse.json(
        { ok: false, error: 'Add a product name or brand.' },
        { status: 422 },
      );
    }

    const updated = await prisma.customerFoodProduct.update({
      where: { id: existing.id },
      data: updateData,
    });

    let imagePath = updated.imagePath ?? null;
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
      const withImage = await prisma.customerFoodProduct.update({
        where: { id: updated.id },
        data: { imagePath: storagePath },
      });
      imagePath = withImage.imagePath ?? null;
    }

    return NextResponse.json({
      ok: true,
      data: {
        product: {
          id: updated.id,
          dogId: updated.dogId,
          type: updated.type,
          brand: updated.brand,
          productName: updated.productName,
          ingredients: updated.ingredients,
          portion: updated.portion,
          notes: updated.notes,
          imageUrl: await resolveStorageUrl(imagePath),
        },
      },
    });
  } catch (error) {
    console.error('[mobile.food-products.patch] failed', error);
    const message =
      isPrismaError(error) && error.code === 'P2021'
        ? 'Server database is updating. Please try again in a minute.'
        : formatServerError(error, 'Unable to update food product.');
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
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

    const { productId } = await params;
    const product = await prisma.customerFoodProduct.findFirst({
      where: { id: productId, customerId: customer.id },
      select: { id: true },
    });

    if (!product) {
      return NextResponse.json({ ok: false, error: 'Food product not found' }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.customerFoodSchedule.deleteMany({
        where: { productId: product.id, customerId: customer.id },
      }),
      prisma.customerFoodLog.updateMany({
        where: { productId: product.id, customerId: customer.id },
        data: { productId: null },
      }),
      prisma.customerFoodProduct.delete({
        where: { id: product.id },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[mobile.food-products.delete] failed', error);
    const message =
      isPrismaError(error) && error.code === 'P2021'
        ? 'Server database is updating. Please try again in a minute.'
        : formatServerError(error, 'Unable to delete food product.');
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const runtime = 'nodejs';
