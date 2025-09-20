export type Frequency = "weekly" | "twice-weekly" | "bi-weekly" | "one-time";

// Yard size categories for pricing
export type YardSize = "small" | "medium" | "large" | "xlarge";

// Zone-based pricing multipliers
export type ZoneMultiplier = number;

export const YARD_SIZE_MULTIPLIERS = {
  small: 0.8, // < 1/4 acre
  medium: 1.0, // 1/4 - 1/2 acre
  large: 1.2, // 1/2 - 1 acre
  xlarge: 1.4, // > 1 acre
};

export const BASE_RATES = {
  weekly: { base1: 20, base2: 24, base3: 28, extraDog: 4, visitMultiplier: 1 },
  "twice-weekly": {
    base1: 32,
    base2: 38,
    base3: 44,
    extraDog: 6,
    visitMultiplier: 1,
  }, // weekly total for 2 visits
  "bi-weekly": {
    base1: 28,
    base2: 32,
    base3: 36,
    extraDog: 4,
    visitMultiplier: 1 / 2,
  }, // charged per visit, occurs twice monthly
  "one-time": {
    base1: 89,
    base2: 104,
    base3: 119,
    extraDog: 15,
    visitMultiplier: 0,
  },
} as const;

// Backward compatible signature:
// - calcWeeklyEstimate(dogs, frequency, { deodorize, litter })
// - calcWeeklyEstimate(dogs, frequency, yardSize, { deodorize, litter })
export function calcPerVisitEstimate(
  dogs: number,
  frequency: Frequency,
  a?: YardSize | { deodorize: boolean; litter: boolean },
  b?: { deodorize: boolean; litter: boolean },
): number {
  const rates = BASE_RATES[frequency as keyof typeof BASE_RATES];

  // Determine yardSize and addOns from flexible args
  let yardSize: YardSize = "medium";
  let addOns: { deodorize: boolean; litter: boolean } = {
    deodorize: false,
    litter: false,
  };
  if (typeof a === "string") {
    yardSize = a;
    if (b) addOns = b;
  } else if (typeof a === "object" && a) {
    addOns = a as { deodorize: boolean; litter: boolean };
  }

  const tier =
    dogs <= 1
      ? (rates as any).base1
      : dogs === 2
        ? (rates as any).base2
        : (rates as any).base3 +
          Math.max(0, dogs - 3) * (rates as any).extraDog;

  // Per visit calculation
  let perVisit = 0;
  if (frequency === "weekly")
    perVisit = tier; // one visit per week
  else if (frequency === "twice-weekly")
    perVisit = tier / 2; // weekly total divided by two visits
  else if (frequency === "bi-weekly")
    perVisit = tier; // price charged per visit
  else perVisit = 0; // handled by calcOneTimeEstimate

  // Apply yard size multiplier
  perVisit *= YARD_SIZE_MULTIPLIERS[yardSize];

  if (addOns.deodorize) perVisit += 10;
  if (addOns.litter && frequency !== "one-time") perVisit += 5;

  return Math.round(perVisit * 100) / 100;
}

// Backward compatible signature:
// - calcOneTimeEstimate(dogs, { deodorize })
// - calcOneTimeEstimate(dogs, yardSize, { deodorize })
export function calcOneTimeEstimate(
  dogs: number,
  a?: YardSize | { deodorize: boolean },
  b?: { deodorize: boolean },
): number {
  const r = BASE_RATES["one-time"];
  const tier =
    dogs <= 1
      ? r.base1
      : dogs === 2
        ? r.base2
        : r.base3 + (dogs - 3) * r.extraDog;

  let yardSize: YardSize = "medium";
  let addOns: { deodorize: boolean } = { deodorize: false };
  if (typeof a === "string") {
    yardSize = a;
    if (b) addOns = b;
  } else if (typeof a === "object" && a) {
    addOns = a as { deodorize: boolean };
  }

  const basePrice = tier * YARD_SIZE_MULTIPLIERS[yardSize];
  return Math.round((basePrice + (addOns.deodorize ? 10 : 0)) * 100) / 100;
}

// New function for instant quote calculation
export function calcInstantQuote(
  dogs: number,
  frequency: Frequency,
  yardSize: YardSize,
  addOns: { deodorize: boolean; litter: boolean },
): number {
  if (frequency === "one-time") {
    return calcOneTimeEstimate(dogs, yardSize, { deodorize: addOns.deodorize });
  } else {
    return calcPerVisitEstimate(dogs, frequency, yardSize, addOns);
  }
}

// Zone-based pricing functions
export function calcPerVisitEstimateWithZone(
  dogs: number,
  frequency: Frequency,
  yardSize: YardSize,
  addOns: { deodorize: boolean; litter: boolean },
  zoneMultiplier: ZoneMultiplier = 1.0,
): number {
  const basePrice = calcPerVisitEstimate(dogs, frequency, yardSize, addOns);
  return Math.round(basePrice * zoneMultiplier * 100) / 100;
}

export function calcOneTimeEstimateWithZone(
  dogs: number,
  yardSize: YardSize,
  addOns: { deodorize: boolean },
  zoneMultiplier: ZoneMultiplier = 1.0,
): number {
  const basePrice = calcOneTimeEstimate(dogs, yardSize, addOns);
  return Math.round(basePrice * zoneMultiplier * 100) / 100;
}

export function calcInstantQuoteWithZone(
  dogs: number,
  frequency: Frequency,
  yardSize: YardSize,
  addOns: { deodorize: boolean; litter: boolean },
  zoneMultiplier: ZoneMultiplier = 1.0,
): number {
  if (frequency === "one-time") {
    return calcOneTimeEstimateWithZone(
      dogs,
      yardSize,
      { deodorize: addOns.deodorize },
      zoneMultiplier,
    );
  } else {
    return calcPerVisitEstimateWithZone(
      dogs,
      frequency,
      yardSize,
      addOns,
      zoneMultiplier,
    );
  }
}

// Import the configurable pricing system
import {
  calculatePricing,
  validatePricingInput,
  meetsMinimumRequirements,
} from "./configurable-pricing";

// Helper function to get zone multiplier from ZIP code
export async function getZoneMultiplierFromZip(
  zipCode: string,
  businessId: string = "yardura",
): Promise<ZoneMultiplier> {
  try {
    // Use relative path in browser to avoid undefined base URLs; fall back to env on server
    const base =
      typeof window === "undefined"
        ? process.env.NEXT_PUBLIC_SITE_URL ||
          process.env.NEXT_PUBLIC_API_URL ||
          ""
        : "";
    const url = `${base}/api/zip-eligibility?zipCode=${encodeURIComponent(zipCode)}&businessId=${encodeURIComponent(businessId)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch zone multiplier: ${response.statusText}`,
      );
    }
    const data: { zoneMultiplier: ZoneMultiplier } = await response.json();
    return data.zoneMultiplier;
  } catch (error) {
    console.warn(
      "Could not load zip eligibility service, using default multiplier:",
      error,
    );
    return 1.0; // Default to standard pricing
  }
}

// Enhanced pricing functions that use configurable system
export async function calculatePricingWithConfig(
  dogs: number,
  frequency: Frequency,
  yardSize: YardSize,
  addOns: { deodorize: boolean; litter: boolean },
  zoneMultiplier: ZoneMultiplier = 1.0,
  businessId: string = "yardura",
) {
  const input = {
    dogs,
    yardSize: yardSize as "small" | "medium" | "large" | "xlarge",
    frequency: frequency as
      | "weekly"
      | "twice-weekly"
      | "bi-weekly"
      | "monthly"
      | "one-time",
    addOns,
    zoneMultiplier,
    businessId,
  };

  // Validate input
  const validation = await validatePricingInput(input);
  if (!validation.valid) {
    throw new Error(`Invalid pricing input: ${validation.errors.join(", ")}`);
  }

  return await calculatePricing(input);
}

// Backward compatible wrapper
export async function calculatePrice(input: any) {
  try {
    // Try to use the new configurable system first
    if (input.dogs && input.yardSize && input.frequency) {
      const result = await calculatePricingWithConfig(
        input.dogs,
        input.yardSize,
        input.frequency,
        input.addons || {},
        input.zoneMultiplier || 1.0,
        input.businessId || "yardura",
      );

      // Convert to expected format
      return {
        perVisit: result.perVisitCents,
        monthly: Math.round(result.monthlyCents),
        oneTime: result.oneTimeCents,
        visitsPerMonth: result.visitsPerMonth,
        breakdown: result.breakdown,
        zoneMultiplier: result.breakdown.zoneMultiplier,
      };
    }
  } catch (error) {
    console.warn(
      "Configurable pricing failed, falling back to legacy system:",
      error,
    );
  }

  // Fallback to legacy system
  return legacyCalculatePrice(input);
}

// Legacy function for backward compatibility
function legacyCalculatePrice(input: any) {
  // Original pricing logic here...
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

  // Apply zone multiplier to all pricing (default to 1.0 if not provided)
  const zoneMultiplier = input.zoneMultiplier || 1.0;

  // Use the existing pricing functions from the top of the file
  const basePerVisitCents = calcPerVisitEstimate(
    input.dogs,
    input.frequency,
    input.yardSize,
    input.addons || {},
  );

  // Calculate additional area costs ($3 per additional area for recurring, $5 for one-time, first area free)
  let additionalAreaCostPerVisit = 0;
  let additionalAreaCostOneTime = 0;
  if ((input as any).areasToClean) {
    const selectedAreas = Object.values((input as any).areasToClean).filter(
      (v: any) => v,
    ).length;
    const extraAreas = Math.max(0, selectedAreas - 1);

    if (input.frequency === "one-time") {
      additionalAreaCostOneTime = extraAreas * 500; // $5 = 500 cents for one-time
    } else {
      additionalAreaCostPerVisit = extraAreas * 300; // $3 = 300 cents for recurring
    }
  }

  // Calculate deodorize add-on cost based on mode
  let deodorizePerVisitCost = 0;
  let deodorizeOneTimeCost = 0;
  if (input.addons?.deodorize) {
    deodorizePerVisitCost = 2500; // $25 per visit
    deodorizeOneTimeCost = 2500; // $25 for one-time
  }

  // Calculate per-visit pricing
  const perVisitCents = Math.round(
    (basePerVisitCents + additionalAreaCostPerVisit + deodorizePerVisitCost) *
      zoneMultiplier,
  );

  // Calculate monthly pricing (simplified calculation)
  const visitsPerMonthValue =
    input.frequency === "weekly"
      ? 4.33
      : input.frequency === "twice-weekly"
        ? 8.67
        : input.frequency === "bi-weekly"
          ? 2.17
          : input.frequency === "monthly"
            ? 1
            : 1;
  const monthlyCents = Math.round(perVisitCents * visitsPerMonthValue);

  // Calculate one-time pricing
  const oneTimeBaseCents = calcOneTimeEstimate(input.dogs, input.yardSize, {
    deodorize: !!input.addons?.deodorize,
  });
  const oneTimeCents = Math.round(
    (oneTimeBaseCents + additionalAreaCostOneTime + deodorizeOneTimeCost) *
      zoneMultiplier,
  );

  return {
    perVisit: perVisitCents,
    monthly: monthlyCents,
    visitsPerMonth: visitsPerMonthValue,
    total: input.frequency === "onetime" ? oneTimeCents : monthlyCents,
    oneTime: oneTimeCents,
    breakdown: {
      basePrice: Math.round(basePerVisitCents * zoneMultiplier),
      yardAdder: 0, // Already factored into base price
      frequencyMultiplier: 1.0,
      addOnCents: Math.round(
        (deodorizePerVisitCost + additionalAreaCostPerVisit) * zoneMultiplier,
      ),
    },
  };
}
