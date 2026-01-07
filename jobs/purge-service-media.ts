import {
  purgeExpiredDailyChecks,
  purgeExpiredServiceVisitMedia,
} from "@/lib/jobs/serviceVisitMediaRetention";

(async () => {
  console.log("[media-retention] Starting purge job...");
  const [mediaResult, dailyCheckResult] = await Promise.all([
    purgeExpiredServiceVisitMedia(),
    purgeExpiredDailyChecks(),
  ]);
  console.log("[media-retention] Media purged", mediaResult);
  console.log("[media-retention] Daily checks purged", dailyCheckResult);
  process.exit(0);
})();
