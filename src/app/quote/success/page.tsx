"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  CheckCircle2,
  Clock,
  CreditCard,
  Dog,
  HeartPulse,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InitialCleanLabel } from "@/components/quote/InitialCleanTooltip";
import {
  quoteSuccessShellClass,
  quoteSuccessPanelClass,
  quoteSuccessAccentCardClass,
  quoteSurfaceClass,
  quoteMutedBadgeClass,
} from "@/components/quote/quoteStyles";
import { brandColors, withAlpha } from "@/shared/brand";
import { cn, formatVisitsRange, getVisitsBounds } from "@/lib/utils";
import { computeIntroCredits, summarizeIntroCredits } from "@/lib/billing/introCredits";
import { FirstWeekCreditBanner } from "@/components/quote/components/FirstWeekCreditBanner";
import type { PricingData } from "@/types/quote";
import {
  derivePostTrialPresentation,
  deriveTrialWeekPresentation,
  describeFirstWeekCoverage,
} from "@/lib/pricing-presentation";
import { extractWeekendUpgrade } from "@/lib/pricing/weekend";

type QuotePricing = {
  perVisit?: number | null;
  monthly?: number | null;
  amountDueToday?: number | null;
  firstVisitTotalCents?: number | null;
  oneTime?: number | null;
  initialCleanDiscount?: number | null;
  initialCleanCents?: number | null;
  firstMonthCents?: number | null;
  firstMonthVisits?: number | null;
  visitsPerMonth?: number | null;
  recurringAddOnsTotal?: number | null;
  firstVisitAddOnsTotal?: number | null;
  fullMonthlyAmount?: number | null;
  metadata?: {
    billingPreference?: string | null;
    [key: string]: unknown;
  } | null;
};

type QuoteLead = {
  id: string;
  orgId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  serviceType: string | null;
  dogs: number | null;
  yardSize: string | null;
  frequency: string | null;
  address: string | null;
  city: string | null;
  state?: string | null;
  zipCode: string | null;
  addOns?: {
    deodorize?: boolean;
    deodorizeMode?: string | null;
    sprayDeck?: boolean;
    sprayDeckMode?: string | null;
    divertMode?: string | null;
  };
  areasToClean?: unknown;
  submittedAt?: string | null;
  pricing?: QuotePricing | null;
  estimatedPrice?: number | null;
};

type FrequencyMeta = {
  label: string;
  cadence: string;
  tone: string;
  highlight?: string;
};

function buildFrequencyMeta(key: string, weekendUpgrade: boolean): FrequencyMeta | null {
  switch (key) {
    case "weekly":
      return {
        label: "Weekly Service",
        cadence: "Typically 4 or 5 visits/mo",
        tone: brandColors.coral,
        highlight: "Most popular",
      };
    case "twice-weekly":
      return {
        label: "Twice Weekly Service",
        cadence: "Typically 8 or 9 visits/mo",
        tone: brandColors.gold,
        highlight: "High-activity yards",
      };
    case "daily":
      return weekendUpgrade
        ? {
            label: "Daily Service (Mon–Sun)",
            cadence: "Typically 30 or 31 visits/mo",
            tone: brandColors.sunset,
            highlight: "Maximum coverage",
          }
        : {
            label: "Daily Weekday Service",
            cadence: "Typically 21 or 22 visits/mo",
            tone: brandColors.sunset,
            highlight: "Maximum coverage",
          };
    case "biweekly":
    case "bi-weekly":
    case "every-other-week":
      return {
        label: "Every Other Week",
        cadence: "Typically 2 visits/mo",
        tone: brandColors.evergreen,
        highlight: "Balanced maintenance",
      };
    case "monthly":
      return {
        label: "Monthly Clean",
        cadence: "1 visit per month",
        tone: brandColors.coralInk,
        highlight: "Budget friendly",
      };
    case "onetime":
    case "one-time":
      return {
        label: "One-Time Clean",
        cadence: "Single intensive visit",
        tone: brandColors.cocoa,
        highlight: "Deep refresh",
      };
    default:
      return null;
  }
}

const YARD_SIZE_LABELS: Record<string, string> = {
  small: "Small yard (≤ 2,500 sq ft)",
  medium: "Medium yard (2,500 – 5,000 sq ft)",
  large: "Large yard (5,000 – 10,000 sq ft)",
  xl: "Estate yard (10,000+ sq ft)",
};

const DIVERT_COPY: Record<string, string> = {
  takeaway: "Haul away every bag",
  compost: "Compost routing when capacity allows",
  "100": "Compost routing when capacity allows",
};

const formatCurrency = (value?: number | null) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
};

const formatCurrencyCompact = (value?: number | null) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  const hasCents = Math.abs(value % 100) > 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(value / 100);
};

const formatCurrencyRangeCompact = (minCents: number, maxCents: number) => {
  if (minCents === maxCents) {
    return formatCurrencyCompact(minCents);
  }
  return `${formatCurrencyCompact(minCents)}–${formatCurrencyCompact(maxCents)}`;
};

const computeEstimatedFirstMonthDisplay = (options: {
  perVisitAmountCents: number;
  visitCountBounds: { min: number; max: number } | null;
  visitsPerMonthValue: number | null;
  freeFollowUpVisits: number;
  discountedInitialCleanCents: number;
  initialCleanCreditCents: number;
  firstVisitAddOnsCents: number;
  initialVisitCreditCount: number;
  totalFreeVisitCredits: number;
}) => {
  const {
    perVisitAmountCents,
    visitCountBounds,
    visitsPerMonthValue,
    freeFollowUpVisits,
    discountedInitialCleanCents,
    initialCleanCreditCents,
    firstVisitAddOnsCents,
    initialVisitCreditCount,
    totalFreeVisitCredits,
  } = options;

  if (perVisitAmountCents <= 0) {
    return { amountCents: null, hint: undefined as string | undefined };
  }

  const netInitialCleanCents = Math.max(
    discountedInitialCleanCents - (initialCleanCreditCents ?? 0),
    0,
  );

  const buildRange = (minVisits: number, maxVisits: number) => {
    const billedMinVisits = Math.max(minVisits - totalFreeVisitCredits, 0);
    const billedMaxVisits = Math.max(maxVisits - totalFreeVisitCredits, 0);
    const visitMinCents = billedMinVisits * perVisitAmountCents;
    const visitMaxCents = billedMaxVisits * perVisitAmountCents;
    const minTotal = visitMinCents + netInitialCleanCents + firstVisitAddOnsCents;
    const maxTotal = visitMaxCents + netInitialCleanCents + firstVisitAddOnsCents;
    return { min: Math.max(minTotal, 0), max: Math.max(maxTotal, 0) };
  };

  let range: { min: number; max: number } | null = null;

  if (visitCountBounds) {
    range = buildRange(visitCountBounds.min, visitCountBounds.max);
  } else if (typeof visitsPerMonthValue === "number") {
    const visits = Math.max(visitsPerMonthValue, 0);
    range = buildRange(Math.floor(visits), Math.ceil(visits));
  }

  if (!range) {
    return { amountCents: null, hint: undefined };
  }

  const min = Math.round(range.min);
  const max = Math.round(range.max);
  if (min <= 0 && max <= 0) {
    return { amountCents: null, hint: undefined };
  }

  const hint =
    max > min
      ? `Could be ${formatCurrency(min)} – ${formatCurrency(max)} depending on how many visits land this month.`
      : undefined;

  return {
    amountCents: Math.max(min, 0),
    hint,
  };
};

const RANGE_HINT_COPY =
  "Range depends on how many service days land in a calendar month—for example, weekly plans sometimes include a fifth visit.";

const formatDate = (value?: string | Date | null) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(date);
};

const toTitle = (value: string) =>
  value
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w+/g, (word) => word[0].toUpperCase() + word.slice(1));

const buildAreasList = (areas: unknown): string[] => {
  if (!areas) return [];
  if (Array.isArray(areas)) {
    return areas.filter(Boolean).map((item) => toTitle(String(item)));
  }

  if (typeof areas === "object") {
    return Object.entries(areas as Record<string, unknown>)
      .filter(([, value]) => Boolean(value))
      .map(([key]) => toTitle(key));
  }

  if (typeof areas === "string") {
    try {
      const parsed = JSON.parse(areas);
      return buildAreasList(parsed);
    } catch (error) {
      return [toTitle(areas)];
    }
  }

  return [];
};

const buildAddOnsList = (lead: QuoteLead | null) => {
  if (!lead?.addOns) return [];

  const items: { label: string; hint?: string }[] = [];

  if (lead.addOns.deodorize) {
    const mode = lead.addOns.deodorizeMode ?? "each-visit";
    const cadence =
      mode === "each-visit"
        ? "applied every visit"
        : mode === "every-other"
          ? "every other visit"
          : "first visit treatment";
    items.push({
      label: "ScentGuard deodorizing",
      hint: cadence,
    });
  }

  if (lead.addOns.sprayDeck) {
    const mode = lead.addOns.sprayDeckMode ?? "each-visit";
    const cadence =
      mode === "each-visit"
        ? "each visit"
        : mode === "every-other"
          ? "every other visit"
          : "first visit only";
    items.push({
      label: "Deck & patio rinse",
      hint: cadence,
    });
  }

  if (lead.addOns.divertMode && lead.addOns.divertMode !== "none") {
    const divertMode = lead.addOns.divertMode;
    const description =
      DIVERT_COPY[divertMode] ??
      (divertMode === "takeaway" ? "Haul away every bag" : "Compost routing");
    items.push({
      label: divertMode === "takeaway" ? "Haul away" : "Compost routing",
      hint: description,
    });
  }

  return items;
};

const SpinningLoader = () => (
  <div className={cn("quote-success-theme", quoteSuccessShellClass, "flex items-center justify-center")}
    aria-live="polite"
  >
    <div className="flex flex-col items-center gap-6 rounded-3xl border border-slate-200/50 bg-white/90 px-12 py-10 shadow-xl backdrop-blur-sm dark:border-emerald-500/30 dark:bg-[#0c241a]/90">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-coral/20 to-brand-coral/5 shadow-inner dark:from-brand-coral/30 dark:to-brand-coral/10">
        <Sparkles className="h-8 w-8 text-brand-coral" />
      </div>
      <div className="space-y-2 text-center">
        <h1 className="font-serif text-2xl font-bold tracking-tight text-slate-800 dark:text-emerald-50 md:text-3xl">
          Preparing your quote
        </h1>
        <p className="text-sm text-slate-500 dark:text-emerald-200/70">
          We&apos;re syncing your coverage area, cadence, and add-ons.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div
          className="h-5 w-5 rounded-full border-2 border-slate-300/50 animate-spin dark:border-emerald-500/30"
          style={{ borderTopColor: brandColors.coral }}
        />
        <span className="text-sm font-medium text-slate-600 dark:text-emerald-200/80">
          Running final checks…
        </span>
      </div>
    </div>
  </div>
);

function QuoteSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [quote, setQuote] = useState<QuoteLead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const leadId = searchParams?.get("leadId") ?? "";
  const businessId =
    searchParams?.get("businessId") ||
    searchParams?.get("org") ||
    searchParams?.get("tenant") ||
    searchParams?.get("tenantId") ||
    "yardura";
  const isCommercialParam = (searchParams?.get("commercial") ?? "") === "true";

  const fetchQuote = useCallback(async () => {
    if (!leadId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/leads/${leadId}?includePricing=1`, {
        cache: "no-store",
      });

      if (!response.ok) {
        let message = "Unable to load quote details right now.";
        try {
          const payload = await response.json();
          if (payload && typeof payload.error === "string" && payload.error.trim()) {
            message = payload.error.trim();
          }
        } catch (parseError) {
          console.warn("Unable to parse error payload for quote fetch", parseError);
        }
        setQuote(null);
        setError(message);
        return;
      }

      const data: QuoteLead = await response.json();
      setQuote(data);
    } catch (err) {
      console.error("Failed to fetch quote", err);
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't load your quote details. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    if (!leadId) {
      router.replace(`/quote?businessId=${businessId}`);
      return;
    }
    fetchQuote();
  }, [leadId, businessId, fetchQuote, router]);

  const isCommercial = useMemo(() => {
    if (!quote) {
      return isCommercialParam;
    }
    return isCommercialParam || quote.serviceType === "commercial";
  }, [isCommercialParam, quote]);

  const frequencyKey = (quote?.frequency ?? "").toLowerCase();
  const pricing = quote?.pricing ?? null;
  const pricingData = useMemo(() => {
    if (!pricing) {
      return null;
    }
    return pricing as PricingData;
  }, [pricing]);

  const weekendUpgradeEnabled = useMemo(
    () =>
      extractWeekendUpgrade(
        pricingData?.weekendUpgrade ?? null,
        pricingData?.breakdown ?? null,
        pricing,
        pricing?.metadata ?? null,
      ),
    [pricing, pricingData],
  );

  const frequencyMeta = useMemo(
    () =>
      buildFrequencyMeta(frequencyKey, weekendUpgradeEnabled)
        ?? buildFrequencyMeta(frequencyKey, false),
    [frequencyKey, weekendUpgradeEnabled],
  );

  const firstName = quote?.firstName?.trim();
  const quoteReference = quote?.id?.slice(-8).toUpperCase();
  const quoteDate = formatDate(quote?.submittedAt);
  const addOns = useMemo(() => (quote ? buildAddOnsList(quote) : []), [quote]);
  const areas = useMemo(
    () => (quote ? buildAreasList(quote.areasToClean) : []),
    [quote],
  );
  const dogsCopy = useMemo(() => {
    if (quote && typeof quote.dogs === "number") {
      return `${quote.dogs} ${quote.dogs === 1 ? "pup" : "pups"}`;
    }
    return "Not specified";
  }, [quote]);

  const yardCopy = useMemo(() => {
    if (quote?.yardSize) {
      return YARD_SIZE_LABELS[quote.yardSize] ?? toTitle(quote.yardSize);
    }
    return "Details to confirm";
  }, [quote]);

  const cityCopy = useMemo(() => {
    if (quote?.city) {
      return `${quote.city}${quote.state ? `, ${quote.state}` : ""}`;
    }
    return "Minnesota service area";
  }, [quote]);

  const normalizedFrequency = frequencyKey;
  const isOneTime = normalizedFrequency === "onetime";
  const trialWeekPresentation = useMemo(
    () =>
      pricingData?.trialWeek
        ? deriveTrialWeekPresentation(pricingData, normalizedFrequency)
        : null,
    [pricingData, normalizedFrequency],
  );
  const postTrialPresentation = useMemo(
    () => (pricingData ? derivePostTrialPresentation(pricingData) : null),
    [pricingData],
  );
  const activationDelayDays = postTrialPresentation?.activationDelayDays
    ?? trialWeekPresentation?.trialLengthDays
    ?? (isOneTime
      ? 0
      : normalizedFrequency === "biweekly"
        ? 14
        : 7);
  const activationPhrase = activationDelayDays === 14
    ? "two weeks after your kickoff visit"
    : "one week after your kickoff visit";
  const activationDelayCopy = (() => {
    if (isOneTime) {
      return "We invoice once the visit is complete.";
    }
    const startWindow = activationDelayDays === 14 ? "two weeks" : "one week";
    if (normalizedFrequency === "monthly") {
      return `Flat monthly billing begins ${startWindow} after your kickoff visit.`;
    }
    if (normalizedFrequency === "twice-weekly" || normalizedFrequency === "daily") {
      return `Weekly billing begins ${startWindow} after your kickoff visit.`;
    }
    if (
      normalizedFrequency === "biweekly" ||
      normalizedFrequency === "bi-weekly" ||
      normalizedFrequency === "every-other-week"
    ) {
      return `Every-other-week billing begins ${startWindow} after your kickoff visit.`;
    }
    return `Per-visit billing begins ${startWindow} after your kickoff visit.`;
  })();
  const postTrialHeaderNote = isOneTime
    ? null
    : `Billing begins ${activationPhrase}. Choose how you'd like to be billed below.`;
  const monthlyAfterTrialCents = postTrialPresentation?.monthlyCents
    ?? (typeof pricing?.fullMonthlyAmount === "number"
      ? pricing.fullMonthlyAmount
      : typeof pricing?.monthly === "number"
        ? pricing.monthly
        : null);
  const trialBannerSubtext = trialWeekPresentation?.trialLengthDays
    ? trialWeekPresentation.trialLengthDays === 14
      ? "Your free coverage runs for the first two weeks."
      : "Your free coverage runs for the first week."
    : "We'll apply the trial credit before your first paid invoice.";
  const perVisitAvailable =
    !isCommercial &&
    typeof pricing?.perVisit === "number" &&
    ["weekly", "biweekly", "twice-weekly", "daily"].includes(normalizedFrequency);

  const [billingView, setBillingView] = useState<"monthly" | "per-visit">(
    perVisitAvailable ? "per-visit" : "monthly",
  );

  const billingInitializedRef = useRef(false);

  useEffect(() => {
    if (!quote?.id) {
      return;
    }
    billingInitializedRef.current = false;
  }, [quote?.id]);

  useEffect(() => {
    if (!quote || billingInitializedRef.current) {
      return;
    }

    const rawPreference =
      typeof pricing?.metadata?.billingPreference === "string"
        ? pricing.metadata.billingPreference.toLowerCase()
        : null;

    let desiredView: "monthly" | "per-visit" = "monthly";
    if (perVisitAvailable) {
      if (rawPreference === "monthly") {
        desiredView = "monthly";
      } else if (rawPreference === "weekly") {
        desiredView = "per-visit";
      } else {
        desiredView = "per-visit";
      }
    }

    setBillingView(desiredView);

    billingInitializedRef.current = true;
  }, [quote, perVisitAvailable, pricing?.metadata?.billingPreference]);

  useEffect(() => {
    if (!perVisitAvailable) {
      setBillingView("monthly");
    }
  }, [perVisitAvailable]);

  const resolvedBillingPreference: "monthly" | "weekly" =
    perVisitAvailable && billingView === "per-visit" ? "weekly" : "monthly";

  const perVisitToggleLabel =
    normalizedFrequency === "twice-weekly" || normalizedFrequency === "daily"
      ? "Weekly billing"
      : "Pay per visit";

  const perVisitHeading =
    normalizedFrequency === "twice-weekly"
      ? "Weekly plan"
      : normalizedFrequency === "daily"
        ? "Daily service plan"
        : "Per-visit plan";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      sessionStorage.setItem("billingPreference", resolvedBillingPreference);
    } catch (error) {
      console.warn("Unable to persist billing preference", error);
    }
  }, [resolvedBillingPreference]);

  const toCents = (value?: number | null) =>
    typeof value === "number" && Number.isFinite(value) ? value : 0;

  const monthlyPlanCents =
    typeof pricing?.fullMonthlyAmount === "number"
      ? pricing.fullMonthlyAmount
      : typeof pricing?.monthly === "number"
        ? pricing.monthly
        : null;

  const perVisitAmountCents = perVisitAvailable
    ? toCents(pricingData?.perVisit && typeof pricingData.perVisit === "number"
        ? pricingData.perVisit
        : typeof pricingData?.perVisit === "string"
          ? Math.round(Number(pricingData.perVisit) * 100)
          : pricing?.perVisit ?? null)
    : 0;

  const skipCreditDisplay = perVisitAmountCents > 0 ? formatCurrency(perVisitAmountCents) : "$0.00";
  const usesSkipCreditForPerVisit =
    normalizedFrequency === "twice-weekly" || normalizedFrequency === "daily";
  const perVisitSkipCopy = usesSkipCreditForPerVisit
    ? `Skip or cancel a visit and we drop a ${skipCreditDisplay} credit automatically.`
    : "Skip or cancel a visit and there's no charge.";

  const perVisitPrimaryAmountCents = useMemo(() => {
    if (normalizedFrequency === "twice-weekly") {
      return perVisitAmountCents * 2;
    }
    if (normalizedFrequency === "daily") {
      const visitsPerWeek = weekendUpgradeEnabled ? 7 : 5;
      return perVisitAmountCents * visitsPerWeek;
    }
    return perVisitAmountCents;
  }, [perVisitAmountCents, normalizedFrequency, weekendUpgradeEnabled]);

  const perVisitPrimaryDisplayCents =
    perVisitPrimaryAmountCents > 0 ? perVisitPrimaryAmountCents : perVisitAmountCents;

  const perVisitPrimaryLabel = useMemo(() => {
    switch (normalizedFrequency) {
      case "twice-weekly":
        return "per service week (2 visits)";
      case "daily":
        return weekendUpgradeEnabled
          ? "per service week (Mon–Sun coverage)"
          : "per service week (weekday visits)";
      case "weekly":
        return "per service week (1 visit)";
      case "biweekly":
      case "bi-weekly":
      case "every-other-week":
        return "per visit (every other week)";
      default:
        return "per visit";
    }
  }, [normalizedFrequency, weekendUpgradeEnabled]);

  const perVisitPrimaryDescription = useMemo(() => {
    switch (normalizedFrequency) {
      case "daily":
        return weekendUpgradeEnabled
          ? "Seven visits bundled into one weekly charge."
          : "Five weekday visits bundled into one weekly charge.";
      case "twice-weekly":
        return "Two visits bundled into a single weekly charge.";
      case "weekly":
        return "One visit billed each service week.";
      case "biweekly":
      case "bi-weekly":
      case "every-other-week":
        return "Card runs the day after each every-other-week visit.";
      default:
        return "Card runs after each completed visit.";
    }
  }, [normalizedFrequency, weekendUpgradeEnabled]);

  const visitsPerMonthValue = useMemo(() => {
    const parseVisits = (value: unknown): number | null => {
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        return value;
      }
      if (typeof value === "string") {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      }
      return null;
    };

    const weekend = parseVisits(
      pricingData?.weekendVisitsPerMonth ?? (pricing as Record<string, unknown> | null | undefined)?.weekendVisitsPerMonth,
    );
    const base = parseVisits(
      pricing?.visitsPerMonth ?? pricingData?.visitsPerMonth,
    );

    if (weekendUpgradeEnabled && weekend) {
      return weekend;
    }

    return base;
  }, [pricing, pricingData, weekendUpgradeEnabled]);

  const visitsBounds = getVisitsBounds(visitsPerMonthValue ?? undefined);
  const visitsPerMonthRange = formatVisitsRange(visitsPerMonthValue ?? undefined);
  const hasVisitRange = Boolean(visitsBounds && visitsBounds.min !== visitsBounds.max);
  const showRangeNote = hasVisitRange && resolvedBillingPreference === "monthly";
  const approxVisitsLabel = visitsPerMonthRange
    ? `Typically ${visitsPerMonthRange}`
    : null;
  const approxVisitsSecondary = null;
  const showMonthlyVisitRange = !isOneTime && billingView === "monthly" && approxVisitsLabel;
  const estimatedMonthlyCents =
    visitsPerMonthValue && perVisitAmountCents
      ? Math.round(perVisitAmountCents * visitsPerMonthValue)
      : null;
  const estimatedMonthlyRangeCents =
    visitsBounds && perVisitAmountCents
      ? {
          min: Math.round(perVisitAmountCents * visitsBounds.min),
          max: Math.round(perVisitAmountCents * visitsBounds.max),
        }
      : null;
  const weekendMonthlyFallback =
    weekendUpgradeEnabled && visitsPerMonthValue && perVisitAmountCents > 0
      ? Math.round(perVisitAmountCents * visitsPerMonthValue)
      : null;
  const effectiveMonthlyAfterTrialCents =
    weekendMonthlyFallback ?? monthlyAfterTrialCents ?? null;
  const effectiveMonthlyPlanCents =
    weekendMonthlyFallback ?? monthlyPlanCents ?? null;
  const firstVisitAddOnsCents = toCents(pricing?.firstVisitAddOnsTotal);

  const monthlyFlatDisplay = useMemo(() => {
    if (typeof effectiveMonthlyAfterTrialCents === "number" && effectiveMonthlyAfterTrialCents > 0) {
      return formatCurrency(effectiveMonthlyAfterTrialCents);
    }
    if (typeof effectiveMonthlyPlanCents === "number" && effectiveMonthlyPlanCents > 0) {
      return formatCurrency(effectiveMonthlyPlanCents);
    }
    if (typeof estimatedMonthlyCents === "number" && estimatedMonthlyCents > 0) {
      return formatCurrency(estimatedMonthlyCents);
    }
    return null;
  }, [effectiveMonthlyAfterTrialCents, effectiveMonthlyPlanCents, estimatedMonthlyCents]);

  const perVisitCard = (
    <div className="space-y-3 rounded-2xl border border-emerald-400/30 bg-[#102d22] px-4 py-4 text-emerald-200/85 md:border-slate-200 md:bg-white md:text-[rgba(var(--graphite-rgb-commas),0.78)]">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-emerald-200/70 md:text-[rgba(var(--graphite-rgb-commas),0.5)]">
            {perVisitHeading}
          </span>
          <div className="font-serif text-2xl font-black text-emerald-50 md:text-brand-ink">
            {formatCurrency(perVisitPrimaryDisplayCents)}
          </div>
          <span className="text-xs text-emerald-200/70 md:text-[rgba(var(--graphite-rgb-commas),0.6)]">
            {perVisitPrimaryLabel}
          </span>
        </div>
        {approxVisitsLabel ? (
          <span className="text-xs text-emerald-200/70 md:text-[rgba(var(--graphite-rgb-commas),0.6)]">
            {approxVisitsLabel}
          </span>
        ) : null}
      </div>
      <p className="text-xs leading-relaxed text-emerald-200/80 md:text-[rgba(var(--graphite-rgb-commas),0.65)]">
        Billing starts {activationPhrase}. {perVisitPrimaryDescription} {perVisitSkipCopy}
      </p>
    </div>
  );

  const monthlyCard = (
    <div className="space-y-3 rounded-2xl border border-emerald-400/30 bg-[#102d22] px-4 py-4 text-emerald-200/85 md:border-slate-200 md:bg-white md:text-[rgba(var(--graphite-rgb-commas),0.78)]">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-emerald-200/70 md:text-[rgba(var(--graphite-rgb-commas),0.5)]">
            Monthly plan
          </span>
          <div className="font-serif text-2xl font-black text-emerald-50 md:text-brand-ink">
            {monthlyFlatDisplay ?? (estimatedMonthlyCents ? formatCurrency(estimatedMonthlyCents) : formatCurrency(perVisitAmountCents))}
          </div>
          <span className="text-xs text-emerald-200/70 md:text-[rgba(var(--graphite-rgb-commas),0.6)]">
            Flat invoice every 30 days.
          </span>
        </div>
        {approxVisitsLabel ? (
          <span className="text-xs text-emerald-200/70 md:text-[rgba(var(--graphite-rgb-commas),0.6)]">
            {approxVisitsLabel}
          </span>
        ) : null}
      </div>
      <p className="text-xs leading-relaxed text-emerald-200/80 md:text-[rgba(var(--graphite-rgb-commas),0.65)]">
        We invoice every 30 days beginning {activationPhrase}. Skip or cancel a visit and we apply a {skipCreditDisplay} credit before the next statement.
      </p>
    </div>
  );

  const rawInitialCleanSubtotalCents =
    typeof pricing?.initialCleanCents === "number"
      ? pricing.initialCleanCents
      : typeof pricing?.firstVisitTotalCents === "number"
        ? Math.max(0, pricing.firstVisitTotalCents - firstVisitAddOnsCents)
        : typeof pricingData?.initialClean === "number"
          ? pricingData.initialClean
          : typeof pricingData?.initialClean === "string"
            ? Math.round(Number(pricingData.initialClean) * 100)
            : 0;

  const rawInitialCleanDiscountCents = toCents(pricing?.initialCleanDiscount);

  const initialCleanSubtotalCents =
    rawInitialCleanSubtotalCents > 0
      ? rawInitialCleanSubtotalCents
      : rawInitialCleanDiscountCents > 0
        ? rawInitialCleanDiscountCents
        : 0;

  const normalizedInitialCleanDiscountCents = Math.min(
    initialCleanSubtotalCents,
    rawInitialCleanDiscountCents,
  );

  const includesInitialCleanCredit =
    !isOneTime && normalizedFrequency !== "monthly" && normalizedFrequency !== "onetime";

  const discountedInitialCleanCents = includesInitialCleanCredit
    ? 0
    : Math.max(0, initialCleanSubtotalCents - normalizedInitialCleanDiscountCents);

  const freeFollowUpVisits =
    normalizedFrequency === "twice-weekly"
      ? 1
      : normalizedFrequency === "daily"
        ? weekendUpgradeEnabled ? 6 : 4
        : 0;

  const spellOutVisitCount = (count: number): string => {
    const words: Record<number, string> = {
      1: "one",
      2: "two",
      3: "three",
      4: "four",
      5: "five",
      6: "six",
      7: "seven",
    };
    return words[count] ?? count.toString();
  };

  const hasInitialCleanCredit = includesInitialCleanCredit;
  const hasInitialCleanDiscount =
    !includesInitialCleanCredit &&
    normalizedInitialCleanDiscountCents > 0 &&
    normalizedFrequency === "monthly";

  const initialCleanCreditCents = includesInitialCleanCredit
    ? initialCleanSubtotalCents
    : hasInitialCleanDiscount
      ? normalizedInitialCleanDiscountCents
      : 0;

  const followUpCreditCents = perVisitAmountCents * freeFollowUpVisits;

  const initialVisitCreditCount = initialCleanCreditCents > 0 ? 1 : 0;
  const totalFreeVisitCredits = initialVisitCreditCount + freeFollowUpVisits;

  const remainingMonthVisitsBounds = visitsBounds
    ? {
        min: Math.max(Math.floor(visitsBounds.min) - initialVisitCreditCount, 0),
        max: Math.max(Math.ceil(visitsBounds.max) - initialVisitCreditCount, 0),
      }
    : null;

  const remainingMonthVisitsLower = remainingMonthVisitsBounds?.min ?? 0;

  const remainingMonthVisitsLabel = useMemo(() => {
    if (!remainingMonthVisitsBounds) return null;
    if (remainingMonthVisitsBounds.max <= 0) return null;

    const formatVisitCount = (min: number, max: number) => {
      if (min === max) {
        return `${min}`;
      }
      const start = Math.max(0, min);
      const end = Math.max(start, max);
      const values: number[] = [];
      for (let value = start; value <= end; value += 1) {
        values.push(value);
      }
      if (values.length === 2) {
        return `${values[0]} or ${values[1]}`;
      }
      const head = values.slice(0, -1).join(", ");
      const tail = values[values.length - 1];
      return `${head}, or ${tail}`;
    };

    const countLabel = formatVisitCount(
      Math.max(0, remainingMonthVisitsBounds.min),
      Math.max(0, remainingMonthVisitsBounds.max),
    );

    return `Remaining month visits ${countLabel}`;
  }, [remainingMonthVisitsBounds]);
  const remainingMonthVisitsHint =
    remainingMonthVisitsBounds && remainingMonthVisitsBounds.max > 0
      ? "Actual count depends on how service days land this month."
      : undefined;

  const scheduledFirstWeekVisits = (() => {
    switch (normalizedFrequency) {
      case "daily":
        return initialVisitCreditCount + freeFollowUpVisits;
      case "twice-weekly":
        return initialVisitCreditCount + freeFollowUpVisits;
      case "weekly":
        return initialVisitCreditCount + freeFollowUpVisits;
      case "biweekly":
      case "bi-weekly":
      case "every-other-week":
        return initialVisitCreditCount + freeFollowUpVisits;
      default:
        return initialVisitCreditCount + freeFollowUpVisits;
    }
  })();

  const firstWeekFreeVisitCredits =
    normalizedFrequency === "daily" ? totalFreeVisitCredits : initialVisitCreditCount;
  const firstWeekRemainingVisitCount = Math.max(
    scheduledFirstWeekVisits - Math.min(scheduledFirstWeekVisits, firstWeekFreeVisitCredits),
    0,
  );

  const firstWeekRemainingLabel = (() => {
    if (scheduledFirstWeekVisits <= 0) return null;
    return `Remaining first week visits ${firstWeekRemainingVisitCount}`;
  })();

  const firstWeekCreditCents = Math.max(
    0,
    initialCleanSubtotalCents + perVisitAmountCents * freeFollowUpVisits,
  );

  const initialValueLabelCents =
    freeFollowUpVisits > 0 ? firstWeekCreditCents : initialCleanSubtotalCents;

  const freeVisitSummary = (() => {
    if (normalizedFrequency === "twice-weekly") {
      return "initial clean and first follow-up visit";
    }
    if (normalizedFrequency === "daily" && freeFollowUpVisits > 0) {
      const visitWord = spellOutVisitCount(freeFollowUpVisits);
      const visitLabel = freeFollowUpVisits === 1 ? "visit" : "visits";
      const descriptor = weekendUpgradeEnabled ? "daily" : "weekday";
      return `initial clean and ${visitWord} ${descriptor} ${visitLabel}`;
    }
    return null;
  })();

  const initialValueSubLabel = freeVisitSummary ?? undefined;
  const initialRowSubLabel = (freeVisitSummary && (normalizedFrequency === "twice-weekly" || normalizedFrequency === "daily"))
    ? undefined
    : initialValueSubLabel;

  const introCreditPlan = useMemo(
    () =>
      computeIntroCredits({
        normalizedFrequency,
        initialCleanCents: initialCleanSubtotalCents,
        perVisitCents: perVisitAmountCents,
      }),
    [normalizedFrequency, initialCleanSubtotalCents, perVisitAmountCents],
  );

  const { summary: introCreditSummary } = useMemo(
    () => summarizeIntroCredits(introCreditPlan),
    [introCreditPlan],
  );

  const promoSummaryMessage =
    introCreditSummary ?? "Promo credits apply automatically to your kickoff visits.";
  const initialCleanStatusLabel = (() => {
    if (initialCleanSubtotalCents <= 0 || isOneTime) {
      return null;
    }
    if (hasInitialCleanDiscount) {
      return {
        label: `Half off (${formatCurrency(discountedInitialCleanCents)})`,
        tone: "discount" as const,
      };
    }
    return null;
  })();

  const initialBadgeLabel = (() => {
    if (hasInitialCleanDiscount) {
      return initialCleanStatusLabel?.label ?? null;
    }
    if (hasInitialCleanCredit) {
      return "FREE";
    }
    return null;
  })();

  const initialBadgeTone: "discount" | "free" | undefined = (() => {
    if (hasInitialCleanDiscount) {
      return initialCleanStatusLabel?.tone ?? "discount";
    }
    if (hasInitialCleanCredit) {
      return "free";
    }
    return undefined;
  })();

  const initialVisitTotalCents =
    typeof pricing?.firstVisitTotalCents === "number" && pricing.firstVisitTotalCents > 0
      ? pricing.firstVisitTotalCents
      : discountedInitialCleanCents + firstVisitAddOnsCents;

  const averageMonthlyCents = useMemo(() => {
    if (estimatedMonthlyCents !== null) {
      return Math.round(estimatedMonthlyCents);
    }
    if (monthlyPlanCents) {
      return monthlyPlanCents;
    }
    if (visitsPerMonthValue && perVisitAmountCents > 0) {
      return Math.round(perVisitAmountCents * visitsPerMonthValue);
    }
    if (estimatedMonthlyRangeCents) {
      return Math.round((estimatedMonthlyRangeCents.min + estimatedMonthlyRangeCents.max) / 2);
    }
    if (perVisitAmountCents > 0 && visitsBounds) {
      const avgVisits = (visitsBounds.min + visitsBounds.max) / 2;
      return Math.round(perVisitAmountCents * avgVisits);
    }
    return null;
  }, [
    estimatedMonthlyCents,
    effectiveMonthlyPlanCents,
    visitsPerMonthValue,
    perVisitAmountCents,
    estimatedMonthlyRangeCents,
    visitsBounds,
  ]);

  const monthlyHeadline = useMemo(() => {
    if (isOneTime) {
      return formatCurrency(initialVisitTotalCents);
    }

    if (averageMonthlyCents !== null && averageMonthlyCents > 0) {
      const rounded = Math.round(averageMonthlyCents / 100) * 100;
      const display = formatCurrencyCompact(rounded);
      const prefix = `~${display}`;
      return showRangeNote ? `${prefix}*` : prefix;
    }

    if (estimatedMonthlyRangeCents) {
      const roundedMin = Math.round(estimatedMonthlyRangeCents.min / 100) * 100;
      const roundedMax = Math.round(estimatedMonthlyRangeCents.max / 100) * 100;
      if (roundedMin === roundedMax) {
        const display = formatCurrencyCompact(roundedMin);
        const prefix = `~${display}`;
        return showRangeNote ? `${prefix}*` : prefix;
      }
      if (visitsBounds && visitsBounds.max - visitsBounds.min === 1) {
        const display = formatCurrencyCompact(Math.round((roundedMin + roundedMax) / 2));
        const prefix = `~${display}`;
        return showRangeNote ? `${prefix}*` : prefix;
      }
    }

    if (perVisitAmountCents > 0 && visitsBounds) {
      const avgVisits = (visitsBounds.min + visitsBounds.max) / 2;
      const estimate = Math.round((perVisitAmountCents * avgVisits) / 100) * 100;
      const display = formatCurrencyCompact(estimate);
      const prefix = `~${display}`;
      return showRangeNote ? `${prefix}*` : prefix;
    }

    const fallback = formatCurrencyCompact(perVisitAmountCents);
    return showRangeNote ? `~${fallback}*` : `~${fallback}`;
  }, [
    averageMonthlyCents,
    estimatedMonthlyRangeCents,
    initialVisitTotalCents,
    isOneTime,
    perVisitAmountCents,
    showRangeNote,
    visitsBounds,
  ]);

  const billingTimingSentence = useMemo(() => {
    const monthlyAmountDescription = (() => {
      if (averageMonthlyCents !== null && averageMonthlyCents > 0) {
        const rounded = Math.round(averageMonthlyCents / 100) * 100;
        const display = formatCurrencyCompact(rounded);
        return `~${display}`;
      }
      if (effectiveMonthlyPlanCents) {
        return `~${formatCurrencyCompact(effectiveMonthlyPlanCents)}`;
      }
      if (estimatedMonthlyRangeCents) {
        const avg = Math.round(
          (estimatedMonthlyRangeCents.min + estimatedMonthlyRangeCents.max) / 2,
        );
        const display = formatCurrencyCompact(Math.round(avg / 100) * 100);
        return `~${display}`;
      }
      if (perVisitAmountCents > 0 && visitsBounds) {
        const avgVisits = (visitsBounds.min + visitsBounds.max) / 2;
        const estimate = Math.round(perVisitAmountCents * avgVisits);
        const display = formatCurrencyCompact(Math.round(estimate / 100) * 100);
        return `~${display}`;
      }
      return null;
    })();

    if (isOneTime) {
      return "We'll charge the saved card the day after your cleanup once you approve the visit.";
    }

    const activationPhrase = activationDelayDays === 14
      ? "two weeks after your kickoff visit"
      : "one week after your kickoff visit";

    if (resolvedBillingPreference === "monthly") {
      const monthlyLabel = monthlyAmountDescription
        ?? (effectiveMonthlyPlanCents ? formatCurrency(effectiveMonthlyPlanCents) : "your flat monthly rate");
      return `After the free week we invoice ${monthlyLabel} every 30 days. Skipped or cancelled visits earn a ${skipCreditDisplay} credit automatically. Billing starts ${activationPhrase}.`;
    }

    const perVisitLabel = perVisitAmountCents > 0 ? formatCurrency(perVisitAmountCents) : "per visit";
    if (usesSkipCreditForPerVisit) {
      const bundleLabel = formatCurrency(perVisitPrimaryDisplayCents);
      return `After the free week we run ${bundleLabel} once each service week wraps. Skip or cancel and we drop a ${skipCreditDisplay} credit automatically. Billing starts ${activationPhrase}.`;
    }
    return `After the free week we only run your card after each completed visit (${perVisitLabel}). Skip or cancel and there's no charge. Billing starts ${activationPhrase}.`;
  }, [
    activationDelayDays,
    averageMonthlyCents,
    estimatedMonthlyRangeCents,
    isOneTime,
    monthlyPlanCents,
    perVisitPrimaryDisplayCents,
    perVisitAmountCents,
    resolvedBillingPreference,
    skipCreditDisplay,
    visitsBounds,
    usesSkipCreditForPerVisit,
  ]);

  const coverageCreditLabel = useMemo(() => {
    if (freeFollowUpVisits <= 0) return null;
    return "First week coverage credit";
  }, [freeFollowUpVisits]);

  const combinedFirstWeekCreditsLabel = "First week coverage credit";

  const showCombinedFirstWeekCredits =
    hasInitialCleanCredit && followUpCreditCents > 0;

  const creditLineItems = useMemo(
    () => {
      const items: Array<{
        key: string;
        label: string;
        amountCents: number;
        tone: "free" | "discount";
      }> = [];

      if (normalizedFrequency === "monthly" && normalizedInitialCleanDiscountCents > 0) {
        items.push({
          key: "initial-clean-discount",
          label: "Initial clean discount",
          amountCents: normalizedInitialCleanDiscountCents,
          tone: "discount",
        });
      }

      if (showCombinedFirstWeekCredits) {
        items.push({
          key: "first-week-coverage",
          label: combinedFirstWeekCreditsLabel,
          amountCents: initialCleanSubtotalCents + followUpCreditCents,
          tone: "free",
        });
      } else {
        if (hasInitialCleanCredit && initialCleanSubtotalCents > 0) {
          items.push({
            key: "initial-clean-credit",
            label: "Initial clean credit",
            amountCents: initialCleanSubtotalCents,
            tone: "free",
          });
        }

        if (freeFollowUpVisits > 0 && followUpCreditCents > 0) {
          items.push({
            key: "coverage-credit",
            label: coverageCreditLabel ?? "First week coverage credit",
            amountCents: followUpCreditCents,
            tone: "free",
          });
        }
      }

      return items;
    }, [
      coverageCreditLabel,
      combinedFirstWeekCreditsLabel,
      followUpCreditCents,
      freeFollowUpVisits,
      hasInitialCleanCredit,
      initialCleanSubtotalCents,
      normalizedFrequency,
      normalizedInitialCleanDiscountCents,
      showCombinedFirstWeekCredits,
    ],
  );

  const totalCreditCents = creditLineItems.reduce((sum, item) => sum + item.amountCents, 0);
  const showCreditSummary = creditLineItems.length > 0;

  const chargeRows = useMemo<ChargeRow[]>(() => {
    const rows: ChargeRow[] = [];

    if (initialCleanSubtotalCents > 0) {
      rows.push({
        key: "initial-clean",
        label: (
          <InitialCleanLabel className="text-emerald-200 md:text-brand-ink md:dark:text-emerald-200" />
        ),
        amountCents: initialCleanSubtotalCents,
        subLabel: initialRowSubLabel,
        badgeLabel: hasInitialCleanDiscount
          ? initialCleanStatusLabel?.label ?? null
          : null,
        badgeTone: hasInitialCleanDiscount ? initialCleanStatusLabel?.tone : undefined,
        kind: "initial",
      });
    }

    if (normalizedFrequency === "twice-weekly" && perVisitAmountCents > 0) {
      rows.push({
        key: "follow-up",
        label: (
          <span className="text-emerald-200/75 md:text-[rgba(var(--graphite-rgb-commas),0.75)]">
            {billingView === "monthly"
              ? "Kickoff week follow-up visit"
              : "First week follow-up visit"}
          </span>
        ),
        amountCents: perVisitAmountCents,
        kind: "coverage",
      });
    }

    if (normalizedFrequency === "daily" && perVisitAmountCents > 0) {
      const coveredVisits = weekendUpgradeEnabled ? 6 : 4;
      const visitLabel = "visits";
      const descriptor = weekendUpgradeEnabled ? "daily" : "weekday";
      rows.push({
        key: weekendUpgradeEnabled ? "daily-visits" : "weekday-visits",
        label: (
          <span className="text-emerald-200/75 md:text-[rgba(var(--graphite-rgb-commas),0.75)]">
            {billingView === "monthly"
              ? `Kickoff ${descriptor} ${visitLabel} (${coveredVisits})`
              : `First week ${descriptor} ${visitLabel} (${coveredVisits})`}
          </span>
        ),
        amountCents: perVisitAmountCents * coveredVisits,
        kind: "coverage",
      });
    }

    if (
      !isOneTime &&
      billingView === "monthly" &&
      perVisitAmountCents > 0 &&
      remainingMonthVisitsLabel &&
      remainingMonthVisitsLower > 0
    ) {
      rows.push({
        key: "remaining-month-visits",
        label: remainingMonthVisitsLabel,
        amountCents: perVisitAmountCents * remainingMonthVisitsLower,
        hint: remainingMonthVisitsHint,
        kind: "monthly-remainder",
      });
    }

    if (
      !isOneTime &&
      billingView === "per-visit" &&
      perVisitAmountCents > 0 &&
      firstWeekRemainingLabel &&
      firstWeekRemainingVisitCount > 0
    ) {
      rows.push({
        key: "remaining-first-week",
        label: firstWeekRemainingLabel,
        amountCents: perVisitAmountCents * firstWeekRemainingVisitCount,
        kind: "first-week-remainder",
      });
    }

    if (firstVisitAddOnsCents > 0) {
      rows.push({
        key: "first-visit-add-ons",
        label: (
          <span className="text-emerald-200 md:text-brand-ink md:dark:text-emerald-200">
            {isOneTime ? "First-visit add-ons" : "Add-ons for first visit"}
          </span>
        ),
        amountCents: firstVisitAddOnsCents,
        kind: "addon",
      });
    }

    return rows;
  }, [
    billingView,
    firstVisitAddOnsCents,
    hasInitialCleanDiscount,
    initialCleanStatusLabel,
    initialCleanSubtotalCents,
    initialRowSubLabel,
    isOneTime,
    normalizedFrequency,
    perVisitAmountCents,
    firstWeekRemainingLabel,
    firstWeekRemainingVisitCount,
    remainingMonthVisitsHint,
    remainingMonthVisitsLabel,
    remainingMonthVisitsLower,
  ]);

  const chargeRowsWithoutCoverage = useMemo(
    () => chargeRows.filter((row) => row.kind !== "coverage"),
    [chargeRows],
  );

  const estimatedFirstMonth = computeEstimatedFirstMonthDisplay({
    perVisitAmountCents,
    visitCountBounds: visitsBounds ?? null,
    visitsPerMonthValue,
    freeFollowUpVisits,
    discountedInitialCleanCents,
    initialCleanCreditCents,
    firstVisitAddOnsCents,
    initialVisitCreditCount,
    totalFreeVisitCredits,
  });

  const perVisitSubtotalLabel =
    !isOneTime && billingView === "per-visit"
      ? "First week subtotal"
      : freeFollowUpVisits > 0
        ? "First week subtotal"
        : "Subtotal before credits";
  const monthlySubtotalLabel =
    freeFollowUpVisits > 0 ? "First month subtotal" : "Subtotal before credits";

  const subtotalBeforeCreditsPerVisit = useMemo(() => {
    const rows = billingView === "per-visit" ? chargeRowsWithoutCoverage : chargeRows;
    return rows.reduce((sum, row) => sum + row.amountCents, 0);
  }, [billingView, chargeRows, chargeRowsWithoutCoverage]);
  const subtotalBeforeCreditsForMonthlyView = chargeRows.reduce(
    (sum, row) => (row.kind === "coverage" ? sum : sum + row.amountCents),
    0,
  );

  const firstWeekNetCents = Math.max(
    (billingView === "per-visit"
      ? chargeRowsWithoutCoverage.reduce((sum, row) => sum + row.amountCents, 0)
      : chargeRows.reduce((sum, row) => sum + row.amountCents, 0)) - totalCreditCents,
    0,
  );

  const shouldShowSubtotalRow = showCreditSummary && chargeRows.length > 1;

  const billingNarrative = billingTimingSentence;

  const renderChargeRows = useCallback(
    (options?: { hideCoverage?: boolean }) =>
      (options?.hideCoverage ? chargeRows.filter((row) => row.kind !== "coverage") : chargeRows).map((row) => {
        const isRemainder =
          row.kind === "monthly-remainder" || row.kind === "first-week-remainder";
        return (
          <li key={row.key} className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "text-emerald-200 md:text-brand-ink md:dark:text-emerald-200",
                    isRemainder &&
                      "text-[0.7rem] uppercase tracking-[0.16em] text-emerald-200 md:text-brand-ink md:dark:text-emerald-200 md:text-[rgba(var(--graphite-rgb-commas),0.6)]",
                  )}
                >
                  {row.label}
                </div>
                {row.hint ? <span className="text-[0.65rem] text-emerald-200/70 md:text-[rgba(var(--graphite-rgb-commas),0.6)]">*</span> : null}
              </div>
            {row.subLabel ? (
              <span className="text-[0.65rem] uppercase tracking-[0.18em] text-emerald-200 md:text-brand-ink md:dark:text-emerald-200 md:text-[rgba(var(--graphite-rgb-commas),0.55)]">
                {row.subLabel}
              </span>
            ) : null}
          </div>
          <div className="text-right font-semibold text-emerald-50 md:text-brand-ink">
            <span>{formatCurrency(row.amountCents)}</span>
            {row.badgeLabel ? (
              <span
                className={cn(
                  "mt-0.5 inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.65rem] font-black uppercase tracking-wide",
                  row.badgeTone === "discount"
                    ? "bg-[rgba(250,112,96,0.2)] text-brand-coral"
                    : "bg-[rgba(32,105,80,0.35)] text-emerald-50 md:border md:border-[rgba(25,180,163,0.28)] md:bg-[rgba(25,180,163,0.12)] md:text-[rgba(var(--graphite-rgb-commas),0.78)]",
                )}
              >
                {row.badgeLabel}
              </span>
            ) : null}
          </div>
          </li>
        );
      }),
    [chargeRows],
  );



  const onboardingSearch = new URLSearchParams({ leadId });
  if (businessId) onboardingSearch.set("businessId", businessId);
  if (isCommercialParam) onboardingSearch.set("commercial", "true");
  onboardingSearch.set("billingPreference", resolvedBillingPreference);
  const onboardingUrl = `/onboarding/start?${onboardingSearch.toString()}`;

  const emailSearch = new URLSearchParams({ leadId });
  if (businessId) emailSearch.set("businessId", businessId);
  emailSearch.set("billingPreference", resolvedBillingPreference);
  const emailQuoteUrl = `/quote/sent?${emailSearch.toString()}`;

type QuickFactDetailLine = {
  valueLabel?: string;
  subLabel?: string;
  badge?: string;
  badgeTone?: "discount" | "free";
  showInitialCleanLabel?: boolean;
};

type QuickFact = {
  icon:
    | typeof Sparkles
    | typeof Clock
    | typeof CalendarCheck
    | typeof Dog
    | typeof HeartPulse
    | typeof MapPin
    | typeof ShieldCheck;
  label: string;
  tone: string;
  detail?: string;
  detailLines?: QuickFactDetailLine[];
};

interface ChargeRow {
  key: string;
  label: React.ReactNode;
  amountCents: number;
  subLabel?: string;
  badgeLabel?: string | null;
  badgeTone?: "free" | "discount";
  kind?:
    | "initial"
    | "coverage"
    | "addon"
    | "monthly-remainder"
    | "first-week-remainder";
  hint?: string;
}

  const initialHighlightLabel =
    freeFollowUpVisits > 0 ? "First week coverage" : "Initial clean";

  const initialHighlightSubLabel = freeVisitSummary ?? undefined;
  const initialCleanFact: QuickFact | null =
    initialCleanSubtotalCents > 0
      ? {
          icon: Sparkles,
          label: initialHighlightLabel,
          tone: brandColors.coral,
          detailLines: [
            {
              valueLabel: formatCurrency(initialValueLabelCents),
              subLabel: initialHighlightSubLabel,
              badge: initialBadgeLabel ?? undefined,
              badgeTone: initialBadgeLabel ? (initialBadgeTone ?? "free") : undefined,
              showInitialCleanLabel: true,
            },
          ],
        }
      : null;

  const perVisitFact: QuickFact | null =
    !isOneTime && perVisitAmountCents > 0
      ? {
          icon: Clock,
          label: "Per visit rate",
          tone: brandColors.evergreen,
          detailLines: [
            {
              valueLabel: formatCurrency(perVisitAmountCents),
              subLabel: approxVisitsLabel ?? undefined,
            },
          ],
        }
      : null;

  let page: React.ReactNode;

  if (isLoading) {
    page = <SpinningLoader />;
  } else if (error) {
    page = (
      <div className={cn(
        "quote-success-theme",
        quoteSuccessShellClass,
        "flex items-center justify-center px-4 py-16",
      )}
      >
        <Card className="max-w-lg w-full rounded-3xl border border-brand-soft shadow-[0_24px_60px_rgba(27,30,35,0.08)]">
          <CardHeader className="text-center space-y-4">
            <div
              className="mx-auto h-16 w-16 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: withAlpha(brandColors.coral, 0.14),
                color: brandColors.coralInk,
              }}
            >
              <ShieldCheck className="size-8" />
            </div>
            <CardTitle className="font-serif text-2xl font-bold text-brand-ink">
              We couldn't load your quote
            </CardTitle>
            <p className="text-sm text-[rgba(var(--graphite-rgb-commas),0.7)]">
              {error}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full rounded-xl bg-brand-coral text-cream-soft font-semibold hover:bg-brand-coral/95"
              onClick={fetchQuote}
            >
              Try again
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full rounded-xl border-brand-soft text-brand-ink hover:bg-slate-50"
            >
              <Link href={`/quote?businessId=${businessId}`}>Back to quote</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  } else if (!quote) {
    page = <SpinningLoader />;
  } else {
    const baseQuickFacts: QuickFact[] = [
      {
        icon: CalendarCheck,
        label: frequencyMeta?.label ?? "Service cadence",
        detail: frequencyMeta?.cadence ?? "We'll finalize your visit rhythm during onboarding",
        tone: frequencyMeta?.tone ?? brandColors.evergreen,
      },
      {
        icon: Dog,
        label: dogsCopy,
        detail: "Included in this quote",
        tone: brandColors.coralInk,
      },
      {
        icon: MapPin,
        label: cityCopy,
        detail:
          quote.zipCode && quote.zipCode.trim().length > 0
            ? `Zip ${quote.zipCode}`
            : "Zip verified during onboarding",
        tone: brandColors.gold,
      },
      {
        icon: HeartPulse,
        label: "Wellness insights – first year free",
        detail: "Normally $19.99/mo (~$240/year) — free when you launch by 4/30/2026.",
        tone: brandColors.coralInk,
      },
      {
        icon: ShieldCheck,
        label:
          addOns.length > 0
            ? `${addOns.length} service add-on${addOns.length > 1 ? "s" : ""}`
            : "Optional add-ons",
        detail:
          addOns.length > 0
            ? addOns.map((item) => item.label).join(" · ")
            : "Add deodorizing, deck rinse, or compost routing anytime",
        tone: brandColors.evergreen,
      },
    ];

    const quickFacts: QuickFact[] = [
      ...(initialCleanFact ? [initialCleanFact] : []),
      ...(perVisitFact ? [perVisitFact] : []),
      ...baseQuickFacts,
    ];

  const nextSteps = isCommercial
    ? [
        {
          icon: CreditCard,
          title: "Confirm your tailored package",
          description:
            "We'll review property details and finalize service scope together.",
        },
        {
          icon: CalendarCheck,
          title: "Schedule onboarding call",
          description:
            "Pick a time to align with your property team and set the go-live date.",
        },
        {
          icon: ShieldCheck,
          title: "Launch dedicated service",
          description:
            "Your account manager coordinates crews, reporting, and wellness insights.",
        },
      ]
    : [
        {
          icon: CreditCard,
          title: "Secure your start",
          description:
            "We'll guide you through billing preferences during onboarding and lock in your first visit with the right plan for your schedule.",
        },
        {
          icon: CalendarCheck,
          title: "Choose your first service day",
          description:
            "Pick the visit date that fits your schedule. We never book same-day starts—the earliest slot is tomorrow.",
        },
        {
          icon: Sparkles,
          title: "Explore wellness insights",
          description:
            "Watch every pickup, review stool trends, and stay ahead of pet health updates inside your dashboard.",
        },
      ];

  const contactActions = [
    {
      icon: Phone,
      label: "Talk with the Yardura team",
      value: "1-877-417-YARD",
      href: "tel:1-877-417-9273",
      description: "We're available 8am–6pm CT for questions or scheduling.",
    },
    {
      icon: Mail,
      label: "Email our team",
      value: "hello@yardura.com",
      href: "mailto:hello@yardura.com",
      description: "Want the quote delivered or have follow-up questions? Reach out anytime.",
    },
  ];

    page = (
      <div className={cn("quote-success-theme", quoteSuccessShellClass)}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pb-24 pt-24 md:px-6 md:pb-32 md:pt-28 lg:pt-32">
        <div className="grid gap-10 lg:grid-cols-[1.25fr,0.95fr]">
          <div className="space-y-8">
            <section className={cn(
              quoteSuccessPanelClass,
              "p-6 sm:p-8 lg:p-10 space-y-8",
            )}>
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-[rgba(25,97,72,0.45)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-50 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-50 md:border-[rgba(255,194,77,0.32)] md:bg-[rgba(255,194,77,0.18)] md:text-[#204B36]"
                  >
                    <CheckCircle2 className="size-3.5" /> Quote ready
                  </span>
                  {quoteReference ? (
                    <span
                      className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-[rgba(20,53,45,0.7)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-50 md:border-[rgba(243,100,91,0.26)] md:bg-[rgba(250,247,241,0.9)] md:text-[#C43D37]"
                    >
                      <BadgeCheck className="size-3.5" /> #{quoteReference}
                    </span>
                  ) : null}
                  {quoteDate ? (
                    <span className="text-xs font-medium text-[rgba(var(--graphite-rgb-commas),0.65)] dark:text-emerald-200/80">
                      Submitted {quoteDate}
                    </span>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <h1 className="font-serif text-3xl font-black leading-[1.04] text-emerald-50 md:text-5xl md:text-brand-ink">
                    {isCommercial
                      ? "Your commercial quote is ready to share"
                      : `Welcome to cleaner yards${firstName ? `, ${firstName}` : ""}`}!
                  </h1>
                  <p className="text-sm leading-relaxed text-emerald-200/80 md:text-lg md:text-[rgba(var(--graphite-rgb-commas),0.78)] md:max-w-2xl">
                    {isCommercial
                      ? "Everything you need is packaged below. Walk through the numbers together or send a follow-up email with one click."
                      : "Review your quote details below. When you're ready, start onboarding instantly or email the quote to yourself for later."}
                  </p>
                </div>

                <div className="relative overflow-hidden rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/20 via-emerald-500/8 to-transparent p-5 text-sm font-semibold text-emerald-50 shadow-[0_18px_48px_rgba(0,0,0,0.45)] md:hidden">
                  Quote locked in—kick off onboarding when you’re ready and we’ll get your yard glow-up on the schedule.
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.12),transparent_60%)]" />
                </div>

                <div className="relative hidden overflow-hidden rounded-3xl border border-brand-soft/70 bg-white/80 shadow-lg md:block">
                  <Image
                    src="/dog_images2/pexels-krystian-beben-603997-1404727.jpg"
                    alt="Happy pup soaking up the sun after an InsightScoop visit"
                    fill
                    className="object-cover"
                    sizes="(min-width: 768px) 540px, 100vw"
                    priority
                  />
                  <div className="absolute top-4 left-4 right-4 rounded-2xl bg-white/85 px-4 py-2 text-xs font-semibold text-brand-ink shadow">
                    Quote locked in—kick off onboarding when you’re ready and we’ll get your yard glow-up on the schedule.
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {quickFacts.map((item, idx) => {
                    const detailLinesMarkup =
                      Array.isArray(item.detailLines) && item.detailLines.length > 0 ? (
                        <div className="space-y-2 pt-1">
                          {item.detailLines.map((line, lineIdx) => (
                            <div key={lineIdx} className="flex flex-col gap-1">
                              {line.showInitialCleanLabel ? (
                                <InitialCleanLabel className="text-emerald-200/80 md:text-[rgba(var(--graphite-rgb-commas),0.55)]" />
                              ) : null}
                              {line.valueLabel ? (
                                <span className="font-semibold text-emerald-50 md:text-brand-ink">
                                  {line.valueLabel}
                                </span>
                              ) : null}
                              {line.subLabel ? (
                                <span className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-emerald-100 md:text-[rgba(var(--graphite-rgb-commas),0.55)]">
                                  {line.subLabel}
                                </span>
                              ) : null}
                              {line.badge ? (
                                <span
                                  className={cn(
                                    quoteMutedBadgeClass,
                                    "px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.2em]",
                                    line.badgeTone === "discount"
                                      ? "bg-emerald-500/20 text-emerald-50 dark:bg-emerald-400/25"
                                      : undefined,
                                  )}
                                >
                                  {line.badge}
                                </span>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null;

                    return (
                      <div
                        key={idx}
                        className={cn(
                          quoteSurfaceClass,
                          "flex items-start gap-3 px-4 py-3 text-sm",
                          "md:border-slate-200 md:bg-slate-50",
                        )}
                      >
                        <item.icon
                          className="size-5 flex-none"
                          style={{ color: item.tone }}
                        />
                        <div className="flex-1">
                          <div className="font-semibold text-emerald-50 md:text-brand-ink">
                            {item.label}
                          </div>
                          {detailLinesMarkup ? (
                            <div className="space-y-2">{detailLinesMarkup}</div>
                          ) : (
                            <div className="text-xs text-emerald-200/75 md:text-[rgba(var(--graphite-rgb-commas),0.65)]">
                              {item.detail}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-4 pt-2">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      asChild
                      size="lg"
                      className="flex-1 rounded-2xl bg-emerald-400 text-slate-900 font-semibold text-base py-5 transition hover:bg-emerald-300 focus-visible:ring-emerald-200 disabled:opacity-60 md:bg-coral md:text-white md:hover:bg-coral/90 md:shadow-[0_18px_40px_rgba(243,100,91,0.28)]"
                    >
                      <Link href={onboardingUrl}>
                        {isCommercial
                          ? "Start onboarding with our team"
                          : "Start service & schedule"}
                        <ArrowRight className="size-4 ml-2" />
                      </Link>
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      size="lg"
                      className="flex-1 rounded-2xl border-emerald-400/40 bg-[#0f2d22] text-emerald-50 font-semibold text-base py-5 transition hover:border-emerald-300/60 hover:bg-[#134030] md:border-brand-soft md:bg-white md:text-brand-ink md:hover:bg-slate-50"
                    >
                      <Link href={emailQuoteUrl}>Email this quote for later</Link>
                    </Button>
                  </div>
                  <p className="text-xs text-emerald-200/75 md:text-[rgba(var(--graphite-rgb-commas),0.65)] max-w-2xl">
                    Once you begin onboarding we'll confirm your details, capture payment, and schedule that first visit at least a day out—no surprise same-day appointments.
                  </p>
                </div>

              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className={cn(quoteSuccessAccentCardClass, "p-0")}
              >
                <CardHeader className="space-y-1 border-b border-white/5 px-6 pb-4 pt-5 md:border-b-0 md:px-6 md:pt-6">
                  <CardTitle className="font-serif text-lg font-bold text-emerald-50 md:text-brand-ink">
                    What happens next
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 px-6 pb-6 text-sm text-emerald-100 md:text-brand-ink">
                  {nextSteps.map((step, idx) => (
                    <div key={idx} className="flex gap-3">
                      <div
                        className="mt-1 flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-200 md:bg-[rgba(236,188,96,0.18)] md:text-[rgba(20,92,69,1)]"
                      >
                        <step.icon className="size-5" />
                      </div>
                      <div className="space-y-1">
                        <div className="font-semibold text-emerald-50 md:text-brand-ink">
                          {idx + 1}. {step.title}
                        </div>
                        <p className="text-xs text-emerald-200/75 md:text-[rgba(var(--graphite-rgb-commas),0.65)]">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className={cn(quoteSuccessAccentCardClass, "p-0")}
              >
                <CardHeader className="space-y-1 border-b border-white/5 px-6 pb-4 pt-5 md:border-b-0 md:px-6 md:pt-6">
                  <CardTitle className="font-serif text-lg font-bold text-emerald-50 md:text-brand-ink">
                    Need a hand finishing up?
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 px-6 pb-6">
                  {contactActions.map((item, idx) => (
                    <a
                      key={idx}
                      href={item.href}
                      className="flex items-start gap-3 rounded-2xl border border-emerald-400/25 bg-[#132f24]/80 px-4 py-3 text-emerald-100 transition-transform duration-200 hover:-translate-y-0.5 md:border-slate-200 md:bg-white md:text-brand-ink"
                    >
                      <item.icon className="size-5 flex-none text-emerald-200 md:text-brand-deep" />
                      <div>
                        <div className="text-sm font-semibold text-emerald-50 md:text-brand-ink">
                          {item.label}
                        </div>
                        <div className="text-sm font-semibold text-emerald-200 md:text-brand-coral">
                          {item.value}
                        </div>
                        <div className="text-xs text-emerald-200/70 md:text-[rgba(var(--graphite-rgb-commas),0.6)]">
                          {item.description}
                        </div>
                      </div>
                    </a>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          {!isCommercial ? (
            <aside className="space-y-6">
              <Card className={cn(quoteSuccessAccentCardClass, "p-0")}
              >
                <CardHeader className="space-y-1 border-b border-white/5 px-6 pb-4 pt-5 md:border-b-0 md:px-6 md:pt-6">
                  <CardTitle className="flex items-center justify-between gap-3 font-serif text-lg font-bold text-emerald-50 md:text-brand-ink">
                    <span>Quote summary</span>
                    {frequencyMeta ? (
                      <span
                        className="text-xs font-semibold uppercase tracking-wide text-emerald-200 md:text-brand-muted"
                      >
                        {frequencyMeta.label}
                      </span>
                    ) : null}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 px-6 pb-6 text-sm text-emerald-100 md:text-brand-ink">
                  {!isOneTime ? (
                    <p className="text-xs text-emerald-200/85 md:text-[rgba(var(--graphite-rgb-commas),0.65)]">
                      Want to explore another cadence?{' '}
                      <Link
                        href={`/quote?resumeAtStep=frequency&resume=1`}
                        className="underline text-emerald-100 transition hover:text-emerald-200 md:text-brand-coral md:hover:text-brand-ink"
                      >
                        Adjust your frequency
                      </Link>
                      .
                    </p>
                  ) : null}

                  {trialWeekPresentation ? (
                    <div className="space-y-6">
                      <FirstWeekCreditBanner
                        amount={formatCurrency(trialWeekPresentation.totalValueCents)}
                        netAmount={formatCurrency(trialWeekPresentation.netDueCents)}
                        subtext={trialBannerSubtext}
                        className="text-left"
                        tone="dark"
                      />

                      <section className="space-y-4">
                        <div className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-emerald-200/70 md:text-[rgba(var(--graphite-rgb-commas),0.5)]">
                          Free trial week
                        </div>
                        <div className="space-y-2">
                          {trialWeekPresentation.charges.map((item) => {
                            const labelNode = item.key === "initial-clean"
                              ? (
                                <InitialCleanLabel
                                  label={item.label}
                                  className="inline-flex items-center gap-1 text-emerald-50 md:text-brand-ink"
                                  iconClassName="text-emerald-200/70 md:text-[rgba(var(--graphite-rgb-commas),0.55)]"
                                />
                              )
                              : item.label;

                            return (
                              <div
                                key={`trial-charge-${item.key}`}
                                className="flex items-center justify-between"
                              >
                                <span>{labelNode}</span>
                                <span className="font-semibold">
                                  {formatCurrency(item.amountCents)}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {trialWeekPresentation.credits.length ? (
                          <div className="space-y-2 border-t border-emerald-400/25 pt-2 md:border-[rgba(var(--graphite-rgb-commas),0.12)]">
                            {trialWeekPresentation.credits.map((item) => (
                              <div
                                key={`trial-credit-${item.key}`}
                                className="flex items-center justify-between text-brand-coral"
                              >
                                <span>{item.label}</span>
                                <span className="font-semibold">
                                  -{formatCurrency(item.amountCents)}
                                </span>
                              </div>
                            ))}
                          <div className="flex items-center justify-between text-brand-ink">
                            <span className="font-medium">Trial week total</span>
                            <span className="font-serif text-2xl font-black text-emerald-500 md:text-brand-ink">
                              {formatCurrency(trialWeekPresentation.netDueCents)}
                            </span>
                            </div>
                          </div>
                        ) : null}

                        {trialWeekPresentation.descriptor ? (
                          <p className="text-xs text-emerald-200/70 md:text-[rgba(var(--graphite-rgb-commas),0.6)]">
                            {trialWeekPresentation.descriptor}
                          </p>
                        ) : null}
                      </section>

                      <section className="space-y-4 border-t border-emerald-400/25 pt-4 md:border-[rgba(var(--graphite-rgb-commas),0.12)]">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-emerald-200/70 md:text-[rgba(var(--graphite-rgb-commas),0.5)]">
                            After the trial
                          </span>
                          {postTrialHeaderNote ? (
                            <span className="text-xs text-emerald-200/70 md:text-[rgba(var(--graphite-rgb-commas),0.6)]">
                              {postTrialHeaderNote}
                            </span>
                          ) : null}
                        </div>

                        <div className="space-y-4">
                          {perVisitAvailable ? (
                            <>
                              <div className="inline-flex rounded-full border border-emerald-400/35 bg-[#103628] p-1 text-xs font-semibold text-emerald-50 md:border-slate-200 md:bg-white md:text-brand-ink">
                                <button
                                  type="button"
                                  className={`px-4 py-1.5 rounded-full transition-colors ${
                                    billingView === 'monthly'
                                      ? 'bg-emerald-400 text-slate-900 shadow md:bg-brand-coral md:text-white'
                                      : 'bg-transparent hover:bg-emerald-500/10 md:hover:bg-white/70'
                                  }`}
                                  onClick={() => setBillingView('monthly')}
                                >
                                  Monthly plan
                                </button>
                                <button
                                  type="button"
                                  className={`px-4 py-1.5 rounded-full transition-colors ${
                                    billingView === 'per-visit'
                                    ? 'bg-emerald-400 text-slate-900 shadow md:bg-brand-coral md:text-white'
                                    : 'bg-transparent hover:bg-emerald-500/10 md:hover:bg-white/70'
                                  }`}
                                  onClick={() => setBillingView('per-visit')}
                                >
                                  {perVisitToggleLabel}
                                </button>
                              </div>

                              {billingView === 'per-visit' ? perVisitCard : null}

                              {billingView === 'monthly' ? monthlyCard : null}
                            </>
                          ) : (
                            monthlyCard
                          )}
                        </div>
                      </section>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200/60 md:text-[rgba(var(--graphite-rgb-commas),0.5)]">
                          One-time visit
                        </span>
                        <span className="font-serif text-2xl font-black text-emerald-50 md:text-brand-ink">
                          {formatCurrency(toCents(pricing?.oneTime))}
                        </span>
                      </div>
                      <p className="text-xs text-emerald-200/70 md:text-[rgba(var(--graphite-rgb-commas),0.6)]">
                        We save your card securely and invoice after the cleanup wraps so you only pay once the visit is complete.
                      </p>
                    </div>
                  )}

                </CardContent>




              </Card>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
    );
  }

  return page;
}

export default function QuoteSuccessPage() {
  return (
    <Suspense fallback={<SpinningLoader />}>
      <QuoteSuccessContent />
    </Suspense>
  );
}
