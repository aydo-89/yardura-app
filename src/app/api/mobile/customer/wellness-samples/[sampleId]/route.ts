import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { buildCustomerSetupResponse, canSetupCustomer } from '@/lib/mobile/customer-setup';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { resolveStorageUrl } from '@/lib/storage';

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

const sourceSchema = z.enum(['OWNER', 'PRO']);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sampleId: string }> },
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
      : NextResponse.json({ ok: false, error: 'Customer access required' }, { status: 403 });
  }

  const { sampleId } = await params;
  const { searchParams } = new URL(request.url);
  const sourceRaw = searchParams.get('source');
  const parsedSource = sourceSchema.safeParse(sourceRaw);
  if (!parsedSource.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid source. Use OWNER or PRO.' },
      { status: 422 },
    );
  }

  if (parsedSource.data === 'OWNER') {
    const capture = await prisma.customerWellnessCapture.findFirst({
      where: { id: sampleId, customerId: customer.id },
      select: {
        id: true,
        capturedAt: true,
        analysisResult: true,
        analysisConfidence: true,
        analysisModel: true,
        dog: { select: { name: true } },
        storagePath: true,
      },
    });

    if (!capture) {
      return NextResponse.json({ ok: false, error: 'Sample not found' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      data: {
        sample: {
          id: capture.id,
          source: 'OWNER',
          capturedAt: capture.capturedAt.toISOString(),
          analysisResult: capture.analysisResult,
          analysisConfidence: capture.analysisConfidence,
          analysisModel: capture.analysisModel,
          dogName: capture.dog?.name ?? null,
          imageUrl: capture.storagePath ? await resolveStorageUrl(capture.storagePath) : null,
        },
      },
    });
  }

  const media = await prisma.serviceVisitMedia.findMany({
    where: {
      assetType: 'INSIGHTSCOOP',
      visibilityState: 'VISIBLE',
      serviceVisit: { customerId: customer.id },
      OR: [{ id: sampleId }, { stoolSampleId: sampleId }],
    },
    select: {
      id: true,
      stoolSampleId: true,
      stoolSampleView: true,
      capturedAt: true,
      analysisResult: true,
      analysisConfidence: true,
      analysisModel: true,
      reviewStatus: true,
      storagePath: true,
    },
    orderBy: { capturedAt: 'asc' },
  });

  if (media.length === 0) {
    return NextResponse.json({ ok: false, error: 'Sample not found' }, { status: 404 });
  }

  const preferred =
    media.find((item) => item.stoolSampleView === 'SURFACE') ?? media[0];

  return NextResponse.json({
    ok: true,
    data: {
      sample: {
        id: preferred.stoolSampleId ?? preferred.id,
        source: 'PRO',
        capturedAt: preferred.capturedAt.toISOString(),
        analysisResult: preferred.analysisResult,
        analysisConfidence: preferred.analysisConfidence,
        analysisModel: preferred.analysisModel,
        reviewStatus: preferred.reviewStatus,
        stoolSampleView: preferred.stoolSampleView,
        imageUrl: preferred.storagePath ? await resolveStorageUrl(preferred.storagePath) : null,
      },
    },
  });
}

export const runtime = 'nodejs';
