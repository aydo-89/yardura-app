-- Add discipline events for scoopers
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'DisciplineEventType'
  ) THEN
    CREATE TYPE "DisciplineEventType" AS ENUM ('MISSED_VISIT', 'LATE_RELEASE', 'EARLY_RELEASE', 'JOB_RELEASE');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'DisciplineEventSource'
  ) THEN
    CREATE TYPE "DisciplineEventSource" AS ENUM ('SYSTEM', 'ADMIN');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ScooperDisciplineEvent" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "scooperId" TEXT NOT NULL,
  "type" "DisciplineEventType" NOT NULL,
  "source" "DisciplineEventSource" NOT NULL DEFAULT 'SYSTEM',
  "reason" TEXT,
  "serviceVisitId" TEXT,
  "jobId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ScooperDisciplineEvent_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ScooperDisciplineEvent_orgId_fkey'
  ) THEN
    ALTER TABLE "ScooperDisciplineEvent"
      ADD CONSTRAINT "ScooperDisciplineEvent_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "Org"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ScooperDisciplineEvent_scooperId_fkey'
  ) THEN
    ALTER TABLE "ScooperDisciplineEvent"
      ADD CONSTRAINT "ScooperDisciplineEvent_scooperId_fkey"
      FOREIGN KEY ("scooperId") REFERENCES "ScooperProfile"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ScooperDisciplineEvent_serviceVisitId_fkey'
  ) THEN
    ALTER TABLE "ScooperDisciplineEvent"
      ADD CONSTRAINT "ScooperDisciplineEvent_serviceVisitId_fkey"
      FOREIGN KEY ("serviceVisitId") REFERENCES "ServiceVisit"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ScooperDisciplineEvent_jobId_fkey'
  ) THEN
    ALTER TABLE "ScooperDisciplineEvent"
      ADD CONSTRAINT "ScooperDisciplineEvent_jobId_fkey"
      FOREIGN KEY ("jobId") REFERENCES "Job"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ScooperDisciplineEvent_createdById_fkey'
  ) THEN
    ALTER TABLE "ScooperDisciplineEvent"
      ADD CONSTRAINT "ScooperDisciplineEvent_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ScooperDisciplineEvent_scooperId_createdAt_idx"
  ON "ScooperDisciplineEvent" ("scooperId", "createdAt");

CREATE INDEX IF NOT EXISTS "ScooperDisciplineEvent_orgId_createdAt_idx"
  ON "ScooperDisciplineEvent" ("orgId", "createdAt");

CREATE INDEX IF NOT EXISTS "ScooperDisciplineEvent_type_createdAt_idx"
  ON "ScooperDisciplineEvent" ("type", "createdAt");
