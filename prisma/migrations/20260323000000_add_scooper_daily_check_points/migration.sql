-- Add streak-based reward tracking for scooper daily checks
ALTER TABLE "ScooperDailyCheck" ADD COLUMN "pointsAwarded" INTEGER;
ALTER TABLE "ScooperDailyCheck" ADD COLUMN "streakCount" INTEGER;
