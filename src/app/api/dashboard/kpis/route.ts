import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest) {
  const since7 = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const since30 = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  const [count30, avgWeight30, alertsOpen, ecoThisMonth] = await Promise.all([
    prisma.sample.count({ where: { capturedAt: { gte: since30 } } }),
    prisma.sample.aggregate({
      where: { capturedAt: { gte: since30 }, weightG: { not: null } },
      _avg: { weightG: true },
    }),
    prisma.alert.count({ where: { acknowledged: false } }),
    (async () => {
      const now = new Date();
      const key = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
      const eco = await prisma.ecoStat.findMany({ where: { periodMonth: key } });
      const lbs = eco.reduce((s, e) => s + e.lbsDiverted, 0);
      const methane = eco.reduce((s, e) => s + e.methaneAvoidedCuFt, 0);
      return { lbs, methane };
    })(),
  ]);

  const freq7 = await prisma.sample.count({ where: { capturedAt: { gte: since7 } } });

  return NextResponse.json({
    deposits30: count30,
    avgWeight30: avgWeight30._avg.weightG || 0,
    freq7,
    eco: ecoThisMonth,
    alertsOpen,
  });
}

export const runtime = 'nodejs';
