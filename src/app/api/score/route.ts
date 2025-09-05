import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const bodySchema = z
  .object({
    sampleId: z.string().optional(),
    imageUrl: z.string().url().optional(),
    weightG: z.coerce.number().optional(),
    moistureRaw: z.coerce.number().optional(),
    temperatureC: z.coerce.number().optional(),
  })
  .refine((v) => v.sampleId || v.imageUrl, { message: 'sampleId or imageUrl required' });

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = bodySchema.parse(json);

    // Synthetic scoring placeholder
    const rand = (min: number, max: number) => Math.random() * (max - min) + min;
    const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
    const color = pick([
      'normal_brown',
      'very_dark_blackish',
      'bright_red_streaks',
      'yellowish',
      'pale_gray',
      'greenish',
      'white_streaks',
    ]);
    const consistency = pick(['hard_pellets', 'firm_log', 'soft_form', 'loose', 'liquid']);
    const flagsPool = ['mucus', 'blood_visible', 'worms_possible', 'foreign_object', 'grass_heavy'];
    const contentFlags = Math.random() < 0.2 ? [pick(flagsPool)] : [];
    const hydrationHint = pick(['none', 'possible_dehydration', 'possible_overhydration']);
    const giCluster = Math.random() < 0.15 ? pick(['possible_gi_irritation', 'none']) : 'none';

    return NextResponse.json({
      colorLabel: color,
      consistencyLabel: consistency,
      contentFlags,
      hydrationHint,
      giCluster,
      confidence: rand(0.6, 0.95),
      baselineDelta: null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
}

export const runtime = 'nodejs';
