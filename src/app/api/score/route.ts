import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Minimal rules-based scorer placeholder
// For now, derive hints from moistureRaw/weightG if provided; otherwise return abstain

const inputSchema = z.object({
  imageUrl: z.string().url().optional(),
  weightG: z.number().optional(),
  moistureRaw: z.number().optional(),
  temperatureC: z.number().optional(),
});

type Score = {
  colorLabel?: string;
  consistencyLabel?: string;
  contentFlags?: string[];
  hydrationHint?: string;
  giCluster?: string;
  confidence: number;
  abstain?: boolean;
};

function rulesScore({ weightG, moistureRaw, temperatureC }: {
  weightG?: number;
  moistureRaw?: number;
  temperatureC?: number;
}): Score {
  let consistencyLabel: string | undefined;
  let hydrationHint: string | undefined;
  let confidence = 0.4;

  if (typeof moistureRaw === 'number') {
    if (moistureRaw >= 700) {
      consistencyLabel = 'loose';
      hydrationHint = 'possible_overhydration';
      confidence = 0.7;
    } else if (moistureRaw >= 580) {
      consistencyLabel = 'soft_form';
      confidence = 0.6;
    } else if (moistureRaw <= 380) {
      consistencyLabel = 'hard_pellets';
      hydrationHint = 'possible_dehydration';
      confidence = 0.65;
    } else {
      consistencyLabel = 'firm_log';
      confidence = 0.5;
    }
  }

  const colorLabel = 'normal_brown';
  const contentFlags: string[] = [];
  const giCluster = undefined;

  const abstain = confidence < 0.5;

  return {
    colorLabel,
    consistencyLabel,
    contentFlags,
    hydrationHint,
    giCluster,
    confidence,
    abstain,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }

    const score = rulesScore(parsed.data);
    return NextResponse.json({ score }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

