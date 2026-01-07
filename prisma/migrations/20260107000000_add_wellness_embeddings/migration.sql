-- Enable pgvector for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Enum for embedding sources
CREATE TYPE "WellnessEmbeddingSource" AS ENUM (
  'DOG_PROFILE',
  'WEEKLY_REPORT',
  'OWNER_CAPTURE',
  'PRO_CAPTURE',
  'FOOD_PRODUCT',
  'FOOD_LOG',
  'REMINDER',
  'CHAT_LOG'
);

-- Table for semantic embeddings
CREATE TABLE "CustomerWellnessEmbedding" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "dogId" TEXT,
  "sourceType" "WellnessEmbeddingSource" NOT NULL,
  "sourceId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "embedding" vector(1536) NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CustomerWellnessEmbedding_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CustomerWellnessEmbedding"
  ADD CONSTRAINT "CustomerWellnessEmbedding_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerWellnessEmbedding"
  ADD CONSTRAINT "CustomerWellnessEmbedding_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerWellnessEmbedding"
  ADD CONSTRAINT "CustomerWellnessEmbedding_dogId_fkey"
  FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "CustomerWellnessEmbedding_customerId_sourceType_sourceId_key"
  ON "CustomerWellnessEmbedding"("customerId", "sourceType", "sourceId");

CREATE INDEX "CustomerWellnessEmbedding_orgId_idx"
  ON "CustomerWellnessEmbedding"("orgId");

CREATE INDEX "CustomerWellnessEmbedding_customerId_idx"
  ON "CustomerWellnessEmbedding"("customerId");

CREATE INDEX "CustomerWellnessEmbedding_dogId_idx"
  ON "CustomerWellnessEmbedding"("dogId");

CREATE INDEX "CustomerWellnessEmbedding_sourceType_idx"
  ON "CustomerWellnessEmbedding"("sourceType");

CREATE INDEX "CustomerWellnessEmbedding_embedding_idx"
  ON "CustomerWellnessEmbedding"
  USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 100);
