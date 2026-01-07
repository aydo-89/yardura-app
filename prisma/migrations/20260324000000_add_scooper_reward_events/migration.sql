-- Scooper reward events ledger

CREATE TYPE "ScooperRewardEventType" AS ENUM (
  'DAILY_CHECK',
  'VISIT_COMPLETE',
  'SAMPLE_SURFACE',
  'SAMPLE_CROSS',
  'DETECTION_FLAG',
  'VET_CONFIRMED'
);

CREATE TABLE "ScooperRewardEvent" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "scooperId" TEXT NOT NULL,
  "eventType" "ScooperRewardEventType" NOT NULL,
  "points" INTEGER NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "serviceVisitId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScooperRewardEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScooperRewardEvent_orgId_idx" ON "ScooperRewardEvent"("orgId");
CREATE INDEX "ScooperRewardEvent_scooperId_idx" ON "ScooperRewardEvent"("scooperId");
CREATE INDEX "ScooperRewardEvent_eventType_idx" ON "ScooperRewardEvent"("eventType");
CREATE INDEX "ScooperRewardEvent_serviceVisitId_idx" ON "ScooperRewardEvent"("serviceVisitId");
CREATE UNIQUE INDEX "ScooperRewardEvent_orgId_eventType_sourceKey_key"
  ON "ScooperRewardEvent"("orgId", "eventType", "sourceKey");

ALTER TABLE "ScooperRewardEvent"
  ADD CONSTRAINT "ScooperRewardEvent_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScooperRewardEvent"
  ADD CONSTRAINT "ScooperRewardEvent_scooperId_fkey"
  FOREIGN KEY ("scooperId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScooperRewardEvent"
  ADD CONSTRAINT "ScooperRewardEvent_serviceVisitId_fkey"
  FOREIGN KEY ("serviceVisitId") REFERENCES "ServiceVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
