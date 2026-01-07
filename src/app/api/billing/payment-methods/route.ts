import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { safeGetServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { ensureStripeCustomerId } from "@/lib/stripe/customer";

const bodySchema = z.object({
  paymentMethodId: z.string().min(1),
  makeDefault: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await safeGetServerSession(authOptions as any);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { paymentMethodId, makeDefault } = bodySchema.parse(await request.json());

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
      return NextResponse.json({ error: "Stripe customer not available" }, { status: 400 });
    }

    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    if (paymentMethod.customer && paymentMethod.customer !== stripeCustomerId) {
      return NextResponse.json(
        { error: "This card is linked to another customer" },
        { status: 400 },
      );
    }

    if (!paymentMethod.customer) {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: stripeCustomerId,
      });
    }

    const customer = await stripe.customers.retrieve(stripeCustomerId, {
      expand: ["invoice_settings.default_payment_method"],
    });

    const shouldSetDefault = Boolean(
      makeDefault ||
        !(customer as any)?.invoice_settings?.default_payment_method,
    );

    if (shouldSetDefault) {
      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    }

    return NextResponse.json({ ok: true, paymentMethodId });
  } catch (error) {
    console.error("billing.payment-methods.post", error);
    return NextResponse.json({ error: "Unable to save payment method" }, { status: 500 });
  }
}

export const runtime = "nodejs";
