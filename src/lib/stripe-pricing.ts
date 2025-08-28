import { Frequency, YardSize } from './pricing';

// Comprehensive Stripe pricing configuration
// This maps exactly to your quote calculator pricing

export interface StripePriceConfig {
  frequency: Frequency;
  yardSize: YardSize;
  dogs: number;
  priceId: string;
  unitAmount: number; // in cents
  description: string;
}

// Yard size multipliers (same as in pricing.ts)
const YARD_MULTIPLIERS = {
  small: 0.8,   // 20% discount
  medium: 1.0,  // base price
  large: 1.2,   // 20% premium
  xlarge: 1.4   // 40% premium
};

// Base rates from pricing.ts
const BASE_RATES = {
  weekly: { base1: 20, base2: 24, base3: 28, extraDog: 4 },
  "twice-weekly": { base1: 32, base2: 38, base3: 44, extraDog: 6 },
  "bi-weekly": { base1: 28, base2: 32, base3: 36, extraDog: 4 },
  "one-time": { base1: 89, base2: 104, base3: 119, extraDog: 15 }
};

// Calculate price per visit based on dogs and yard size
function calculatePricePerVisit(frequency: Frequency, dogs: number, yardSize: YardSize): number {
  const rates = BASE_RATES[frequency];
  let basePrice: number;

  if (dogs === 1) {
    basePrice = rates.base1;
  } else if (dogs === 2) {
    basePrice = rates.base2;
  } else {
    basePrice = rates.base3 + (dogs - 3) * rates.extraDog;
  }

  // Apply yard size multiplier
  basePrice *= YARD_MULTIPLIERS[yardSize];

  // For bi-weekly, this is the per-visit price
  // For twice-weekly, this is per-visit (total weekly divided by 2)
  // For weekly, this is the weekly price
  // For one-time, this is the one-time price

  return Math.round(basePrice * 100) / 100; // Round to 2 decimal places
}

// Generate all possible price configurations
export function generateStripePrices(): StripePriceConfig[] {
  const configs: StripePriceConfig[] = [];
  const frequencies: Frequency[] = ['weekly', 'twice-weekly', 'bi-weekly', 'one-time'];
  const yardSizes: YardSize[] = ['small', 'medium', 'large', 'xlarge'];
  const dogCounts = [1, 2, 3, 4, 5, 6, 7, 8];

  for (const frequency of frequencies) {
    for (const yardSize of yardSizes) {
      for (const dogs of dogCounts) {
        const pricePerVisit = calculatePricePerVisit(frequency, dogs, yardSize);
        const unitAmount = Math.round(pricePerVisit * 100); // Convert to cents

        // Generate consistent price ID
        const priceId = `price_${frequency.replace('-', '_')}_${yardSize}_${dogs}dog`;

        configs.push({
          frequency,
          yardSize,
          dogs,
          priceId,
          unitAmount,
          description: `${dogs} dog${dogs > 1 ? 's' : ''}, ${yardSize} yard, ${frequency} service`
        });
      }
    }
  }

  return configs;
}

// Get price ID for specific configuration
export function getPriceId(frequency: Frequency, yardSize: YardSize, dogs: number): string {
  return `price_${frequency.replace('-', '_')}_${yardSize}_${dogs}dog`;
}

export function buildLookupKey(frequency: Frequency, yardSize: YardSize, dogs: number): string {
  return `${frequency}_${yardSize}_${dogs}dog`;
}

// Get all prices for a specific frequency
export function getPricesByFrequency(frequency: Frequency): StripePriceConfig[] {
  const allPrices = generateStripePrices();
  return allPrices.filter(config => config.frequency === frequency);
}

// Get all prices for a specific yard size
export function getPricesByYardSize(yardSize: YardSize): StripePriceConfig[] {
  const allPrices = generateStripePrices();
  return allPrices.filter(config => config.yardSize === yardSize);
}

// Get all prices for a specific dog count
export function getPricesByDogCount(dogs: number): StripePriceConfig[] {
  const allPrices = generateStripePrices();
  return allPrices.filter(config => config.dogs === dogs);
}

// Example usage:
// const weeklyPrices = getPricesByFrequency('weekly');
// const mediumYardPrices = getPricesByYardSize('medium');
// const priceId = getPriceId('weekly', 'medium', 2);

// This generates 4 frequencies × 4 yard sizes × 8 dog counts = 128 total price configurations
// Each price ID follows the pattern: price_{frequency}_{yard_size}_{dogs}dog
// Example: price_weekly_medium_2dog
