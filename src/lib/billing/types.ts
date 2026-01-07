export type BillingPreference = "monthly" | "weekly" | "per-visit" | "one-time";

export type LedgerEntryType = "CHARGE" | "CREDIT" | "ADJUSTMENT";
export type LedgerEntryStatus = "PENDING" | "APPLIED" | "VOID";

export interface TrialConfiguration {
  trialStartsAt: Date | null;
  trialEndsAt: Date | null;
  activationStartsAt: Date | null;
  firstChargeAt: Date | null;
  freeDays: number;
  billingCadenceDays: number | null;
  billingDelayDays: number | null;
}

export interface BillingPlanInput {
  orgId: string;
  jobId: string;
  customerId: string;
  stripeCustomerId?: string | null;
  billingPreference: BillingPreference;
  stripeScheduleId?: string | null;
  stripeSubscriptionId?: string | null;
  trialEndsAt?: Date | null;
  firstChargeAmountCents?: number | null;
  recurringAmountCents?: number | null;
  perVisitAmountCents?: number | null;
  pricingSnapshot?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export interface LedgerEntryInput {
  orgId: string;
  jobId: string;
  customerId: string;
  amountCents: number;
  type: LedgerEntryType;
  description?: string;
  serviceVisitId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface VisitChargeContext {
  orgId: string;
  jobId: string;
  customerId: string;
  serviceVisitId: string;
  billingPreference: BillingPreference;
  amountCents: number;
  serviceFrequency?: string | null;
  weekendUpgrade?: boolean | null;
}
