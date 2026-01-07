-- Scooper rewards catalog and redemption tracking

CREATE TYPE "ScooperRewardRedemptionStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'FULFILLED',
  'REJECTED',
  'CANCELLED'
);

CREATE TABLE "ScooperRewardItem" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "pointsCost" INTEGER NOT NULL,
  "category" TEXT,
  "imageUrl" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScooperRewardItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScooperRewardItem_orgId_idx" ON "ScooperRewardItem"("orgId");
CREATE INDEX "ScooperRewardItem_isActive_idx" ON "ScooperRewardItem"("isActive");
CREATE UNIQUE INDEX "ScooperRewardItem_orgId_slug_key" ON "ScooperRewardItem"("orgId", "slug");

ALTER TABLE "ScooperRewardItem"
  ADD CONSTRAINT "ScooperRewardItem_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ScooperRewardRedemption" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "scooperId" TEXT NOT NULL,
  "scooperProfileId" TEXT,
  "rewardItemId" TEXT NOT NULL,
  "status" "ScooperRewardRedemptionStatus" NOT NULL DEFAULT 'PENDING',
  "pointsCost" INTEGER NOT NULL,
  "notes" TEXT,
  "metadata" JSONB,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  "fulfilledAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScooperRewardRedemption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScooperRewardRedemption_orgId_idx" ON "ScooperRewardRedemption"("orgId");
CREATE INDEX "ScooperRewardRedemption_scooperId_idx" ON "ScooperRewardRedemption"("scooperId");
CREATE INDEX "ScooperRewardRedemption_rewardItemId_idx" ON "ScooperRewardRedemption"("rewardItemId");
CREATE INDEX "ScooperRewardRedemption_status_idx" ON "ScooperRewardRedemption"("status");

ALTER TABLE "ScooperRewardRedemption"
  ADD CONSTRAINT "ScooperRewardRedemption_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScooperRewardRedemption"
  ADD CONSTRAINT "ScooperRewardRedemption_scooperId_fkey"
  FOREIGN KEY ("scooperId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScooperRewardRedemption"
  ADD CONSTRAINT "ScooperRewardRedemption_scooperProfileId_fkey"
  FOREIGN KEY ("scooperProfileId") REFERENCES "ScooperProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ScooperRewardRedemption"
  ADD CONSTRAINT "ScooperRewardRedemption_rewardItemId_fkey"
  FOREIGN KEY ("rewardItemId") REFERENCES "ScooperRewardItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
