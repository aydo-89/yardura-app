import { NextRequest, NextResponse } from "next/server";

import type Stripe from "stripe";

import { authOptions } from "@/lib/auth";
import { safeGetServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

type SubscriptionSummary = {
  id: string;
  status: string;
  planName: string | null;
  amountCents: number | null;
  currency: string | null;
  interval: string | null;
  nextBillingDate: string | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
};

type PaymentMethodSummary = {
  id: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  type: string;
  isDefault: boolean;
};

type InvoiceSummary = {
  id: string;
  number: string | null;
  status: string | null;
  amountDueCents: number | null;
  currency: string | null;
  invoiceDate: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
};

type UpcomingInvoiceSummary = {
  amountDueCents: number | null;
  currency: string | null;
  dueDate: string | null;
};

export async function GET(_request: NextRequest) {
  try {
    const session = (await safeGetServerSession(authOptions as any)) as {
      user?: { id?: string; email?: string };
    } | null;

    if (!session?.user?.email) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const userEmail = session.user.email as string;

    const userRecord = await prisma.user.findUnique({
      where: { email: userEmail },
      select: { id: true, stripeCustomerId: true },
    });

    let stripeCustomerId = userRecord?.stripeCustomerId ?? null;

    if (!stripeCustomerId) {
      try {
        const search = await stripe.customers.list({
          email: userEmail,
          limit: 5,
        });

        const match = search.data.find((customer) =>
          customer.email?.toLowerCase() === userEmail.toLowerCase(),
        );

        if (match) {
          stripeCustomerId = match.id;
          if (userRecord?.id) {
            await prisma.user.update({
              where: { id: userRecord.id },
              data: { stripeCustomerId },
            });
          }
        }
      } catch (searchError) {
        console.warn("billing.overview: failed to backfill stripe customer", searchError);
      }
    }

    if (!stripeCustomerId) {
      return NextResponse.json({
        ok: true,
        data: {
          subscriptions: [] as SubscriptionSummary[],
          paymentMethods: [] as PaymentMethodSummary[],
          invoices: [] as InvoiceSummary[],
          upcomingInvoice: null as UpcomingInvoiceSummary | null,
        },
      });
    }

    const customerId = stripeCustomerId;

    const [customer, subscriptions, paymentMethods, invoices] = await Promise.all([
      stripe.customers.retrieve(customerId, {
        expand: ["invoice_settings.default_payment_method"],
      }),
      stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        expand: ["data.items.data.price", "data.default_payment_method"],
        limit: 10,
      }),
      stripe.paymentMethods.list({
        customer: customerId,
        type: "card",
      }),
      stripe.invoices.list({
        customer: customerId,
        limit: 10,
      }),
    ]);

    let upcoming: Stripe.Invoice | null = null;
    const retrieveUpcoming = (stripe.invoices as unknown as {
      retrieveUpcoming?: (options: { customer: string }) => Promise<Stripe.Invoice>;
    }).retrieveUpcoming;

    if (typeof retrieveUpcoming === "function") {
      try {
        upcoming = await retrieveUpcoming({ customer: customerId });
      } catch (error) {
        console.warn("billing.overview: upcoming invoice not available", error);
        upcoming = null;
      }
    }

    const defaultPaymentMethodId =
      (customer as Stripe.Customer & {
        invoice_settings?: { default_payment_method?: { id?: string } };
      })?.invoice_settings?.default_payment_method?.id ?? null;

    const productIdSet = new Set<string>();
    for (const sub of subscriptions.data) {
      const price = sub.items.data[0]?.price;
      if (typeof price?.product === "string") {
        productIdSet.add(price.product);
      }
    }

    const productNameMap = new Map<string, string>();
    if (productIdSet.size) {
      await Promise.all(
        Array.from(productIdSet).map(async (productId) => {
          try {
            const product = await stripe.products.retrieve(productId);
            if (!product.deleted) {
              productNameMap.set(productId, product.name);
            }
          } catch (error) {
            console.warn("billing.overview: unable to retrieve product", productId, error);
          }
        }),
      );
    }

    const subscriptionSummaries: SubscriptionSummary[] = subscriptions.data.map(
      (sub: Stripe.Subscription) => {
        const price = sub.items.data[0]?.price;
        const productName = (() => {
          if (typeof price?.product === "object" && price?.product) {
            const product = price.product as Stripe.Product | Stripe.DeletedProduct;
            if (!product.deleted && "name" in product) {
              return product.name;
            }
          }
          if (typeof price?.product === "string") {
            return productNameMap.get(price.product) || price.product;
          }
          return (
            price?.nickname ||
            price?.metadata?.displayName ||
            price?.metadata?.label ||
            null
          );
        })();

        const currentPeriodEnd = (sub as any)?.current_period_end as
          | number
          | null
          | undefined;
        const cancelAtPeriodEnd = Boolean((sub as any)?.cancel_at_period_end);
        const trialEndsAt = sub.trial_end
          ? new Date(sub.trial_end * 1000).toISOString()
          : null;

        const upcomingDate = upcoming?.next_payment_attempt
          ? new Date(upcoming.next_payment_attempt * 1000).toISOString()
          : upcoming?.created
            ? new Date(upcoming.created * 1000).toISOString()
            : null;

        let nextBillingDate: string | null = null;
        if (upcomingDate) {
          nextBillingDate = upcomingDate;
        } else if (currentPeriodEnd) {
          nextBillingDate = new Date(currentPeriodEnd * 1000).toISOString();
        } else if (trialEndsAt) {
          nextBillingDate = trialEndsAt;
        }

        return {
          id: sub.id,
          status: sub.status,
          planName: productName,
          amountCents: price?.unit_amount ?? null,
          currency: price?.currency ?? null,
          interval: price?.recurring?.interval ?? null,
          intervalCount: price?.recurring?.interval_count ?? null,
          nextBillingDate,
          cancelAtPeriodEnd,
          trialEndsAt,
        };
      },
    );

    const paymentMethodSummaries: PaymentMethodSummary[] = paymentMethods.data.map(
      (method: Stripe.PaymentMethod) => ({
        id: method.id,
        brand: method.card?.brand ?? null,
        last4: method.card?.last4 ?? null,
        expMonth: method.card?.exp_month ?? null,
        expYear: method.card?.exp_year ?? null,
        type: method.type,
        isDefault: method.id === defaultPaymentMethodId,
      }),
    );

    const invoiceSummaries: InvoiceSummary[] = invoices.data.map(
      (invoice: Stripe.Invoice) => ({
        id:
          invoice.id ||
          invoice.number ||
          `invoice_${Math.random().toString(36).slice(2, 10)}`,
        number: invoice.number,
        status: invoice.status,
        amountDueCents: invoice.amount_due ?? null,
        currency: invoice.currency ?? null,
        invoiceDate: invoice.created
          ? new Date(invoice.created * 1000).toISOString()
          : null,
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
        invoicePdf: invoice.invoice_pdf ?? null,
      }),
    );

    const upcomingInvoiceSummary: UpcomingInvoiceSummary | null = upcoming
      ? {
          amountDueCents: upcoming.amount_due ?? null,
          currency: upcoming.currency ?? null,
          dueDate: upcoming.next_payment_attempt
            ? new Date(upcoming.next_payment_attempt * 1000).toISOString()
            : upcoming.created
              ? new Date(upcoming.created * 1000).toISOString()
              : null,
        }
      : null;

    return NextResponse.json({
      ok: true,
      data: {
        subscriptions: subscriptionSummaries,
        paymentMethods: paymentMethodSummaries,
        invoices: invoiceSummaries,
        upcomingInvoice: upcomingInvoiceSummary,
      },
    });
  } catch (error) {
    console.error("GET /api/billing/overview error", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
