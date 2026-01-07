import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

interface EnsureStripeCustomerParams {
  email: string;
  currentCustomerId?: string | null;
  userId?: string | null;
}

export async function ensureStripeCustomerId({
  email,
  currentCustomerId,
  userId,
}: EnsureStripeCustomerParams): Promise<string | null> {
  let stripeCustomerId = currentCustomerId ?? null;

  if (!stripeCustomerId) {
    try {
      const search = await stripe.customers.list({
        email,
        limit: 5,
      });

      const match = search.data.find((customer) =>
        customer.email?.toLowerCase() === email.toLowerCase(),
      );

      if (match) {
        stripeCustomerId = match.id;
      }
    } catch (error) {
      console.warn("ensureStripeCustomerId: search failed", error);
    }
  }

  if (!stripeCustomerId) {
    try {
      const created = await stripe.customers.create({
        email,
      });
      stripeCustomerId = created.id;
    } catch (error) {
      console.error("ensureStripeCustomerId: failed to create customer", error);
      return null;
    }
  }

  if (userId) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId },
      });
    } catch (error) {
      console.warn("ensureStripeCustomerId: failed to persist user stripe id", error);
    }
  }

  return stripeCustomerId;
}
