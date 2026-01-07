import { NextRequest, NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { buildCustomerSetupResponse, canSetupCustomer } from '@/lib/mobile/customer-setup';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { resolveStorageUrl } from '@/lib/storage';
import { uploadImage } from '@/lib/supabase-admin';

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
      : NextResponse.json(
          { ok: false, error: 'Customer access required' },
          { status: 403 },
        );
  }

  const bucket = env.STORAGE_BUCKET;
  if (!bucket) {
    return NextResponse.json(
      { ok: false, error: 'Storage is not configured' },
      { status: 500 },
    );
  }

  const formData = await request.formData().catch(() => null);
  const dogId = formData?.get('dogId');
  const file = formData?.get('file');

  if (typeof dogId !== 'string' || !dogId) {
    return NextResponse.json({ ok: false, error: 'Dog ID is required' }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'File is required' }, { status: 400 });
  }

  const dog = await prisma.dog.findFirst({
    where: { id: dogId, userId },
    select: { id: true },
  });

  if (!dog) {
    return NextResponse.json({ ok: false, error: 'Dog not found' }, { status: 404 });
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const extension = inferExtension(file.type);
  const storagePath = `profiles/dogs/${dogId}/${Date.now()}.${extension}`;

  await uploadImage(bucket, storagePath, fileBuffer, file.type || 'image/jpeg');

  const updated = await prisma.dog.update({
    where: { id: dogId },
    data: { photoUrl: storagePath },
    select: { photoUrl: true },
  });

  return NextResponse.json({
    ok: true,
    data: {
      photoUrl: await resolveStorageUrl(updated.photoUrl),
    },
  });
}
