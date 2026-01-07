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
  HeartPulse,
  Info,
  Mail,
  MailCheck,
  MailWarning,
  MapPin,
  Phone,
  RotateCcw,
  ShieldAlert,
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
} from "@/components/quote/quoteStyles";
import { brandColors, withAlpha } from "@/shared/brand";
import { cn, formatVisitsRange, getVisitsBounds } from "@/lib/utils";
import { computeIntroCredits, summarizeIntroCredits } from "@/lib/billing/introCredits";
import type { PricingData } from "@/types/quote";
import {
  derivePostTrialPresentation,
  deriveTrialWeekPresentation,
  describeFirstWeekCoverage,
} from "@/lib/pricing-presentation";
import { extractWeekendUpgrade } from "@/lib/pricing/weekend";
import { FirstWeekCreditBanner } from "@/components/quote/components/FirstWeekCreditBanner";

type QuotePricing = {
  perVisit?: number | null;
  monthly?: number | null;
  amountDueToday?: number | null;
  firstVisitTotalCents?: number | null;
  firstMonthCents?: number | null;
  initialCleanDiscount?: number | null;
  initialCleanCents?: number | null;
  firstVisitAddOnsTotal?: number | null;
  firstMonthVisits?: number | null;
  visitsPerMonth?: number | null;
  fullMonthlyAmount?: number | null;
  oneTime?: number | null;
  metadata?: {
    billingPreference?: string | null;
    [key: string]: unknown;
  } | null;
  trialWeek?: PricingData["trialWeek"];
  postTrial?: PricingData["postTrial"];
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
  pricing?: QuotePricing | null;
  pricingBreakdown?: QuotePricing | string | null;
};

const YARD_SIZE_LABELS: Record<string, string> = {
  small: "Small yard (≤ 2,500 sq ft)",
  medium: "Medium yard (2,500 – 5,000 sq ft)",
  large: "Large yard (5,000 – 10,000 sq ft)",
  xl: "Estate yard (10,000+ sq ft)",
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

const RANGE_NOTE_COPY =
  "Range depends on how many service days land in a calendar month—for example, weekly plans sometimes include a fifth visit.";

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

const Loader = ({ message }: { message: string }) => (
  <div className={cn("quote-success-theme", quoteSuccessShellClass, "flex items-center justify-center")}
    aria-live="polite"
  >
    <div className="flex flex-col items-center gap-4 text-emerald-200/75 md:text-[rgba(var(--graphite-rgb-commas),0.7)]">
      <div
        className="h-12 w-12 rounded-full border-2 border-emerald-500/25 bg-transparent animate-spin"
        style={{ borderTopColor: brandColors.coral }}
      />
      <p className="text-sm font-semibold tracking-wide uppercase">{message}</p>
    </div>
  </div>
);

function QuoteSentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const previewMode = (searchParams?.get("preview") ?? "") === "1";

  const [quote, setQuote] = useState<QuoteLead | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [emailDelivered, setEmailDelivered] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(!previewMode);
  const [isLoadingQuote, setIsLoadingQuote] = useState(true);

  const areas = useMemo(() => buildAreasList(quote?.areasToClean), [
    quote?.areasToClean,
  ]);
  const addOns = useMemo(() => (quote ? buildAddOnsList(quote) : []), [quote]);

  const leadId = searchParams?.get("leadId") ?? "";
  const businessId =
    searchParams?.get("businessId") ||
    searchParams?.get("org") ||
    searchParams?.get("tenant") ||
    searchParams?.get("tenantId") ||
    "yardura";

  const isCommercialParam = (searchParams?.get("commercial") ?? "") === "true";
  const rawBillingPreference = (searchParams?.get("billingPreference") ?? "").toLowerCase();
  const billingPreferenceParam =
    rawBillingPreference === "weekly"
      ? "weekly"
      : rawBillingPreference === "per-visit" || rawBillingPreference === "pervisit"
        ? "weekly"
        : rawBillingPreference === "monthly"
          ? "monthly"
          : null;

  const fetchQuote = useCallback(async () => {
    if (!leadId) return;
    setIsLoadingQuote(true);
    try {
      const response = await fetch(`/api/leads/${leadId}?includePricing=1`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("We couldn't retrieve the quote details.");
      }
      const data: QuoteLead = await response.json();
      setQuote(data);
    } catch (error) {
      console.error("Failed to load quote summary", error);
    } finally {
      setIsLoadingQuote(false);
    }
  }, [leadId]);

  const sendQuoteEmail = useCallback(
    async (preference?: "monthly" | "weekly") => {
      if (!leadId) return;
      setIsSending(true);
      setErrorMessage(null);
      try {
        const requestBody: Record<string, unknown> = { businessId };
        if (preference) {
          requestBody.billingPreference = preference;
        }
      const response = await fetch(`/api/leads/${leadId}/send-quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
          throw new Error(
            data?.error || "We couldn't send the quote email just yet."
          );
      }

        const payload = await response.json().catch(() => ({}));
        const emailEnabled = payload?.emailEnabled !== false;
        const delivered = emailEnabled && Boolean(payload?.emailId);

      setEmailSent(true);
        setEmailEnabled(emailEnabled);
        setEmailDelivered(delivered);

        if (typeof payload?.message === "string") {
          setStatusMessage(payload.message);
        } else if (!delivered) {
          setStatusMessage(
            emailEnabled
              ? "Quote saved. We're still sending the email—feel free to refresh in a bit."
              : "Quote saved, but automatic email delivery is off. Copy the link below to keep your records."
          );
        } else {
          setStatusMessage(null);
        }
    } catch (error) {
        console.error("Error sending quote email", error);
        setEmailSent(false);
        setEmailEnabled(true);
        setEmailDelivered(false);
      setErrorMessage(
        error instanceof Error
          ? error.message
            : "Unexpected error sending the quote email."
      );
    } finally {
        setIsSending(false);
      }
    },
    [leadId, businessId],
  );

  const pricing = useMemo(() => {
    if (quote?.pricing && typeof quote.pricing === "object") {
      return quote.pricing;
    }

    if (!quote?.pricingBreakdown) {
      return null;
    }

    try {
      if (typeof quote.pricingBreakdown === "string") {
        const parsed = JSON.parse(quote.pricingBreakdown) as QuotePricing;
        return parsed ?? null;
      }
      if (typeof quote.pricingBreakdown === "object") {
        return quote.pricingBreakdown as QuotePricing;
      }
    } catch (error) {
      console.warn("Unable to parse quote pricing breakdown", error);
    }

    return null;
  }, [quote?.pricing, quote?.pricingBreakdown]);
  const isCommercial = isCommercialParam || quote?.serviceType === "commercial";
  const frequencyKey = (quote?.frequency ?? "").toLowerCase();
  const normalizedFrequency = frequencyKey;
  const isOneTime = frequencyKey === "onetime";
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

  const perVisitAvailable =
    !isCommercial &&
    typeof pricing?.perVisit === "number" &&
    ["weekly", "biweekly", "twice-weekly", "daily"].includes(frequencyKey);

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

  const [billingView, setBillingView] = useState<"monthly" | "per-visit">(
    perVisitAvailable ? "per-visit" : "monthly",
  );
  const billingInitializedRef = useRef(false);

  useEffect(() => {
    if (!quote?.id) {
      billingInitializedRef.current = false;
    }
  }, [quote?.id]);

  useEffect(() => {
    if (!quote || billingInitializedRef.current) {
      return;
    }

    const metadataPreference =
      typeof pricing?.metadata?.billingPreference === "string"
        ? pricing.metadata.billingPreference.toLowerCase()
        : null;

    const targetPreference = billingPreferenceParam ?? metadataPreference;

    let desiredView: "monthly" | "per-visit" = "monthly";
    if (perVisitAvailable) {
      if (targetPreference === "monthly") {
        desiredView = "monthly";
      } else if (targetPreference === "weekly") {
        desiredView = "per-visit";
      } else {
        desiredView = "per-visit";
      }
    }

    setBillingView(desiredView);

    billingInitializedRef.current = true;
  }, [
    quote,
    perVisitAvailable,
    billingPreferenceParam,
    pricing?.metadata?.billingPreference,
  ]);

  useEffect(() => {
    if (!perVisitAvailable && billingView !== "monthly") {
      setBillingView("monthly");
    }
  }, [perVisitAvailable, billingView]);

  const toCents = (value?: number | null) =>
    typeof value === "number" && Number.isFinite(value) ? value : 0;

  const perVisitAmountCents = perVisitAvailable ? toCents(pricing?.perVisit) : 0;
  const skipCreditDisplay = perVisitAmountCents > 0 ? formatCurrency(perVisitAmountCents) : "$0.00";
  const usesSkipCreditForPerVisit =
    normalizedFrequency === "twice-weekly" || normalizedFrequency === "daily";
  const perVisitSkipCopy = usesSkipCreditForPerVisit
    ? `Skip or cancel a visit and we drop a ${skipCreditDisplay} credit automatically.`
    : "Skip or cancel a visit and there's no charge.";

  const activationDelayDays = postTrialPresentation?.activationDelayDays
    ?? trialWeekPresentation?.trialLengthDays
    ?? (isOneTime
      ? 0
      : frequencyKey === "biweekly"
        ? 14
        : 7);

  const activationDelayCopy = (() => {
    if (isOneTime) {
      return "We invoice once the visit is complete.";
    }
    const startWindow = activationDelayDays === 14 ? "two weeks" : "one week";
    if (frequencyKey === "monthly") {
      return `Flat monthly billing begins ${startWindow} after your kickoff visit.`;
    }
    if (frequencyKey === "twice-weekly" || frequencyKey === "daily") {
      return `Weekly billing begins ${startWindow} after your kickoff visit.`;
    }
    if (frequencyKey === "biweekly" || frequencyKey === "bi-weekly" || frequencyKey === "every-other-week") {
      return `Every-other-week billing begins ${startWindow} after your kickoff visit.`;
    }
    return `Per-visit billing begins ${startWindow} after your kickoff visit.`;
  })();
  const activationPhrase = activationDelayDays === 14
    ? "two weeks after your kickoff visit"
    : "one week after your kickoff visit";
  const postTrialHeaderNote = isOneTime
    ? null
    : `Billing begins ${activationPhrase}. Choose how you'd like to be billed below.`;

  const perVisitAfterTrialCents = postTrialPresentation?.perVisitCents
    ?? (typeof pricing?.perVisit === "number" ? pricing.perVisit : null);

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

  const monthlyPlanCents =
    typeof pricing?.fullMonthlyAmount === "number"
      ? pricing.fullMonthlyAmount
      : typeof pricing?.monthly === "number"
        ? pricing.monthly
        : null;

  const perVisitPrimaryAmountCents = useMemo(() => {
    if (frequencyKey === "twice-weekly") {
      return perVisitAmountCents * 2;
    }
    if (frequencyKey === "daily") {
      const visitsPerWeek = weekendUpgradeEnabled ? 7 : 5;
      return perVisitAmountCents * visitsPerWeek;
    }
    return perVisitAmountCents;
  }, [perVisitAmountCents, frequencyKey, weekendUpgradeEnabled]);

  const perVisitPrimaryDisplayCents =
    perVisitPrimaryAmountCents > 0 ? perVisitPrimaryAmountCents : perVisitAmountCents;

  const perVisitPrimaryLabel = useMemo(() => {
    switch (frequencyKey) {
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
  }, [frequencyKey, weekendUpgradeEnabled]);

  const perVisitPrimaryDescription = useMemo(() => {
    switch (frequencyKey) {
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
  }, [frequencyKey, weekendUpgradeEnabled]);

  const firstVisitAddOnsCents = toCents(pricing?.firstVisitAddOnsTotal);

  const rawInitialCleanSubtotalCents =
    typeof pricing?.initialCleanCents === "number"
      ? pricing.initialCleanCents
      : typeof pricing?.firstVisitTotalCents === "number"
        ? Math.max(0, pricing.firstVisitTotalCents - firstVisitAddOnsCents)
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
    !isOneTime && frequencyKey !== "monthly" && frequencyKey !== "onetime";

  const discountedInitialCleanCents = includesInitialCleanCredit
    ? 0
    : Math.max(0, initialCleanSubtotalCents - normalizedInitialCleanDiscountCents);

  const freeFollowUpVisits =
    frequencyKey === "twice-weekly"
      ? 1
      : frequencyKey === "daily"
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

  const initialValueLabelCents =
    freeFollowUpVisits > 0
      ? initialCleanSubtotalCents + perVisitAmountCents * freeFollowUpVisits
      : initialCleanSubtotalCents;

  const followUpValueCents = perVisitAmountCents * freeFollowUpVisits;

  const hasInitialCleanCredit = includesInitialCleanCredit;

  const initialCleanCreditCents = includesInitialCleanCredit
    ? initialCleanSubtotalCents
    : frequencyKey === "monthly" && normalizedInitialCleanDiscountCents > 0
      ? normalizedInitialCleanDiscountCents
      : 0;

  const followUpCreditCents = perVisitAmountCents * freeFollowUpVisits;

  const initialVisitCreditCount = includesInitialCleanCredit ? 1 : 0;
  const totalFreeVisitCredits = initialVisitCreditCount + freeFollowUpVisits;

  const hasInitialCleanDiscount =
    normalizedInitialCleanDiscountCents > 0 && frequencyKey === "monthly";

  const initialCleanStatusLabel = (() => {
    if (initialValueLabelCents <= 0 || isOneTime) {
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

  const initialVisitTotalCents =
    typeof pricing?.firstVisitTotalCents === "number" && pricing.firstVisitTotalCents > 0
      ? pricing.firstVisitTotalCents
      : discountedInitialCleanCents + firstVisitAddOnsCents;

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
      pricingData?.weekendVisitsPerMonth ?? (pricing as any)?.weekendVisitsPerMonth,
    );
    const base = parseVisits(pricing?.visitsPerMonth ?? pricingData?.visitsPerMonth);

    if (weekendUpgradeEnabled && weekend) {
      return weekend;
    }

    return base;
  }, [pricing, pricingData, weekendUpgradeEnabled]);
  const visitsBounds = getVisitsBounds(visitsPerMonthValue ?? undefined);
  const visitsPerMonthRange = formatVisitsRange(visitsPerMonthValue ?? undefined);
  const hasVisitRange = Boolean(visitsBounds && visitsBounds.min !== visitsBounds.max);
  const approxVisitsLabelBase = visitsPerMonthRange
    ? `Typically ${visitsPerMonthRange}`
    : null;
  const approxVisitsSecondary = null;
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
    switch (frequencyKey) {
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
    frequencyKey === "daily" ? totalFreeVisitCredits : initialVisitCreditCount;
  const firstWeekRemainingVisitCount = Math.max(
    scheduledFirstWeekVisits - Math.min(scheduledFirstWeekVisits, firstWeekFreeVisitCredits),
    0,
  );

  const firstWeekRemainingLabel = (() => {
    if (scheduledFirstWeekVisits <= 0) return null;
    return `Remaining first week visits ${firstWeekRemainingVisitCount}`;
  })();

  const oneTimeDueTodayCents = useMemo(() => {
    if (!isOneTime) {
      return 0;
    }
    if (initialVisitTotalCents > 0) {
      return initialVisitTotalCents;
    }
    if (typeof pricing?.amountDueToday === "number") {
      return pricing.amountDueToday;
    }
    if (typeof pricing?.oneTime === "number") {
      return pricing.oneTime;
    }
    return 0;
  }, [
    isOneTime,
    initialVisitTotalCents,
    pricing?.amountDueToday,
    pricing?.oneTime,
  ]);

  const resolvedBillingPreference: "monthly" | "weekly" =
    perVisitAvailable && billingView === "per-visit" ? "weekly" : "monthly";

  const averageMonthlyCents = useMemo(() => {
    if (estimatedMonthlyCents !== null) {
      return Math.round(estimatedMonthlyCents);
    }
    if (effectiveMonthlyPlanCents) {
      return effectiveMonthlyPlanCents;
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
    perVisitAmountCents,
    estimatedMonthlyRangeCents,
    visitsBounds,
    visitsPerMonthValue,
  ]);

  const showRangeNote = hasVisitRange && resolvedBillingPreference === "monthly";
const approxVisitsLabel = useMemo(
  () =>
    approxVisitsLabelBase ? `${approxVisitsLabelBase}${showRangeNote ? "*" : ""}` : null,
  [approxVisitsLabelBase, showRangeNote],
);
const showMonthlyVisitRange = !isOneTime && billingView === "monthly" && Boolean(approxVisitsLabelBase);

  const monthlyHeadline = useMemo(() => {
    if (isOneTime) {
      return formatCurrency(oneTimeDueTodayCents);
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
      const average = Math.round((roundedMin + roundedMax) / 2);
      const display = formatCurrencyCompact(average);
      const prefix = `~${display}`;
      return showRangeNote ? `${prefix}*` : prefix;
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
    estimatedMonthlyCents,
    estimatedMonthlyRangeCents,
    isOneTime,
    oneTimeDueTodayCents,
    perVisitAmountCents,
    showRangeNote,
    visitsBounds,
  ]);

  const introCreditPlan = useMemo(
    () =>
      computeIntroCredits({
        normalizedFrequency: frequencyKey,
        initialCleanCents: initialCleanSubtotalCents,
        perVisitCents: perVisitAmountCents,
      }),
    [frequencyKey, initialCleanSubtotalCents, perVisitAmountCents],
  );

  const { summary: introCreditSummary } = useMemo(
    () => summarizeIntroCredits(introCreditPlan),
    [introCreditPlan],
  );

  const promoSummaryMessage =
    introCreditSummary ?? "Promo credits apply automatically to your kickoff visits.";

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
        const average = Math.round(
          (estimatedMonthlyRangeCents.min + estimatedMonthlyRangeCents.max) / 2,
        );
        const display = formatCurrencyCompact(Math.round(average / 100) * 100);
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

    if (resolvedBillingPreference === "weekly") {
      const perVisitLabel = perVisitAmountCents > 0 ? formatCurrency(perVisitAmountCents) : null;
      if (frequencyKey === "twice-weekly") {
        const weeklyChargeLabel = perVisitPrimaryAmountCents > 0
          ? formatCurrency(perVisitPrimaryAmountCents)
          : null;
        if (weeklyChargeLabel && perVisitLabel) {
          return `Following the initial clean, we tally each service week and run your weekly charge of ${weeklyChargeLabel} (2 visits at ${perVisitLabel} each) after both visits wrap.`;
        }
        return "Following the initial clean, we tally each service week and run your weekly charge after both visits wrap.";
      }
      if (frequencyKey === "daily") {
        const weeklyChargeLabel = perVisitPrimaryAmountCents > 0
          ? formatCurrency(perVisitPrimaryAmountCents)
          : null;
        if (weeklyChargeLabel && perVisitLabel) {
          const visitCount = weekendUpgradeEnabled ? 7 : 5;
          const descriptor = weekendUpgradeEnabled ? "daily" : "weekday";
          return `Following the initial clean, we tally ${descriptor} visits each service week and run your weekly charge of ${weeklyChargeLabel} (${visitCount} visits at ${perVisitLabel} each) once the week wraps.`;
        }
        const descriptor = weekendUpgradeEnabled ? "daily" : "weekday";
        return `Following the initial clean, we tally ${descriptor} visits each service week and run your weekly charge once the week wraps.`;
      }
      if (
        frequencyKey === "weekly" ||
        frequencyKey === "biweekly" ||
        frequencyKey === "bi-weekly" ||
        frequencyKey === "every-other-week"
      ) {
        if (perVisitLabel) {
          return `Following the initial clean, we run the charge the day after each completed visit at ${perVisitLabel} per visit.`;
        }
        return "Following the initial clean, we run the charge the day after each completed visit.";
      }
      return "Following the initial clean, we run the charge after each completed visit.";
    }

    if (visitsPerMonthRange) {
      if (monthlyAmountDescription) {
        return `Following the initial clean, we tally the month's completed visits (${visitsPerMonthRange}) and bill ${monthlyAmountDescription} once each month.`;
      }
      return `Following the initial clean, we tally the month's completed visits (${visitsPerMonthRange}) and bill once each month.`;
    }

    if (monthlyAmountDescription) {
      return `Following the initial clean, we tally the month's completed visits and bill ${monthlyAmountDescription} once each month.`;
    }

    return "Following the initial clean, we tally the month's completed visits and bill once each month.";
  }, [
    perVisitAmountCents,
    perVisitPrimaryAmountCents,
    estimatedMonthlyCents,
    estimatedMonthlyRangeCents,
    frequencyKey,
    isOneTime,
    effectiveMonthlyPlanCents,
    resolvedBillingPreference,
    visitsBounds,
    visitsPerMonthRange,
  ]);

  const billingNarrative = billingTimingSentence;

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

  const freeVisitSummary = (() => {
    if (normalizedFrequency === "twice-weekly") {
      return "Initial clean and first follow-up visit";
    }
    if (normalizedFrequency === "daily" && freeFollowUpVisits > 0) {
      const visitWord = spellOutVisitCount(freeFollowUpVisits);
      const visitLabel = freeFollowUpVisits === 1 ? "visit" : "visits";
      const descriptor = weekendUpgradeEnabled ? "daily" : "weekday";
      return `Initial clean and ${visitWord} ${descriptor} ${visitLabel}`;
    }
    return null;
  })();

  const initialValueSubLabel = freeVisitSummary ?? undefined;
  const initialRowSubLabel = (freeVisitSummary && (normalizedFrequency === "twice-weekly" || normalizedFrequency === "daily"))
    ? undefined
    : initialValueSubLabel;

  const coverageCreditLabel = (() => {
    if (freeFollowUpVisits <= 0) return null;
    return "First week coverage credit";
  })();

  const combinedFirstWeekCreditsLabel = "First week coverage credit";

  const showCombinedFirstWeekCredits =
    hasInitialCleanCredit && followUpCreditCents > 0;

  const totalCreditCents = initialCleanCreditCents + followUpCreditCents;

  const creditRowLabel = (() => {
    if (normalizedFrequency === "monthly" && normalizedInitialCleanDiscountCents > 0) {
      return "Initial clean discount";
    }
    if (showCombinedFirstWeekCredits) {
      return combinedFirstWeekCreditsLabel;
    }
    if (freeFollowUpVisits > 0) {
      return coverageCreditLabel ?? "First week coverage credit";
    }
    if (hasInitialCleanCredit) {
      return "Initial clean credit";
    }
    return "Intro credit";
  })();

  const perVisitToggleLabel =
    frequencyKey === "twice-weekly" || frequencyKey === "daily"
      ? "Weekly billing"
      : "Pay per visit";

  const perVisitHeading =
    frequencyKey === "twice-weekly"
      ? "Weekly plan"
      : frequencyKey === "daily"
        ? "Daily service plan"
        : "Per-visit plan";

  const perVisitCard = (
    <div className="space-y-3 rounded-2xl border border-emerald-400/30 bg-[#102f22]/85 px-4 py-4 text-emerald-200/85 md:border-slate-200 md:bg-white md:text-[rgba(var(--graphite-rgb-commas),0.78)]">
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
        {approxVisitsLabelBase ? (
          <span className="text-xs text-emerald-200/70 md:text-[rgba(var(--graphite-rgb-commas),0.6)]">
            {approxVisitsLabelBase}
          </span>
        ) : null}
      </div>
      <p className="text-xs leading-relaxed text-emerald-200/80 md:text-[rgba(var(--graphite-rgb-commas),0.65)]">
        Billing starts {activationPhrase}. {perVisitPrimaryDescription} {perVisitSkipCopy}
      </p>
    </div>
  );

  const monthlyCard = (
    <div className="space-y-3 rounded-2xl border border-emerald-400/30 bg-[#102f22]/85 px-4 py-4 text-emerald-200/85 md:border-slate-200 md:bg-white md:text-[rgba(var(--graphite-rgb-commas),0.78)]">
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
        {approxVisitsLabelBase ? (
          <span className="text-xs text-emerald-200/70 md:text-[rgba(var(--graphite-rgb-commas),0.6)]">
            {approxVisitsLabelBase}
          </span>
        ) : null}
      </div>
      <p className="text-xs leading-relaxed text-emerald-200/80 md:text-[rgba(var(--graphite-rgb-commas),0.65)]">
        We invoice every 30 days beginning {activationPhrase}. Skip or cancel a visit and we apply a {skipCreditDisplay} credit before the next statement.
      </p>
    </div>
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      sessionStorage.setItem("billingPreference", resolvedBillingPreference);
    } catch (storageError) {
      console.warn("Unable to persist billing preference for onboarding", storageError);
    }
  }, [resolvedBillingPreference]);

  const onboardingSearch = new URLSearchParams({ leadId });
  if (businessId) onboardingSearch.set("businessId", businessId);
  if (isCommercialParam) onboardingSearch.set("commercial", "true");
  onboardingSearch.set("billingPreference", resolvedBillingPreference);
  const onboardingUrl = `/onboarding/start?${onboardingSearch.toString()}`;

  useEffect(() => {
    if (!leadId) {
      router.replace(`/quote?businessId=${businessId}`);
      return;
    }
    void fetchQuote();
    if (!previewMode) {
      void sendQuoteEmail(billingPreferenceParam ?? undefined);
    } else {
      setIsSending(false);
    }
  }, [
    leadId,
    businessId,
    billingPreferenceParam,
    fetchQuote,
    sendQuoteEmail,
    router,
    previewMode,
  ]);

  if (!leadId) {
    return <Loader message="Redirecting" />;
  }

  if (isSending || (isLoadingQuote && !quote)) {
    return <Loader message="Sending your quote" />;
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-16">
        <Card className="max-w-lg w-full rounded-3xl border border-brand-soft shadow-[0_24px_60px_rgba(27,30,35,0.08)]">
          <CardHeader className="text-center space-y-4">
            <div
              className="mx-auto h-16 w-16 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: withAlpha(brandColors.coral, 0.14),
                color: brandColors.coralInk,
              }}
            >
              <ShieldAlert className="size-8" />
            </div>
            <CardTitle className="font-serif text-2xl font-bold text-emerald-50 md:text-brand-ink">
              We couldn't deliver the quote email
            </CardTitle>
            <p className="text-sm text-emerald-200/75 md:text-[rgba(var(--graphite-rgb-commas),0.7)]">
              {errorMessage}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full rounded-xl bg-brand-coral text-cream-soft font-semibold hover:bg-brand-coral/95"
              onClick={() => {
                void sendQuoteEmail(billingPreferenceParam ?? undefined);
              }}
            >
              Try again
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full rounded-xl border-brand-soft text-emerald-50 md:text-brand-ink hover:bg-slate-50"
            >
              <Link href={`/quote?businessId=${businessId}`}>Back to quote</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const dogsCopy =
    typeof quote?.dogs === "number"
      ? `${quote.dogs} ${quote.dogs === 1 ? "pup" : "pups"}`
      : "Not specified";
  const yardCopy = quote?.yardSize
    ? YARD_SIZE_LABELS[quote.yardSize] ?? toTitle(quote.yardSize)
    : "Details to confirm";
  const cityCopy = quote?.city
    ? `${quote.city}${quote.state ? `, ${quote.state}` : ""}`
    : "Minnesota service area";
  const quoteReference = quote?.id?.slice(-8).toUpperCase();

  const successTitle = emailDelivered
    ? "Quote sent!"
    : emailEnabled
      ? "Quote on the way"
      : "Quote saved";
  const successCopy = (() => {
    if (emailDelivered) {
      return isOneTime
        ? "We just sent your one-time clean details—review the pricing and reply with your preferred date to confirm."
        : "We just sent the full quote to your inbox—take a look for pricing, scheduling options, and links to finish setup.";
    }
    if (emailEnabled) {
      return isOneTime
        ? "Your one-time quote is on its way. It can take a minute or two—reply once it arrives and we'll coordinate your visit."
        : "Your quote is on its way. It can take a minute or two, so keep an eye on your inbox and spam folder just in case.";
    }
    return isOneTime
      ? "Your one-time quote is saved here. Download, copy the link, or call us when you're ready to schedule."
      : "Your quote is saved here. Download, copy the link, or contact us if you need another copy emailed.";
  })();

  const initialCleanHighlightDetail: string[] = [];
  if (initialValueLabelCents > 0) {
    initialCleanHighlightDetail.push(formatCurrency(initialValueLabelCents));
    if (freeFollowUpVisits > 0) {
      initialCleanHighlightDetail.push(
        frequencyKey === "twice-weekly"
          ? "Initial clean + follow-up"
          : `Initial clean + ${spellOutVisitCount(freeFollowUpVisits)} ${weekendUpgradeEnabled ? "daily" : "weekday"} ${freeFollowUpVisits === 1 ? "visit" : "visits"}`,
      );
    } else if (!isOneTime) {
      initialCleanHighlightDetail.push("Included with plan");
    }
    if (!isOneTime && initialCleanStatusLabel) {
      initialCleanHighlightDetail.push(initialCleanStatusLabel.label);
    } else if (!isOneTime && hasInitialCleanCredit) {
      initialCleanHighlightDetail.push("FREE");
    }
  }

  const initialHighlightLabel =
    freeFollowUpVisits > 0 ? "First week coverage" : "Initial clean";

  const initialCleanHighlight =
    initialValueLabelCents > 0
      ? {
          icon: Sparkles,
          label: initialHighlightLabel,
          detail: initialCleanHighlightDetail.join(" • ") || "Included with your plan",
          tone: brandColors.coral,
        }
      : null;

  const followUpHighlight = (() => {
    if (frequencyKey === "twice-weekly" && perVisitAmountCents > 0) {
      return {
        icon: CalendarCheck,
        label: "Follow-up visit",
        detail: `${formatCurrency(perVisitAmountCents)} • Covered by kickoff credit`,
        tone: brandColors.evergreen,
      } as const;
    }
    if (frequencyKey === "daily" && perVisitAmountCents > 0 && freeFollowUpVisits > 0) {
      const label = weekendUpgradeEnabled ? "Daily coverage credits" : "Weekday credits";
      const visitLabel = freeFollowUpVisits === 1 ? "visit" : "visits";
      const descriptor = weekendUpgradeEnabled ? "Mon–Sun" : "Mon–Fri";
      return {
        icon: CalendarCheck,
        label,
        detail: `${formatCurrency(perVisitAmountCents)} × ${freeFollowUpVisits} ${visitLabel} • First service week covered (${descriptor})`,
        tone: brandColors.sunset,
      } as const;
    }
    return null;
  })();

  const wellnessHighlight = {
    icon: HeartPulse,
    label: "First year of wellness insights",
    detail: "Normally $19.99/mo (~$240/year) — free when you launch by 4/30/2026.",
    tone: brandColors.coralInk,
  } as const;

  const heroHighlights = [
    ...(initialCleanHighlight ? [initialCleanHighlight] : []),
    ...(followUpHighlight ? [followUpHighlight] : []),
    wellnessHighlight,
  ];

  return (
    <div className={cn("quote-success-theme", quoteSuccessShellClass)}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pb-24 pt-24 md:px-6 md:pb-32 md:pt-28 lg:pt-32">
        <div className="grid gap-10 lg:grid-cols-[1.2fr,0.9fr]">
          <div className="space-y-8">
            <section className={cn(quoteSuccessPanelClass, "p-6 sm:p-8 lg:p-10 space-y-6")}
            >
              <div className="flex items-start gap-4">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-200 md:bg-[rgba(236,188,96,0.2)] md:text-[rgba(20,92,69,1)]"
                >
                  {emailDelivered ? (
                    <MailCheck className="size-7" />
                  ) : (
                    <MailWarning className="size-7" />
                  )}
                </div>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-50 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-50"
                      style={{
                        backgroundColor: withAlpha(brandColors.coral, 0.14),
                        color: brandColors.coralInk,
                        border: `1px solid ${withAlpha(brandColors.coral, 0.26)}`,
                      }}
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
                  </div>
                  <h1 className="font-serif text-3xl font-black leading-[1.05] text-emerald-50 md:text-4xl md:text-brand-ink">
                    {successTitle}
                  </h1>
                  <p className="text-sm leading-relaxed text-emerald-200/80 md:text-lg md:text-[rgba(var(--graphite-rgb-commas),0.78)] md:max-w-2xl">
                    {successCopy}
                  </p>
                  {statusMessage ? (
                    <div
                      className="rounded-2xl border border-emerald-400/30 bg-[#102f22]/85 px-4 py-3 text-sm text-emerald-200/75 md:border-dashed md:border-slate-200 md:bg-white md:text-[rgba(var(--graphite-rgb-commas),0.7)]"
                    >
                      {statusMessage}
                    </div>
                  ) : null}
                </div>
            </div>

            <div className="mt-8 space-y-4">
              <div className="relative hidden overflow-hidden rounded-3xl border border-emerald-400/35 bg-[#0f3021] md:border-brand-soft/70 md:bg-white/80 shadow-lg md:block">
                <Image
                  src="/dog_images/pexels-viktoriab-1078090.jpg"
                  alt="Dog relaxing while emails with the quote go out"
                  fill
                  className="object-cover"
                  sizes="(min-width: 768px) 520px, 100vw"
                />
                <div className="absolute top-4 left-4 right-4 rounded-2xl bg-white/85 px-4 py-2 text-xs font-semibold text-emerald-50 md:text-brand-ink shadow">
                  We’ve emailed every detail—watch for InsightScoop in your inbox.
                </div>
              </div>

              {isOneTime ? (
                <>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      asChild
                      size="lg"
                      className="flex-1 rounded-2xl bg-emerald-400 text-slate-900 font-semibold text-base py-5 transition hover:bg-emerald-300 focus-visible:ring-emerald-200 md:bg-brand-coral md:text-cream-soft md:hover:bg-brand-coral/95 md:shadow-[0_18px_40px_rgba(243,100,91,0.28)]"
                      >
                        <a href="tel:1-877-417-9273">
                          Call to schedule
                          <Phone className="size-4 ml-2" />
                        </a>
                      </Button>
                      <Button
                        asChild
                        variant="outline"
                        size="lg"
                        className="flex-1 rounded-2xl border-emerald-400/40 bg-[#0f2d22] text-emerald-50 font-semibold text-base py-5 transition hover:border-emerald-300/60 hover:bg-[#143d2d] md:border-brand-soft md:bg-white md:text-brand-ink md:hover:bg-slate-50"
                      >
                        <Link href={`/quote?businessId=${businessId}`}>
                          Create another quote
                        </Link>
                      </Button>
                    </div>
                    <p className="text-xs text-emerald-200/75 md:text-[rgba(var(--graphite-rgb-commas),0.6)]">
                      One-time cleans are scheduled directly with our team—reply to the email or call us to lock in your preferred date.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        asChild
                        size="lg"
                        className="flex-1 rounded-2xl bg-emerald-400 text-slate-900 font-semibold text-base py-5 transition hover:bg-emerald-300 focus-visible:ring-emerald-200 md:bg-brand-coral md:text-cream-soft md:hover:bg-brand-coral/95 md:shadow-[0_18px_40px_rgba(243,100,91,0.28)]"
                      >
                        <Link href={onboardingUrl}>
                          Start service now
                          <ArrowRight className="size-4 ml-2" />
                        </Link>
                      </Button>
                      <Button
                        asChild
                        variant="outline"
                        size="lg"
                        className="flex-1 rounded-2xl border-emerald-400/40 bg-[#0f2d22] text-emerald-50 font-semibold text-base py-5 transition hover:border-emerald-300/60 hover:bg-[#143d2d] md:border-brand-soft md:bg-white md:text-brand-ink md:hover:bg-slate-50"
                      >
                        <Link href={`/quote?businessId=${businessId}`}>
                          Create another quote
                        </Link>
                      </Button>
                    </div>
                    <p className="text-xs text-emerald-200/75 md:text-[rgba(var(--graphite-rgb-commas),0.6)]">
                      Ready to start service? Use the button above to finish onboarding now, or hang onto the summary and come back whenever you're ready.
                    </p>
                  </>
                )}

                <div className="relative overflow-hidden rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/20 via-emerald-500/8 to-transparent p-5 text-sm font-semibold text-emerald-50 shadow-[0_18px_48px_rgba(0,0,0,0.45)] md:hidden">
                  We’ve emailed every detail—watch for InsightScoop in your inbox.
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.12),transparent_60%)]" />
                </div>

                {heroHighlights.length > 0 ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {heroHighlights.map((item, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          quoteSurfaceClass,
                          "flex items-start gap-3 px-4 py-3 text-sm",
                          "md:border-slate-200 md:bg-white",
                        )}
                      >
                        <item.icon
                          className="size-5 flex-none"
                          style={{ color: item.tone }}
                        />
                        <div>
                          <div className="font-semibold text-emerald-50 md:text-brand-ink">
                            {item.label}
                          </div>
                          <div className="text-xs text-emerald-200/75 md:text-[rgba(var(--graphite-rgb-commas),0.65)]">
                            {item.detail}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>

          </div>

          <aside className="space-y-6">
            <Card className={cn(quoteSuccessAccentCardClass, "p-0")}>
              <CardHeader className="space-y-1 border-b border-white/5 px-6 pb-4 pt-5 md:border-b-0 md:px-6 md:pt-6">
                <CardTitle className="flex items-center justify-between gap-3 font-serif text-lg font-bold text-emerald-50 md:text-brand-ink">
                  <span>Quote summary</span>
                  {frequencyMeta ? (
                    <span className="text-xs font-semibold uppercase tracking-wide text-emerald-200 md:text-brand-muted">
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

            <Card className={cn(quoteSuccessAccentCardClass, "p-0")}
            >
              <CardHeader className="space-y-1 border-b border-white/5 px-6 pb-4 pt-5 md:border-b-0 md:px-6 md:pt-6">
                <CardTitle className="font-serif text-lg font-bold text-emerald-50 md:text-brand-ink">
                  Want another copy?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-6 pb-6 text-sm text-emerald-100 md:text-[rgba(var(--graphite-rgb-commas),0.7)]">
                <div className="rounded-2xl border border-emerald-400/30 bg-[#102d22]/85 px-4 py-3 md:border-slate-200 md:bg-white">
                  <div className="font-semibold text-emerald-50 md:text-brand-ink">
                    Keep this page handy:
                  </div>
                  <p className="mt-1 text-xs text-emerald-200/70 md:text-[rgba(var(--graphite-rgb-commas),0.65)]">
                    Copy the link or grab a PDF (coming soon) so you can revisit the quote anytime.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 rounded-xl border-emerald-400/35 text-emerald-50 hover:bg-[#153c2e] md:border-brand-soft md:text-brand-ink"
                    onClick={() => {
                      void sendQuoteEmail(resolvedBillingPreference);
                    }}
                  >
                    <RotateCcw className="size-4 mr-2" /> Email me another copy
                  </Button>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="mt-1 size-4 text-emerald-200 md:text-brand-deep" />
                  <div>
                    <div className="font-semibold text-emerald-50 md:text-brand-ink">Talk with the Yardura team</div>
                    <div>1-877-417-YARD · 8am–6pm CT</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="mt-1 size-4 text-emerald-200 md:text-brand-deep" />
                  <div>
                    <div className="font-semibold text-emerald-50 md:text-brand-ink">Email support</div>
                    <div>hello@yardura.com</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default function QuoteSentPage() {
  return (
    <Suspense fallback={<Loader message="Preparing" />}>
      <QuoteSentContent />
    </Suspense>
  );
}
