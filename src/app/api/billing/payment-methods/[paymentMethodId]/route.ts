import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { safeGetServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { ensureStripeCustomerId } from "@/lib/stripe/customer";

const patchSchema = z.object({
  action: z.literal("set_default"),
});

type RouteParams = { params: Promise<{ paymentMethodId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await safeGetServerSession(authOptions as any);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { paymentMethodId } = await params;
    const { action } = patchSchema.parse(await request.json());

    if (action !== "set_default") {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
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
      return NextResponse.json({ error: "Stripe customer not available" }, { status: 400 });
    }

    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    if (paymentMethod.customer !== stripeCustomerId) {
      return NextResponse.json(
        { error: "This card isn’t linked to your account" },
        { status: 400 },
      );
    }

    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("billing.payment-methods.patch", error);
    return NextResponse.json({ error: "Unable to update payment method" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await safeGetServerSession(authOptions as any);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { paymentMethodId } = await params;

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

    const customer = await stripe.customers.retrieve(stripeCustomerId, {
      expand: ["invoice_settings.default_payment_method"],
    });

    const defaultPaymentMethodId = (customer as any)?.invoice_settings?.default_payment_method?.id;

    if (defaultPaymentMethodId === paymentMethodId) {
      return NextResponse.json(
        { error: "Set another default card before removing this one" },
        { status: 400 },
      );
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: "card",
    });

    if (paymentMethods.data.length <= 1) {
      return NextResponse.json(
        { error: "You need at least one card on file" },
        { status: 400 },
      );
    }

    const target = paymentMethods.data.find((method) => method.id === paymentMethodId);
    if (!target) {
      return NextResponse.json(
        { error: "Card not found" },
        { status: 404 },
      );
    }

    await stripe.paymentMethods.detach(paymentMethodId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("billing.payment-methods.delete", error);
    return NextResponse.json({ error: "Unable to remove payment method" }, { status: 500 });
  }
}

export const runtime = "nodejs";
