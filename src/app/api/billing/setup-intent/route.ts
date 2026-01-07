import { NextRequest, NextResponse } from "next/server";

import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { ensureStripeCustomerId } from "@/lib/stripe/customer";

export async function POST(_request: NextRequest) {
  try {
    const session = await safeGetServerSession(authOptions as any);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRecord = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, stripeCustomerId: true },
    });

    const stripeCustomerId = await ensureStripeCustomerId({
      email: session.user.email,
      currentCustomerId: userRecord?.stripeCustomerId ?? null,
      userId: userRecord?.id ?? null,
    });

    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: "Unable to determine Stripe customer" },
        { status: 400 },
      );
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      usage: "off_session",
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return NextResponse.json({
      ok: true,
      clientSecret: setupIntent.client_secret,
      customerId: stripeCustomerId,
    });
  } catch (error) {
    console.error("billing.setup-intent", error);
    return NextResponse.json({ error: "Failed to start card setup" }, { status: 500 });
  }
}

export const runtime = "nodejs";
