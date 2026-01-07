-- Update weekly wellness reports to support household scope and diagnosis metadata

DO $$ BEGIN
  CREATE TYPE "WellnessReportScope" AS ENUM ('HOUSEHOLD', 'DOG');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "WellnessAttribution" AS ENUM ('HOUSEHOLD', 'OWNER_GUESS', 'OWNER_CONFIRMED', 'DEVICE_CONFIRMED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "WellnessDiagnosisSource" AS ENUM ('OWNER_REPORTED', 'VET_CONFIRMED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "WeeklyWellnessReport"
    ADD COLUMN "scope" "WellnessReportScope" NOT NULL DEFAULT 'HOUSEHOLD',
    ADD COLUMN "attribution" "WellnessAttribution" NOT NULL DEFAULT 'HOUSEHOLD',
    ADD COLUMN "suspectedDogIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "diagnosisLabel" TEXT,
    ADD COLUMN "diagnosisSource" "WellnessDiagnosisSource",
    ADD COLUMN "diagnosisDate" TIMESTAMP(3),
    ADD COLUMN "diagnosisNotes" TEXT;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

ALTER TABLE "WeeklyWellnessReport"
  ALTER COLUMN "dogId" DROP NOT NULL;

UPDATE "WeeklyWellnessReport"
SET "scope" = 'DOG',
    "attribution" = 'OWNER_GUESS'
WHERE "dogId" IS NOT NULL;

DROP INDEX IF EXISTS "WeeklyWellnessReport_customerId_dogId_weekStart_key";

CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyWellnessReport_customerId_weekStart_household_key"
  ON "WeeklyWellnessReport" ("customerId", "weekStart")
  WHERE "scope" = 'HOUSEHOLD';

CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyWellnessReport_customerId_dogId_weekStart_dog_key"
  ON "WeeklyWellnessReport" ("customerId", "dogId", "weekStart")
  WHERE "scope" = 'DOG' AND "dogId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "WeeklyWellnessReport_customerId_scope_weekStart_idx"
  ON "WeeklyWellnessReport" ("customerId", "scope", "weekStart");
