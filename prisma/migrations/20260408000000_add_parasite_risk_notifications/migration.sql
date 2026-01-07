-- Add customer-level parasite risk push preference + last send tracking.
ALTER TABLE "Customer" ADD COLUMN "parasiteRiskNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Customer" ADD COLUMN "parasiteRiskLastNotifiedAt" TIMESTAMP(3);
