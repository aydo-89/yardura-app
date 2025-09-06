import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest) {
  const rows = await prisma.sample.findMany({
    include: { scores: true },
    orderBy: { capturedAt: 'desc' },
    take: 2000,
  });
  const csv = [
    'id,orgId,deviceId,capturedAt,weightG,moistureRaw,temperatureC,imagePath,color,consistency,flags',
    ...rows.map((s) =>
      [
        s.id,
        s.orgId,
        s.deviceId,
        s.capturedAt.toISOString(),
        s.weightG ?? '',
        s.moistureRaw ?? '',
        s.temperatureC ?? '',
        s.imageUrl ?? '',
        s.scores[0]?.colorLabel ?? '',
        s.scores[0]?.consistencyLabel ?? '',
        s.scores[0]?.contentFlags ?? '',
      ].join(',')
    ),
  ].join('\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="samples.csv"',
    },
  });
}

export const runtime = 'nodejs';
