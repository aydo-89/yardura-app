-- CreateEnum
CREATE TYPE "public"."WellnessTier" AS ENUM ('FREE', 'PREMIUM');

-- CreateEnum
CREATE TYPE "public"."WellnessPlanStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELED');

-- CreateEnum
CREATE TYPE "public"."WellnessPlanSource" AS ENUM ('DIRECT', 'SERVICE_PROMO', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."CustomerEmailReportCadence" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "public"."WellnessReminderCategory" AS ENUM ('MEDS', 'VACCINE', 'DEWORMING', 'FLEA_TICK', 'FOOD_TRANSITION', 'VET_VISIT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "public"."WellnessDailyLevel" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "public"."FoodLogType" AS ENUM ('FOOD', 'TREAT', 'SUPPLEMENT', 'MEDICATION');

-- CreateEnum
CREATE TYPE "public"."DisciplineEventType" AS ENUM ('MISSED_VISIT', 'LATE_RELEASE', 'EARLY_RELEASE', 'JOB_RELEASE');

-- CreateEnum
CREATE TYPE "public"."DisciplineEventSource" AS ENUM ('SYSTEM', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."ScooperWithdrawalStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "roles" "public"."UserRole"[] DEFAULT ARRAY[]::"public"."UserRole"[],
ADD COLUMN     "stripeConnectAccountId" TEXT;

-- AlterTable
ALTER TABLE "public"."Dog" ADD COLUMN     "allergies" TEXT,
ADD COLUMN     "dietNotes" TEXT,
ADD COLUMN     "medications" TEXT,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "vetClinic" TEXT,
ADD COLUMN     "vetName" TEXT,
ADD COLUMN     "vetPhone" TEXT;

-- AlterTable
ALTER TABLE "public"."Customer" ADD COLUMN     "autoBlurWellnessPhotos" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "shareWellnessCaptures" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."Job" ADD COLUMN     "primaryScooperId" TEXT;

-- AlterTable
ALTER TABLE "public"."ServiceVisitMedia" ADD COLUMN     "gpsAccuracy" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "public"."WeeklyWellnessReport" ADD COLUMN     "diarrhea" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "energy" TEXT,
ADD COLUMN     "medsGiven" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "medsNotes" TEXT,
ADD COLUMN     "stoolFrequency" INTEGER,
ADD COLUMN     "vomiting" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."ScooperProfile" ADD COLUMN     "payoutAutoReleaseEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."VisitPayout" ADD COLUMN     "stripeTransferId" TEXT,
ADD COLUMN     "withdrawalRequestId" TEXT;

-- CreateTable
CREATE TABLE "public"."CustomerWellnessPlan" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "tier" "public"."WellnessTier" NOT NULL DEFAULT 'FREE',
    "status" "public"."WellnessPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" "public"."WellnessPlanSource" NOT NULL DEFAULT 'DIRECT',
    "stripeSubscriptionId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerWellnessPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerWellnessUsage" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "scansCount" INTEGER NOT NULL DEFAULT 0,
    "chatsCount" INTEGER NOT NULL DEFAULT 0,
    "foodScansCount" INTEGER NOT NULL DEFAULT 0,
    "inventoryAddsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerWellnessUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerWellnessCapture" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "dogId" TEXT,
    "suspectedDogIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scope" "public"."WellnessReportScope" NOT NULL DEFAULT 'HOUSEHOLD',
    "attribution" "public"."WellnessAttribution" NOT NULL DEFAULT 'HOUSEHOLD',
    "symptomTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "gpsLat" DOUBLE PRECISION,
    "gpsLng" DOUBLE PRECISION,
    "gpsAccuracy" DOUBLE PRECISION,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storagePath" TEXT NOT NULL,
    "consentToShare" BOOLEAN NOT NULL DEFAULT true,
    "analysisStatus" "public"."MediaAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "analysisResult" JSONB,
    "analysisModel" TEXT,
    "analysisConfidence" DOUBLE PRECISION,
    "analysisError" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerWellnessCapture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerWellnessDailyCheckIn" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "dogId" TEXT,
    "suspectedDogIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appetite" "public"."WellnessDailyLevel",
    "energy" "public"."WellnessDailyLevel",
    "waterIntake" "public"."WellnessDailyLevel",
    "stoolFrequency" INTEGER,
    "vomiting" BOOLEAN NOT NULL DEFAULT false,
    "diarrhea" BOOLEAN NOT NULL DEFAULT false,
    "medsGiven" BOOLEAN NOT NULL DEFAULT false,
    "medsNotes" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerWellnessDailyCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerWellnessReminder" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "dogId" TEXT,
    "title" TEXT NOT NULL,
    "category" "public"."WellnessReminderCategory" NOT NULL DEFAULT 'CUSTOM',
    "notes" TEXT,
    "nextDueAt" TIMESTAMP(3) NOT NULL,
    "frequencyDays" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerWellnessReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerWellnessWalk" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "dogId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "distanceMeters" DOUBLE PRECISION NOT NULL,
    "path" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerWellnessWalk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerFoodLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "dogId" TEXT,
    "productId" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "public"."FoodLogType" NOT NULL DEFAULT 'FOOD',
    "brand" TEXT,
    "productName" TEXT,
    "ingredients" TEXT,
    "portion" TEXT,
    "allergenMatches" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerFoodLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerFoodProduct" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "dogId" TEXT,
    "type" "public"."FoodLogType" NOT NULL DEFAULT 'FOOD',
    "brand" TEXT,
    "productName" TEXT,
    "ingredients" TEXT,
    "portion" TEXT,
    "notes" TEXT,
    "imagePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerFoodProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerFoodSchedule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "dogId" TEXT,
    "productId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "timesOfDay" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "timeZone" TEXT,
    "startsOn" TIMESTAMP(3),
    "endsOn" TIMESTAMP(3),
    "lastGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerFoodSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerEmailReportPreference" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "cadence" "public"."CustomerEmailReportCadence" NOT NULL DEFAULT 'WEEKLY',
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerEmailReportPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ServiceVisitSampleInsight" (
    "id" TEXT NOT NULL,
    "serviceVisitId" TEXT NOT NULL,
    "stoolSampleId" TEXT NOT NULL,
    "sourceMediaIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
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

-- CreateTable
CREATE TABLE "public"."ServiceVisitRating" (
    "id" TEXT NOT NULL,
    "serviceVisitId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "scooperId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceVisitRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WeeklyWellnessReportCapture" (
    "reportId" TEXT NOT NULL,
    "captureId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyWellnessReportCapture_pkey" PRIMARY KEY ("reportId","captureId")
);

-- CreateTable
CREATE TABLE "public"."WeeklyWellnessReportDailyCheckIn" (
    "reportId" TEXT NOT NULL,
    "checkInId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyWellnessReportDailyCheckIn_pkey" PRIMARY KEY ("reportId","checkInId")
);

-- CreateTable
CREATE TABLE "public"."DogWeightEntry" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "dogId" TEXT NOT NULL,
    "weightLbs" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DogWeightEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerWellnessChatLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "dogId" TEXT,
    "symptoms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "message" TEXT NOT NULL,
    "contextNotes" TEXT,
    "response" JSONB NOT NULL,
    "riskLevel" TEXT,
    "model" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerWellnessChatLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ScooperDisciplineEvent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "scooperId" TEXT NOT NULL,
    "type" "public"."DisciplineEventType" NOT NULL,
    "source" "public"."DisciplineEventSource" NOT NULL DEFAULT 'SYSTEM',
    "reason" TEXT,
    "serviceVisitId" TEXT,
    "jobId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScooperDisciplineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ScooperWithdrawalRequest" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "scooperId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "public"."ScooperWithdrawalStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "paidAt" TIMESTAMP(3),
    "stripeTransferId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScooperWithdrawalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerWellnessPlan_orgId_idx" ON "public"."CustomerWellnessPlan"("orgId");

-- CreateIndex
CREATE INDEX "CustomerWellnessPlan_customerId_idx" ON "public"."CustomerWellnessPlan"("customerId");

-- CreateIndex
CREATE INDEX "CustomerWellnessPlan_status_endsAt_idx" ON "public"."CustomerWellnessPlan"("status", "endsAt");

-- CreateIndex
CREATE INDEX "CustomerWellnessUsage_orgId_idx" ON "public"."CustomerWellnessUsage"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerWellnessUsage_customerId_periodKey_key" ON "public"."CustomerWellnessUsage"("customerId", "periodKey");

-- CreateIndex
CREATE INDEX "CustomerWellnessCapture_customerId_capturedAt_idx" ON "public"."CustomerWellnessCapture"("customerId", "capturedAt");

-- CreateIndex
CREATE INDEX "CustomerWellnessCapture_orgId_capturedAt_idx" ON "public"."CustomerWellnessCapture"("orgId", "capturedAt");

-- CreateIndex
CREATE INDEX "CustomerWellnessCapture_dogId_idx" ON "public"."CustomerWellnessCapture"("dogId");

-- CreateIndex
CREATE INDEX "CustomerWellnessDailyCheckIn_customerId_loggedAt_idx" ON "public"."CustomerWellnessDailyCheckIn"("customerId", "loggedAt");

-- CreateIndex
CREATE INDEX "CustomerWellnessDailyCheckIn_orgId_loggedAt_idx" ON "public"."CustomerWellnessDailyCheckIn"("orgId", "loggedAt");

-- CreateIndex
CREATE INDEX "CustomerWellnessDailyCheckIn_dogId_idx" ON "public"."CustomerWellnessDailyCheckIn"("dogId");

-- CreateIndex
CREATE INDEX "CustomerWellnessReminder_customerId_nextDueAt_idx" ON "public"."CustomerWellnessReminder"("customerId", "nextDueAt");

-- CreateIndex
CREATE INDEX "CustomerWellnessReminder_orgId_nextDueAt_idx" ON "public"."CustomerWellnessReminder"("orgId", "nextDueAt");

-- CreateIndex
CREATE INDEX "CustomerWellnessReminder_dogId_idx" ON "public"."CustomerWellnessReminder"("dogId");

-- CreateIndex
CREATE INDEX "CustomerWellnessWalk_customerId_startedAt_idx" ON "public"."CustomerWellnessWalk"("customerId", "startedAt");

-- CreateIndex
CREATE INDEX "CustomerWellnessWalk_orgId_startedAt_idx" ON "public"."CustomerWellnessWalk"("orgId", "startedAt");

-- CreateIndex
CREATE INDEX "CustomerWellnessWalk_dogId_idx" ON "public"."CustomerWellnessWalk"("dogId");

-- CreateIndex
CREATE INDEX "CustomerFoodLog_customerId_loggedAt_idx" ON "public"."CustomerFoodLog"("customerId", "loggedAt");

-- CreateIndex
CREATE INDEX "CustomerFoodLog_orgId_loggedAt_idx" ON "public"."CustomerFoodLog"("orgId", "loggedAt");

-- CreateIndex
CREATE INDEX "CustomerFoodLog_dogId_idx" ON "public"."CustomerFoodLog"("dogId");

-- CreateIndex
CREATE INDEX "CustomerFoodLog_productId_idx" ON "public"."CustomerFoodLog"("productId");

-- CreateIndex
CREATE INDEX "CustomerFoodProduct_customerId_productName_idx" ON "public"."CustomerFoodProduct"("customerId", "productName");

-- CreateIndex
CREATE INDEX "CustomerFoodProduct_orgId_productName_idx" ON "public"."CustomerFoodProduct"("orgId", "productName");

-- CreateIndex
CREATE INDEX "CustomerFoodProduct_dogId_idx" ON "public"."CustomerFoodProduct"("dogId");

-- CreateIndex
CREATE INDEX "CustomerFoodSchedule_customerId_active_idx" ON "public"."CustomerFoodSchedule"("customerId", "active");

-- CreateIndex
CREATE INDEX "CustomerFoodSchedule_orgId_active_idx" ON "public"."CustomerFoodSchedule"("orgId", "active");

-- CreateIndex
CREATE INDEX "CustomerFoodSchedule_dogId_idx" ON "public"."CustomerFoodSchedule"("dogId");

-- CreateIndex
CREATE INDEX "CustomerFoodSchedule_productId_idx" ON "public"."CustomerFoodSchedule"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerEmailReportPreference_customerId_key" ON "public"."CustomerEmailReportPreference"("customerId");

-- CreateIndex
CREATE INDEX "CustomerEmailReportPreference_orgId_idx" ON "public"."CustomerEmailReportPreference"("orgId");

-- CreateIndex
CREATE INDEX "CustomerEmailReportPreference_enabled_idx" ON "public"."CustomerEmailReportPreference"("enabled");

-- CreateIndex
CREATE INDEX "ServiceVisitSampleInsight_serviceVisitId_idx" ON "public"."ServiceVisitSampleInsight"("serviceVisitId");

-- CreateIndex
CREATE INDEX "ServiceVisitSampleInsight_stoolSampleId_idx" ON "public"."ServiceVisitSampleInsight"("stoolSampleId");

-- CreateIndex
CREATE INDEX "ServiceVisitSampleInsight_analysisStatus_idx" ON "public"."ServiceVisitSampleInsight"("analysisStatus");

-- CreateIndex
CREATE INDEX "ServiceVisitSampleInsight_wellnessFlag_idx" ON "public"."ServiceVisitSampleInsight"("wellnessFlag");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceVisitSampleInsight_serviceVisitId_stoolSampleId_key" ON "public"."ServiceVisitSampleInsight"("serviceVisitId", "stoolSampleId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceVisitRating_serviceVisitId_key" ON "public"."ServiceVisitRating"("serviceVisitId");

-- CreateIndex
CREATE INDEX "ServiceVisitRating_orgId_idx" ON "public"."ServiceVisitRating"("orgId");

-- CreateIndex
CREATE INDEX "ServiceVisitRating_customerId_idx" ON "public"."ServiceVisitRating"("customerId");

-- CreateIndex
CREATE INDEX "ServiceVisitRating_scooperId_idx" ON "public"."ServiceVisitRating"("scooperId");

-- CreateIndex
CREATE INDEX "WeeklyWellnessReportCapture_captureId_idx" ON "public"."WeeklyWellnessReportCapture"("captureId");

-- CreateIndex
CREATE INDEX "WeeklyWellnessReportDailyCheckIn_checkInId_idx" ON "public"."WeeklyWellnessReportDailyCheckIn"("checkInId");

-- CreateIndex
CREATE INDEX "DogWeightEntry_dogId_recordedAt_idx" ON "public"."DogWeightEntry"("dogId", "recordedAt");

-- CreateIndex
CREATE INDEX "DogWeightEntry_customerId_recordedAt_idx" ON "public"."DogWeightEntry"("customerId", "recordedAt");

-- CreateIndex
CREATE INDEX "DogWeightEntry_orgId_recordedAt_idx" ON "public"."DogWeightEntry"("orgId", "recordedAt");

-- CreateIndex
CREATE INDEX "CustomerWellnessChatLog_customerId_createdAt_idx" ON "public"."CustomerWellnessChatLog"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerWellnessChatLog_orgId_createdAt_idx" ON "public"."CustomerWellnessChatLog"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerWellnessChatLog_dogId_idx" ON "public"."CustomerWellnessChatLog"("dogId");

-- CreateIndex
CREATE INDEX "ScooperDisciplineEvent_scooperId_createdAt_idx" ON "public"."ScooperDisciplineEvent"("scooperId", "createdAt");

-- CreateIndex
CREATE INDEX "ScooperDisciplineEvent_orgId_createdAt_idx" ON "public"."ScooperDisciplineEvent"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "ScooperDisciplineEvent_type_createdAt_idx" ON "public"."ScooperDisciplineEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "ScooperWithdrawalRequest_orgId_idx" ON "public"."ScooperWithdrawalRequest"("orgId");

-- CreateIndex
CREATE INDEX "ScooperWithdrawalRequest_scooperId_idx" ON "public"."ScooperWithdrawalRequest"("scooperId");

-- CreateIndex
CREATE INDEX "ScooperWithdrawalRequest_status_idx" ON "public"."ScooperWithdrawalRequest"("status");

-- CreateIndex
CREATE INDEX "VisitPayout_withdrawalRequestId_idx" ON "public"."VisitPayout"("withdrawalRequestId");

-- AddForeignKey
ALTER TABLE "public"."CustomerWellnessPlan" ADD CONSTRAINT "CustomerWellnessPlan_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerWellnessPlan" ADD CONSTRAINT "CustomerWellnessPlan_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerWellnessUsage" ADD CONSTRAINT "CustomerWellnessUsage_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerWellnessUsage" ADD CONSTRAINT "CustomerWellnessUsage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerWellnessCapture" ADD CONSTRAINT "CustomerWellnessCapture_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerWellnessCapture" ADD CONSTRAINT "CustomerWellnessCapture_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerWellnessCapture" ADD CONSTRAINT "CustomerWellnessCapture_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "public"."Dog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerWellnessDailyCheckIn" ADD CONSTRAINT "CustomerWellnessDailyCheckIn_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerWellnessDailyCheckIn" ADD CONSTRAINT "CustomerWellnessDailyCheckIn_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerWellnessDailyCheckIn" ADD CONSTRAINT "CustomerWellnessDailyCheckIn_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "public"."Dog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerWellnessReminder" ADD CONSTRAINT "CustomerWellnessReminder_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerWellnessReminder" ADD CONSTRAINT "CustomerWellnessReminder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerWellnessReminder" ADD CONSTRAINT "CustomerWellnessReminder_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "public"."Dog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerWellnessWalk" ADD CONSTRAINT "CustomerWellnessWalk_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerWellnessWalk" ADD CONSTRAINT "CustomerWellnessWalk_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerWellnessWalk" ADD CONSTRAINT "CustomerWellnessWalk_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "public"."Dog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerFoodLog" ADD CONSTRAINT "CustomerFoodLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerFoodLog" ADD CONSTRAINT "CustomerFoodLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerFoodLog" ADD CONSTRAINT "CustomerFoodLog_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "public"."Dog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerFoodLog" ADD CONSTRAINT "CustomerFoodLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."CustomerFoodProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerFoodProduct" ADD CONSTRAINT "CustomerFoodProduct_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerFoodProduct" ADD CONSTRAINT "CustomerFoodProduct_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerFoodProduct" ADD CONSTRAINT "CustomerFoodProduct_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "public"."Dog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerFoodSchedule" ADD CONSTRAINT "CustomerFoodSchedule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerFoodSchedule" ADD CONSTRAINT "CustomerFoodSchedule_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerFoodSchedule" ADD CONSTRAINT "CustomerFoodSchedule_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "public"."Dog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerFoodSchedule" ADD CONSTRAINT "CustomerFoodSchedule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."CustomerFoodProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerEmailReportPreference" ADD CONSTRAINT "CustomerEmailReportPreference_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerEmailReportPreference" ADD CONSTRAINT "CustomerEmailReportPreference_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Job" ADD CONSTRAINT "Job_primaryScooperId_fkey" FOREIGN KEY ("primaryScooperId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceVisitSampleInsight" ADD CONSTRAINT "ServiceVisitSampleInsight_serviceVisitId_fkey" FOREIGN KEY ("serviceVisitId") REFERENCES "public"."ServiceVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceVisitRating" ADD CONSTRAINT "ServiceVisitRating_serviceVisitId_fkey" FOREIGN KEY ("serviceVisitId") REFERENCES "public"."ServiceVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceVisitRating" ADD CONSTRAINT "ServiceVisitRating_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceVisitRating" ADD CONSTRAINT "ServiceVisitRating_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceVisitRating" ADD CONSTRAINT "ServiceVisitRating_scooperId_fkey" FOREIGN KEY ("scooperId") REFERENCES "public"."ScooperProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WeeklyWellnessReportCapture" ADD CONSTRAINT "WeeklyWellnessReportCapture_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "public"."WeeklyWellnessReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WeeklyWellnessReportCapture" ADD CONSTRAINT "WeeklyWellnessReportCapture_captureId_fkey" FOREIGN KEY ("captureId") REFERENCES "public"."CustomerWellnessCapture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WeeklyWellnessReportDailyCheckIn" ADD CONSTRAINT "WeeklyWellnessReportDailyCheckIn_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "public"."WeeklyWellnessReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WeeklyWellnessReportDailyCheckIn" ADD CONSTRAINT "WeeklyWellnessReportDailyCheckIn_checkInId_fkey" FOREIGN KEY ("checkInId") REFERENCES "public"."CustomerWellnessDailyCheckIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DogWeightEntry" ADD CONSTRAINT "DogWeightEntry_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DogWeightEntry" ADD CONSTRAINT "DogWeightEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DogWeightEntry" ADD CONSTRAINT "DogWeightEntry_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "public"."Dog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerWellnessChatLog" ADD CONSTRAINT "CustomerWellnessChatLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerWellnessChatLog" ADD CONSTRAINT "CustomerWellnessChatLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerWellnessChatLog" ADD CONSTRAINT "CustomerWellnessChatLog_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "public"."Dog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScooperDisciplineEvent" ADD CONSTRAINT "ScooperDisciplineEvent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScooperDisciplineEvent" ADD CONSTRAINT "ScooperDisciplineEvent_scooperId_fkey" FOREIGN KEY ("scooperId") REFERENCES "public"."ScooperProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScooperDisciplineEvent" ADD CONSTRAINT "ScooperDisciplineEvent_serviceVisitId_fkey" FOREIGN KEY ("serviceVisitId") REFERENCES "public"."ServiceVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScooperDisciplineEvent" ADD CONSTRAINT "ScooperDisciplineEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "public"."Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScooperDisciplineEvent" ADD CONSTRAINT "ScooperDisciplineEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VisitPayout" ADD CONSTRAINT "VisitPayout_withdrawalRequestId_fkey" FOREIGN KEY ("withdrawalRequestId") REFERENCES "public"."ScooperWithdrawalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScooperWithdrawalRequest" ADD CONSTRAINT "ScooperWithdrawalRequest_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScooperWithdrawalRequest" ADD CONSTRAINT "ScooperWithdrawalRequest_scooperId_fkey" FOREIGN KEY ("scooperId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScooperWithdrawalRequest" ADD CONSTRAINT "ScooperWithdrawalRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

