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

  // TODO: baseline trend + EcoStat + Alerts
}

createWorker(handleScore);

console.log('sampleScorer worker started');
