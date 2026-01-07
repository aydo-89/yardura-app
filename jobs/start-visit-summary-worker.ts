#!/usr/bin/env tsx

import { createVisitSummaryWorker } from "@/lib/jobs/visitSummaryQueue";

async function main() {
  console.log("🚀 Starting Visit Summary Worker (queue: visit-summary)");
  console.log(`   REDIS_URL: ${process.env.REDIS_URL ? "✓ set" : "✗ missing"}`);

  const worker = createVisitSummaryWorker();

  // Log when jobs are picked up
  worker.on("active", (job) => {
    console.log(`🔄 Processing visit summary job ${job.id} (visit: ${job.data?.visitId})`);
  });

  worker.on("completed", (job, result) => {
    console.log(`✅ Visit summary job ${job.id} completed`);
    console.log(`   Result: ${result?.success ? "success" : "failed"}, observations: ${result?.observations?.length ?? 0} chars`);
  });

  worker.on("failed", (job, error) => {
    console.error(`❌ Visit summary job ${job?.id} failed:`, error?.message ?? error);
  });

  worker.on("stalled", (jobId) => {
    console.warn(`⚠️ Visit summary job ${jobId} stalled - will be retried`);
  });

  // Health check ping every 30 seconds
  const healthInterval = setInterval(() => {
    if (worker.isRunning()) {
      console.log(`💚 Worker healthy at ${new Date().toISOString()}`);
    } else {
      console.warn(`⚠️ Worker not running at ${new Date().toISOString()}`);
    }
  }, 30_000);

  const shutdown = async () => {
    console.log("\n🛑 Shutting down visit summary worker...");
    clearInterval(healthInterval);
    await worker.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Log that the worker is ready
  console.log("👂 Worker is now listening for jobs...");
}

main().catch((error) => {
  console.error("Failed to start visit summary worker", error);
  process.exit(1);
});
