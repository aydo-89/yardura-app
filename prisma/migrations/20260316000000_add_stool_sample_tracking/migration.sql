-- Add stool sample tracking columns to ServiceVisitMedia
-- These columns enable linking individual stool samples across multiple photos
-- and building a comprehensive dataset for AI training

-- Create the StoolSampleView enum if it doesn't exist
DO $$ BEGIN
  CREATE TYPE "StoolSampleView" AS ENUM ('SURFACE', 'CROSS_SECTION');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add stool sample tracking columns
DO $$ BEGIN
  ALTER TABLE "ServiceVisitMedia"
    ADD COLUMN "stoolSampleId" TEXT,
    ADD COLUMN "stoolSampleView" "StoolSampleView";
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Index for efficient querying of stool samples by ID (for pairing surface + cross-section)
CREATE INDEX IF NOT EXISTS "ServiceVisitMedia_stoolSampleId_idx" ON "ServiceVisitMedia"("stoolSampleId");

-- Add media review columns for QA workflow
DO $$ BEGIN
  CREATE TYPE "MediaReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'NEEDS_ACTION');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MediaVisibility" AS ENUM ('VISIBLE', 'HIDDEN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ServiceVisitMedia"
    ADD COLUMN "reviewStatus" "MediaReviewStatus" NOT NULL DEFAULT 'PENDING',
    ADD COLUMN "visibilityState" "MediaVisibility" NOT NULL DEFAULT 'VISIBLE',
    ADD COLUMN "reviewedAt" TIMESTAMPTZ,
    ADD COLUMN "reviewedById" TEXT,
    ADD COLUMN "moderationNotes" TEXT;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Index for review workflow queries
CREATE INDEX IF NOT EXISTS "ServiceVisitMedia_reviewStatus_idx" ON "ServiceVisitMedia"("reviewStatus");
CREATE INDEX IF NOT EXISTS "ServiceVisitMedia_reviewedById_idx" ON "ServiceVisitMedia"("reviewedById");

-- Foreign key for reviewer
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'ServiceVisitMedia_reviewedById_fkey'
  ) THEN
    ALTER TABLE "ServiceVisitMedia"
      ADD CONSTRAINT "ServiceVisitMedia_reviewedById_fkey"
        FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE;
  END IF;
END $$;






