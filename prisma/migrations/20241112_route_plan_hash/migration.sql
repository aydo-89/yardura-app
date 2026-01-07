-- Add routing metadata columns to ScooperRoutePlan
ALTER TABLE "ScooperRoutePlan"
  ADD COLUMN IF NOT EXISTS "googleRequestHash" TEXT,
  ADD COLUMN IF NOT EXISTS "validatedAt" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "ScooperRoutePlan_googleRequestHash_idx"
  ON "ScooperRoutePlan"("googleRequestHash");
