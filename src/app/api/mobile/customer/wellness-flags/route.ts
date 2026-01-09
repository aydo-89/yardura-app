import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { buildCustomerSetupResponse, canSetupCustomer } from '@/lib/mobile/customer-setup';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

const clearSchema = z.object({
  id: z.string().min(1),
  source: z.enum(['OWNER', 'PRO']),
});

function mergeClearFlag(analysisResult: unknown, clearedAt: Date) {
  const base =
    analysisResult && typeof analysisResult === 'object' && !Array.isArray(analysisResult)
      ? { ...(analysisResult as Record<string, unknown>) }
      : {};
  return {
    ...base,
    customer_flag_cleared: true,
    customer_flag_cleared_at: clearedAt.toISOString(),
  };
}

export async function POST(request: NextRequest) {
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

  const body = await request.json().catch(() => null);
  const parsed = clearSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid request', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { id, source } = parsed.data;
  const clearedAt = new Date();

  if (source === 'OWNER') {
    const capture = await prisma.customerWellnessCapture.findFirst({
      where: { id, customerId: customer.id },
      select: { id: true, analysisResult: true },
    });
    if (!capture) {
      return NextResponse.json({ ok: false, error: 'Sample not found' }, { status: 404 });
    }

    await prisma.customerWellnessCapture.update({
      where: { id: capture.id },
      data: {
        analysisResult: mergeClearFlag(capture.analysisResult, clearedAt),
      },
    });

    return NextResponse.json({ ok: true, data: { id: capture.id } });
  }

  const media = await prisma.serviceVisitMedia.findMany({
    where: {
      serviceVisit: { customerId: customer.id },
      assetType: 'INSIGHTSCOOP',
      OR: [{ id }, { stoolSampleId: id }],
    },
    select: { id: true, analysisResult: true },
  });

  if (media.length === 0) {
    return NextResponse.json({ ok: false, error: 'Sample not found' }, { status: 404 });
  }

  await Promise.all(
    media.map((item) =>
      prisma.serviceVisitMedia.update({
        where: { id: item.id },
        data: {
          analysisResult: mergeClearFlag(item.analysisResult, clearedAt),
        },
      }),
    ),
  );

  return NextResponse.json({ ok: true, data: { count: media.length } });
}

export const runtime = 'nodejs';
