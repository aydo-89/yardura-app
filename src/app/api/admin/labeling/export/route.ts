import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest) {
  const rows = await prisma.groundTruth.findMany({
    include: { sample: true },
    orderBy: { createdAt: 'desc' },
    take: 2000,
  });
  const csv = [
    'sampleId,imagePath,dataset,split,colorLabel,consistency,contentFlags,freshness,notStool,notes',
    ...rows.map((r) =>
      [
        r.sampleId,
        r.sample?.imageUrl || '',
        r.dataset,
        r.split,
        r.colorLabel || '',
        r.consistency || '',
        r.contentFlags || '',
        r.freshness || '',
        r.notStool ? '1' : '0',
        (r.notes || '').replaceAll(',', ' '),
      ].join(',')
    ),
  ].join('\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="groundtruth.csv"',
    },
  });
}

export const runtime = 'nodejs';
