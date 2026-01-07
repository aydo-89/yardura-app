-- Add customer email report preferences
CREATE TYPE "CustomerEmailReportCadence" AS ENUM ('WEEKLY', 'MONTHLY');

CREATE TABLE "CustomerEmailReportPreference" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "cadence" "CustomerEmailReportCadence" NOT NULL DEFAULT 'WEEKLY',
  "sendHour" INTEGER NOT NULL DEFAULT 8,
  "dayOfWeek" INTEGER NOT NULL DEFAULT 1,
  "dayOfMonth" INTEGER NOT NULL DEFAULT 1,
  "timeZone" TEXT,
  "recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "includeWellness" BOOLEAN NOT NULL DEFAULT true,
  "includeScooping" BOOLEAN NOT NULL DEFAULT true,
  "includeFood" BOOLEAN NOT NULL DEFAULT true,
  "includeWalks" BOOLEAN NOT NULL DEFAULT true,
  "includeReminders" BOOLEAN NOT NULL DEFAULT true,
  "includeChats" BOOLEAN NOT NULL DEFAULT true,
  "includePhotos" BOOLEAN NOT NULL DEFAULT true,
  "lastSentAt" TIMESTAMP(3),
  "lastPeriodKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CustomerEmailReportPreference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerEmailReportPreference_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomerEmailReportPreference_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CustomerEmailReportPreference_customerId_key" ON "CustomerEmailReportPreference"("customerId");
CREATE INDEX "CustomerEmailReportPreference_orgId_idx" ON "CustomerEmailReportPreference"("orgId");
CREATE INDEX "CustomerEmailReportPreference_enabled_idx" ON "CustomerEmailReportPreference"("enabled");
