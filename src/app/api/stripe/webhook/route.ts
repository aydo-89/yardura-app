import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  syncInvoiceWithLedger,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
} from "@/lib/billing/invoices";
import {
  handleSubscriptionUpdate,
  handleSubscriptionCancellation,
  handleWellnessSubscriptionUpdate,
} from "@/lib/stripe/webhook-handlers";

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  let event;

  try {
    if (!sig || !endpointSecret) {
      throw new Error("Missing webhook signature or secret");
    }

    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentSuccess(event.data.object);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentFailure(event.data.object);
        break;

      case "invoice.upcoming":
        await handleInvoiceUpcoming(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_succeeded":
        await handleInvoicePaymentSuccess(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailure(event.data.object as Stripe.Invoice);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdate(event.data.object);
        await handleWellnessSubscriptionUpdate(event.data.object);
        break;

      case "customer.subscription.created":
        await handleSubscriptionUpdate(event.data.object);
        await handleWellnessSubscriptionUpdate(event.data.object);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionCancellation(event.data.object);
        await handleWellnessSubscriptionUpdate(event.data.object);
        break;

      case "customer.updated": {
        const cust: any = event.data.object;
        const email = cust.email?.toLowerCase();
        if (email) {
          await prisma.user.updateMany({
            where: { email },
            data: { stripeCustomerId: cust.id },
          });
        }
        break;
      }

      case "checkout.session.completed": {
        const sess: any = event.data.object;
        const customer = sess.customer;
        const email = sess.customer_details?.email?.toLowerCase();
        if (customer && email) {
          await prisma.user.updateMany({
            where: { email },
            data: { stripeCustomerId: customer },
          });
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}

async function handlePaymentSuccess(paymentIntent: any) {
  const metadata = paymentIntent.metadata ?? {};
  const visitId = metadata.visit_id as string | undefined;
  if (!visitId) return;

  const visit = await prisma.serviceVisit.findUnique({
    where: { id: visitId },
    select: { metadata: true },
  });

  if (!visit) return;

  const existingMeta =
    visit.metadata && typeof visit.metadata === "object" && !Array.isArray(visit.metadata)
      ? (visit.metadata as Record<string, unknown>)
      : {};

  const nextMetadata = {
    ...existingMeta,
    stripePaymentIntentId: paymentIntent.id,
    stripePaymentStatus: "succeeded",
    stripePaymentUpdatedAt: new Date().toISOString(),
  } as Record<string, unknown>;

  await prisma.serviceVisit.update({
    where: { id: visitId },
    data: {
      metadata: nextMetadata as Prisma.InputJsonValue,
    },
  });
}

async function handlePaymentFailure(paymentIntent: any) {
  const metadata = paymentIntent.metadata ?? {};
  const visitId = metadata.visit_id as string | undefined;
  if (!visitId) return;

  const visit = await prisma.serviceVisit.findUnique({
    where: { id: visitId },
    select: { metadata: true },
  });

  if (!visit) return;

  const existingMeta =
    visit.metadata && typeof visit.metadata === "object" && !Array.isArray(visit.metadata)
      ? (visit.metadata as Record<string, unknown>)
      : {};

  const nextMetadata = {
    ...existingMeta,
    stripePaymentIntentId: paymentIntent.id,
    stripePaymentStatus: "failed",
    stripePaymentError: paymentIntent.last_payment_error?.message ?? "Unknown error",
    stripePaymentUpdatedAt: new Date().toISOString(),
  } as Record<string, unknown>;

  await prisma.serviceVisit.update({
    where: { id: visitId },
    data: {
      metadata: nextMetadata as Prisma.InputJsonValue,
    },
  });
}

async function handleInvoiceUpcoming(invoice: Stripe.Invoice) {
  try {
    await syncInvoiceWithLedger(invoice);
  } catch (error) {
    console.error("invoice.upcoming ledger sync failed", {
      invoiceId: invoice.id,
      error,
    });
  }
}

async function handleInvoicePaymentSuccess(invoice: Stripe.Invoice) {
  console.log(`Invoice payment succeeded: ${invoice.id}`);
  try {
    await handleInvoicePaid(invoice);
  } catch (error) {
    console.error("invoice.payment_succeeded handling failed", {
      invoiceId: invoice.id,
      error,
    });
  }
}

async function handleInvoicePaymentFailure(invoice: Stripe.Invoice) {
  console.log(`Invoice payment failed: ${invoice.id}`);
  try {
    await handleInvoicePaymentFailed(invoice);
  } catch (error) {
    console.error("invoice.payment_failed handling failed", {
      invoiceId: invoice.id,
      error,
    });
  }
}
