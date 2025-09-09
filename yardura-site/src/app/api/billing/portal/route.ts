import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const { customerId, returnUrl } = await req.json();
    if (!customerId) return NextResponse.json({ error: 'customerId required' }, { status: 400 });
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
