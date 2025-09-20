-- AlterTable
ALTER TABLE "Account" ADD COLUMN "reset_token" TEXT;
ALTER TABLE "Account" ADD COLUMN "reset_token_expires" DATETIME;

-- CreateTable
CREATE TABLE "BusinessConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL DEFAULT 'Business',
    "serviceZones" JSONB NOT NULL,
    "basePricing" JSONB NOT NULL,
    "settings" JSONB NOT NULL,
    "operations" JSONB NOT NULL,
    "communication" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BusinessConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessConfig_orgId_key" ON "BusinessConfig"("orgId");

-- CreateIndex
CREATE INDEX "Alert_orgId_createdAt_idx" ON "Alert"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "Alert_sampleId_idx" ON "Alert"("sampleId");

-- CreateIndex
CREATE INDEX "BillingSnapshot_orgId_customerId_idx" ON "BillingSnapshot"("orgId", "customerId");

-- CreateIndex
CREATE INDEX "Device_orgId_idx" ON "Device"("orgId");

-- CreateIndex
CREATE INDEX "EcoStat_orgId_periodMonth_idx" ON "EcoStat"("orgId", "periodMonth");

-- CreateIndex
CREATE INDEX "GroundTruth_dataset_split_idx" ON "GroundTruth"("dataset", "split");

-- CreateIndex
CREATE INDEX "Sample_orgId_capturedAt_idx" ON "Sample"("orgId", "capturedAt");

-- CreateIndex
CREATE INDEX "Sample_customerId_capturedAt_idx" ON "Sample"("customerId", "capturedAt");

-- CreateIndex
CREATE INDEX "Sample_dogId_capturedAt_idx" ON "Sample"("dogId", "capturedAt");
