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

const preferencesSchema = z.object({
  shareWellnessNotes: z.boolean().optional(),
  shareWellnessCaptures: z.boolean().optional(),
  autoBlurWellnessPhotos: z.boolean().optional(),
  parasiteRiskNotificationsEnabled: z.boolean().optional(),
});

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
    select: {
      shareWellnessNotes: true,
      shareWellnessCaptures: true,
      autoBlurWellnessPhotos: true,
      parasiteRiskNotificationsEnabled: true,
    },
  });

  if (!customer) {
    return canSetup
      ? buildCustomerSetupResponse(userId)
      : NextResponse.json(
          { ok: false, error: 'Customer access required' },
          { status: 403 },
        );
  }

  return NextResponse.json({
    ok: true,
    data: {
      shareWellnessNotes: customer.shareWellnessNotes ?? true,
      shareWellnessCaptures: customer.shareWellnessCaptures ?? true,
      autoBlurWellnessPhotos: customer.autoBlurWellnessPhotos ?? true,
      parasiteRiskNotificationsEnabled: customer.parasiteRiskNotificationsEnabled ?? true,
    },
  });
}

export async function PATCH(request: NextRequest) {
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

  const body = await request.json().catch(() => null);
  const parsed = preferencesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid preferences payload' },
      { status: 422 },
    );
  }

  const existingCustomer = await prisma.customer.findFirst({
    where: { userId },
    select: { id: true },
  });

  if (!existingCustomer) {
    return canSetup
      ? buildCustomerSetupResponse(userId)
      : NextResponse.json(
          { ok: false, error: 'Customer access required' },
          { status: 403 },
        );
  }

  const customer = await prisma.customer.update({
    where: { id: existingCustomer.id },
    data: {
      ...(parsed.data.shareWellnessNotes !== undefined
        ? { shareWellnessNotes: parsed.data.shareWellnessNotes }
        : {}),
      ...(parsed.data.shareWellnessCaptures !== undefined
        ? { shareWellnessCaptures: parsed.data.shareWellnessCaptures }
        : {}),
      ...(parsed.data.autoBlurWellnessPhotos !== undefined
        ? { autoBlurWellnessPhotos: parsed.data.autoBlurWellnessPhotos }
        : {}),
      ...(parsed.data.parasiteRiskNotificationsEnabled !== undefined
        ? { parasiteRiskNotificationsEnabled: parsed.data.parasiteRiskNotificationsEnabled }
        : {}),
    },
    select: {
      shareWellnessNotes: true,
      shareWellnessCaptures: true,
      autoBlurWellnessPhotos: true,
      parasiteRiskNotificationsEnabled: true,
    },
  });

  return NextResponse.json({
    ok: true,
    data: {
      shareWellnessNotes: customer.shareWellnessNotes ?? true,
      shareWellnessCaptures: customer.shareWellnessCaptures ?? true,
      autoBlurWellnessPhotos: customer.autoBlurWellnessPhotos ?? true,
      parasiteRiskNotificationsEnabled: customer.parasiteRiskNotificationsEnabled ?? true,
    },
  });
}
