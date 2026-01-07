import { NextRequest, NextResponse } from 'next/server';

import { buildCustomerSetupResponse, canSetupCustomer } from '@/lib/mobile/customer-setup';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { getCustomerWellnessAccess } from '@/lib/wellness/access';

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

function isPremiumAccess(access: Awaited<ReturnType<typeof getCustomerWellnessAccess>>) {
  return (
    access.tier === 'PREMIUM' ||
    access.source === 'SERVICE_PROMO' ||
    access.hasActiveService
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ walkId: string }> },
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
  if (!isPremiumAccess(access)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'premium_required',
        message: 'Upgrade to premium to manage walk history.',
      },
      { status: 403 },
    );
  }

  const { walkId } = await params;
  const walk = await prisma.customerWellnessWalk.findFirst({
    where: { id: walkId, customerId: customer.id },
    select: { id: true },
  });

  if (!walk) {
    return NextResponse.json({ ok: false, error: 'Walk not found' }, { status: 404 });
  }

  await prisma.customerWellnessWalk.delete({
    where: { id: walk.id },
  });

  return NextResponse.json({ ok: true });
}

export const runtime = 'nodejs';
