import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { addSampleScoreJob } from '@/lib/queue';

const schema = z.object({ sampleId: z.string() });

export async function POST(req: NextRequest) {
  try {
    const data = schema.parse(await req.json());
    await addSampleScoreJob({ sampleId: data.sampleId });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
}

export const runtime = 'nodejs';
