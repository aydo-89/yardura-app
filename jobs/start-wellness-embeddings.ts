#!/usr/bin/env tsx

import { prisma } from '@/lib/prisma';
import {
  collectWellnessEmbeddingDocs,
  ensureWellnessEmbeddings,
} from '@/lib/wellness/embedding-store';

async function main() {
  const batchSize = Number(process.env.WELLNESS_EMBEDDINGS_BATCH ?? 25);
  const perCustomerLimit = Number(process.env.WELLNESS_EMBEDDINGS_PER_CUSTOMER ?? 30);
  let cursor: string | null = null;
  let processed = 0;
  let embedded = 0;

  console.log('🚀 Starting Wellness Embeddings Sweep');
  console.log(`   Batch size: ${batchSize}`);
  console.log(`   Per customer limit: ${perCustomerLimit}`);

  while (true) {
    const customers: Array<{ id: string; orgId: string }> = await prisma.customer.findMany({
      orderBy: { id: 'asc' },
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: { id: true, orgId: true },
    });

    if (customers.length === 0) break;

    for (const customer of customers) {
      try {
        const docs = await collectWellnessEmbeddingDocs({
          customerId: customer.id,
          orgId: customer.orgId,
        });
        const result = await ensureWellnessEmbeddings({
          docs,
          maxDocs: perCustomerLimit,
        });
        processed += 1;
        embedded += result.embedded;
      } catch (error) {
        console.warn(`[wellness-embeddings] Customer ${customer.id} failed`, error);
      }
    }

    cursor = customers[customers.length - 1]?.id ?? null;
  }

  console.log(`✅ Done. Customers processed: ${processed}, embeddings upserted: ${embedded}`);
}

main().catch((error) => {
  console.error('Wellness embeddings sweep failed', error);
  process.exit(1);
});
