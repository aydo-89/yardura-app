import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { authOptions } from "@/lib/auth";
import { safeGetServerSession } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

const GOD_MODE_EMAIL = "ayden@yardura.com";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user || session.user.email !== GOD_MODE_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const subscription = await stripe.subscriptions.retrieve(id, {
      expand: ["items.data.price.product", "latest_invoice.payment_intent"],
    });
    const primaryItem = subscription.items.data[0] as Stripe.SubscriptionItem & {
      current_period_start?: number;
      current_period_end?: number;
    };

    const json = {
      id: subscription.id,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodStart: primaryItem?.current_period_start
        ? new Date(primaryItem.current_period_start * 1000).toISOString()
        : null,
      currentPeriodEnd: primaryItem?.current_period_end
        ? new Date(primaryItem.current_period_end * 1000).toISOString()
        : null,
      created: subscription.created
        ? new Date(subscription.created * 1000).toISOString()
        : null,
      collectionMethod: subscription.collection_method,
      latestInvoiceStatus: subscription.latest_invoice
        ? (subscription.latest_invoice as any).status ?? null
        : null,
      defaultPaymentMethod: subscription.default_payment_method ?? null,
      metadata: subscription.metadata ?? {},
      items: subscription.items.data.map((item) => {
        const price = item.price;
        const product = price.product as Stripe.Product | null;
        return {
          id: item.id,
          quantity: item.quantity,
          amount: price.unit_amount,
          currency: price.currency,
          interval: price.recurring?.interval ?? null,
          intervalCount: price.recurring?.interval_count ?? null,
          nickname: price.nickname ?? product?.name ?? null,
          productId: price.product ? (typeof price.product === "string" ? price.product : price.product.id) : null,
          metadata: price.metadata ?? {},
        };
      }),
    };

    return NextResponse.json({ ok: true, subscription: json });
  } catch (error) {
    console.error("admin.subscription.detail", error);
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }
}

export const runtime = "nodejs";
