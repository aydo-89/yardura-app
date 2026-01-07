"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import {
  loadStripe,
  type Appearance,
  type StripeElementsOptions,
  type StripePaymentElementOptions,
} from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import Link from "next/link";
import {
  CheckCircle,
  CreditCard,
  AlertCircle,
  Loader2,
  ArrowRight,
  Tag,
  Calendar,
  Clock,
  Sparkles,
  ShieldCheck,
  Phone,
  Mail,
  MapPin,
  CalendarCheck,
  ChevronDown,
  Fence,
  DoorOpen,
  KeyRound,
  KeySquare,
  Trash2,
  Dog,
  Home,
  Building2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { format, addDays } from "date-fns";
import { ScheduleSelector } from "@/components/onboarding/ScheduleSelector";
import { cn } from "@/lib/utils";
import type { PricingData } from "@/types/quote";
import {
  deriveTrialWeekPresentation,
  derivePostTrialPresentation,
  describeFirstWeekCoverage,
} from "@/lib/pricing-presentation";
import { formatVisitsRange } from "@/lib/utils";
import { computeIntroCredits, summarizeIntroCredits } from "@/lib/billing/introCredits";
import { FirstWeekCreditBanner } from "@/components/quote/components/FirstWeekCreditBanner";
import { InitialCleanLabel } from "@/components/quote/InitialCleanTooltip";
import { extractWeekendUpgrade } from "@/lib/pricing/weekend";

// Brand-aligned styling for onboarding flow - uses Tailwind dark mode
const ONBOARDING_SHELL_CLASS =
  "min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white";
const ONBOARDING_PANEL_CLASS =
  "rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg";
const ONBOARDING_PANEL_DESKTOP_RESET =
  ""; // No longer needed with unified dark mode approach
const ONBOARDING_SUBTLE_TEXT =
  "text-slate-600 dark:text-slate-300";
const ONBOARDING_HEADING_CLASS =
  "font-serif font-normal text-slate-900 dark:text-white";
const ONBOARDING_CARD_IDLE =
  "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 hover:border-brand-coral/40 hover:bg-slate-50 dark:hover:bg-slate-700";
const ONBOARDING_CARD_SELECTED =
  "border-brand-coral bg-brand-coral/10 dark:bg-brand-coral/20 text-slate-900 dark:text-white shadow-lg";
// Consistent input styling for light and dark modes
const ONBOARDING_INPUT_CLASS =
  "rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-brand-coral/40 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500";
// Yes/No button styling
const ONBOARDING_YESNO_IDLE =
  "border-slate-300 bg-white text-slate-700 hover:border-brand-coral/50 hover:bg-brand-coral/5 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-coral/40 dark:hover:bg-brand-coral/10";
const ONBOARDING_YESNO_SELECTED =
  "border-brand-coral bg-brand-coral/15 text-slate-900 shadow-md dark:bg-brand-coral/25 dark:text-white";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

const USD_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

interface LeadData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  serviceType: string;
  dogs: number;
  yardSize: string;
  frequency: string;
  address: string;
  city: string;
  zipCode: string;
  addOns: {
    deodorize?: boolean;
    deodorizeMode?: string;
    sprayDeck?: boolean;
    sprayDeckMode?: string;
    divertMode?: string;
  };
  submittedAt: string;
  pricing?: PricingData | Record<string, unknown> | null;
  pricingBreakdown?: Record<string, unknown> | string | null;
}

interface SetupIntentData {
  clientSecret: string;
  pricing: PricingData;
  promoCode?: unknown;
}

const toCents = (value: unknown): number => {
  if (typeof value === "number") {
    if (Number.isInteger(value)) return value;
    return Math.round(value * 100);
  }
  if (typeof value === "string") {
    const normalized = value.replace(/[$,\s]/g, "");
    if (!normalized) return 0;
    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed)) return 0;
    return normalized.includes(".") ? Math.round(parsed * 100) : Math.round(parsed);
  }
  return 0;
};

const getServiceCadenceDays = (frequency: string): number => {
  switch (frequency) {
    case "daily":
    case "weekday":
    case "twice-weekly":
    case "weekly":
      return 7;
    case "biweekly":
    case "bi-weekly":
    case "every-other-week":
      return 14;
    case "monthly":
      return 30;
    default:
      return 7;
  }
};

interface BillingPreviewProps {
  pricing: PricingData;
  frequencyKey: string;
  billingPreference: "monthly" | "weekly";
  onBillingPreferenceChange?: (preference: "monthly" | "weekly") => void;
  kickoffDate?: Date | null;
  showActivationDetails?: boolean;
}

function BillingPreview({
  pricing,
  frequencyKey,
  billingPreference,
  onBillingPreferenceChange,
  kickoffDate = null,
  showActivationDetails = true,
}: BillingPreviewProps) {
  const normalizedFrequency = frequencyKey
    ? frequencyKey.toLowerCase().replace(/_/g, "-").trim()
    : "weekly";
  const derivedFrequency =
    normalizedFrequency === "onetime" ? "one-time" : normalizedFrequency;

  const pricingRecord = (pricing ?? null) as unknown as Record<string, unknown> | null;
  const hasWeekendCoverage = extractWeekendUpgrade(
    pricing,
    pricingRecord && typeof pricingRecord.breakdown !== "undefined"
      ? pricingRecord.breakdown
      : null,
  );

  const trialWeekPresentation = useMemo(
    () => deriveTrialWeekPresentation(pricing, derivedFrequency),
    [pricing, derivedFrequency],
  );

  const postTrialPresentation = useMemo(
    () => derivePostTrialPresentation(pricing),
    [pricing],
  );

  const isOneTime = derivedFrequency === "one-time";
  const perVisitAvailable = !isOneTime
    && [
      "weekly",
      "twice-weekly",
      "biweekly",
      "bi-weekly",
      "every-other-week",
      "daily",
    ].includes(derivedFrequency);

  const visitsPerMonthValue = (() => {
    if (typeof pricing.visitsPerMonth === "number") {
      return pricing.visitsPerMonth;
    }
    if (typeof pricing.visitsPerMonth === "string") {
      const parsed = Number.parseFloat(pricing.visitsPerMonth);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  })();

  const visitsPerMonthRange = formatVisitsRange(visitsPerMonthValue ?? undefined);
  const approxVisitsLabel = visitsPerMonthRange
    ? `Typically ${visitsPerMonthRange}`
    : null;

  const perVisitBaseCents =
    postTrialPresentation.perVisitCents ?? toCents(pricing.perVisit);
  const monthlyCandidateCents =
    postTrialPresentation.monthlyCents ??
    toCents(pricing.fullMonthlyAmount ?? pricing.monthly);
  const computedMonthlyFromVisits =
    perVisitBaseCents > 0 && visitsPerMonthValue
      ? Math.round(perVisitBaseCents * visitsPerMonthValue)
      : null;
  const monthlyAmountCents = monthlyCandidateCents > 0
    ? monthlyCandidateCents
    : computedMonthlyFromVisits ?? 0;

  const billingView: "monthly" | "per-visit" = perVisitAvailable
    ? billingPreference === "monthly"
      ? "monthly"
      : "per-visit"
    : "monthly";

  const handleToggle = (view: "monthly" | "per-visit") => {
    if (!perVisitAvailable) return;
    if (view === "monthly") {
      onBillingPreferenceChange?.("monthly");
    } else {
      onBillingPreferenceChange?.("weekly");
    }
  };

  const perVisitMultiplier = (() => {
    if (derivedFrequency === "daily") return hasWeekendCoverage ? 7 : 5;
    if (derivedFrequency === "twice-weekly") return 2;
    return 1;
  })();

  const perVisitPrimaryDisplayCents = perVisitBaseCents * perVisitMultiplier;

  const usesSkipCreditForPerVisit =
    derivedFrequency === "daily" || derivedFrequency === "twice-weekly";

  const perVisitPrimaryLabel = (() => {
    switch (derivedFrequency) {
      case "twice-weekly":
        return "per service week (2 visits)";
      case "daily":
        return hasWeekendCoverage
          ? "per service week (Mon–Sun coverage)"
          : "per service week (weekday visits)";
      case "biweekly":
      case "bi-weekly":
      case "every-other-week":
        return "per visit (every other week)";
      case "weekly":
        return "per service week";
      default:
        return "per visit";
    }
  })();

  const perVisitPrimaryDescription = (() => {
    switch (derivedFrequency) {
      case "daily":
        return hasWeekendCoverage
          ? "Seven-day coverage bundled into one weekly charge."
          : "Five weekday visits bundled into one weekly charge.";
      case "twice-weekly":
        return "Two visits bundled into a single weekly charge.";
      case "biweekly":
      case "bi-weekly":
      case "every-other-week":
        return "Card runs the day after each every-other-week visit.";
      case "weekly":
        return "Card runs once the service week wraps.";
      default:
        return "Card runs after each completed visit.";
    }
  })();

  const skipCreditDisplay = perVisitBaseCents > 0
    ? USD_FORMATTER.format(perVisitBaseCents / 100)
    : "$0.00";

  const perVisitSkipCopy = usesSkipCreditForPerVisit
    ? `Skip or cancel a visit and we drop a ${skipCreditDisplay} credit automatically.`
    : "Skip or cancel a visit and there's no charge.";

  const trialBannerSubtext = (() => {
    if (!trialWeekPresentation) {
      return "We zero out the kickoff week before your first invoice.";
    }
    if (derivedFrequency === "daily") {
      return hasWeekendCoverage
        ? "We picked up seven straight days of service (Mon–Sun) before billing begins."
        : "We picked up the five weekday sweeps before billing begins.";
    }
    if (trialWeekPresentation.trialLengthDays === 14) {
      return "We picked up the most expensive two weeks of service.";
    }
    return "We picked up the most expensive week of service.";
  })();

  const firstWeekDescriptor =
    trialWeekPresentation?.descriptor ??
    describeFirstWeekCoverage(derivedFrequency, trialWeekPresentation?.followUpVisitCount ?? 0) ??
      "Initial clean on us.";

  const cadenceDays = getServiceCadenceDays(derivedFrequency);
  const activationDelayDays =
    trialWeekPresentation?.trialLengthDays ??
    postTrialPresentation.activationDelayDays ??
    (derivedFrequency === "biweekly" || derivedFrequency === "bi-weekly" || derivedFrequency === "every-other-week" ? 14 : 7);

  const activationDate = kickoffDate
    ? addDays(kickoffDate, activationDelayDays)
    : null;

  const activationCopy = showActivationDetails
    ? activationDate
      ? `Subscription activates ${format(activationDate, "MMM d")}.`
      : activationDelayDays === 14
        ? "Subscription activates two weeks after your kickoff visit."
        : "Subscription activates one week after your kickoff visit."
    : null;

  const firstInvoiceDate = activationDate
    ? addDays(
        activationDate,
        billingPreference === "monthly"
          ? 30
          : cadenceDays + 1,
      )
    : null;

  const billingNote = showActivationDetails
    ? firstInvoiceDate
      ? billingPreference === "monthly"
        ? `We’ll run your monthly invoice on ${format(firstInvoiceDate, "MMM d")}.`
        : `We’ll run your ${derivedFrequency === "biweekly" || derivedFrequency === "bi-weekly" || derivedFrequency === "every-other-week" ? "every-other-week" : "weekly"} charge on ${format(firstInvoiceDate, "MMM d")}.`
      : billingPreference === "monthly"
        ? "Monthly billing begins 30 days after activation."
        : cadenceDays === 14
          ? "Per-visit billing begins two weeks after activation."
          : "Per-visit billing begins one week after activation."
    : null;

  const addOnEntries = postTrialPresentation.firstInvoiceAddOns.filter(
    (item) => item.amountCents > 0,
  );

  if (isOneTime) {
    const oneTimeCents = toCents(pricing.oneTime ?? pricing.firstVisitTotalCents ?? pricing.amountDueToday ?? 0);
    return (
      <section className="space-y-4">
        <div className="space-y-3 rounded-3xl border border-slate-200 dark:border-slate-600/30 bg-white dark:bg-slate-800 p-6 text-slate-700 dark:text-slate-200 shadow-[0_22px_60px_rgba(0,0,0,0.45)] md:rounded-2xl md:border-brand-soft md:bg-white md:text-slate-900 dark:text-white md:shadow-none">
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-300/80 md:text-[rgba(var(--graphite-rgb-commas),0.5)]">
            One-time visit overview
          </h3>
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-4xl font-black leading-none text-slate-900 dark:text-white md:text-[2.75rem] md:text-slate-900 dark:text-white">
              {USD_FORMATTER.format(oneTimeCents / 100)}
            </span>
            <span className="text-sm text-slate-600 dark:text-slate-300/70 md:text-[rgba(var(--graphite-rgb-commas),0.6)]">
              Charged after your clean wraps.
            </span>
          </div>
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300/75 md:text-[rgba(var(--graphite-rgb-commas),0.65)]">
            We save your card securely today and invoice once the cleanup is complete—no charge until the visit is finished.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="space-y-5 rounded-3xl border border-slate-200 dark:border-slate-600/25 bg-white dark:bg-slate-800 p-6 text-slate-700 dark:text-slate-200 shadow-[0_24px_70px_rgba(0,0,0,0.45)] md:rounded-2xl md:border-brand-soft md:bg-white md:text-slate-900 dark:text-white md:shadow-none">
        {trialWeekPresentation ? (
          <>
            <FirstWeekCreditBanner
              amount={USD_FORMATTER.format(
                (trialWeekPresentation.totalValueCents ?? 0) / 100,
              )}
              netAmount={USD_FORMATTER.format(
                (trialWeekPresentation.netDueCents ?? 0) / 100,
              )}
              descriptor={firstWeekDescriptor}
              subtext={trialBannerSubtext}
              className="text-left"
              tone="dark"
            />

            <div className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-600/30 bg-white dark:bg-slate-800 p-4 md:border-[rgba(var(--graphite-rgb-commas),0.12)] md:bg-slate-100 dark:bg-slate-700">
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300/70 md:text-[rgba(var(--graphite-rgb-commas),0.48)]">
                Free trial week breakdown
              </div>
              <div className="space-y-2 text-sm">
                {trialWeekPresentation.charges.map((item) => (
                  <div
                    key={`trial-charge-${item.key}`}
                    className="flex items-center justify-between"
                  >
                    <span>
                      {item.key === "initial-clean" ? (
                        <InitialCleanLabel
                          label={item.label}
                          className="inline-flex items-center gap-1"
                          iconClassName="text-slate-600 dark:text-slate-300/70 md:text-[rgba(var(--graphite-rgb-commas),0.55)]"
                        />
                      ) : (
                        item.label
                      )}
                    </span>
                    <span className="font-semibold">
                      {USD_FORMATTER.format(item.amountCents / 100)}
                    </span>
                  </div>
                ))}
              </div>
              {trialWeekPresentation.credits.length ? (
                <div className="space-y-2 border-t border-slate-200 dark:border-slate-600/25 pt-3 text-sm md:border-[rgba(var(--graphite-rgb-commas),0.12)]">
                  {trialWeekPresentation.credits.map((item) => (
                    <div
                      key={`trial-credit-${item.key}`}
                      className="flex items-center justify-between text-brand-coral"
                    >
                      <span>{item.label}</span>
                      <span className="font-semibold">
                        -{USD_FORMATTER.format(item.amountCents / 100)}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-base font-black text-slate-700 dark:text-slate-200 md:text-slate-900 dark:text-white">
                    <span>Trial week total</span>
                    <span>
                      {USD_FORMATTER.format(
                        (trialWeekPresentation.netDueCents ?? 0) / 100,
                      )}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        <div className="space-y-4 border-t border-slate-200 dark:border-slate-600/20 pt-4 md:border-[rgba(var(--graphite-rgb-commas),0.12)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300/70 md:text-[rgba(var(--graphite-rgb-commas),0.48)]">
              After the trial
            </span>
            {activationCopy ? (
              <span className="text-xs text-slate-600 dark:text-slate-300/70 md:text-[rgba(var(--graphite-rgb-commas),0.58)]">
                {activationCopy}
              </span>
            ) : null}
          </div>

          {perVisitAvailable ? (
            <div className="inline-flex rounded-full border border-brand-coral/40/40 bg-slate-100 dark:bg-slate-700 p-1 text-xs font-semibold text-slate-900 dark:text-white md:border-brand-soft md:bg-slate-100 dark:bg-slate-700/80 md:text-slate-900 dark:text-white">
              <button
                type="button"
                className={cn(
                  "rounded-full px-4 py-1.5 transition",
                  billingView === "monthly"
                    ? "bg-brand-coral text-slate-900 shadow md:bg-brand-coral md:text-white"
                    : "bg-transparent hover:bg-brand-coral/10 md:hover:bg-white/70",
                )}
                onClick={() => handleToggle("monthly")}
              >
                Monthly plan
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-full px-4 py-1.5 transition",
                  billingView === "per-visit"
                    ? "bg-brand-coral text-slate-900 shadow md:bg-brand-coral md:text-white"
                    : "bg-transparent hover:bg-brand-coral/10 md:hover:bg-white/70",
                )}
                onClick={() => handleToggle("per-visit")}
              >
                {derivedFrequency === "twice-weekly" || derivedFrequency === "daily"
                  ? "Weekly billing"
                  : "Pay per visit"}
              </button>
            </div>
          ) : null}

          <div className="space-y-3">
            {billingView === "per-visit" && perVisitAvailable ? (
              <div className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-600/30 bg-slate-50 dark:bg-slate-800 px-4 py-4 text-slate-600 dark:text-slate-300/85 md:border-brand-soft md:bg-slate-100 dark:bg-slate-700/80 md:text-[rgba(var(--graphite-rgb-commas),0.78)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:text-slate-300/70 md:text-[rgba(var(--graphite-rgb-commas),0.5)]">
                      {derivedFrequency === "daily"
                        ? "Weekday plan"
                        : derivedFrequency === "twice-weekly"
                          ? "Weekly plan"
                          : "Per-visit plan"}
                    </span>
                    <div className="text-2xl font-black text-slate-900 dark:text-white md:text-slate-900 dark:text-white">
                      {USD_FORMATTER.format(perVisitPrimaryDisplayCents / 100)}
                    </div>
                    <span className="text-xs text-slate-600 dark:text-slate-300/70 md:text-[rgba(var(--graphite-rgb-commas),0.6)]">
                      {perVisitPrimaryLabel}
                    </span>
                  </div>
                  {approxVisitsLabel ? (
                    <span className="text-xs text-slate-600 dark:text-slate-300/70 md:text-[rgba(var(--graphite-rgb-commas),0.6)]">
                      {approxVisitsLabel}
                    </span>
                  ) : null}
                </div>
                      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300/80 md:text-[rgba(var(--graphite-rgb-commas),0.65)]">
                        {perVisitPrimaryDescription} {perVisitSkipCopy}
                      </p>
              </div>
            ) : null}

            {billingView === "monthly" ? (
              <div className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-600/30 bg-slate-50 dark:bg-slate-800 px-4 py-4 text-slate-600 dark:text-slate-300/85 md:border-brand-soft md:bg-slate-100 dark:bg-slate-700/80 md:text-[rgba(var(--graphite-rgb-commas),0.78)]">
                <div className="flex items-start justify-between gap-3 md:flex-nowrap">
                  <div className="min-w-0 space-y-1">
                    <span className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:text-slate-300/70 md:text-[rgba(var(--graphite-rgb-commas),0.5)]">
                      Monthly plan
                    </span>
                    <div className="text-2xl font-black text-slate-900 dark:text-white md:text-slate-900 dark:text-white">
                      {monthlyAmountCents > 0
                        ? USD_FORMATTER.format(monthlyAmountCents / 100)
                        : visitsPerMonthValue && perVisitBaseCents > 0
                          ? USD_FORMATTER.format(
                              Math.round(perVisitBaseCents * visitsPerMonthValue) / 100,
                            )
                          : USD_FORMATTER.format(perVisitBaseCents / 100)}
                    </div>
                    <span className="text-xs text-slate-600 dark:text-slate-300/70 whitespace-nowrap md:text-[rgba(var(--graphite-rgb-commas),0.6)]">
                      Flat invoice every 30 days.
                    </span>
                  </div>
                  {approxVisitsLabel ? (
                    <span className="flex-shrink-0 text-xs text-slate-600 dark:text-slate-300/70 md:text-[rgba(var(--graphite-rgb-commas),0.6)]">
                      {approxVisitsLabel}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300/80 md:text-[rgba(var(--graphite-rgb-commas),0.65)]">
                  We average your visits across the calendar so billing stays predictable. Skip a visit and we apply a {skipCreditDisplay} credit to the next statement automatically.
                </p>
              </div>
            ) : null}
          </div>

          {billingNote ? (
            <p className="text-[0.7rem] text-slate-600 dark:text-slate-300/70 md:text-[rgba(var(--graphite-rgb-commas),0.58)]">
              {billingNote}
            </p>
          ) : null}

          {addOnEntries.length ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-600/30 bg-white dark:bg-slate-700 p-4 text-sm md:border-[rgba(var(--graphite-rgb-commas),0.12)] md:bg-white">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300/70 md:text-[rgba(var(--graphite-rgb-commas),0.5)]">
                First paid invoice add-ons
              </div>
              <div className="mt-2 space-y-2">
                {addOnEntries.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between"
                  >
                    <span>{item.label}</span>
                    <span className="font-semibold">
                      {USD_FORMATTER.format(item.amountCents / 100)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

const DIVERT_LABELS: Record<string, string> = {
  takeaway: "Full haul-away",
  "100": "Compost routing (capacity-dependent)",
};

const toTitleCase = (value?: string | null): string => {
  if (!value) return "";
  return value
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

function PaymentForm({
  setupIntentData,
  leadData,
  onComplete,
  onBillingPreferencePreviewChange,
  isOneTimeService,
  projectedOneTimeInvoiceCents: projectedOneTimeInvoiceCentsProp,
}: {
  setupIntentData: SetupIntentData;
  leadData: LeadData;
  onComplete: (result: {
    setupIntentId: string;
    paymentMethodId?: string | null;
    amountChargedCents: number;
    billingPreference: "monthly" | "weekly";
  }) => void;
  onBillingPreferencePreviewChange?: (preference: "monthly" | "weekly") => void;
  isOneTimeService: boolean;
  projectedOneTimeInvoiceCents: number;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const pricing = setupIntentData.pricing;

  const paymentPricingRecord = (pricing ?? null) as unknown as Record<string, unknown> | null;
  const hasWeekendCoverage = extractWeekendUpgrade(
    pricing,
    paymentPricingRecord && typeof paymentPricingRecord.breakdown !== "undefined"
      ? paymentPricingRecord.breakdown
      : null,
  );

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(min-width: 768px)").matches;
  });
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return document.documentElement.classList.contains("dark");
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const update = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    setIsDesktop(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Check for class-based dark mode (Tailwind uses "dark" class on html)
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };
    checkDarkMode();
    // Observe class changes on the html element
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const [billingPreference, setBillingPreference] = useState<"monthly" | "weekly">(() => {
    if (isOneTimeService) return "weekly";
    if (typeof window !== "undefined") {
      const stored = window.sessionStorage.getItem("billingPreference");
      if (stored === "weekly" || stored === "monthly") return stored;
    }
    return "monthly";
  });

  useEffect(() => {
    try {
      window.sessionStorage.setItem("billingPreference", billingPreference);
    } catch (storageError) {
      console.warn("Unable to persist billing preference", storageError);
    }
  }, [billingPreference]);

  useEffect(() => {
    if (isOneTimeService && billingPreference !== "weekly") {
      setBillingPreference("weekly");
    }
  }, [isOneTimeService, billingPreference]);

  useEffect(() => {
    onBillingPreferencePreviewChange?.(billingPreference);
  }, [billingPreference, onBillingPreferencePreviewChange]);

  const frequencyKey = leadData.frequency || "weekly";
  const normalizedFrequency =
    frequencyKey.toLowerCase().replace(/_/g, "-").trim() || "weekly";
  const derivedFrequency =
    normalizedFrequency === "onetime" ? "one-time" : normalizedFrequency;

  const trialWeekPresentation = useMemo(
    () => deriveTrialWeekPresentation(pricing, derivedFrequency),
    [pricing, derivedFrequency],
  );
  const postTrialPresentation = useMemo(
    () => derivePostTrialPresentation(pricing),
    [pricing],
  );

  const visitsPerMonthValue = (() => {
    if (typeof pricing.visitsPerMonth === "number") {
      return pricing.visitsPerMonth;
    }
    if (typeof pricing.visitsPerMonth === "string") {
      const parsed = Number.parseFloat(pricing.visitsPerMonth);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  })();

  const perVisitBaseCents =
    postTrialPresentation.perVisitCents ?? toCents(pricing.perVisit);
  const monthlyCandidateCents =
    postTrialPresentation.monthlyCents ??
    toCents(pricing.fullMonthlyAmount ?? pricing.monthly);
  const computedMonthlyFromVisits =
    perVisitBaseCents > 0 && visitsPerMonthValue
      ? Math.round(perVisitBaseCents * (visitsPerMonthValue ?? 0))
      : null;
  const resolvedMonthlyCents =
    monthlyCandidateCents > 0
      ? monthlyCandidateCents
      : computedMonthlyFromVisits ?? 0;

  const todaysChargeCents = 0;

  const projectedOneTimeInvoiceCents = isOneTimeService
    ? (() => {
        const candidates = [
          pricing.oneTime,
          pricing.firstVisitTotalCents,
          pricing.amountDueToday,
          projectedOneTimeInvoiceCentsProp,
        ];
        for (const candidate of candidates) {
          const cents = toCents(candidate);
          if (cents > 0) return cents;
        }
        return 0;
      })()
    : 0;

  const perVisitBundleMultiplier = (() => {
    if (derivedFrequency === "daily") return hasWeekendCoverage ? 7 : 5;
    if (derivedFrequency === "twice-weekly") return 2;
    return 1;
  })();

  const perVisitWeeklyAmountCents = perVisitBaseCents * perVisitBundleMultiplier;
  const perVisitWeeklyDisplay = USD_FORMATTER.format(
    perVisitWeeklyAmountCents / 100,
  );
  const usesSkipCreditForPerVisit =
    derivedFrequency === "daily" || derivedFrequency === "twice-weekly";
  const skipCreditDisplay = USD_FORMATTER.format(perVisitBaseCents / 100);
  const perVisitSkipCopy = usesSkipCreditForPerVisit
    ? `Skip or cancel a visit and we drop a ${skipCreditDisplay} credit automatically.`
    : "Skip or cancel a visit and there’s no charge.";

  const monthlyDisplay =
    resolvedMonthlyCents > 0
      ? USD_FORMATTER.format(resolvedMonthlyCents / 100)
      : null;

  const perVisitTimingCopy = (() => {
    if (derivedFrequency === "daily") {
      return hasWeekendCoverage
        ? "after the seven visits in each service week once the free week wraps."
        : "after the five weekday visits in each service week once the free week wraps.";
    }
    if (derivedFrequency === "twice-weekly") {
      return "after the two visits in each service week once the free week wraps.";
    }
    if (
      derivedFrequency === "biweekly" ||
      derivedFrequency === "bi-weekly" ||
      derivedFrequency === "every-other-week"
    ) {
      return "the day after each every-other-week visit once the free week wraps.";
    }
    return "the day after each visit once the free week wraps.";
  })();

  const perVisitChargeSentence = `We’ll run ${perVisitWeeklyDisplay} ${perVisitTimingCopy}`;
  const perVisitSkipSentence = usesSkipCreditForPerVisit
    ? `Skipped visits automatically earn a ${skipCreditDisplay} credit.`
    : "Skipped visits aren't charged.";

  const billingExplainer = billingPreference === "monthly"
    ? monthlyDisplay
      ? `We’ll invoice ${monthlyDisplay} 30 days after your kickoff visit. Skip or cancel a visit and we drop a ${skipCreditDisplay} credit before the next statement.`
      : `We’ll average your visits into a flat monthly invoice 30 days after kickoff. Skip or cancel a visit and we drop a ${skipCreditDisplay} credit automatically.`
    : `${perVisitChargeSentence} ${perVisitSkipSentence}`;

  const trialValueCents = trialWeekPresentation?.totalValueCents ?? 0;
  const trialCoverageCopy = trialValueCents > 0
    ? `Your free kickoff coverage (${USD_FORMATTER.format(
        trialValueCents / 100,
      )}) applies automatically.`
    : null;

  const todaysTotalDisplay = USD_FORMATTER.format(0);

  const buttonLabel = `Save card & continue — ${todaysTotalDisplay} today`;

  const paymentElementContainerClass = cn(
    "rounded-xl border p-3 shadow-lg transition-colors",
    "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800",
  );

  const paymentElementOptions = useMemo<StripePaymentElementOptions>(
    () => {
      const lightAppearance: Appearance = {
        theme: "flat",
        variables: {
          colorPrimary: "#F3645B",
          colorPrimaryText: "#F3645B",
          colorBackground: "#FFFFFF",
          colorText: "#1B1E23",
          colorTextSecondary: "#475467",
          colorTextPlaceholder: "#64748B",
          colorDanger: "#C43D37",
          colorIcon: "#F3645B",
          colorIconTab: "#F3645B",
          colorIconTabSelected: "#C43D37",
          borderRadius: "12px",
          spacingUnit: "4px",
          fontLineHeight: "1.45",
        },
        rules: {
          ".Input": {
            border: "1px solid rgba(15, 23, 42, 0.18)",
            backgroundColor: "#FFFFFF",
            color: "#1B1E23",
          },
          ".Input::placeholder": {
            color: "#6B7280",
          },
          ".Input--focus": {
            borderColor: "#F3645B",
            boxShadow: "0 0 0 1px rgba(243, 100, 91, 0.25)",
          },
          ".Input--invalid": {
            borderColor: "#C43D37",
          },
          ".Tab": {
            border: "1px solid rgba(15, 23, 42, 0.12)",
            backgroundColor: "#FFFFFF",
            color: "#1B1E23",
          },
          ".Tab:hover": {
            color: "#F3645B",
          },
          ".Tab--selected": {
            borderColor: "#F3645B",
            backgroundColor: "rgba(243, 100, 91, 0.08)",
            color: "#C43D37",
          },
        },
      };

      const darkAppearance: Appearance = {
        theme: "flat",
        variables: {
          colorPrimary: "#F3645B",
          colorPrimaryText: "#F3645B",
          colorBackground: "#1e293b",
          colorText: "#f8fafc",
          colorTextSecondary: "#cbd5e1",
          colorTextPlaceholder: "#94a3b8",
          colorDanger: "#f87171",
          colorIcon: "#F3645B",
          colorIconTab: "#F3645B",
          colorIconTabSelected: "#F3645B",
          borderRadius: "12px",
          spacingUnit: "4px",
          fontLineHeight: "1.5",
        },
        rules: {
          ".Input": {
            border: "1px solid rgba(148, 163, 184, 0.3)",
            backgroundColor: "#1e293b",
            color: "#f8fafc",
          },
          ".Input::placeholder": {
            color: "#94a3b8",
          },
          ".Input--focus": {
            borderColor: "#F3645B",
            boxShadow: "0 0 0 1px rgba(243, 100, 91, 0.35)",
          },
          ".Input--invalid": {
            borderColor: "#f87171",
          },
          ".Tab": {
            border: "1px solid rgba(148, 163, 184, 0.2)",
            backgroundColor: "#334155",
            color: "#e2e8f0",
          },
          ".Tab:hover": {
            color: "#F3645B",
          },
          ".Tab--selected": {
            borderColor: "#F3645B",
            backgroundColor: "rgba(243, 100, 91, 0.2)",
            color: "#f8fafc",
          },
        },
      };

      return {
        layout: "tabs",
        appearance: isDarkMode ? darkAppearance : lightAppearance,
        defaultValues: {
          billingDetails: {
            name: `${leadData.firstName} ${leadData.lastName || ""}`.trim() || undefined,
            email: leadData.email || undefined,
            phone: leadData.phone || undefined,
            address: {
              line1: leadData.address || undefined,
              city: leadData.city || undefined,
              postal_code: leadData.zipCode || undefined,
              country: "US",
            },
          },
        },
      };
    },
    [
      leadData.address,
      leadData.city,
      leadData.email,
      leadData.firstName,
      leadData.lastName,
      leadData.phone,
      leadData.zipCode,
      isDarkMode,
    ],
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!termsAccepted) {
      setError(
        "Please review and agree to the InsightScoop terms before continuing.",
      );
      return;
    }

    if (!stripe || !elements) {
      setError("Payment system is still loading. Please try again in a moment.");
      return;
    }

    setIsProcessing(true);
    setError("");

    const submissionResult =
      typeof (elements as any).submit === "function"
        ? await (elements as any).submit()
        : null;

    if (submissionResult?.error) {
      setError(
        submissionResult.error.message || "Unable to submit payment details.",
      );
      setIsProcessing(false);
      return;
    }

    const billingName = `${leadData.firstName} ${leadData.lastName || ""}`.trim();

    const { error: confirmError, setupIntent } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        payment_method_data: {
          billing_details: {
            name: billingName || undefined,
            email: leadData.email,
            phone: leadData.phone || undefined,
            address: {
              line1: leadData.address || undefined,
              city: leadData.city || undefined,
              postal_code: leadData.zipCode || undefined,
            },
          },
        },
      },
      redirect: "if_required",
    });

    if (confirmError) {
      console.error("Payment setup failed:", confirmError);
      setError(
        confirmError.message ||
          "Payment setup failed. Please check your card details and try again.",
      );
      setIsProcessing(false);
      return;
    }

    if (!setupIntent) {
      setError("Payment setup failed. Please try again.");
      setIsProcessing(false);
      return;
    }

    if (
      setupIntent.status !== "succeeded" &&
      setupIntent.status !== "processing"
    ) {
      setError(
        setupIntent.status === "requires_action"
          ? "Additional authentication is required to save this card. Please follow the prompts and try again."
          : `Payment setup incomplete (status: ${setupIntent.status}). Please try again.`,
      );
      setIsProcessing(false);
      return;
    }

    const paymentMethodId =
      typeof setupIntent.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent.payment_method?.id ?? null;

    try {
      sessionStorage.setItem("setupIntentId", setupIntent.id);
      sessionStorage.setItem("billingPreference", billingPreference);
      sessionStorage.setItem("todaysChargeCents", String(todaysChargeCents));
      if (paymentMethodId) {
        sessionStorage.setItem("paymentMethodId", paymentMethodId);
      }
    } catch (storageError) {
      console.warn("Failed to persist payment metadata", storageError);
    }

    onComplete({
      setupIntentId: setupIntent.id,
      paymentMethodId,
      amountChargedCents: todaysChargeCents,
      billingPreference,
    });

    setIsProcessing(false);
  };

  return (
    <form
      id="payment-form"
      className="space-y-6 text-slate-700 dark:text-slate-200 md:text-slate-900 dark:text-white"
      onSubmit={handleSubmit}
    >
      <BillingPreview
        pricing={pricing}
        frequencyKey={frequencyKey}
        billingPreference={billingPreference}
        onBillingPreferenceChange={setBillingPreference}
      />

      <div className="space-y-3 rounded-3xl border border-slate-200 dark:border-slate-600/20 bg-white dark:bg-slate-800 p-5 shadow-[0_18px_40px_rgba(0,0,0,0.35)] md:rounded-2xl md:border-brand-soft md:bg-white md:shadow-none">
        {!stripePromise || !elements ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-600/25 bg-slate-50 dark:bg-slate-700 p-4 text-sm text-slate-700 dark:text-slate-200 md:border-brand-soft md:bg-slate-50 dark:bg-slate-700">
            Payment form is unavailable. Please contact support to finish onboarding.
          </div>
        ) : (
          <div className={paymentElementContainerClass}>
            <PaymentElement id="payment-element" options={paymentElementOptions} />
          </div>
        )}
        <p className="text-xs text-slate-600 dark:text-slate-300/70 md:text-[rgba(var(--graphite-rgb-commas),0.6)]">
          Stripe encrypts this form end-to-end. Your card details never touch our servers.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 dark:border-slate-600/20 bg-slate-50 dark:bg-slate-800 p-4 text-slate-700 dark:text-slate-200 shadow-[0_18px_40px_rgba(0,0,0,0.35)] md:rounded-2xl md:border-brand-soft md:bg-slate-100 dark:bg-slate-700/85 md:text-slate-900 dark:text-white md:shadow-none">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300/80 md:text-[rgba(var(--graphite-rgb-commas),0.55)]">
            Today's total
          </span>
          <span className="text-lg font-black text-slate-700 dark:text-slate-200 md:text-slate-900 dark:text-white">
            {todaysTotalDisplay}
          </span>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 dark:border-slate-600/25 bg-slate-50 dark:bg-slate-800 p-4 text-sm text-slate-700 dark:text-slate-200 md:rounded-xl md:border-brand-soft md:bg-white md:text-slate-900 dark:text-white">
        <Checkbox
          id="terms"
          checked={termsAccepted}
          onCheckedChange={(checked) => setTermsAccepted(Boolean(checked))}
        />
        <label htmlFor="terms" className="cursor-pointer text-xs leading-6 md:text-sm">
          I agree to the{" "}
          <Link
            href="/legal/terms"
            className="font-semibold text-slate-600 dark:text-slate-300 underline-offset-4 hover:text-slate-700 dark:text-slate-200 md:text-coral md:hover:text-coral-light md:font-medium"
          >
            Service Terms
          </Link>
          {" "}and{" "}
          <Link
            href="/legal/billing"
            className="font-semibold text-slate-600 dark:text-slate-300 underline-offset-4 hover:text-slate-700 dark:text-slate-200 md:text-coral md:hover:text-coral-light md:font-medium"
          >
            Billing & Cancellation Policy
          </Link>
          .
        </label>
      </div>

      {error ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-600/30 bg-brand-coral/10 p-3 text-sm text-slate-700 dark:text-slate-200 md:rounded-lg md:border-brand-coral/50 md:bg-slate-50 dark:bg-slate-700 md:text-brand-coral">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-slate-600 dark:text-slate-300 md:text-brand-coral" />
            <span>{error}</span>
          </div>
        </div>
      ) : null}

      <Button
        type="submit"
        disabled={isProcessing}
        className="w-full justify-center px-8"
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving card…
          </>
        ) : (
          <>
            {buttonLabel}
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}
function OnboardingSetupContent() {
  const searchParams = useSearchParams();
  const params = searchParams ?? new URLSearchParams();
  const router = useRouter();
  const [lead, setLead] = useState<LeadData | null>(null);
  const [setupIntentData, setSetupIntentData] =
    useState<SetupIntentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentStep, setCurrentStep] = useState<"payment" | "schedule" | "account">("payment");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const normalizeWindowSelection = (
    value?: string | null,
  ): "morning" | "afternoon" | "flexible" => {
    const normalized = (value ?? "").toLowerCase().trim();
    if (normalized === "afternoon" || normalized === "midday") return "afternoon";
    if (normalized === "flexible") return "flexible";
    if (normalized === "evening" || normalized === "late-day" || normalized === "late day") {
      return "afternoon";
    }
    return "flexible";
  };

  const [selectedTimeWindow, setSelectedTimeWindow] =
    useState<"morning" | "afternoon" | "flexible">(normalizeWindowSelection(null));
  const [isCompletingSetup, setIsCompletingSetup] = useState(false);
  const [confirmedSetupIntentId, setConfirmedSetupIntentId] =
    useState<string | null>(null);
  const [confirmedPaymentMethodId, setConfirmedPaymentMethodId] =
    useState<string | null>(null);
  const [confirmedChargeAmount, setConfirmedChargeAmount] =
    useState<number | null>(null);
  const [confirmedBillingPreference, setConfirmedBillingPreference] =
    useState<"monthly" | "weekly">("monthly");
  const [previewBillingPreference, setPreviewBillingPreference] =
    useState<"monthly" | "weekly">("monthly");
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(min-width: 768px)").matches;
  });
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return document.documentElement.classList.contains("dark");
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const update = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    setIsDesktop(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Check for class-based dark mode (Tailwind uses "dark" class on html)
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };
    checkDarkMode();
    // Observe class changes on the html element
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const [dogDoor, setDogDoor] = useState<string | null>("no");
  const [dogsOutside, setDogsOutside] = useState<string | null>("no");
  const [cleanWithDogs, setCleanWithDogs] = useState<string | null>("no");
  // Track validation attempts for highlighting missing fields
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const safetyStepRef = React.useRef<HTMLDivElement>(null);
  // Enhanced gate location: primary side + reference point
  const [gateLocation, setGateLocation] = useState<string | null>("left");
  const [gateReference, setGateReference] = useState<string | null>(null); // garage-side, opposite-garage, near-alley, near-street
  // Enhanced bag drop location with more options
  const [trashLocation, setTrashLocation] = useState<string | null>("side-bin");
  const [trashBinColor, setTrashBinColor] = useState<string | null>(null); // For specific bin identification
  const [communityGateAccess, setCommunityGateAccess] =
    useState<string | null>("no");
  const [communityGateCode, setCommunityGateCode] = useState("");
  const [homeGateAccess, setHomeGateAccess] = useState<string | null>("no");
  const [homeGateCode, setHomeGateCode] = useState("");
  const [accessNotes, setAccessNotes] = useState("");
  const [gateLocationNotes, setGateLocationNotes] = useState("");
  const [trashLocationNotes, setTrashLocationNotes] = useState("");
  // Additional helpful info for scoopers
  const [parkingInstructions, setParkingInstructions] = useState<string | null>("street");
  const [bestAccessTime, setBestAccessTime] = useState<string | null>(null);

  const weekendUpgradeEnabled = useMemo(() => {
    const pricingData = setupIntentData?.pricing ?? null;
    const pricingRecord =
      pricingData && typeof pricingData === "object"
        ? (pricingData as Record<string, unknown>)
        : null;
    const pricingBreakdown =
      pricingRecord && typeof pricingRecord["breakdown"] !== "undefined"
        ? pricingRecord["breakdown"]
        : null;

    return extractWeekendUpgrade(
      pricingData,
      pricingBreakdown,
      lead?.pricing ?? null,
      lead?.pricingBreakdown ?? null,
    );
  }, [setupIntentData?.pricing, lead?.pricing, lead?.pricingBreakdown]);

  const leadDivertModeRaw = lead?.addOns?.divertMode ?? "none";
  const leadDivertMode =
    typeof leadDivertModeRaw === "string"
      ? leadDivertModeRaw.toLowerCase()
      : "none";
  const shouldShowTrashPlacement = leadDivertMode === "none";

  const safetyValidation = useMemo(() => {
    const trimmedCommunityGateCode = communityGateCode.trim();
    const trimmedHomeGateCode = homeGateCode.trim();
    const trimmedAccessNotes = accessNotes.trim();
    const trimmedGateNotes = gateLocationNotes.trim();
    const trimmedTrashNotes = trashLocationNotes.trim();
    const missing: string[] = [];

    if (!gateLocation) missing.push("yard entry");
    if (!dogDoor) missing.push("dog door preference");
    if (!dogsOutside) missing.push("dogs outside preference");
    if (!cleanWithDogs) missing.push("cleaning with dogs preference");
    if (shouldShowTrashPlacement && !trashLocation) missing.push("bag placement");
    if (
      gateLocation === "other" &&
      !trimmedGateNotes
    ) {
      missing.push("gate location details");
    }
    // Bag placement notes are now always optional

    if (!communityGateAccess) {
      missing.push("community gate access");
    } else if (communityGateAccess === "yes" && !trimmedCommunityGateCode) {
      missing.push("community gate code or instructions");
    }

    if (!homeGateAccess) {
      missing.push("backyard gate access");
    } else if (homeGateAccess === "yes" && !trimmedHomeGateCode) {
      missing.push("backyard gate code or key location");
    }

    return {
      trimmedCommunityGateCode,
      trimmedHomeGateCode,
      trimmedAccessNotes,
      trimmedGateLocationNotes: trimmedGateNotes,
      trimmedTrashLocationNotes: trimmedTrashNotes,
      missing,
      canSubmit: missing.length === 0,
    };
  }, [
    accessNotes,
    cleanWithDogs,
    communityGateAccess,
    communityGateCode,
    dogDoor,
    dogsOutside,
    gateLocation,
    homeGateAccess,
    homeGateCode,
    shouldShowTrashPlacement,
    trashLocation,
    gateLocationNotes,
    trashLocationNotes,
  ]);

  const {
    canSubmit: canCompleteSafetyStep,
    missing: safetyStepMissing,
    trimmedCommunityGateCode,
    trimmedHomeGateCode,
    trimmedAccessNotes,
    trimmedGateLocationNotes,
    trimmedTrashLocationNotes,
  } = safetyValidation;

  // Reset attempted submit flag when all required fields are filled
  useEffect(() => {
    if (canCompleteSafetyStep && hasAttemptedSubmit) {
      setHasAttemptedSubmit(false);
    }
  }, [canCompleteSafetyStep, hasAttemptedSubmit]);

  const shellClass = ONBOARDING_SHELL_CLASS;
  const panelClass = ONBOARDING_PANEL_CLASS;
  const panelDesktopReset = ONBOARDING_PANEL_DESKTOP_RESET;

  const leadId = params.get("leadId");
  const rawBillingPreference = (params.get("billingPreference") ?? "").toLowerCase();
  const billingPreferenceParam =
    rawBillingPreference === "weekly"
      ? "weekly"
      : rawBillingPreference === "per-visit" || rawBillingPreference === "pervisit"
        ? "weekly"
        : rawBillingPreference === "monthly"
          ? "monthly"
          : null;

  useEffect(() => {
    try {
      const storedSetupIntentId = sessionStorage.getItem("setupIntentId");
      const storedPaymentMethodId = sessionStorage.getItem("paymentMethodId");
      const storedCharge = sessionStorage.getItem("todaysChargeCents");
      const storedServiceWindow = sessionStorage.getItem("selectedServiceWindow");
      const storedDogDoor = sessionStorage.getItem("dogDoor");
      const storedDogsOutside = sessionStorage.getItem("dogsOutside");
      const storedCleanWithDogs = sessionStorage.getItem("cleanWithDogs");
    const storedGateLocation = sessionStorage.getItem("gateLocation");
    const storedGateLocationNotes = sessionStorage.getItem("gateLocationNotes");
    const storedTrashLocation = sessionStorage.getItem("trashLocation");
    const storedTrashLocationNotes = sessionStorage.getItem("trashLocationNotes");
      const storedCommunityGateAccess = sessionStorage.getItem("communityGateAccess");
      const storedCommunityGateCode = sessionStorage.getItem("communityGateCode");
      const storedHomeGateAccess = sessionStorage.getItem("homeGateAccess");
      const storedHomeGateCode = sessionStorage.getItem("homeGateCode");
      const storedAccessNotes = sessionStorage.getItem("accessNotes");

      if (storedSetupIntentId && !confirmedSetupIntentId) {
        setConfirmedSetupIntentId(storedSetupIntentId);
      }

      if (storedPaymentMethodId && !confirmedPaymentMethodId) {
        setConfirmedPaymentMethodId(storedPaymentMethodId);
      }

      if (storedCharge && !confirmedChargeAmount) {
        const parsed = Number.parseInt(storedCharge, 10);
        if (!Number.isNaN(parsed)) {
          setConfirmedChargeAmount(parsed);
        }
      }

      const storedBilling = sessionStorage.getItem("billingPreference");
      if (storedBilling === "weekly" || storedBilling === "monthly") {
        setConfirmedBillingPreference(storedBilling);
        setPreviewBillingPreference(storedBilling);
      } else if (billingPreferenceParam) {
        setConfirmedBillingPreference(billingPreferenceParam);
        setPreviewBillingPreference(billingPreferenceParam);
      } else {
        setPreviewBillingPreference("monthly");
      }

      if (storedServiceWindow) {
        setSelectedTimeWindow(normalizeWindowSelection(storedServiceWindow));
      }

      if (storedDogDoor) {
        setDogDoor(storedDogDoor);
      }
      if (storedDogsOutside) {
        setDogsOutside(storedDogsOutside);
      }
      if (storedCleanWithDogs) {
        setCleanWithDogs(storedCleanWithDogs);
      }
    if (storedGateLocation) {
      setGateLocation(storedGateLocation);
    }
    if (storedGateLocationNotes) {
      setGateLocationNotes(storedGateLocationNotes);
    }
    if (storedTrashLocation) {
      setTrashLocation(storedTrashLocation);
    }
    if (storedTrashLocationNotes) {
      setTrashLocationNotes(storedTrashLocationNotes);
    }
      if (storedCommunityGateAccess) {
        setCommunityGateAccess(storedCommunityGateAccess);
      }
      if (storedCommunityGateCode) {
        setCommunityGateCode(storedCommunityGateCode);
      }
      if (storedHomeGateAccess) {
        setHomeGateAccess(storedHomeGateAccess);
      }
      if (storedHomeGateCode) {
        setHomeGateCode(storedHomeGateCode);
      }
      if (storedAccessNotes) {
        setAccessNotes(storedAccessNotes);
      }
    } catch (storageError) {
      console.warn("Unable to restore payment session metadata", storageError);
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!billingPreferenceParam) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    try {
      sessionStorage.setItem("billingPreference", billingPreferenceParam);
    } catch (error) {
      console.warn("Unable to persist billing preference from query", error);
    }
  }, [billingPreferenceParam]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (dogDoor) {
        sessionStorage.setItem("dogDoor", dogDoor);
      } else {
        sessionStorage.removeItem("dogDoor");
      }
    } catch (error) {
      console.warn("Unable to persist dogDoor", error);
    }
  }, [dogDoor]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (dogsOutside) {
        sessionStorage.setItem("dogsOutside", dogsOutside);
      } else {
        sessionStorage.removeItem("dogsOutside");
      }
    } catch (error) {
      console.warn("Unable to persist dogsOutside", error);
    }
  }, [dogsOutside]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (cleanWithDogs) {
        sessionStorage.setItem("cleanWithDogs", cleanWithDogs);
      } else {
        sessionStorage.removeItem("cleanWithDogs");
      }
    } catch (error) {
      console.warn("Unable to persist cleanWithDogs", error);
    }
  }, [cleanWithDogs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (gateLocation) {
        sessionStorage.setItem("gateLocation", gateLocation);
      } else {
        sessionStorage.removeItem("gateLocation");
      }
    } catch (error) {
      console.warn("Unable to persist gateLocation", error);
    }
  }, [gateLocation]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const trimmed = gateLocationNotes.trim();
    try {
      if (trimmed) {
        sessionStorage.setItem("gateLocationNotes", trimmed);
      } else {
        sessionStorage.removeItem("gateLocationNotes");
      }
    } catch (error) {
      console.warn("Unable to persist gateLocationNotes", error);
    }
  }, [gateLocationNotes]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (!shouldShowTrashPlacement) {
        sessionStorage.removeItem("trashLocation");
        return;
      }
      if (trashLocation) {
        sessionStorage.setItem("trashLocation", trashLocation);
      } else {
        sessionStorage.removeItem("trashLocation");
      }
    } catch (error) {
      console.warn("Unable to persist trashLocation", error);
    }
  }, [trashLocation, shouldShowTrashPlacement]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (!shouldShowTrashPlacement) {
        sessionStorage.removeItem("trashLocationNotes");
        return;
      }
      const trimmed = trashLocationNotes.trim();
      if (trimmed) {
        sessionStorage.setItem("trashLocationNotes", trimmed);
      } else {
        sessionStorage.removeItem("trashLocationNotes");
      }
    } catch (error) {
      console.warn("Unable to persist trashLocationNotes", error);
    }
  }, [trashLocationNotes, shouldShowTrashPlacement]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (communityGateAccess) {
        sessionStorage.setItem("communityGateAccess", communityGateAccess);
      } else {
        sessionStorage.removeItem("communityGateAccess");
      }
    } catch (error) {
      console.warn("Unable to persist communityGateAccess", error);
    }
  }, [communityGateAccess]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const trimmed = communityGateCode.trim();
      if (trimmed) {
        sessionStorage.setItem("communityGateCode", trimmed);
      } else {
        sessionStorage.removeItem("communityGateCode");
      }
    } catch (error) {
      console.warn("Unable to persist communityGateCode", error);
    }
  }, [communityGateCode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (homeGateAccess) {
        sessionStorage.setItem("homeGateAccess", homeGateAccess);
      } else {
        sessionStorage.removeItem("homeGateAccess");
      }
    } catch (error) {
      console.warn("Unable to persist homeGateAccess", error);
    }
  }, [homeGateAccess]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const trimmed = homeGateCode.trim();
      if (trimmed) {
        sessionStorage.setItem("homeGateCode", trimmed);
      } else {
        sessionStorage.removeItem("homeGateCode");
      }
    } catch (error) {
      console.warn("Unable to persist homeGateCode", error);
    }
  }, [homeGateCode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const trimmed = accessNotes.trim();
      if (trimmed) {
        sessionStorage.setItem("accessNotes", trimmed);
      } else {
        sessionStorage.removeItem("accessNotes");
      }
    } catch (error) {
      console.warn("Unable to persist accessNotes", error);
    }
  }, [accessNotes]);

  useEffect(() => {
    if (!leadId) {
      router.push("/quote?businessId=yardura");
      return;
    }

    initializeSetup();
  }, [leadId, router]);

  const initializeSetup = async () => {
    if (!leadId) {
      throw new Error("Lead ID is required for setup initialization");
    }

    try {
      // Fetch lead data
      const leadResponse = await fetch(`/api/leads/${leadId}`);
      if (!leadResponse.ok) throw new Error("Failed to fetch lead");

      const leadData = await leadResponse.json();
      setLead(leadData);

      // Create Stripe SetupIntent
      const setupResponse = await fetch("/api/stripe/setup-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId
        }),
      });

      if (!setupResponse.ok) throw new Error("Failed to create setup intent");

      const setupData = await setupResponse.json();
      setSetupIntentData(setupData);

      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem("leadEmail", leadData.email ?? "");
        } catch (storageError) {
          console.warn("Unable to persist lead email for onboarding", storageError);
        }
      }
    } catch (err) {
      console.error("Setup error:", err);
      setError("Failed to initialize payment setup. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const elementsOptions = useMemo<StripeElementsOptions | null>(() => {
    if (!setupIntentData?.clientSecret) {
      return null;
    }

    const darkAppearance = {
      theme: "flat" as const,
      variables: {
        colorPrimary: "#F3645B",
        colorDanger: "#f87171",
        colorBackground: "#1e293b",
        colorBackgroundSecondary: "#334155",
        colorText: "#f8fafc",
        colorTextSecondary: "#cbd5e1",
        colorTextPlaceholder: "#94a3b8",
        borderRadius: "12px",
        spacingUnit: "6px",
      },
      rules: {
        ".Input, .Tab": {
          border: "1px solid rgba(148,163,184,0.3)",
          backgroundColor: "#1e293b",
          color: "#f8fafc",
          boxShadow: "none",
        },
        ".Block": {
          border: "1px solid rgba(148,163,184,0.2)",
          backgroundColor: "#334155",
          boxShadow: "none",
        },
        ".Tab": {
          color: "#e2e8f0",
        },
        ".Tab.Tab--selected": {
          backgroundColor: "rgba(243,100,91,0.2)",
          color: "#f8fafc",
          borderColor: "#F3645B",
        },
        ".Input:focus, .Tab:focus": {
          borderColor: "#F3645B",
          boxShadow: "0 0 0 2px rgba(243,100,91,0.35)",
        },
        ".Label": {
          color: "#e2e8f0",
        },
        ".Error": {
          color: "#f87171",
        },
      },
    };

    const lightAppearance = {
      theme: "flat" as const,
      variables: {
        colorPrimary: "#F3645B",
        colorDanger: "#f87171",
        colorBackground: "#ffffff",
        colorBackgroundSecondary: "#f4f7f9",
        colorText: "#1B1E23",
        colorTextSecondary: "#475569",
        colorTextPlaceholder: "#94a3b8",
        borderRadius: "12px",
        spacingUnit: "6px",
      },
      rules: {
        ".Input, .Tab": {
          border: "1px solid rgba(15,23,42,0.18)",
          backgroundColor: "#ffffff",
          color: "#1B1E23",
          boxShadow: "none",
        },
        ".Block": {
          border: "1px solid rgba(15,23,42,0.12)",
          backgroundColor: "#ffffff",
          boxShadow: "none",
        },
        ".Tab": {
          color: "#1B1E23",
        },
        ".Tab.Tab--selected": {
          backgroundColor: "#fdece7",
          color: "#1B1E23",
          borderColor: "#F3645B",
        },
        ".Input:focus, .Tab:focus": {
          borderColor: "#F3645B",
          boxShadow: "0 0 0 2px rgba(243,100,91,0.25)",
        },
        ".Label": {
          color: "#334155",
        },
        ".Error": {
          color: "#f87171",
        },
      },
    };

    return {
      clientSecret: setupIntentData.clientSecret,
      appearance: isDarkMode ? darkAppearance : lightAppearance,
    } satisfies StripeElementsOptions;
  }, [isDarkMode, setupIntentData?.clientSecret]);

  if (isLoading) {
    return (
      <div className={shellClass}>
        <div className="flex min-h-screen items-center justify-center px-6 md:px-0">
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 dark:border-slate-600/25 bg-white dark:bg-slate-800 p-8 text-center shadow-[0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur md:max-w-md md:border-brand-soft md:bg-white md:text-slate-900 dark:text-white md:shadow-lg">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-brand-coral md:border-brand-coral"></div>
            <p className={cn("text-sm", ONBOARDING_SUBTLE_TEXT)}>Setting up your account...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !lead || !setupIntentData) {
    return (
      <div className={shellClass}>
        <div className="flex min-h-screen items-center justify-center px-6 md:px-0">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-600/20 bg-white dark:bg-slate-800 p-8 text-center shadow-[0_40px_110px_rgba(0,0,0,0.6)] backdrop-blur md:border border-red-200 md:bg-white md:text-slate-900 dark:text-white md:shadow-lg">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-slate-600 dark:text-slate-300 md:text-red-500" />
            <h1 className="text-2xl font-serif font-semibold text-slate-900 dark:text-white">
              Setup Error
            </h1>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300/75 md:text-[rgba(var(--graphite-rgb-commas),0.7)]">
              {error || "We encountered an issue setting up your account."}
            </p>
            <div className="mt-6 space-y-3 text-sm">
              <Button
                onClick={() => window.location.reload()}
                className="w-full rounded-2xl bg-brand-coral text-slate-900 hover:bg-brand-coral-ink focus-visible:ring-brand-coral/60 md:rounded-lg md:bg-primary md:text-primary-foreground md:hover:bg-primary/90"
              >
                Try Again
              </Button>
              <Button
                variant="outline"
                asChild
                className="w-full rounded-2xl border-brand-coral/40/40 bg-transparent text-slate-700 dark:text-slate-200 hover:bg-brand-coral/10 md:rounded-lg md:border md:border-input md:text-slate-900 dark:text-white md:hover:bg-muted"
              >
                <Link href="/contact">Contact Support</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // STEP 1: Show payment setup first
  if (currentStep === "payment") {
    if (!stripePromise) {
      return (
        <div className={shellClass}>
          <div className="flex min-h-screen items-center justify-center px-6 md:px-0">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-600/25 bg-white dark:bg-slate-800 p-8 text-center shadow-[0_40px_110px_rgba(0,0,0,0.6)] backdrop-blur md:border md:border-red-200 md:bg-white md:text-slate-900 dark:text-white md:shadow-lg">
              <AlertCircle className="mx-auto mb-4 h-12 w-12 text-slate-600 dark:text-slate-300 md:text-red-500" />
              <h1 className="text-2xl font-serif font-semibold text-slate-900 dark:text-white">
                Payment Disabled
              </h1>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300/75 md:text-[rgba(var(--graphite-rgb-commas),0.7)]">
                Stripe is not configured correctly. Please contact support to complete your signup.
              </p>
              <Button
                asChild
                className="mt-6 w-full rounded-2xl bg-brand-coral text-slate-900 hover:bg-brand-coral-ink focus-visible:ring-brand-coral/60 md:rounded-lg md:bg-primary md:text-primary-foreground"
              >
                <Link href="/contact">Contact Support</Link>
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (!elementsOptions) {
      return (
        <div className={shellClass}>
          <div className="flex min-h-screen items-center justify-center px-6 md:px-0">
            <div className="w-full max-w-sm rounded-3xl border border-slate-200 dark:border-slate-600/25 bg-white dark:bg-slate-800 p-8 text-center shadow-[0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur md:max-w-md md:border-brand-soft md:bg-white md:text-slate-900 dark:text-white md:shadow-lg">
              <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-brand-coral md:border-accent"></div>
              <p className={cn("text-sm", ONBOARDING_SUBTLE_TEXT)}>Preparing secure payment...</p>
            </div>
          </div>
        </div>
      );
    }

    const normalizeCents = (
      value: number | string | null | undefined,
    ): number => {
      if (value === null || value === undefined) return 0;
      if (typeof value === "number") {
        if (Number.isInteger(value)) return value;
        return Math.round(value * 100);
      }
      const trimmed = String(value).trim();
      if (!trimmed) return 0;
      const parsed = Number.parseFloat(trimmed);
      if (!Number.isFinite(parsed)) return 0;
      return trimmed.includes(".") ? Math.round(parsed * 100) : Math.round(parsed);
    };

    const toTitleCase = (value?: string | null): string => {
      if (!value) return "";
      return value
        .replace(/[-_]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
    };

    const formatVisitCount = (value: number): string => {
      if (!Number.isFinite(value) || value <= 0) return "0";
      const rounded = Math.round(value * 100) / 100;
      if (Math.abs(rounded - Math.round(rounded)) < 0.01) {
        return Math.round(rounded).toString();
      }
      return rounded
        .toFixed(2)
        .replace(/\.00$/, "")
        .replace(/(\.\d)0$/, "$1");
    };

    const formatVisitPhrase = (value: number): string => {
      const count = formatVisitCount(value);
      const numeric = Number.parseFloat(count);
      const plural = !(Math.abs(numeric - 1) < 0.01);
      return `${count} ${plural ? "visits" : "visit"}`;
    };

    const toNumber = (value: unknown): number => {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      const parsed = Number.parseFloat(String(value ?? ""));
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const pricingSnapshot = setupIntentData.pricing;
    const perVisitCents = normalizeCents(pricingSnapshot.perVisit);
    const visitsPerMonth = toNumber(pricingSnapshot.visitsPerMonth);
    const firstMonthVisits = toNumber(pricingSnapshot.firstMonthVisits);

    const monthlyCentsCandidate = normalizeCents(
      pricingSnapshot.fullMonthlyAmount ?? pricingSnapshot.monthly,
    );
    const computedMonthlyCents =
      perVisitCents > 0 && visitsPerMonth > 0
        ? Math.round(perVisitCents * visitsPerMonth)
        : 0;
    const monthlyCents =
      monthlyCentsCandidate > 0 ? monthlyCentsCandidate : computedMonthlyCents;

    const rawFirstMonthCents = normalizeCents(
      pricingSnapshot.firstMonthCents,
    );
    const computedFirstMonthCents =
      monthlyCents > 0 && perVisitCents > 0
        ? Math.max(0, monthlyCents - perVisitCents)
        : 0;
    const firstMonthCents =
      rawFirstMonthCents > 0 ? rawFirstMonthCents : computedFirstMonthCents;

    const initialCleanCents = normalizeCents(pricingSnapshot.initialClean);
    const initialCleanDiscountCents = Math.min(
      initialCleanCents,
      normalizeCents(pricingSnapshot.initialCleanDiscount),
    );
    const discountedInitialCleanCents = Math.max(
      0,
      normalizeCents(pricingSnapshot.discountedInitialClean) ||
        (initialCleanCents - initialCleanDiscountCents),
    );
    const firstVisitAddOnsRaw =
      pricingSnapshot.firstVisitAddOns as
        | Record<string, string | number>
        | undefined;
    const firstVisitAddOnsCents = {
      deodorize: normalizeCents(firstVisitAddOnsRaw?.deodorize),
      sprayDeck: normalizeCents(firstVisitAddOnsRaw?.sprayDeck),
      other: normalizeCents(firstVisitAddOnsRaw?.other),
    };
    const firstVisitAddOnsTotalCents =
      firstVisitAddOnsCents.deodorize +
      firstVisitAddOnsCents.sprayDeck +
      firstVisitAddOnsCents.other;

    const rawFirstVisitTotalCents = normalizeCents(
      pricingSnapshot.firstVisitTotalCents ?? 0,
    );
    const computedFirstVisitTotalCents = Math.max(
      0,
      discountedInitialCleanCents + firstVisitAddOnsTotalCents,
    );
    const firstVisitTotalCents =
      rawFirstVisitTotalCents > 0
        ? rawFirstVisitTotalCents
        : computedFirstVisitTotalCents;

    const amountDueTodayCentsRaw = normalizeCents(
      pricingSnapshot.amountDueToday,
    );
    const fallbackDueToday =
      firstMonthCents + firstVisitTotalCents > 0
        ? firstMonthCents + firstVisitTotalCents
        : Math.max(monthlyCents, perVisitCents);

    const normalizedFrequency = (lead.frequency || "weekly")
      .toLowerCase()
      .replace(/_/g, "-")
      .trim();

    const isOneTimeService =
      normalizedFrequency === "onetime" || normalizedFrequency === "one-time";

    const summaryBillingPreference = isOneTimeService
      ? "weekly"
      : previewBillingPreference ?? confirmedBillingPreference ?? "monthly";

    const introCreditPlan = computeIntroCredits({
      normalizedFrequency,
      initialCleanCents,
      perVisitCents,
    });

    const promoDescriptions = introCreditPlan.descriptions;
    const { summary: introCreditSummary } = summarizeIntroCredits(introCreditPlan);
    const promoSummary = (() => {
      if (introCreditSummary) {
        return introCreditSummary;
      }
      if (normalizedFrequency === "monthly" && promoDescriptions.length) {
        return `${promoDescriptions[0]} automatically applies to your kickoff visit.`;
      }
      if (promoDescriptions.length) {
        return `Promo credits apply automatically: ${promoDescriptions.join(", ")}.`;
      }
      return "Promo credits apply automatically to your kickoff visits.";
    })();

    const effectiveConfirmedChargeAmount = isOneTimeService
      ? null
      : confirmedChargeAmount;

    const todaysChargeCents = effectiveConfirmedChargeAmount ?? 0;

    const oneTimeCents = normalizeCents(pricingSnapshot.oneTime);
    const projectedOneTimeInvoiceCents = Math.max(
      firstVisitTotalCents,
      discountedInitialCleanCents + firstVisitAddOnsTotalCents,
      oneTimeCents,
      0,
    );
    const firstVisitAddOnLines: Array<{ label: string; amount: number }> = [];
    if (lead.addOns?.deodorize && firstVisitAddOnsCents.deodorize > 0) {
      firstVisitAddOnLines.push({
        label: "Deodorize & Sanitize (first visit only)",
        amount: firstVisitAddOnsCents.deodorize,
      });
    }
    if (lead.addOns?.sprayDeck && firstVisitAddOnsCents.sprayDeck > 0) {
      firstVisitAddOnLines.push({
        label: "Spray Deck/Patio (first visit only)",
        amount: firstVisitAddOnsCents.sprayDeck,
      });
    }
    if (firstVisitAddOnsCents.other > 0) {
      firstVisitAddOnLines.push({
        label: "Additional services",
        amount: firstVisitAddOnsCents.other,
      });
    }
    const friendlyFrequency = (
      frequency: string | undefined | null,
      weekendUpgradeFlag = false,
    ) => {
      if (!frequency) return "";
      const normalized = frequency.toLowerCase();
      switch (normalized) {
        case "daily":
          return weekendUpgradeFlag ? "Daily (Mon–Sun)" : "Daily (Mon–Fri)";
        case "weekly":
          return "Weekly";
        case "twice-weekly":
          return "Twice Weekly";
        case "biweekly":
        case "bi-weekly":
          return "Every Other Week";
        case "monthly":
          return "Monthly";
        case "onetime":
        case "one-time":
          return "One-Time";
        default:
          return toTitleCase(frequency);
      }
    };

    const formatCents = (value: number) => `$${(value / 100).toFixed(2)}`;

    const addOnLabels: string[] = [];
    if (lead.addOns?.deodorize) {
      addOnLabels.push("Deodorize & Sanitize");
    }
    if (lead.addOns?.sprayDeck) {
      addOnLabels.push("Deck & Patio Rinse");
    }
    if (lead.addOns?.divertMode && lead.addOns.divertMode !== "none") {
      addOnLabels.push(
        DIVERT_LABELS[lead.addOns.divertMode] ?? "Compost routing enabled",
      );
    }
    if (weekendUpgradeEnabled && normalizedFrequency === "daily") {
      addOnLabels.push("Weekend coverage (Sat + Sun)");
    }

    const summaryWeeklyDescriptor = (() => {
      if (summaryBillingPreference !== "weekly") {
        return {
          amountLabel: formatCents(perVisitCents),
          cadence: friendlyFrequency(lead.frequency, weekendUpgradeEnabled),
        };
      }

      switch (normalizedFrequency) {
        case "twice-weekly":
          return {
            amountLabel: formatCents(perVisitCents * 2),
            cadence: "Billed after each visit (two visits per week)",
          };
        case "daily":
          return {
            amountLabel: formatCents(perVisitCents * (weekendUpgradeEnabled ? 7 : 5)),
            cadence: weekendUpgradeEnabled
              ? "Billed each week after seven-day coverage"
              : "Billed weekly after weekday visits",
          };
        case "biweekly":
        case "bi-weekly":
          return {
            amountLabel: formatCents(perVisitCents),
            cadence: "Billed after each visit, every other week",
          };
        default:
          return {
            amountLabel: formatCents(perVisitCents),
            cadence: "Billed after each weekly visit",
          };
      }
    })();

    const weeklyChargeAmountCents =
      normalizedFrequency === "twice-weekly"
        ? perVisitCents * 2
        : normalizedFrequency === "daily"
          ? perVisitCents * (weekendUpgradeEnabled ? 7 : 5)
          : perVisitCents;
    const weeklyChargeAmountLabel = formatCents(weeklyChargeAmountCents);

    const highlightItems = isOneTimeService
      ? [
          {
            icon: Sparkles,
            label: "One-time clean",
            value: formatCents(projectedOneTimeInvoiceCents),
            hint: "Invoice sent after your visit",
          },
          {
            icon: CreditCard,
            label: "Card on file",
            value: "Stored — charged after service",
            hint: "We only bill once the cleanup is complete.",
          },
        ]
      : summaryBillingPreference === "weekly"
        ? [
            {
              icon: CreditCard,
              label: "Billing preference",
              value: "Pay per visit",
              hint: summaryWeeklyDescriptor.cadence,
            },
            {
              icon: Calendar,
              label: "Service rate",
              value: formatCents(perVisitCents),
              hint: friendlyFrequency(lead.frequency, weekendUpgradeEnabled),
            },
          ]
        : [
            {
              icon: Sparkles,
              label: "Monthly plan",
              value: formatCents(monthlyCents),
              hint:
                visitsPerMonth > 0
                  ? `${formatVisitPhrase(visitsPerMonth)} / month`
                  : undefined,
            },
            {
              icon: Calendar,
              label: "Per-visit value",
              value: formatCents(perVisitCents),
              hint: friendlyFrequency(lead.frequency, weekendUpgradeEnabled),
            },
          ];

    const usesSkipCreditForPreview =
      normalizedFrequency === "daily" || normalizedFrequency === "twice-weekly";

    const paymentStepTitle = isOneTimeService
      ? "Secure your payment method"
      : summaryBillingPreference === "weekly"
        ? "Verify your payment method"
        : "Secure your payment method";

   const paymentStepDescription = isOneTimeService
      ? `We keep your card on file and invoice ${formatCents(
          projectedOneTimeInvoiceCents,
        )} once service is complete. You’ll approve the visit before we bill.`
      : summaryBillingPreference === "weekly"
        ? usesSkipCreditForPreview
          ? "Add your card on file—we run your bundled weekly charge once the service week wraps. Skipped visits automatically earn a credit before the next charge."
          : "Add your card on file—we run your card after each completed visit. Skip or cancel and there's no charge."
        : "Add your card on file—we'll tally completed visits each month and charge the saved card the next day.";

    const nextStepsCard = [
      {
        icon: CreditCard,
        title: paymentStepTitle,
        description: paymentStepDescription,
      },
      {
        icon: CalendarCheck,
        title: "Choose your start date",
        description:
          "On the next screen, pick the visit date that fits your schedule. No surprise same-day appointments.",
      },
      {
        icon: ShieldCheck,
        title: "Create account access",
        description:
          "Set up your login so you can manage visits, wellness notes, and billing in a single place.",
      },
      {
        icon: Sparkles,
        title: "Enjoy a cleaner yard",
        description:
          "You're all set—our crew will keep you updated with reminders, visit photos, and wellness insights.",
      },
    ];

    return (
      <div className={shellClass}>
        <div className="mx-auto w-full max-w-5xl px-5 pt-24 pb-16 md:container md:px-4 md:pt-28 md:pb-16">
          <div className="mx-auto max-w-4xl space-y-10 md:space-y-12">
            {/* Header */}
            <div className="mb-6 rounded-3xl border border-slate-200 dark:border-slate-600/20 bg-white dark:bg-slate-800 px-6 py-10 text-center shadow-[0_35px_100px_rgba(0,0,0,0.55)] backdrop-blur md:mb-12 md:rounded-none md:border-none md:bg-transparent md:px-0 md:py-0 md:shadow-none">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-coral/15 md:h-20 md:w-20 md:rounded-full md:bg-accent/10">
                <CreditCard className="h-8 w-8 text-slate-600 dark:text-slate-300 md:h-10 md:w-10 md:text-accent" />
              </div>
              <h1 className="text-3xl font-serif font-bold text-slate-900 dark:text-white md:text-4xl">
                Welcome, {lead.firstName}!
              </h1>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300/80 md:text-xl md:text-[rgba(var(--graphite-rgb-commas),0.7)]">
                Let's set up your payment method to get started
              </p>
            </div>

            {/* Progress Indicator - Step 1 active */}
            <div className="mb-10 flex justify-center md:mb-12">
              <div className="flex w-full max-w-md items-center justify-between rounded-2xl border border-slate-200 dark:border-slate-600/25 bg-slate-100 dark:bg-slate-800 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-600 dark:text-slate-300 md:max-w-none md:rounded-full md:border-none md:bg-transparent md:px-0 md:py-0 md:text-sm md:font-medium md:normal-case md:tracking-normal">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-coral text-slate-950 md:bg-brand-coral md:text-white">
                    1
                  </span>
                  <span className="hidden md:inline text-brand-coral">Payment</span>
                  <span className="md:hidden">Pay</span>
                </div>
                <span className="h-0.5 flex-1 rounded-full bg-brand-coral/40 md:mx-4 md:bg-brand-coral/40" />
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    2
                  </span>
                  <span className="hidden md:inline">Schedule</span>
                  <span className="md:hidden">Plan</span>
                </div>
                <span className="h-0.5 flex-1 rounded-full bg-slate-300 dark:bg-slate-600 md:mx-4" />
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    3
                  </span>
                  <span className="hidden md:inline">Finish</span>
                  <span className="md:hidden">Done</span>
                </div>
              </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              {/* Quote Summary */}
              <Card className={cn(panelClass, panelDesktopReset)}>
                <CardHeader className="space-y-1 md:space-y-2">
                  <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white md:text-slate-900 dark:text-white">
                    Your Service Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 text-slate-700 dark:text-slate-200 md:text-slate-900 dark:text-white">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className={cn("text-xs font-semibold uppercase tracking-[0.18em]", ONBOARDING_SUBTLE_TEXT)}>
                        Service
                      </span>
                      <p className="mt-1 font-medium capitalize text-slate-900 dark:text-white md:text-slate-900 dark:text-white">
                        {toTitleCase(lead.serviceType) || "Residential"}
                      </p>
                    </div>
                    <div>
                      <span className={cn("text-xs font-semibold uppercase tracking-[0.18em]", ONBOARDING_SUBTLE_TEXT)}>
                        Frequency
                      </span>
                      <p className="mt-1 font-medium text-slate-900 dark:text-white md:text-slate-900 dark:text-white">
                        {friendlyFrequency(lead.frequency, weekendUpgradeEnabled)}
                      </p>
                    </div>
                    <div>
                      <span className={cn("text-xs font-semibold uppercase tracking-[0.18em]", ONBOARDING_SUBTLE_TEXT)}>
                        Dogs
                      </span>
                      <p className="mt-1 font-medium text-slate-900 dark:text-white md:text-slate-900 dark:text-white">
                        {lead.dogs ?? "--"}
                      </p>
                    </div>
                    <div>
                      <span className={cn("text-xs font-semibold uppercase tracking-[0.18em]", ONBOARDING_SUBTLE_TEXT)}>
                        Property
                      </span>
                      <p className="mt-1 font-medium text-slate-900 dark:text-white md:text-slate-900 dark:text-white">
                        {toTitleCase(lead.yardSize)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl border border-slate-200 dark:border-slate-600/25 bg-slate-50 dark:bg-slate-700 px-4 py-3 md:border-brand-soft md:bg-slate-100 dark:bg-slate-700/70">
                    <MapPin className="mt-1 h-4 w-4 text-slate-600 dark:text-slate-300 md:text-brand-deep" />
                    <div>
                      <p className={cn("text-[10px] font-semibold uppercase tracking-[0.24em]", ONBOARDING_SUBTLE_TEXT)}>
                        Service address
                      </p>
                      <p className="mt-1 text-sm font-medium leading-snug text-slate-900 dark:text-white md:text-slate-900 dark:text-white">
                        {lead.address}, {lead.city}, {lead.zipCode}
                      </p>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "grid gap-3",
                      highlightItems.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3",
                    )}
                  >
                    {highlightItems.map((item) => (
                      <div
                        key={item.label}
                        className="rounded-2xl border border-slate-200 dark:border-slate-600/20 bg-white dark:bg-slate-800 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.45)] md:border-brand-soft md:bg-white/80 md:shadow-sm"
                      >
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600 dark:text-slate-300/80 md:text-[rgba(var(--graphite-rgb-commas),0.55)]">
                          <item.icon className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300 md:text-brand-coral" />
                          {item.label}
                        </div>
                        <div className="mt-2 text-lg font-bold text-slate-900 dark:text-white md:text-slate-900 dark:text-white">
                          {item.value}
                        </div>
                        {item.hint ? (
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300/70 md:text-[rgba(var(--graphite-rgb-commas),0.6)]">
                            {item.hint}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  {addOnLabels.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[rgba(var(--graphite-rgb-commas),0.55)] dark:text-slate-300/80">
                        Included extras
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {addOnLabels.map((label) => (
                          <span
                            key={label}
                            className="inline-flex items-center gap-1 rounded-full border border-brand-soft bg-white px-3 py-1 text-xs font-medium text-slate-900 dark:border-slate-600/60 dark:bg-slate-700/70 dark:text-slate-100"
                          >
                            <Sparkles className="w-3 h-3 text-brand-gold" />
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-brand-coral/40/35 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-xs text-slate-700 dark:text-slate-200 md:border-brand-soft md:bg-white/60 md:text-[rgba(var(--graphite-rgb-commas),0.6)]">
                      Add lawn deodorizing or deck rinses anytime from your dashboard.
                    </div>
                  )}

                  <div className="rounded-xl border border-brand-coral/40/25 bg-slate-50 dark:bg-slate-800 p-4 space-y-3 text-slate-700 dark:text-slate-200 md:border-brand-soft md:bg-white/85 md:text-slate-900 dark:text-white">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300/75 md:text-[rgba(var(--graphite-rgb-commas),0.55)]">
                      Next steps
                    </div>
                    <div className="space-y-3">
                      {nextStepsCard.map((step, idx) => (
                        <div key={step.title} className="flex gap-3">
                          <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-coral/20 text-slate-700 dark:text-slate-200 md:bg-slate-100 dark:bg-slate-700 md:text-slate-900 dark:text-white">
                            <step.icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 md:text-slate-900 dark:text-white">
                              {idx + 1}. {step.title}
                            </div>
                            <p className="text-xs leading-snug text-slate-600 dark:text-slate-300/75 md:text-[rgba(var(--graphite-rgb-commas),0.65)]">
                              {step.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-brand-coral/40/25 bg-slate-50 dark:bg-slate-800 p-4 space-y-2 text-slate-700 dark:text-slate-200 md:border-brand-soft md:bg-slate-100 dark:bg-slate-700/70 md:text-slate-900 dark:text-white">
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 md:text-slate-900 dark:text-white">
                      Need a hand as you go?
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 md:text-slate-900 dark:text-white">
                      <Phone className="w-4 h-4 text-slate-600 dark:text-slate-300 md:text-brand-deep" /> 1-877-417-YARD
                      <span className="text-xs text-slate-600 dark:text-slate-300/70 md:text-[rgba(var(--graphite-rgb-commas),0.55)]">
                        · 8am–6pm CT
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 md:text-slate-900 dark:text-white">
                      <Mail className="w-4 h-4 text-slate-600 dark:text-slate-300 md:text-brand-deep" /> hello@yardura.com
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Setup */}
              <div className="space-y-5">
                <div className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-600/20 bg-white dark:bg-slate-800 shadow-[0_30px_80px_rgba(0,0,0,0.5)] backdrop-blur md:border-brand-soft md:bg-white/70 md:shadow-lg">
                  <Image
                    src="/dog_images/pexels-pixabay-65928.jpg"
                    alt="Excited pup ready for their InsightScoop onboarding"
                    fill
                    className="object-cover"
                    sizes="(min-width: 1024px) 360px, 100vw"
                  />
                  <div className="absolute inset-x-4 top-4 rounded-2xl border border-slate-200 dark:border-slate-600/20 bg-white dark:bg-slate-800 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-600 dark:text-slate-300 shadow-[0_18px_40px_rgba(0,0,0,0.45)] md:border-none md:bg-white/85 md:text-slate-900 dark:text-white md:normal-case md:tracking-normal">
                    Two minutes here and your crew is officially on our route.
                  </div>
                </div>

                <Card className={cn(panelClass, panelDesktopReset)}>
                  <CardHeader className="space-y-1 md:space-y-2">
                    <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white md:text-slate-900 dark:text-white">
                      <CreditCard className="h-5 w-5 text-slate-600 dark:text-slate-300 md:text-accent" />
                      Payment Information
                    </CardTitle>
                    <p className="text-xs text-slate-600 dark:text-slate-300/70 md:hidden">
                      Secure payments powered by Stripe. Finish here to lock your first visit.
                    </p>
                  </CardHeader>
                  <CardContent className="text-slate-700 dark:text-slate-200 md:text-slate-900 dark:text-white">
                    {!stripePromise ? (
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-600/25 bg-slate-50 dark:bg-slate-700 p-4 text-sm text-slate-700 dark:text-slate-200 md:border-brand-soft md:bg-slate-50 dark:bg-slate-700">
                        Payment form is unavailable. Please contact support to
                        complete onboarding.
                      </div>
                    ) : elementsOptions ? (
                      <Elements stripe={stripePromise} options={elementsOptions}>
                        <PaymentForm
                          setupIntentData={setupIntentData}
                          leadData={lead}
                          onBillingPreferencePreviewChange={
                            setPreviewBillingPreference
                          }
                          isOneTimeService={isOneTimeService}
                          projectedOneTimeInvoiceCents={projectedOneTimeInvoiceCents}
                          onComplete={({
                            setupIntentId,
                            paymentMethodId,
                            amountChargedCents,
                            billingPreference,
                          }) => {
                            setConfirmedSetupIntentId(setupIntentId);
                            setConfirmedPaymentMethodId(paymentMethodId ?? null);
                            setConfirmedChargeAmount(amountChargedCents);
                            setConfirmedBillingPreference(billingPreference);
                            setPreviewBillingPreference(billingPreference);
                            try {
                              sessionStorage.setItem(
                                "setupIntentId",
                                setupIntentId,
                              );
                              sessionStorage.setItem(
                                "billingPreference",
                                billingPreference,
                              );
                              if (paymentMethodId) {
                                sessionStorage.setItem(
                                  "paymentMethodId",
                                  paymentMethodId,
                                );
                              }
                              sessionStorage.setItem(
                                "todaysChargeCents",
                                String(amountChargedCents),
                              );
                            } catch (storageError) {
                              console.warn(
                                "Unable to persist payment metadata",
                                storageError,
                              );
                            }
                            setCurrentStep("schedule");
                          }}
                        />
                      </Elements>
                    ) : (
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-600/25 bg-slate-50 dark:bg-slate-700 p-4 text-sm text-slate-700 dark:text-slate-200 md:border-brand-soft md:bg-slate-50 dark:bg-slate-700">
                        Loading payment form...
                      </div>
                    )}

                    <div className="mt-6 text-center">
                      <p className={cn("text-xs", ONBOARDING_SUBTLE_TEXT)}>
                        Your payment information is secure and encrypted. You
                        can cancel or modify your service anytime.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // STEP 2: Show scheduling step
  if (currentStep === "schedule") {
    const resolveAmountFromStorage = () => {
      if (typeof window === "undefined") return null;
      try {
        const stored = window.sessionStorage.getItem("todaysChargeCents");
        if (!stored) return null;
        const parsed = Number.parseInt(stored, 10);
        return Number.isFinite(parsed) ? Math.max(parsed, 0) : null;
      } catch (storageError) {
        console.warn("Unable to read stored payment amount", storageError);
        return null;
      }
    };

    const resolvedAmountCents =
      typeof confirmedChargeAmount === "number" && confirmedChargeAmount >= 0
        ? confirmedChargeAmount
        : resolveAmountFromStorage();

    const normalizeScheduleCents = (
      value: number | string | null | undefined,
    ): number => {
      if (value === null || value === undefined) return 0;
      if (typeof value === "number") {
        if (Number.isInteger(value)) return value;
        return Math.round(value * 100);
      }
      const trimmed = String(value).trim();
      if (!trimmed) return 0;
      const parsed = Number.parseFloat(trimmed);
      if (!Number.isFinite(parsed)) return 0;
      return trimmed.includes(".") ? Math.round(parsed * 100) : Math.round(parsed);
    };

    const schedulePricingSnapshot = setupIntentData?.pricing;
    const projectedOneTimeInvoiceCents = (() => {
      if (!schedulePricingSnapshot) return 0;

      const initialCleanCents = normalizeScheduleCents(
        schedulePricingSnapshot.initialClean,
      );
      const initialCleanDiscountCents = normalizeScheduleCents(
        schedulePricingSnapshot.initialCleanDiscount,
      );
      const discountedInitialCleanCents = Math.max(
        0,
        normalizeScheduleCents(schedulePricingSnapshot.discountedInitialClean) ||
          (initialCleanCents - Math.min(initialCleanCents, initialCleanDiscountCents)),
      );

      const firstVisitAddOns =
        schedulePricingSnapshot.firstVisitAddOns as
          | Record<string, string | number>
          | undefined;
      const firstVisitAddOnsTotalCents =
        normalizeScheduleCents(firstVisitAddOns?.deodorize) +
        normalizeScheduleCents(firstVisitAddOns?.sprayDeck) +
        normalizeScheduleCents(firstVisitAddOns?.other);

      const firstVisitTotalCents = normalizeScheduleCents(
        schedulePricingSnapshot.firstVisitTotalCents ??
          discountedInitialCleanCents + firstVisitAddOnsTotalCents,
      );

      const oneTimeCents = normalizeScheduleCents(
        schedulePricingSnapshot.oneTime,
      );

      return Math.max(
        firstVisitTotalCents,
        discountedInitialCleanCents + firstVisitAddOnsTotalCents,
        oneTimeCents,
        0,
      );
    })();

    const formatCurrencyFromCents = (value: number | null) => {
      if (value === null || value === undefined) return "$0.00";
      return `$${(value / 100).toFixed(2)}`;
    };

    const normalizedLeadFrequency = (lead?.frequency || "")
      .toLowerCase()
      .replace(/_/g, "-")
      .trim();
    const isOneTimeService =
      normalizedLeadFrequency === "onetime" ||
      normalizedLeadFrequency === "one-time";

    const paymentSummaryCopy = isOneTimeService
      ? `We’ll invoice ${formatCurrencyFromCents(projectedOneTimeInvoiceCents)} after your one-time visit. Your card stays on file until then.`
      : resolvedAmountCents && resolvedAmountCents > 0
        ? `We securely processed ${formatCurrencyFromCents(resolvedAmountCents)} today. Future billing will follow your ${confirmedBillingPreference} cadence.`
        : "Your card has been saved. We'll bill it according to your selected cadence after service begins.";

    const arrivalWindowDetails: Record<
      "morning" | "afternoon" | "flexible",
      { label: string; range: string; summary: string }
    > = {
      morning: {
        label: "Morning window",
        range: "8:00 – 12:00",
        summary: "Ideal if you want a fresh yard before lunch or work-from-home calls.",
      },
      afternoon: {
        label: "Afternoon window",
        range: "12:00 – 4:00",
        summary: "Great for coordinating around school pick-ups and afternoon naps.",
      },
      flexible: {
        label: "Flexible window",
        range: "We’ll text your ETA the night before",
        summary:
          "Great if your schedule changes—expect a confirmation the evening before service.",
      },
    };

    const normalizedSelectedWindow = normalizeWindowSelection(selectedTimeWindow);
    const windowDetails = arrivalWindowDetails[normalizedSelectedWindow] ??
      arrivalWindowDetails.flexible;

    const formattedSelectedDate = (() => {
      if (!selectedDate) return null;
      const parsed = new Date(selectedDate);
      if (Number.isNaN(parsed.getTime())) return null;
      return format(parsed, "EEEE, MMM d");
    })();

    const nextBillingDatePreview = (() => {
      if (!selectedDate) return null;
      try {
        const kickoff = new Date(selectedDate);
        if (Number.isNaN(kickoff.getTime())) return null;
        const normalizedFrequency = (lead?.frequency || "")
          .toLowerCase()
          .replace(/_/g, "-");

        const trialLengthDays = (() => {
          switch (normalizedFrequency) {
            case "biweekly":
            case "bi-weekly":
            case "every-other-week":
              return 14;
            default:
              return 7;
          }
        })();

        const cadenceDays = (() => {
          if (normalizedFrequency === "monthly") {
            return 30;
          }
          if (
            normalizedFrequency === "biweekly" ||
            normalizedFrequency === "bi-weekly" ||
            normalizedFrequency === "every-other-week"
          ) {
            return 14;
          }
          return 7;
        })();

        const activation = addDays(kickoff, trialLengthDays);
        const firstChargeOffset = cadenceDays + 1;
        const billingDate = addDays(activation, firstChargeOffset);
        return format(billingDate, "MMM d");
      } catch {
        return null;
      }
    })();

    return (
      <div className={shellClass}>
        <div className="mx-auto w-full max-w-5xl px-5 pt-24 pb-16 md:container md:px-4 md:pt-28 md:pb-16">
          <div className="mx-auto max-w-5xl space-y-8 md:space-y-10">
            <div className="text-center">
              <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white">Schedule Your First Visit</h1>
              <p className={cn("mt-2 text-sm", ONBOARDING_SUBTLE_TEXT)}>Choose a date that works best for you</p>
            </div>

            <div className="flex items-start gap-3 rounded-3xl border border-slate-200 dark:border-slate-600/25 bg-white dark:bg-slate-800 px-5 py-4 text-left shadow-[0_25px_70px_rgba(0,0,0,0.55)] md:rounded-2xl md:border-brand-soft md:bg-slate-50 dark:bg-slate-700 md:text-slate-900 dark:text-white md:shadow-none">
              <CheckCircle className="mt-1 h-5 w-5 text-slate-600 dark:text-slate-300 md:text-coral" />
              <div>
                <p className="font-semibold text-slate-700 dark:text-slate-200 md:text-slate-900 dark:text-white">Payment confirmed</p>
                <p className={cn("text-sm", ONBOARDING_SUBTLE_TEXT)}>
                  {paymentSummaryCopy}
                </p>
              </div>
            </div>

            {/* Progress Indicator - Step 2 active */}
            <div className="mb-8 flex justify-center">
              <div className="flex w-full max-w-md items-center justify-between rounded-2xl border border-slate-200 dark:border-slate-600/25 bg-slate-100 dark:bg-slate-800 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-600 dark:text-slate-300 md:max-w-none md:rounded-full md:border-none md:bg-transparent md:px-0 md:py-0 md:text-sm md:font-medium md:normal-case md:tracking-normal">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-coral text-slate-900 md:bg-brand-coral md:text-white">
                    <CheckCircle className="h-4 w-4" />
                  </span>
                  <span className="hidden md:inline text-brand-coral">Payment</span>
                  <span className="md:hidden">Pay</span>
                </div>
                <span className="mx-3 h-0.5 flex-1 rounded-full bg-brand-coral/60 md:bg-brand-coral" />
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-coral text-slate-900 md:bg-brand-coral md:text-white">
                    2
                  </span>
                  <span className="hidden md:inline text-brand-coral">Schedule</span>
                  <span className="md:hidden">Plan</span>
                </div>
                <span className="mx-3 h-0.5 flex-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    3
                  </span>
                  <span className="hidden md:inline">Finish</span>
                  <span className="md:hidden">Done</span>
                </div>
              </div>
            </div>

            {lead && (
              <div className="space-y-6">
                {/* Compact info banner - only shows when date selected */}
                {formattedSelectedDate && (
                  <div className="rounded-3xl border border-slate-200 dark:border-slate-600/25 bg-white dark:bg-slate-800 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.5)] md:rounded-2xl md:border-slate-200 dark:border-slate-600 md:bg-gradient-to-r md:from-brand-coral/5 md:to-transparent md:shadow-none">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-700 dark:text-slate-200 md:text-[rgba(var(--graphite-rgb-commas),0.8)]">
                      <div className="flex items-center gap-2">
                        <CalendarCheck className="h-4 w-4 text-slate-600 dark:text-slate-300 md:text-brand-coral" />
                        <span className="font-semibold text-slate-900 dark:text-white md:text-graphite">{formattedSelectedDate}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-slate-600 dark:text-slate-300 md:text-brand-coral" />
                        <span>{windowDetails.range}</span>
                      </div>
                      {nextBillingDatePreview && !isOneTimeService && (
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-slate-600 dark:text-slate-300 md:text-brand-coral" />
                          <span>Next billing: {nextBillingDatePreview}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <ScheduleSelector
                  zipCode={lead.zipCode}
                  onDateSelected={(date) => {
                    setSelectedDate(date);
                    setError("");
                  }}
                  selectedDate={selectedDate ?? undefined}
                  frequency={lead.frequency as any}
                  selectedWindow={selectedTimeWindow}
                  weekendUpgrade={weekendUpgradeEnabled}
                  onWindowSelected={(window) => {
                    setSelectedTimeWindow(window);
                    setError("");
                  }}
                />
              </div>
            )}

            <div className="flex justify-between gap-4">
              <Button
                variant="outline"
                onClick={() => setCurrentStep("payment")}
                className="w-full rounded-2xl border-brand-coral/40/30 bg-transparent px-8 text-slate-700 dark:text-slate-200 hover:bg-brand-coral/10 md:w-auto md:rounded-lg md:border md:border-input md:text-slate-900 dark:text-white md:hover:bg-muted"
              >
                Back
              </Button>
              <Button
                onClick={() => {
                  if (selectedDate) {
                    sessionStorage.setItem("selectedServiceDate", selectedDate);
                    sessionStorage.setItem("selectedServiceWindow", selectedTimeWindow);
                    setError("");
                    setCurrentStep("account");
                  }
                }}
                disabled={!selectedDate}
                className="w-full rounded-2xl bg-brand-coral px-8 text-slate-900 shadow-[0_24px_60px_rgba(0,0,0,0.45)] hover:bg-brand-coral-ink disabled:cursor-not-allowed disabled:bg-emerald-600/50 disabled:text-slate-700 dark:text-slate-200/70 md:w-auto md:rounded-lg md:bg-primary md:text-primary-foreground md:hover:bg-primary/90 md:shadow-sm md:disabled:bg-muted md:disabled:text-muted-foreground"
              >
                Continue to safety step
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // STEP 3: Show safety + account setup step
    return (
      <div className={shellClass}>
        <div className="mx-auto w-full max-w-5xl px-5 pt-24 pb-16 md:container md:px-4 md:pt-28 md:pb-16">
          <div className="mx-auto max-w-5xl space-y-12">
            {/* Header */}
            <div className="rounded-3xl border border-slate-200 dark:border-slate-600/20 bg-white dark:bg-slate-800 px-6 py-10 text-center shadow-[0_35px_100px_rgba(0,0,0,0.55)] backdrop-blur md:rounded-none md:border-none md:bg-transparent md:px-0 md:py-0 md:text-left md:shadow-none">
              <h1 className="text-3xl font-serif font-bold text-slate-900 dark:text-white md:text-4xl">
                Finish Setup: Safety &amp; Sign-in
              </h1>
              <p className={cn("mt-3 text-sm", ONBOARDING_SUBTLE_TEXT)}>
                Tell us how we should work around your pups. Magic-link access is ready, and you can add an optional password.
              </p>
            </div>

            {/* Progress Indicator - final step */}
            <div className="mb-10 flex justify-center md:mb-12">
              <div className="flex w-full max-w-md items-center justify-between rounded-2xl border border-slate-200 dark:border-slate-600/25 bg-slate-100 dark:bg-slate-800 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-600 dark:text-slate-300 md:max-w-none md:rounded-full md:border-none md:bg-transparent md:px-0 md:py-0 md:text-sm md:font-medium md:normal-case md:tracking-normal">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-coral text-slate-900 md:bg-brand-coral md:text-white">
                    <CheckCircle className="h-4 w-4" />
                  </span>
                  <span className="hidden md:inline text-brand-coral">Payment</span>
                  <span className="md:hidden">Pay</span>
                </div>
                <span className="mx-3 h-0.5 flex-1 rounded-full bg-brand-coral/60 md:bg-brand-coral" />
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-coral text-slate-900 md:bg-brand-coral md:text-white">
                    <CheckCircle className="h-4 w-4" />
                  </span>
                  <span className="hidden md:inline text-brand-coral">Schedule</span>
                  <span className="md:hidden">Plan</span>
                </div>
                <span className="mx-3 h-0.5 flex-1 rounded-full bg-brand-coral/60 md:bg-brand-coral" />
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-coral text-slate-900 md:bg-brand-coral md:text-white">
                    3
                  </span>
                  <span className="hidden md:inline text-brand-coral">Finish</span>
                  <span className="md:hidden">Done</span>
                </div>
              </div>
            </div>

            <div className="mb-12 space-y-8">
              <div className="text-left">
                <h2 className="text-2xl font-serif font-semibold text-slate-900 dark:text-white">Dog Safety & Entry Preferences</h2>
                <p className={cn("mt-2 text-sm", ONBOARDING_SUBTLE_TEXT)}>
                  Show us how to access your yard, where to leave sealed bags, and how to work around your pups.
                </p>
              </div>

              <section className={cn(panelClass, panelDesktopReset, "space-y-6 p-6 text-slate-700 dark:text-slate-200 md:text-slate-900 dark:text-white")}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-2">
                    <h3 className="text-lg font-serif font-semibold text-slate-900 dark:text-white">Where do we enter the yard?</h3>
                    <p className={cn("text-sm", ONBOARDING_SUBTLE_TEXT)}>
                      Choose the gate technicians should use on their first visit. We’ll follow up if anything changes.
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className="rounded-full border border-brand-coral/40/40 bg-brand-coral/10 text-slate-600 dark:text-slate-300 md:border-transparent md:bg-brand-soft/30 md:text-slate-900 dark:text-white"
                  >
                    Adjust anytime from your dashboard
                  </Badge>
                </div>
                {/* Primary gate location */}
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {[
                    {
                      id: "left",
                      label: "Left side",
                      description: "Gate on left side of house",
                      icon: <Fence className="w-5 h-5" aria-hidden="true" />,
                    },
                    {
                      id: "right",
                      label: "Right side",
                      description: "Gate on right side of house",
                      icon: <Fence className="w-5 h-5" aria-hidden="true" />,
                    },
                    {
                      id: "back",
                      label: "Back/alley",
                      description: "Access from rear or alley",
                      icon: <Fence className="w-5 h-5" aria-hidden="true" />,
                    },
                    {
                      id: "front",
                      label: "No gate / Open yard",
                      description: "Unfenced or always open",
                      icon: <DoorOpen className="w-5 h-5" aria-hidden="true" />,
                    },
                    {
                      id: "other",
                      label: "Other",
                      description: "Describe below",
                      icon: <DoorOpen className="w-5 h-5" aria-hidden="true" />,
                    },
                  ].map((option) => {
                    const isSelected = gateLocation === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => {
                          setGateLocation(option.id);
                          // Reset reference when changing primary location
                          if (option.id === "front" || option.id === "back" || option.id === "other") {
                            setGateReference(null);
                          }
                          setError("");
                        }}
                        className={cn(
                          "group relative rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral/40",
                          isSelected ? ONBOARDING_CARD_SELECTED : ONBOARDING_CARD_IDLE,
                        )}
                      >
                        <span
                          className={cn(
                            "mb-3 inline-flex items-center justify-center rounded-xl p-2",
                            isSelected
                              ? "bg-brand-coral/25 text-slate-100 dark:text-white md:bg-brand-coral/12 md:text-brand-coral"
                              : "bg-brand-coral/10 text-slate-100 dark:text-white/80 md:bg-brand-coral/8 md:text-brand-coral",
                          )}
                        >
                          {option.icon}
                        </span>
                        <span className={cn("block font-serif text-base font-semibold", isSelected ? "text-slate-900 dark:text-white" : "")}>
                          {option.label}
                        </span>
                        <span className={cn("mt-1 block text-sm", ONBOARDING_SUBTLE_TEXT)}>
                          {option.description}
                        </span>
                        {isSelected && (
                          <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-brand-coral/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-100 dark:text-white md:bg-brand-coral/15 md:text-slate-900 dark:text-white">
                            <CheckCircle className="w-3 h-3" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Gate instructions */}
                {gateLocation && (
                  <div className="space-y-2 pt-2">
                    <Label
                      htmlFor="gateLocationNotes"
                      className={cn("text-sm font-semibold", ONBOARDING_HEADING_CLASS)}
                    >
                      Gate instructions {gateLocation === "other" ? "(required)" : "(optional)"}
                    </Label>
                    <Textarea
                      id="gateLocationNotes"
                      value={gateLocationNotes}
                      onChange={(event) => setGateLocationNotes(event.target.value)}
                      placeholder="e.g., Latch sticks - lift up as you open. Bell on gate."
                      className={cn("min-h-[72px]", ONBOARDING_INPUT_CLASS)}
                    />
                  </div>
                )}
              </section>

              <div className="grid gap-6 lg:grid-cols-2">
                <section
                  className={cn(
                    panelClass,
                    panelDesktopReset,
                    "space-y-4 p-6",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <KeySquare className="mt-0.5 h-5 w-5 text-slate-100 dark:text-white/80 md:text-brand-coral" />
                    <div>
                      <h3 className={cn("font-serif text-lg font-semibold", ONBOARDING_HEADING_CLASS)}>
                        Community or neighborhood gate
                      </h3>
                      <p className={cn("text-sm", ONBOARDING_SUBTLE_TEXT)}>
                        Does your neighborhood have a gate we&apos;ll need a code for?
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {["yes", "no"].map((option) => {
                      const isSelected = communityGateAccess === option;
                      return (
                        <button
                          key={`community-gate-${option}`}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => {
                            setCommunityGateAccess(option);
                            if (option === "no") {
                              setCommunityGateCode("");
                            }
                            setError("");
                          }}
                          className={cn(
                            "rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral/40",
                            isSelected ? ONBOARDING_CARD_SELECTED : ONBOARDING_CARD_IDLE,
                          )}
                        >
                          {option === "yes" ? "Yes, code needed" : "No code required"}
                        </button>
                      );
                    })}
                  </div>
                  {communityGateAccess === "yes" && (
                    <div className="space-y-2">
                      <Label htmlFor="communityGateCode" className={cn("text-sm font-semibold", ONBOARDING_HEADING_CLASS)}>
                        Community gate code
                      </Label>
                      <Input
                        id="communityGateCode"
                        value={communityGateCode}
                        placeholder="e.g., #1234 or call box instructions"
                        onChange={(event) => {
                          setCommunityGateCode(event.target.value);
                          setError("");
                        }}
                        className={ONBOARDING_INPUT_CLASS}
                      />
                    </div>
                  )}
                </section>

                <section
                  className={cn(
                    panelClass,
                    panelDesktopReset,
                    "space-y-4 p-6",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <KeyRound className="mt-0.5 h-5 w-5 text-slate-100 dark:text-white/80 md:text-brand-coral" />
                    <div>
                      <h3 className={cn("font-serif text-lg font-semibold", ONBOARDING_HEADING_CLASS)}>Backyard gate lock</h3>
                      <p className={cn("text-sm", ONBOARDING_SUBTLE_TEXT)}>
                        Let us know if we'll need a code or key to open your yard gate.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {["yes", "no"].map((option) => {
                      const isSelected = homeGateAccess === option;
                      return (
                        <button
                          key={`home-gate-${option}`}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => {
                            setHomeGateAccess(option);
                            if (option === "no") {
                              setHomeGateCode("");
                            }
                            setError("");
                          }}
                        className={cn(
                          "rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral/40",
                          isSelected ? ONBOARDING_YESNO_SELECTED : ONBOARDING_YESNO_IDLE,
                        )}
                        >
                          {option === "yes" ? "Yes, there’s a lock" : "No lock needed"}
                        </button>
                      );
                    })}
                  </div>
                  {homeGateAccess === "yes" && (
                    <div className="space-y-2">
                      <Label htmlFor="homeGateCode" className={cn("text-sm font-semibold", ONBOARDING_HEADING_CLASS)}>
                        Gate code or location of key
                      </Label>
                      <Input
                        id="homeGateCode"
                        value={homeGateCode}
                        placeholder="e.g., 2489 or key hidden under planter"
                        onChange={(event) => {
                          setHomeGateCode(event.target.value);
                          setError("");
                        }}
                        className={ONBOARDING_INPUT_CLASS}
                      />
                    </div>
                  )}
                </section>
              </div>

              <section
                className={cn(
                  panelClass,
                  panelDesktopReset,
                  "space-y-5 p-6 text-slate-700 dark:text-slate-200 md:text-slate-900 dark:text-white",
                )}
              >
                <div className="flex items-start gap-3">
                  <Dog className="mt-0.5 h-5 w-5 text-slate-600 dark:text-slate-300 md:text-slate-900 dark:text-white" />
                  <div>
                    <h3 className="text-lg font-serif font-semibold text-slate-900 dark:text-white">Dog presence</h3>
                    <p className={cn("text-sm", ONBOARDING_SUBTLE_TEXT)}>
                      Give us a sense of how your dogs use the yard so we can plan the visit around them.
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    {
                      id: "dog-door",
                      title: "Doggy door",
                      description: "Dogs can let themselves outside",
                      value: dogDoor,
                      setter: setDogDoor,
                    },
                    {
                      id: "dogs-outside",
                      title: "Dogs outside alone",
                      description: "They roam the yard when you’re away",
                      value: dogsOutside,
                      setter: setDogsOutside,
                    },
                    {
                      id: "clean-with-dogs",
                      title: "Work with dogs present",
                      description: "We can scoop while they hang with us",
                      value: cleanWithDogs,
                      setter: setCleanWithDogs,
                    },
                  ].map(({ id, title, description, value, setter }) => (
                    <div
                      key={id}
                      className="rounded-2xl border border-slate-200 dark:border-slate-600/20 bg-white dark:bg-slate-800 p-4 shadow-[0_16px_32px_rgba(0,0,0,0.45)] md:border-brand-soft md:bg-white md:shadow-sm"
                    >
                      <p className="text-sm font-semibold text-slate-900 dark:text-white md:text-slate-900 dark:text-white">{title}</p>
                      <p className={cn("mt-1 text-xs", ONBOARDING_SUBTLE_TEXT)}>{description}</p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {["yes", "no"].map((option) => {
                          const isSelected = value === option;
                          return (
                            <button
                              key={`${id}-${option}`}
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() => {
                                setter(option);
                                setError("");
                              }}
                              className={cn(
                                "rounded-xl border px-3 py-2 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral/40",
                                isSelected ? ONBOARDING_YESNO_SELECTED : ONBOARDING_YESNO_IDLE,
                              )}
                            >
                              {option === "yes" ? "Yes" : "No"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {shouldShowTrashPlacement && (
                <section
                  className={cn(
                    panelClass,
                    panelDesktopReset,
                    "space-y-4 p-6 text-slate-700 dark:text-slate-200 md:text-slate-900 dark:text-white",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Trash2 className="mt-0.5 h-5 w-5 text-slate-600 dark:text-slate-300 md:text-slate-900 dark:text-white" />
                    <div>
                      <h3 className="text-lg font-serif font-semibold text-slate-900 dark:text-white">
                        Where should we place sealed bags?
                      </h3>
                      <p className={cn("text-sm", ONBOARDING_SUBTLE_TEXT)}>
                        Pick the spot that works best on typical service days.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      {
                        id: "side-bin",
                        label: "Side of house bin",
                        description: "Garbage bin on the side of the house",
                        icon: <Trash2 className="w-4 h-4" />,
                      },
                      {
                        id: "garage-exterior",
                        label: "Outside garage",
                        description: "Bin outside the garage door",
                        icon: <Building2 className="w-4 h-4" />,
                      },
                      {
                        id: "garage-interior",
                        label: "Inside garage",
                        description: "Leave just inside the garage",
                        icon: <Home className="w-4 h-4" />,
                      },
                      {
                        id: "alley",
                        label: "Alley bin",
                        description: "Bin in the alley or back enclosure",
                        icon: <Trash2 className="w-4 h-4" />,
                      },
                      {
                        id: "curb",
                        label: "Curbside bin",
                        description: "City bin at the curb",
                        icon: <Trash2 className="w-4 h-4" />,
                      },
                      {
                        id: "backyard",
                        label: "Backyard bin",
                        description: "Bin inside the fenced backyard",
                        icon: <Trash2 className="w-4 h-4" />,
                      },
                      {
                        id: "other",
                        label: "Other location",
                        description: "Describe below",
                        icon: <MapPin className="w-4 h-4" />,
                      },
                    ].map((option) => {
                      const isSelected = trashLocation === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => {
                            setTrashLocation(option.id);
                            setError("");
                          }}
                          className={cn(
                            "rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral/40",
                            isSelected ? ONBOARDING_CARD_SELECTED : ONBOARDING_CARD_IDLE,
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <span className={cn(
                              "inline-flex items-center justify-center rounded-lg p-2",
                              isSelected
                                ? "bg-brand-coral/25 text-slate-100 dark:text-white md:bg-brand-coral/12 md:text-brand-coral"
                                : "bg-brand-coral/10 text-slate-100 dark:text-white/80 md:bg-brand-coral/8 md:text-brand-coral",
                            )}>
                              {option.icon}
                            </span>
                            <div>
                              <p className={cn("font-serif text-sm font-semibold", isSelected ? "text-slate-900 dark:text-white" : "")}>
                                {option.label}
                              </p>
                              <p className={cn("mt-0.5 text-xs", ONBOARDING_SUBTLE_TEXT)}>
                                {option.description}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {shouldShowTrashPlacement && trashLocation && (
                    <div className="space-y-2 pt-2">
                      <Label
                        htmlFor="trashLocationNotes"
                        className={cn("text-sm font-semibold", ONBOARDING_HEADING_CLASS)}
                      >
                        Bag drop instructions (optional)
                      </Label>
                      <Textarea
                        id="trashLocationNotes"
                        value={trashLocationNotes}
                        onChange={(event) => setTrashLocationNotes(event.target.value)}
                        placeholder="e.g., Large black garbage bin by garage, lid sometimes sticks"
                        className={cn("min-h-[72px]", ONBOARDING_INPUT_CLASS)}
                      />
                    </div>
                  )}
                </section>
              )}

              {/* Parking instructions */}
              <section
                className={cn(
                  panelClass,
                  panelDesktopReset,
                  "space-y-4 p-6",
                )}
              >
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 text-slate-100 dark:text-white/80 md:text-brand-coral" />
                  <div>
                    <h3 className={cn("font-serif text-lg font-semibold", ONBOARDING_HEADING_CLASS)}>
                      Where should the crew park?
                    </h3>
                    <p className={cn("text-sm", ONBOARDING_SUBTLE_TEXT)}>
                      Help us avoid parking issues and find your place quickly.
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { id: "street", label: "Street parking", description: "Park on the street in front" },
                    { id: "driveway", label: "Driveway okay", description: "Can use the driveway" },
                    { id: "alley", label: "Alley access", description: "Park in or near the alley" },
                    { id: "visitor", label: "Visitor spot", description: "Designated visitor parking" },
                  ].map((option) => {
                    const isSelected = parkingInstructions === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => {
                          setParkingInstructions(isSelected ? null : option.id);
                          setError("");
                        }}
                        className={cn(
                          "rounded-xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral/40",
                          isSelected ? ONBOARDING_CARD_SELECTED : ONBOARDING_CARD_IDLE,
                        )}
                      >
                        <p className={cn("text-sm font-semibold", isSelected ? "text-slate-900 dark:text-white" : "")}>
                          {option.label}
                        </p>
                        <p className={cn("mt-0.5 text-xs", ONBOARDING_SUBTLE_TEXT)}>{option.description}</p>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Additional notes */}
              <section
                className={cn(
                  panelClass,
                  panelDesktopReset,
                  "space-y-3 p-6",
                )}
              >
                <Label htmlFor="accessNotes" className={cn("text-sm font-semibold", ONBOARDING_HEADING_CLASS)}>
                  Anything else we should know?
                </Label>
                <p className={cn("text-xs", ONBOARDING_SUBTLE_TEXT)}>
                  Nervous pups, garden beds to avoid, best times to arrive—whatever makes the visit smoother.
                </p>
                <Textarea
                  id="accessNotes"
                  value={accessNotes}
                  onChange={(event) => {
                    setAccessNotes(event.target.value);
                    setError("");
                  }}
                  placeholder="e.g., Ring doorbell so we know you're here. Avoid flower beds on left side."
                  className={cn("mt-2 min-h-[110px]", ONBOARDING_INPUT_CLASS)}
                />
              </section>

              {error && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-600/40 bg-brand-coral/10 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 md:rounded-lg md:border-brand-coral/50 md:bg-brand-coral/10 md:text-brand-coral">
                  {error}
                </div>
              )}

              {hasAttemptedSubmit && !canCompleteSafetyStep && safetyStepMissing.length ? (
                <div 
                  id="safety-validation-error"
                  className="rounded-xl border-2 border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 px-4 py-3 animate-pulse"
                >
                  <p className="text-sm font-medium text-red-700 dark:text-red-400">
                    Please complete the following required fields:
                  </p>
                  <ul className="mt-1 text-sm text-red-600 dark:text-red-300 list-disc list-inside">
                    {safetyStepMissing.map((item) => (
                      <li key={item} className="capitalize">{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex justify-between pt-6">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep("schedule")}
                    className="px-8 border-slate-200 dark:border-slate-600/30 bg-transparent text-slate-700 dark:text-slate-200 hover:bg-brand-coral/15 md:border md:border-input md:bg-transparent md:text-slate-900 dark:text-white md:hover:bg-muted"
                    disabled={isCompletingSetup}
                  >
                    Back
                  </Button>
                  <Button
                    disabled={isCompletingSetup}
                    onClick={async () => {
                      if (isCompletingSetup) {
                        return;
                      }

                      setError("");

                      if (!leadId) {
                        setError("We couldn't find your quote details. Please restart onboarding from your quote email.");
                        return;
                      }

                      if (!canCompleteSafetyStep) {
                        setHasAttemptedSubmit(true);
                        // Scroll to the validation error after a brief delay to let it render
                        setTimeout(() => {
                          const errorEl = document.getElementById("safety-validation-error");
                          if (errorEl) {
                            errorEl.scrollIntoView({ behavior: "smooth", block: "center" });
                          }
                        }, 100);
                        return;
                      }

                      setIsCompletingSetup(true);

                      try {
                        // Store preferences just for downstream steps
                        try {
                          // Always use magic link - password setup moved to completion page
                          sessionStorage.setItem("authMethod", "magic");
                          if (dogDoor) {
                            sessionStorage.setItem("dogDoor", dogDoor);
                          } else {
                            sessionStorage.removeItem("dogDoor");
                          }
                          if (dogsOutside) {
                            sessionStorage.setItem("dogsOutside", dogsOutside);
                          } else {
                            sessionStorage.removeItem("dogsOutside");
                          }
                          if (cleanWithDogs) {
                            sessionStorage.setItem("cleanWithDogs", cleanWithDogs);
                          } else {
                            sessionStorage.removeItem("cleanWithDogs");
                          }
                          if (gateLocation) {
                            sessionStorage.setItem("gateLocation", gateLocation);
                          } else {
                            sessionStorage.removeItem("gateLocation");
                          }
                          if (shouldShowTrashPlacement && trashLocation) {
                            sessionStorage.setItem("trashLocation", trashLocation);
                          } else {
                            sessionStorage.removeItem("trashLocation");
                          }
                          if (trimmedGateLocationNotes) {
                            sessionStorage.setItem("gateLocationNotes", trimmedGateLocationNotes);
                          } else {
                            sessionStorage.removeItem("gateLocationNotes");
                          }
                          if (trimmedTrashLocationNotes) {
                            sessionStorage.setItem("trashLocationNotes", trimmedTrashLocationNotes);
                          } else {
                            sessionStorage.removeItem("trashLocationNotes");
                          }
                          if (communityGateAccess) {
                            sessionStorage.setItem("communityGateAccess", communityGateAccess);
                          } else {
                            sessionStorage.removeItem("communityGateAccess");
                          }
                          if (trimmedCommunityGateCode) {
                            sessionStorage.setItem("communityGateCode", trimmedCommunityGateCode);
                          } else {
                            sessionStorage.removeItem("communityGateCode");
                          }
                          if (homeGateAccess) {
                            sessionStorage.setItem("homeGateAccess", homeGateAccess);
                          } else {
                            sessionStorage.removeItem("homeGateAccess");
                          }
                          if (trimmedHomeGateCode) {
                            sessionStorage.setItem("homeGateCode", trimmedHomeGateCode);
                          } else {
                            sessionStorage.removeItem("homeGateCode");
                          }
                          if (trimmedAccessNotes) {
                            sessionStorage.setItem("accessNotes", trimmedAccessNotes);
                          } else {
                            sessionStorage.removeItem("accessNotes");
                          }
                        } catch (storageError) {
                          console.warn("Unable to persist onboarding preferences", storageError);
                        }

                        // Redirect to complete page
                        let resolvedSetupIntentId = confirmedSetupIntentId;

                        if (!resolvedSetupIntentId) {
                          try {
                            resolvedSetupIntentId = sessionStorage.getItem("setupIntentId");
                          } catch (storageError) {
                            console.warn("Unable to read stored setup intent id", storageError);
                          }
                        }

                        if (!resolvedSetupIntentId) {
                          const fallbackSecret =
                            setupIntentData.clientSecret?.split("_secret")[0] ?? "";
                          resolvedSetupIntentId = fallbackSecret || null;
                        }

                        if (!resolvedSetupIntentId) {
                          setError("We couldn't find your saved payment method. Please return to the payment step and try again.");
                          setCurrentStep("payment");
                          setIsCompletingSetup(false);
                          return;
                        }

                        let resolvedAmountCents =
                          confirmedChargeAmount != null &&
                          Number.isFinite(confirmedChargeAmount) &&
                          confirmedChargeAmount > 0
                            ? confirmedChargeAmount
                            : undefined;

                        if (resolvedAmountCents === undefined) {
                          try {
                            const storedAmount = sessionStorage.getItem("todaysChargeCents");
                            if (storedAmount) {
                              const parsedAmount = Number.parseInt(storedAmount, 10);
                              if (!Number.isNaN(parsedAmount) && parsedAmount > 0) {
                                resolvedAmountCents = parsedAmount;
                              }
                            }
                          } catch (storageError) {
                            console.warn("Unable to read stored payment amount", storageError);
                          }
                        }

                        if (resolvedAmountCents === undefined) {
                          const fallbackRaw =
                            (setupIntentData.pricing.amountDueToday as number | undefined) ??
                            (setupIntentData.pricing.firstMonthCents as number | undefined) ??
                            (setupIntentData.pricing.firstVisitTotalCents as number | undefined) ??
                            0;
                          resolvedAmountCents = Math.max(
                            0,
                            Number.isFinite(fallbackRaw) ? Math.round(fallbackRaw) : 0,
                          );
                        }

                        try {
                          if (selectedDate) {
                            sessionStorage.setItem("selectedServiceDate", selectedDate);
                          }
                          if (selectedTimeWindow) {
                            sessionStorage.setItem("selectedServiceWindow", selectedTimeWindow);
                          }
                        } catch (storageError) {
                          console.warn("Unable to persist scheduling selections", storageError);
                        }

                        void router.push(
                          `/onboarding/complete?leadId=${encodeURIComponent(leadId)}&setup_intent=${encodeURIComponent(
                            resolvedSetupIntentId,
                          )}&amount=${resolvedAmountCents}`,
                        );
                      } catch (submitError) {
                        console.error("Unable to complete setup", submitError);
                        setError(
                          submitError instanceof Error
                            ? submitError.message
                            : "We ran into an unexpected issue finishing your setup. Please try again.",
                        );
                        setIsCompletingSetup(false);
                      }
                    }}
                    className="px-8"
                  >
                    {isCompletingSetup ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Finalizing...
                      </>
                    ) : (
                      <>
                        Complete Setup
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-accent/5 to-accent-soft/10 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <OnboardingSetupContent />
    </Suspense>
  );
}
