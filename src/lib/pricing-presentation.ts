import { PricingData } from "@/types/quote";

export interface TrialWeekLineItem {
  key: string;
  label: string;
  amountCents: number;
  detail?: string;
}

export interface TrialWeekPresentation {
  charges: TrialWeekLineItem[];
  credits: TrialWeekLineItem[];
  totalValueCents: number;
  totalCreditCents: number;
  netDueCents: number;
  followUpVisitCount: number;
  descriptor: string | null;
  trialLengthDays: number | null;
}

export interface PostTrialPresentation {
  perVisitCents: number | null;
  monthlyCents: number | null;
  firstInvoiceAddOns: TrialWeekLineItem[];
  firstInvoiceTotalCents: number;
  activationDelayDays: number | null;
}

export function describeFirstWeekCoverage(
  frequency?: string | null,
  followUpVisitCount = 0,
): string | null {
  const key = frequency?.toLowerCase();
  if (!key || key === "onetime" || key === "one-time") return null;

  if ((key === "daily" || key === "weekday") && followUpVisitCount > 0) {
    if (followUpVisitCount >= 6) {
      return "Initial clean + six daily visits on us (Mon–Sun coverage).";
    }
    return "Initial clean + four weekday visits on us.";
  }
  if (key === "twice-weekly" && followUpVisitCount > 0) {
    return "Initial clean + follow-up visit on us.";
  }
  if (key === "biweekly" || key === "bi-weekly" || key === "every-other-week") {
    return "Initial clean on us — subscription activates after 14 days.";
  }
  return "Initial clean on us.";
}

export function deriveTrialWeekPresentation(
  pricing: PricingData,
  frequency?: string,
): TrialWeekPresentation | null {
  const trial = pricing.trialWeek;
  if (!trial) return null;

  const charges: TrialWeekLineItem[] = [];
  if (trial.initialCleanCents > 0) {
    charges.push({
      key: "initial-clean",
      label: "Initial clean",
      amountCents: trial.initialCleanCents,
    });
  }
  if (trial.followUpVisitCount > 0 && trial.followUpVisitsCents > 0) {
    charges.push({
      key: "follow-up",
      label:
        trial.followUpVisitCount === 1
          ? "Follow-up visit"
          : `${trial.followUpVisitCount} trial visits`,
      amountCents: trial.followUpVisitsCents,
    });
  }

  const credits: TrialWeekLineItem[] = [];
  if (trial.creditsCents.initialClean > 0) {
    credits.push({
      key: "initial-clean-credit",
      label: "Initial clean credit",
      amountCents: trial.creditsCents.initialClean,
    });
  }
  if (trial.creditsCents.followUpVisits > 0) {
    credits.push({
      key: "follow-up-credit",
      label:
        trial.followUpVisitCount > 1
          ? "Trial visit credit"
          : "Follow-up visit credit",
      amountCents: trial.creditsCents.followUpVisits,
    });
  }

  const totalCharges = charges.reduce((sum, item) => sum + item.amountCents, 0);
  const totalCredits = credits.reduce((sum, item) => sum + item.amountCents, 0);
  const explicitNetDue =
    typeof trial.netDueCents === "number" && Number.isFinite(trial.netDueCents)
      ? Math.max(trial.netDueCents, 0)
      : null;

  const normalizedFrequency = frequency?.toLowerCase();
  let trialLengthDays: number | null = null;
  if (typeof trial.trialLengthDays === "number") {
    trialLengthDays = trial.trialLengthDays;
  } else if (normalizedFrequency && normalizedFrequency !== "onetime" && normalizedFrequency !== "one-time") {
    trialLengthDays = normalizedFrequency === "biweekly" || normalizedFrequency === "bi-weekly" || normalizedFrequency === "every-other-week" ? 14 : 7;
  }

  return {
    charges,
    credits,
    totalValueCents: totalCharges,
    totalCreditCents: totalCredits,
    netDueCents:
      explicitNetDue !== null ? explicitNetDue : Math.max(totalCharges - totalCredits, 0),
    followUpVisitCount: trial.followUpVisitCount,
    descriptor: describeFirstWeekCoverage(frequency, trial.followUpVisitCount),
    trialLengthDays,
  };
}

export function derivePostTrialPresentation(pricing: PricingData): PostTrialPresentation {
  const postTrial = pricing.postTrial;
  if (!postTrial) {
    return {
      perVisitCents: null,
      monthlyCents: null,
      firstInvoiceAddOns: [],
      firstInvoiceTotalCents: 0,
      activationDelayDays: null,
    };
  }

  const addOnEntries: TrialWeekLineItem[] = [];
  const breakdown = postTrial.firstInvoiceAddOns || {};
  Object.entries(breakdown).forEach(([key, value]) => {
    if (!value) return;
    const amount = typeof value === "number" ? value : Number(value) || 0;
    if (amount <= 0) return;
    const label =
      key === "deodorize"
        ? "Deodorize & sanitize"
        : key === "sprayDeck"
          ? "Spray deck/patio"
          : "One-time extras";
    addOnEntries.push({ key: `addon-${key}`, label, amountCents: amount });
  });

  const firstInvoiceTotal = postTrial.firstInvoiceAddOnsCents ?? addOnEntries.reduce((sum, item) => sum + item.amountCents, 0);

  return {
    perVisitCents: postTrial.recurringPerVisitCents ?? null,
    monthlyCents: postTrial.recurringMonthlyCents ?? null,
    firstInvoiceAddOns: addOnEntries,
    firstInvoiceTotalCents: firstInvoiceTotal,
    activationDelayDays:
      typeof postTrial.activationDelayDays === "number"
        ? postTrial.activationDelayDays
        : null,
  };
}
