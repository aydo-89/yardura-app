import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { safeGetServerSession } from '@/lib/auth';
import { authOptions } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = (await safeGetServerSession(authOptions as any)) as { user?: { id?: string } } | null;
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { stripeCustomerId } = await req.json();
  if (!stripeCustomerId) return NextResponse.json({ error: 'stripeCustomerId required' }, { status: 400 });
  await prisma.user.update({ where: { id: session.user.id }, data: { stripeCustomerId } });
  return NextResponse.json({ ok: true });
}

export const runtime = 'nodejs';
