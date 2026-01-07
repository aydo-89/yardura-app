"use client";

import React, { useMemo, useState } from "react";
import { motion } from "@/lib/framermotion";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Clock, CheckCircle } from "lucide-react";
import { cn, getVisitsBounds } from "@/lib/utils";

import { StepProps } from "@/types/quote";
import { getServiceTypeOptions } from "@/lib/priceEstimator";
import { track } from "@/lib/analytics";
import {
  withQuotePanel,
  quoteSubtleTextClass,
  quoteSurfaceClass,
  quoteMutedBadgeClass,
  quoteHeadingClass,
} from "../quoteStyles";

const frequencyCardBase =
  "group relative flex h-full flex-col rounded-3xl border-2 p-5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral/40";
const frequencyCardSelected =
  "border-brand-coral/55 bg-brand-coral/10 text-brand-ink shadow-[0_20px_50px_rgba(243,100,91,0.2)] ring-2 ring-brand-coral/40 dark:border-brand-coral/70 dark:bg-brand-coral/15 dark:text-cream-vanilla dark:ring-brand-coral/45";
const frequencyCardIdle =
  "border-brand-coral/15 bg-cream-vanilla/60 text-brand-ink hover:border-brand-coral/35 hover:bg-cream-vanilla/80 hover:shadow-[0_12px_32px_rgba(243,100,91,0.08)] dark:border-brand-coral/30 dark:bg-evergreen-800/80 dark:text-cream-vanilla dark:hover:border-brand-coral/45";

const formatCurrency = (value: number) =>
  Number.isFinite(value) && value > 0 ? `$${value.toFixed(2)}` : " - ";

const formatCurrencyCompact = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return " - ";
  const hasCents = Math.abs(value * 100 - Math.round(value * 100)) > 0.0001;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(value);
};

const formatCurrencyRange = (min: number, max: number) => {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return " - ";
  if (Math.abs(min - max) < 0.005) {
    return formatCurrencyCompact(min);
  }
  return `${formatCurrencyCompact(min)}–${formatCurrencyCompact(max)}`;
};

export const StepFrequency: React.FC<StepProps> = ({
  quoteData,
  updateQuoteData,
  _estimatedPrice,
}) => {
  const serviceTypeOptions = useMemo(() => getServiceTypeOptions(), []);
  const [showHighFrequency, setShowHighFrequency] = useState(false);

  const orderedFrequencyOptions = useMemo(() => {
    const desiredOrder = [
      "weekly",
      "twice-weekly",
      "biweekly",
      "monthly",
      "onetime",
      "daily",
    ];

    return desiredOrder
      .map((id) => serviceTypeOptions.find((option) => option.value === id))
      .filter((option): option is (typeof serviceTypeOptions)[number] => Boolean(option))
      .map((option) => ({
        id: option.value,
        title: option.label,
        subtitle: option.isPopular
          ? "Most popular"
          : option.description.split(" - ")[0] || "",
        description: option.description,
        icon:
          option.value === "daily"
            ? "🌤️"
            : option.value === "twice-weekly"
              ? "⚡"
              : option.value === "weekly"
                ? "📅"
                : option.value === "biweekly"
                  ? "📆"
                  : option.value === "monthly"
                    ? "🗓️"
                    : "🧹",
        popular: option.isPopular || false,
        premium: option.value === "daily",
      }));
  }, [serviceTypeOptions]);

  const handleFrequencySelect = (frequency: string) => {
    const nextWeekendUpgrade =
      frequency === "daily"
        ? Boolean(quoteData.weekendUpgrade)
        : false;

    updateQuoteData({
      frequency: frequency as any,
      weekendUpgrade: nextWeekendUpgrade,
    });
    track("frequency_selected", {
      frequency,
      estimate_present: Boolean(_estimatedPrice),
    });
  };

  const resolvedFrequency = useMemo(() => {
    if (!quoteData.frequency) {
      return "weekly" as const;
    }
    return quoteData.frequency === "one-time"
      ? ("onetime" as const)
      : quoteData.frequency;
  }, [quoteData.frequency]);
  const hasDailySelected = resolvedFrequency === "daily";
  const showDailyOptions = showHighFrequency || hasDailySelected;
  const baseFrequencyOptions = orderedFrequencyOptions.filter(
    (option) => option.id !== "daily",
  );
  const displayedFrequencyOptions = showDailyOptions
    ? orderedFrequencyOptions
    : baseFrequencyOptions;

  const weekendUpgradeEnabled = Boolean(quoteData.weekendUpgrade);

  const parseAmount = (value: unknown): number => {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const parsed = parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  const isCustomQuote = Boolean((_estimatedPrice as any)?.requiresCustomQuote);
  const perVisitAmount = isCustomQuote ? 0 : parseAmount(_estimatedPrice?.perVisit);
  const rawMonthlyAmount = isCustomQuote ? 0 : parseAmount(_estimatedPrice?.monthly);
  const oneTimeAmount = isCustomQuote ? 0 : parseAmount(_estimatedPrice?.oneTime);
  const parseVisitsFloat = (value: unknown): number => {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === "string") {
      const parsed = parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  const baseVisitsPerMonth = isCustomQuote ? 0 : parseVisitsFloat(_estimatedPrice?.visitsPerMonth);
  const weekendVisitsPerMonth = isCustomQuote ? 0 : parseVisitsFloat(((_estimatedPrice as any)?.weekendVisitsPerMonth));
  const visitsPerMonth = weekendUpgradeEnabled && weekendVisitsPerMonth > 0 ? weekendVisitsPerMonth : baseVisitsPerMonth;
  const weekendSurcharge = isCustomQuote
    ? 0
    : parseAmount((_estimatedPrice as any)?.weekendSurcharge);

  const weekendExtraWeeklyAmount =
    resolvedFrequency === "daily" && perVisitAmount > 0
      ? perVisitAmount * 2
      : null;
  const visitsBounds = getVisitsBounds(visitsPerMonth);
  const hasVisitRange = Boolean(visitsBounds && visitsBounds.min !== visitsBounds.max);

  const showEstimateCard = Boolean(_estimatedPrice && !isCustomQuote);
  const isOneTimeSelection = resolvedFrequency === "onetime";
  const activationDelayDays = isOneTimeSelection
    ? 0
    : resolvedFrequency === "biweekly"
      ? 14
      : 7;

  const followUpCredits = (() => {
    switch (resolvedFrequency) {
      case "daily":
        return weekendUpgradeEnabled ? 6 : 4;
      case "twice-weekly":
        return 1;
      default:
        return 0;
    }
  })();
  const heroHeadline = (() => {
    if (isOneTimeSelection) return "Pay after the visit wraps.";
    if (resolvedFrequency === "daily")
      return weekendUpgradeEnabled
        ? "First 7 days free - weekend visits included."
        : "First week free - 5 visits on us.";
    if (resolvedFrequency === "twice-weekly") return "First 2 visits completely free.";
    if (resolvedFrequency === "monthly") return "50% off your first deep clean.";
    if (resolvedFrequency === "biweekly") return "Kickoff deep clean on us.";
    return "Kickoff deep clean on us.";
  })();
  const coverageMessage = (() => {
    if (isOneTimeSelection) {
      return "We only invoice once the visit is complete.";
    }
    if (resolvedFrequency === "monthly") {
      return "Start your monthly service with 50% off the initial deep clean - automatically applied to your first invoice.";
    }
    if (followUpCredits === 4) {
      return weekendUpgradeEnabled
        ? "Your kickoff week is on us - seven straight days of coverage before billing starts."
        : "Your entire first week is free. We handle the deep clean plus four follow-up visits before billing starts.";
    }
    if (followUpCredits === 1) {
      return "Start risk-free with your kickoff deep clean and first follow-up completely covered before any charges.";
    }
    return "Your kickoff deep clean is free before billing begins.";
  })();
  const activationDelayCopy = isOneTimeSelection
    ? "Billed after service completion."
    : `Billing starts ${activationDelayDays === 14 ? "two weeks" : "one week"} after your kickoff visit. Skipped visits earn a ${formatCurrency(perVisitAmount)} credit automatically.`;

  const baseMonthlyCandidate = rawMonthlyAmount > 0 ? rawMonthlyAmount : 0;

  const computedMonthlyFromVisits = useMemo(() => {
    if (perVisitAmount > 0 && visitsPerMonth > 0) {
      return Math.round(perVisitAmount * visitsPerMonth);
    }
    if (perVisitAmount > 0 && visitsBounds) {
      const avgVisits = (visitsBounds.min + visitsBounds.max) / 2;
      return Math.round(perVisitAmount * avgVisits);
    }
    return 0;
  }, [perVisitAmount, visitsBounds, visitsPerMonth]);

  const effectiveMonthlyAmount = useMemo(() => {
    const candidates = [baseMonthlyCandidate, computedMonthlyFromVisits].filter((value) => value && value > 0);
    let bestCandidate = candidates.length ? Math.max(...candidates) : 0;

    if (weekendUpgradeEnabled && weekendSurcharge > 0) {
      bestCandidate += weekendSurcharge;
    }

    if (bestCandidate > 0) {
      return bestCandidate;
    }

    return weekendUpgradeEnabled ? weekendSurcharge : 0;
  }, [baseMonthlyCandidate, computedMonthlyFromVisits, weekendSurcharge, weekendUpgradeEnabled]);

  const monthlyEstimateDisplay = useMemo(() => {
    if (isOneTimeSelection) {
      return formatCurrencyCompact(oneTimeAmount);
    }

    const averageAmount = (() => {
      if (effectiveMonthlyAmount > 0) return effectiveMonthlyAmount;
      if (computedMonthlyFromVisits > 0) return computedMonthlyFromVisits;
      return null;
    })();

    if (averageAmount && averageAmount > 0) {
      const display = formatCurrencyCompact(averageAmount);
      return `~${display}${hasVisitRange ? "*" : ""}`;
    }

    if (computedMonthlyFromVisits > 0) {
      const display = formatCurrencyCompact(computedMonthlyFromVisits);
      return `~${display}${hasVisitRange ? "*" : ""}`;
    }

    if (effectiveMonthlyAmount > 0) {
      return `~${formatCurrencyCompact(effectiveMonthlyAmount)}`;
    }

    if (baseMonthlyCandidate > 0) {
      return `~${formatCurrencyCompact(baseMonthlyCandidate)}`;
    }

    return " - ";
  }, [
    baseMonthlyCandidate,
    computedMonthlyFromVisits,
    effectiveMonthlyAmount,
    hasVisitRange,
    isOneTimeSelection,
    oneTimeAmount,
    perVisitAmount,
    visitsBounds,
    visitsPerMonth,
  ]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-24 md:pb-28">
      <Card className={withQuotePanel("space-y-6 text-brand-ink dark:text-cream-vanilla")}>
        <CardHeader className="space-y-2 pb-4">
          <CardTitle className="flex items-center gap-2 font-serif text-base font-normal md:text-lg text-brand-ink dark:text-cream-vanilla">
            <span className="inline-flex size-9 items-center justify-center rounded-2xl bg-brand-coral/10 text-brand-coral dark:bg-brand-coral/20 dark:text-cream-vanilla">
              <Clock className="h-4 w-4" />
            </span>
            Service Frequency
          </CardTitle>
          <p className={cn("text-sm leading-relaxed", quoteSubtleTextClass)}>
            Pick the cadence that keeps every yard visit tight—weekly for most families, twice-weekly when things get lively, or a single deep reset when you just need a reboot.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {displayedFrequencyOptions.map((option) => {
              const isSelected = resolvedFrequency === option.id;
              const isOneTime = option.id === "onetime";

              return (
                <motion.button
                  key={option.id}
                  type="button"
                  whileHover={{ scale: 1.01, y: -2 }}
                  whileTap={{ scale: 0.99, y: 0 }}
                  onClick={() => handleFrequencySelect(option.id)}
                  className={cn(
                    frequencyCardBase,
                    isSelected ? frequencyCardSelected : frequencyCardIdle,
                  )}
                >
                  {isSelected ? (
                    <span className="absolute right-4 top-4 inline-flex size-7 items-center justify-center rounded-full bg-brand-coral/10 text-brand-coral dark:bg-brand-coral/20 dark:text-cream-vanilla">
                      <CheckCircle className="h-4 w-4" />
                    </span>
                  ) : null}
                  <div className="flex items-start gap-3">
                    <span className="text-2xl leading-none">{option.icon}</span>
                    <div className="flex-1 space-y-2 pr-8">
          <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-serif text-base font-normal md:text-lg">
                          {(() => {
                            if (option.id === "daily" && weekendUpgradeEnabled) {
                              return "Daily (Mon–Sun)";
                            }
                            return option.title;
                          })()}
                        </h3>
                        {option.popular ? (
                          <span className="inline-flex items-center rounded-full bg-amber-400/20 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-800 dark:bg-amber-400/25 dark:text-amber-100">
                            Most booked
                          </span>
                        ) : null}
                        {option.premium ? (
                          <span className="inline-flex items-center rounded-full bg-blue-400/20 px-2 py-0.5 text-[0.65rem] font-semibold text-blue-800 dark:bg-blue-500/25 dark:text-blue-100">
                            Premium routing
                          </span>
                        ) : null}
                        {isOneTime ? (
                          <span className="inline-flex items-center rounded-full bg-purple-400/20 px-2 py-0.5 text-[0.65rem] font-semibold text-purple-800 dark:bg-purple-500/25 dark:text-purple-100">
                            One-time reset
                          </span>
                        ) : null}
                      </div>
                      <p className={cn("text-sm leading-relaxed", quoteSubtleTextClass)}>
                        {option.id === "daily"
                          ? weekendUpgradeEnabled
                            ? "Seven-day sweeps so nothing slips through the weekend."
                            : "Mon–Fri sweeps by default with the option to add weekend coverage."
                          : option.description}
                      </p>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {!showDailyOptions ? (
            <div className="mt-1">
              <button
                type="button"
                onClick={() => {
                  setShowHighFrequency(true);
                  handleFrequencySelect("daily");
                }}
                className="text-[0.75rem] font-semibold text-[rgba(20,92,69,0.95)] underline-offset-2 hover:underline dark:text-cream-vanilla/90"
              >
                Need us more often?
              </button>
            </div>
          ) : null}

          {resolvedFrequency === "daily" ? (
            <div
              className="rounded-3xl border border-brand-coral/25 bg-brand-coral/8 p-4 text-sm text-brand-ink shadow-inner dark:border-brand-coral/35 dark:bg-brand-coral/15/85 dark:text-cream-vanilla"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium md:text-base">
                    Weekend coverage (Sat + Sun)
                  </p>
                  <p className={cn("text-xs leading-relaxed", quoteSubtleTextClass)}>
                    Add Saturday & Sunday sweeps so busy weeks never catch up with you. Includes two extra visits every week.
                  </p>
                  <p className="text-xs font-semibold text-emerald-100 md:text-brand-ink">
                    {weekendExtraWeeklyAmount
                      ? `Adds ${formatCurrency(weekendExtraWeeklyAmount)} each week for Saturday & Sunday visits.`
                      : weekendSurcharge > 0
                        ? `Weekend coverage adds ${formatCurrency(weekendSurcharge)} to your monthly plan when enabled.`
                        : "Weekend upgrade pricing calculated at checkout"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-emerald-100 md:text-brand-ink">
                    {weekendUpgradeEnabled ? "Enabled  -  Mon–Sun" : "Add weekends"}
                  </span>
                  <Switch
                    checked={weekendUpgradeEnabled}
                    onCheckedChange={(checked) => {
                      updateQuoteData({ weekendUpgrade: checked });
                      track("weekend_upgrade_toggled", {
                        enabled: checked,
                        estimate_present: Boolean(_estimatedPrice),
                      });
                    }}
                    aria-label="Toggle weekend coverage"
                    className="data-[state=unchecked]:bg-white/40 dark:data-[state=unchecked]:bg-white/20 data-[state=checked]:bg-brand-coral/90 dark:data-[state=checked]:bg-brand-coral"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {showEstimateCard ? (
            <div
              className={cn(
                quoteSurfaceClass,
                "space-y-4 border border-brand-coral/30 bg-cream-vanilla/95 px-4 py-4 text-sm text-brand-ink shadow-lg dark:border-brand-coral/35 dark:bg-[#071a12]/90 dark:text-cream-vanilla",
              )}
            >
              {isOneTimeSelection ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[rgba(var(--graphite-rgb-commas),0.6)] dark:text-cream-vanilla/80">
                      One-time visit total
                    </span>
                    <span className="text-2xl font-black text-brand-ink dark:text-cream-vanilla">
                      {formatCurrency(oneTimeAmount)}
                    </span>
                  </div>
                  <p className="text-xs text-[rgba(var(--graphite-rgb-commas),0.6)] dark:text-cream-vanilla/80">
                    We save your card securely and invoice after the cleanup wraps.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[rgba(var(--graphite-rgb-commas),0.6)] dark:text-cream-vanilla/80">
                        Per visit rate
                      </span>
                      <div className="text-3xl font-black text-brand-ink dark:text-cream-vanilla">
                        {formatCurrency(perVisitAmount)}
                      </div>
                    </div>
                    {perVisitAmount > 0 && (effectiveMonthlyAmount > 0 || visitsPerMonth > 0) ? (
                      <div className="text-right">
                        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[rgba(var(--graphite-rgb-commas),0.6)] dark:text-cream-vanilla/80">
                          Flat monthly option
                        </span>
                        <div className="text-sm font-semibold text-brand-ink dark:text-cream-vanilla">
                          {monthlyEstimateDisplay}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-xl border border-emerald-300/35 bg-emerald-50 px-4 py-3 text-xs text-brand-ink shadow-sm dark:border-emerald-500/40 dark:bg-[#0c3124]/85 dark:text-cream-vanilla">
                    <div className="text-sm font-semibold text-brand-ink dark:text-cream-vanilla">
                      {heroHeadline}
                    </div>
                    <p className="mt-1 leading-relaxed text-cream-vanilla/80 md:text-[rgba(var(--graphite-rgb-commas),0.65)]">
                      {coverageMessage}
                    </p>
                  </div>

                  <p className="text-xs text-[rgba(var(--graphite-rgb-commas),0.6)] dark:text-cream-vanilla/80">
                    {activationDelayCopy}
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};
