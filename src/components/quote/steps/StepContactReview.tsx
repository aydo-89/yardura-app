"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { StepProps } from "@/types/quote";
import type { PricingData } from "@/types/quote";
import type { AddOnConfig } from "@/lib/business-config";
import { getFrequencyDisplayName, type Frequency } from "@/lib/priceEstimator";
import { describeFirstWeekCoverage } from "@/lib/pricing-presentation";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { cn, formatPhoneNumber, formatVisitsRange } from "@/lib/utils";
import { InitialCleanLabel } from "@/components/quote/InitialCleanTooltip";
import { motion, AnimatePresence } from "@/lib/framermotion";
import {
  withQuotePanel,
  quoteSurfaceClass,
  quoteSubtleTextClass,
  quoteFieldLabelClass,
  quoteFieldMutedClass,
  quoteInputClass,
  quoteHeadingClass,
} from "../quoteStyles";

const DEFAULT_ADDON_PRICES: Record<string, number> = {
  deodorize: 500,
  "spray-deck": 1200,
  "divert-takeaway": 500,
  "divert-compost": 1000,
};

const BASIC_WELLNESS_MONTHLY = 19.99;

const parseAmount = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const formatDollars = (value: number): string => `$${value.toFixed(2)}`;

const frequencyLabels: Record<string, string> = {
  daily: "Daily service (Mon–Fri)",
  "twice-weekly": "Twice-weekly service",
  weekly: "Weekly service",
  biweekly: "Every other week",
  monthly: "Monthly service",
  onetime: "One-time visit",
};

const FIRST_YEAR_WELLNESS_VALUE = "~$240";
const FIRST_YEAR_WELLNESS_PROMO_END = "April 30, 2026";
const WELLNESS_FEATURES = [
  "Color & consistency recap after every scoop",
  "Content flags for mucus, debris, visible parasites",
  "Early stool-change nudges via SMS",
  "Monthly trend snapshots with improvement tips",
];

type SalesRepOption = {
  id: string;
  name: string | null;
  email: string | null;
  label: string;
};

export const StepContactReview: React.FC<StepProps> = ({
  quoteData,
  updateQuoteData,
  estimatedPrice,
  orgId,
  _errors,
}) => {
  const [availableAddOns, setAvailableAddOns] = useState<AddOnConfig[]>([]);
  const [salesReps, setSalesReps] = useState<SalesRepOption[]>([]);
  const [isLoadingSalesReps, setIsLoadingSalesReps] = useState(false);
  const [salesRepError, setSalesRepError] = useState<string | null>(null);
  const [showCreditBanner, setShowCreditBanner] = useState(true);
  const [showWellnessBanner, setShowWellnessBanner] = useState(true);
  const handleHideCreditBanner = () => {
    setShowCreditBanner(false);
  };
  const handleRevealCreditBanner = () => {
    setShowCreditBanner(true);
  };

  useEffect(() => {
    const consent = quoteData?.consent;
    const termsDefined = typeof consent?.terms === "boolean";
    const marketingDefined = typeof consent?.marketingOptIn === "boolean";

    if (termsDefined && marketingDefined) {
      return;
    }

    updateQuoteData({
      consent: {
        ...(quoteData?.consent || {}),
        terms: termsDefined ? Boolean(consent?.terms) : false,
        marketingOptIn: marketingDefined ? Boolean(consent?.marketingOptIn) : false,
      },
    });
  }, [quoteData?.consent, updateQuoteData]);

  const privacyConsentChecked = quoteData?.consent?.terms === true;
  const marketingOptInChecked = Boolean(quoteData?.consent?.marketingOptIn);

  const handlePrivacyConsentChange = (checked: boolean | "indeterminate") => {
    updateQuoteData({
      consent: {
        ...(quoteData?.consent || {}),
        terms: checked === true,
      },
    });
  };

  const handleMarketingOptInChange = (checked: boolean | "indeterminate") => {
    updateQuoteData({
      consent: {
        ...(quoteData?.consent || {}),
        marketingOptIn: checked === true,
      },
    });
  };

  useEffect(() => {
    const loadAddons = async () => {
      try {
        const res = await fetch("/api/business-config", { cache: "no-store" });
        if (res.ok) {
          const { config } = await res.json();
          setAvailableAddOns(
            (config?.basePricing?.addOns || []).filter(
              (addon: AddOnConfig) => addon.available,
            ),
          );
        }
      } catch (error) {
        console.warn("Unable to load add-ons", error);
      }
    };

    loadAddons();
  }, []);

  useEffect(() => {
    if (!orgId) {
      return;
    }

    let cancelled = false;
    const fetchSalesReps = async () => {
      setIsLoadingSalesReps(true);
      setSalesRepError(null);
      try {
        const response = await fetch(
          `/api/public/sales-reps?orgId=${encodeURIComponent(orgId)}`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          throw new Error("Failed to fetch representatives");
        }
        const payload = await response.json();
        if (!cancelled && payload?.ok && Array.isArray(payload.data)) {
          setSalesReps(payload.data as SalesRepOption[]);
        }
      } catch (error) {
        console.warn("Unable to load sales representatives", error);
        if (!cancelled) {
          setSalesRepError("Unable to load representatives right now.");
          setSalesReps([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSalesReps(false);
        }
      }
    };

    fetchSalesReps();

    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const rawFrequency = (quoteData.frequency || "weekly").toLowerCase();
  const frequencyKey =
    rawFrequency === "one-time" ? "onetime" : (rawFrequency as Frequency);
  const isOneTime = frequencyKey === "onetime";
  const frequencyValue = frequencyKey.toLowerCase();

  const breakdown = useMemo(() => {
    if (!estimatedPrice || typeof estimatedPrice !== "object") {
      return {} as Record<string, unknown>;
    }
    return ((estimatedPrice as any).breakdown ?? {}) as Record<string, unknown>;
  }, [estimatedPrice]);

  const { yardZoneMultiplier, frequencyMultiplier } = useMemo(() => {
    const rawYard =
      typeof breakdown?.yardMultiplier === "number" ? breakdown.yardMultiplier : 1;
    const rawZone =
      typeof breakdown?.zoneMultiplier === "number" ? breakdown.zoneMultiplier : 1;
    const rawFrequencyMultiplier =
      typeof breakdown?.frequencyMultiplier === "number"
        ? breakdown.frequencyMultiplier
        : 1;

    const yardZone =
      Math.max(0, rawYard || 0) === 0
        ? rawZone || 1
        : (rawYard || 1) * (rawZone || 1);

    return {
      yardZoneMultiplier: yardZone || 1,
      frequencyMultiplier: rawFrequencyMultiplier || 1,
    };
  }, [breakdown]);

  const perVisitAmount = parseAmount((estimatedPrice as PricingData | undefined)?.perVisit);
  const oneTimeAmount = parseAmount((estimatedPrice as PricingData | undefined)?.oneTime);
  const firstVisitAmount = parseAmount(
    (estimatedPrice as PricingData | undefined)?.firstVisitTotal,
  );
  const amountDueToday = parseAmount(
    (estimatedPrice as PricingData | undefined)?.amountDueToday,
  );

  const visitsPerMonth = useMemo(() => {
    if (isOneTime) return 0;
    const fromPricing = parseAmount(
      (estimatedPrice as PricingData | undefined)?.visitsPerMonth,
    );
    if (fromPricing > 0) return fromPricing;

    switch (frequencyKey) {
      case "daily":
        return 21.67;
      case "twice-weekly":
        return 8.67;
      case "weekly":
        return 4.33;
      case "biweekly":
        return 2.17;
      case "monthly":
        return 1;
      default:
        return 0;
    }
  }, [estimatedPrice, frequencyKey, isOneTime]);

  const initialCleanValue = useMemo(() => {
    if (isOneTime) return 0;
    return parseAmount((estimatedPrice as PricingData | undefined)?.initialClean);
  }, [estimatedPrice, isOneTime]);

  const discountedInitialCleanValue = useMemo(() => {
    if (isOneTime) return 0;
    return parseAmount(
      (estimatedPrice as PricingData | undefined)?.discountedInitialClean,
    );
  }, [estimatedPrice, isOneTime]);

  const firstVisitAddOnValue = useMemo<number>(() => {
    const record = (estimatedPrice as PricingData | undefined)?.firstVisitAddOns;
    if (!record || typeof record !== "object") return 0;
    return Object.values(record).reduce((sum: number, val) => sum + parseAmount(val), 0);
  }, [estimatedPrice]);

  const resolvedOneTimeAmount = isOneTime
    ? oneTimeAmount > 0
      ? oneTimeAmount
      : amountDueToday > 0
        ? amountDueToday
        : firstVisitAmount > 0
          ? firstVisitAmount
          : 0
    : 0;

  const initialCleanAddOnDisplay =
    !isOneTime && firstVisitAddOnValue > 0
      ? formatDollars(firstVisitAddOnValue)
      : null;

  const initialCleanCreditValue = useMemo(() => {
    if (initialCleanValue <= 0) {
      return 0;
    }
    const discounted = Math.max(discountedInitialCleanValue, 0);
    return Math.max(initialCleanValue - discounted, 0);
  }, [discountedInitialCleanValue, initialCleanValue]);

  const followUpCreditValue = useMemo(() => {
    if (isOneTime || perVisitAmount <= 0) {
      return 0;
    }
    if (frequencyKey === "daily") {
      return perVisitAmount * 4;
    }
    if (frequencyKey === "twice-weekly") {
      return perVisitAmount;
    }
    return 0;
  }, [frequencyKey, isOneTime, perVisitAmount]);

  const totalCreditValue = useMemo(
    () => initialCleanCreditValue + followUpCreditValue,
    [followUpCreditValue, initialCleanCreditValue],
  );

  const creditCalloutDisplay = totalCreditValue > 0.009 ? formatDollars(totalCreditValue) : null;
  const creditCalloutDescriptor = creditCalloutDisplay
    ? describeFirstWeekCoverage(frequencyKey, followUpCreditValue)
    : null;

  const getError = (field: string) => _errors?.[field]?.[0];
  const hasError = (field: string) => Boolean(getError(field));
  const fieldDomId = (field: string) =>
    `quote-contact-review-${field.replace(/[^a-z0-9]+/gi, "-")}`;
  const fieldErrorId = (field: string) => `${fieldDomId(field)}-error`;

  const addressError = getError("address");
  const contactNameError = getError("contact.name");
  const contactEmailError = getError("contact.email");
  const contactPhoneError = getError("contact.phone");
  const contactMethodsError = getError("preferredContactMethods");
  const consentTermsError = getError("consent.terms");

  const phoneDigits = (quoteData?.contact?.phone || "").replace(/\D/g, "");
  const hasPhoneNumber = phoneDigits.length > 0;
  const preferredMethodCount = quoteData?.preferredContactMethods?.length ?? 0;

  useEffect(() => {
    if (!hasPhoneNumber && preferredMethodCount > 0) {
      updateQuoteData({ preferredContactMethods: [] });
    }
  }, [hasPhoneNumber, preferredMethodCount, updateQuoteData]);

  const dueTodayDisplay = isOneTime
    ? formatDollars(resolvedOneTimeAmount)
    : formatDollars(amountDueToday);

  const visitsRange = useMemo(() => formatVisitsRange(visitsPerMonth), [visitsPerMonth]);

  const cadenceLabel = useMemo(() => {
    if (isOneTime) return null;
    const friendly =
      getFrequencyDisplayName(frequencyKey, {
        weekendUpgrade: Boolean(quoteData?.weekendUpgrade),
      }) ||
      frequencyLabels[frequencyKey] ||
      "Recurring service";
    if (visitsRange) {
      return `${friendly} (${visitsRange})`;
    }
    return friendly;
  }, [frequencyKey, isOneTime, visitsRange, quoteData?.weekendUpgrade]);

  const perVisitDisplay = useMemo(() => {
    if (perVisitAmount <= 0) return " - ";
    return formatDollars(perVisitAmount);
  }, [perVisitAmount]);
  const oneTimeDisplay = resolvedOneTimeAmount > 0 ? formatDollars(resolvedOneTimeAmount) : " - ";

  const initialCleanHeadline = useMemo(() => {
    if (isOneTime) return null;
    if (initialCleanValue > 0) {
      return formatDollars(initialCleanValue);
    }
    return perVisitDisplay;
  }, [initialCleanValue, isOneTime, perVisitDisplay]);

  const areaSummary = useMemo(() => {
    const areas: string[] = [];
    if (quoteData?.areasToClean?.frontYard) areas.push("Front yard");
    if (quoteData?.areasToClean?.backYard) areas.push("Back yard");
    if (quoteData?.areasToClean?.sideYard) areas.push("Side yard");
    if (quoteData?.areasToClean?.dogRun) areas.push("Dog run");
    if (quoteData?.areasToClean?.fencedArea) areas.push("Additional fenced area");
    if (quoteData?.areasToClean?.other)
      areas.push(String(quoteData.areasToClean.other));
    return areas.length ? areas.join(", ") : "Standard areas";
  }, [quoteData?.areasToClean]);

  const getAddon = (id: string) => availableAddOns.find((addon) => addon.id === id);

  const getAddonBaseCents = (id: string): number | null => {
    const addon = getAddon(id);
    if (addon && typeof addon.priceCents === "number") {
      return addon.priceCents;
    }
    return DEFAULT_ADDON_PRICES[id] ?? null;
  };

  const renderAddonLines = () => {
    const lines: Array<{ label: string; price: string }> = [];
    const addLine = (label: string, price: string | null | undefined) => {
      if (!price) return;
      lines.push({ label, price });
    };

    const formatCents = (cents: number, suffix: string) => {
      const amount = cents / 100;
      return `+$${amount.toFixed(2)} ${suffix}`;
    };

    const computeDeodorizePrice = (mode: string) => {
      const base = getAddonBaseCents("deodorize");
      if (!base) return null;

      const firstVisitCents = Math.round(base * yardZoneMultiplier);
      const recurringCents = Math.round(base * yardZoneMultiplier * frequencyMultiplier);
      const isOneTimeFrequency = frequencyValue === "onetime";

      if (isOneTimeFrequency) {
        return formatCents(firstVisitCents, "one-time");
      }

      if (mode === "first-visit" || mode === "one-time" || mode === "onetime") {
        return formatCents(recurringCents, "one-time");
      }

      if (mode === "every-other") {
        return formatCents(Math.round(recurringCents / 2), "/ visit");
      }

      return formatCents(recurringCents, "/ visit");
    };

    const computeSprayDeckPrice = (mode: string) => {
      const base = getAddonBaseCents("spray-deck");
      if (!base) return null;

      const firstVisitCents = Math.round(base * yardZoneMultiplier);
      const recurringCents = Math.round(base * yardZoneMultiplier * frequencyMultiplier);
      const isOneTimeFrequency = frequencyValue === "onetime";

      if (isOneTimeFrequency) {
        return formatCents(firstVisitCents, "one-time");
      }

      if (mode === "first-visit" || mode === "one-time" || mode === "onetime") {
        return formatCents(recurringCents, "one-time");
      }

      if (mode === "every-other") {
        return formatCents(Math.round(recurringCents / 2), "/ visit");
      }

      return formatCents(recurringCents, "/ visit");
    };

    const computeDiversionPrice = (divertMode: string) => {
      const addonId =
        divertMode === "takeaway" ? "divert-takeaway" : "divert-compost";

      const base = getAddonBaseCents(addonId);
      if (!base) return null;

      const recurringCents = Math.round(base * yardZoneMultiplier * frequencyMultiplier);
      const firstVisitCents = Math.round(base * yardZoneMultiplier);
      const isOneTimeFrequency = frequencyValue === "onetime";

      if (isOneTimeFrequency) {
        return formatCents(firstVisitCents, "one-time");
      }

      return formatCents(recurringCents, "/ visit");
    };

    if (quoteData?.addOns?.deodorize) {
        const mode = quoteData.addOns.deodorizeMode || "each-visit";
      const label = computeDeodorizePrice(mode);
      if (label) {
        const modeLabel =
          mode === "each-visit"
            ? "Deodorize & Sanitize (each visit)"
            : mode === "every-other"
              ? "Deodorize & Sanitize (every other visit)"
              : "Deodorize & Sanitize (first visit only)";
        addLine(modeLabel, label);
      }
    }

    if (quoteData?.addOns?.sprayDeck) {
      const mode = quoteData.addOns.sprayDeckMode || "each-visit";
      const label = computeSprayDeckPrice(mode);
      if (label) {
        const modeLabel =
          mode === "each-visit"
            ? "Spray deck/patio (each visit)"
            : mode === "every-other"
              ? "Spray deck/patio (every other visit)"
              : "Spray deck/patio (first visit only)";
        addLine(modeLabel, label);
      }
    }

    if (
      quoteData?.addOns?.divertMode &&
      quoteData.addOns.divertMode !== "none"
    ) {
      const priceLabel = computeDiversionPrice(quoteData.addOns.divertMode);
      if (priceLabel) {
        const diversionLabel =
          quoteData.addOns.divertMode === "takeaway"
            ? "Take away waste"
            : "Divert waste (compost routing)";
        addLine(diversionLabel, priceLabel);
      }
    }

    return lines.length ? (
      <div className="space-y-1">
        {lines.map((line, index) => (
          <div
            key={`${line.label}-${index}`}
            className="flex items-center justify-between text-xs text-brand-ink dark:text-cream-vanilla"
          >
            <span>{line.label}</span>
            <span className="font-semibold">{line.price}</span>
          </div>
        ))}
      </div>
    ) : (
      <div className="text-xs text-[rgba(var(--graphite-rgb-commas),0.65)] dark:text-cream-vanilla/85">
        No add-ons selected
      </div>
    );
  };

  const cadenceSummary = cadenceLabel || visitsRange;

const formatPropertyTypeLabel = (value: string) =>
  value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");

const serviceDetails = useMemo(() => {
  const rows: Array<{ label: string; value: string }> = [];

    if (typeof quoteData?.dogs === "number") {
      rows.push({
        label: "Dogs",
        value: `${quoteData.dogs} dog${quoteData.dogs === 1 ? "" : "s"}`,
      });
    }

    if (quoteData?.yardSize) {
      rows.push({
        label: "Property type",
        value:
          quoteData.yardSize === "xl"
            ? "Estate / XL"
            : formatPropertyTypeLabel(quoteData.yardSize),
      });
    }

    if (cadenceSummary) {
      rows.push({ label: "Cadence", value: cadenceSummary });
    }

    if (areaSummary) {
      rows.push({ label: "Areas to clean", value: areaSummary });
    }

    rows.push({
      label: "Proof of service",
      value: "Pickup photo, gate confirmation, sanitation proof (always on us)",
    });

    if (quoteData?.serviceType === "commercial" && quoteData?.businessType) {
      rows.push({ label: "Business type", value: quoteData.businessType });
    }

    return rows;
  }, [quoteData?.dogs, quoteData?.yardSize, quoteData?.serviceType, quoteData?.businessType, cadenceSummary, areaSummary]);

  useEffect(() => {
    if (quoteData?.howDidYouHear !== "sales-rep" && (quoteData?.salesRepId || quoteData?.salesRepName)) {
      updateQuoteData({ salesRepId: undefined, salesRepName: undefined });
    }
  }, [quoteData?.howDidYouHear, quoteData?.salesRepId, quoteData?.salesRepName, updateQuoteData]);

  const handleHowDidYouHearChange = (value: string) => {
    updateQuoteData({
      howDidYouHear: value,
      ...(value === "sales-rep"
        ? {}
        : { salesRepId: undefined, salesRepName: undefined }),
    });
  };

  const handleSalesRepSelect = (value: string) => {
    if (!value) {
      updateQuoteData({ salesRepId: undefined, salesRepName: undefined });
      return;
    }
    const rep = salesReps.find((item) => item.id === value);
    updateQuoteData({
      salesRepId: value,
      salesRepName: rep?.name || rep?.email || undefined,
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-24 md:pb-28">
      <Card className={withQuotePanel("space-y-6 text-brand-ink dark:text-cream-vanilla")}>
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2 font-serif text-lg font-normal md:text-xl text-brand-ink dark:text-cream-vanilla">
            <span className="inline-flex size-9 items-center justify-center rounded-2xl bg-brand-coral/15 text-brand-coral dark:bg-brand-coral/20 dark:text-cream-vanilla">
              <CheckCircle className="h-4 w-4" />
            </span>
            Contact & Confirm
          </CardTitle>
          <p className={cn("text-sm leading-relaxed", quoteSubtleTextClass)}>
            Double-check your contact info, choose how we notify you, and lock in your promo.
          </p>
        </CardHeader>
        <CardContent>
          {showWellnessBanner ? (
            <div
              className={cn(
                quoteSurfaceClass,
                "relative mb-6 space-y-3 overflow-hidden rounded-3xl border-2 border-brand-gold/50 bg-gradient-to-br from-brand-gold/15 via-brand-coral/8 to-brand-mint/10 p-5 text-brand-ink shadow-[0_12px_32px_rgba(255,194,77,0.15)] dark:border-brand-gold/40 dark:from-brand-gold/20 dark:via-brand-coral/12 dark:to-brand-mint/8 dark:text-cream-vanilla dark:shadow-[0_12px_32px_rgba(255,194,77,0.08)]",
              )}
            >
              {/* Highlight accent stripe */}
              <div className="absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b from-brand-gold via-brand-coral to-brand-mint" />
              <div className="flex items-start gap-3 pl-2">
                <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-brand-gold/20 text-brand-gold shadow-sm dark:bg-brand-gold/25 dark:text-brand-gold">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-base font-semibold text-brand-ink md:text-lg dark:text-cream-vanilla">
                      Basic Wellness Insights
                    </span>
                    <span className="rounded-full bg-brand-gold/20 px-2.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-widest text-brand-gold dark:bg-brand-gold/30">
                      Free 1st Year
                    </span>
                  </div>
                  <p className={cn("text-sm leading-relaxed", quoteSubtleTextClass)}>
                    Lock your first year ({FIRST_YEAR_WELLNESS_VALUE} value) for $0 when you activate before {FIRST_YEAR_WELLNESS_PROMO_END}.
                  </p>
                  <p className={cn("text-xs", quoteSubtleTextClass)}>
                    Renews at {formatDollars(BASIC_WELLNESS_MONTHLY)}/month after the promo — opt out anytime from your dashboard.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWellnessBanner(false)}
                  className="rounded-full bg-white/60 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-brand-ink/70 transition hover:bg-white/80 hover:text-brand-ink dark:bg-white/10 dark:text-cream-vanilla/70 dark:hover:bg-white/20 dark:hover:text-cream-vanilla"
                  aria-label="Dismiss wellness insights reminder"
                >
                  Got it
                </button>
              </div>
              <ul className="grid gap-2 text-xs text-brand-ink dark:text-cream-vanilla sm:grid-cols-2">
                {WELLNESS_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-coral dark:bg-emerald-400" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-5">
            {/* Service Details */}
            <section
              className={cn(
                quoteSurfaceClass,
                "space-y-4 border border-brand-coral/25 p-6 text-brand-ink dark:border-brand-coral/35 dark:text-cream-vanilla",
              )}
            >
              <div className="font-serif text-lg font-normal md:text-xl">Service details</div>
              <div className="grid gap-3">
                {serviceDetails.map((row, index) => (
                  <div
                    key={`${row.label}-${index}`}
                    className="rounded-xl border border-brand-coral/25 bg-brand-coral/8 px-4 py-3 text-brand-ink dark:border-brand-coral/35 dark:bg-brand-coral/20/80 dark:text-cream-vanilla"
                  >
                    <div className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-brand-coral dark:text-cream-vanilla">
                      {row.label}
                    </div>
                    <div className="mt-1 font-serif text-sm font-normal whitespace-pre-line md:text-base">
                      {row.value}
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-2 border-t border-brand-coral/25 pt-4 md:border-[#d7e7de] dark:border-brand-coral/35">
                <div className="text-sm font-medium">Add-ons</div>
                {renderAddonLines()}
              </div>
              <div className="border-t border-brand-coral/25 pt-4 md:border-[#d7e7de] dark:border-brand-coral/35">
                <div className="text-sm font-medium mb-1">Service address on file</div>
                <div className={quoteSubtleTextClass}>{quoteData?.address || "Not provided"}</div>
              </div>
            </section>

              <div className="relative hidden h-56 w-full overflow-hidden rounded-3xl border border-brand-coral/15 bg-cream-vanilla/80 shadow-md dark:border-brand-coral/35 dark:bg-evergreen-800 dark:shadow-[0_18px_36px_rgba(0,0,0,0.45)] sm:block">
                <Image
                  src="/dog_images2/pexels-steshkacroes-1407718.jpg"
                  alt="Dog greeting their scooper at the gate"
                  fill
                  className="object-cover"
                  sizes="(min-width: 1024px) 260px"
                />
                <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-white/90 px-4 py-3 text-xs font-semibold text-brand-ink shadow dark:bg-[#04130d]/85 dark:text-cream-vanilla">
                  “They text us when the gate’s secured - zero guessing and a spotless yard.”
                </div>
              </div>
            </div>

            <div className="space-y-6 lg:col-span-7">
              <section
                className={cn(
                  quoteSurfaceClass,
                  "rounded-xl border border-brand-coral/25 p-6 transition-shadow text-brand-ink dark:border-brand-coral/35 dark:text-cream-vanilla",
                  addressError ||
                    contactNameError ||
                    contactEmailError ||
                    contactPhoneError ||
                    consentTermsError
                    ? "border-brand-coral shadow-[0_0_0_1px_rgba(243,100,91,0.18)]"
                    : "",
                )}
                data-quote-field="contact"
              >
                <div data-quote-field="address">
                  <label className={cn("mb-2 block text-sm font-medium", quoteFieldLabelClass)}>
                    Service address <span className="text-red-500">*</span>
                  </label>
                  <AddressAutocomplete
                    value={quoteData?.address || ""}
                    onSelect={(data) => {
                      updateQuoteData({
                        address: data.formattedAddress,
                        addressValidated: true,
                        addressMeta: {
                          city: data.city,
                          state: data.state,
                          postalCode: data.postalCode,
                          latitude: data.latitude,
                          longitude: data.longitude,
                        },
                      });
                    }}
                    onChange={(value) =>
                      updateQuoteData({ address: value, addressValidated: false })
                    }
                    placeholder="Start typing your address"
                    className="mt-2"
                  />
                  {!quoteData?.addressValidated && quoteData?.address && (
                    <div className="mt-1 text-xs text-amber-600">
                      Address not yet validated
                    </div>
                  )}
                  {addressError && (
                    <p
                      className="mt-3 text-xs text-brand-coral"
                      id={fieldErrorId("address")}
                      data-error-for="address"
                    >
                      {addressError}
                    </p>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-4 mt-6">
                  <div data-quote-field="contact.name">
                    <label
                      className={cn("mb-2 block text-sm font-medium", quoteFieldLabelClass)}
                      htmlFor={fieldDomId("contact.name")}
                    >
                      Full name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id={fieldDomId("contact.name")}
                      type="text"
                      className={cn(
                        quoteInputClass,
                        contactNameError &&
                          "border-brand-coral focus:border-brand-coral focus:ring-brand-coral/30 ring-2 ring-brand-coral/20",
                      )}
                      placeholder="Enter your full name"
                      value={quoteData?.contact?.name || ""}
                      onChange={(event) =>
                        updateQuoteData({
                          contact: {
                            ...quoteData?.contact,
                            name: event.target.value,
                          },
                        })
                      }
                      aria-invalid={contactNameError ? "true" : undefined}
                      aria-describedby={
                        contactNameError ? fieldErrorId("contact.name") : undefined
                      }
                      autoComplete="name"
                    />
                    {contactNameError && (
                      <p
                        className="mt-1 text-xs text-brand-coral"
                        id={fieldErrorId("contact.name")}
                        data-error-for="contact.name"
                      >
                        {contactNameError}
                      </p>
                    )}
                  </div>
                  <div data-quote-field="contact.email">
                    <label
                      className={cn("mb-2 block text-sm font-medium", quoteFieldLabelClass)}
                      htmlFor={fieldDomId("contact.email")}
                    >
                      Email address <span className="text-red-500">*</span>
                    </label>
                    <input
                      id={fieldDomId("contact.email")}
                      type="email"
                      className={cn(
                        quoteInputClass,
                        contactEmailError &&
                          "border-brand-coral focus:border-brand-coral focus:ring-brand-coral/30 ring-2 ring-brand-coral/20",
                      )}
                      placeholder="your.email@example.com"
                      value={quoteData?.contact?.email || ""}
                      onChange={(event) =>
                        updateQuoteData({
                          contact: {
                            ...quoteData?.contact,
                            email: event.target.value,
                          },
                        })
                      }
                      aria-invalid={contactEmailError ? "true" : undefined}
                      aria-describedby={
                        contactEmailError ? fieldErrorId("contact.email") : undefined
                      }
                      autoComplete="email"
                    />
                    {contactEmailError && (
                      <p
                        className="mt-1 text-xs text-brand-coral"
                        id={fieldErrorId("contact.email")}
                        data-error-for="contact.email"
                      >
                        {contactEmailError}
                      </p>
                    )}
                  </div>
                  <div className="md:col-span-2" data-quote-field="contact.phone">
                    <label
                      className={cn("mb-2 block text-sm font-medium", quoteFieldLabelClass)}
                      htmlFor={fieldDomId("contact.phone")}
                    >
                      Phone number <span className={cn("text-xs font-normal", quoteFieldMutedClass)}>(optional)</span>
                    </label>
                    <input
                      id={fieldDomId("contact.phone")}
                      type="tel"
                      className={cn(
                        quoteInputClass,
                        contactPhoneError &&
                          "border-brand-coral focus:border-brand-coral focus:ring-brand-coral/30 ring-2 ring-brand-coral/20",
                      )}
                      placeholder="(555) 123-4567"
                      value={formatPhoneNumber(quoteData?.contact?.phone || "")}
                      onChange={(event) => {
                        const formatted = formatPhoneNumber(event.target.value);
                        updateQuoteData({
                          contact: {
                            ...quoteData?.contact,
                            phone: formatted,
                          },
                        });
                      }}
                      aria-invalid={contactPhoneError ? "true" : undefined}
                      aria-describedby={
                        contactPhoneError ? fieldErrorId("contact.phone") : undefined
                      }
                      autoComplete="tel"
                      inputMode="tel"
                    />
                    {contactPhoneError && (
                      <p
                        className="mt-1 text-xs text-brand-coral"
                        id={fieldErrorId("contact.phone")}
                        data-error-for="contact.phone"
                      >
                        {contactPhoneError}
                      </p>
                    )}
                  </div>
                </div>

                {hasPhoneNumber && (
                  <div className="space-y-4 pt-4 pb-2">
                    <label className={cn("mb-2 block text-base font-medium", quoteFieldLabelClass)}>
                      Preferred contact methods
                    </label>
                    <p className={cn("text-sm", quoteFieldMutedClass)}>
                      Tell us how you'd like us to reach you when we have real-time updates.
                    </p>
                    <div
                      data-quote-field="preferredContactMethods"
                      className={cn(
                        "grid grid-cols-1 gap-3 sm:grid-cols-3",
                        contactMethodsError &&
                          "rounded-2xl border-2 border-brand-coral/80 bg-brand-chip/15 p-3 ring-4 ring-brand-coral/12",
                      )}
                    >
                      {[
                        { id: "text", label: "Text", icon: "📱" },
                        { id: "mobile", label: "Phone", icon: "📞" },
                        { id: "email", label: "Email", icon: "✉️" },
                      ].map((method) => {
                        const isSelected =
                          quoteData?.preferredContactMethods?.includes(method.id) ?? false;
                        return (
                          <label
                            key={method.id}
                            className={cn(
                              "relative cursor-pointer rounded-2xl border-2 p-4 transition-all duration-200 focus-within:outline-none focus-within:ring-2 focus-within:ring-brand-coral/40 md:rounded-xl",
                              isSelected
                                ? "border-emerald-300/70 bg-emerald-50 text-brand-coral shadow-[0_12px_28px_rgba(17,143,115,0.2)] dark:border-brand-coral/50 dark:bg-brand-coral/15 dark:text-cream-vanilla"
                                : "border-brand-coral/20 bg-cream-vanilla/60 text-brand-ink hover:border-emerald-300/50 hover:bg-cream-vanilla/80 dark:border-brand-coral/35 dark:bg-evergreen-800 dark:text-cream-vanilla",
                            )}
                          >
                            <input
                              type="checkbox"
                              className="sr-only"
                              name="preferredContactMethods"
                              value={method.id}
                              checked={isSelected}
                              onChange={(event) => {
                                const current = quoteData?.preferredContactMethods || [];
                                const updated = event.target.checked
                                  ? [...current, method.id]
                                  : current.filter((id) => id !== method.id);
                                updateQuoteData({ preferredContactMethods: updated });
                              }}
                              aria-describedby={
                                contactMethodsError
                                  ? fieldErrorId("preferredContactMethods")
                                  : undefined
                              }
                              aria-invalid={contactMethodsError ? true : undefined}
                            />
                            {isSelected ? (
                              <CheckCircle2
                                className="absolute right-3 top-3 size-4 text-brand-coral dark:text-cream-vanilla"
                                aria-hidden="true"
                              />
                            ) : null}
                            <div className="text-center">
                              <div className="text-2xl mb-2">{method.icon}</div>
                              <div className="font-medium text-brand-ink dark:text-cream-vanilla">{method.label}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                    {contactMethodsError && (
                      <p
                        className="mt-2 text-xs text-brand-coral"
                        data-error-for="preferredContactMethods"
                        id={fieldErrorId("preferredContactMethods")}
                      >
                        {contactMethodsError}
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-6 space-y-4" data-quote-field="consent">
                  <div
                    className={cn(
                      "space-y-3 rounded-2xl border border-brand-coral/25 bg-brand-coral/8 p-4 text-brand-ink dark:border-brand-coral/35 dark:bg-brand-coral/20/80 dark:text-cream-vanilla",
                      consentTermsError && "border-brand-coral/60 bg-brand-chip/15 dark:bg-brand-chip/20",
                    )}
                  >
                    <label className={cn("flex items-start gap-2 text-xs", quoteFieldMutedClass)}>
                      <Checkbox
                        id="marketing-consent"
                        checked={marketingOptInChecked}
                        onCheckedChange={handleMarketingOptInChange}
                        className="mt-0.5 h-5 w-5 flex-shrink-0"
                      />
                      <span>
                        By providing my mobile number I agree to receive marketing/promotional SMS from InsightScoop about offers, tips and promotions. Message and data rates may apply. Message frequency varies. Reply STOP to opt out anytime or HELP for assistance. I have read the{" "}
                        <Link
                          href="/privacy"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-brand-coral underline-offset-2 hover:underline dark:text-cream-vanilla"
                        >
                          Privacy Policy
                        </Link>
                        {" "}and{" "}
                        <Link
                          href="/legal/terms"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-brand-coral underline-offset-2 hover:underline dark:text-cream-vanilla"
                        >
                          Terms
                        </Link>
                      </span>
                    </label>

                    <label className={cn("flex items-start gap-2 text-xs", quoteFieldMutedClass)}>
                      <Checkbox
                        id="privacy-consent"
                        checked={privacyConsentChecked}
                        onCheckedChange={handlePrivacyConsentChange}
                        className="mt-0.5 h-5 w-5 flex-shrink-0"
                        aria-invalid={consentTermsError ? true : undefined}
                      />
                      <span>
                        By providing my mobile number I agree to receive informational/transactional SMS from InsightScoop about my service appointments and account usage. Message and data rates may apply. Message frequency varies. Reply STOP to opt out anytime or HELP for assistance. I have read the{" "}
                        <Link
                          href="/privacy"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-brand-coral underline-offset-2 hover:underline dark:text-cream-vanilla"
                        >
                          Privacy Policy
                        </Link>
                        {" "}and{" "}
                        <Link
                          href="/legal/terms"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-brand-coral underline-offset-2 hover:underline dark:text-cream-vanilla"
                        >
                          Terms
                        </Link>
                      </span>
                    </label>
                  </div>
                  {consentTermsError && (
                    <p
                      className="text-xs text-brand-coral"
                      data-error-for="consent.terms"
                      id={fieldErrorId("consent.terms")}
                    >
                      {consentTermsError}
                    </p>
                  )}
                </div>

                <div>
                  <label className={cn("mb-2 block text-base font-medium", quoteFieldLabelClass)}>
                    How did you hear about us?
                  </label>
                  <p className={cn("mt-1 mb-3 text-sm", quoteFieldMutedClass)}>
                    Help us understand where you discovered Yardura.
                  </p>
                  <select
                    className={cn(quoteInputClass, "appearance-none")}
                    value={quoteData?.howDidYouHear || ""}
                    onChange={(event) => handleHowDidYouHearChange(event.target.value)}
                  >
                    <option value="">Select how you found us</option>
                    <option value="social-media">Social media</option>
                    <option value="referral-business">Referral – business</option>
                    <option value="referral-family">Referral – family/friend</option>
                    <option value="yard-sign">Yard sign</option>
                    <option value="search-engine">Search engine</option>
                    <option value="truck">Service vehicle</option>
                    <option value="direct-mail">Direct mail</option>
                    <option value="sales-rep">Sales representative</option>
                    <option value="other">Other</option>
                  </select>
                  {quoteData?.howDidYouHear === "sales-rep" ? (
                    <div className="mt-3 space-y-2 pb-6">
                      <label className={cn("block text-sm font-medium", quoteFieldLabelClass)}>
                        Choose your sales representative
                      </label>
                      {isLoadingSalesReps ? (
                        <div className={cn("flex items-center gap-2 text-xs", quoteFieldMutedClass)}>
                          <Loader2 className="size-4 animate-spin" />
                          Loading representatives…
                        </div>
                      ) : salesRepError ? (
                        <p className="text-xs font-medium text-brand-coral">{salesRepError}</p>
                      ) : (
                        <select
                          className={cn(quoteInputClass, "appearance-none")}
                          value={quoteData?.salesRepId || ""}
                          onChange={(event) => handleSalesRepSelect(event.target.value)}
                        >
                          <option value="">Select a representative</option>
                          {salesReps.map((rep) => (
                            <option key={rep.id} value={rep.id}>
                              {rep.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  ) : null}
                </div>
              </section>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
