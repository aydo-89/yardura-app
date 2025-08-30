// Pricing estimator for Yardura dog waste removal services
// Based on competitor research and positioning strategy

export type Frequency = 'weekly' | 'biweekly' | 'twice-weekly';
export type YardSize = 'small' | 'medium' | 'large' | 'xl';
export type DogCount = 1 | 2 | 3 | 4;

// Base pricing in cents (medium yard, weekly)
const BASE_PRICES: Record<DogCount, number> = {
  1: 2000, // $20.00
  2: 2400, // $24.00
  3: 2800, // $28.00
  4: 3200, // $32.00
};

// Yard size adders in cents
const YARD_ADDERS: Record<YardSize, number> = {
  small: 0,
  medium: 0,
  large: 400,  // +$4.00
  xl: 800,     // +$8.00
};

// Frequency multipliers
const FREQUENCY_MULTIPLIERS: Record<Frequency, number> = {
  'weekly': 1.0,
  'biweekly': 1.25,     // Higher per-visit due to accumulation
  'twice-weekly': 0.9,  // Slight discount for route density
};

// Add-on prices in cents
const ADD_ON_PRICES = {
  deodorize: 500,  // +$5.00
  litter: 500,     // +$5.00
};

// Initial clean multiplier (one-time)
const INITIAL_CLEAN_MULTIPLIER = 2.5;
const INITIAL_CLEAN_MINIMUM = 8900; // $89.00 minimum

/**
 * Calculate per-visit price in cents
 */
export function estimatePerVisitCents(
  dogs: DogCount,
  yardSize: YardSize,
  frequency: Frequency
): number {
  const basePrice = BASE_PRICES[dogs];
  const yardAdder = YARD_ADDERS[yardSize];
  const multiplier = FREQUENCY_MULTIPLIERS[frequency];

  return Math.round((basePrice + yardAdder) * multiplier);
}

/**
 * Calculate visits per month based on frequency
 */
export function visitsPerMonth(frequency: Frequency): number {
  switch (frequency) {
    case 'twice-weekly':
      return 8;
    case 'weekly':
      return 4;
    case 'biweekly':
      return 2;
    default:
      return 4;
  }
}

/**
 * Calculate projected monthly cost in cents
 */
export function projectedMonthlyCents(
  perVisitCents: number,
  frequency: Frequency,
  addOns: { deodorize?: boolean; litter?: boolean } = {}
): number {
  const addOnCents = (addOns.deodorize ? ADD_ON_PRICES.deodorize : 0) +
                     (addOns.litter ? ADD_ON_PRICES.litter : 0);

  return (perVisitCents + addOnCents) * visitsPerMonth(frequency);
}

/**
 * Calculate initial clean cost in cents
 */
export function initialCleanCents(
  perVisitCents: number,
  addOns: { deodorize?: boolean; litter?: boolean } = {}
): number {
  const addOnCents = (addOns.deodorize ? ADD_ON_PRICES.deodorize : 0) +
                     (addOns.litter ? ADD_ON_PRICES.litter : 0);

  const baseInitialClean = Math.round((perVisitCents + addOnCents) * INITIAL_CLEAN_MULTIPLIER);
  return Math.max(baseInitialClean, INITIAL_CLEAN_MINIMUM);
}

/**
 * Get pricing breakdown for display
 */
export function getPricingBreakdown(
  dogs: DogCount,
  yardSize: YardSize,
  frequency: Frequency,
  addOns: { deodorize?: boolean; litter?: boolean } = {}
) {
  const perVisitCents = estimatePerVisitCents(dogs, yardSize, frequency);
  const monthlyCents = projectedMonthlyCents(perVisitCents, frequency, addOns);
  const initialCleanCentsValue = initialCleanCents(perVisitCents, addOns);
  const visitsPerMonth = visitsPerMonth(frequency);

  return {
    perVisitCents,
    monthlyCents,
    initialCleanCents: initialCleanCentsValue,
    visitsPerMonth,
    breakdown: {
      basePrice: BASE_PRICES[dogs],
      yardAdder: YARD_ADDERS[yardSize],
      frequencyMultiplier: FREQUENCY_MULTIPLIERS[frequency],
      addOnCents: (addOns.deodorize ? ADD_ON_PRICES.deodorize : 0) +
                  (addOns.litter ? ADD_ON_PRICES.litter : 0),
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

// Export constants for external use
export {
  BASE_PRICES,
  YARD_ADDERS,
  FREQUENCY_MULTIPLIERS,
  ADD_ON_PRICES,
  INITIAL_CLEAN_MULTIPLIER,
  INITIAL_CLEAN_MINIMUM,
};