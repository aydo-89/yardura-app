import { NextRequest, NextResponse } from 'next/server';

import { buildCustomerSetupResponse, canSetupCustomer } from '@/lib/mobile/customer-setup';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { deleteFile } from '@/lib/supabase-admin';
import { env } from '@/lib/env';

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
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
