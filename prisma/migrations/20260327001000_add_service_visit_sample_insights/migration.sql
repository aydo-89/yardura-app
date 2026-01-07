-- CreateTable
CREATE TABLE "public"."ServiceVisitSampleInsight" (
  "id" TEXT NOT NULL,
  "serviceVisitId" TEXT NOT NULL,
  "stoolSampleId" TEXT NOT NULL,
  "sourceMediaIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "colorIndicator" TEXT NOT NULL,
  "consistencyIndicator" TEXT NOT NULL,
  "contentIndicator" TEXT NOT NULL,
  "observations" TEXT,
  "wellnessFlag" BOOLEAN NOT NULL DEFAULT false,
  "flagReason" TEXT,
  "analysisStatus" "public"."MediaAnalysisStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
  "analysisModel" TEXT,
  "analysisRequestedAt" TIMESTAMP(3),
  "analysisCompletedAt" TIMESTAMP(3),
  "analysisError" TEXT,
  "analysisConfidence" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ServiceVisitSampleInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceVisitSampleInsight_serviceVisitId_stoolSampleId_key"
ON "public"."ServiceVisitSampleInsight"("serviceVisitId", "stoolSampleId");

-- CreateIndex
CREATE INDEX "ServiceVisitSampleInsight_serviceVisitId_idx"
ON "public"."ServiceVisitSampleInsight"("serviceVisitId");

-- CreateIndex
CREATE INDEX "ServiceVisitSampleInsight_stoolSampleId_idx"
ON "public"."ServiceVisitSampleInsight"("stoolSampleId");

-- CreateIndex
CREATE INDEX "ServiceVisitSampleInsight_analysisStatus_idx"
ON "public"."ServiceVisitSampleInsight"("analysisStatus");

-- CreateIndex
CREATE INDEX "ServiceVisitSampleInsight_wellnessFlag_idx"
ON "public"."ServiceVisitSampleInsight"("wellnessFlag");

-- AddForeignKey
ALTER TABLE "public"."ServiceVisitSampleInsight"
ADD CONSTRAINT "ServiceVisitSampleInsight_serviceVisitId_fkey"
FOREIGN KEY ("serviceVisitId") REFERENCES "public"."ServiceVisit"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
