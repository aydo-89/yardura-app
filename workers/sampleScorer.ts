import { prisma } from '@/lib/prisma';
import { createWorker } from '@/lib/queue';
import { createSignedUrl } from '@/lib/supabase-admin';

async function handleScore({ sampleId }: { sampleId: string }) {
  const sample = await prisma.sample.findUnique({ where: { id: sampleId } });
  if (!sample) return;

  let imageUrl = undefined as string | undefined;
  if (sample.imageUrl) {
    imageUrl = await createSignedUrl(process.env.STORAGE_BUCKET || 'stool-samples', sample.imageUrl, 600);
  }

  // Call local scoring API (placeholder)
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sampleId,
      imageUrl: imageUrl || undefined,
      weightG: sample.weightG || undefined,
      moistureRaw: sample.moistureRaw || undefined,
      temperatureC: sample.temperatureC || undefined,
    }),
  });
  const score = await res.json();

  await prisma.sampleScore.create({
    data: {
      sampleId,
      colorLabel: score.colorLabel,
      consistencyLabel: score.consistencyLabel,
      contentFlags: Array.isArray(score.contentFlags) ? score.contentFlags.join(',') : score.contentFlags,
      hydrationHint: score.hydrationHint,
      giCluster: score.giCluster,
      confidence: score.confidence ?? 0.7,
      baselineDelta: score.baselineDelta ?? null,
    },
  });

  // Baseline window: last 8 samples for the same dog or customer
  const dogOrCustomer = sample.dogId ? { dogId: sample.dogId } : { customerId: sample.customerId };
  const recent = await prisma.sample.findMany({
    where: { ...dogOrCustomer, orgId: sample.orgId },
    orderBy: { capturedAt: 'desc' },
    take: 8,
    include: { scores: true },
  });

  // Simple cluster rule: 2+ in last 7 days with soft/loose/liquid and mucus/blood flag
  const now = Date.now();
  const concerning = recent.filter((s) => {
    const t = s.capturedAt.getTime();
    if (now - t > 7 * 24 * 3600 * 1000) return false;
    const sc = s.scores[0];
    if (!sc) return false;
    const soft = ['soft_form', 'loose', 'liquid'].includes(sc.consistencyLabel || '');
    const flags = (sc.contentFlags || '').toLowerCase();
    const mucusOrBlood = flags.includes('mucus') || flags.includes('blood');
    return soft && mucusOrBlood;
  });

  if (concerning.length >= 2) {
    await prisma.alert.create({
      data: {
        orgId: sample.orgId,
        sampleId: sample.id,
        level: 'ATTENTION',
        kind: 'trend_gi',
        message:
          'We noticed a trend of softer stools with mucus/blood in recent visits. These insights are informational only — consider talking to your vet.',
      },
    });
  }

  // EcoStat monthly update
  const monthKey = `${sample.capturedAt.getUTCFullYear()}-${String(sample.capturedAt.getUTCMonth() + 1).padStart(2, '0')}`;
  const lbsDiverted = (sample.weightG || 0) * 0.00220462; // g → lbs
  const methane = lbsDiverted * 0.475 * 0.0035; // heuristic
  await prisma.ecoStat.upsert({
    where: { orgId_periodMonth: { orgId: sample.orgId, periodMonth: monthKey } as any },
    update: {
      lbsDiverted: { increment: lbsDiverted },
      methaneAvoidedCuFt: { increment: methane },
    },
    create: {
      orgId: sample.orgId,
      customerId: sample.customerId || null,
      dogId: sample.dogId || null,
      periodMonth: monthKey,
      lbsDiverted,
      methaneAvoidedCuFt: methane,
    },
  } as any);
}

createWorker(handleScore);

console.log('sampleScorer worker started');
