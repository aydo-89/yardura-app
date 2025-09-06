import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const schema = z.object({
  sampleId: z.string(),
  dataset: z.string().default('v0.1'),
  split: z.enum(['train', 'val', 'test']).default('train'),
  colorLabel: z.string().optional(),
  consistency: z.string().optional(),
  contentFlags: z.array(z.string()).optional(),
  freshness: z.string().optional(),
  notStool: z.boolean().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);

    const flags = data.contentFlags?.join(',') || null;

    const upsert = await prisma.groundTruth.upsert({
      where: { sampleId: data.sampleId },
      create: {
        sampleId: data.sampleId,
        dataset: data.dataset,
        split: data.split,
        colorLabel: data.colorLabel || null,
        consistency: data.consistency || null,
        contentFlags: flags,
        freshness: data.freshness || null,
        notStool: data.notStool ?? false,
        notes: data.notes || null,
      },
      update: {
        dataset: data.dataset,
        split: data.split,
        colorLabel: data.colorLabel || null,
        consistency: data.consistency || null,
        contentFlags: flags,
        freshness: data.freshness || null,
        notStool: data.notStool ?? false,
        notes: data.notes || null,
      },
    });

    return NextResponse.json({ ok: true, id: upsert.id });
  } catch (e: any) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
}

export const runtime = 'nodejs';
