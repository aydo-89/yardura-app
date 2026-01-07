-- Customer wellness memory and care credits rewards

CREATE TABLE "CustomerWellnessMemory" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "dogId" TEXT,
  "key" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "lastMessageAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerWellnessMemory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerWellnessMemory_customerId_key_key" ON "CustomerWellnessMemory"("customerId", "key");
CREATE INDEX "CustomerWellnessMemory_orgId_idx" ON "CustomerWellnessMemory"("orgId");
CREATE INDEX "CustomerWellnessMemory_dogId_idx" ON "CustomerWellnessMemory"("dogId");

ALTER TABLE "CustomerWellnessMemory"
  ADD CONSTRAINT "CustomerWellnessMemory_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerWellnessMemory"
  ADD CONSTRAINT "CustomerWellnessMemory_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerWellnessMemory"
  ADD CONSTRAINT "CustomerWellnessMemory_dogId_fkey"
  FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TYPE "CustomerRewardRedemptionStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'FULFILLED',
  'REJECTED',
  'CANCELLED'
);

CREATE TYPE "CustomerRewardEventType" AS ENUM (
  'WEEKLY_REPORT',
  'VISIT_RATING'
);

CREATE TABLE "CustomerRewardItem" (
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
  CONSTRAINT "CustomerRewardItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerRewardItem_orgId_idx" ON "CustomerRewardItem"("orgId");
CREATE INDEX "CustomerRewardItem_isActive_idx" ON "CustomerRewardItem"("isActive");
CREATE UNIQUE INDEX "CustomerRewardItem_orgId_slug_key" ON "CustomerRewardItem"("orgId", "slug");

ALTER TABLE "CustomerRewardItem"
  ADD CONSTRAINT "CustomerRewardItem_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CustomerRewardRedemption" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "rewardItemId" TEXT NOT NULL,
  "status" "CustomerRewardRedemptionStatus" NOT NULL DEFAULT 'PENDING',
  "pointsCost" INTEGER NOT NULL,
  "notes" TEXT,
  "metadata" JSONB,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  "fulfilledAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerRewardRedemption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerRewardRedemption_orgId_idx" ON "CustomerRewardRedemption"("orgId");
CREATE INDEX "CustomerRewardRedemption_customerId_idx" ON "CustomerRewardRedemption"("customerId");
CREATE INDEX "CustomerRewardRedemption_rewardItemId_idx" ON "CustomerRewardRedemption"("rewardItemId");
CREATE INDEX "CustomerRewardRedemption_status_idx" ON "CustomerRewardRedemption"("status");

ALTER TABLE "CustomerRewardRedemption"
  ADD CONSTRAINT "CustomerRewardRedemption_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerRewardRedemption"
  ADD CONSTRAINT "CustomerRewardRedemption_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerRewardRedemption"
  ADD CONSTRAINT "CustomerRewardRedemption_rewardItemId_fkey"
  FOREIGN KEY ("rewardItemId") REFERENCES "CustomerRewardItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CustomerRewardEvent" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "eventType" "CustomerRewardEventType" NOT NULL,
  "points" INTEGER NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerRewardEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerRewardEvent_orgId_idx" ON "CustomerRewardEvent"("orgId");
CREATE INDEX "CustomerRewardEvent_customerId_idx" ON "CustomerRewardEvent"("customerId");
CREATE INDEX "CustomerRewardEvent_eventType_idx" ON "CustomerRewardEvent"("eventType");
CREATE UNIQUE INDEX "CustomerRewardEvent_orgId_eventType_sourceKey_key"
  ON "CustomerRewardEvent"("orgId", "eventType", "sourceKey");

ALTER TABLE "CustomerRewardEvent"
  ADD CONSTRAINT "CustomerRewardEvent_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerRewardEvent"
  ADD CONSTRAINT "CustomerRewardEvent_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
