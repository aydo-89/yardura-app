// Pricing estimator for Yardura dog waste removal services
// Based on competitor research and positioning strategy

import {
  mapDateToBucket,
  calculateInitialClean,
} from "./initialCleanEstimator";
import { calculatePricing } from "./configurable-pricing";
import { getBusinessConfig } from "./business-config";
import { ensureRequiredAddOns } from "./configurable-pricing";
import type { BusinessConfig } from "./business-config";
import { calcOneTimeEstimate } from "./pricing";

export type Frequency =
  | "weekly"
  | "biweekly"
  | "twice-weekly"
  | "daily"
  | "monthly"
  | "onetime";
export type YardSize = "small" | "medium" | "large" | "xl";
export type DogCount = 1 | 2 | 3 | 4;
export type PremiumOnboarding =
  | "none"
  | "essential"
  | "premium-dna"
  | "wellness-microbiome";

export interface QuoteInput {
  // Service area validation
  zipCode?: string;
  zipValidated?: boolean;
  serviceType?: "residential" | "commercial";

  // Basic service details
  dogs: number; // Changed from DogCount to allow free-form for commercial
  yardSize: YardSize;
  frequency: Frequency;
  weekendUpgrade?: boolean;

  // Property info
  propertyType?: "residential" | "commercial"; // Legacy field, use serviceType instead
  businessType?: string; // Added for commercial business type
  serviceFrequency?: string; // Added for commercial service frequency

  // Address information
  address?: string;
  addressValidated?: boolean;
  addressMeta?: {
    city?: string;
    state?: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
  };

  // Add-ons and services
  addOns?: {
    deodorize?: boolean;
    deodorizeMode?: "first-visit" | "each-visit" | "every-other" | "one-time";
    sprayDeck?: boolean;
    sprayDeckMode?: "first-visit" | "each-visit" | "every-other" | "one-time";
    divertMode?: "none" | "takeaway" | "compost";
  };

  // Cleanup timing
  lastCleanedBucket?: string;
  lastCleanedDate?: string;
  initialClean?: boolean;
  premiumOnboarding?: PremiumOnboarding;

  // Areas to clean ( inspired)
  areasToClean?: {
    frontYard?: boolean;
    backYard?: boolean;
    sideYard?: boolean;
    dogRun?: boolean;
    fencedArea?: boolean;
    other?: string;
  };

  // Contact information
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
    title?: string; // Added for commercial contacts
  };

  // Lead source ( inspired)
  howDidYouHear?: string;
  salesRepId?: string;
  salesRepName?: string;

  // Scheduling preferences
  preferredStartDate?: string;
  customStartDate?: string;
  preferredContactMethods?: string[];

  // Assessment information
  deepCleanAssessment?: {
    daysSinceLastCleanup?: number;
    currentCondition?: "excellent" | "good" | "fair" | "poor";
    specialNotes?: string;
  };

  // Special instructions ( inspired)
  specialInstructions?: string;

  // Commercial details
  commercialNotes?: string; // Added for commercial additional details

  // Consent and preferences
  consent?: {
    stoolPhotosOptIn?: boolean;
    terms?: boolean;
    marketingOptIn?: boolean;
  };
}

// Base pricing in cents (medium yard, weekly)
const BASE_PRICES: Record<DogCount, number> = {
  1: 2000, // $20.00
  2: 2400, // $24.00
  3: 2800, // $28.00
  4: 3200, // $32.00
};

// Yard size adders in cents (medium is baseline)
const YARD_ADDERS: Record<YardSize, number> = {
  small: -200, // -$2.00 (smaller yard discount)
  medium: 0, // baseline
  large: 400, // +$4.00
  xl: 800, // +$8.00
};

// Frequency multipliers
const FREQUENCY_MULTIPLIERS: Record<Frequency, number> = {
  weekly: 1.0,
  biweekly: 1.25, // Higher per-visit due to accumulation
  "twice-weekly": 0.9, // Slight discount for route density
  daily: 0.5, // Heavy density discount for daily service
  monthly: 1.5, // Highest per-visit due to accumulation
  onetime: 1.0, // Same as weekly for single service
};

// Add-on prices in cents
const ADD_ON_PRICES = {
  deodorize: 500, // +$5.00 per visit
  sprayDeck: 1200, // +$12.00
  takeaway: 500, // +$5.00 per visit for basic take away
  compost: 1000, // +$10.00 per visit for compost routing
};

// One-time service base pricing (competitive with $89-100 market)
const ONE_TIME_BASE_PRICES = {
  small: 4900, // $49 - small yards
  medium: 6900, // $69 - medium yards (most common)
  large: 8900, // $89 - large yards
  xl: 11900, // $119 - extra large yards
};

// Deep clean assessment multipliers based on time since last cleanup ( style)
const DEEP_CLEAN_MULTIPLIERS: Record<number, number> = {
  7: 1.0, // < 2 weeks - well maintained, minimal accumulation ($89-149)
  21: 1.15, // 2-6 weeks - moderate accumulation, needs attention ($102-171)
  60: 1.25, // 1-3 months - significant accumulation ($111-186)
  90: 1.35, // 3+ months - major deep clean recommended ($120-201)
  // Legacy values for backward compatibility
  14: 1.1, // 1-2 weeks - moderate accumulation ($98-164)
  30: 1.15, // 2-4 weeks - significant accumulation ($102-171)
  999: 1.5, // Over 3 months - extreme accumulation ($134-224)
};

// Premium onboarding options in cents
export const PREMIUM_ONBOARDING_PRICES: Record<PremiumOnboarding, number> = {
  none: 0,
  essential: 9900, // $99.00
  "premium-dna": 24900, // $249.00
  "wellness-microbiome": 34900, // $349.00
};

type PricingFrequency =
  | "weekly"
  | "twice-weekly"
  | "daily"
  | "bi-weekly"
  | "monthly"
  | "one-time";

type SupportedAddonMode =
  | "first-visit"
  | "each-visit"
  | "every-other"
  | "one-time";

const FREQUENCY_TO_PRICING: Record<Frequency, PricingFrequency> = {
  weekly: "weekly",
  biweekly: "bi-weekly",
  "twice-weekly": "twice-weekly",
  daily: "daily",
  monthly: "monthly",
  onetime: "one-time",
};

const DIVERT_MODE_TO_ADDON_ID: Record<string, string> = {
  takeaway: "divert-takeaway",
  compost: "divert-compost",
};

const LEGACY_DIVERT_KEY_PATTERN = /^divert-\d+$/;
const LEGACY_DIVERT_MODE_PATTERN = /^\d{1,3}%?$/;

const EMPTY_FIRST_VISIT_ADDONS = () => ({
  deodorize: 0,
  sprayDeck: 0,
  other: 0,
});

const EMPTY_RECURRING_ADDONS = () => ({
  deodorize: 0,
  sprayDeck: 0,
  divert: 0,
  other: 0,
});

function toPricingFrequency(frequency: Frequency): PricingFrequency {
  return FREQUENCY_TO_PRICING[frequency] ?? "weekly";
}

function normalizeAddOnMode(mode?: string): SupportedAddonMode {
  if (!mode) return "each-visit";
  const normalized = mode.toLowerCase();
  if (normalized === "none") return "each-visit";
  if (normalized === "onetime" || normalized === "one-time") return "one-time";
  if (
    normalized === "first-visit" ||
    normalized === "each-visit" ||
    normalized === "every-other"
  ) {
    return normalized as SupportedAddonMode;
  }
  return "each-visit";
}

type RawAddOnsInput =
  | QuoteInput["addOns"]
  | Record<string, any>
  | undefined
  | null;

function coerceBooleanSelection(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["false", "no", "0", "none", "off"].includes(normalized)) {
      return false;
    }
    return normalized.length > 0;
  }
  if (value && typeof value === "object") return true;
  return false;
}

function extractMode(value: unknown, fallback?: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object" && "mode" in (value as any)) {
    const candidate = (value as any).mode;
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  if (typeof fallback === "string" && fallback.trim()) return fallback;
  return undefined;
}

function normalizeQuoteAddOns(rawAddons: RawAddOnsInput): QuoteInput["addOns"] | undefined {
  if (!rawAddons) return undefined;

  const source = rawAddons as Record<string, any>;
  const normalized: QuoteInput["addOns"] = {};

  const resolveAddOn = (
    selectionValue: unknown,
    explicitMode?: unknown,
  ): { selected: boolean; mode?: SupportedAddonMode } => {
    const rawMode = extractMode(selectionValue, explicitMode);
    if (rawMode && rawMode.toLowerCase() === "none") {
      return { selected: false };
    }
    const mode = rawMode ? normalizeAddOnMode(rawMode) : undefined;
    let selected = coerceBooleanSelection(selectionValue);
    if (!selected && mode) {
      // Mode implies intentional selection even if value not explicitly true
      selected = true;
    }
    return { selected, mode };
  };

  const deodorizeSelection = source.deodorize ?? source["deodorize"];
  const deodorizeModeSource = source.deodorizeMode;
  const deodorizeResult = resolveAddOn(deodorizeSelection, deodorizeModeSource);
  if (!deodorizeResult.mode && deodorizeSelection && typeof deodorizeSelection === "object") {
    const candidate = (deodorizeSelection as any).mode;
    if (typeof candidate === "string") {
      deodorizeResult.mode = normalizeAddOnMode(candidate);
    }
  }
  if (deodorizeResult.selected) {
    normalized.deodorize = true;
    if (deodorizeResult.mode) normalized.deodorizeMode = deodorizeResult.mode;
  }

  const sprayDeckSelection =
    source.sprayDeck ?? source["spray-deck"] ?? source["spraydeck"];
  const sprayDeckModeSource =
    source.sprayDeckMode ?? source["spray-deck-mode"];
  const sprayDeckResult = resolveAddOn(
    sprayDeckSelection,
    sprayDeckModeSource,
  );
  if (!sprayDeckResult.mode && sprayDeckSelection && typeof sprayDeckSelection === "object") {
    const candidate = (sprayDeckSelection as any).mode;
    if (typeof candidate === "string") {
      sprayDeckResult.mode = normalizeAddOnMode(candidate);
    }
  }
  if (sprayDeckResult.selected) {
    normalized.sprayDeck = true;
    if (sprayDeckResult.mode) normalized.sprayDeckMode = sprayDeckResult.mode;
  }

  let divertMode = extractMode(source.divertMode, source["divert-mode"]);
  if (!divertMode || divertMode === "none") {
    if (source["divert-takeaway"]) divertMode = "takeaway";
    else if (source["divert-compost"]) divertMode = "compost";
    else if (Object.keys(source).some((key) => LEGACY_DIVERT_KEY_PATTERN.test(key))) {
      divertMode = "compost";
    }
  }
  if (typeof divertMode === "string") {
    const normalizedDivert = divertMode.toLowerCase().trim();
    if (normalizedDivert === "takeaway" || normalizedDivert === "compost") {
      (normalized as Record<string, any>).divertMode = normalizedDivert;
    } else if (LEGACY_DIVERT_MODE_PATTERN.test(normalizedDivert)) {
      (normalized as Record<string, any>).divertMode = "compost";
    }
  }

  Object.entries(source)
    .filter(([key]) => ![
        "deodorize",
        "deodorizeMode",
        "sprayDeck",
        "sprayDeckMode",
        "spray-deck",
        "spray-deck-mode",
        "divertMode",
        "divert-mode",
        "divert-takeaway",
        "divert-compost",
      ].includes(key) && !LEGACY_DIVERT_KEY_PATTERN.test(key))
    .forEach(([key, value]) => {
      if (key.endsWith("Mode")) return;
      if (typeof value === "boolean" && value) {
        (normalized as Record<string, any>)[key] = true;
        return;
      }
      if (value && typeof value === "object") {
        const modeResult = resolveAddOn(value, (value as any)?.mode);
        if (modeResult.selected) {
          (normalized as Record<string, any>)[key] = true;
          if (modeResult.mode) {
            (normalized as Record<string, any>)[`${key}Mode`] = modeResult.mode;
          }
        }
      }
    });

  return Object.keys(normalized).length ? normalized : undefined;
}

function normalizeYardSizeForPricing(
  yardSize: YardSize,
): "small" | "medium" | "large" | "xlarge" {
  if (yardSize === "xl") return "xlarge";
  return yardSize as "small" | "medium" | "large" | "xlarge";
}

function mapAddonsToPricingInput(
  addons?: QuoteInput["addOns"],
): Record<string, boolean | { mode: SupportedAddonMode }> {
  if (!addons) return {};

  const mapped: Record<string, boolean | { mode: SupportedAddonMode }> = {};

  if (addons.deodorize) {
    mapped.deodorize = { mode: normalizeAddOnMode(addons.deodorizeMode) };
  }

  if (addons.sprayDeck) {
    mapped["spray-deck"] = { mode: normalizeAddOnMode(addons.sprayDeckMode) };
  }

  if (addons.divertMode && addons.divertMode !== "none") {
    const addOnId = DIVERT_MODE_TO_ADDON_ID[addons.divertMode];
    if (addOnId) {
      mapped[addOnId] = true;
    }
  }

  Object.entries(addons)
    .filter(
      ([key, value]) =>
        ![
          "deodorize",
          "deodorizeMode",
          "sprayDeck",
          "sprayDeckMode",
          "divertMode",
        ].includes(key) && typeof value === "boolean" && value,
    )
    .forEach(([key]) => {
      mapped[key] = true;
    });

  return mapped;
}

function sumObjectValues(map: Record<string, number>): number {
  return Object.values(map).reduce((total, amount) => total + amount, 0);
}

function resolveInitialCleanBucket(input: {
  lastCleanedBucket?: string;
  lastCleanedDate?: string;
  deepCleanAssessment?: { daysSinceLastCleanup?: number };
}): string {
  if (input.lastCleanedBucket) return input.lastCleanedBucket;

  if (input.lastCleanedDate) {
    const cleanupDate = new Date(input.lastCleanedDate);
    if (!Number.isNaN(cleanupDate.valueOf())) {
      return mapDateToBucket(cleanupDate);
    }
  }

  const daysSinceLastCleanup = input.deepCleanAssessment?.daysSinceLastCleanup;
  if (typeof daysSinceLastCleanup === "number" && daysSinceLastCleanup >= 0) {
    return daysSinceLastCleanup.toString();
  }

  return "14";
}

function calculateAddOnBreakdown(
  input: { addons?: QuoteInput["addOns"]; frequency: Frequency },
  businessConfig: BusinessConfig,
  multipliers: {
    yardMultiplier: number;
    zoneMultiplier: number;
    frequencyMultiplier: number;
  },
) {
  const firstVisitAddOns = EMPTY_FIRST_VISIT_ADDONS();
  const recurringAddOns = EMPTY_RECURRING_ADDONS();

  const addons = input.addons;

  if (!addons) {
    return { firstVisitAddOns, recurringAddOns };
  }

  const priceMap = new Map<string, number>(
    businessConfig.basePricing.addOns.map((addon) => [addon.id, addon.priceCents]),
  );

  const yardZoneMultiplier =
    Math.max(0, multipliers.yardMultiplier || 0) === 0
      ? multipliers.zoneMultiplier || 1
      : (multipliers.yardMultiplier || 1) * (multipliers.zoneMultiplier || 1);
  const frequencyMultiplier = multipliers.frequencyMultiplier || 1;

  const applyFirstVisitScaling = (price: number) =>
    Math.round(price * yardZoneMultiplier);

  const applyRecurringScaling = (price: number) =>
    price * yardZoneMultiplier * frequencyMultiplier;

  const frequency = input.frequency;

  const hasDeodorize =
    addons.deodorize ||
    typeof addons.deodorizeMode === "string" ||
    (addons as any)["deodorizeMode"];

  if (hasDeodorize) {
    const price = priceMap.get("deodorize") ?? 0;
    const firstVisitPrice = applyFirstVisitScaling(price);
    const recurringPrice = applyRecurringScaling(price);
    const mode = normalizeAddOnMode(addons.deodorizeMode);

    if (frequency === "onetime") {
      firstVisitAddOns.deodorize += firstVisitPrice;
    } else if (mode === "first-visit" || mode === "one-time") {
      firstVisitAddOns.deodorize += Math.round(recurringPrice);
    } else if (mode === "every-other") {
      recurringAddOns.deodorize += Math.round(recurringPrice / 2);
    } else {
      recurringAddOns.deodorize += Math.round(recurringPrice);
    }
  }

  const hasSprayDeck =
    addons.sprayDeck ||
    typeof addons.sprayDeckMode === "string" ||
    (addons as any)["sprayDeckMode"];

  if (hasSprayDeck) {
    const price = priceMap.get("spray-deck") ?? 0;
    const firstVisitPrice = applyFirstVisitScaling(price);
    const recurringPrice = applyRecurringScaling(price);
    const mode = normalizeAddOnMode(addons.sprayDeckMode);

    if (frequency === "onetime") {
      firstVisitAddOns.sprayDeck += firstVisitPrice;
    } else if (mode === "first-visit" || mode === "one-time") {
      firstVisitAddOns.sprayDeck += Math.round(recurringPrice);
    } else if (mode === "every-other") {
      recurringAddOns.sprayDeck += Math.round(recurringPrice / 2);
    } else {
      recurringAddOns.sprayDeck += Math.round(recurringPrice);
    }
  }

  if (addons.divertMode && addons.divertMode !== "none") {
    const addOnId = DIVERT_MODE_TO_ADDON_ID[addons.divertMode];
    if (addOnId) {
      const basePrice = priceMap.get(addOnId) ?? 0;
      const firstVisitPrice = applyFirstVisitScaling(basePrice);
      const recurringPrice = applyRecurringScaling(basePrice);
      if (frequency === "onetime") {
        firstVisitAddOns.other += firstVisitPrice;
      } else {
        recurringAddOns.divert += Math.round(recurringPrice);
      }
    }
  }

  Object.entries(addons)
    .filter(
      ([key, value]) =>
        ![
          "deodorize",
          "deodorizeMode",
          "sprayDeck",
          "sprayDeckMode",
          "divertMode",
        ].includes(key) && typeof value === "boolean" && value,
    )
    .forEach(([key]) => {
      const price = priceMap.get(key);
      if (!price) return;
      if (frequency === "onetime") {
        firstVisitAddOns.other += applyFirstVisitScaling(price);
      } else {
        recurringAddOns.other += Math.round(applyRecurringScaling(price));
      }
    });

  return { firstVisitAddOns, recurringAddOns };
}

interface BuildPricingResponseParams {
  input: {
    dogs: number;
    yardSize: YardSize;
    frequency: Frequency;
    addons?: QuoteInput["addOns"];
    premiumOnboarding?: PremiumOnboarding;
    areasToClean?: QuoteInput["areasToClean"];
    businessId?: string;
    zoneMultiplier?: number;
    deepCleanAssessment?: QuoteInput["deepCleanAssessment"];
    lastCleanedBucket?: string;
    lastCleanedDate?: string;
  };
  perVisitCents: number;
  monthlyCents: number;
  oneTimeCents: number;
  visitsPerMonth: number;
  basePerVisitRawCents: number;
  breakdown: any;
  businessConfig: BusinessConfig;
  weekendUpgrade?: boolean;
  weekendSurchargeCents?: number;
}

async function buildPricingResponse({
  input,
  perVisitCents,
  monthlyCents,
  oneTimeCents,
  visitsPerMonth: calculatedVisitsPerMonth,
  basePerVisitRawCents,
  breakdown,
  businessConfig,
  weekendUpgrade,
  weekendSurchargeCents,
}: BuildPricingResponseParams) {
  const weekendUpgradeEnabled = Boolean(weekendUpgrade);

  const visitsPerMonthValue = calculatedVisitsPerMonth;
  const weekendVisitsPerMonthValue = weekendUpgradeEnabled
    ? visitsPerMonth(input.frequency, { weekendUpgrade: true })
    : null;
  const yardMultiplier = breakdown?.yardMultiplier ?? 1;
  const zoneMultiplierUsed =
    breakdown?.zoneMultiplier ?? input.zoneMultiplier ?? 1;
  const frequencyMultiplierUsed = breakdown?.frequencyMultiplier ?? 1;

  const { firstVisitAddOns, recurringAddOns } = calculateAddOnBreakdown(
    { addons: input.addons, frequency: input.frequency },
    businessConfig,
    {
      yardMultiplier,
      zoneMultiplier: zoneMultiplierUsed,
      frequencyMultiplier: frequencyMultiplierUsed,
    },
  );

  const firstVisitAddOnsTotal = sumObjectValues(firstVisitAddOns);
  const recurringAddOnsTotal = sumObjectValues(recurringAddOns);

  const premiumOnboardingCents =
    input.premiumOnboarding && input.premiumOnboarding !== "none"
      ? PREMIUM_ONBOARDING_PRICES[input.premiumOnboarding]
      : 0;

  const initialCleanBucket = resolveInitialCleanBucket({
    lastCleanedBucket: input.lastCleanedBucket,
    lastCleanedDate: input.lastCleanedDate,
    deepCleanAssessment: input.deepCleanAssessment,
  });

  const initialCleanEstimate = await calculateInitialClean(
    Math.round((basePerVisitRawCents || 0) * yardMultiplier) || basePerVisitRawCents,
    initialCleanBucket as any,
    input.dogs as DogCount,
    input.yardSize,
    input.areasToClean,
    input.businessId,
    zoneMultiplierUsed,
  );

  const initialCleanCents = initialCleanEstimate.initialCleanCents;

  // Treat the initial clean as part of the free trial week for every recurring cadence.
  // The customer sees the full value, but the credit cancels it before the first paid invoice.
  // One-time services are excluded from the trial framing.
  const isRecurringService = input.frequency !== "onetime";

  let initialCleanDiscount = 0;
  if (isRecurringService) {
    if (input.frequency === "monthly") {
      initialCleanDiscount = Math.round(initialCleanCents * 0.5);
    } else {
      initialCleanDiscount = initialCleanCents;
    }
  }

  const discountedInitialClean = Math.max(
    0,
    initialCleanCents - initialCleanDiscount,
  );

  // First-visit-only add-ons and premium onboarding are deferred to the first paid visit after the trial week.
  let firstPaidVisitAddOnsCents = firstVisitAddOnsTotal;
  const firstPaidVisitAddOnsBreakdown = { ...firstVisitAddOns };
  if (isRecurringService && premiumOnboardingCents > 0) {
    firstPaidVisitAddOnsCents += premiumOnboardingCents;
    firstPaidVisitAddOnsBreakdown.other += premiumOnboardingCents;
  }

  let firstVisitTotalCents = discountedInitialClean;

  if (input.frequency === "onetime") {
    firstVisitTotalCents +=
      recurringAddOnsTotal + firstVisitAddOnsTotal + premiumOnboardingCents;
  }

  const weekendSurchargeApplied = weekendSurchargeCents ?? 0;

  const freeVisitCount = (() => {
    if (!isRecurringService) return 0;
    if (input.frequency === "daily") {
      return weekendUpgradeEnabled ? 6 : 4;
    }
    if (input.frequency === "twice-weekly") {
      return 1;
    }
    return 0;
  })();

  const trialFollowUpVisitCount = freeVisitCount;
  const trialFollowUpVisitsValueCents = perVisitCents * trialFollowUpVisitCount;
  const trialWeekValueCents = initialCleanCents + trialFollowUpVisitsValueCents;

  const trialLengthDays = !isRecurringService
    ? 0
    : input.frequency === "biweekly"
      ? 14
      : input.frequency === "monthly"
        ? 7
        : 7;

  const firstMonthVisits = null;

  const firstMonthCents = null;

  const amountDueToday = input.frequency === "onetime" ? firstVisitTotalCents : 0;

  const computedOneTimeCents =
    input.frequency === "onetime"
      ? Math.max(
          oneTimeCents,
          discountedInitialClean +
            firstVisitAddOnsTotal +
            recurringAddOnsTotal +
            premiumOnboardingCents,
        )
      : firstVisitTotalCents;

  const result = {
    perVisit: perVisitCents,
    monthly: monthlyCents,
    visitsPerMonth: visitsPerMonthValue,
    weekendVisitsPerMonth: weekendVisitsPerMonthValue,
    oneTime: computedOneTimeCents,
    total: input.frequency === "onetime" ? computedOneTimeCents : monthlyCents,
    amountDueToday,
    firstMonthCents,
    firstMonthVisits,
    firstVisitTotalCents,
    firstVisitAddOns: firstPaidVisitAddOnsBreakdown,
    recurringAddOns,
    firstVisitAddOnsTotal: firstPaidVisitAddOnsCents,
    recurringAddOnsTotal,
    initialClean: initialCleanCents,
    initialCleanCents,
    initialCleanDiscount,
    discountedInitialClean,
    initialCleanBucket,
    premiumOnboarding: premiumOnboardingCents,
    weekendUpgrade: weekendUpgradeEnabled,
    weekendSurchargeCents: weekendSurchargeApplied,
    breakdown: {
      ...breakdown,
      firstVisitAddOns: firstPaidVisitAddOnsBreakdown,
      recurringAddOns,
      firstVisitAddOnsTotal: firstPaidVisitAddOnsCents,
      recurringAddOnsTotal,
      weekendSurchargeCents: weekendSurchargeApplied,
    },
    zoneMultiplier: breakdown?.zoneMultiplier ?? input.zoneMultiplier ?? 1,
    fullMonthlyAmount: monthlyCents,
    trialWeek: isRecurringService
      ? {
          initialCleanCents,
          followUpVisitCount: trialFollowUpVisitCount,
          followUpVisitsCents: trialFollowUpVisitsValueCents,
          addOnCents: 0,
          totalValueCents: trialWeekValueCents,
          creditsCents: {
            initialClean: initialCleanDiscount,
            followUpVisits: trialFollowUpVisitsValueCents,
            addOns: 0,
            total: initialCleanDiscount + trialFollowUpVisitsValueCents,
          },
          netDueCents: Math.max(
            trialWeekValueCents - (initialCleanDiscount + trialFollowUpVisitsValueCents),
            0,
          ),
          trialLengthDays,
        }
      : null,
    postTrial: isRecurringService
      ? {
          recurringPerVisitCents: perVisitCents,
          recurringMonthlyCents: monthlyCents,
          firstInvoiceAddOnsCents: firstPaidVisitAddOnsCents,
          firstInvoiceAddOns: firstPaidVisitAddOnsBreakdown,
          premiumOnboardingCents:
            isRecurringService ? premiumOnboardingCents : 0,
          activationDelayDays: trialLengthDays,
        }
      : null,
  };

  return result;
}

/**
 * Calculate per-visit price in cents
 */
export function estimatePerVisitCents(
  dogs: number,
  yardSize: YardSize,
  frequency: Frequency,
): number {
  // Handle commercial properties with flexible dog counts
  const basePrice =
    BASE_PRICES[dogs as DogCount] || BASE_PRICES[4] + (dogs - 4) * 200; // $2 extra per additional dog
  const yardAdder = YARD_ADDERS[yardSize];
  const multiplier = FREQUENCY_MULTIPLIERS[frequency];

  return Math.round((basePrice + yardAdder) * multiplier);
}

/**
 * Calculate base per-visit price in cents WITHOUT any frequency multiplier
 * Use this for initial clean so it does not change when frequency changes
 */
export function estimateBasePerVisitCents(
  dogs: number,
  yardSize: YardSize,
): number {
  const basePrice =
    BASE_PRICES[dogs as DogCount] || BASE_PRICES[4] + (dogs - 4) * 200;
  const yardAdder = YARD_ADDERS[yardSize];
  return Math.round(basePrice + yardAdder);
}

/**
 * Calculate visits per month based on frequency
 * Uses calendar-based calculation for accurate monthly pricing
 */
export function visitsPerMonth(
  frequency: Frequency,
  options?: { weekendUpgrade?: boolean },
): number {
  const weekendUpgrade = Boolean(options?.weekendUpgrade);
  switch (frequency) {
    case "daily":
      return Math.round((((weekendUpgrade ? 7 : 5) * 52) / 12) * 100) / 100;
    case "twice-weekly":
      // 2 visits per week * 52 weeks / 12 months = 8.67 visits per month
      return Math.round(((2 * 52) / 12) * 100) / 100; // 8.67
    case "weekly":
      // 1 visit per week * 52 weeks / 12 months = 4.33 visits per month
      return Math.round(((1 * 52) / 12) * 100) / 100; // 4.33
    case "biweekly":
      // 1 visit per 2 weeks = 0.5 visits per week * 52 weeks / 12 months = 2.17 visits per month
      return Math.round(((0.5 * 52) / 12) * 100) / 100; // 2.17
    case "monthly":
      // Bill monthly using the weekly cadence average so every month is flat
      return Math.round(((1 * 52) / 12) * 100) / 100; // ~4.33
    case "onetime":
      return 1; // One-time service
    default:
      return Math.round(((1 * 52) / 12) * 100) / 100; // 4.33
  }
}

/**
 * Get accurate visit range for frequency (accounts for calendar variations)
 */
export function getVisitRange(
  frequency: Frequency,
  options?: { weekendUpgrade?: boolean },
): {
  min: number;
  max: number;
  average: number;
} {
  const weekendUpgrade = Boolean(options?.weekendUpgrade);
  switch (frequency) {
    case "daily":
      if (weekendUpgrade) {
        return {
          min: 28,
          max: 31,
          average: Math.round(((7 * 52) / 12) * 100) / 100,
        };
      }
      return { min: 20, max: 23, average: Math.round(((5 * 52) / 12) * 100) / 100 };
    case "twice-weekly":
      // 2 visits/week * 52 weeks = 104 visits/year / 12 months = ~8.67 visits/month
      return { min: 8, max: 9, average: 8.67 };
    case "weekly":
      // 1 visit/week * 52 weeks = 52 visits/year / 12 months = ~4.33 visits/month
      return { min: 4, max: 5, average: 4.33 };
    case "biweekly":
      // 0.5 visits/week * 52 weeks = 26 visits/year / 12 months = ~2.17 visits/month
      return { min: 2, max: 3, average: 2.17 };
    case "monthly":
      return { min: 4, max: 5, average: 4.33 };
    case "onetime":
      return { min: 1, max: 1, average: 1 };
    default:
      return { min: 4, max: 5, average: 4.33 };
  }
}

/**
 * Get calendar-aware pricing explanation
 */
export function getCalendarPricingNote(
  frequency: Frequency,
  options?: { weekendUpgrade?: boolean },
): string {
  if (frequency === "onetime" || frequency === "monthly") return "";

  const range = getVisitRange(frequency, options);
  if (range.min === range.max) return "";

  return `Pricing is calculated using the annual average of ${range.average} visits per month for fair and consistent billing.`;
}

/**
 * Calculate projected monthly cost in cents using calendar-based calculation
 */
export function projectedMonthlyCents(
  perVisitCents: number,
  frequency: Frequency,
  options?: { weekendUpgrade?: boolean },
  addOns: { deodorize?: boolean } = {},
): number {
  // Note: perVisitCents already includes deodorize cost, so don't add it again
  // This function should only handle the base calculation without add-ons
  const averageVisitsPerMonth = visitsPerMonth(frequency, options);
  return Math.round(perVisitCents * averageVisitsPerMonth);
}

/**
 * Calculate initial clean cost in cents
 */
export function initialCleanCents(
  perVisitCents: number,
  addOns: { deodorize?: boolean } = {},
): number {
  // For initial clean, we apply deodorize once since it's the first visit
  const deodorizeCost = addOns.deodorize ? ADD_ON_PRICES.deodorize : 0;

  // Use a simple multiplier for initial clean (25% markup)
  const baseInitialClean = Math.round((perVisitCents + deodorizeCost) * 1.25);
  return Math.max(baseInitialClean, 8900); // Minimum $89
}

/**
 * Get pricing breakdown for display
 */
export function getPricingBreakdown(
  dogs: number,
  yardSize: YardSize,
  frequency: Frequency,
  addOns: { deodorize?: boolean } = {},
  zoneMultiplier: number = 1.0,
  options?: { weekendUpgrade?: boolean },
) {
  const perVisitCents = Math.round(
    estimatePerVisitCents(dogs, yardSize, frequency) * zoneMultiplier,
  );
  const monthlyCents = Math.round(
    projectedMonthlyCents(perVisitCents, frequency, options, addOns) * zoneMultiplier,
  );
  const initialCleanCentsValue = Math.round(
    initialCleanCents(perVisitCents, addOns) * zoneMultiplier,
  );
  const visitsPerMonthValue = visitsPerMonth(frequency, options);

  return {
    perVisitCents,
    monthlyCents,
    initialCleanCents: initialCleanCentsValue,
    visitsPerMonth: visitsPerMonthValue,
    breakdown: {
      basePrice: Math.round(
        (BASE_PRICES[dogs as DogCount] || BASE_PRICES[4] + (dogs - 4) * 200) *
          zoneMultiplier,
      ),
      yardAdder: Math.round(YARD_ADDERS[yardSize] * zoneMultiplier),
      frequencyMultiplier: FREQUENCY_MULTIPLIERS[frequency],
      addOnCents: addOns.deodorize
        ? Math.round(ADD_ON_PRICES.deodorize * zoneMultiplier)
        : 0,
      zoneMultiplier,
    },
  };
}

/**
 * Format cents to currency string
 */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/**
 * Get frequency display name
 */
export function getFrequencyDisplayName(
  frequency: Frequency,
  options?: { weekendUpgrade?: boolean },
): string {
  switch (frequency) {
    case "weekly":
      return "Weekly";
    case "biweekly":
      return "Every Other Week";
    case "twice-weekly":
      return "Twice Weekly";
    case "daily":
      return options?.weekendUpgrade ? "Daily (Mon–Sun)" : "Daily (Mon–Fri)";
    case "monthly":
      return "Monthly";
    case "onetime":
      return "One-Time";
    default:
      return "Weekly";
  }
}

/**
 * Get yard size display name
 */
export function getYardSizeDisplayName(yardSize: YardSize): string {
  switch (yardSize) {
    case "small":
      return "Small";
    case "medium":
      return "Medium";
    case "large":
      return "Large";
    case "xl":
      return "Extra Large";
    default:
      return "Medium";
  }
}

/**
 * Calculate complete price breakdown for display using configurable pricing
 */

type CalculatePriceInput = {
  dogs: number;
  yardSize: YardSize;
  frequency: Frequency;
  addons?: QuoteInput["addOns"];
  initialClean?: boolean;
  premiumOnboarding?: PremiumOnboarding;
  deepCleanAssessment?: {
    daysSinceLastCleanup?: number;
    currentCondition?: "excellent" | "good" | "fair" | "poor";
    specialNotes?: string;
  };
  propertyType?: "residential" | "commercial";
  address?: string;
  lastCleanedBucket?: string;
  lastCleanedDate?: string;
  zoneMultiplier?: number;
  areasToClean?: {
    frontYard?: boolean;
    backYard?: boolean;
    sideYard?: boolean;
    dogRun?: boolean;
    fencedArea?: boolean;
    other?: string;
  };
  businessId?: string;
  weekendUpgrade?: boolean;
};

export async function calculatePrice(input: CalculatePriceInput) {
  const isCommercialProperty =
    input.propertyType === "commercial" ||
    (input.address &&
      /park|hotel|motel|apartment|condo|business|office|store|restaurant|school|church|community|facility/i.test(
        input.address,
      ));

  if (isCommercialProperty) {
    return {
      perVisit: 0,
      monthly: 0,
      visitsPerMonth: 0,
      oneTime: 0,
      total: 0,
      amountDueToday: 0,
      firstMonthCents: 0,
      firstMonthVisits: 0,
      firstVisitTotalCents: 0,
      firstVisitAddOns: EMPTY_FIRST_VISIT_ADDONS(),
      recurringAddOns: EMPTY_RECURRING_ADDONS(),
      initialClean: 0,
      initialCleanCents: 0,
      initialCleanDiscount: 0,
      discountedInitialClean: 0,
      initialCleanBucket: "14",
      premiumOnboarding: 0,
      breakdown: {
        basePrice: 0,
        yardAdder: 0,
        frequencyMultiplier: 0,
        addOnCents: 0,
        zoneMultiplier: input.zoneMultiplier ?? 1,
      },
      fullMonthlyAmount: 0,
      requiresCustomQuote: true,
      commercialMessage:
        "Commercial properties require a custom quote. Please contact us for pricing.",
    };
  }

  const businessId = input.businessId || "yardura";
  const zoneMultiplier = input.zoneMultiplier || 1.0;

  const businessConfig = ensureRequiredAddOns(
    await getBusinessConfig(input.businessId || "yardura"),
  );
  const weekendOptions = { weekendUpgrade: Boolean(input.weekendUpgrade) };
  const weekendSurchargeCents = input.weekendUpgrade
    ? businessConfig.settings?.weekendSurchargeCents ?? 0
    : 0;

  const pricingFrequency = toPricingFrequency(input.frequency);
  const yardSizeForPricing = normalizeYardSizeForPricing(input.yardSize);

  const normalizedAddons = normalizeQuoteAddOns(input.addons);

  const addonsForPricing = mapAddonsToPricingInput(normalizedAddons);
  const normalizedInput = {
    ...input,
    addons: normalizedAddons,
    businessId,
    zoneMultiplier,
  };

  try {
    const pricingResult = await calculatePricing({
      dogs: normalizedInput.dogs,
      yardSize: yardSizeForPricing,
      frequency: pricingFrequency,
      addOns: addonsForPricing,
      areasToClean: normalizedInput.areasToClean,
      zoneMultiplier,
      businessId,
      weekendUpgrade: normalizedInput.weekendUpgrade,
    });

    const businessConfig = ensureRequiredAddOns(await getBusinessConfig(businessId));

    return await buildPricingResponse({
      input: normalizedInput,
      perVisitCents: Math.round(pricingResult.perVisitCents),
      monthlyCents: Math.round(pricingResult.monthlyCents),
      oneTimeCents: Math.round(pricingResult.oneTimeCents),
      visitsPerMonth: pricingResult.visitsPerMonth,
      basePerVisitRawCents: pricingResult.breakdown.basePrice,
      breakdown: pricingResult.breakdown,
      businessConfig,
      weekendUpgrade: normalizedInput.weekendUpgrade,
      weekendSurchargeCents,
    });
  } catch (error) {
    console.warn(
      "Configurable pricing failed, falling back to legacy system:",
      error,
    );

    return await calculatePriceLegacy({
      input: normalizedInput,
    });
  }
}

interface LegacyPricingParams {
  input: CalculatePriceInput & {
    businessId: string;
    zoneMultiplier: number;
  };
}

async function calculatePriceLegacy({ input }: LegacyPricingParams) {
  const zoneMultiplier = input.zoneMultiplier || 1.0;
  const businessConfig = ensureRequiredAddOns(
    await getBusinessConfig(input.businessId || "yardura"),
  );
  const weekendUpgradeFlag = Boolean(input.weekendUpgrade);
  const weekendOptions = { weekendUpgrade: weekendUpgradeFlag };
  const weekendSurchargeCents = weekendUpgradeFlag
    ? businessConfig.settings?.weekendSurchargeCents ?? 0
    : 0;

  const basePerVisitCentsRaw = estimateBasePerVisitCents(
    input.dogs,
    input.yardSize,
  );
  const basePerVisitCents = estimatePerVisitCents(
    input.dogs,
    input.yardSize,
    input.frequency,
  );
  const yardSizeForPricing = normalizeYardSizeForPricing(input.yardSize);

  let additionalAreaCostPerVisit = 0;
  let additionalAreaCostOneTime = 0;
  if (input.areasToClean) {
    const selectedAreas = Object.values(input.areasToClean).filter(Boolean).length;
    const extraAreas = Math.max(0, selectedAreas - 1);

    if (input.frequency === "onetime") {
      additionalAreaCostOneTime = extraAreas * 500;
    } else {
      additionalAreaCostPerVisit = extraAreas * 300;
    }
  }

  let deodorizePerVisitCost = 0;
  let deodorizeOneTimeCost = 0;
  if (input.addons?.deodorize) {
    const mode = normalizeAddOnMode(input.addons.deodorizeMode);
    if (mode === "each-visit") {
      deodorizePerVisitCost = ADD_ON_PRICES.deodorize;
    } else if (mode === "every-other") {
      deodorizePerVisitCost = Math.round(ADD_ON_PRICES.deodorize / 2);
    } else {
      deodorizeOneTimeCost = ADD_ON_PRICES.deodorize;
    }
  }

  let sprayDeckPerVisitCost = 0;
  let sprayDeckOneTimeCost = 0;
  if (input.addons?.sprayDeck) {
    const mode = normalizeAddOnMode(input.addons.sprayDeckMode);
    if (mode === "each-visit") {
      sprayDeckPerVisitCost = ADD_ON_PRICES.sprayDeck;
    } else if (mode === "every-other") {
      sprayDeckPerVisitCost = Math.round(ADD_ON_PRICES.sprayDeck / 2);
    } else {
      sprayDeckOneTimeCost = ADD_ON_PRICES.sprayDeck;
    }
  }

  let divertPerVisitCost = 0;
  let divertOneTimeCost = 0;
  if (input.addons?.divertMode && input.addons.divertMode !== "none") {
    if (input.addons.divertMode === "takeaway") {
      divertPerVisitCost = ADD_ON_PRICES.takeaway;
    } else if (input.addons.divertMode === "compost") {
      divertPerVisitCost = ADD_ON_PRICES.compost;
    }

    if (input.frequency === "onetime") {
      divertOneTimeCost = divertPerVisitCost;
      divertPerVisitCost = 0;
    }
  }

  const perVisitCents = Math.round(
    (basePerVisitCents +
      additionalAreaCostPerVisit +
      deodorizePerVisitCost +
      sprayDeckPerVisitCost +
      divertPerVisitCost) *
      zoneMultiplier,
  );

  const visitsPerMonthValue = visitsPerMonth(input.frequency, weekendOptions);
  const monthlyCents =
    Math.round(perVisitCents * visitsPerMonthValue) + weekendSurchargeCents;

  const oneTimeBase = calcOneTimeEstimate(
    input.dogs,
    yardSizeForPricing,
    {
      deodorize: !!input.addons?.deodorize,
    },
  );

  const oneTimeCents = Math.round(
    (oneTimeBase +
      additionalAreaCostOneTime +
      deodorizeOneTimeCost +
      sprayDeckOneTimeCost +
      divertOneTimeCost) *
      zoneMultiplier,
  );

  const breakdown = {
    basePrice: Math.round(basePerVisitCentsRaw * zoneMultiplier),
    yardAdder: 0,
    yardMultiplier: 1,
    frequencyMultiplier: FREQUENCY_MULTIPLIERS[input.frequency],
    addOnCents: Math.round(
      (additionalAreaCostPerVisit +
        deodorizePerVisitCost +
        sprayDeckPerVisitCost +
        divertPerVisitCost) *
        zoneMultiplier,
    ),
    zoneMultiplier,
  };

  return await buildPricingResponse({
    input,
    perVisitCents,
    monthlyCents,
    oneTimeCents,
    visitsPerMonth: visitsPerMonthValue,
    basePerVisitRawCents: basePerVisitCentsRaw,
    breakdown,
    businessConfig,
    weekendUpgrade: weekendUpgradeFlag,
    weekendSurchargeCents,
  });
}

/**
 * Get yard size options for UI
 */
export function getYardSizeOptions() {
  return [
    {
      value: "small",
      label: "Small (< 2,500 sq ft)",
      description: "Compact urban lot",
    },
    {
      value: "medium",
      label: "Medium (2,500-5,000 sq ft)",
      description: "Standard suburban home",
    },
    {
      value: "large",
      label: "Large (5,000-10,000 sq ft)",
      description: "Spacious property",
    },
    {
      value: "xl",
      label: "XL (> 10,000 sq ft)",
      description: "Large estate or multiple lots",
    },
  ];
}

/**
 * Get frequency options for UI
 */
export function getFrequencyOptions() {
  return [
    {
      value: "daily",
      label: "Daily Service",
      description: "Concierge weekday coverage with optional weekends",
    },
    {
      value: "weekly",
      label: "Weekly Service",
      description: "Most popular - consistent cleanliness",
    },
    {
      value: "biweekly",
      label: "Every Other Week",
      description: "Cost-effective for lighter needs",
    },
    {
      value: "twice-weekly",
      label: "Twice Weekly",
      description: "High-activity coverage",
    },
  ];
}

/**
 * Get all service type options for UI (including one-time)
 */
export function getServiceTypeOptions() {
  return [
    {
      value: "daily",
      label: "Daily Service",
      description: "Mon–Fri sweeps with optional weekend upgrade",
      isPopular: false,
    },
    {
      value: "weekly",
      label: "Weekly Service",
      description: "Consistent maintenance keeps your yard pristine",
      isPopular: true,
    },
    {
      value: "twice-weekly",
      label: "Twice Weekly Service",
      description: "High-activity coverage for busy yards",
    },
    {
      value: "biweekly",
      label: "Every Other Week",
      description: "Balanced frequency for most yards",
    },
    {
      value: "monthly",
      label: "Monthly Service",
      description: "Cost-effective for lighter needs",
    },
    {
      value: "onetime",
      label: "One-Time Service",
      description: "Perfect for first-time service or seasonal cleanup",
    },
  ];
}

/**
 * Get add-on options for UI
 */
export function getAddonOptions() {
  return [
    {
      value: "deodorize",
      label: "Enhanced Deodorizing",
      price: 500,
      description:
        "Premium odor-neutralizing treatment applied after every visit for superior scent control",
    },
  ];
}

/**
 * Get premium onboarding options for UI
 */
export function getPremiumOnboardingOptions() {
  return [
    {
      value: "premium-dna",
      label: "Premium DNA Kit (Coming Soon)",
      price: 0, // Disable pricing for now
      description:
        "Advanced dog DNA testing for breed identification and genetic health insights. Coming soon - reserve your spot for early access.",
      disabled: true,
    },
    {
      value: "wellness-microbiome",
      label: "Wellness+ Microbiome Kit (Coming Soon)",
      price: 0, // Disable pricing for now
      description:
        "Comprehensive gut microbiome analysis for optimal pet health. Coming soon with lab partnerships.",
      disabled: true,
    },
  ];
}

/**
 * Get premium onboarding display name
 */
export function getPremiumOnboardingDisplayName(
  onboarding: PremiumOnboarding,
): string {
  switch (onboarding) {
    case "none":
      return "Standard Onboarding";
    case "essential":
      return "Essential Welcome Package";
    case "premium-dna":
      return "Premium DNA Kit (Coming Soon)";
    case "wellness-microbiome":
      return "Wellness+ Microbiome Kit (Coming Soon)";
    default:
      return "Standard Onboarding";
  }
}

// Export constants for external use
export {
  BASE_PRICES,
  YARD_ADDERS,
  FREQUENCY_MULTIPLIERS,
  ADD_ON_PRICES,
  ONE_TIME_BASE_PRICES,
  DEEP_CLEAN_MULTIPLIERS,
};
