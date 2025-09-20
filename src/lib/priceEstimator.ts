// Pricing estimator for Yardura dog waste removal services
// Based on competitor research and positioning strategy

import {
  mapDateToBucket,
  calculateInitialClean,
} from "./initialCleanEstimator";
import { calculatePricing } from "./configurable-pricing";

export type Frequency =
  | "weekly"
  | "biweekly"
  | "twice-weekly"
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
  serviceType?: "residential" | "commercial";

  // Basic service details
  dogs: number; // Changed from DogCount to allow free-form for commercial
  yardSize: YardSize;
  frequency: Frequency;

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
    divertMode?: "none" | "takeaway" | "25" | "50" | "100";
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

  // Scheduling preferences
  preferredStartDate?: string;
  customStartDate?: string;
  preferredContactMethods?: string[];
  smsConsent?: boolean;

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
  monthly: 1.5, // Highest per-visit due to accumulation
  onetime: 1.0, // Same as weekly for single service
};

// Add-on prices in cents
const ADD_ON_PRICES = {
  deodorize: 2500, // +$25.00 per visit
  sprayDeck: 1200, // +$12.00
  takeaway: 200, // +$2.00 per visit for basic take away
  divert25: 400, // +$4.00 per visit for 25% diversion
  divert50: 600, // +$6.00 per visit for 50% diversion
  divert100: 1000, // +$10.00 per visit for 100% diversion
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
export function visitsPerMonth(frequency: Frequency): number {
  switch (frequency) {
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
      return 1; // 1 visit per month
    case "onetime":
      return 1; // One-time service
    default:
      return Math.round(((1 * 52) / 12) * 100) / 100; // 4.33
  }
}

/**
 * Get accurate visit range for frequency (accounts for calendar variations)
 */
export function getVisitRange(frequency: Frequency): {
  min: number;
  max: number;
  average: number;
} {
  switch (frequency) {
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
      return { min: 1, max: 1, average: 1 };
    case "onetime":
      return { min: 1, max: 1, average: 1 };
    default:
      return { min: 4, max: 5, average: 4.33 };
  }
}

/**
 * Get calendar-aware pricing explanation
 */
export function getCalendarPricingNote(frequency: Frequency): string {
  if (frequency === "onetime" || frequency === "monthly") return "";

  const range = getVisitRange(frequency);
  if (range.min === range.max) return "";

  return `Pricing is calculated using the annual average of ${range.average} visits per month for fair and consistent billing.`;
}

/**
 * Calculate projected monthly cost in cents using calendar-based calculation
 */
export function projectedMonthlyCents(
  perVisitCents: number,
  frequency: Frequency,
  addOns: { deodorize?: boolean } = {},
): number {
  // Note: perVisitCents already includes deodorize cost, so don't add it again
  // This function should only handle the base calculation without add-ons
  const averageVisitsPerMonth = visitsPerMonth(frequency);
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
) {
  const perVisitCents = Math.round(
    estimatePerVisitCents(dogs, yardSize, frequency) * zoneMultiplier,
  );
  const monthlyCents = Math.round(
    projectedMonthlyCents(perVisitCents, frequency, addOns) * zoneMultiplier,
  );
  const initialCleanCentsValue = Math.round(
    initialCleanCents(perVisitCents, addOns) * zoneMultiplier,
  );
  const visitsPerMonthValue = visitsPerMonth(frequency);

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
export function getFrequencyDisplayName(frequency: Frequency): string {
  switch (frequency) {
    case "weekly":
      return "Weekly";
    case "biweekly":
      return "Every Other Week";
    case "twice-weekly":
      return "Twice Weekly";
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
export async function calculatePrice(input: {
  dogs: number;
  yardSize: YardSize;
  frequency: Frequency;
  addons?: {
    deodorize?: boolean;
    deodorizeMode?: "first-visit" | "each-visit" | "every-other" | "one-time";
    sprayDeck?: boolean;
    sprayDeckMode?: "first-visit" | "each-visit" | "every-other" | "onetime";
    divertMode?: "none" | "takeaway" | "25" | "50" | "100";
  };
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
  zoneMultiplier?: number; // Zone-based pricing multiplier
  areasToClean?: {
    frontYard?: boolean;
    backYard?: boolean;
    sideYard?: boolean;
    dogRun?: boolean;
    fencedArea?: boolean;
    other?: string;
  };
  businessId?: string;
}) {
  // Check for commercial properties
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
      breakdown: {
        basePrice: 0,
        yardAdder: 0,
        frequencyMultiplier: 0,
        addOnCents: 0,
      },
      requiresCustomQuote: true,
      commercialMessage:
        "Commercial properties require a custom quote. Please contact us for pricing.",
    };
  }

  try {
    // Use configurable pricing system
    const pricingResult = await calculatePricing({
      dogs: input.dogs,
      yardSize: input.yardSize as "small" | "medium" | "large" | "xlarge",
      frequency:
        input.frequency === "biweekly"
          ? "bi-weekly"
          : input.frequency === "onetime"
            ? "one-time"
            : (input.frequency as any),
      addOns: {
        deodorize: input.addons?.deodorize,
        litter: false, // Not used in current system
        ...Object.fromEntries(
          Object.entries(input.addons || {})
            .filter(
              ([key]) =>
                ![
                  "deodorize",
                  "deodorizeMode",
                  "sprayDeck",
                  "sprayDeckMode",
                  "divertMode",
                ].includes(key),
            )
            .map(([key, value]) => [key, Boolean(value)]),
        ),
      },
      areasToClean: input.areasToClean,
      zoneMultiplier: input.zoneMultiplier || 1.0,
      businessId: input.businessId || "yardura",
    });

    // Calculate initial clean cost using the estimator
    let initialCleanCost = 0;
    let initialCleanBucket: string = "14";
    if (input.lastCleanedBucket) {
      initialCleanBucket = input.lastCleanedBucket;
    } else if (input.lastCleanedDate) {
      const cleanupDate = new Date(input.lastCleanedDate);
      initialCleanBucket = mapDateToBucket(cleanupDate);
    } else if (input.deepCleanAssessment?.daysSinceLastCleanup) {
      initialCleanBucket =
        input.deepCleanAssessment.daysSinceLastCleanup.toString();
    }

    // Get base per-visit cost (dogs + yard only, no frequency multiplier, no zone multiplier)
    // We need to extract the true base price from the pricing result
    const basePerVisitRaw = pricingResult.breakdown.basePrice; // This is just dogs + yard, no multipliers

    const initialCleanEstimate = await calculateInitialClean(
      basePerVisitRaw,
      initialCleanBucket as any,
      input.dogs as DogCount,
      input.yardSize,
      input.areasToClean,
      input.businessId,
    );
    initialCleanCost = initialCleanEstimate.initialCleanCents;

    // Calculate premium onboarding cost
    const premiumOnboardingCents =
      input.premiumOnboarding && input.premiumOnboarding !== "none"
        ? PREMIUM_ONBOARDING_PRICES[input.premiumOnboarding]
        : 0;

    // Calculate one-time pricing
    let oneTimeCents = 0;
    if (input.frequency === "onetime") {
      oneTimeCents = initialCleanCost + premiumOnboardingCents;
    }

    // Apply zone multiplier to final results
    const zoneMultiplier = input.zoneMultiplier || 1.0;

    return {
      perVisit: Math.round(pricingResult.perVisitCents),
      monthly: Math.round(pricingResult.monthlyCents),
      visitsPerMonth: pricingResult.visitsPerMonth,
      total:
        input.frequency === "onetime"
          ? Math.round(oneTimeCents * zoneMultiplier)
          : Math.round(pricingResult.monthlyCents),
      oneTime: Math.round(oneTimeCents * zoneMultiplier),
      initialClean: Math.round(initialCleanCost * zoneMultiplier),
      initialCleanCents: Math.round(initialCleanCost * zoneMultiplier),
      initialCleanBucket: initialCleanBucket,
      premiumOnboarding: Math.round(premiumOnboardingCents * zoneMultiplier),
      zoneMultiplier,
      breakdown: {
        basePrice: pricingResult.breakdown.basePrice,
        yardAdder: 0, // Already factored into multipliers
        frequencyMultiplier: pricingResult.breakdown.frequencyMultiplier,
        addOnCents: pricingResult.breakdown.addOnCents,
        zoneMultiplier,
      },
    };
  } catch (error) {
    console.error(
      "Configurable pricing failed, falling back to legacy system:",
      error,
    );

    // Fallback to legacy system for backward compatibility
    // Compute both: raw base (no frequency) and frequency-adjusted per-visit
    const basePerVisitCentsRaw = estimateBasePerVisitCents(
      input.dogs,
      input.yardSize,
    );
    const basePerVisitCents = estimatePerVisitCents(
      input.dogs,
      input.yardSize,
      input.frequency,
    );

    // Calculate additional area costs ($3 per additional area for recurring, $5 for one-time, first area free)
    let additionalAreaCostPerVisit = 0;
    let additionalAreaCostOneTime = 0;
    if ((input as any).areasToClean) {
      const selectedAreas = Object.values((input as any).areasToClean).filter(
        (v: any) => v,
      ).length;
      const extraAreas = Math.max(0, selectedAreas - 1);

      if (input.frequency === "onetime") {
        additionalAreaCostOneTime = extraAreas * 500; // $5 = 500 cents for one-time
      } else {
        additionalAreaCostPerVisit = extraAreas * 300; // $3 = 300 cents for recurring
      }
    }

    // Calculate deodorize add-on cost based on mode
    let deodorizePerVisitCost = 0;
    let deodorizeOneTimeCost = 0;

    if (input.addons?.deodorize && input.addons.deodorizeMode) {
      if (input.addons.deodorizeMode === "each-visit") {
        deodorizePerVisitCost = ADD_ON_PRICES.deodorize;
      } else if (input.addons.deodorizeMode === "every-other") {
        deodorizePerVisitCost = Math.round(ADD_ON_PRICES.deodorize / 2); // $12.50 per visit
      } else if (input.addons.deodorizeMode === "first-visit") {
        deodorizeOneTimeCost = ADD_ON_PRICES.deodorize;
      } else if (input.addons.deodorizeMode === "one-time") {
        deodorizeOneTimeCost = ADD_ON_PRICES.deodorize;
      }
    }

    // Calculate spray deck add-on cost based on mode
    let sprayDeckPerVisitCost = 0;
    let sprayDeckOneTimeCost = 0;

    if (input.addons?.sprayDeck && input.addons.sprayDeckMode) {
      if (input.addons.sprayDeckMode === "each-visit") {
        sprayDeckPerVisitCost = ADD_ON_PRICES.sprayDeck;
      } else if (input.addons.sprayDeckMode === "every-other") {
        sprayDeckPerVisitCost = Math.round(ADD_ON_PRICES.sprayDeck / 2); // $6 per visit
      } else if (input.addons.sprayDeckMode === "first-visit") {
        sprayDeckOneTimeCost = ADD_ON_PRICES.sprayDeck;
      } else if (input.addons.sprayDeckMode === "onetime") {
        sprayDeckOneTimeCost = ADD_ON_PRICES.sprayDeck;
      }
    }

    // Calculate divert from landfill add-on cost based on mode
    let divertPerVisitCost = 0;
    const divertOneTimeCost = 0;

    if (input.addons?.divertMode && input.addons.divertMode !== "none") {
      if (input.addons.divertMode === "takeaway") {
        divertPerVisitCost = ADD_ON_PRICES.takeaway;
      } else if (input.addons.divertMode === "25") {
        divertPerVisitCost = ADD_ON_PRICES.divert25;
      } else if (input.addons.divertMode === "50") {
        divertPerVisitCost = ADD_ON_PRICES.divert50;
      } else if (input.addons.divertMode === "100") {
        divertPerVisitCost = ADD_ON_PRICES.divert100;
      }
    }

    // Only include TRULY per-visit add-ons (each-visit, every-other) in monthly calculation
    // First-visit-only add-ons should NOT affect monthly cost
    const trulyPerVisitAddOnCost =
      deodorizePerVisitCost + sprayDeckPerVisitCost + divertPerVisitCost;
    const perVisitCents =
      basePerVisitCents + trulyPerVisitAddOnCost + additionalAreaCostPerVisit;
    const monthlyCents = projectedMonthlyCents(
      basePerVisitCents + trulyPerVisitAddOnCost + additionalAreaCostPerVisit,
      input.frequency,
      input.addons || {},
    );
    const visitsPerMonthValue = visitsPerMonth(input.frequency);

    // Calculate initial clean cost using new estimator
    let initialCleanCost = 0;
    let initialCleanBucket: string = "14";
    if (input.lastCleanedBucket) {
      initialCleanBucket = input.lastCleanedBucket;
    } else if (input.lastCleanedDate) {
      const cleanupDate = new Date(input.lastCleanedDate);
      initialCleanBucket = mapDateToBucket(cleanupDate);
    } else if (input.deepCleanAssessment?.daysSinceLastCleanup) {
      initialCleanBucket =
        input.deepCleanAssessment.daysSinceLastCleanup.toString();
    }

    // Use new initial clean estimator
    // Pass basePerVisitCents (dogs + yard) only; add-ons/areas handled separately by estimator/one-time flow
    const initialCleanEstimate = await calculateInitialClean(
      basePerVisitCentsRaw,
      initialCleanBucket as any,
      input.dogs as DogCount,
      input.yardSize,
      input.areasToClean,
      input.businessId,
    );
    initialCleanCost = initialCleanEstimate.initialCleanCents;

    // For recurring services, add first-visit-only add-ons to the initial clean cost
    if (input.frequency !== "onetime") {
      const firstVisitOnlyAddOns =
        deodorizeOneTimeCost + sprayDeckOneTimeCost + divertOneTimeCost;
      initialCleanCost += firstVisitOnlyAddOns;
    }

    // Calculate premium onboarding cost
    const premiumOnboardingCents =
      input.premiumOnboarding && input.premiumOnboarding !== "none"
        ? PREMIUM_ONBOARDING_PRICES[input.premiumOnboarding]
        : 0;

    // Calculate one-time service pricing (use initial clean cost for simplicity)
    let oneTimeCents = 0;
    if (input.frequency === "onetime") {
      // For one-time service, simply use the initial clean cost
      // This matches what users see in the "initial clean" pricing and is simpler
      oneTimeCents = initialCleanCost;

      // Add premium onboarding costs if selected
      oneTimeCents += premiumOnboardingCents;

      // Add deodorize cost based on mode for one-time service
      oneTimeCents += deodorizeOneTimeCost;

      // Add spray deck cost based on mode for one-time service
      oneTimeCents += sprayDeckOneTimeCost;

      // Add divert cost for one-time service (only for one-time services, recurring gets per-visit)
      if (
        (input as any).addons?.divertMode &&
        (input as any).addons?.divertMode !== "none"
      ) {
        if ((input as any).addons?.divertMode === "takeaway") {
          oneTimeCents += ADD_ON_PRICES.takeaway;
        } else if ((input as any).addons?.divertMode === "25") {
          oneTimeCents += ADD_ON_PRICES.divert25;
        } else if ((input as any).addons?.divertMode === "50") {
          oneTimeCents += ADD_ON_PRICES.divert50;
        } else if ((input as any).addons?.divertMode === "100") {
          oneTimeCents += ADD_ON_PRICES.divert100;
        }
      }

      // Do not add additional area costs here; unified initial clean estimator already includes +$5/extra area
    }

    // Apply zone multiplier to all pricing (default to 1.0 if not provided)
    const zoneMultiplier = input.zoneMultiplier || 1.0;

    return {
      perVisit: Math.round(perVisitCents * zoneMultiplier),
      monthly: Math.round(monthlyCents * zoneMultiplier),
      visitsPerMonth: visitsPerMonthValue,
      total:
        input.frequency === "onetime"
          ? Math.round(oneTimeCents * zoneMultiplier)
          : Math.round(monthlyCents * zoneMultiplier),
      oneTime: Math.round(oneTimeCents * zoneMultiplier),
      initialClean: Math.round(initialCleanCost * zoneMultiplier),
      initialCleanCents: Math.round(initialCleanCost * zoneMultiplier),
      initialCleanBucket: initialCleanBucket,
      premiumOnboarding: Math.round(premiumOnboardingCents * zoneMultiplier),
      zoneMultiplier, // Include for transparency
      breakdown:
        input.frequency === "onetime"
          ? {
              basePrice: Math.round(
                ONE_TIME_BASE_PRICES[input.yardSize] * zoneMultiplier,
              ),
              yardAdder: 0, // Already factored into base price
              frequencyMultiplier: 1.0,
              addOnCents: input.addons?.deodorize
                ? Math.round(ADD_ON_PRICES.deodorize * zoneMultiplier)
                : 0,
              zoneMultiplier,
            }
          : {
              ...getPricingBreakdown(
                input.dogs,
                input.yardSize,
                input.frequency,
                input.addons || {},
                zoneMultiplier,
              ).breakdown,
            },
    };
  }
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
      description: "Maximum cleanliness",
    },
  ];
}

/**
 * Get all service type options for UI (including one-time)
 */
export function getServiceTypeOptions() {
  return [
    {
      value: "weekly",
      label: "Weekly Service",
      description: "Consistent maintenance keeps your yard pristine",
      isPopular: true,
    },
    {
      value: "twice-weekly",
      label: "Twice Weekly Service",
      description: "Maximum cleanliness for intensive needs",
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
        "Premium odor-neutralizing treatment applied every other visit for superior scent control",
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
