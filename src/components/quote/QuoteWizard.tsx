"use client";

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "@/lib/framermotion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  CheckCircle,
  Check,
  ChevronDown,
  Phone,
  Mail,
  Settings,
  MapPin,
  Clock,
  Loader2,
  Star,
  Users,
  Sparkles,
  Zap,
  AlertCircle,
  Building,
  Home,
  Calendar,
  User,
} from "lucide-react";

import { useSession } from "next-auth/react";
import { track } from "@/lib/analytics";

// New validation system
import { validateStep, validateField } from "./validation/schemas";
import { useZipValidation } from "./validation/useZipValidation";
import {
  scrollToFirstError,
  announceValidationErrors,
} from "./validation/formUtils";
import { QuoteStepFooter } from "./QuoteStepFooter";
import { getZoneMultiplierFromZip } from "@/lib/pricing";
import {
  QuoteInput,
  getPremiumOnboardingOptions,
  getFrequencyDisplayName,
} from "@/lib/priceEstimator";
// import { FormProtection } from '@/components/ui/recaptcha'; // Temporarily disabled
import { env } from "@/lib/env";
import { StepCustomization as ExternalStepCustomization } from "./steps/StepCustomization";
import { StepContactReview as StepContactReviewComponent } from "./steps/StepContactReview";
import type { PricingData } from "@/types/quote";
import {
  deriveTrialWeekPresentation,
  derivePostTrialPresentation,
  describeFirstWeekCoverage,
} from "@/lib/pricing-presentation";
import { FirstWeekCreditBanner } from "@/components/quote/components/FirstWeekCreditBanner";
import { StepOnboarding } from "./steps/StepOnboarding";
import { StepCommunityContact } from "./steps/StepCommunityContact";
import { StepServiceType } from "./steps/StepServiceType";
import { StepZipCheck } from "./steps/StepZipCheck";
import { StepBasics } from "./steps/StepBasics";
import { StepFrequency } from "./steps/StepFrequency";
import { InitialCleanLabel } from "@/components/quote/InitialCleanTooltip";
import { brandColors, withAlpha } from "@/shared/brand";
import { cn, formatVisitsRange } from "@/lib/utils";
import {
  quoteShellClass,
  quoteStepChipBase,
  quoteStepChipActive,
  quoteStepChipCompleted,
  quoteStepChipIdle,
} from "./quoteStyles";
import { QuoteStepBackground } from "./QuoteStepBackground";
import {
  ensureQuoteSessionId,
  getQuoteSessionId,
  clearQuoteSessionId,
} from "@/lib/quoteSession";

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const toAmount = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

// Transform add-ons from quote format to pricing API format
const transformAddOnsForPricing = (addOns: any) => {
  const transformed: any = {};

  // Handle deodorize
  if (addOns.deodorize && addOns.deodorizeMode) {
    transformed.deodorize = { mode: addOns.deodorizeMode };
  }

  // Handle spray deck
  if (addOns.sprayDeck && addOns.sprayDeckMode) {
    transformed["spray-deck"] = { mode: addOns.sprayDeckMode };
  }

  // Handle waste diversion
  if (addOns.divertMode && addOns.divertMode !== "none") {
    if (addOns.divertMode === "takeaway") {
      transformed["divert-takeaway"] = true;
    } else {
      transformed["divert-compost"] = true;
    }
  }

  // Handle custom add-ons - look for any add-on with a corresponding mode
  Object.keys(addOns).forEach((key) => {
    if (
      key.endsWith("Mode") &&
      addOns[key] &&
      addOns[key.replace("Mode", "")]
    ) {
      const addonId = key.replace("Mode", "");
      transformed[addonId] = { mode: addOns[key] };
    }
  });

  return transformed;
};

const trackQuoteEvent = (eventName: string, params: Record<string, any> = {}) => {
  if (typeof window === "undefined") return;
  const win = window as typeof window & { dataLayer?: Array<Record<string, any>> };
  const sessionId = getQuoteSessionId() ?? ensureQuoteSessionId();
  const payload = {
    event: eventName,
    quote_session_id: sessionId,
    ...params,
  };

  win.dataLayer = win.dataLayer || [];
  if (Array.isArray(win.dataLayer)) {
    win.dataLayer.push(payload);
  }
  if (typeof win.gtag === "function") {
    win.gtag("event", eventName, payload);
  }
  if (typeof win.fbq === "function") {
    win.fbq("trackCustom", eventName, payload);
  }
};


// pricing summary sidebar component
const PricingSummary = ({
  pricing,
  frequency,
  currentStep,
  quoteData,
}: {
  pricing: any;
  frequency?: string;
  currentStep?: number;
  quoteData?: any;
}) => {
  if (!pricing) return null;

  // Handle commercial/custom quote case
  if (pricing.requiresCustomQuote) {
    return (
      <div className="sticky top-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Custom Quote Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              {pricing.commercialMessage ||
                "Please contact us for a custom quote based on your property details."}
            </p>
            <div className="space-y-2">
              <a
                href="tel:1-877-417-9273"
                className="flex items-center gap-2 text-brand-deep hover:text-brand-ink"
              >
                <Phone className="size-4" />
                <span>Call 1-877-417-YARD</span>
              </a>
              <a
                href="/contact"
                className="flex items-center gap-2 text-brand-deep hover:text-brand-ink"
              >
                <Mail className="size-4" />
                <span>Request more information</span>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate discount for initial clean based on frequency
  const getInitialCleanDiscount = () => {
    if (frequency === "onetime") return null; // No discount for one-time

    const initialCleanAmount = parseFloat(pricing.initialClean || "0");
    if (initialCleanAmount === 0) return null; // No initial clean needed

    // Calculate first-visit-only add-ons that should be added to the discounted amount
    // Note: Only include TRULY first-visit-only add-ons, not recurring per-visit add-ons
    let firstVisitAddOns = 0;
    if (quoteData.addOns?.deodorizeMode === "first-visit") {
      firstVisitAddOns += 25; // $25 for deodorize (first visit only)
    }
    if (quoteData.addOns?.sprayDeckMode === "first-visit") {
      firstVisitAddOns += 12; // $12 for spray deck (first visit only)
    }
    // Don't include divert/takeaway here as they're per-visit add-ons, not first-visit-only

    if (frequency === "monthly") {
      return {
        discountPercent: 50,
        discountAmount: initialCleanAmount * 0.5,
        finalAmount: initialCleanAmount * 0.5 + firstVisitAddOns,
        firstVisitAddOnAmount: firstVisitAddOns,
      };
    } else if (
      ["weekly", "biweekly", "twice-weekly", "daily"].includes(
        frequency || "",
      )
    ) {
      return {
        discountPercent: 100,
        discountAmount: initialCleanAmount,
        finalAmount: firstVisitAddOns,
        firstVisitAddOnAmount: firstVisitAddOns,
      };
    }

    return null;
  };

  const toNumber = (value: unknown): number => {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const parsed = parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  const resolveFrequencyValue = (value?: string) => {
    if (!value) return "weekly";
    const normalized = value.toLowerCase();
    if (normalized === "onetime") return "one-time";
    return value;
  };

  const getPricingAddonAmount = (
    addonId: string,
    mode: string,
  ): number => {
    const normalizedMode =
      mode === "selected" || !mode ? "each-visit" : mode.toLowerCase();
    const frequencySource = resolveFrequencyValue(
      frequency ?? quoteData?.frequency,
    );
    const isFirstVisitCharge =
      frequencySource === "one-time" ||
      normalizedMode === "first-visit" ||
      normalizedMode === "one-time" ||
      normalizedMode === "onetime";

    const firstVisitSource =
      (pricing?.firstVisitAddOns as Record<string, string | number> | undefined) ||
      undefined;
    const recurringSource =
      (pricing?.recurringAddOns as Record<string, string | number> | undefined) ||
      undefined;

    if (isFirstVisitCharge && firstVisitSource) {
      if (addonId === "deodorize") return toNumber(firstVisitSource.deodorize);
      if (addonId === "spray-deck") return toNumber(firstVisitSource.sprayDeck);
      return toNumber(firstVisitSource.other);
    }

    if (!isFirstVisitCharge && recurringSource) {
      if (addonId === "deodorize") return toNumber(recurringSource.deodorize);
      if (addonId === "spray-deck") return toNumber(recurringSource.sprayDeck);
      if (addonId.startsWith("divert")) return toNumber(recurringSource.divert);
      return toNumber(recurringSource.other);
    }

    return 0;
  };

  const buildAddonPriceLabel = (addonId: string, mode: string) => {
    const cents = getPricingAddonAmount(addonId, mode);
    if (cents <= 0) return "Included";

    const normalizedMode =
      mode === "selected" || !mode ? "each-visit" : mode.toLowerCase();
    const normalizedFrequency = resolveFrequencyValue(
      frequency ?? quoteData?.frequency,
    ).toLowerCase();

    const amount = (cents / 100).toFixed(2);
    const suffix = (() => {
      if (
        normalizedMode === "first-visit" ||
        normalizedMode === "one-time" ||
        normalizedMode === "onetime" ||
        normalizedFrequency === "one-time"
      ) {
        return " one-time";
      }
      if (normalizedMode === "every-other") {
        return " / visit (every other)";
      }
      return " / visit";
    })();

    return `+$${amount}${suffix}`;
  };

  const getAddonDisplay = (addonId: string, mode: string) => {
    return {
      name: addonId,
      price: buildAddonPriceLabel(addonId, mode),
    };
  };

  const discount = getInitialCleanDiscount();

  const resolvedFrequency = resolveFrequencyValue(
    frequency ?? quoteData?.frequency,
  );
  const normalizedFrequency = resolvedFrequency
    ? resolvedFrequency.toLowerCase()
    : "weekly";

  const pricingData = useMemo(() => {
    if (!pricing || (pricing as any).requiresCustomQuote) {
      return null;
    }
    return pricing as PricingData;
  }, [pricing]);

  const trialPresentation = useMemo(
    () =>
      pricingData
        ? deriveTrialWeekPresentation(
            pricingData,
            normalizedFrequency === "onetime" ? "one-time" : normalizedFrequency,
          )
        : null,
    [pricingData, normalizedFrequency],
  );

  const postTrialPresentation = useMemo(
    () => (pricingData ? derivePostTrialPresentation(pricingData) : null),
    [pricingData],
  );

  const trialValueCents = trialPresentation?.totalValueCents ?? 0;
  const trialCreditCents = trialPresentation?.totalCreditCents ?? 0;
  const trialNetCents = trialPresentation?.netDueCents ?? 0;
  const trialDescriptor = trialPresentation?.descriptor;

  const trialLengthCopy = (() => {
    const days = trialPresentation?.trialLengthDays;
    if (!days) return null;
    if (days === 7) return "Free week covers your kickoff + follow-ups.";
    if (days === 14) return "Free coverage runs for two weeks after kickoff.";
    return `Free coverage runs for ${days} days after kickoff.`;
  })();

  const formatCentsToCurrency = (value?: number | string | null) => {
    const cents = typeof value === "string" ? Number(value) : value;
    if (typeof cents !== "number" || Number.isNaN(cents)) {
      return "$0.00";
    }
    return formatCurrency(cents / 100);
  };

  const activationCopy = (() => {
    const days =
      postTrialPresentation?.activationDelayDays ??
      trialPresentation?.trialLengthDays ??
      null;
    if (!days) return null;
    if (days === 7) return "Billing begins one week after your kickoff visit.";
    if (days === 14) return "Billing begins two weeks after your kickoff visit.";
    return `Billing begins ${days} days after your kickoff visit.`;
  })();

  return (
    <div className="sticky top-4 space-y-4">
      {resolvedFrequency === "onetime" ? (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">One-time service</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-brand-muted">
            <div className="flex items-center justify-between text-brand-ink">
              <span className="font-medium">Visit total</span>
              <span className="text-2xl font-semibold text-brand-ink">
                ${pricing.oneTime}
              </span>
            </div>
            <p className="text-xs">
              We invoice after the cleanup wraps so you only pay for a completed visit.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {resolvedFrequency !== "onetime" && pricingData ? (
        <>
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Free trial week</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-2">
                {trialPresentation?.charges.map((item) => (
                  <div
                    key={`trial-charge-${item.key}`}
                    className="flex items-center justify-between text-brand-ink"
                  >
                    <span>{item.label}</span>
                    <span className="font-semibold">
                      {formatCentsToCurrency(item.amountCents)}
                    </span>
                  </div>
                ))}
              </div>

              {trialPresentation?.credits.length ? (
                <div className="space-y-2 border-t border-brand-soft pt-2">
                  {trialPresentation.credits.map((item) => (
                    <div
                      key={`trial-credit-${item.key}`}
                      className="flex items-center justify-between text-emerald-600"
                    >
                      <span>{item.label}</span>
                      <span className="font-semibold">
                        -{formatCentsToCurrency(item.amountCents)}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-brand-ink">
                    <span className="font-medium">Trial week total</span>
                    <span className="text-lg font-semibold">
                      {formatCentsToCurrency(trialNetCents)}
                    </span>
                  </div>
                </div>
              ) : null}

              {trialDescriptor ? (
                <p className="text-xs text-brand-muted">{trialDescriptor}</p>
              ) : null}

              <FirstWeekCreditBanner
                amount={formatCentsToCurrency(trialCreditCents)}
                descriptor={trialLengthCopy}
                subtext="Schedule your kickoff to activate these credits before billing begins."
                className="text-left"
              />
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
                  <span className="text-lg font-semibold">
                    {formatCentsToCurrency(pricingData.perVisit)}
                  </span>
                </div>
                {pricingData.visitsPerMonth ? (
                  <span className="block text-xs text-brand-muted">
                    ~{formatVisitsRange(Number(pricingData.visitsPerMonth)) || ""} / month
                  </span>
                ) : null}
              </div>

              {pricingData.monthly ? (
                <div className="flex items-center justify-between rounded-lg bg-brand-soft/30 px-3 py-2 text-sm">
                  <span className="font-medium text-brand-ink">Flat monthly option</span>
                  <span className="font-semibold text-brand-ink">
                    {formatCentsToCurrency(pricingData.monthly)}
                  </span>
                </div>
              ) : null}

              {postTrialPresentation?.firstInvoiceAddOns.length ? (
                <div className="space-y-2 border-t border-brand-soft pt-2">
                  <div className="font-medium text-brand-ink">First paid visit add-ons</div>
                  {postTrialPresentation.firstInvoiceAddOns.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between text-brand-muted"
                    >
                      <span>{item.label}</span>
                      <span>{formatCentsToCurrency(item.amountCents)}</span>
                    </div>
                  ))}
                  <p className="text-xs text-brand-muted">
                    These extras apply to your first billed visit after the trial week.
                  </p>
                </div>
              ) : null}

              {activationCopy ? (
                <p className="text-xs text-brand-muted">{activationCopy}</p>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : null}

      {/* Service Summary */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Service Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Service Breakdown */}
          {frequency === "onetime" ? (
            // One-time service: focus on the service details
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">One-time service</span>
                <span className="text-sm font-medium">${pricing.oneTime}</span>
              </div>
              <div className="text-xs text-gray-600 space-y-1 ml-2">
                <div>• Complete yard cleanup</div>
                <div>
                  • {quoteData?.dogs || 2} Dog{quoteData?.dogs > 1 ? "s" : ""}
                </div>
                <div>
                  •{" "}
                  {quoteData?.yardSize
                    ? quoteData.yardSize === "xl"
                      ? "XL"
                      : quoteData.yardSize.charAt(0).toUpperCase() +
                        quoteData.yardSize.slice(1)
                    : "Medium"}{" "}
                  property
                </div>
                {quoteData?.areasToClean &&
                  Object.values(quoteData.areasToClean).some((v) => v) && (
                    <div>
                      • Service areas:{" "}
                      {(() => {
                        const areas = [];
                        if (quoteData.areasToClean.frontYard)
                          areas.push("Front");
                        if (quoteData.areasToClean.backYard) areas.push("Back");
                        if (quoteData.areasToClean.sideYard) areas.push("Side");
                        if (quoteData.areasToClean.dogRun)
                          areas.push("Dog Run");
                        if (quoteData.areasToClean.fencedArea)
                          areas.push("Fenced");
                        if (quoteData.areasToClean.other)
                          areas.push(quoteData.areasToClean.other);
                        return areas.length > 0
                          ? areas.join(", ")
                          : "Standard areas";
                      })()}
                    </div>
                  )}
                <div>• Professional waste removal</div>
              </div>
            </div>
          ) : (
            // Recurring service: show per-visit pricing
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Recurring service</span>
                <span className="text-sm font-medium">${pricing.perVisit}</span>
              </div>
              <div className="text-xs text-gray-600 space-y-1 ml-2">
                <div>
                  • {quoteData?.dogs || 2} Dog{quoteData?.dogs > 1 ? "s" : ""}
                </div>
                <div>
                  •{" "}
                  {quoteData?.yardSize
                    ? quoteData.yardSize === "xl"
                      ? "XL"
                      : quoteData.yardSize.charAt(0).toUpperCase() +
                        quoteData.yardSize.slice(1)
                    : "Medium"}{" "}
                  property
                </div>
                {quoteData?.areasToClean &&
                  Object.values(quoteData.areasToClean).some((v) => v) && (
                    <div>
                      • Service areas:{" "}
                      {(() => {
                        const areas = [];
                        if (quoteData.areasToClean.frontYard)
                          areas.push("Front");
                        if (quoteData.areasToClean.backYard) areas.push("Back");
                        if (quoteData.areasToClean.sideYard) areas.push("Side");
                        if (quoteData.areasToClean.dogRun)
                          areas.push("Dog Run");
                        if (quoteData.areasToClean.fencedArea)
                          areas.push("Fenced");
                        if (quoteData.areasToClean.other)
                          areas.push(quoteData.areasToClean.other);
                        return areas.length > 0
                          ? areas.join(", ")
                          : "Standard areas";
                      })()}
                    </div>
                  )}
                {(() => {
                  const selectedAreas = quoteData?.areasToClean
                    ? Object.values(quoteData.areasToClean).filter((v) => v)
                        .length
                    : 0;
                  const extraAreas = Math.max(0, selectedAreas - 1);
                  if (extraAreas > 0) {
                    const costPerArea = frequency === "onetime" ? 5 : 3;
                    return (
                      <div>
                        • +${extraAreas * costPerArea} for {extraAreas}{" "}
                        additional area
                        {extraAreas > 1 ? "s" : ""}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          )}

          <div className="border-t border-gray-200 my-3" />

          {/* Add-ons */}
          {(() => {
            const addOns = quoteData?.addOns;

            // Check if addOns object is empty or only contains default values
            const isEmptyAddOns =
              !addOns ||
              Object.keys(addOns).length === 0 ||
              (Object.keys(addOns).length === 1 &&
                addOns.divertMode === "none");

            if (isEmptyAddOns) {
              return (
                <>
                  <div>
                    <div className="text-sm font-medium mb-2">Add-ons</div>
                    <div className="text-xs text-gray-500 italic">
                      None selected
                    </div>
                  </div>
                  <div className="border-t border-gray-200 my-3" />
                </>
              );
            }

            // Check each add-on individually for meaningful selections
            const hasDeodorize =
              addOns.deodorize === true ||
              (addOns.deodorizeMode && addOns.deodorizeMode !== "none");
            const hasSprayDeck =
              addOns.sprayDeck === true ||
              (addOns.sprayDeckMode && addOns.sprayDeckMode !== "none");
            const hasDivertMode =
              addOns.divertMode && addOns.divertMode !== "none";

            // If no add-ons are meaningfully selected, show "None selected"
            if (!hasDeodorize && !hasSprayDeck && !hasDivertMode) {
              return (
                <>
                  <div>
                    <div className="text-sm font-medium mb-2">Add-ons</div>
                    <div className="text-xs text-gray-500 italic">
                      None selected
                    </div>
                  </div>
                  <div className="border-t border-gray-200 my-3" />
                </>
              );
            }

            // If add-ons are selected, show them
            return (
              <>
                <div>
                  <div className="text-sm font-medium mb-2">Add-ons</div>
                  {hasDeodorize && (
                    <div className="flex justify-between items-center text-xs text-gray-600">
                      <span>
                        Deodorize & Sanitize
                        {addOns.deodorizeMode === "first-visit" &&
                          " (Kickoff visit only)"}
                        {addOns.deodorizeMode === "each-visit" &&
                          " (Each visit)"}
                        {addOns.deodorizeMode === "every-other" &&
                          " (Every other visit)"}
                        {addOns.deodorizeMode === "one-time" &&
                          " (One-time service)"}
                      </span>
                      <span>
                        {
                          getAddonDisplay("deodorize", addOns.deodorizeMode)
                            .price
                        }
                      </span>
                    </div>
                  )}

                  {/* Spray Deck Add-on */}
                  {hasSprayDeck && (
                    <div className="flex justify-between items-center text-xs text-gray-600">
                      <span>
                        Spray Deck/Patio
                        {addOns.sprayDeckMode === "first-visit" &&
                          " (Initial clean only)"}
                        {addOns.sprayDeckMode === "each-visit" &&
                          " (Each visit)"}
                        {addOns.sprayDeckMode === "every-other" &&
                          " (Every other visit)"}
                        {addOns.sprayDeckMode === "onetime" &&
                          " (One-time service)"}
                      </span>
                      <span>
                        {
                          getAddonDisplay("spray-deck", addOns.sprayDeckMode)
                            .price
                        }
                      </span>
                    </div>
                  )}

                  {/* Divert from Landfill Add-on */}
                  {hasDivertMode && (
                    <div className="flex justify-between items-center text-xs text-gray-600">
                      <span>
                        {addOns.divertMode === "takeaway"
                          ? "Haul away"
                          : "Compost routing"}
                      </span>
                      <span>
                        {getAddonDisplay(
                          addOns.divertMode === "takeaway"
                            ? "divert-takeaway"
                            : "divert-compost",
                          "selected",
                        ).price}
                      </span>
                    </div>
                  )}
                  {hasDivertMode && addOns.divertMode !== "takeaway" && (
                    <p className="mt-2 text-[11px] text-gray-500">
                      Compost routing availability can vary. We divert as much as our partners can accept and still log your eco impact.
                    </p>
                  )}
                </div>
                <div className="border-t border-gray-200 my-3" />
              </>
            );
          })()}

          {/* One-time charges with discount */}
          {parseFloat(pricing.initialClean || "0") > 0 && (
            <>
              <div>
                <div className="text-sm font-medium mb-2">One-time charges</div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs text-gray-600">
                    <span className="inline-flex items-center gap-1">
                      <InitialCleanLabel className="text-xs text-gray-600" />
                      <span>
                        ({pricing.initialCleanBucket || "2-6 weeks"})
                      </span>
                    </span>
                    <span>${pricing.initialClean}</span>
                  </div>
                  {discount && (
                    <div className="flex justify-between items-center text-xs text-emerald-600 bg-green-50 p-2 rounded">
                      <span className="inline-flex items-center gap-1">
                        <span aria-hidden="true">🎉</span>
                        <InitialCleanLabel
                          className="text-xs text-emerald-700"
                          label="Initial clean discount"
                        />
                        <span>
                          ({discount.discountPercent}% off)
                        </span>
                      </span>
                      <span>-${discount.discountAmount.toFixed(2)}</span>
                    </div>
                  )}

                  {/* Initial clean only add-ons */}
                  {quoteData.addOns?.deodorizeMode === "first-visit" && (
                    <div className="flex justify-between items-center text-xs text-gray-600">
                      <span>Deodorize & Sanitize (first visit only)</span>
                      <span>
                        {getAddonDisplay("deodorize", "first-visit").price}
                      </span>
                    </div>
                  )}
                  {quoteData.addOns?.sprayDeckMode === "first-visit" && (
                    <div className="flex justify-between items-center text-xs text-gray-600">
                      <span>Spray Deck/Patio (first visit only)</span>
                      <span>
                        {getAddonDisplay("spray-deck", "first-visit").price}
                      </span>
                    </div>
                  )}
                  {quoteData.addOns?.divertMode &&
                    quoteData.addOns.divertMode !== "none" &&
                    frequency === "onetime" && (
                      <div className="flex justify-between items-center text-xs text-gray-600">
                        <span>
                          {quoteData.addOns.divertMode === "takeaway"
                            ? "Haul away"
                            : "Compost routing"}
                        </span>
                        <span>
                          {getAddonDisplay(
                            quoteData.addOns.divertMode === "takeaway"
                              ? "divert-takeaway"
                              : "divert-compost",
                            "selected",
                          ).price}
                        </span>
                      </div>
                    )}
                  {quoteData.addOns?.divertMode &&
                    quoteData.addOns.divertMode !== "takeaway" &&
                    frequency === "onetime" && (
                      <p className="mt-2 text-[11px] text-gray-500">
                        Compost routing availability can vary. We divert as much as our partners can accept and still log your eco impact.
                      </p>
                    )}
                </div>
              </div>
              <div className="border-t border-gray-200 my-3" />
            </>
          )}

          {/* Total */}
          <div className="flex justify-between items-center pt-2">
            <span className="font-medium">Total for first visit</span>
            <span className="font-semibold text-lg">
              {discount
                ? `$${discount.finalAmount.toFixed(2)}`
                : `$${pricing.oneTime}`}
            </span>
          </div>

          {/* Monthly billing note */}
          {frequency !== "onetime" &&
            pricing.monthly !== pricing.oneTime &&
            pricing.monthly !== "0.00" && (
              <div className="text-xs text-gray-500 text-center pt-2">
                Billed monthly: ${pricing.monthly}
              </div>
            )}
        </CardContent>
      </Card>

      {/* Questions section */}
      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-sm text-blue-800 mb-2">
          <strong>Questions about your quote?</strong>
        </p>
        <p className="text-xs text-blue-700">
          Call us at{" "}
          <a
            href="tel:1-877-417-9273"
            className="text-blue-600 hover:underline"
          >
            1-877-417-YARD
          </a>{" "}
          or{" "}
          <a href="/contact" className="text-blue-600 hover:underline">
            request more information
          </a>
        </p>
      </div>
    </div>
  );
};

// Enhanced step configuration with conditional flow - inspired by DoodyCalls
const getSteps = (frequency?: string, isCommunity?: boolean) => {
  const normalizedFrequency = frequency?.toLowerCase?.();
  const steps = [
  {
    id: "zip-check",
    title: "Service Area",
    description: "Verify your location for service",
    icon: MapPin,
    color: "from-blue-500 to-purple-600",
  },
  {
    id: "service-type",
    title: "Service Type",
    description: "Residential or community service",
    icon: Building,
    color: "from-purple-500 to-pink-600",
  },
    ...(!isCommunity
      ? [
  {
    id: "basics",
    title: "Property Details",
    description: "Tell us about your dogs and yard",
    icon: Home,
            color: "from-[rgba(243,100,91,0.9)] to-[rgba(255,194,77,0.85)]",
          },
        ]
      : []),
    ...(!isCommunity
      ? [
        {
          id: "frequency",
          title: "Service Frequency",
          description: "How often do you need service?",
          icon: Clock,
          color: "from-orange-500 to-red-600",
        },
        ]
      : []),
    ...(!isCommunity
      ? [
        {
          id: "customization",
          title: "Customize Service",
          description: "Add extras and preferences",
          icon: Settings,
          color: "from-yellow-500 to-orange-600",
        },
        ]
      : []),
    ...(isCommunity
      ? [
          {
            id: "community-contact",
            title: "Community Contact",
            description: "Tell us how to reach you",
          icon: Building,
          color: "from-indigo-500 to-blue-600",
        },
      ]
    : []),
    ...(!isCommunity
      ? [
  {
    id: "contact-review",
            title: "Contact & Confirm",
            description: "Your info and final quote review",
    icon: CheckCircle,
            color: "from-[rgba(243,100,91,0.9)] to-[rgba(255,194,77,0.85)]",
          },
        ]
      : []),
  ];

  return steps;
};

const QUOTE_STORAGE_VERSION = 2;
const QUOTE_STORAGE_PREFIX = "yardura_quote_state";
const LEGACY_QUOTE_STORAGE_KEY = "yardura_pending_quote_v2";

const DEFAULT_QUOTE_DATA: Partial<QuoteInput> = {
  serviceType: "residential",
  dogs: 1,
  yardSize: "medium",
  frequency: "weekly",
  weekendUpgrade: false,
  addOns: {},
  initialClean: false,
  premiumOnboarding: "none",
  consent: { stoolPhotosOptIn: false, terms: false, marketingOptIn: false },
  zipValidated: false,
  deepCleanAssessment: {
    daysSinceLastCleanup: 42, // Default to "2-6 weeks" bucket
  },
  areasToClean: {
    backYard: true, // Default to backyard selected
  },
};

function QuoteWizardComponent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = searchParams ?? new URLSearchParams();
  const { data: session } = useSession();

  // Determine which organization this quote is for
  // Priority: URL param > session user's org > default to 'yardura'
  const getBusinessOrgId = () => {
    // Check for org/tenant parameter in URL (supports businessId, tenantId aliases)
    const urlOrgId =
      params.get("org") ||
      params.get("businessId") ||
      params.get("tenant") ||
      params.get("tenantId");
    if (urlOrgId) return urlOrgId;

    // Use session user's org if logged in as admin/staff
    const sessionOrgId = (session?.user as any)?.orgId;
    const userRole = (session as any)?.userRole;
    if (
      sessionOrgId &&
      ["ADMIN", "OWNER", "TECH", "SALES_REP"].includes(userRole)
    ) {
      return sessionOrgId;
    }

    // Default to main yardura org for public quotes
    return "yardura";
  };

  const userOrgId = getBusinessOrgId();
  const storageKey = `${QUOTE_STORAGE_PREFIX}:${userOrgId}`;
  const resumeFlagParam = params.get("resume");

  console.log(
    "Quote flow using orgId:",
    userOrgId,
    "for user:",
    session?.user?.email || "anonymous",
  );

  // Simplified state management
  const [currentStep, setCurrentStep] = useState(0);
  const [quoteData, setQuoteData] = useState<Partial<QuoteInput>>({
    ...DEFAULT_QUOTE_DATA,
  });
  const [_errors, setErrors] = useState<Record<string, string[]>>({});
  const flattenedFieldErrors = useMemo(() => {
    const result: Record<string, string> = {};
    Object.entries(_errors).forEach(([key, value]) => {
      if (Array.isArray(value) && value.length > 0) {
        result[key] = value[0];
      }
    });
    return result;
  }, [_errors]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isCommunity = quoteData.serviceType === "commercial";

  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [formProtectionErrors, setFormProtectionErrors] = useState<string[]>(
    [],
  );
  const [zoneMultiplier, setZoneMultiplier] = useState<number>(1.0);
  const [completedSteps, setCompletedSteps] = useState<boolean[]>([]);
  const [hasRestoredState, setHasRestoredState] = useState(false);
  const quoteSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    quoteSessionIdRef.current = ensureQuoteSessionId();
  }, []);

  // Check for pre-filled zip code from URL params (e.g., from landing page zip check)
  // This should run AFTER state restoration is complete
  const [hasProcessedUrlParams, setHasProcessedUrlParams] = useState(false);

  // New validation system
  const zipValidation = useZipValidation();
  const fieldRefs = useMemo(
    () => ({}) as Record<string, React.RefObject<HTMLElement>>,
    [],
  );
  const liveRegionRef = useMemo(
    () => ({ current: null }) as React.RefObject<HTMLDivElement>,
    [],
  );

  // Update zone multiplier when ZIP code changes
  useEffect(() => {
    const updateZoneMultiplier = async () => {
      if (quoteData.zipCode) {
        try {
          const multiplier = await getZoneMultiplierFromZip(
            quoteData.zipCode,
            userOrgId,
          );
          setZoneMultiplier(multiplier);
        } catch (error) {
          console.error("Error getting zone multiplier:", error);
          setZoneMultiplier(1.0); // Default to 1.0 on error
        }
      } else {
        setZoneMultiplier(1.0); // Default to 1.0 when no ZIP
      }
    };

    updateZoneMultiplier();
  }, [quoteData.zipCode, userOrgId]);

  // Pricing state for async calculations
  const [pricing, setPricing] = useState<any>(null);

  // Get dynamic steps based on frequency and commercial status
  const STEPS = useMemo(
    () => getSteps(quoteData.frequency, isCommunity),
    [quoteData.frequency, isCommunity],
  );

  // Show mobile sticky pricing only after property details are selected
  const hasPropertyDetails = useMemo(() => {
    if (isCommunity) return false;
    const hasDogs = !!quoteData.dogs;
    const hasYard = !!quoteData.yardSize;
    const hasLastCleanup =
      !!quoteData.deepCleanAssessment?.daysSinceLastCleanup;
    const hasAreas =
      !!quoteData.areasToClean &&
      Object.values(quoteData.areasToClean).some((v) => !!v);
    return hasDogs && hasYard && hasLastCleanup && hasAreas;
  }, [
    quoteData.dogs,
    quoteData.yardSize,
    quoteData.deepCleanAssessment?.daysSinceLastCleanup,
    quoteData.areasToClean,
  ]);

  const lastTrackedStepRef = useRef<string | null>(null);
  const lastTrackedStepIndexRef = useRef(0);
  const quoteStartedRef = useRef(false);
  const quoteCompletedRef = useRef(false);
  const propertyTypeRef = useRef<string | null>(quoteData.propertyType ?? null);

  useEffect(() => {
    propertyTypeRef.current = quoteData.propertyType ?? null;
  }, [quoteData.propertyType]);

  // Process URL params after state restoration and STEPS are defined
  useEffect(() => {
    if (!hasRestoredState || hasProcessedUrlParams) return;
    
    const urlZipCode = params.get("zipCode");
    const skipZipCheck = params.get("skipZipCheck") === "true";
    const resumeAtStep = params.get("resumeAtStep");
    
    if (urlZipCode && skipZipCheck) {
      // Pre-fill the zip code and mark it as validated
      setQuoteData((prev) => ({ 
        ...prev, 
        zipCode: urlZipCode,
        zipValidated: true 
      }));
      // Skip to step 2 (service-type step, index 1)
      setCurrentStep(1);
      // Mark zip check step as completed
      setCompletedSteps((prev) => {
        const newCompleted = [...prev];
        newCompleted[0] = true;
        return newCompleted;
      });
      setHasProcessedUrlParams(true);
    } else if (resumeAtStep) {
      // Handle resuming at a specific step (e.g., "frequency" from quote success page)
      const stepIndex = STEPS.findIndex(s => s.id === resumeAtStep);
      if (stepIndex >= 0) {
        setCurrentStep(stepIndex);
        setHasProcessedUrlParams(true);
      }
    }
  }, [params, hasRestoredState, hasProcessedUrlParams, STEPS]);

  useEffect(() => {
    const currentStepId = STEPS[currentStep]?.id;
    if (!currentStepId) return;

    if (!quoteStartedRef.current) {
      trackQuoteEvent("quote_started", { step_id: currentStepId });
      quoteStartedRef.current = true;
    }

    if (lastTrackedStepRef.current === currentStepId) return;
    trackQuoteEvent("quote_step", {
      step_id: currentStepId,
      step_index: currentStep,
      total_steps: STEPS.length,
      property_type: quoteData.propertyType ?? null,
    });
    lastTrackedStepRef.current = currentStepId;
    lastTrackedStepIndexRef.current = currentStep;
  }, [STEPS, currentStep, quoteData.propertyType]);

  useEffect(() => {
    return () => {
      if (!quoteCompletedRef.current && lastTrackedStepRef.current) {
        trackQuoteEvent("quote_abandon", {
          step_id: lastTrackedStepRef.current,
          step_index: lastTrackedStepIndexRef.current,
          property_type: propertyTypeRef.current,
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canProceed = useMemo(() => {
    const currentStepId = STEPS[currentStep]?.id;

    if (!currentStepId) {
      return false;
    }

    if (currentStepId === "zip-check") {
      return Boolean(quoteData.zipValidated);
    }

    if (currentStepId === "service-type") {
      return Boolean(quoteData.serviceType);
    }

    if (currentStepId === "basics" && !isCommunity) {
      const hasDogs = typeof quoteData.dogs === "number" && quoteData.dogs > 0;
      const hasYard = Boolean(quoteData.yardSize);
      const hasLastCleanup = Boolean(
        quoteData.deepCleanAssessment?.daysSinceLastCleanup,
      );
      const hasAreas =
        !!quoteData.areasToClean &&
        Object.values(quoteData.areasToClean).some(Boolean);

      return hasDogs && hasYard && hasLastCleanup && hasAreas;
    }

    if (currentStepId === "frequency" && !isCommunity) {
      return Boolean(quoteData.frequency);
    }

    if (currentStepId === "contact-review" && !isCommunity) {
      return quoteData.consent?.terms === true;
    }

    return true;
  }, [
    STEPS,
    currentStep,
    isCommunity,
    quoteData.zipValidated,
    quoteData.serviceType,
    quoteData.dogs,
    quoteData.yardSize,
    quoteData.deepCleanAssessment?.daysSinceLastCleanup,
    quoteData.areasToClean,
    quoteData.frequency,
    quoteData.consent?.terms,
  ]);

  const determineStepFromQuote = useCallback(
    (data: Partial<QuoteInput> | undefined | null) => {
      if (!data) return 0;

      if (data.serviceType === "commercial") {
        if (data.contact?.name && data.contact?.email && data.contact?.phone) {
          return Math.max(0, STEPS.length - 1);
        }
        return Math.min(1, Math.max(0, STEPS.length - 1));
      }

      if (data.contact?.name && data.contact?.email) {
        return Math.min(4, Math.max(0, STEPS.length - 1));
      }

      if (data.dogs && data.yardSize && data.frequency) {
        return Math.min(3, Math.max(0, STEPS.length - 1));
      }

      if (data.dogs || data.yardSize || data.frequency) {
        return Math.min(1, Math.max(0, STEPS.length - 1));
      }

      return 0;
    },
    [STEPS.length],
  );

  useEffect(() => {
    setCompletedSteps((prev) => {
      if (prev.length === STEPS.length) {
        return prev;
      }

      const next = new Array(STEPS.length).fill(false);
      for (let i = 0; i < Math.min(prev.length, next.length); i += 1) {
        next[i] = prev[i];
      }
      return next;
    });

    setCurrentStep((prev) => {
      if (prev >= STEPS.length) {
        return Math.max(0, STEPS.length - 1);
      }
      return prev;
    });
  }, [STEPS.length]);

  const isFinalStep = currentStep === STEPS.length - 1;

  const addOnSignature = useMemo(
    () => JSON.stringify(quoteData.addOns || {}),
    [quoteData.addOns],
  );

  const areasSignature = useMemo(
    () => JSON.stringify(quoteData.areasToClean || {}),
    [quoteData.areasToClean],
  );

  const pricingPayload = useMemo(() => {
    if (isCommunity) {
      return null;
    }

    if (!quoteData.dogs || !quoteData.yardSize) {
      return null;
    }

    return {
      dogs: quoteData.dogs,
      yardSize: quoteData.yardSize,
      frequency: quoteData.frequency || "weekly",
      weekendUpgrade: Boolean(quoteData.weekendUpgrade),
      addons: transformAddOnsForPricing(quoteData.addOns || {}),
      initialClean: quoteData.initialClean,
      premiumOnboarding: quoteData.premiumOnboarding,
      deepCleanAssessment: quoteData.deepCleanAssessment,
      propertyType: quoteData.propertyType,
      address: quoteData.address || "",
      lastCleanedBucket:
        quoteData.deepCleanAssessment?.daysSinceLastCleanup?.toString(),
      lastCleanedDate: quoteData.lastCleanedDate,
      zoneMultiplier,
      areasToClean: quoteData.areasToClean,
      businessId: userOrgId,
    };
  }, [
    quoteData.dogs,
    quoteData.yardSize,
    quoteData.frequency,
    quoteData.weekendUpgrade,
    quoteData.initialClean,
    quoteData.premiumOnboarding,
    quoteData.deepCleanAssessment,
    quoteData.propertyType,
    quoteData.address,
    quoteData.lastCleanedDate,
    zoneMultiplier,
    userOrgId,
    addOnSignature,
    areasSignature,
  ]);

  const [debouncedPricingPayload, setDebouncedPricingPayload] = useState(
    pricingPayload,
  );

  useEffect(() => {
    if (pricingPayload === null) {
      setDebouncedPricingPayload(null);
      return;
    }

    const handle = setTimeout(() => {
      setDebouncedPricingPayload(pricingPayload);
    }, 250);

    return () => clearTimeout(handle);
  }, [pricingPayload]);

  // Calculate price asynchronously via API (debounced)
  useEffect(() => {
    if (!debouncedPricingPayload) {
      setPricing(null);
      return;
    }

    const controller = new AbortController();
    let retryTimeout: NodeJS.Timeout | null = null;

    const calculatePricingAsync = async (attempt: number = 0) => {
      try {
        console.log("Making pricing API call with data:", debouncedPricingPayload);

        const response = await fetch("/api/quote/calculate-price", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(debouncedPricingPayload),
            signal: controller.signal,
          });

      if (response.ok) {
        const result = await response.json();
        if (retryTimeout) {
          clearTimeout(retryTimeout);
          retryTimeout = null;
        }
        console.log("Received pricing result:", result);
        setPricing(result);
          } else {
            console.warn(
              "Price calculation API error:",
              response.status,
              response.statusText,
            );
            setPricing(null);
          }
        } catch (error) {
          if ((error as Error)?.name === "AbortError") {
            return;
          }
          if (attempt < 2 && !controller.signal.aborted) {
            retryTimeout = setTimeout(
              () => calculatePricingAsync(attempt + 1),
              500 * (attempt + 1),
            );
          } else {
            console.warn("Price calculation error:", error);
            setPricing(null);
          }
      }
    };

    calculatePricingAsync();

    return () => {
      controller.abort();
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [debouncedPricingPayload]);

  // Extract pricing display values
  const _estimatedPrice = useMemo(() => {
    if (!pricing) return null;

    // Handle commercial properties - show contact message instead of pricing
    if (pricing.requiresCustomQuote) {
      return {
        perVisit: "Contact Us",
        monthly: "Custom Quote",
        oneTime: "Contact Us",
        requiresCustomQuote: true,
        commercialMessage: pricing.commercialMessage,
        showContactStep: true,
      };
    }

    const firstVisitAddOns = Object.fromEntries(
      Object.entries(pricing.firstVisitAddOns || {}).map(([key, value]) => [
        key,
        ((value as number) / 100).toFixed(2),
      ]),
    );

    const recurringAddOns = Object.fromEntries(
      Object.entries(pricing.recurringAddOns || {}).map(([key, value]) => [
        key,
        ((value as number) / 100).toFixed(2),
      ]),
    );

    return {
      perVisit: (pricing.perVisit / 100).toFixed(2),
      monthly: (pricing.monthly / 100).toFixed(2),
      oneTime: (pricing.oneTime / 100).toFixed(2),
      initialClean: pricing.initialClean
        ? (pricing.initialClean / 100).toFixed(2)
        : "0.00",
      initialCleanDiscount: pricing.initialCleanDiscount
        ? (pricing.initialCleanDiscount / 100).toFixed(2)
        : "0.00",
      discountedInitialClean: pricing.discountedInitialClean
        ? (pricing.discountedInitialClean / 100).toFixed(2)
        : "0.00",
      initialCleanBucket: pricing.initialCleanBucket,
      firstVisitTotal: pricing.firstVisitTotalCents
        ? (pricing.firstVisitTotalCents / 100).toFixed(2)
        : (pricing.oneTime / 100).toFixed(2),
      firstMonth: pricing.firstMonthCents
        ? (pricing.firstMonthCents / 100).toFixed(2)
        : "0.00",
      firstMonthVisits: pricing.firstMonthVisits,
      amountDueToday: pricing.amountDueToday
        ? (pricing.amountDueToday / 100).toFixed(2)
        : (pricing.monthly / 100).toFixed(2),
      fullMonthlyAmount: pricing.fullMonthlyAmount
        ? (pricing.fullMonthlyAmount / 100).toFixed(2)
        : (pricing.monthly / 100).toFixed(2),
      visitsPerMonth: pricing.visitsPerMonth,
      weekendVisitsPerMonth: pricing.weekendVisitsPerMonth,
      firstVisitAddOns,
      recurringAddOns,
      breakdown: pricing.breakdown,
      trialWeek: pricing.trialWeek,
      postTrial: pricing.postTrial,
      weekendUpgrade: pricing.weekendUpgrade,
      weekendSurchargeCents: pricing.weekendSurchargeCents ?? 0,
      weekendSurcharge: pricing.weekendSurchargeCents
        ? (pricing.weekendSurchargeCents / 100).toFixed(2)
        : "0.00",
      showContactStep: false,
    };
  }, [pricing]);

  const firstVisitDisplay = useMemo(() => {
    if (!_estimatedPrice) return null;

    const frequencyValue = quoteData.frequency?.toLowerCase() || "weekly";
    if (frequencyValue === "onetime") {
      return null;
    }

    const baseValue = parseFloat(_estimatedPrice.initialClean || "0");
    if (!(baseValue > 0)) {
      return null;
    }

    const discountedValue = parseFloat(
      _estimatedPrice.discountedInitialClean || "0",
    );

    let statusLabel: string;
    if (discountedValue <= 0.009) {
      statusLabel = "Free";
    } else if (discountedValue < baseValue - 0.009) {
      statusLabel = `Half off ($${discountedValue.toFixed(2)})`;
    } else {
      statusLabel = `$${discountedValue.toFixed(2)}`;
    }

    const helper = (() => {
      if (frequencyValue === "monthly" && discountedValue < baseValue - 0.009) {
        return "Initial clean 50% off when you start monthly service.";
      }
      if (discountedValue <= 0.009) {
        return "Initial clean included with your plan.";
      }
      return undefined;
    })();

    const addOnTotal = Object.values(
      (_estimatedPrice.firstVisitAddOns as Record<string, string> | undefined) || {},
    ).reduce((sum, value) => sum + parseFloat(value || "0"), 0);

    return {
      baseDisplay: `$${baseValue.toFixed(2)}`,
      statusLabel,
      helper,
      addOnDisplay: addOnTotal > 0 ? `$${addOnTotal.toFixed(2)}` : null,
    };
  }, [_estimatedPrice, quoteData.frequency]);

  const initialCleanBaseDisplay = useMemo(() => {
    if (firstVisitDisplay) {
      return firstVisitDisplay.baseDisplay;
    }
    if (_estimatedPrice?.initialClean) {
      return `$${Number(_estimatedPrice.initialClean).toFixed(2)}`;
    }
    if (_estimatedPrice?.oneTime) {
      return `$${Number(_estimatedPrice.oneTime).toFixed(2)}`;
    }
    if (_estimatedPrice?.perVisit) {
      return `$${Number(_estimatedPrice.perVisit).toFixed(2)}`;
    }
    return " - ";
  }, [firstVisitDisplay, _estimatedPrice]);

  const creditSummary = useMemo(() => {
    if (!_estimatedPrice) {
      return null;
    }

    const frequencyValue = quoteData.frequency?.toLowerCase();
    const perVisitValue = parseFloat(_estimatedPrice.perVisit || "0");
    const initialBase = parseFloat(_estimatedPrice.initialClean || "0");
    const discountedInitial = parseFloat(_estimatedPrice.discountedInitialClean || "0");
    const initialCredit = Math.max(initialBase - Math.max(discountedInitial, 0), 0);

    let followUpCredit = 0;
    if (frequencyValue === "daily") {
      followUpCredit = perVisitValue * 4;
    } else if (frequencyValue === "twice-weekly") {
      followUpCredit = perVisitValue;
    }

    const total = initialCredit + followUpCredit;
    if (!(total > 0)) {
      return null;
    }

    return {
      total,
      initialCredit,
      followUpCredit,
    } as const;
  }, [_estimatedPrice, quoteData.frequency]);

  const finalStepCtaLabel = useMemo(() => {
    const frequencyValue = quoteData.frequency?.toLowerCase();
    if (creditSummary && frequencyValue !== "onetime") {
      // Monthly frequency gets half off, others get FREE
      if (frequencyValue === "monthly") {
        return "Claim 50% Off Your First Week";
      }
      return "Get Your First Week Free";
    }
    return "Get Started";
  }, [creditSummary, quoteData.frequency]);

  // Enhanced analytics tracking for step progression
  useEffect(() => {
    track("quote_step_view", {
      step: currentStep + 1,
      step_name: STEPS[currentStep]?.id || "unknown",
      has_estimate: !!_estimatedPrice,
      dogs: quoteData.dogs || null,
      frequency: quoteData.frequency || null,
      property_type: quoteData.propertyType || null,
    });
  }, [
    currentStep,
    _estimatedPrice,
    quoteData.dogs,
    quoteData.frequency,
    quoteData.propertyType,
  ]);

  // Restore saved progress immediately on mount or when resume parameter changes
  useEffect(() => {
    if (hasRestoredState) {
      return;
    }

    if (typeof window === "undefined") return;

    const storage = window.localStorage;
    const resumeFlag = resumeFlagParam;

    if (resumeFlag === "0") {
      storage.removeItem(storageKey);
      storage.removeItem(LEGACY_QUOTE_STORAGE_KEY);
      
      // Check for URL params after clearing storage
      const urlZipCode = params.get("zipCode");
      const skipZipCheck = params.get("skipZipCheck") === "true";
      
      if (urlZipCode && skipZipCheck) {
        // Pre-fill the zip code and mark it as validated
        setQuoteData((prev) => ({ 
          ...prev, 
          zipCode: urlZipCode,
          zipValidated: true 
        }));
        // Skip to step 2 (service-type step, index 1)
        setCurrentStep(1);
        // Mark zip check step as completed
        setCompletedSteps([true]);
      }
      
      setHasRestoredState(true);
      return;
    }

    // Migrate legacy payloads if present
    if (!storage.getItem(storageKey)) {
      const legacyValue = storage.getItem(LEGACY_QUOTE_STORAGE_KEY);
      if (legacyValue) {
        try {
          const legacyQuote = JSON.parse(legacyValue);
          if (legacyQuote && typeof legacyQuote === "object") {
            const inferredStep = determineStepFromQuote(legacyQuote);
            const migratedPayload = {
              version: QUOTE_STORAGE_VERSION,
              migratedFrom: LEGACY_QUOTE_STORAGE_KEY,
              migratedAt: Date.now(),
              quoteData: legacyQuote,
              currentStep: inferredStep,
              completedSteps: [],
              businessId: userOrgId,
            };
            storage.setItem(storageKey, JSON.stringify(migratedPayload));
          }
        } catch (error) {
          console.error("Error migrating legacy quote state:", error);
        } finally {
          storage.removeItem(LEGACY_QUOTE_STORAGE_KEY);
        }
      }
    }

    const rawValue = storage.getItem(storageKey);

    if (!rawValue) {
      // No saved state - check for URL params immediately
      const urlZipCode = params.get("zipCode");
      const skipZipCheck = params.get("skipZipCheck") === "true";
      
      if (urlZipCode && skipZipCheck) {
        // Pre-fill the zip code and mark it as validated
        setQuoteData((prev) => ({ 
          ...prev, 
          zipCode: urlZipCode,
          zipValidated: true 
        }));
        // Skip to step 2 (service-type step, index 1)
        setCurrentStep(1);
        // Mark zip check step as completed
        setCompletedSteps([true]);
      }
      
      setHasRestoredState(true);
      return;
    }

    try {
      const parsed = JSON.parse(rawValue);

      // Support both structured payloads and legacy plain quoteData objects
      const hasStructuredPayload =
        parsed && typeof parsed === "object" && "quoteData" in parsed;
      const quotePayload = hasStructuredPayload ? parsed.quoteData : parsed;

      if (!quotePayload || typeof quotePayload !== "object") {
        throw new Error("Invalid quote payload");
      }

      if (hasStructuredPayload && parsed.version !== QUOTE_STORAGE_VERSION) {
        storage.removeItem(storageKey);
        setHasRestoredState(true);
        return;
      }

      setQuoteData((previous) => {
        const mergedConsent = {
          ...(previous.consent || {}),
          ...((quotePayload as Partial<QuoteInput>).consent || {}),
        };

        if (typeof mergedConsent.marketingOptIn !== "boolean") {
          mergedConsent.marketingOptIn = false;
        }

        const hasConsentValues = Object.keys(mergedConsent).length > 0;

        return {
          ...previous,
          ...quotePayload,
          ...(hasConsentValues ? { consent: mergedConsent } : {}),
        };
      });

      const restoredStep = hasStructuredPayload
        ? parsed.currentStep
        : determineStepFromQuote(quotePayload as Partial<QuoteInput>);

      if (typeof restoredStep === "number" && Number.isFinite(restoredStep)) {
        const clampedStep = Math.min(
          Math.max(restoredStep, 0),
          Math.max(0, STEPS.length - 1),
        );
        setCurrentStep(clampedStep);
      }

      if (
        hasStructuredPayload &&
        Array.isArray(parsed.completedSteps) &&
        parsed.completedSteps.length
      ) {
        setCompletedSteps(parsed.completedSteps as boolean[]);
      }
    } catch (error) {
      console.error("Error restoring quote from localStorage:", error);
      storage.removeItem(storageKey);
    } finally {
      setHasRestoredState(true);
    }
  }, [
    resumeFlagParam,
    storageKey,
    determineStepFromQuote,
    userOrgId,
    hasRestoredState,
  ]);

  // Persist quote progress as the user moves through the wizard
  useEffect(() => {
    if (typeof window === "undefined" || !hasRestoredState) {
      return;
    }

    try {
      const payload = {
        version: QUOTE_STORAGE_VERSION,
        updatedAt: Date.now(),
        businessId: userOrgId,
        quoteData,
        currentStep,
        completedSteps,
      };
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
      } catch (error) {
        console.error("Error saving quote to localStorage:", error);
      }
  }, [
    quoteData,
    currentStep,
    completedSteps,
    storageKey,
    userOrgId,
    hasRestoredState,
  ]);

  // (removed duplicate STEPS declaration)

  // Initialize completedSteps when STEPS is available handled by steps-length effect above

  // Analytics tracking
  useEffect(() => {
    track("quote_step_view", {
      step: currentStep + 1,
      step_name: STEPS[currentStep]?.id || "unknown",
      has_estimate: !!_estimatedPrice,
      dogs: quoteData.dogs || null,
      frequency: quoteData.frequency || null,
    });
  }, [
    currentStep,
    _estimatedPrice,
    quoteData.dogs,
    quoteData.frequency,
    STEPS,
  ]);

  // Simplified data update function
  const updateQuoteData = (
    field: keyof QuoteInput | Partial<QuoteInput>,
    value?: any,
  ) => {
    if (typeof field === "object" && field !== null) {
      const updates = field as Partial<QuoteInput>;
      setQuoteData((prev) => ({
        ...prev,
        ...updates,
      }));

      Object.keys(updates).forEach((key) => {
        if (_errors[key as keyof QuoteInput]) {
          setErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors[key as keyof QuoteInput];
            return newErrors;
          });
        }
      });
      return;
    }

    setQuoteData((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (_errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Real-time field validation handler
  const validateFieldOnBlur = (fieldName: string, value: any) => {
    const currentStepData = STEPS[currentStep];

    if (!currentStepData) return;

    const validationResult = validateField(
      currentStepData.id,
      fieldName,
      value,
      quoteData,
    );

    setFieldErrors((prev) => {
      const newErrors = { ...prev };
      if (validationResult.valid) {
        delete newErrors[fieldName];
      } else {
        newErrors[fieldName] = validationResult.error || "Invalid value";
      }
      return newErrors;
    });

    // Track field validation events
    track("field_blur_validation", {
      step: currentStep + 1,
      step_name: currentStepData.id,
      field: fieldName,
      valid: validationResult.valid,
      error: validationResult.error || null,
    });
  };

  // Simplified validation function
  const validateCurrentStep = () => {
    const newErrors: Record<string, string[]> = {};
    const currentStepData = STEPS[currentStep];

    switch (currentStepData?.id) {
      case "basics":
        // Default to residential if not set (shouldn't happen but safety check)
        const serviceType = quoteData.serviceType || "residential";

        // Dog validation - different limits for residential vs commercial
        if (serviceType === "residential") {
          if (!quoteData.dogs || quoteData.dogs < 1 || quoteData.dogs > 4) {
            newErrors.dogs = ["Please select between 1-4 dogs"];
          }
        } else if (serviceType === "commercial") {
          if (!quoteData.dogs || quoteData.dogs < 1) {
            newErrors.dogs = ["Please enter the expected number of dogs"];
          }
          if (!quoteData.businessType) {
            newErrors.businessType = ["Please select your business type"];
          }
        }

        if (!quoteData.yardSize) {
          newErrors.yardSize = [
            "Please select your service area size for accurate pricing",
          ];
        }

        // Require last cleanup selection
        if (!quoteData.deepCleanAssessment?.daysSinceLastCleanup) {
          newErrors.deepCleanAssessment = [
            "Please select when the last cleanup occurred",
          ];
        }

        // Require at least one area to be selected
        if (
          !quoteData.areasToClean ||
          !Object.values(quoteData.areasToClean).some((v) => v)
        ) {
          newErrors.areasToClean = [
            "Please select at least one area that needs service",
          ];
        }
        break;

      case "service-type":
        if (!isCommunity && !quoteData.frequency) {
          newErrors.frequency = [
            "Please choose your preferred service frequency",
          ];
        }
        break;

      case "onboarding":
        // Onboarding step is optional - no validation required
        break;

      case "community-contact":
        if (!quoteData.contact?.name?.trim()) {
          newErrors.contact = ["Please enter your full name"];
        }
        if (!quoteData.contact?.email?.trim()) {
          newErrors.contact = [
            ...(newErrors.contact || []),
            "Please enter your email address",
          ];
        } else {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(quoteData.contact.email)) {
            newErrors.contact = [
              ...(newErrors.contact || []),
              "Please enter a valid email address",
            ];
          }
        }
        const contactPhoneDigitsCommunity = (quoteData.contact?.phone || "").replace(/\D/g, "");
        if (contactPhoneDigitsCommunity && contactPhoneDigitsCommunity.length < 10) {
          newErrors.contact = [
            ...(newErrors.contact || []),
            "Please enter a valid phone number",
          ];
        }
        break;

      case "contact-review":
        // Address validation
        if (!quoteData.address?.trim()) {
          newErrors.address = ["Please enter your complete service address"];
        } else {
          // Use addressValidated if available (from Google Places autocomplete)
          if (quoteData.addressValidated) {
            // Address was validated by Google Places - trust it
            console.log(
              "Address validation: Using validated address from Google Places",
            );
          } else {
            // Fallback to manual validation for addresses entered without autocomplete
            const address = quoteData.address.trim();
            const hasNumber = /\d+/.test(address);
            const inState = /\bmn\b|minnesota/.test(address.toLowerCase());
            const serviceCities = [
              "minneapolis",
              "bloomington",
              "edina",
              "richfield",
              "eagan",
              "apple valley",
              "lakeville",
              "burnsville",
              "st cloud",
              "st. cloud",
              "sartell",
              "sauk rapids",
              "waite park",
              "st joseph",
              "cold spring",
              "rockville",
            ];
            const inCities = serviceCities.some((c) =>
              address.toLowerCase().includes(c),
            );

            if (!hasNumber || address.length < 8) {
              newErrors.address = [
                "Please enter a valid street address with a number",
              ];
            } else if (!inState) {
              newErrors.address = ["We currently only serve Minnesota"];
            } else if (!inCities) {
              newErrors.address = [
                "Please enter a valid address in our service area",
              ];
            }
          }
        }

        // Contact details validation
        const contactName = quoteData.contact?.name?.trim();
        if (!contactName) {
          newErrors["contact.name"] = ["Please enter your full name"];
        }

        const contactEmail = quoteData.contact?.email?.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!contactEmail) {
          newErrors["contact.email"] = ["Please enter your email address"];
        } else if (!emailRegex.test(contactEmail)) {
          newErrors["contact.email"] = ["Please enter a valid email address"];
        }

        const contactReviewPhoneDigits = (quoteData.contact?.phone || "").replace(/\D/g, "");
        const hasContactPhone = contactReviewPhoneDigits.length > 0;
        if (hasContactPhone && contactReviewPhoneDigits.length < 10) {
          newErrors["contact.phone"] = ["Please enter a valid phone number"];
        }

        const preferredMethods = Array.isArray(quoteData.preferredContactMethods)
          ? quoteData.preferredContactMethods.filter(Boolean)
          : [];
        if (hasContactPhone && preferredMethods.length === 0) {
          newErrors.preferredContactMethods = [
            "Select at least one way we can contact you",
          ];
        }

        if (quoteData.consent?.terms !== true) {
          newErrors["consent.terms"] = [
            "Please confirm you agree to the Privacy Policy",
          ];
        }

        break;

      default:
        // Handle any remaining step-specific validations
        break;
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      const firstInvalidKey = Object.keys(newErrors)[0];
      announceValidationErrors(
        liveRegionRef,
        newErrors[firstInvalidKey]?.[0] || "Please fix the highlighted fields.",
      );
      track("quote_step_error", {
        step: currentStep + 1,
        firstErrorField: firstInvalidKey,
      });
      setTimeout(() => {
        scrollToFirstError(fieldRefs, firstInvalidKey);
      }, 100);
      return false;
    }

    return true;
  };

  // Simplified navigation
  const handleNext = () => {
    const currentStepData = STEPS[currentStep];
    const validationResult = validateStep(currentStepData.id, quoteData);

    if (validationResult.valid) {
      // Mark current step as completed
      setCompletedSteps((prev) => {
        const next = [...prev];
        next[currentStep] = true;
        return next;
      });

      // Track successful validation
      track("quote_step_valid", { step: currentStep + 1 });

      if (currentStep < STEPS.length - 1) {
        setCurrentStep(currentStep + 1);

        // Focus on the step heading for accessibility
        setTimeout(() => {
          const stepHeading = document.querySelector(
            `[data-step="${currentStep + 1}"] h2`,
          );
          if (stepHeading) {
            (stepHeading as HTMLElement).focus();
          } else {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        }, 100);
      }
    } else {
      // Set field errors and announce to screen readers
      setErrors(validationResult.issues);
      announceValidationErrors(liveRegionRef, "Please fix the fields below");

      // Track validation error
      track("quote_step_error", {
        step: currentStep + 1,
        firstErrorField: validationResult.firstInvalidKey || null,
      });

      // Scroll to and focus first error
      setTimeout(() => {
        scrollToFirstError(fieldRefs, validationResult.firstInvalidKey);
      }, 100);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Direct step navigation
  const goToStep = (stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < STEPS.length) {
      // Allow navigation to any step, validation will happen when proceeding
      setCurrentStep(stepIndex);
    }
  };


  // Enhanced submission with form protection
  const handleSubmit = async () => {
    if (!validateCurrentStep()) {
      return;
    }

    // Check form protection (temporarily disabled)
    /*
    if (!recaptchaToken && env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
      setFormProtectionErrors(['Please complete the security verification']);
      return;
    }
    */

    setIsSubmitting(true);
    setFormProtectionErrors([]);

    try {
      // Enhanced analytics tracking
      track("quote_complete", {
        dogs: quoteData.dogs || null,
        yard_size: quoteData.yardSize || null,
        frequency: quoteData.frequency || null,
        weekend_upgrade: Boolean(quoteData.weekendUpgrade),
        property_type: quoteData.propertyType || null,
        estimated_price:
          quoteData.propertyType === "commercial"
            ? 0
            : quoteData.frequency === "onetime"
              ? parseFloat(_estimatedPrice?.oneTime || "0")
              : parseFloat(_estimatedPrice?.monthly || "0"),
        addons: JSON.stringify(quoteData.addOns) || null,
        has_health_insights: quoteData.consent?.stoolPhotosOptIn || false,
        has_recaptcha: !!recaptchaToken,
        is_commercial: quoteData.propertyType === "commercial",
      });

      // Prepare submission data with form protection
      const submissionData = {
        ...quoteData,
        businessId: userOrgId,
        pricingSnapshot: pricing,
        recaptchaToken,
        submittedAt: new Date().toISOString(),
        quoteSessionId:
          quoteSessionIdRef.current ?? (typeof window !== "undefined"
            ? getQuoteSessionId()
            : null),
        // Honeypot field (should be empty)
        honeypot: "",
      };

      const response = await fetch("/api/quote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submissionData),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          setFormProtectionErrors([
            "Too many requests. Please wait a moment and try again.",
          ]);
        } else if (result.errors) {
          setFormProtectionErrors(result.errors);
        } else {
          setFormProtectionErrors([
            "Failed to submit quote. Please try again.",
          ]);
        }
        return;
      }

      // Success - keep state so users can adjust frequency without retyping.
      if (typeof window !== "undefined") {
        clearQuoteSessionId();
      }

      const isDuplicateLead = Boolean(result.duplicateLead?.id);

      // Track successful conversion
      track("quote_conversion", {
        lead_id: result.leadId,
        protection_score: result.protectionScore || 0,
        dogs: quoteData.dogs || null,
        estimated_value:
          quoteData.propertyType === "commercial" ? 0 : pricing?.total || 0,
        is_commercial: quoteData.propertyType === "commercial",
        duplicate: isDuplicateLead,
      });

      trackQuoteEvent("quote_submit", {
        lead_id: result.leadId,
        duplicate: isDuplicateLead,
        property_type: quoteData.propertyType ?? null,
      });

      quoteCompletedRef.current = true;

      // Handle commercial vs residential success flow
      const successParams = new URLSearchParams({
        leadId: result.leadId,
        businessId: userOrgId,
      });
      if (isDuplicateLead) {
        successParams.set("duplicateLeadId", result.duplicateLead.id);
        if (result.duplicateLead.submittedAt) {
          successParams.set(
            "duplicateSubmittedAt",
            result.duplicateLead.submittedAt,
          );
        }
        if (result.duplicateLead.status) {
          successParams.set(
            "duplicateStatus",
            result.duplicateLead.status,
          );
        }
      }
      if (
        quoteData.propertyType === "commercial" ||
        quoteData.serviceType === "commercial"
      ) {
        successParams.set("commercial", "true");
      }

      const successUrl = `/quote/success?${successParams.toString()}`;

      router.push(successUrl);
    } catch (error) {
      console.error("Quote submission failed:", error);
      setFormProtectionErrors([
        "Network error. Please check your connection and try again.",
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetQuote = useCallback(() => {
    setQuoteData({ ...DEFAULT_QUOTE_DATA });
    setCurrentStep(0);
    setCompletedSteps([]);
    setErrors({});
    setFieldErrors({});
    setPricing(null);
    setFormProtectionErrors([]);
    setRecaptchaToken(null);
    setIsSubmitting(false);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(storageKey);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [storageKey]);

  // Enhanced step rendering with better component structure
  const renderStep = () => {
    const step = STEPS[currentStep];

    if (!step) {
      return (
        <div className="p-6 text-sm text-brand-muted">
          We couldn't load the next step - please try again.
        </div>
      );
    }

    let stepContent: React.ReactNode = null;

    switch (step.id) {
      case "zip-check":
        stepContent = (
          <StepZipCheck
            quoteData={quoteData as any}
            updateQuoteData={(updates) =>
              updateQuoteData(updates as Partial<QuoteInput>)
            }
            onNext={handleNext}
            orgId={userOrgId}
          />
        );
        break;
      case "service-type":
        stepContent = (
          <StepServiceType
            quoteData={quoteData as any}
            updateQuoteData={(updates) =>
              updateQuoteData(updates as Partial<QuoteInput>)
            }
            onNext={handleNext}
          />
        );
        break;
      case "basics":
        stepContent = (
          <StepBasics
            quoteData={quoteData as any}
            updateQuoteData={(updates) =>
              updateQuoteData(updates as Partial<QuoteInput>)
            }
            errors={flattenedFieldErrors}
          />
        );
        break;
      case "frequency":
        stepContent = (
          <StepFrequency
            quoteData={quoteData as any}
            updateQuoteData={(updates) =>
              updateQuoteData(updates as Partial<QuoteInput>)
            }
            _estimatedPrice={_estimatedPrice || undefined}
          />
        );
        break;
      case "customization":
        stepContent = (
          <ExternalStepCustomization
            quoteData={quoteData as any}
            updateQuoteData={(updates: any) => {
              setQuoteData((prev) => ({ ...prev, ...updates }));
            }}
            estimatedPrice={pricing || undefined}
            errors={{}}
            onNext={handleNext}
          />
        );
        break;
      case "onboarding":
        stepContent = (
          <StepOnboarding
            quoteData={quoteData as any}
            updateQuoteData={(updates: any) => {
              Object.entries(updates).forEach(([field, value]) => {
                updateQuoteData(field as any, value);
              });
            }}
            _errors={_errors}
            _estimatedPrice={_estimatedPrice || undefined}
          />
        );
        break;
      case "community-contact":
        stepContent = (
          <StepCommunityContact
            quoteData={quoteData as any}
            updateQuoteData={(updates: any) => {
              Object.entries(updates).forEach(([field, value]) => {
                updateQuoteData(field as any, value);
              });
            }}
            _errors={_errors}
          />
        );
        break;
      case "contact-review":
        stepContent = (
          <StepContactReviewComponent
            quoteData={quoteData as any}
            updateQuoteData={(updates) =>
              updateQuoteData(updates as Partial<QuoteInput>)
            }
            _errors={_errors}
            estimatedPrice={_estimatedPrice || undefined}
            onNext={() => handleNext()}
            orgId={userOrgId}
          />
        );
        break;
      default:
        stepContent = null;
    }

    return <div data-step={currentStep}>{stepContent}</div>;
  };


  const progressIndicator = (
    <div className="flex items-center gap-2">
      <span className="font-heading text-xs font-semibold text-brand-muted whitespace-nowrap dark:text-cream-vanilla/80">
        Step {currentStep + 1} of {STEPS.length}
      </span>
      <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-brand-coral/15 dark:bg-brand-coral/25">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-brand-coral to-gold"
          initial={{ width: 0 }}
          animate={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
      <span className="font-heading text-xs font-bold text-brand-ink dark:text-emerald-100">
        {Math.round(((currentStep + 1) / STEPS.length) * 100)}%
      </span>
    </div>
  );

  return (
    <div className={quoteShellClass}>
      <QuoteStepBackground stepIndex={currentStep} />
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 right-[-18%] h-72 w-72 rounded-full bg-brand-coral/20 blur-3xl" />
        <div className="absolute bottom-[-28%] left-[-12%] h-80 w-80 rounded-full bg-gold/15 blur-3xl" />
        <div className="absolute right-[12%] top-1/3 h-64 w-64 rounded-full bg-mint/10 blur-[120px]" />
      </div>

      <div
        className="relative mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 pb-40 md:max-w-6xl md:flex-col md:gap-4 md:px-6 md:pb-36"
        style={{ marginTop: "calc(env(safe-area-inset-top, 0px) + 4rem)" }}
      >
        {/* Enhanced Header with Modern Design */}
        <motion.div
          className="mt-4 md:mt-5 rounded-3xl border border-brand-coral/15 bg-cream-porcelain/95 text-brand-ink shadow-[0_18px_40px_rgba(243,100,91,0.06)] backdrop-blur-sm px-5 py-4 md:px-7 dark:border-brand-coral/30 dark:bg-evergreen-900/85 dark:text-cream-vanilla dark:shadow-[0_18px_40px_rgba(0,0,0,0.35)]"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex flex-col gap-2">
            <motion.span
                className="inline-flex w-max items-center gap-2 rounded-full border border-brand-coral/30 bg-brand-coral/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-brand-coral backdrop-blur dark:border-brand-coral/40 dark:bg-brand-coral/15 dark:text-cream-vanilla"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15, duration: 0.4 }}
              >
                <Sparkles className="size-3.5" />
                Finish in under 3 minutes
              </motion.span>

              <motion.h1
                className="font-serif text-2xl font-normal leading-tight text-brand-ink md:text-3xl lg:text-4xl dark:text-cream-vanilla"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25, duration: 0.5 }}
              >
                {currentStep === 0
                  ? "Start with your service address"
                  : STEPS[currentStep].title}
              </motion.h1>

              <motion.p
                className="text-sm leading-relaxed text-brand-muted md:text-base dark:text-cream-vanilla/80"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35, duration: 0.5 }}
              >
                Step {currentStep + 1} of {STEPS.length} · {" "}
                {STEPS[currentStep].description}
              </motion.p>

              <div className="mt-2">{progressIndicator}</div>
          </div>

          {/* Minimal step tabs for desktop */}
          <div className="hidden md:flex items-center justify-center gap-2 overflow-x-auto pb-1">
            {STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isCompleted = index < currentStep;
              const isCurrent = index === currentStep;
              const isClickable = completedSteps[index - 1] || index === 0;

              return (
                <motion.button
                  key={step.id}
                  onClick={() => isClickable && goToStep(index)}
                  className={cn(
                    quoteStepChipBase,
                    isCurrent
                      ? quoteStepChipActive
                      : isCompleted
                        ? quoteStepChipCompleted
                        : quoteStepChipIdle,
                    !isClickable && "cursor-not-allowed opacity-70",
                  )}
                  whileHover={isClickable ? { scale: 1.01 } : {}}
                  whileTap={isClickable ? { scale: 0.98 } : {}}
                  disabled={!isClickable}
                >
                  <StepIcon className="size-3" />
                  <span className="truncate max-w-[8rem]">{step.title}</span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Step Content with Responsive Two-Column Layout */}
      <div className="w-full max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24 sm:-mt-24 md:-mt-20 lg:-mt-16 xl:-mt-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Main Form Content - Conditional Layout */}
          <div className="lg:col-span-12 flex justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{
                  opacity: 0,
                  y: 30,
                  scale: 0.98,
                  filter: "blur(4px)",
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  filter: "blur(0px)",
                }}
                exit={{
                  opacity: 0,
                  y: -30,
                  scale: 1.02,
                  filter: "blur(2px)",
                }}
                transition={{
                  duration: 0.4,
                  ease: [0.25, 0.46, 0.45, 0.94], // Custom easing for smooth animation
                  filter: { duration: 0.2 },
                }}
              >
                <div className="w-full max-w-5xl pb-28 md:pb-36">{renderStep()}</div>
              </motion.div>
            </AnimatePresence>
          </div>

        </div>
      </div>

      {/* Desktop/tablet sticky footer */}
      <div className="hidden md:block fixed bottom-0 left-0 right-0 z-40 border-t border-brand-coral/15 bg-cream-porcelain/95 backdrop-blur shadow-lg dark:border-brand-coral/30 dark:bg-[#07140F]/95 dark:text-cream-vanilla dark:shadow-[0_-6px_20px_rgba(0,0,0,0.4)]">
        <div className="max-w-screen-xl mx-auto px-4 py-2">
          <QuoteStepFooter
            minimal
            currentStep={currentStep}
            totalSteps={STEPS.length}
            onBack={handleBack}
            onContinue={
              currentStep === STEPS.length - 1 ? handleSubmit : handleNext
            }
            continueDisabled={isSubmitting || !canProceed}
            continueLoading={isSubmitting}
            showBack={currentStep > 0}
            isFinalStep={currentStep === STEPS.length - 1}
            showReset
            onReset={handleResetQuote}
            resetDisabled={isSubmitting}
            finalCtaLabel={finalStepCtaLabel}
          />
        </div>
      </div>

      {/* Mobile sticky action bar: pricing + nav buttons */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-brand-coral/15 bg-cream-porcelain/95 px-3.5 py-2.5 text-brand-ink backdrop-blur shadow-lg dark:border-brand-coral/30 dark:bg-[#07140F]/95 dark:text-cream-vanilla dark:shadow-[0_-6px_20px_rgba(0,0,0,0.4)]">
        <div className="mx-auto flex max-w-screen-xl flex-col gap-2">
          <QuoteStepFooter
            minimal
            className="w-full"
            currentStep={currentStep}
            totalSteps={STEPS.length}
            onBack={handleBack}
            onContinue={
              currentStep === STEPS.length - 1 ? handleSubmit : handleNext
            }
            continueDisabled={isSubmitting || !canProceed}
            continueLoading={isSubmitting}
            showBack={currentStep > 0}
            isFinalStep={currentStep === STEPS.length - 1}
            showReset={false}
            finalCtaLabel={finalStepCtaLabel}
          />
        </div>
      </div>

      {/* Accessibility Live Region */}
      <div
        ref={liveRegionRef}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />

      {/* Auto-save indicator */}
      {/* auto-save indicator removed per UX feedback */}
    </div>
  );
}

export default function QuoteWizard() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-brand-porcelain flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[rgba(243,100,91,0.45)] mx-auto mb-4"></div>
            <p className="text-brand-muted">
              Loading your enhanced quote experience...
            </p>
          </div>
        </div>
      }
    >
      <QuoteWizardComponent />
    </Suspense>
  );
}
