import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { buildCustomerSetupResponse, canSetupCustomer } from '@/lib/mobile/customer-setup';
import { ensureStripeCustomerId } from '@/lib/stripe/customer';
import { getSiteUrl } from '@/lib/env';

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, stripeCustomerId: true },
  });

  if (!user?.email) {
    return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 });
  }

  const customer = await prisma.customer.findFirst({
    where: { userId },
    select: { id: true, orgId: true },
  });

  if (!customer) {
    return canSetup
      ? buildCustomerSetupResponse(userId)
      : NextResponse.json({ ok: false, error: 'Customer access required' }, { status: 403 });
  }

  const priceId = process.env.STRIPE_WELLNESS_PRICE_ID;
  if (!priceId) {
    return NextResponse.json(
      { ok: false, error: 'Premium price not configured.' },
      { status: 500 },
    );
  }

  const existingPlan = await prisma.customerWellnessPlan.findFirst({
    where: {
      customerId: customer.id,
      status: 'ACTIVE',
      OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
    },
    orderBy: { startedAt: 'desc' },
  });

  if (existingPlan?.stripeSubscriptionId) {
    let customerId = user.stripeCustomerId ?? null;
    if (!customerId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(existingPlan.stripeSubscriptionId);
        const resolvedCustomer =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer?.id;
        if (resolvedCustomer) {
          customerId = resolvedCustomer;
          await prisma.user.update({
            where: { id: user.id },
            data: { stripeCustomerId: resolvedCustomer },
          });
        }
      } catch {
        customerId = null;
      }
    }
    if (customerId) {
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${getSiteUrl()}/mobile/dashboard/wellness/upgrade`,
      });
      return NextResponse.json({ ok: true, data: { portalUrl: portal.url } });
    }
  }

  const stripeCustomerId = await ensureStripeCustomerId({
    email: user.email,
    currentCustomerId: user.stripeCustomerId,
    userId: user.id,
  });

  if (!stripeCustomerId) {
    return NextResponse.json({ ok: false, error: 'Unable to start checkout.' }, { status: 500 });
  }

  const siteUrl = getSiteUrl();
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    subscription_data: {
      metadata: {
        wellnessCustomerId: customer.id,
        orgId: customer.orgId,
        plan: 'PREMIUM',
        source: 'DIRECT',
      },
    },
    metadata: {
      wellnessCustomerId: customer.id,
      orgId: customer.orgId,
      plan: 'PREMIUM',
    },
    success_url: `${siteUrl}/mobile/dashboard/wellness/upgrade?checkout=success`,
    cancel_url: `${siteUrl}/mobile/dashboard/wellness/upgrade?checkout=cancel`,
  });

  return NextResponse.json({ ok: true, data: { checkoutUrl: session.url } });
}

export const runtime = 'nodejs';
