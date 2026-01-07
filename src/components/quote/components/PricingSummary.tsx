"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InitialCleanLabel } from "@/components/quote/InitialCleanTooltip";
import { FirstWeekCreditBanner } from "./FirstWeekCreditBanner";
import { PricingData, QuoteData } from "@/types/quote";
import { getFrequencyDisplayName } from "@/lib/priceEstimator";
import {
  derivePostTrialPresentation,
  deriveTrialWeekPresentation,
  describeFirstWeekCoverage,
} from "@/lib/pricing-presentation";
import { formatVisitsRange } from "@/lib/utils";
import { extractWeekendUpgrade } from "@/lib/pricing/weekend";

interface PricingSummaryProps {
  pricing: PricingData;
  frequency?: string;
  quoteData?: QuoteData;
}

const formatCents = (value: number | null | undefined) => {
  if (!value || !Number.isFinite(value)) return "$0.00";
  return `$${(value / 100).toFixed(2)}`;
};

const toCents = (value: unknown): number => {
  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      return value;
    }
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

export function PricingSummary({ pricing, frequency, quoteData }: PricingSummaryProps) {
  const normalizedFrequency = frequency?.toLowerCase();
  const weekendUpgradeEnabled = useMemo(
    () =>
      extractWeekendUpgrade(
        quoteData?.weekendUpgrade ?? null,
        pricing.weekendUpgrade ?? null,
        pricing.breakdown ?? null,
        pricing,
      ),
    [pricing, quoteData?.weekendUpgrade],
  );
  const trial = useMemo(
    () => deriveTrialWeekPresentation(pricing, normalizedFrequency),
    [pricing, normalizedFrequency],
  );
  const postTrial = useMemo(
    () => derivePostTrialPresentation(pricing),
    [pricing],
  );

  const frequencyDisplayName = useMemo(() => {
    if (!frequency) return null;
    return getFrequencyDisplayName(frequency as any, {
      weekendUpgrade: weekendUpgradeEnabled,
    });
  }, [frequency, weekendUpgradeEnabled]);

  const visitsPerMonthValue = useMemo(() => {
    const parseVisits = (value: unknown): number | null => {
      if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
      }
      if (typeof value === "string") {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    };

    const base = parseVisits(pricing.visitsPerMonth);
    const weekend = parseVisits(pricing.weekendVisitsPerMonth);

    if (weekendUpgradeEnabled && weekend && weekend > 0) {
      return weekend;
    }

    return base;
  }, [pricing.visitsPerMonth, pricing.weekendVisitsPerMonth, weekendUpgradeEnabled]);

  const visitsPerMonthLabel = useMemo(() => {
    if (!visitsPerMonthValue) return null;
    return formatVisitsRange(visitsPerMonthValue);
  }, [visitsPerMonthValue]);

  if (!pricing) return null;

  const isOneTime = normalizedFrequency === "onetime" || normalizedFrequency === "one-time";

  const perVisitBaseCents =
    postTrial?.perVisitCents ?? toCents(pricing.perVisit);

  const baseMonthlyCandidate =
    postTrial?.monthlyCents ?? toCents(pricing.fullMonthlyAmount ?? pricing.monthly);

  const computedMonthlyFromVisits =
    perVisitBaseCents > 0 && visitsPerMonthValue
      ? Math.round(perVisitBaseCents * visitsPerMonthValue)
      : null;

  const monthlyAmountCents = (() => {
    if (weekendUpgradeEnabled) {
      return computedMonthlyFromVisits ?? baseMonthlyCandidate ?? 0;
    }
    return baseMonthlyCandidate ?? computedMonthlyFromVisits ?? 0;
  })();

  if (isOneTime) {
    return (
      <div className="sticky top-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">One-time service</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-brand-muted">
            <div className="flex items-center justify-between text-brand-ink">
              <span className="font-medium">Visit total</span>
              <span className="text-2xl font-semibold text-brand-ink">
                {formatCents(typeof pricing.oneTime === "number" ? pricing.oneTime : Number(pricing.oneTime) || 0)}
              </span>
            </div>
            <p className="text-xs">
              We invoice after the cleanup wraps so you only pay for a completed visit.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const coverageDescriptor = trial?.descriptor ?? describeFirstWeekCoverage(normalizedFrequency, trial?.followUpVisitCount || 0);

  return (
    <div className="sticky top-4 space-y-4">
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Free trial week</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-2">
            {trial?.charges.map((item) => (
              <div key={`trial-charge-${item.key}`} className="flex items-center justify-between text-brand-ink">
                <span>{item.label}</span>
                <span className="font-semibold">{formatCents(item.amountCents)}</span>
              </div>
            ))}
          </div>

          {trial?.credits.length ? (
            <div className="space-y-2 border-t border-brand-soft pt-2">
              {trial.credits.map((item) => (
                <div key={`trial-credit-${item.key}`} className="flex items-center justify-between text-emerald-600">
                  <span>{item.label}</span>
                  <span className="font-semibold">-{formatCents(item.amountCents)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-brand-ink">
                <span className="font-medium">Trial week total</span>
                <span className="text-lg font-semibold">{formatCents(trial?.netDueCents ?? 0)}</span>
              </div>
            </div>
          ) : null}

          {coverageDescriptor ? (
            <p className="text-xs text-brand-muted">{coverageDescriptor}</p>
          ) : null}

          {trial ? (
            <FirstWeekCreditBanner
              amount={formatCents(trial.totalCreditCents)}
              descriptor="Your kickoff week is on us"
              subtext={
                trial.trialLengthDays
                  ? `Schedule within ${trial.trialLengthDays} days so we can wrap the free coverage before billing starts.`
                  : "We'll apply the credit automatically before your first invoice."
              }
              className="text-left"
            />
          ) : null}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">After the trial</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-brand-ink">
              <span className="font-medium">Per visit</span>
              <span className="text-lg font-semibold">{formatCents(perVisitBaseCents)}</span>
            </div>
            {frequencyDisplayName ? (
              <span className="block text-xs text-brand-muted">{frequencyDisplayName}</span>
            ) : null}
            {weekendUpgradeEnabled ? (
              <span className="block text-xs text-emerald-500 md:text-brand-muted">
                Weekend coverage included
              </span>
            ) : null}
            {visitsPerMonthLabel ? (
              <span className="block text-xs text-brand-muted">~{visitsPerMonthLabel} / month</span>
            ) : null}
          </div>

          {monthlyAmountCents > 0 ? (
            <div className="flex items-center justify-between rounded-lg bg-brand-soft/30 px-3 py-2 text-sm">
              <span className="font-medium text-brand-ink">Flat monthly option</span>
              <span className="font-semibold text-brand-ink">{formatCents(monthlyAmountCents)}</span>
            </div>
          ) : null}
          {weekendUpgradeEnabled && pricing.weekendSurchargeCents ? (
            <p className="text-xs text-brand-muted">
              Weekend coverage adds {formatCents(pricing.weekendSurchargeCents)} to each billing cycle.
            </p>
          ) : null}

          {postTrial.firstInvoiceAddOns.length ? (
            <div className="space-y-2 border-t border-brand-soft pt-2">
              <div className="font-medium text-brand-ink">First paid visit add-ons</div>
              {postTrial.firstInvoiceAddOns.map((item) => (
                <div key={item.key} className="flex items-center justify-between text-brand-muted">
                  <span>{item.label}</span>
                  <span>{formatCents(item.amountCents)}</span>
                </div>
              ))}
            </div>
          ) : null}

          {postTrial.activationDelayDays ? (
            <p className="text-xs text-brand-muted">
              Subscription billing activates {postTrial.activationDelayDays === 7 ? "one week" : `${postTrial.activationDelayDays} days`} after your kickoff visit.
            </p>
          ) : null}

          {quoteData?.addOns?.deodorize ? (
            <div className="rounded-lg bg-brand-soft/20 px-3 py-2 text-xs text-brand-muted">
              Deodorize & sanitize runs every visit  -  included in the per-visit rate above.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Need help?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-brand-muted">
          <p>
            Questions about add-ons or billing? Our concierge can walk you through the first week and monthly options.
          </p>
          <div className="text-xs">
            <div>Email concierge@getinsightscoop.com</div>
            <div>Call or text 1-877-417-YARD</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
