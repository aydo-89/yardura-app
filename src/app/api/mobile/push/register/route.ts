import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

type RegisterPayload = {
  token?: string;
  platform?: string;
  deviceId?: string;
  appVersion?: string;
  provider?: string;
};

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

  const body = (await request.json().catch(() => null)) as RegisterPayload | null;
  const pushToken = body?.token?.trim();
  if (!pushToken) {
    return NextResponse.json({ ok: false, error: 'Push token required' }, { status: 400 });
  }

  const provider = body?.provider?.trim() || 'EXPO';
  const now = new Date();

  const record = await prisma.userPushToken.upsert({
    where: { token: pushToken },
    update: {
      userId: payload.sub,
      orgId: payload.orgId ?? null,
      provider,
      platform: body?.platform ?? null,
      deviceId: body?.deviceId ?? null,
      appVersion: body?.appVersion ?? null,
      lastSeenAt: now,
      disabledAt: null,
    },
    create: {
      userId: payload.sub,
      orgId: payload.orgId ?? null,
      provider,
      token: pushToken,
      platform: body?.platform ?? null,
      deviceId: body?.deviceId ?? null,
      appVersion: body?.appVersion ?? null,
      lastSeenAt: now,
    },
    select: {
      id: true,
      token: true,
      platform: true,
      deviceId: true,
      lastSeenAt: true,
    },
  });

  return NextResponse.json({ ok: true, data: record });
}

export const runtime = 'nodejs';
