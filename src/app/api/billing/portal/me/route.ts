import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { safeGetServerSession } from '@/lib/auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(_req: NextRequest) {
  const session = (await safeGetServerSession(authOptions as any)) as { user?: { id?: string } } | null;
  const user = session?.user?.id ? await prisma.user.findUnique({ where: { id: session.user.id } }) : null;
  const customerId = user?.stripeCustomerId;
  if (!customerId) return NextResponse.json({ error: 'no_customer' }, { status: 400 });
  const sessionPortal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  });
  return NextResponse.json({ url: sessionPortal.url });
}

export const runtime = 'nodejs';
