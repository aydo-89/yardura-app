#!/usr/bin/env tsx

import { createMediaAnalysisWorker } from "@/lib/jobs/mediaAnalysisQueue";

async function main() {
  console.log("Starting Media Analysis Worker (queue: visit-media-analysis)");
  console.log(`REDIS_URL: ${process.env.REDIS_URL ? "set" : "missing"}`);

  const worker = createMediaAnalysisWorker();

  worker.on("active", (job) => {
    console.log(`Processing media analysis job ${job.id} (media: ${job.data?.mediaId})`);
  });

  worker.on("completed", (job) => {
    console.log(`Media analysis job ${job.id} completed`);
  });

  worker.on("failed", (job, error) => {
    console.error(`Media analysis job ${job?.id} failed:`, error?.message ?? error);
  });

  worker.on("stalled", (jobId) => {
    console.warn(`Media analysis job ${jobId} stalled - will be retried`);
  });

  const healthInterval = setInterval(() => {
    if (worker.isRunning()) {
      console.log(`Worker healthy at ${new Date().toISOString()}`);
    } else {
      console.warn(`Worker not running at ${new Date().toISOString()}`);
    }
  }, 30_000);

  const shutdown = async () => {
    console.log("\nShutting down media analysis worker...");
    clearInterval(healthInterval);
    await worker.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log("Worker is now listening for jobs...");
}

main().catch((error) => {
  console.error("Failed to start media analysis worker", error);
  process.exit(1);
});
