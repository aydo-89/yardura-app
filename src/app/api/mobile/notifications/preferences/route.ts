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

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { pushNotificationsEnabled: true },
  });

  return NextResponse.json({
    ok: true,
    data: { pushEnabled: user?.pushNotificationsEnabled ?? true },
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

  const body = (await request.json().catch(() => null)) as { pushEnabled?: boolean } | null;
  if (typeof body?.pushEnabled !== 'boolean') {
    return NextResponse.json({ ok: false, error: 'pushEnabled must be a boolean' }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: payload.sub },
    data: { pushNotificationsEnabled: body.pushEnabled },
    select: { pushNotificationsEnabled: true },
  });

  return NextResponse.json({
    ok: true,
    data: { pushEnabled: user.pushNotificationsEnabled },
  });
}

export const runtime = 'nodejs';
