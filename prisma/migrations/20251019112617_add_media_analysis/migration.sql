-- Create enums for media analysis tracking
DO $$ BEGIN
  CREATE TYPE "MediaAnalysisStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'NEEDS_REVIEW');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "VisitInsightSource" AS ENUM ('MANUAL', 'AUTOMATED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Extend ServiceVisitMedia with analysis metadata
DO $$ BEGIN
  ALTER TABLE "ServiceVisitMedia"
    ADD COLUMN "analysisStatus" "MediaAnalysisStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    ADD COLUMN "analysisModel" TEXT,
    ADD COLUMN "analysisRequestedAt" TIMESTAMPTZ,
    ADD COLUMN "analysisCompletedAt" TIMESTAMPTZ,
    ADD COLUMN "analysisError" TEXT,
    ADD COLUMN "analysisConfidence" DOUBLE PRECISION,
    ADD COLUMN "analysisResult" JSONB;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Index to help filter by analysis lifecycle
CREATE INDEX IF NOT EXISTS "ServiceVisitMedia_analysisStatus_idx" ON "ServiceVisitMedia"("analysisStatus");

-- Extend VisitInsight to track automated sources and provenance
DO $$ BEGIN
  ALTER TABLE "VisitInsight"
    ADD COLUMN "source" "VisitInsightSource" NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN "sourceMediaId" TEXT,
    ADD COLUMN "autoConfidence" DOUBLE PRECISION,
    ADD COLUMN "analysisModel" TEXT,
    ADD COLUMN "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Track provenance linkage
CREATE INDEX IF NOT EXISTS "VisitInsight_source_idx" ON "VisitInsight"("source");
CREATE INDEX IF NOT EXISTS "VisitInsight_sourceMediaId_idx" ON "VisitInsight"("sourceMediaId");

-- Wire VisitInsight to ServiceVisitMedia when applicable
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'VisitInsight_sourceMediaId_fkey'
  ) THEN
    ALTER TABLE "VisitInsight"
      ADD CONSTRAINT "VisitInsight_sourceMediaId_fkey"
        FOREIGN KEY ("sourceMediaId") REFERENCES "ServiceVisitMedia"("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE;
  END IF;
END $$;
