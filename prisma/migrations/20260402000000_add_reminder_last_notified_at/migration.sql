-- Track last reminder notification to avoid duplicate pushes.
ALTER TABLE "CustomerWellnessReminder" ADD COLUMN "lastNotifiedAt" TIMESTAMP(3);
