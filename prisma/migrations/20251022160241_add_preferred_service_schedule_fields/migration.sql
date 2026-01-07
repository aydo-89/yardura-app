-- AlterTable
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Lead' AND column_name = 'preferredServiceDay'
  ) THEN
    ALTER TABLE "Lead" ADD COLUMN "preferredServiceDay" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Lead' AND column_name = 'preferredTimeWindow'
  ) THEN
    ALTER TABLE "Lead" ADD COLUMN "preferredTimeWindow" TEXT;
  END IF;
END $$;
