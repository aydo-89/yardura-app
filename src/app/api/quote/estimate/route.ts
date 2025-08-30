import { NextRequest, NextResponse } from 'next/server';
import {
  estimatePerVisitCents,
  projectedMonthlyCents,
  initialCleanCents,
  visitsPerMonth,
  getPricingBreakdown,
  type Frequency,
  type YardSize,
  type DogCount
} from '@/lib/priceEstimator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { dogs, yardSize, frequency, addOns } = body;

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
    const visitsPerMonth = visitsPerMonth(frequency);
    const projectedMonthlyCents = projectedMonthlyCents(perVisitCents, frequency, addOns || {});
    const initialCleanCents = initialCleanCents(perVisitCents, addOns || {});

    // Determine if initial clean should be auto-recommended
    const initialCleanAuto = projectedMonthlyCents > 8000; // Auto-recommend if monthly > $80

    const response = {
      perVisitCents,
      visitsPerMonth,
      projectedMonthlyCents,
      initialCleanMinCents: initialCleanCents,
      initialCleanAuto,
      breakdown: getPricingBreakdown(dogs, yardSize, frequency, addOns || {}).breakdown,
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
  const sample = getPricingBreakdown(1, 'medium', 'weekly');

  return NextResponse.json({
    perVisitCents: sample.perVisitCents,
    visitsPerMonth: sample.visitsPerMonth,
    projectedMonthlyCents: sample.monthlyCents,
    initialCleanMinCents: sample.initialCleanCents,
    initialCleanAuto: false,
    breakdown: sample.breakdown,
  });
}
