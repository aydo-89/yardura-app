import { NextRequest, NextResponse } from 'next/server';
import {
  estimatePerVisitCents,
  projectedMonthlyCents,
  visitsPerMonth,
  getPricingBreakdown,
  type Frequency,
  type YardSize,
  type DogCount
} from '@/lib/priceEstimator';
import {
  calculateInitialClean,
  mapDateToBucket,
  type CleanupBucket
} from '@/lib/initialCleanEstimator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { dogs, yardSize, frequency, addOns, lastCleanedBucket, lastCleanedDate } = body;

    // Validate inputs
    if (!dogs || !yardSize || !frequency) {
      return NextResponse.json(
        { error: 'Missing required fields: dogs, yardSize, frequency' },
        { status: 400 }
      );
    }

    // Type validation
    const validDogs: DogCount[] = [1, 2, 3, 4];
    const validYardSizes: YardSize[] = ['small', 'medium', 'large', 'xl'];
    const validFrequencies: Frequency[] = ['weekly', 'biweekly', 'twice-weekly'];

    if (!validDogs.includes(dogs)) {
      return NextResponse.json(
        { error: 'Invalid dog count. Must be 1-4.' },
        { status: 400 }
      );
    }

    if (!validYardSizes.includes(yardSize)) {
      return NextResponse.json(
        { error: 'Invalid yard size. Must be small, medium, large, or xl.' },
        { status: 400 }
      );
    }

    if (!validFrequencies.includes(frequency)) {
      return NextResponse.json(
        { error: 'Invalid frequency. Must be weekly, biweekly, or twice-weekly.' },
        { status: 400 }
      );
    }

    // Calculate pricing
    const perVisitCents = estimatePerVisitCents(dogs, yardSize, frequency);
    const monthlyVisits = visitsPerMonth(frequency);
    const projectedMonthly = projectedMonthlyCents(perVisitCents, frequency, addOns || {});

    // Handle cleanup bucket/date for initial clean calculation
    let cleanupBucket: CleanupBucket = '7'; // Default to well maintained
    if (lastCleanedBucket) {
      cleanupBucket = lastCleanedBucket as CleanupBucket;
    } else if (lastCleanedDate) {
      const cleanupDate = new Date(lastCleanedDate);
      cleanupBucket = mapDateToBucket(cleanupDate);
    }

    // Calculate initial clean using new estimator
    const initialCleanEstimate = calculateInitialClean(perVisitCents, cleanupBucket, dogs, yardSize);

    // Determine if initial clean should be auto-recommended (for buckets with significant backlog)
    const initialCleanAuto = ['60', '90', '999'].includes(cleanupBucket);

    const response = {
      perVisitCents,
      visitsPerMonth: monthlyVisits,
      projectedMonthlyCents: projectedMonthly,
      initialCleanCents: initialCleanEstimate.initialCleanCents,
      initialCleanBucket: cleanupBucket,
      initialCleanAuto,
      breakdown: {
        ...getPricingBreakdown(dogs, yardSize, frequency, addOns || {}).breakdown,
        initialCleanBreakdown: initialCleanEstimate.breakdown
      },
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Quote estimate error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint for testing/default values
export async function GET() {
  // Return sample pricing for 1 dog, medium yard, weekly
  const perVisitCents = estimatePerVisitCents(1, 'medium', 'weekly');
  const initialCleanEstimate = calculateInitialClean(perVisitCents, '7', 1, 'medium');

  return NextResponse.json({
    perVisitCents,
    visitsPerMonth: visitsPerMonth('weekly'),
    projectedMonthlyCents: projectedMonthlyCents(perVisitCents, 'weekly', {}),
    initialCleanCents: initialCleanEstimate.initialCleanCents,
    initialCleanBucket: '7',
    initialCleanAuto: false,
    breakdown: {
      ...getPricingBreakdown(1, 'medium', 'weekly', {}).breakdown,
      initialCleanBreakdown: initialCleanEstimate.breakdown
    },
  });
}
