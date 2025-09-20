/**
 * Configurable Pricing System
 *
 * Allows businesses to customize their pricing rules, tiers, and calculations
 */

import {
  getBusinessConfig,
  BusinessConfig,
  PricingTier,
  FrequencyPricing,
  AddOnConfig,
  YardSizePricing,
} from "./business-config";

// Re-export types for convenience
export type {
  BusinessConfig,
  PricingTier,
  FrequencyPricing,
  AddOnConfig,
  YardSizePricing,
} from "./business-config";

export interface PricingCalculationInput {
  dogs: number;
  yardSize: "small" | "medium" | "large" | "xlarge";
  frequency: "weekly" | "twice-weekly" | "bi-weekly" | "monthly" | "one-time";
  addOns?: {
    deodorize?:
      | boolean
      | { mode: "first-visit" | "each-visit" | "every-other" | "onetime" };
    litter?: boolean;
    "spray-deck"?:
      | boolean
      | { mode: "first-visit" | "each-visit" | "every-other" | "onetime" };
    "divert-takeaway"?: boolean;
    "divert-25"?: boolean;
    "divert-50"?: boolean;
    "divert-100"?: boolean;
    [key: string]: boolean | { mode: string } | undefined;
  };
  areasToClean?: {
    frontYard?: boolean;
    backYard?: boolean;
    sideYard?: boolean;
    dogRun?: boolean;
    fencedArea?: boolean;
    other?: string;
  };
  zoneMultiplier?: number;
  businessId?: string;
}

export interface PricingResult {
  perVisitCents: number;
  monthlyCents: number;
  oneTimeCents: number;
  visitsPerMonth: number;
  breakdown: {
    basePrice: number;
    yardMultiplier: number;
    frequencyMultiplier: number;
    addOnCents: number;
    areasCostCents: number;
    zoneMultiplier: number;
    totalMultiplier: number;
  };
  addOnsBreakdown: Array<{
    name: string;
    priceCents: number;
  }>;
}

/**
 * Calculate pricing using configurable business rules
 */
export async function calculatePricing(
  input: PricingCalculationInput,
): Promise<PricingResult> {
  const businessId = input.businessId || "yardura";
  const config = await getBusinessConfig(businessId);

  // Find the appropriate pricing tier based on dog count
  const tier = findPricingTier(input.dogs, config);
  if (!tier) {
    throw new Error(`No pricing tier found for ${input.dogs} dogs`);
  }

  // Get yard size multiplier
  const yardSizeConfig = config.basePricing.yardSizes.find(
    (ys) => ys.size === input.yardSize,
  );
  if (!yardSizeConfig) {
    throw new Error(`No yard size configuration found for ${input.yardSize}`);
  }

  // Get frequency configuration
  const frequencyConfig = config.basePricing.frequencies.find(
    (f) => f.frequency === input.frequency,
  );
  if (!frequencyConfig) {
    throw new Error(`No frequency configuration found for ${input.frequency}`);
  }

  // Calculate base pricing
  const basePriceCents = tier.basePriceCents;
  const yardMultiplier = yardSizeConfig.multiplier;
  const frequencyMultiplier = frequencyConfig.multiplier;
  const zoneMultiplier = input.zoneMultiplier || 1.0;

  // Calculate add-on costs
  const addOnsBreakdown = calculateAddOns(
    input.addOns || {},
    config,
    input.frequency,
  );
  const addOnCents = addOnsBreakdown.reduce(
    (sum, addon) => sum + addon.priceCents,
    0,
  );

  // Calculate areas cost (applies to both recurring and one-time services)
  let areasCostCents = 0;
  if (input.areasToClean) {
    // Count selected areas
    const selectedAreas = Object.values(input.areasToClean).filter((value) =>
      typeof value === "boolean" ? value : value && value.trim() !== "",
    ).length;

    const extraAreas = Math.max(
      0,
      selectedAreas - config.basePricing.areaPricing.baseAreas,
    );

    // Use appropriate cost based on frequency
    const costPerArea =
      input.frequency === "one-time"
        ? config.basePricing.areaPricing.extraAreaCostCents
        : config.basePricing.areaPricing.recurringExtraAreaCostCents;

    areasCostCents = extraAreas * costPerArea;

    // Debug logging
    console.log("🏠 AREAS CALCULATION DEBUG:", {
      areasToClean: input.areasToClean,
      selectedAreas,
      baseAreas: config.basePricing.areaPricing.baseAreas,
      extraAreas,
      frequency: input.frequency,
      costPerArea,
      areasCostCents,
    });
  }

  // Calculate per-visit cost (only applies frequency multiplier to recurring services)
  const baseCostCents = basePriceCents + addOnCents + areasCostCents;
  const yardAndZoneMultiplier = yardMultiplier * zoneMultiplier;

  let perVisitCents: number;
  let oneTimeCents: number;

  if (input.frequency === "one-time") {
    // For one-time services, frequency multiplier should NOT apply to the initial clean
    perVisitCents = Math.round(baseCostCents * yardAndZoneMultiplier);
    oneTimeCents = perVisitCents; // Same as per-visit for one-time
  } else {
    // For recurring services, apply frequency multiplier to per-visit cost
    perVisitCents = Math.round(
      baseCostCents * yardAndZoneMultiplier * frequencyMultiplier,
    );
    // One-time cost for recurring services is the same as a single visit (without frequency multiplier)
    oneTimeCents = Math.round(baseCostCents * yardAndZoneMultiplier);
  }

  // Debug logging for final calculation
  console.log("💰 FINAL PRICING DEBUG:", {
    baseCostCents,
    yardAndZoneMultiplier,
    frequencyMultiplier:
      input.frequency === "one-time" ? 1 : frequencyMultiplier,
    perVisitCents,
    oneTimeCents,
    frequency: input.frequency,
    isOneTime: input.frequency === "one-time",
  });

  // Calculate monthly costs (only for recurring services)
  const visitsPerMonth = frequencyConfig.visitsPerMonth;
  const monthlyCents =
    input.frequency === "one-time" ? 0 : perVisitCents * visitsPerMonth;

  return {
    perVisitCents,
    monthlyCents,
    oneTimeCents,
    visitsPerMonth,
    breakdown: {
      basePrice: basePriceCents,
      yardMultiplier,
      frequencyMultiplier:
        input.frequency === "one-time" ? 1 : frequencyMultiplier, // No frequency multiplier for one-time
      addOnCents,
      areasCostCents,
      zoneMultiplier,
      totalMultiplier:
        input.frequency === "one-time"
          ? yardAndZoneMultiplier
          : yardAndZoneMultiplier * frequencyMultiplier,
    },
    addOnsBreakdown,
  };
}

/**
 * Find the appropriate pricing tier for the given dog count
 */
function findPricingTier(
  dogCount: number,
  config: BusinessConfig,
): PricingTier | null {
  // Sort tiers by dog count ascending
  const sortedTiers = [...config.basePricing.tiers].sort(
    (a, b) => a.dogCount - b.dogCount,
  );

  // Find the tier that matches or is the last tier for higher dog counts
  for (let i = sortedTiers.length - 1; i >= 0; i--) {
    const tier = sortedTiers[i];
    if (dogCount >= tier.dogCount) {
      // If this is the last tier, add extra dog pricing
      if (
        i === sortedTiers.length - 1 &&
        dogCount > tier.dogCount &&
        tier.extraDogPriceCents
      ) {
        return {
          ...tier,
          basePriceCents:
            tier.basePriceCents +
            (dogCount - tier.dogCount) * tier.extraDogPriceCents,
        };
      }
      return tier;
    }
  }

  return null;
}

/**
 * Calculate add-on costs
 */
function calculateAddOns(
  selectedAddOns: Record<string, boolean | { mode: string } | undefined>,
  config: BusinessConfig,
  frequency: string,
): Array<{ name: string; priceCents: number }> {
  const addOnsBreakdown: Array<{ name: string; priceCents: number }> = [];

  for (const [addonKey, addonSelection] of Object.entries(selectedAddOns)) {
    if (!addonSelection) continue;

    const addonConfig = config.basePricing.addOns.find(
      (addon) => addon.id === addonKey,
    );
    if (!addonConfig || !addonConfig.available) continue;

    // Handle different addon selection formats
    let billingMode: "first-visit" | "each-visit" | "every-other" | "one-time" =
      addonConfig.billingMode; // default from config
    let isSelected = false;

    if (typeof addonSelection === "boolean") {
      isSelected = addonSelection;
    } else if (typeof addonSelection === "object" && addonSelection.mode) {
      isSelected = true;
      billingMode = addonSelection.mode as
        | "first-visit"
        | "each-visit"
        | "every-other"
        | "one-time";
    }

    if (!isSelected) continue;

    // Calculate price based on billing mode
    let priceCents = addonConfig.priceCents;

    if (billingMode === "every-other") {
      // Half price for every-other visits
      priceCents = Math.round(priceCents / 2);
    } else if (billingMode === "first-visit") {
      // First-visit only - don't add to per-visit recurring cost
      if (frequency !== "one-time") {
        continue; // Skip adding to recurring per-visit cost
      }
    } else if (billingMode === "one-time") {
      // One-time only - only add to one-time cost
      if (frequency !== "one-time") {
        continue; // Skip adding to recurring per-visit cost
      }
    }
    // 'each-visit' mode uses full price (default behavior)

    addOnsBreakdown.push({
      name: addonConfig.name,
      priceCents,
    });
  }

  return addOnsBreakdown;
}

/**
 * Get available add-ons for a business
 */
export async function getAvailableAddOns(
  businessId: string = "yardura",
): Promise<AddOnConfig[]> {
  const config = await getBusinessConfig(businessId);
  return config.basePricing.addOns.filter(
    (addon: AddOnConfig) => addon.available,
  );
}

/**
 * Get available frequencies for a business
 */
export async function getAvailableFrequencies(
  businessId: string = "yardura",
): Promise<FrequencyPricing[]> {
  const config = await getBusinessConfig(businessId);
  return config.basePricing.frequencies;
}

/**
 * Get available yard sizes for a business
 */
export async function getAvailableYardSizes(
  businessId: string = "yardura",
): Promise<YardSizePricing[]> {
  const config = await getBusinessConfig(businessId);
  return config.basePricing.yardSizes;
}

/**
 * Get pricing tiers for a business
 */
export async function getPricingTiers(
  businessId: string = "yardura",
): Promise<PricingTier[]> {
  const config = await getBusinessConfig(businessId);
  return config.basePricing.tiers;
}

/**
 * Format price in cents to currency string
 */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/**
 * Validate pricing calculation input
 */
export async function validatePricingInput(
  input: PricingCalculationInput,
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  if (!input.dogs || input.dogs < 1) {
    errors.push("Number of dogs must be at least 1");
  }

  if (!input.yardSize) {
    errors.push("Yard size is required");
  }

  if (!input.frequency) {
    errors.push("Service frequency is required");
  }

  const config = await getBusinessConfig(input.businessId);
  const validYardSizes = config.basePricing.yardSizes.map(
    (ys: YardSizePricing) => ys.size,
  );
  if (!validYardSizes.includes(input.yardSize)) {
    errors.push(
      `Invalid yard size. Must be one of: ${validYardSizes.join(", ")}`,
    );
  }

  const validFrequencies = config.basePricing.frequencies.map(
    (f: FrequencyPricing) => f.frequency,
  );
  if (!validFrequencies.includes(input.frequency)) {
    errors.push(
      `Invalid frequency. Must be one of: ${validFrequencies.join(", ")}`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get minimum service fee for a business
 */
export async function getMinimumServiceFee(
  businessId: string = "yardura",
): Promise<number> {
  const config = await getBusinessConfig(businessId);
  return config.settings.minimumServiceFeeCents;
}

/**
 * Check if a service configuration meets minimum requirements
 */
export async function meetsMinimumRequirements(
  input: PricingCalculationInput,
  businessId: string = "yardura",
): Promise<boolean> {
  try {
    const result = await calculatePricing(input);
    const minFee = await getMinimumServiceFee(businessId);

    if (input.frequency === "one-time") {
      return result.oneTimeCents >= minFee;
    } else {
      return result.perVisitCents >= minFee;
    }
  } catch (error) {
    return false;
  }
}
