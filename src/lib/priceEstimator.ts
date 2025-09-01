// Pricing estimator for Yardura dog waste removal services
// Based on competitor research and positioning strategy

export type Frequency = 'weekly' | 'biweekly' | 'twice-weekly' | 'monthly' | 'onetime';
export type YardSize = 'small' | 'medium' | 'large' | 'xl';
export type DogCount = 1 | 2 | 3 | 4;
export type PremiumOnboarding = 'none' | 'essential' | 'premium-dna' | 'wellness-microbiome';

export interface QuoteInput {
  // Service area validation
  zipCode?: string;
  serviceType?: 'residential' | 'commercial';

  // Basic service details
  dogs: number; // Changed from DogCount to allow free-form for commercial
  yardSize: YardSize;
  frequency: Frequency;

  // Property info
  propertyType?: 'residential' | 'commercial'; // Legacy field, use serviceType instead
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
    deodorizeMode?: 'first-visit' | 'each-visit';
  };

  // Cleanup timing
  lastCleanedBucket?: string;
  lastCleanedDate?: string;
  initialClean?: boolean;
  premiumOnboarding?: PremiumOnboarding;

  // Areas to clean (DoodyCalls inspired)
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

  // Lead source (DoodyCalls inspired)
  howDidYouHear?: string;

  // Scheduling preferences
  preferredStartDate?: string;
  customStartDate?: string;
  preferredContactMethods?: string[];
  smsConsent?: boolean;

  // Assessment information
  deepCleanAssessment?: {
    daysSinceLastCleanup?: number;
    currentCondition?: 'excellent' | 'good' | 'fair' | 'poor';
    specialNotes?: string;
  };

  // Special instructions (DoodyCalls inspired)
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
  small: -200,  // -$2.00 (smaller yard discount)
  medium: 0,    // baseline
  large: 400,   // +$4.00
  xl: 800,      // +$8.00
};

// Frequency multipliers
const FREQUENCY_MULTIPLIERS: Record<Frequency, number> = {
  'weekly': 1.0,
  'biweekly': 1.25,     // Higher per-visit due to accumulation
  'twice-weekly': 0.9,  // Slight discount for route density
  'monthly': 1.5,       // Highest per-visit due to accumulation
  'onetime': 1.0,       // Same as weekly for single service
};

// Add-on prices in cents
const ADD_ON_PRICES = {
  deodorize: 500,  // +$5.00 every other visit
};

// One-time service base pricing (competitive with $89-100 market)
const ONE_TIME_BASE_PRICES = {
  small: 8900,   // $89 - small yards
  medium: 9900,  // $99 - medium yards (most common)
  large: 11900,  // $119 - large yards
  xl: 14900      // $149 - extra large yards
};

// Deep clean assessment multipliers based on time since last cleanup (DoodyCalls style)
const DEEP_CLEAN_MULTIPLIERS: Record<number, number> = {
  7: 1.0,    // < 2 weeks - well maintained, minimal accumulation ($89-149)
  21: 1.15,  // 2-6 weeks - moderate accumulation, needs attention ($102-171)
  60: 1.25,  // 1-3 months - significant accumulation ($111-186)
  90: 1.35,  // 3+ months - major deep clean recommended ($120-201)
  // Legacy values for backward compatibility
  14: 1.1,   // 1-2 weeks - moderate accumulation ($98-164)
  30: 1.15,  // 2-4 weeks - significant accumulation ($102-171)
  999: 1.5   // Over 3 months - extreme accumulation ($134-224)
};

// Premium onboarding options in cents
export const PREMIUM_ONBOARDING_PRICES: Record<PremiumOnboarding, number> = {
  'none': 0,
  'essential': 9900,        // $99.00
  'premium-dna': 24900,     // $249.00
  'wellness-microbiome': 34900, // $349.00
};

/**
 * Calculate per-visit price in cents
 */
export function estimatePerVisitCents(
  dogs: number,
  yardSize: YardSize,
  frequency: Frequency
): number {
  // Handle commercial properties with flexible dog counts
  const basePrice = BASE_PRICES[dogs as DogCount] || BASE_PRICES[4] + (dogs - 4) * 200; // $2 extra per additional dog
  const yardAdder = YARD_ADDERS[yardSize];
  const multiplier = FREQUENCY_MULTIPLIERS[frequency];

  return Math.round((basePrice + yardAdder) * multiplier);
}

/**
 * Calculate visits per month based on frequency
 * Uses minimum visits (rounded down) for conservative pricing
 */
export function visitsPerMonth(frequency: Frequency): number {
  switch (frequency) {
    case 'twice-weekly':
      return 8; // Minimum 8 visits per month
    case 'weekly':
      return 4; // Minimum 4 visits per month
    case 'biweekly':
      return 2; // Minimum 2 visits per month
    case 'monthly':
      return 1; // 1 visit per month
    case 'onetime':
      return 1;  // One-time service
    default:
      return 4;
  }
}

/**
 * Get accurate visit range for frequency (accounts for calendar variations)
 */
export function getVisitRange(frequency: Frequency): { min: number; max: number; average: number } {
  switch (frequency) {
    case 'twice-weekly':
      return { min: 8, max: 9, average: 8.7 };
    case 'weekly':
      return { min: 4, max: 5, average: 4.3 };
    case 'biweekly':
      return { min: 2, max: 3, average: 2.2 };
    case 'monthly':
      return { min: 1, max: 1, average: 1 };
    case 'onetime':
      return { min: 1, max: 1, average: 1 };
    default:
      return { min: 4, max: 5, average: 4.3 };
  }
}

/**
 * Get calendar-aware pricing explanation
 */
export function getCalendarPricingNote(frequency: Frequency): string {
  if (frequency === 'onetime') return '';

  const range = getVisitRange(frequency);
  if (range.min === range.max) return '';

  return `Due to calendar variations, you may have ${range.min}-${range.max} visits per month. Pricing is based on ${range.min} visits for your protection.`;
}

/**
 * Calculate projected monthly cost in cents
 */
export function projectedMonthlyCents(
  perVisitCents: number,
  frequency: Frequency,
  addOns: { deodorize?: boolean } = {}
): number {
  // Deodorize is applied per visit, so multiply by visits per month
  const deodorizeCostPerVisit = addOns.deodorize ? ADD_ON_PRICES.deodorize : 0;

  return (perVisitCents + deodorizeCostPerVisit) * visitsPerMonth(frequency);
}

/**
 * Calculate initial clean cost in cents
 */
export function initialCleanCents(
  perVisitCents: number,
  addOns: { deodorize?: boolean } = {}
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
  addOns: { deodorize?: boolean } = {}
) {
  const perVisitCents = estimatePerVisitCents(dogs, yardSize, frequency);
  const monthlyCents = projectedMonthlyCents(perVisitCents, frequency, addOns);
  const initialCleanCentsValue = initialCleanCents(perVisitCents, addOns);
  const visitsPerMonthValue = visitsPerMonth(frequency);

  return {
    perVisitCents,
    monthlyCents,
    initialCleanCents: initialCleanCentsValue,
    visitsPerMonth: visitsPerMonthValue,
    breakdown: {
      basePrice: BASE_PRICES[dogs as DogCount] || BASE_PRICES[4] + (dogs - 4) * 200,
      yardAdder: YARD_ADDERS[yardSize],
      frequencyMultiplier: FREQUENCY_MULTIPLIERS[frequency],
      addOnCents: (addOns.deodorize ? ADD_ON_PRICES.deodorize : 0),
    }
  };
}

/**
 * Format cents to currency string
 */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

/**
 * Get frequency display name
 */
export function getFrequencyDisplayName(frequency: Frequency): string {
  switch (frequency) {
    case 'weekly':
      return 'Weekly';
    case 'biweekly':
      return 'Every Other Week';
    case 'twice-weekly':
      return 'Twice Weekly';
    case 'onetime':
      return 'One-Time';
    default:
      return 'Weekly';
  }
}

/**
 * Get yard size display name
 */
export function getYardSizeDisplayName(yardSize: YardSize): string {
  switch (yardSize) {
    case 'small':
      return 'Small';
    case 'medium':
      return 'Medium';
    case 'large':
      return 'Large';
    case 'xl':
      return 'Extra Large';
    default:
      return 'Medium';
  }
}

/**
 * Calculate complete price breakdown for display
 */
export function calculatePrice(input: {
  dogs: number;
  yardSize: YardSize;
  frequency: Frequency;
  addons?: { deodorize?: boolean };
  initialClean?: boolean;
  premiumOnboarding?: PremiumOnboarding;
  deepCleanAssessment?: {
    daysSinceLastCleanup?: number;
    currentCondition?: 'excellent' | 'good' | 'fair' | 'poor';
    specialNotes?: string;
  };
  propertyType?: 'residential' | 'commercial';
  address?: string;
  lastCleanedBucket?: string;
  lastCleanedDate?: string;
}) {
  // Check for commercial properties
  const isCommercialProperty = input.propertyType === 'commercial' ||
    (input.address && /park|hotel|motel|apartment|condo|business|office|store|restaurant|school|church|community|facility/i.test(input.address));

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
      commercialMessage: 'Commercial properties require a custom quote. Please contact us for pricing.'
    };
  }

  const basePerVisitCents = estimatePerVisitCents(input.dogs, input.yardSize, input.frequency);

  // Calculate additional area costs ($3 per additional area for recurring, $5 for one-time, first area free)
  let additionalAreaCostPerVisit = 0;
  let additionalAreaCostOneTime = 0;
  if ((input as any).areasToClean) {
    const selectedAreas = Object.values((input as any).areasToClean).filter((v: any) => v).length;
    const extraAreas = Math.max(0, selectedAreas - 1);

    if (input.frequency === 'onetime') {
      additionalAreaCostOneTime = extraAreas * 500; // $5 = 500 cents for one-time
    } else {
      additionalAreaCostPerVisit = extraAreas * 300; // $3 = 300 cents for recurring
    }
  }

  // Calculate deodorize add-on cost based on mode
  let deodorizePerVisitCost = 0;
  let deodorizeOneTimeCost = 0;

  if (input.addons?.deodorize && (input.addons as any).deodorizeMode) {
    if ((input.addons as any).deodorizeMode === 'each-visit') {
      deodorizePerVisitCost = ADD_ON_PRICES.deodorize;
    } else if ((input.addons as any).deodorizeMode === 'first-visit') {
      deodorizeOneTimeCost = ADD_ON_PRICES.deodorize;
    }
  }

  const addOnCostPerVisit = deodorizePerVisitCost;
  const perVisitCents = basePerVisitCents + addOnCostPerVisit + additionalAreaCostPerVisit;
  const monthlyCents = projectedMonthlyCents(basePerVisitCents + addOnCostPerVisit + additionalAreaCostPerVisit, input.frequency, input.addons || {});
  const visitsPerMonthValue = visitsPerMonth(input.frequency);

  // Calculate initial clean cost using new estimator
  let initialCleanCost = 0;
  let initialCleanBucket: string = '7';
  if (input.lastCleanedBucket) {
    initialCleanBucket = input.lastCleanedBucket;
  } else if (input.lastCleanedDate) {
    // Import the function here to avoid circular dependency
    const { mapDateToBucket } = require('./initialCleanEstimator');
    const cleanupDate = new Date(input.lastCleanedDate);
    initialCleanBucket = mapDateToBucket(cleanupDate);
  } else if (input.deepCleanAssessment?.daysSinceLastCleanup) {
    initialCleanBucket = input.deepCleanAssessment.daysSinceLastCleanup.toString();
  }

  // Use new initial clean estimator
  const { calculateInitialClean } = require('./initialCleanEstimator');
  const initialCleanEstimate = calculateInitialClean(perVisitCents, initialCleanBucket as any, input.dogs, input.yardSize);
  initialCleanCost = initialCleanEstimate.initialCleanCents;

  // Calculate premium onboarding cost
  const premiumOnboardingCents = input.premiumOnboarding && input.premiumOnboarding !== 'none'
    ? PREMIUM_ONBOARDING_PRICES[input.premiumOnboarding]
    : 0;

  // Calculate one-time service pricing (use initial clean cost for simplicity)
  let oneTimeCents = 0;
  if (input.frequency === 'onetime') {
    // For one-time service, simply use the initial clean cost
    // This matches what users see in the "initial clean" pricing and is simpler
    oneTimeCents = initialCleanCost;

    // Add premium onboarding costs if selected
    oneTimeCents += premiumOnboardingCents;

    // Add deodorize cost based on mode for one-time service
    oneTimeCents += deodorizeOneTimeCost;

    // Add additional area costs for one-time service
    oneTimeCents += additionalAreaCostOneTime;
  }

  return {
    perVisit: perVisitCents,
    monthly: monthlyCents,
    visitsPerMonth: visitsPerMonthValue,
    total: input.frequency === 'onetime' ? oneTimeCents : monthlyCents,
    oneTime: oneTimeCents,
    initialClean: initialCleanCost,
    initialCleanCents: initialCleanCost,
    initialCleanBucket: initialCleanBucket,
    premiumOnboarding: premiumOnboardingCents,
    breakdown: input.frequency === 'onetime' ? {
      basePrice: ONE_TIME_BASE_PRICES[input.yardSize],
      yardAdder: 0, // Already factored into base price
      frequencyMultiplier: 1.0,
      addOnCents: input.addons?.deodorize ? ADD_ON_PRICES.deodorize : 0,
    } : getPricingBreakdown(input.dogs, input.yardSize, input.frequency, input.addons || {}).breakdown,
  };
}

/**
 * Get yard size options for UI
 */
export function getYardSizeOptions() {
  return [
    { value: 'small', label: 'Small (< 2,500 sq ft)', description: 'Compact urban lot' },
    { value: 'medium', label: 'Medium (2,500-5,000 sq ft)', description: 'Standard suburban home' },
    { value: 'large', label: 'Large (5,000-10,000 sq ft)', description: 'Spacious property' },
    { value: 'xl', label: 'XL (> 10,000 sq ft)', description: 'Large estate or multiple lots' },
  ];
}

/**
 * Get frequency options for UI
 */
export function getFrequencyOptions() {
  return [
    { value: 'weekly', label: 'Weekly Service', description: 'Most popular - consistent cleanliness' },
    { value: 'biweekly', label: 'Every Other Week', description: 'Cost-effective for lighter needs' },
    { value: 'twice-weekly', label: 'Twice Weekly', description: 'Maximum cleanliness' },
  ];
}

/**
 * Get all service type options for UI (including one-time)
 */
export function getServiceTypeOptions() {
  return [
    { value: 'weekly', label: 'Weekly (4/month)', description: 'Most popular - consistent cleanliness & maintenance', isPopular: true },
    { value: 'twice-weekly', label: 'Twice Weekly (8/month)', description: 'Maximum cleanliness - intensive service schedule' },
    { value: 'biweekly', label: 'Every Other Week (2/month)', description: 'Balanced frequency - fewer visits, higher per-visit cost' },
    { value: 'monthly', label: 'Monthly (1/month)', description: 'Cost-effective for lighter needs' },
    { value: 'onetime', label: 'Just Once', description: 'Perfect for first-time service or seasonal cleanup' },
  ];
}

/**
 * Get add-on options for UI
 */
export function getAddonOptions() {
  return [
    { value: 'deodorize', label: 'Enhanced Deodorizing', price: 500, description: 'Premium odor-neutralizing treatment applied every other visit for superior scent control' },
  ];
}

/**
 * Get premium onboarding options for UI
 */
export function getPremiumOnboardingOptions() {
  return [
    {
      value: 'premium-dna',
      label: 'Premium DNA Kit (Coming Soon)',
      price: 0, // Disable pricing for now
      description: 'Advanced dog DNA testing for breed identification and genetic health insights. Coming soon - reserve your spot for early access.',
      disabled: true,
    },
    {
      value: 'wellness-microbiome',
      label: 'Wellness+ Microbiome Kit (Coming Soon)',
      price: 0, // Disable pricing for now
      description: 'Comprehensive gut microbiome analysis for optimal pet health. Coming soon with lab partnerships.',
      disabled: true,
    },
  ];
}

/**
 * Get premium onboarding display name
 */
export function getPremiumOnboardingDisplayName(onboarding: PremiumOnboarding): string {
  switch (onboarding) {
    case 'none':
      return 'Standard Onboarding';
    case 'essential':
      return 'Essential Welcome Package';
    case 'premium-dna':
      return 'Premium DNA Kit (Coming Soon)';
    case 'wellness-microbiome':
      return 'Wellness+ Microbiome Kit (Coming Soon)';
    default:
      return 'Standard Onboarding';
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