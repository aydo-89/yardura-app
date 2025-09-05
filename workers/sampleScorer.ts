import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createWorker } from '../src/lib/queue';
import { Resend } from 'resend';

const prisma = new PrismaClient();
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const adminEmails = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean);

// Rules-based scoring algorithm
function calculateSampleScore(sample: any) {
  const moisture = sample.moistureRaw || 500;
  const temperature = sample.temperatureC || 22;

  // Color analysis based on moisture
  let colorLabel = 'Brown';
  if (moisture < 300) colorLabel = 'Dark Brown';
  else if (moisture > 800) colorLabel = 'Light Brown';
  else if (moisture > 900) colorLabel = 'Yellow';

  // Consistency analysis
  let consistencyLabel = 'Normal';
  if (moisture < 200) consistencyLabel = 'Very Dry';
  else if (moisture < 400) consistencyLabel = 'Dry';
  else if (moisture > 700) consistencyLabel = 'Soft';
  else if (moisture > 900) consistencyLabel = 'Very Soft';

  // Content flags based on moisture extremes
  let contentFlags = [] as string[];
  if (moisture < 200) contentFlags.push('dehydration');
  if (moisture > 1000) contentFlags.push('diarrhea');

  // Hydration hint
  let hydrationHint = 'Normal';
  if (moisture < 300) hydrationHint = 'May indicate dehydration';
  else if (moisture > 800) hydrationHint = 'Well hydrated';

  // GI cluster (simplified)
  const giCluster = moisture > 700 ? 'loose' : moisture < 400 ? 'dry' : 'normal';

  // Confidence score
  const confidence = 0.85; // High confidence for rules-based

  return {
    colorLabel,
    consistencyLabel,
    contentFlags: contentFlags.join(','),
    hydrationHint,
    giCluster,
    confidence,
    scorerVersion: 'v1.0-rules-based',
  };
}

async function handleScore({ sampleId }: { sampleId: string }) {
  console.log(`Processing sample: ${sampleId}`);

  const sample = await (prisma as any).sample.findUnique({
    where: { id: sampleId },
    include: {
      device: true,
      customer: true,
      dog: true,
      job: true,
    },
  });

  if (!sample) {
    console.error(`Sample ${sampleId} not found`);
    return;
  }

  console.log(`Analyzing sample from device: ${sample.device?.name || 'Unknown'}`);

  let imageUrl = undefined as string | undefined;
  // TODO: Add image URL generation when needed for ML processing
  if (sample.imageUrl) {
    imageUrl = `https://storage.example.com/${sample.imageUrl}`; // Placeholder
  }

  // Calculate scores using rules-based algorithm (can be enhanced with ML later)
  const score = calculateSampleScore(sample);
  console.log(`Calculated scores: ${JSON.stringify(score)}`);

  await (prisma as any).sampleScore.create({
    data: {
      sampleId,
      colorLabel: score.colorLabel,
      consistencyLabel: score.consistencyLabel,
      contentFlags: Array.isArray(score.contentFlags) ? score.contentFlags.join(',') : score.contentFlags,
      hydrationHint: score.hydrationHint,
      giCluster: score.giCluster,
      confidence: score.confidence ?? 0.7,
      scorerVersion: score.scorerVersion,
    },
  });

  // Generate alerts based on sample analysis
  await generateAlerts(sample, score);

  // Update EcoStats for environmental impact tracking
  await updateEcoStats(sample);

  console.log(`Sample ${sampleId} processing completed successfully`);
}

async function sendAlertEmail(sample: any, alert: { level: string; kind: string; message: string }) {
  if (!resend) return;
  const recipients = [
    ...(sample.customer?.email ? [sample.customer.email] : []),
    ...adminEmails,
  ].filter(Boolean);
  if (recipients.length === 0) return;
  const subject = `Yardura Alert: ${alert.level} - ${alert.kind}`;
  const text = `A new alert was generated.\n\nOrg: ${sample.orgId}\nSample: ${sample.id}\nWhen: ${sample.capturedAt}\nDog: ${sample.dog?.name || 'N/A'}\nMessage: ${alert.message}\n\nInsights are informational only — consider consulting your vet for medical concerns.`;
  try {
    await resend.emails.send({
      from: 'Yardura <notifications@yardura.com>',
      to: recipients,
      subject,
      text,
    });
  } catch (e) {
    console.error('Failed to send alert email', e);
  }
}

async function generateAlerts(sample: any, score: any) {
  const alerts = [] as Array<{ level: 'INFO' | 'WATCH' | 'ATTENTION'; kind: string; message: string }>;

  // Alert for dehydration
  if ((score.contentFlags as string)?.includes('dehydration')) {
    alerts.push({
      level: 'WATCH',
      kind: 'dehydration_risk',
      message: 'Sample indicates potential dehydration. Consider increasing water intake.',
    });
  }

  // Alert for diarrhea
  if ((score.contentFlags as string)?.includes('diarrhea')) {
    alerts.push({
      level: 'ATTENTION',
      kind: 'digestive_issue',
      message: 'Sample shows signs of diarrhea. Monitor closely and consult vet if persistent.',
    });
  }

  // Temperature anomaly
  if (sample.temperatureC && (sample.temperatureC < 18 || sample.temperatureC > 28)) {
    alerts.push({
      level: 'INFO',
      kind: 'temperature_anomaly',
      message: `Sample temperature (${sample.temperatureC}°C) is outside normal range.`,
    });
  }

  // Trend analysis - check recent samples for patterns
  await analyzeTrends(sample, alerts);

  // Create + email alerts
  for (const alert of alerts) {
    await (prisma as any).alert.create({
      data: {
        orgId: sample.orgId,
        sampleId: sample.id,
        ...alert,
      },
    });
    await sendAlertEmail(sample, alert);
    console.log(`Created alert: ${alert.kind}`);
  }
}

async function analyzeTrends(sample: any, alerts: any[]) {
  // Get recent samples for trend analysis
  const recentSamples = await (prisma as any).sample.findMany({
    where: {
      orgId: sample.orgId,
      dogId: sample.dogId,
      capturedAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      },
    },
    include: { scores: true },
    orderBy: { capturedAt: 'desc' },
  });

  if (recentSamples.length >= 3) {
    // Check for consistent dehydration pattern
    const dehydratedCount = recentSamples.filter((s: any) =>
      s.scores[0]?.contentFlags?.includes('dehydration')
    ).length;

    if (dehydratedCount >= 2) {
      alerts.push({
        level: 'ATTENTION' as const,
        kind: 'chronic_dehydration',
        message: 'Multiple recent samples show dehydration. Consider consulting your veterinarian.',
      });
    }

    // Check for digestive issues pattern
    const digestiveIssues = recentSamples.filter((s: any) =>
      s.scores[0]?.contentFlags?.includes('diarrhea')
    ).length;

    if (digestiveIssues >= 2) {
      alerts.push({
        level: 'ATTENTION' as const,
        kind: 'digestive_trend',
        message: 'Pattern of digestive issues detected. Professional veterinary consultation recommended.',
      });
    }
  }
}

async function updateEcoStats(sample: any) {
  const periodMonth = sample.capturedAt.toISOString().slice(0, 7); // YYYY-MM

  // Calculate environmental impact
  const weightG = sample.weightG || 0;
  const divertedWeightLbs = (weightG * 0.8) / 453.592; // 80% diversion rate, convert to lbs
  const methaneAvoidedCuFt = divertedWeightLbs * 0.5; // Rough estimate

  await (prisma as any).ecoStat.upsert({
    where: {
      orgId_customerId_dogId_periodMonth: {
        orgId: sample.orgId,
        customerId: sample.customerId || 'unknown',
        dogId: sample.dogId || 'unknown',
        periodMonth,
      },
    },
    update: {
      lbsDiverted: { increment: divertedWeightLbs },
      methaneAvoidedCuFt: { increment: methaneAvoidedCuFt },
    },
    create: {
      orgId: sample.orgId,
      customerId: sample.customerId,
      dogId: sample.dogId,
      periodMonth,
      lbsDiverted: divertedWeightLbs,
      methaneAvoidedCuFt: methaneAvoidedCuFt,
    },
  });

  console.log(`Updated EcoStats for ${periodMonth}: +${divertedWeightLbs.toFixed(2)} lbs diverted`);
}

createWorker(handleScore);

console.log('sampleScorer worker started');
