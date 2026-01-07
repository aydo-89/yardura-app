-- Add capture context fields for owner stool scans
ALTER TABLE "CustomerWellnessCapture"
ADD COLUMN "scope" "WellnessReportScope" NOT NULL DEFAULT 'HOUSEHOLD',
ADD COLUMN "attribution" "WellnessAttribution" NOT NULL DEFAULT 'HOUSEHOLD',
ADD COLUMN "symptomTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "notes" TEXT,
ADD COLUMN "metadata" JSONB;

CREATE INDEX "CustomerWellnessCapture_dogId_idx" ON "CustomerWellnessCapture"("dogId");

-- Link weekly wellness reports to owner captures
CREATE TABLE "WeeklyWellnessReportCapture" (
  "reportId" TEXT NOT NULL,
  "captureId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WeeklyWellnessReportCapture_pkey" PRIMARY KEY ("reportId", "captureId"),
  CONSTRAINT "WeeklyWellnessReportCapture_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "WeeklyWellnessReport"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WeeklyWellnessReportCapture_captureId_fkey" FOREIGN KEY ("captureId") REFERENCES "CustomerWellnessCapture"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "WeeklyWellnessReportCapture_captureId_idx" ON "WeeklyWellnessReportCapture"("captureId");

-- Store wellness chat transcripts for dataset export
CREATE TABLE "CustomerWellnessChatLog" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "dogId" TEXT,
  "symptoms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "message" TEXT NOT NULL,
  "contextNotes" TEXT,
  "response" JSONB NOT NULL,
  "riskLevel" TEXT,
  "model" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CustomerWellnessChatLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerWellnessChatLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomerWellnessChatLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomerWellnessChatLog_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "CustomerWellnessChatLog_customerId_createdAt_idx" ON "CustomerWellnessChatLog"("customerId", "createdAt");
CREATE INDEX "CustomerWellnessChatLog_orgId_createdAt_idx" ON "CustomerWellnessChatLog"("orgId", "createdAt");
CREATE INDEX "CustomerWellnessChatLog_dogId_idx" ON "CustomerWellnessChatLog"("dogId");
