import { Stripe } from "stripe";

import { stripe } from "@/lib/stripe";

interface SubscriptionParams {
  customerId: string;
  paymentMethodId: string;
  priceId: string;
  trialEndsAt: Date | null;
  metadata?: Record<string, string | number | null | undefined>;
}

export async function createPlaceholderSubscription(params: SubscriptionParams) {
  const { customerId, paymentMethodId, priceId, trialEndsAt, metadata } = params;

  const trialEndSeconds = trialEndsAt ? Math.floor(trialEndsAt.getTime() / 1000) : undefined;

  const createParams: Stripe.SubscriptionCreateParams = {
    customer: customerId,
    items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    default_payment_method: paymentMethodId,
    payment_behavior: "default_incomplete",
    collection_method: "charge_automatically",
    metadata: sanitizeMetadata(metadata),
    proration_behavior: "none",
  };

  if (trialEndSeconds) {
    createParams.trial_end = trialEndSeconds;
  }

  return stripe.subscriptions.create(createParams);
}

function sanitizeMetadata(
  metadata?: Record<string, string | number | null | undefined> | null,
): Stripe.MetadataParam | undefined {
  if (!metadata) return undefined;
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined || value === null) continue;
    result[key] = String(value);
  }
  return result;
}
