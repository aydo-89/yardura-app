import { Stripe } from "stripe";

import { stripe } from "@/lib/stripe";

function getLookupKey(billingPreference: string, frequency: string) {
  return `yardura-zero-${billingPreference}-${frequency}`;
}

export async function ensureZeroPrice(
  billingPreference: string,
  frequency: string,
  currency: string = "usd",
): Promise<string> {
  const lookupKey = getLookupKey(billingPreference, frequency);

  const existing = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });

  if (existing.data.length > 0) {
    return existing.data[0].id;
  }

  const product = await stripe.products.create({
    name: `Yardura ${billingPreference} placeholder`,
    description: "Zero-dollar placeholder for Yardura billing orchestration",
    metadata: {
      billingPreference,
      frequency,
    },
  });

  const price = await stripe.prices.create({
    unit_amount: 0,
    currency,
    recurring: {
      interval: "month",
      interval_count: 1,
    },
    lookup_key: lookupKey,
    product: product.id,
    nickname: `${billingPreference} placeholder`,
    metadata: {
      billingPreference,
      frequency,
    },
  });

  return price.id;
}

export async function createUsagePrice(params: {
  currency?: string;
  frequency: string;
  perVisitAmountCents: number;
}): Promise<Stripe.Price> {
  const { currency = "usd", frequency, perVisitAmountCents } = params;

  return stripe.prices.create({
    unit_amount: perVisitAmountCents,
    currency,
    recurring: {
      interval: "month",
      interval_count: 1,
      usage_type: "metered",
    },
    product_data: {
      name: `Yardura per-visit usage - ${frequency}`,
    },
    metadata: {
      frequency,
      usage: "per-visit",
    },
  });
}
