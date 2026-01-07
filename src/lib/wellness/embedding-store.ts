import { createHash, randomUUID } from 'node:crypto';
import { Prisma, WellnessEmbeddingSource } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { generateEmbedding } from '@/lib/voice/embeddings';

export type WellnessEmbeddingDoc = {
  orgId: string;
  customerId: string;
  dogId: string | null;
  sourceType: WellnessEmbeddingSource;
  sourceId: string;
  content: string;
  metadata?: Prisma.InputJsonValue | null;
};

export type WellnessSemanticMatch = {
  sourceType: WellnessEmbeddingSource;
  sourceId: string;
  dogId: string | null;
  content: string;
  similarity: number;
  metadata: Record<string, unknown> | null;
};

const MAX_TEXT = 500;

const normalizeText = (value?: string | null, max = MAX_TEXT) => {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  return normalized.length > max ? `${normalized.slice(0, max - 3)}...` : normalized;
};

const hashContent = (content: string) =>
  createHash('sha256').update(content).digest('hex');

const vectorLiteral = (embedding: number[]) =>
  `[${embedding.map((value) => Number(value).toFixed(6)).join(',')}]`;

export async function collectWellnessEmbeddingDocs(options: {
  customerId: string;
  orgId: string;
  dogId?: string | null;
  lookbackDays?: number;
}): Promise<WellnessEmbeddingDoc[]> {
  const now = new Date();
  const lookbackDays = options.lookbackDays ?? 180;
  const lookback = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

  const dogFilter = options.dogId
    ? { OR: [{ dogId: options.dogId }, { dogId: null }] }
    : {};

  const [dogs, weeklyReports, ownerCaptures, proMedia, foodProducts, foodLogs, reminders, chatLogs] =
    await Promise.all([
      prisma.dog.findMany({
        where: options.dogId ? { id: options.dogId } : { customerId: options.customerId },
        select: {
          id: true,
          name: true,
          breed: true,
          age: true,
          weight: true,
          allergies: true,
          medications: true,
          dietNotes: true,
          vetName: true,
          vetClinic: true,
          vetPhone: true,
        },
      }),
      prisma.weeklyWellnessReport.findMany({
        where: {
          customerId: options.customerId,
          ...(options.dogId
            ? { OR: [{ dogId: options.dogId }, { suspectedDogIds: { has: options.dogId } }] }
            : {}),
        },
        orderBy: { weekStart: 'desc' },
        take: 12,
        select: {
          id: true,
          dogId: true,
          weekStart: true,
          weekEnd: true,
          symptomTags: true,
          stoolColors: true,
          stoolConsistency: true,
          stoolContents: true,
          appetite: true,
          hydration: true,
          energy: true,
          stoolFrequency: true,
          vomiting: true,
          diarrhea: true,
          medsNotes: true,
          behaviorNotes: true,
          stoolNotes: true,
          diagnosisLabel: true,
          diagnosisNotes: true,
        },
      }),
      prisma.customerWellnessCapture.findMany({
        where: {
          customerId: options.customerId,
          analysisStatus: { in: ['COMPLETED', 'NEEDS_REVIEW'] },
          capturedAt: { gte: lookback },
          ...(options.dogId
            ? { OR: [{ dogId: options.dogId }, { suspectedDogIds: { has: options.dogId } }] }
            : {}),
        },
        orderBy: { capturedAt: 'desc' },
        take: 12,
        select: {
          id: true,
          dogId: true,
          capturedAt: true,
          notes: true,
          analysisResult: true,
        },
      }),
      prisma.serviceVisitMedia.findMany({
        where: {
          assetType: 'INSIGHTSCOOP',
          analysisStatus: { in: ['COMPLETED', 'NEEDS_REVIEW'] },
          visibilityState: 'VISIBLE',
          capturedAt: { gte: lookback },
          serviceVisit: { customerId: options.customerId },
        },
        orderBy: { capturedAt: 'desc' },
        take: 12,
        select: {
          id: true,
          capturedAt: true,
          analysisResult: true,
        },
      }),
      prisma.customerFoodProduct.findMany({
        where: {
          customerId: options.customerId,
          ...dogFilter,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          dogId: true,
          type: true,
          brand: true,
          productName: true,
          ingredients: true,
          notes: true,
        },
      }),
      prisma.customerFoodLog.findMany({
        where: {
          customerId: options.customerId,
          ...dogFilter,
          loggedAt: { gte: lookback },
        },
        orderBy: { loggedAt: 'desc' },
        take: 24,
        select: {
          id: true,
          dogId: true,
          type: true,
          brand: true,
          productName: true,
          portion: true,
          notes: true,
          loggedAt: true,
        },
      }),
      prisma.customerWellnessReminder.findMany({
        where: {
          customerId: options.customerId,
          active: true,
          ...dogFilter,
        },
        orderBy: { nextDueAt: 'asc' },
        take: 12,
        select: {
          id: true,
          dogId: true,
          title: true,
          category: true,
          notes: true,
          nextDueAt: true,
        },
      }),
      prisma.customerWellnessChatLog.findMany({
        where: {
          customerId: options.customerId,
          createdAt: { gte: lookback },
          ...(options.dogId ? { OR: [{ dogId: options.dogId }, { dogId: null }] } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: {
          id: true,
          dogId: true,
          message: true,
          response: true,
          riskLevel: true,
          createdAt: true,
        },
      }),
    ]);

  const docs: WellnessEmbeddingDoc[] = [];

  dogs.forEach((dog) => {
    const content = normalizeText(
      [
        `Dog profile: ${dog.name}.`,
        dog.breed ? `Breed: ${dog.breed}.` : null,
        typeof dog.age === 'number' ? `Age: ${dog.age} yrs.` : null,
        typeof dog.weight === 'number' ? `Weight: ${dog.weight} lbs.` : null,
        dog.allergies ? `Allergies: ${dog.allergies}.` : null,
        dog.medications ? `Medications: ${dog.medications}.` : null,
        dog.dietNotes ? `Diet notes: ${dog.dietNotes}.` : null,
        dog.vetName ? `Vet: ${dog.vetName}.` : null,
        dog.vetClinic ? `Clinic: ${dog.vetClinic}.` : null,
        dog.vetPhone ? 'Vet phone on file.' : null,
      ]
        .filter(Boolean)
        .join(' '),
    );
    if (!content) return;
    docs.push({
      orgId: options.orgId,
      customerId: options.customerId,
      dogId: dog.id,
      sourceType: 'DOG_PROFILE',
      sourceId: dog.id,
      content,
      metadata: { name: dog.name },
    });
  });

  weeklyReports.forEach((report) => {
    const content = normalizeText(
      [
        `Weekly check-in (${report.weekStart.toISOString().slice(0, 10)}).`,
        report.symptomTags?.length ? `Symptoms: ${report.symptomTags.join(', ')}.` : null,
        report.stoolColors?.length ? `Stool colors: ${report.stoolColors.join(', ')}.` : null,
        report.stoolConsistency?.length
          ? `Stool consistency: ${report.stoolConsistency.join(', ')}.`
          : null,
        report.stoolContents?.length ? `Stool content: ${report.stoolContents.join(', ')}.` : null,
        report.appetite ? `Appetite: ${report.appetite}.` : null,
        report.hydration ? `Hydration: ${report.hydration}.` : null,
        report.energy ? `Energy: ${report.energy}.` : null,
        typeof report.stoolFrequency === 'number'
          ? `Stool frequency: ${report.stoolFrequency}.`
          : null,
        report.vomiting ? 'Vomiting noted.' : null,
        report.diarrhea ? 'Diarrhea noted.' : null,
        report.medsNotes ? `Meds notes: ${report.medsNotes}.` : null,
        report.behaviorNotes ? `Behavior notes: ${report.behaviorNotes}.` : null,
        report.stoolNotes ? `Stool notes: ${report.stoolNotes}.` : null,
        report.diagnosisLabel ? `Diagnosis: ${report.diagnosisLabel}.` : null,
        report.diagnosisNotes ? `Diagnosis notes: ${report.diagnosisNotes}.` : null,
      ]
        .filter(Boolean)
        .join(' '),
      700,
    );
    if (!content) return;
    docs.push({
      orgId: options.orgId,
      customerId: options.customerId,
      dogId: report.dogId ?? null,
      sourceType: 'WEEKLY_REPORT',
      sourceId: report.id,
      content,
      metadata: { weekStart: report.weekStart.toISOString(), weekEnd: report.weekEnd.toISOString() },
    });
  });

  ownerCaptures.forEach((capture) => {
    const analysis = capture.analysisResult as Record<string, unknown> | null;
    const summary = normalizeText(typeof analysis?.summary === 'string' ? analysis.summary : null, 240);
    const indicator = typeof analysis?.indicator === 'string' ? analysis.indicator : null;
    const content = normalizeText(
      [
        `Owner stool capture (${capture.capturedAt.toISOString().slice(0, 10)}).`,
        summary ? `Summary: ${summary}.` : null,
        indicator ? `Indicator: ${indicator}.` : null,
        typeof analysis?.color === 'string' ? `Color: ${analysis?.color}.` : null,
        typeof analysis?.consistency === 'string' ? `Consistency: ${analysis?.consistency}.` : null,
        typeof analysis?.content === 'string' ? `Content: ${analysis?.content}.` : null,
        capture.notes ? `Notes: ${capture.notes}.` : null,
      ]
        .filter(Boolean)
        .join(' '),
    );
    if (!content) return;
    docs.push({
      orgId: options.orgId,
      customerId: options.customerId,
      dogId: capture.dogId ?? null,
      sourceType: 'OWNER_CAPTURE',
      sourceId: capture.id,
      content,
      metadata: { capturedAt: capture.capturedAt.toISOString() },
    });
  });

  proMedia.forEach((media) => {
    const analysis = media.analysisResult as Record<string, unknown> | null;
    const content = normalizeText(
      [
        `Pro capture (${media.capturedAt.toISOString().slice(0, 10)}).`,
        typeof analysis?.color === 'string' ? `Color: ${analysis?.color}.` : null,
        typeof analysis?.consistency === 'string' ? `Consistency: ${analysis?.consistency}.` : null,
        typeof analysis?.content === 'string' ? `Content: ${analysis?.content}.` : null,
        typeof analysis?.observations === 'string' ? `Observations: ${analysis?.observations}.` : null,
        typeof analysis?.flag_reason === 'string' ? `Flag: ${analysis?.flag_reason}.` : null,
      ]
        .filter(Boolean)
        .join(' '),
    );
    if (!content) return;
    docs.push({
      orgId: options.orgId,
      customerId: options.customerId,
      dogId: null,
      sourceType: 'PRO_CAPTURE',
      sourceId: media.id,
      content,
      metadata: { capturedAt: media.capturedAt.toISOString() },
    });
  });

  foodProducts.forEach((item) => {
    const name = normalizeText([item.brand, item.productName].filter(Boolean).join(' ').trim(), 120);
    const content = normalizeText(
      [
        `Inventory item (${item.type}).`,
        name ? `Name: ${name}.` : null,
        item.ingredients ? `Ingredients: ${item.ingredients}.` : null,
        item.notes ? `Notes: ${item.notes}.` : null,
      ]
        .filter(Boolean)
        .join(' '),
      700,
    );
    if (!content) return;
    docs.push({
      orgId: options.orgId,
      customerId: options.customerId,
      dogId: item.dogId ?? null,
      sourceType: 'FOOD_PRODUCT',
      sourceId: item.id,
      content,
      metadata: { type: item.type, name },
    });
  });

  foodLogs.forEach((log) => {
    const name = normalizeText([log.brand, log.productName].filter(Boolean).join(' ').trim(), 120);
    const content = normalizeText(
      [
        `Food log (${log.loggedAt.toISOString().slice(0, 10)}).`,
        log.type ? `Type: ${log.type}.` : null,
        name ? `Item: ${name}.` : null,
        log.portion ? `Qty: ${log.portion}.` : null,
        log.notes ? `Notes: ${log.notes}.` : null,
      ]
        .filter(Boolean)
        .join(' '),
    );
    if (!content) return;
    docs.push({
      orgId: options.orgId,
      customerId: options.customerId,
      dogId: log.dogId ?? null,
      sourceType: 'FOOD_LOG',
      sourceId: log.id,
      content,
      metadata: { type: log.type, loggedAt: log.loggedAt.toISOString() },
    });
  });

  reminders.forEach((reminder) => {
    const content = normalizeText(
      [
        `Reminder (${reminder.category}).`,
        reminder.title ? `Title: ${reminder.title}.` : null,
        reminder.notes ? `Notes: ${reminder.notes}.` : null,
        reminder.nextDueAt ? `Next due: ${reminder.nextDueAt.toISOString().slice(0, 10)}.` : null,
      ]
        .filter(Boolean)
        .join(' '),
    );
    if (!content) return;
    docs.push({
      orgId: options.orgId,
      customerId: options.customerId,
      dogId: reminder.dogId ?? null,
      sourceType: 'REMINDER',
      sourceId: reminder.id,
      content,
      metadata: { nextDueAt: reminder.nextDueAt.toISOString(), category: reminder.category },
    });
  });

  chatLogs.forEach((chat) => {
    const response = chat.response as Record<string, unknown> | null;
    const reply = normalizeText(typeof response?.reply === 'string' ? response.reply : null, 240);
    const content = normalizeText(
      [
        `Chat (${chat.createdAt.toISOString().slice(0, 10)}).`,
        chat.message ? `Question: ${chat.message}.` : null,
        reply ? `Reply: ${reply}.` : null,
        chat.riskLevel ? `Risk: ${chat.riskLevel}.` : null,
      ]
        .filter(Boolean)
        .join(' '),
      700,
    );
    if (!content) return;
    docs.push({
      orgId: options.orgId,
      customerId: options.customerId,
      dogId: chat.dogId ?? null,
      sourceType: 'CHAT_LOG',
      sourceId: chat.id,
      content,
      metadata: { riskLevel: chat.riskLevel ?? null, createdAt: chat.createdAt.toISOString() },
    });
  });

  return docs;
}

export async function ensureWellnessEmbeddings(options: {
  docs: WellnessEmbeddingDoc[];
  maxDocs?: number;
}): Promise<{ embedded: number; skipped: number }> {
  const docs = options.docs;
  if (!docs.length) {
    return { embedded: 0, skipped: 0 };
  }

  const customerId = docs[0].customerId;
  const lookupClauses = docs.map((doc) => ({
    sourceType: doc.sourceType,
    sourceId: doc.sourceId,
  }));

  const existing = await prisma.customerWellnessEmbedding.findMany({
    where: {
      customerId,
      OR: lookupClauses,
    },
    select: {
      sourceType: true,
      sourceId: true,
      contentHash: true,
    },
  });

  const existingMap = new Map(
    existing.map((row) => [`${row.sourceType}:${row.sourceId}`, row.contentHash]),
  );

  const toEmbed = docs.filter((doc) => {
    const hash = hashContent(doc.content);
    return existingMap.get(`${doc.sourceType}:${doc.sourceId}`) !== hash;
  });

  const limit = options.maxDocs ?? 20;
  const trimmed = toEmbed.slice(0, limit);
  let embedded = 0;

  for (const doc of trimmed) {
    const contentHash = hashContent(doc.content);
    const embeddingResult = await generateEmbedding(doc.content);
    const vector = vectorLiteral(embeddingResult.embedding);
    const metadataJson = doc.metadata ? JSON.stringify(doc.metadata) : null;

    await prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "CustomerWellnessEmbedding" (
          "id",
          "orgId",
          "customerId",
          "dogId",
          "sourceType",
          "sourceId",
          "content",
          "contentHash",
          "embedding",
          "metadata",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${randomUUID()},
          ${doc.orgId},
          ${doc.customerId},
          ${doc.dogId},
          ${doc.sourceType},
          ${doc.sourceId},
          ${doc.content},
          ${contentHash},
          ${vector}::vector,
          ${metadataJson}::jsonb,
          NOW(),
          NOW()
        )
        ON CONFLICT ("customerId", "sourceType", "sourceId")
        DO UPDATE SET
          "content" = EXCLUDED."content",
          "contentHash" = EXCLUDED."contentHash",
          "embedding" = EXCLUDED."embedding",
          "metadata" = EXCLUDED."metadata",
          "updatedAt" = NOW()
      `,
    );
    embedded += 1;
  }

  return { embedded, skipped: docs.length - embedded };
}

export async function searchWellnessEmbeddings(options: {
  customerId: string;
  dogId?: string | null;
  query: string;
  limit?: number;
}): Promise<WellnessSemanticMatch[]> {
  const queryText = normalizeText(options.query, 800) ?? options.query;
  if (!queryText) return [];

  const embeddingResult = await generateEmbedding(queryText);
  const vector = vectorLiteral(embeddingResult.embedding);
  const limit = options.limit ?? 6;
  const dogId = options.dogId ?? null;

  const rows = await prisma.$queryRaw<
    Array<{
      sourceType: WellnessEmbeddingSource;
      sourceId: string;
      dogId: string | null;
      content: string;
      similarity: number;
      metadata: Record<string, unknown> | null;
    }>
  >(Prisma.sql`
    SELECT
      "sourceType",
      "sourceId",
      "dogId",
      "content",
      (1 - ("embedding" <=> ${vector}::vector))::float AS similarity,
      "metadata"
    FROM "CustomerWellnessEmbedding"
    WHERE "customerId" = ${options.customerId}
      AND (${dogId}::text IS NULL OR "dogId" IS NULL OR "dogId" = ${dogId})
    ORDER BY "embedding" <=> ${vector}::vector
    LIMIT ${limit}
  `);

  return rows.map((row) => ({
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    dogId: row.dogId,
    content: normalizeText(row.content, 300) ?? row.content,
    similarity: Number(row.similarity ?? 0),
    metadata: row.metadata ?? null,
  }));
}
