// Client-side pricing utilities - fetches configuration from admin system

export type Frequency = "weekly" | "biweekly" | "twice-weekly" | "daily" | "monthly" | "onetime";
export type DogCount = 1 | 2 | 3 | 4;
export type YardSize = "small" | "medium" | "large" | "xl";

// Minimal business config shape we need on the client
interface ClientBusinessConfig {
  basePricing: {
    tiers: Array<{
      dogCount: number;
      basePriceCents: number;
      extraDogPriceCents?: number;
    }>;
    yardSizes: Array<{
      size: "small" | "medium" | "large" | "xlarge";
      multiplier: number;
      enabled: boolean;
    }>;
    frequencies: Array<{
      frequency: "weekly" | "twice-weekly" | "daily" | "bi-weekly" | "monthly" | "one-time";
      multiplier: number;
      visitsPerMonth: number;
    }>;
    initialClean: {
      enabled: boolean;
      multiplier: number;
      floorPriceCents: number;
      buckets: Array<{
        bucket: string;
        multiplier: number;
        floorPriceCents: number;
      }>;
    };
    addOns: Array<{
      id: string;
      priceCents: number;
      available: boolean;
    }>;
  };
  settings?: {
    weekendSurchargeCents?: number;
  };
}

interface PricingBreakdown {
  perVisitCents: number;
  monthlyCents: number;
  initialCleanCents: number; // Original initial clean cost
  initialCleanDiscount: number; // Discount amount
  discountedInitialClean: number; // Initial clean after discount
  firstMonthCents: number; // Different from monthly - excludes initial clean visits
  oneTimeCents: number;
  visitsPerMonth: number;
  firstMonthVisits: number; // ~3 visits instead of 4.33
  breakdown: {
    basePrice: number;
    yardAdder: number;
    frequencyMultiplier: number;
    addOnCents: number;
    zoneMultiplier: number;
    weekendSurchargeCents?: number;
    weekendUpgrade?: boolean;
  };
  firstVisitAddOns: {
    deodorize: number;
    sprayDeck: number;
    other: number;
  };
  recurringAddOns: {
    deodorize: number;
    sprayDeck: number;
    divert: number;
  };
  weekendUpgrade: boolean;
  weekendSurchargeCents: number;
}

let pricingConfig: ClientBusinessConfig | null = null;
let configPromise: Promise<ClientBusinessConfig> | null = null;

const FALLBACK_ADDON_PRICES: Record<string, number> = {
  deodorize: 500,
  "spray-deck": 1200,
  "divert-takeaway": 500,
  "divert-compost": 1000,
};

// Fetch pricing configuration from API
async function getPricingConfig(): Promise<ClientBusinessConfig> {
  if (pricingConfig) return pricingConfig;
  if (configPromise) return configPromise;

  // Use existing business-config endpoint to derive pricing
  configPromise = fetch('/api/business-config', { cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) throw new Error('Failed to fetch business config');
      const json = await res.json();
      const cfg = (json && (json.config || json)) as ClientBusinessConfig;
      if (!cfg?.basePricing) throw new Error('Invalid business config response');
      pricingConfig = cfg;
      return cfg;
    })
    .catch((error) => {
      console.error('Error fetching business config:', error);
      // Fallback to a sensible default if API fails
      return getDefaultPricingConfig();
    });

  return configPromise;
}

// Default pricing configuration (fallback)
function getDefaultPricingConfig(): ClientBusinessConfig {
  return {
    basePricing: {
      tiers: [
        { dogCount: 1, basePriceCents: 2000 },
        { dogCount: 2, basePriceCents: 2400 },
        { dogCount: 3, basePriceCents: 2800 },
        { dogCount: 4, basePriceCents: 3200, extraDogPriceCents: 500 },
      ],
      yardSizes: [
        { size: 'small', multiplier: 0.8, enabled: true },
        { size: 'medium', multiplier: 1.0, enabled: true },
        { size: 'large', multiplier: 1.2, enabled: true },
        { size: 'xlarge', multiplier: 1.4, enabled: true },
      ],
      frequencies: [
        { frequency: 'weekly', multiplier: 1.0, visitsPerMonth: 4.33 },
        { frequency: 'daily', multiplier: 0.5, visitsPerMonth: 21.67 },
        { frequency: 'twice-weekly', multiplier: 0.9, visitsPerMonth: 8.67 },
        { frequency: 'bi-weekly', multiplier: 1.25, visitsPerMonth: 2.17 },
        { frequency: 'monthly', multiplier: 1.5, visitsPerMonth: 4.33 },
        { frequency: 'one-time', multiplier: 1.0, visitsPerMonth: 1 },
      ],
      initialClean: {
        enabled: true,
        multiplier: 1.0,
        floorPriceCents: 4900,
        buckets: [
          { bucket: '7', multiplier: 1.0, floorPriceCents: 4900 },
          { bucket: '14', multiplier: 1.0, floorPriceCents: 4900 },
          { bucket: '42', multiplier: 1.75, floorPriceCents: 6900 },
          { bucket: '999', multiplier: 2.5, floorPriceCents: 8900 },
        ],
      },
      addOns: [
        { id: 'deodorize', priceCents: 500, available: true },
        { id: 'spray-deck', priceCents: 1200, available: true },
        { id: 'divert-takeaway', priceCents: 500, available: true },
        { id: 'divert-compost', priceCents: 1000, available: true },
      ],
    },
    settings: {
      weekendSurchargeCents: 0,
    },
  };
}

// Helper functions to get pricing values
async function getFrequencyMultiplier(frequency: Frequency): Promise<number> {
  const config = await getPricingConfig();
  const freqKey = frequency === 'biweekly' ? 'bi-weekly' : (frequency === 'onetime' ? 'one-time' : frequency);
  const f = config.basePricing.frequencies.find((x) => x.frequency === (freqKey as any));
  return f?.multiplier ?? 1.0;
}

async function getVisitsPerMonth(frequency: Frequency): Promise<number> {
  const config = await getPricingConfig();
  const freqKey = frequency === 'biweekly' ? 'bi-weekly' : (frequency === 'onetime' ? 'one-time' : frequency);
  const f = config.basePricing.frequencies.find((x) => x.frequency === (freqKey as any));
  return f?.visitsPerMonth ?? 4.33;
}

async function getAddOnPrice(addOn: string): Promise<number> {
  const config = await getPricingConfig();
  const idMap: Record<string, string> = {
    deodorize: 'deodorize',
    sprayDeck: 'spray-deck',
    takeaway: 'divert-takeaway',
    compost: 'divert-compost',
  };
  const id = idMap[addOn] || addOn;
  const addon = config.basePricing.addOns.find((a) => a.id === id && a.available);
  const fallback = FALLBACK_ADDON_PRICES[id] ?? FALLBACK_ADDON_PRICES[addOn] ?? 0;
  return addon?.priceCents ?? fallback;
}

// Calculate base per-visit price (no frequency multiplier)
async function estimateBasePerVisitCents(
  dogs: number,
  yardSize: YardSize,
): Promise<number> {
  const config = await getPricingConfig();
  // Find tier at or below dog count
  const sortedTiers = [...config.basePricing.tiers].sort((a, b) => a.dogCount - b.dogCount);
  let tier = sortedTiers[0];
  for (let i = 0; i < sortedTiers.length; i++) {
    if (dogs >= sortedTiers[i].dogCount) tier = sortedTiers[i];
  }
  let base = tier.basePriceCents;
  // If beyond last tier, add extraDogPriceCents per extra dog if available
  const maxTier = sortedTiers[sortedTiers.length - 1];
  if (dogs > maxTier.dogCount && maxTier.extraDogPriceCents) {
    base += (dogs - maxTier.dogCount) * maxTier.extraDogPriceCents;
  }
  // Yard multiplier
  const yardKey = yardSize === 'xl' ? 'xlarge' : yardSize;
  const ys = config.basePricing.yardSizes.find((y) => y.size === (yardKey as any));
  const yardMultiplier = ys?.multiplier ?? 1.0;
  return Math.round(base * yardMultiplier);
}

export async function estimatePerVisitCents(
  dogs: number,
  yardSize: YardSize,
  frequency: Frequency,
): Promise<number> {
  const [basePrice, frequencyMultiplier] = await Promise.all([
    estimateBasePerVisitCents(dogs, yardSize),
    getFrequencyMultiplier(frequency),
  ]);

  return Math.round(basePrice * frequencyMultiplier);
}

// Calculate visits per month based on frequency
async function visitsPerMonthAsync(
  frequency: Frequency,
  options?: { weekendUpgrade?: boolean },
): Promise<number> {
  const baseVisits = await getVisitsPerMonth(frequency);
  if (frequency === "daily" && options?.weekendUpgrade) {
    return Math.round(baseVisits * (7 / 5) * 100) / 100;
  }
  return baseVisits;
}

// Calculate first month visits (excludes initial clean visit)
async function firstMonthVisitsAsync(
  frequency: Frequency,
  options?: { weekendUpgrade?: boolean },
): Promise<number> {
  const totalVisits = await visitsPerMonthAsync(frequency, options);

  if (frequency === "onetime") {
    return 1; // One-time service
  }

  const allowance = frequency === "daily"
    ? options?.weekendUpgrade
      ? 7
      : 5
    : 0;
  const freeVisitAllowance = allowance;
  const adjustedVisits = totalVisits - freeVisitAllowance;
  return Math.max(1, Math.round(adjustedVisits * 100) / 100);
}

// Calculate initial clean cost using similar logic to initialCleanEstimator.ts
async function calculateInitialCleanCents(
  basePerVisitCents: number,
  bucket: string = "14", // Default to 2 weeks
  dogs: number,
  yardSize: YardSize,
  areasToClean: any = {},
): Promise<number> {
  // Bucket multipliers (simplified from initialCleanEstimator.ts)
  const bucketMultipliers: Record<string, { multiplier: number; floorCents: number }> = {
    "7": { multiplier: 1.0, floorCents: 4900 },
    "14": { multiplier: 1.0, floorCents: 4900 },
    "30": { multiplier: 1.0, floorCents: 4900 },
    "42": { multiplier: 1.75, floorCents: 6900 },
    "60": { multiplier: 1.75, floorCents: 6900 },
    "90": { multiplier: 1.75, floorCents: 6900 },
    "999": { multiplier: 2.5, floorCents: 8900 },
  };

  const bucketConfig = bucketMultipliers[bucket] || bucketMultipliers["14"];
  
  // Initial clean factor (from initialCleanEstimator.ts)
  const INITIAL_CLEAN_FACTOR = 2.7222;
  const baseInitial = Math.round(basePerVisitCents * INITIAL_CLEAN_FACTOR);
  const bucketApplied = Math.round(baseInitial * bucketConfig.multiplier);

  // Calculate additional areas cost (+$5 per extra area)
  const selectedAreas = Object.values(areasToClean || {}).filter(
    (value) => typeof value === 'boolean' && value
  ).length;
  const hasOtherArea = areasToClean?.other && areasToClean.other.trim() !== '';
  const totalSelectedAreas = selectedAreas + (hasOtherArea ? 1 : 0);
  const additionalAreas = Math.max(0, totalSelectedAreas - 1);
  const additionalAreaCost = additionalAreas * 500; // $5 per additional area

  const totalBaseAmount = bucketApplied + additionalAreaCost;
  return Math.max(Math.round(totalBaseAmount), bucketConfig.floorCents);
}

export async function projectedMonthlyCents(
  perVisitCents: number,
  frequency: Frequency,
  options?: { weekendUpgrade?: boolean },
): Promise<number> {
  const averageVisitsPerMonth = await visitsPerMonthAsync(frequency, options);
  return Math.round(perVisitCents * averageVisitsPerMonth);
}

// Calculate first month payment (excludes initial clean visits)
export async function firstMonthPaymentCents(
  perVisitCents: number,
  frequency: Frequency,
  options?: { weekendUpgrade?: boolean },
): Promise<number> {
  const firstMonthVisitsCount = await firstMonthVisitsAsync(frequency, options);
  return Math.round(perVisitCents * firstMonthVisitsCount);
}

export function formatPrice(cents: number): string {
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(0)}`;
}

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
      return options?.weekendUpgrade ? "Daily (Mon–Sun)" : "Weekday (Mon–Fri)";
    case "monthly":
      return "Monthly";
    case "onetime":
      return "One-Time";
    default:
      return "Weekly";
  }
}

// Main pricing calculation function that matches priceEstimator.ts logic
export async function calculateCompletePricing(input: {
  dogs: number;
  yardSize: YardSize;
  frequency: Frequency;
  addons?: {
    deodorize?: boolean;
    deodorizeMode?: "first-visit" | "each-visit" | "every-other" | "one-time";
    sprayDeck?: boolean;
    sprayDeckMode?: "first-visit" | "each-visit" | "every-other" | "onetime";
    divertMode?: "none" | "takeaway" | "compost";
  };
  areasToClean?: {
    frontYard?: boolean;
    backYard?: boolean;
    sideYard?: boolean;
    dogRun?: boolean;
    fencedArea?: boolean;
    other?: string;
  };
  lastCleanedBucket?: string;
  zoneMultiplier?: number;
  weekendUpgrade?: boolean;
}): Promise<PricingBreakdown> {
  const basePerVisitCents = await estimateBasePerVisitCents(input.dogs, input.yardSize);
  const perVisitCents = await estimatePerVisitCents(input.dogs, input.yardSize, input.frequency);
  
  // Calculate initial clean cost
  const initialCleanCents = await calculateInitialCleanCents(
    basePerVisitCents,
    input.lastCleanedBucket || "14",
    input.dogs,
    input.yardSize,
    input.areasToClean
  );

  // Calculate add-on costs
  const deodorizePrice = await getAddOnPrice("deodorize");
  const sprayDeckPrice = await getAddOnPrice("sprayDeck");
  const takeawayPrice = await getAddOnPrice("takeaway");
  const compostPrice = await getAddOnPrice("compost");

  // Calculate first-visit-only add-ons
  const firstVisitAddOns = {
    deodorize: 0,
    sprayDeck: 0,
    other: 0,
  };

  // Calculate recurring add-ons
  const recurringAddOns = {
    deodorize: 0,
    sprayDeck: 0,
    divert: 0,
  };

  // Handle deodorize add-on
  if (input.addons?.deodorize && input.addons.deodorizeMode) {
    if (input.addons.deodorizeMode === "each-visit") {
      recurringAddOns.deodorize = deodorizePrice;
    } else if (input.addons.deodorizeMode === "every-other") {
      recurringAddOns.deodorize = Math.round(deodorizePrice / 2);
    } else if (input.addons.deodorizeMode === "first-visit" || input.addons.deodorizeMode === "one-time") {
      firstVisitAddOns.deodorize = deodorizePrice;
    }
  }

  // Handle spray deck add-on
  if (input.addons?.sprayDeck && input.addons.sprayDeckMode) {
    if (input.addons.sprayDeckMode === "each-visit") {
      recurringAddOns.sprayDeck = sprayDeckPrice;
    } else if (input.addons.sprayDeckMode === "every-other") {
      recurringAddOns.sprayDeck = Math.round(sprayDeckPrice / 2);
    } else if (input.addons.sprayDeckMode === "first-visit" || input.addons.sprayDeckMode === "onetime") {
      firstVisitAddOns.sprayDeck = sprayDeckPrice;
    }
  }

  // Handle divert add-on (recurring only)
  if (input.addons?.divertMode && input.addons.divertMode !== "none") {
    if (input.addons.divertMode === "takeaway") {
      recurringAddOns.divert = takeawayPrice;
    } else if (input.addons.divertMode === "compost") {
      recurringAddOns.divert = compostPrice;
    }
  }

  // Calculate per-visit cost with recurring add-ons
  const totalRecurringAddOns = recurringAddOns.deodorize + recurringAddOns.sprayDeck + recurringAddOns.divert;
  const perVisitWithAddOns = perVisitCents + totalRecurringAddOns;

  const config = await getPricingConfig();
  const weekendSurchargeBase = config.settings?.weekendSurchargeCents;
  let weekendSurchargeCents = 0;
  if (input.weekendUpgrade && input.frequency === "daily") {
    if (typeof weekendSurchargeBase === "number" && weekendSurchargeBase > 0) {
      weekendSurchargeCents = weekendSurchargeBase;
    } else {
      // Default to the cost of two additional weekday visits to cover weekends.
      weekendSurchargeCents = Math.round(perVisitWithAddOns * 2);
    }
  }

  // Calculate monthly cost
  let monthlyCents = await projectedMonthlyCents(
    perVisitWithAddOns,
    input.frequency,
    { weekendUpgrade: input.weekendUpgrade },
  );
  monthlyCents += weekendSurchargeCents;

// Calculate first month cost (excludes initial clean visits)
  let firstMonthCents = await firstMonthPaymentCents(
    perVisitWithAddOns,
    input.frequency,
    { weekendUpgrade: input.weekendUpgrade },
  );
  firstMonthCents += weekendSurchargeCents;

  // Apply initial clean discounts based on frequency
  let initialCleanDiscount = 0;
  if (
    input.frequency === "weekly" ||
    input.frequency === "biweekly" ||
    input.frequency === "twice-weekly" ||
    input.frequency === "daily"
  ) {
    // 100% discount (free) for weekly, biweekly, twice-weekly
    initialCleanDiscount = initialCleanCents;
  } else if (input.frequency === "monthly") {
    // 50% discount for monthly
    initialCleanDiscount = Math.round(initialCleanCents * 0.5);
  }
  // For onetime, no discount
  
  const discountedInitialClean = initialCleanCents - initialCleanDiscount;

  // Calculate one-time service cost
  let oneTimeCents = 0;
  if (input.frequency === "onetime") {
    oneTimeCents = discountedInitialClean + 
      firstVisitAddOns.deodorize + 
      firstVisitAddOns.sprayDeck + 
      recurringAddOns.divert; // Divert applies to one-time as well
  }

  // Apply zone multiplier
  const zoneMultiplier = input.zoneMultiplier || 1.0;
  
  return {
    perVisitCents: Math.round(perVisitWithAddOns * zoneMultiplier),
    monthlyCents: Math.round(monthlyCents * zoneMultiplier),
    initialCleanCents: Math.round(initialCleanCents * zoneMultiplier), // Original cost
    initialCleanDiscount: Math.round(initialCleanDiscount * zoneMultiplier), // Discount amount
    discountedInitialClean: Math.round(discountedInitialClean * zoneMultiplier), // After discount
    firstMonthCents: Math.round((firstMonthCents + firstVisitAddOns.deodorize + firstVisitAddOns.sprayDeck) * zoneMultiplier),
    oneTimeCents: Math.round(oneTimeCents * zoneMultiplier),
    visitsPerMonth: await visitsPerMonthAsync(input.frequency, {
      weekendUpgrade: input.weekendUpgrade,
    }),
    firstMonthVisits: await firstMonthVisitsAsync(input.frequency, {
      weekendUpgrade: input.weekendUpgrade,
    }),
    breakdown: {
      basePrice: Math.round(basePerVisitCents * zoneMultiplier),
      yardAdder: 0, // Already factored into base price
      frequencyMultiplier: await getFrequencyMultiplier(input.frequency),
      addOnCents: Math.round(totalRecurringAddOns * zoneMultiplier),
      zoneMultiplier,
      weekendSurchargeCents: Math.round(weekendSurchargeCents * zoneMultiplier),
      weekendUpgrade: Boolean(input.weekendUpgrade),
    },
    firstVisitAddOns: {
      deodorize: Math.round(firstVisitAddOns.deodorize * zoneMultiplier),
      sprayDeck: Math.round(firstVisitAddOns.sprayDeck * zoneMultiplier),
      other: Math.round(firstVisitAddOns.other * zoneMultiplier),
    },
    recurringAddOns: {
      deodorize: Math.round(recurringAddOns.deodorize * zoneMultiplier),
      sprayDeck: Math.round(recurringAddOns.sprayDeck * zoneMultiplier),
      divert: Math.round(recurringAddOns.divert * zoneMultiplier),
    },
    weekendUpgrade: Boolean(input.weekendUpgrade),
    weekendSurchargeCents: Math.round(weekendSurchargeCents * zoneMultiplier),
  };
}
