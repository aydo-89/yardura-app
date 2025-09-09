export type Frequency = 'weekly' | 'twice-weekly' | 'bi-weekly' | 'one-time';

// Yard size categories for pricing
export type YardSize = 'small' | 'medium' | 'large' | 'xlarge';

export const YARD_SIZE_MULTIPLIERS = {
  small: 0.8, // < 1/4 acre
  medium: 1.0, // 1/4 - 1/2 acre
  large: 1.2, // 1/2 - 1 acre
  xlarge: 1.4, // > 1 acre
};

export const BASE_RATES = {
  weekly: { base1: 20, base2: 24, base3: 28, extraDog: 4, visitMultiplier: 1 },
  'twice-weekly': { base1: 32, base2: 38, base3: 44, extraDog: 6, visitMultiplier: 1 }, // weekly total for 2 visits
  'bi-weekly': { base1: 28, base2: 32, base3: 36, extraDog: 4, visitMultiplier: 1 / 2 }, // charged per visit, occurs twice monthly
  'one-time': { base1: 89, base2: 104, base3: 119, extraDog: 15, visitMultiplier: 0 },
} as const;

// Backward compatible signature:
// - calcWeeklyEstimate(dogs, frequency, { deodorize, litter })
// - calcWeeklyEstimate(dogs, frequency, yardSize, { deodorize, litter })
export function calcPerVisitEstimate(
  dogs: number,
  frequency: Frequency,
  a?: YardSize | { deodorize: boolean; litter: boolean },
  b?: { deodorize: boolean; litter: boolean }
): number {
  const rates = BASE_RATES[frequency as keyof typeof BASE_RATES];

  // Determine yardSize and addOns from flexible args
  let yardSize: YardSize = 'medium';
  let addOns: { deodorize: boolean; litter: boolean } = { deodorize: false, litter: false };
  if (typeof a === 'string') {
    yardSize = a;
    if (b) addOns = b;
  } else if (typeof a === 'object' && a) {
    addOns = a as { deodorize: boolean; litter: boolean };
  }

  const tier =
    dogs <= 1
      ? (rates as any).base1
      : dogs === 2
        ? (rates as any).base2
        : (rates as any).base3 + Math.max(0, dogs - 3) * (rates as any).extraDog;

  // Per visit calculation
  let perVisit = 0;
  if (frequency === 'weekly')
    perVisit = tier; // one visit per week
  else if (frequency === 'twice-weekly')
    perVisit = tier / 2; // weekly total divided by two visits
  else if (frequency === 'bi-weekly')
    perVisit = tier; // price charged per visit
  else perVisit = 0; // handled by calcOneTimeEstimate

  // Apply yard size multiplier
  perVisit *= YARD_SIZE_MULTIPLIERS[yardSize];

  if (addOns.deodorize) perVisit += 10;
  if (addOns.litter && frequency !== 'one-time') perVisit += 5;

  return Math.round(perVisit * 100) / 100;
}

// Backward compatible signature:
// - calcOneTimeEstimate(dogs, { deodorize })
// - calcOneTimeEstimate(dogs, yardSize, { deodorize })
export function calcOneTimeEstimate(
  dogs: number,
  a?: YardSize | { deodorize: boolean },
  b?: { deodorize: boolean }
): number {
  const r = BASE_RATES['one-time'];
  const tier = dogs <= 1 ? r.base1 : dogs === 2 ? r.base2 : r.base3 + (dogs - 3) * r.extraDog;

  let yardSize: YardSize = 'medium';
  let addOns: { deodorize: boolean } = { deodorize: false };
  if (typeof a === 'string') {
    yardSize = a;
    if (b) addOns = b;
  } else if (typeof a === 'object' && a) {
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
  addOns: { deodorize: boolean; litter: boolean }
): number {
  if (frequency === 'one-time') {
    return calcOneTimeEstimate(dogs, yardSize, { deodorize: addOns.deodorize });
  } else {
    return calcPerVisitEstimate(dogs, frequency, yardSize, addOns);
  }
}
