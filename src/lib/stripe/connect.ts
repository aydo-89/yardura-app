import type Stripe from "stripe";

import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { getSiteUrl } from "@/lib/env";

type StripeConnectStatus = {
  accountId: string | null;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  requirements: string[];
  disabledReason: string | null;
};

type CreateConnectAccountInput = {
  userId: string;
  email: string;
  name?: string | null;
};

type StripePayoutTransferInput = {
  payoutId: string;
  amountCents: number;
  destinationAccountId: string;
  scooperId: string;
  orgId: string;
  serviceVisitId?: string | null;
};

const normalizeRequirements = (account: Stripe.Account): string[] => {
  const requirements = account.requirements?.currently_due ?? [];
  const pastDue = account.requirements?.past_due ?? [];
  const combined = [...new Set([...requirements, ...pastDue])];
  return combined.filter((item) => typeof item === "string");
};

export async function fetchStripeConnectStatus(
  accountId: string,
): Promise<StripeConnectStatus> {
  const account = await stripe.accounts.retrieve(accountId);
  return {
    accountId: account.id,
    detailsSubmitted: account.details_submitted ?? false,
    payoutsEnabled: account.payouts_enabled ?? false,
    requirements: normalizeRequirements(account),
    disabledReason: account.requirements?.disabled_reason ?? null,
  };
}

export async function ensureStripeConnectAccount({
  userId,
  email,
  name,
}: CreateConnectAccountInput): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeConnectAccountId: true },
  });

  if (existing?.stripeConnectAccountId) {
    return existing.stripeConnectAccountId;
  }

  const baseUrl = getSiteUrl();

  const account = await stripe.accounts.create({
    type: "express",
    country: "US",
    email,
    business_type: "individual",
    capabilities: {
      transfers: { requested: true },
    },
    business_profile: {
      name: name ?? undefined,
      url: baseUrl,
      product_description: "Pet waste cleanup service",
    },
    metadata: {
      userId,
    },
    settings: {
      payouts: {
        schedule: {
          interval: "manual",
        },
      },
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { stripeConnectAccountId: account.id },
  });

  return account.id;
}

export async function createStripeConnectAccountLink(accountId: string) {
  const baseUrl = getSiteUrl();
  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl}/mobile/payouts/refresh`,
    return_url: `${baseUrl}/mobile/payouts/return`,
    type: "account_onboarding",
  });
}

export async function createStripeConnectLoginLink(accountId: string) {
  return stripe.accounts.createLoginLink(accountId);
}

export async function createStripePayoutTransfer(
  input: StripePayoutTransferInput,
): Promise<Stripe.Transfer> {
  const amount = Math.max(0, Math.round(input.amountCents));
  if (!amount) {
    throw new Error("payout_amount_invalid");
  }

  return stripe.transfers.create({
    amount,
    currency: "usd",
    destination: input.destinationAccountId,
    transfer_group: input.payoutId,
    metadata: {
      payoutId: input.payoutId,
      scooperId: input.scooperId,
      orgId: input.orgId,
      serviceVisitId: input.serviceVisitId ?? "",
    },
  });
}
