-- Track primary scooper assignments for recurring jobs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Job' AND column_name = 'primaryScooperId'
  ) THEN
    ALTER TABLE "Job" ADD COLUMN "primaryScooperId" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Job_primaryScooperId_fkey'
  ) THEN
    ALTER TABLE "Job"
      ADD CONSTRAINT "Job_primaryScooperId_fkey"
      FOREIGN KEY ("primaryScooperId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Job_primaryScooperId_idx" ON "Job" ("primaryScooperId");
