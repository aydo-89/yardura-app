ALTER TABLE "CustomerWellnessPlan"
  ADD COLUMN "revenueCatAppUserId" TEXT,
  ADD COLUMN "revenueCatOriginalAppUserId" TEXT,
  ADD COLUMN "revenueCatEntitlementId" TEXT,
  ADD COLUMN "revenueCatProductId" TEXT,
  ADD COLUMN "revenueCatStore" TEXT;

CREATE INDEX "CustomerWellnessPlan_revenueCatAppUserId_idx" ON "CustomerWellnessPlan"("revenueCatAppUserId");
