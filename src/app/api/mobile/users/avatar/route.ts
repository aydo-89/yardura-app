import { NextRequest, NextResponse } from 'next/server';

import { env } from '@/lib/env';
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
    return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 401 });
  }

  const bucket = env.STORAGE_BUCKET;
  if (!bucket) {
    return NextResponse.json(
      { ok: false, error: 'Storage is not configured' },
      { status: 500 },
    );
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'File is required' }, { status: 400 });
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const extension = inferExtension(file.type);
  const storagePath = `profiles/users/${userId}/${Date.now()}.${extension}`;

  await uploadImage(bucket, storagePath, fileBuffer, file.type || 'image/jpeg');

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { image: storagePath },
    select: { image: true },
  });

  return NextResponse.json({
    ok: true,
    data: {
      photoUrl: await resolveStorageUrl(updated.image),
    },
  });
}
