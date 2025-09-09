// Initial Clean Estimator - Pure functions for calculating one-time initial clean costs
// Based on cleanup bucket, dogs, yard size, and competitive Twin Cities pricing

export type CleanupBucket = '7' | '14' | '30' | '42' | '60' | '90' | '999';
export type YardSize = 'small' | 'medium' | 'large' | 'xl';
export type DogCount = 1 | 2 | 3 | 4;

// Default configuration - can be overridden by admin (DoodyCalls style)
const DEFAULT_BUCKET_CONFIG: Record<
  CleanupBucket,
  { multiplier: number; floorCents: number; label: string }
> = {
  '7': { multiplier: 1.0, floorCents: 4900, label: 'Today / ≤ 7 days (Well maintained)' },
  '14': { multiplier: 1.0, floorCents: 4900, label: '≤ 2 weeks (Well maintained)' },
  '30': { multiplier: 1.0, floorCents: 4900, label: 'Legacy - 15-30 days' }, // For backward compatibility
  '42': { multiplier: 1.75, floorCents: 6900, label: "2–6 weeks (It's pretty neglected)" },
  '60': { multiplier: 1.75, floorCents: 6900, label: 'Legacy - 31-60 days' }, // For backward compatibility
  '90': { multiplier: 1.75, floorCents: 6900, label: 'Legacy - 61-90 days' }, // For backward compatibility
  '999': { multiplier: 2.5, floorCents: 8900, label: '> 6 weeks (Watch your step!)' },
};

// Yard and dog adjustments
const YARD_DOG_ADJUSTMENTS = {
  small: 0.9, // -10% for small yards
  large: 1.05, // +5% for large yards
  xl: 1.1, // +10% for extra large yards
  dogs1: 0.95, // -5% for 1 dog
  dogs2: 1.0, // No adjustment for 2 dogs (baseline)
  dogs3: 1.05, // +5% for 3 dogs
  dogs4: 1.1, // +10% for 4 dogs
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
    initialCleanFactor: number;
    bucketMultiplier: number;
    additionalAreas: number;
    additionalAreaCost: number;
    floorCents: number;
    finalAmount: number;
  };
}

// Get default configuration
export function getDefaultConfig(): InitialCleanConfig {
  return {
    buckets: { ...DEFAULT_BUCKET_CONFIG },
    yardDogAdj: { ...YARD_DOG_ADJUSTMENTS },
  };
}

// Calculate initial clean cost
export function calculateInitialClean(
  perVisitCents: number,
  bucket: CleanupBucket,
  dogs: DogCount,
  yardSize: YardSize,
  areasToClean: {
    frontYard?: boolean;
    backYard?: boolean;
    sideYard?: boolean;
    dogRun?: boolean;
    fencedArea?: boolean;
    other?: string;
  } = {},
  config: InitialCleanConfig = getDefaultConfig()
): InitialCleanEstimate {
  const bucketConfig = config.buckets[bucket];

  // Unified initial clean: start from weekly per-visit base (dogs + yard only),
  // apply initial-clean factor, then bucket multiplier
  const INITIAL_CLEAN_FACTOR = 2.7222; // Adjusted to hit $49.00 exactly for baseline
  const baseInitial = Math.round(perVisitCents * INITIAL_CLEAN_FACTOR);
  const bucketApplied = Math.round(baseInitial * bucketConfig.multiplier);

  // Calculate additional areas cost for initial clean (+$5 per extra area)
  const selectedAreas = Object.values(areasToClean).filter(
    (value) => typeof value === 'boolean' && value
  ).length;
  const hasOtherArea = areasToClean.other && areasToClean.other.trim() !== '';
  const totalSelectedAreas = selectedAreas + (hasOtherArea ? 1 : 0);
  const additionalAreas = Math.max(0, totalSelectedAreas - 1); // Subtract 1 for the base area
  const additionalAreaCost = additionalAreas * 500; // $5 per additional area in cents

  // Total including areas
  const totalBaseAmount = bucketApplied + additionalAreaCost;

  // Apply floor price
  const finalAmount = Math.max(Math.round(totalBaseAmount), bucketConfig.floorCents);

  return {
    initialCleanCents: finalAmount,
    bucket,
    breakdown: {
      basePerVisitCents: perVisitCents,
      initialCleanFactor: INITIAL_CLEAN_FACTOR,
      bucketMultiplier: bucketConfig.multiplier,
      additionalAreas,
      additionalAreaCost,
      floorCents: bucketConfig.floorCents,
      finalAmount,
    },
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
export function getBucketLabel(
  bucket: CleanupBucket,
  config: InitialCleanConfig = getDefaultConfig()
): string {
  return config.buckets[bucket].label;
}

// Validate bucket
export function isValidBucket(bucket: string): bucket is CleanupBucket {
  return ['7', '14', '30', '60', '90', '999'].includes(bucket);
}
