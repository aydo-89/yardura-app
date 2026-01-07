import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type { BillingPlanInput, TrialConfiguration } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

const toJson = (value?: Record<string, unknown> | null) =>
  (value ?? Prisma.JsonNull) as Prisma.InputJsonValue;

const normalizeDate = (value: Date | null | undefined): Date => {
  const source = value ?? new Date();
  return new Date(source.getFullYear(), source.getMonth(), source.getDate());
};

export function calculateTrialConfiguration(
  billingPreference: "monthly" | "weekly",
  rawFrequency: string | null,
  scheduledStartDate?: Date | null,
  referenceDate: Date = new Date(),
): TrialConfiguration {
  const normalizedFrequency = (rawFrequency ?? "")
    .toLowerCase()
    .replace(/_/g, "-");

  const trialLengthDays = (() => {
    switch (normalizedFrequency) {
      case "biweekly":
      case "bi-weekly":
      case "every-other-week":
        return 14;
      case "twice-weekly":
      case "twiceweekly":
      case "daily":
      case "weekly":
      case "monthly":
      default:
        return 7;
    }
  })();

  const trialStartsAt = normalizeDate(
    scheduledStartDate && !Number.isNaN(scheduledStartDate.getTime())
      ? scheduledStartDate
      : referenceDate,
  );

  const activationStartsAt = new Date(
    trialStartsAt.getTime() + trialLengthDays * DAY_MS,
  );

  const billingCadenceDays = (() => {
    if (billingPreference === "monthly") {
      return 30;
    }
    switch (normalizedFrequency) {
      case "biweekly":
      case "bi-weekly":
      case "every-other-week":
        return 14;
      default:
        return 7;
    }
  })();

  const billingDelayDays = billingCadenceDays > 0 ? billingCadenceDays + 1 : null;

  const firstChargeAt = billingDelayDays
    ? new Date(activationStartsAt.getTime() + billingDelayDays * DAY_MS)
    : new Date(activationStartsAt.getTime());

  return {
    trialStartsAt,
    trialEndsAt: activationStartsAt,
    activationStartsAt,
    firstChargeAt,
    freeDays: trialLengthDays,
    billingCadenceDays,
    billingDelayDays,
  };
}

export async function upsertBillingPlan(input: BillingPlanInput) {
  const {
    jobId,
    customerId,
    orgId,
    stripeCustomerId,
    billingPreference,
    stripeScheduleId,
    stripeSubscriptionId,
    trialEndsAt,
    firstChargeAmountCents,
    recurringAmountCents,
    perVisitAmountCents,
    pricingSnapshot,
    metadata,
  } = input;

  return prisma.customerBillingPlan.upsert({
    where: { jobId },
    create: {
      id: `plan_${jobId}`,
      jobId,
      customerId,
      orgId,
      stripeCustomerId: stripeCustomerId ?? null,
      billingPreference,
      stripeScheduleId: stripeScheduleId ?? null,
      stripeSubscriptionId: stripeSubscriptionId ?? null,
      trialEndsAt: trialEndsAt ?? null,
      firstChargeAmountCents: firstChargeAmountCents ?? null,
      recurringAmountCents: recurringAmountCents ?? null,
      perVisitAmountCents: perVisitAmountCents ?? null,
      pricingSnapshot: toJson(pricingSnapshot),
      metadata: toJson(metadata),
    },
    update: {
      billingPreference,
      stripeCustomerId: stripeCustomerId ?? undefined,
      stripeScheduleId: stripeScheduleId ?? undefined,
      stripeSubscriptionId: stripeSubscriptionId ?? undefined,
      trialEndsAt: trialEndsAt ?? undefined,
      firstChargeAmountCents: firstChargeAmountCents ?? undefined,
      recurringAmountCents: recurringAmountCents ?? undefined,
      perVisitAmountCents: perVisitAmountCents ?? undefined,
      pricingSnapshot: pricingSnapshot ? toJson(pricingSnapshot) : undefined,
      metadata: metadata ? toJson(metadata) : undefined,
    },
  });
}

export async function getPlanBySubscriptionId(subscriptionId: string) {
  try {
    return await prisma.customerBillingPlan.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
    });
  } catch (error: any) {
    if (error?.code === "P2021") {
      return null;
    }
    throw error;
  }
}

export async function getPlanByJobId(jobId: string) {
  try {
    return await prisma.customerBillingPlan.findUnique({
      where: { jobId },
    });
  } catch (error: any) {
    if (error?.code === "P2021") {
      return null;
    }
    throw error;
  }
}
