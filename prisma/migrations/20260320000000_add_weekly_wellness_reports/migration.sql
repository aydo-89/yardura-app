-- Weekly wellness reports for customer-submitted symptoms and notes

CREATE TABLE "WeeklyWellnessReport" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "dogId" TEXT NOT NULL,
  "weekStart" TIMESTAMP(3) NOT NULL,
  "weekEnd" TIMESTAMP(3) NOT NULL,
  "noIssues" BOOLEAN NOT NULL DEFAULT false,
  "stoolColors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "stoolConsistency" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "stoolContents" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "symptomTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "appetite" TEXT,
  "hydration" TEXT,
  "behaviorNotes" TEXT,
  "stoolNotes" TEXT,
  "consentToShare" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WeeklyWellnessReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WeeklyWellnessReport_orgId_weekStart_idx" ON "WeeklyWellnessReport"("orgId", "weekStart");
CREATE INDEX "WeeklyWellnessReport_customerId_weekStart_idx" ON "WeeklyWellnessReport"("customerId", "weekStart");
CREATE INDEX "WeeklyWellnessReport_dogId_weekStart_idx" ON "WeeklyWellnessReport"("dogId", "weekStart");
CREATE UNIQUE INDEX "WeeklyWellnessReport_customerId_dogId_weekStart_key" ON "WeeklyWellnessReport"("customerId", "dogId", "weekStart");

ALTER TABLE "WeeklyWellnessReport"
  ADD CONSTRAINT "WeeklyWellnessReport_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WeeklyWellnessReport"
  ADD CONSTRAINT "WeeklyWellnessReport_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WeeklyWellnessReport"
  ADD CONSTRAINT "WeeklyWellnessReport_dogId_fkey"
  FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WeeklyWellnessReportMedia" (
  "reportId" TEXT NOT NULL,
  "mediaId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WeeklyWellnessReportMedia_pkey" PRIMARY KEY ("reportId", "mediaId")
);

CREATE INDEX "WeeklyWellnessReportMedia_mediaId_idx" ON "WeeklyWellnessReportMedia"("mediaId");

ALTER TABLE "WeeklyWellnessReportMedia"
  ADD CONSTRAINT "WeeklyWellnessReportMedia_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "WeeklyWellnessReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WeeklyWellnessReportMedia"
  ADD CONSTRAINT "WeeklyWellnessReportMedia_mediaId_fkey"
  FOREIGN KEY ("mediaId") REFERENCES "ServiceVisitMedia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
