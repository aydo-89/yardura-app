import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { buildCustomerSetupResponse, canSetupCustomer } from '@/lib/mobile/customer-setup';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { env } from '@/lib/env';
import { uploadImage, createSignedUrl } from '@/lib/supabase-admin';
import { resolveStorageUrl } from '@/lib/storage';
import { analyzeOwnerCapture } from '@/lib/wellness/owner-analysis';
import { getCustomerWellnessAccess, incrementWellnessUsage } from '@/lib/wellness/access';
import { fetchWeatherSnapshot } from '@/lib/weather/snapshot';
import { MediaAnalysisStatus, Prisma } from '@prisma/client';
import {
  WELLNESS_ATTRIBUTION,
  WELLNESS_REPORT_SCOPE,
  WELLNESS_SYMPTOMS,
} from '@/lib/wellness/reports';
import { snapToParcel, isCaptureAtHome, type SnapResult } from '@/lib/geo/parcelSnap';

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
  if (contentType.includes('gif')) return 'gif';
  if (contentType.includes('jpeg')) return 'jpg';
  return 'jpg';
}

async function resolveCustomer(token: string) {
  let payload: ReturnType<typeof verifyMobileToken>;
  try {
    payload = verifyMobileToken(token);
  } catch {
    return { response: NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 401 }) };
  }

  const userId = payload.sub;
  if (!userId) {
    return {
      response: NextResponse.json({ ok: false, error: 'Customer access required' }, { status: 403 }),
    };
  }

  const canSetup = canSetupCustomer(payload.roles);
  const customer = await prisma.customer.findFirst({
    where: { userId },
    select: {
      id: true,
      orgId: true,
      shareWellnessCaptures: true,
      autoBlurWellnessPhotos: true,
      latitude: true,
      longitude: true,
    },
  });

  if (!customer) {
    return {
      response: canSetup
        ? buildCustomerSetupResponse(userId)
        : NextResponse.json({ ok: false, error: 'Customer access required' }, { status: 403 }),
    };
  }

  return { payload, customer, userId };
}

export async function GET(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const resolved = await resolveCustomer(token);
  if ('response' in resolved) return resolved.response;

  const { customer } = resolved;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 50);

  const captures = await prisma.customerWellnessCapture.findMany({
    where: { customerId: customer.id },
    orderBy: { capturedAt: 'desc' },
    take: Number.isNaN(limit) ? 20 : limit,
  });

  const capturesWithUrls = await Promise.all(
    captures.map(async (capture) => ({
      id: capture.id,
      capturedAt: capture.capturedAt.toISOString(),
      analysisStatus: capture.analysisStatus,
      analysisResult: capture.analysisResult,
      analysisConfidence: capture.analysisConfidence,
      analysisModel: capture.analysisModel,
      dogId: capture.dogId,
      suspectedDogIds: capture.suspectedDogIds,
      scope: capture.scope,
      attribution: capture.attribution,
      symptomTags: capture.symptomTags,
      notes: capture.notes,
      gpsLat: capture.gpsLat,
      gpsLng: capture.gpsLng,
      gpsAccuracy: capture.gpsAccuracy,
      consentToShare: capture.consentToShare,
      metadata: capture.metadata,
      imageUrl: await resolveStorageUrl(capture.storagePath),
    })),
  );

  return NextResponse.json({ ok: true, data: { captures: capturesWithUrls } });
}

export async function POST(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const resolved = await resolveCustomer(token);
  if ('response' in resolved) return resolved.response;

  const { customer, userId } = resolved;

  const access = await getCustomerWellnessAccess({
    customerId: customer.id,
    orgId: customer.orgId,
  });
  if (access.usage.scansCount >= access.limits.scansPerMonth) {
    return NextResponse.json(
      {
        ok: false,
        error: 'limit_reached',
        message: 'Monthly scan limit reached.',
        data: { usage: access.usage, limits: access.limits, tier: access.tier },
      },
      { status: 403 },
    );
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json({ ok: false, error: 'Image upload required.' }, { status: 422 });
  }

  const formData = await request.formData().catch(() => null);
  const fileEntry = formData?.get('image');
  if (!(fileEntry instanceof File)) {
    return NextResponse.json({ ok: false, error: 'Image upload required.' }, { status: 422 });
  }

  const dogIdEntry = formData?.get('dogId');
  const suspectedEntry = formData?.get('suspectedDogIds');
  const scopeEntry = formData?.get('scope');
  const attributionEntry = formData?.get('attribution');
  const symptomEntry = formData?.get('symptomTags');
  const notesEntry = formData?.get('notes');
  const latEntry = formData?.get('lat');
  const lngEntry = formData?.get('lng');
  const accuracyEntry = formData?.get('accuracy');
  const consentEntry = formData?.get('consentToShare');
  const captureContextEntry = formData?.get('captureContext'); // 'home' | 'walk' | undefined

  const dogs = await prisma.dog.findMany({
    where: { OR: [{ customerId: customer.id }, { userId }] },
    select: { id: true, customerId: true },
  });

  const unlinked = dogs.filter((dog) => !dog.customerId).map((dog) => dog.id);
  if (unlinked.length) {
    await prisma.dog.updateMany({
      where: { id: { in: unlinked } },
      data: { customerId: customer.id },
    });
  }

  const allDogIds = dogs.map((dog) => dog.id);
  let resolvedDogId: string | null = null;
  let resolvedSuspectedDogIds: string[] = [];

  if (typeof dogIdEntry === 'string' && dogIdEntry.trim()) {
    const match = allDogIds.find((id) => id === dogIdEntry.trim());
    if (!match) {
      return NextResponse.json({ ok: false, error: 'Dog not found.' }, { status: 404 });
    }
    resolvedDogId = match;
  }

  if (!resolvedDogId && typeof suspectedEntry === 'string' && suspectedEntry.trim()) {
    try {
      const parsed = JSON.parse(suspectedEntry);
      if (Array.isArray(parsed)) {
        resolvedSuspectedDogIds = parsed.filter((id) => typeof id === 'string');
      }
    } catch {
      resolvedSuspectedDogIds = suspectedEntry
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
    }
  }

  if (!resolvedDogId && resolvedSuspectedDogIds.length > 0) {
    const invalid = resolvedSuspectedDogIds.some((id) => !allDogIds.includes(id));
    if (invalid) {
      return NextResponse.json({ ok: false, error: 'Unknown dog in suspected list.' }, { status: 422 });
    }
  }

  if (!resolvedDogId && resolvedSuspectedDogIds.length === 0) {
    if (allDogIds.length === 1) {
      resolvedDogId = allDogIds[0];
    } else if (allDogIds.length > 1) {
      resolvedSuspectedDogIds = allDogIds;
    }
  }

  const parsedScope =
    typeof scopeEntry === 'string' && WELLNESS_REPORT_SCOPE.includes(scopeEntry as any)
      ? (scopeEntry as (typeof WELLNESS_REPORT_SCOPE)[number])
      : null;
  const resolvedScope =
    parsedScope ?? (resolvedDogId ? 'DOG' : 'HOUSEHOLD');

  if (resolvedScope === 'DOG' && resolvedSuspectedDogIds.length > 0) {
    return NextResponse.json(
      { ok: false, error: 'suspectedDogIds is only allowed for household captures.' },
      { status: 422 },
    );
  }

  const parsedAttribution =
    typeof attributionEntry === 'string' &&
    WELLNESS_ATTRIBUTION.includes(attributionEntry as any)
      ? (attributionEntry as (typeof WELLNESS_ATTRIBUTION)[number])
      : null;
  const resolvedAttribution =
    resolvedScope === 'HOUSEHOLD' ? 'HOUSEHOLD' : parsedAttribution ?? 'OWNER_CONFIRMED';

  let symptomTags: string[] = [];
  if (typeof symptomEntry === 'string' && symptomEntry.trim()) {
    try {
      const parsed = JSON.parse(symptomEntry);
      if (Array.isArray(parsed)) {
        symptomTags = parsed.filter((value) =>
          WELLNESS_SYMPTOMS.includes(value as any),
        ) as string[];
      }
    } catch {
      symptomTags = symptomEntry
        .split(',')
        .map((value) => value.trim())
        .filter((value) => WELLNESS_SYMPTOMS.includes(value as any));
    }
  }

  const notes =
    typeof notesEntry === 'string' && notesEntry.trim().length
      ? notesEntry.trim().slice(0, 1000)
      : null;

  const parsedLat = typeof latEntry === 'string' ? Number(latEntry) : NaN;
  const parsedLng = typeof lngEntry === 'string' ? Number(lngEntry) : NaN;
  let gpsLat = Number.isFinite(parsedLat) ? parsedLat : null;
  let gpsLng = Number.isFinite(parsedLng) ? parsedLng : null;
  if (gpsLat === null || gpsLng === null) {
    gpsLat = null;
    gpsLng = null;
  }
  const accuracy =
    typeof accuracyEntry === 'string' ? Number(accuracyEntry) : NaN;
  const locationAccuracy = Number.isFinite(accuracy) ? accuracy : null;
  const hasCustomerLocation =
    typeof customer.latitude === 'number' && typeof customer.longitude === 'number';
  if (!hasCustomerLocation && gpsLat !== null && gpsLng !== null) {
    await prisma.customer.update({
      where: { id: customer.id },
      data: { latitude: gpsLat, longitude: gpsLng },
    });
  }

  // Determine capture context (home vs walk) and apply parcel snapping for at-home captures
  let snapResult: SnapResult | null = null;
  let captureContext: 'home' | 'walk' | null = null;
  const explicitContext = typeof captureContextEntry === 'string' ? captureContextEntry : null;

  if (gpsLat !== null && gpsLng !== null && hasCustomerLocation) {
    // Determine if capture is at home based on distance or explicit context
    const isAtHome = explicitContext === 'home'
      ? true
      : explicitContext === 'walk'
        ? false
        : isCaptureAtHome(gpsLat, gpsLng, customer.latitude!, customer.longitude!, 100);

    captureContext = isAtHome ? 'home' : 'walk';

    // For at-home captures, snap to parcel boundary if outside
    if (isAtHome) {
      try {
        snapResult = await snapToParcel(
          gpsLat,
          gpsLng,
          customer.latitude!,
          customer.longitude!,
        );

        if (snapResult.snapped) {
          gpsLat = snapResult.lat;
          gpsLng = snapResult.lng;
          console.log(
            `[wellness-captures] GPS snapped to parcel: ${snapResult.rawLat},${snapResult.rawLng} → ${snapResult.lat},${snapResult.lng} (${snapResult.correctionMeters}m)`,
          );
        }
      } catch (error) {
        console.warn('[wellness-captures] Parcel snap failed:', error);
      }
    }
  }
  const consentToShare =
    typeof consentEntry === 'string'
      ? consentEntry === 'true'
      : customer.shareWellnessCaptures ?? true;

  const metadataPayload: Record<string, unknown> = {};
  if (locationAccuracy !== null) {
    metadataPayload.locationAccuracy = locationAccuracy;
  }
  if (customer.autoBlurWellnessPhotos) {
    metadataPayload.privacy = { autoBlur: true };
  }
  if (captureContext) {
    metadataPayload.captureContext = captureContext;
  }
  if (snapResult && (snapResult.snapped || snapResult.status === 'too_far')) {
    metadataPayload.locationSnap = {
      rawLat: snapResult.rawLat,
      rawLng: snapResult.rawLng,
      snapped: snapResult.snapped,
      wasInside: snapResult.wasInside,
      correctionMeters: snapResult.correctionMeters,
      status: snapResult.status,
      parcelId: snapResult.parcel?.parcelId ?? null,
    };
  }

  const capturedAt = new Date();
  const weatherLat = gpsLat ?? customer.latitude ?? null;
  const weatherLng = gpsLng ?? customer.longitude ?? null;
  if (weatherLat !== null && weatherLng !== null) {
    const weatherSnapshot = await fetchWeatherSnapshot({
      lat: weatherLat,
      lng: weatherLng,
      capturedAt,
      locationSource: gpsLat !== null && gpsLng !== null ? 'capture_gps' : 'home_address',
    });
    if (weatherSnapshot) {
      metadataPayload.weather = weatherSnapshot;
    }
  }

  if (!env.STORAGE_BUCKET) {
    return NextResponse.json({ ok: false, error: 'Storage not configured.' }, { status: 500 });
  }

  const fileBuffer = Buffer.from(await fileEntry.arrayBuffer());
  const mediaId = randomUUID();
  const extension = inferExtension(fileEntry.type);
  const storagePath = `wellness/owner-captures/${customer.orgId}/${customer.id}/${mediaId}.${extension}`;
  await uploadImage(env.STORAGE_BUCKET, storagePath, fileBuffer, fileEntry.type);

  const capture = await prisma.customerWellnessCapture.create({
    data: {
      id: mediaId,
      orgId: customer.orgId,
      customerId: customer.id,
      dogId: resolvedDogId,
      suspectedDogIds: resolvedSuspectedDogIds,
      scope: resolvedScope,
      attribution: resolvedAttribution,
      symptomTags,
      notes,
      gpsLat,
      gpsLng,
      gpsAccuracy: locationAccuracy,
      storagePath,
      consentToShare,
      analysisStatus: MediaAnalysisStatus.PENDING,
      analysisModel: null,
      analysisConfidence: null,
      analysisResult: Prisma.JsonNull,
      analysisError: null,
      metadata:
        Object.keys(metadataPayload).length > 0
          ? (metadataPayload as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      capturedAt,
    },
  });

  try {
    const signedUrl = await createSignedUrl(env.STORAGE_BUCKET, storagePath, 60 * 30);
    const analysisModel =
      process.env.WELLNESS_OWNER_CAPTURE_MODEL ??
      process.env.SERVICE_VISIT_ANALYSIS_MODEL ??
      'gpt-5-mini';
    const analysisDetail = access.tier === 'PREMIUM' ? 'high' : 'auto';
    const analysis = await analyzeOwnerCapture(signedUrl, {
      model: analysisModel,
      detail: analysisDetail,
    });
    const status = analysis.needs_review
      ? MediaAnalysisStatus.NEEDS_REVIEW
      : MediaAnalysisStatus.COMPLETED;

    const updated = await prisma.customerWellnessCapture.update({
      where: { id: capture.id },
      data: {
        analysisStatus: status,
        analysisResult: analysis as unknown as Prisma.InputJsonValue,
        analysisConfidence: analysis.confidence,
        analysisModel,
      },
    });

    await incrementWellnessUsage({
      customerId: customer.id,
      orgId: customer.orgId,
      scansDelta: 1,
    });

    // Include location snap info in response for client feedback
    const locationSnapResponse = snapResult
      ? {
          snapped: snapResult.snapped,
          wasInside: snapResult.wasInside,
          correctionMeters: snapResult.correctionMeters,
          status: snapResult.status,
        }
      : null;

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
        captureContext,
        locationSnap: locationSnapResponse,
      },
    });
  } catch (error) {
    await prisma.customerWellnessCapture.update({
      where: { id: capture.id },
      data: {
        analysisStatus: MediaAnalysisStatus.FAILED,
        analysisError: error instanceof Error ? error.message : 'analysis_failed',
      },
    });
    return NextResponse.json(
      {
        ok: false,
        error: 'analysis_failed',
        message: error instanceof Error ? error.message : 'Unable to analyze capture',
      },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
