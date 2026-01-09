import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

import { buildCustomerSetupResponse, canSetupCustomer } from '@/lib/mobile/customer-setup';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { deleteFile } from '@/lib/supabase-admin';
import { env } from '@/lib/env';
import { resolveStorageUrl } from '@/lib/storage';

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

// Helper to handle nullable numbers - z.coerce.number() fails on null
const nullableNumber = (min: number, max: number) =>
  z.preprocess(
    (val) => (val === null || val === undefined ? null : val),
    z.union([z.coerce.number().min(min).max(max), z.null()]),
  );

const updateLocationSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  accuracy: nullableNumber(0, 500).optional(),
  rawLat: nullableNumber(-90, 90).optional(),
  rawLng: nullableNumber(-180, 180).optional(),
  rawAccuracy: nullableNumber(0, 500).optional(),
});

const asRecord = (value: Prisma.JsonValue | null) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const distanceMeters = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ captureId: string }> },
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

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { ok: false, error: 'Missing request body' },
      { status: 400 },
    );
  }
  
  const parsed = updateLocationSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const errorFields = Object.keys(fieldErrors).join(', ');
    console.warn('[wellness-captures] Location validation failed:', {
      body,
      errors: parsed.error.flatten(),
    });
    return NextResponse.json(
      { 
        ok: false, 
        error: `Invalid location data${errorFields ? `: ${errorFields}` : ''}`,
        details: parsed.error.flatten(),
      },
      { status: 422 },
    );
  }

  const { captureId } = await params;
  const capture = await prisma.customerWellnessCapture.findFirst({
    where: { id: captureId, customerId: customer.id },
    select: {
      id: true,
      metadata: true,
      gpsAccuracy: true,
      storagePath: true,
      capturedAt: true,
      analysisStatus: true,
      analysisResult: true,
      analysisConfidence: true,
      analysisModel: true,
      dogId: true,
      suspectedDogIds: true,
      scope: true,
      attribution: true,
      symptomTags: true,
      notes: true,
      consentToShare: true,
    },
  });

  if (!capture) {
    return NextResponse.json({ ok: false, error: 'Capture not found' }, { status: 404 });
  }

  const correctionMeters =
    typeof parsed.data.rawLat === 'number' && typeof parsed.data.rawLng === 'number'
      ? distanceMeters(parsed.data.rawLat, parsed.data.rawLng, parsed.data.lat, parsed.data.lng)
      : null;

  const metadata = asRecord(capture.metadata ?? null);
  const locationCorrection = {
    rawLat: parsed.data.rawLat ?? null,
    rawLng: parsed.data.rawLng ?? null,
    rawAccuracy: parsed.data.rawAccuracy ?? null,
    correctedAt: new Date().toISOString(),
    correctionMeters: correctionMeters !== null ? Math.round(correctionMeters * 10) / 10 : null,
    source: 'manual',
  };

  const nextMetadata: Record<string, unknown> = {
    ...metadata,
    locationCorrection,
  };

  if (Object.prototype.hasOwnProperty.call(parsed.data, 'accuracy')) {
    nextMetadata.locationAccuracy = parsed.data.accuracy;
  }

  const updateData: Prisma.CustomerWellnessCaptureUpdateInput = {
    gpsLat: parsed.data.lat,
    gpsLng: parsed.data.lng,
    metadata: nextMetadata as Prisma.InputJsonValue,
  };

  if (Object.prototype.hasOwnProperty.call(parsed.data, 'accuracy')) {
    updateData.gpsAccuracy = parsed.data.accuracy === null ? null : parsed.data.accuracy;
  } else if (capture.gpsAccuracy !== null) {
    updateData.gpsAccuracy = capture.gpsAccuracy;
  }

  const updated = await prisma.customerWellnessCapture.update({
    where: { id: capture.id },
    data: updateData,
  });

  return NextResponse.json({
    ok: true,
    data: {
      capture: {
        id: updated.id,
        capturedAt: updated.capturedAt.toISOString(),
        analysisStatus: updated.analysisStatus,
        analysisResult: updated.analysisResult,
        analysisConfidence: updated.analysisConfidence,
        analysisModel: updated.analysisModel,
        dogId: updated.dogId,
        suspectedDogIds: updated.suspectedDogIds,
        scope: updated.scope,
        attribution: updated.attribution,
        symptomTags: updated.symptomTags,
        notes: updated.notes,
        gpsLat: updated.gpsLat,
        gpsLng: updated.gpsLng,
        gpsAccuracy: updated.gpsAccuracy,
        consentToShare: updated.consentToShare,
        metadata: updated.metadata,
        imageUrl: await resolveStorageUrl(updated.storagePath),
      },
    },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ captureId: string }> },
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

  const { captureId } = await params;
  const capture = await prisma.customerWellnessCapture.findFirst({
    where: { id: captureId, customerId: customer.id },
    select: { id: true, storagePath: true },
  });

  if (!capture) {
    return NextResponse.json({ ok: false, error: 'Capture not found' }, { status: 404 });
  }

  await prisma.customerWellnessCapture.delete({
    where: { id: capture.id },
  });

  if (capture.storagePath) {
    if (!env.STORAGE_BUCKET) {
      return NextResponse.json(
        { ok: false, error: 'Storage not configured.' },
        { status: 500 },
      );
    }
    try {
      await deleteFile(env.STORAGE_BUCKET, capture.storagePath);
    } catch (error) {
      console.warn('mobile.wellness-capture.delete.storage', { captureId, error });
    }
  }

  return NextResponse.json({ ok: true });
}

export const runtime = 'nodejs';
