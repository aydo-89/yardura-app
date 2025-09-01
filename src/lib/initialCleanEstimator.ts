// Initial Clean Estimator - Pure functions for calculating one-time initial clean costs
// Based on cleanup bucket, dogs, yard size, and competitive Twin Cities pricing

export type CleanupBucket = '7' | '14' | '30' | '42' | '60' | '90' | '999';
export type YardSize = 'small' | 'medium' | 'large' | 'xl';
export type DogCount = 1 | 2 | 3 | 4;

// Default configuration - can be overridden by admin (DoodyCalls style)
const DEFAULT_BUCKET_CONFIG: Record<CleanupBucket, { multiplier: number; floorCents: number; label: string }> = {
  '7': { multiplier: 1.00, floorCents: 0, label: 'Today / ≤ 7 days (Well maintained)' },
  '14': { multiplier: 1.25, floorCents: 4900, label: '< 2 weeks (It\'s spotless)' },
  '30': { multiplier: 1.25, floorCents: 4900, label: 'Legacy - 15-30 days' }, // For backward compatibility
  '42': { multiplier: 1.75, floorCents: 6900, label: '2–6 weeks (It\'s pretty neglected)' },
  '60': { multiplier: 1.75, floorCents: 6900, label: 'Legacy - 31-60 days' }, // For backward compatibility
  '90': { multiplier: 1.75, floorCents: 6900, label: 'Legacy - 61-90 days' }, // For backward compatibility
  '999': { multiplier: 2.25, floorCents: 8900, label: '> 6 weeks (Watch your step!)' }
};

// Yard and dog adjustments
const YARD_DOG_ADJUSTMENTS = {
  small: 0.90,  // -10% for small yards
  large: 1.05,  // +5% for large yards
  xl: 1.10,     // +10% for extra large yards
  dogs1: 0.95,  // -5% for 1 dog
  dogs2: 1.0,   // No adjustment for 2 dogs (baseline)
  dogs3: 1.05,  // +5% for 3 dogs
  dogs4: 1.10   // +10% for 4 dogs
};

export interface InitialCleanConfig {
  buckets: Record<CleanupBucket, { multiplier: number; floorCents: number; label: string }>;
  yardDogAdj: typeof YARD_DOG_ADJUSTMENTS;
}

export interface InitialCleanEstimate {
  initialCleanCents: number;
  bucket: CleanupBucket;
  breakdown: {
    basePerVisitCents: number;
    bucketMultiplier: number;
    yardDogAdjustment: number;
    floorCents: number;
    finalAmount: number;
  };
}

// Get default configuration
export function getDefaultConfig(): InitialCleanConfig {
  return {
    buckets: { ...DEFAULT_BUCKET_CONFIG },
    yardDogAdj: { ...YARD_DOG_ADJUSTMENTS }
  };
}

// Calculate initial clean cost
export function calculateInitialClean(
  perVisitCents: number,
  bucket: CleanupBucket,
  dogs: DogCount,
  yardSize: YardSize,
  config: InitialCleanConfig = getDefaultConfig()
): InitialCleanEstimate {
  const bucketConfig = config.buckets[bucket];

  // Calculate base amount from per-visit pricing and bucket multiplier
  const baseAmount = perVisitCents * bucketConfig.multiplier;

  // Apply yard and dog adjustments
  let yardDogAdjustment = 1.0;

  // Yard size adjustments
  if (yardSize === 'small') yardDogAdjustment *= config.yardDogAdj.small;
  if (yardSize === 'large') yardDogAdjustment *= config.yardDogAdj.large;
  if (yardSize === 'xl') yardDogAdjustment *= config.yardDogAdj.xl;

  // Dog count adjustments
  if (dogs === 1) yardDogAdjustment *= config.yardDogAdj.dogs1;
  if (dogs === 2) yardDogAdjustment *= config.yardDogAdj.dogs2;
  if (dogs === 3) yardDogAdjustment *= config.yardDogAdj.dogs3;
  if (dogs === 4) yardDogAdjustment *= config.yardDogAdj.dogs4;

  const adjustedAmount = baseAmount * yardDogAdjustment;

  // Apply floor price
  const finalAmount = Math.max(Math.round(adjustedAmount), bucketConfig.floorCents);

  return {
    initialCleanCents: finalAmount,
    bucket,
    breakdown: {
      basePerVisitCents: perVisitCents,
      bucketMultiplier: bucketConfig.multiplier,
      yardDogAdjustment,
      floorCents: bucketConfig.floorCents,
      finalAmount
    }
  };
}

// Map date to cleanup bucket (DoodyCalls style)
export function mapDateToBucket(cleanupDate: Date): CleanupBucket {
  const now = new Date();
  const daysDiff = Math.floor((now.getTime() - cleanupDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff <= 14) return '14'; // < 2 weeks
  if (daysDiff <= 42) return '42'; // 2-6 weeks
  return '999'; // > 6 weeks
}

// Format price for display
export function formatInitialCleanPrice(cents: number): string {
  if (cents === 0) return 'Free';
  return `$${(cents / 100).toFixed(2)}`;
}

// Get bucket label
export function getBucketLabel(bucket: CleanupBucket, config: InitialCleanConfig = getDefaultConfig()): string {
  return config.buckets[bucket].label;
}

// Validate bucket
export function isValidBucket(bucket: string): bucket is CleanupBucket {
  return ['7', '14', '30', '60', '90', '999'].includes(bucket);
}
