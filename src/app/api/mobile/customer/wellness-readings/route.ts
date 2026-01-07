import { NextRequest, NextResponse } from 'next/server';

import { buildCustomerSetupResponse, canSetupCustomer } from '@/lib/mobile/customer-setup';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { buildWellnessReadingsFromCaptures, buildWellnessReadingsFromMedia } from '@/lib/wellness/readings';
import { resolveStorageUrl } from '@/lib/storage';
import type { DataReading, ServiceVisit } from '@/shared/wellness';

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
      : NextResponse.json(
          { ok: false, error: 'Customer access required' },
          { status: 403 },
        );
  }

  const visits = await prisma.serviceVisit.findMany({
    where: { customerId: customer.id },
    orderBy: { scheduledDate: 'desc' },
    take: 40,
    include: {
      insights: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      media: {
        where: {
          assetType: 'INSIGHTSCOOP',
          analysisStatus: { in: ['COMPLETED', 'NEEDS_REVIEW'] },
          visibilityState: 'VISIBLE',
        },
        orderBy: { capturedAt: 'asc' },
        select: {
          id: true,
          capturedAt: true,
          analysisResult: true,
          stoolSampleId: true,
          stoolSampleView: true,
          assetType: true,
        },
      },
    },
  });

  const captureRows = await prisma.customerWellnessCapture.findMany({
    where: {
      customerId: customer.id,
      analysisStatus: { in: ['COMPLETED', 'NEEDS_REVIEW'] },
    },
    orderBy: { capturedAt: 'desc' },
    take: 40,
    select: {
      id: true,
      capturedAt: true,
      analysisResult: true,
      storagePath: true,
      dog: { select: { name: true } },
    },
  });

  const ownerCaptures = await Promise.all(
    captureRows.map(async (capture) => ({
      id: capture.id,
      capturedAt: capture.capturedAt,
      analysisResult: capture.analysisResult as Record<string, unknown> | null,
      dogName: capture.dog?.name ?? null,
      storagePath: await resolveStorageUrl(capture.storagePath),
    })),
  );

  const readings: DataReading[] = [
    ...buildWellnessReadingsFromMedia(
      visits.flatMap((visit) =>
        visit.media.map((m) => ({
          id: m.id,
          capturedAt: m.capturedAt,
          analysisResult: m.analysisResult as Record<string, unknown> | null,
          stoolSampleId: m.stoolSampleId,
          stoolSampleView: m.stoolSampleView,
          assetType: m.assetType,
        })),
      ),
    ),
    ...buildWellnessReadingsFromCaptures(ownerCaptures),
  ].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const serviceVisits: ServiceVisit[] = visits.map((visit) => ({
    id: visit.id,
    date: visit.scheduledDate.toISOString(),
    type: 'residential',
    areas: [],
    notes: visit.insights?.[0]?.observations ?? undefined,
  }));

  return NextResponse.json({
    ok: true,
    data: {
      readings,
      visits: serviceVisits,
    },
  });
}
