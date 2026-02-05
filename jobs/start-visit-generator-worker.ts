import {
  scheduleRecurringVisitGeneration,
  startVisitGenerationWorker,
} from "@/lib/jobs/serviceVisitGenerator";

console.log("Visit generation worker is starting...");

startVisitGenerationWorker();

scheduleRecurringVisitGeneration()
  .then(() => {
    console.log("Recurring visit generation scheduled.");
  })
  .catch((error) => {
    console.error("Failed to schedule visit generation", error);
  });

console.log("Visit generation worker is running. Press Ctrl+C to exit.");
