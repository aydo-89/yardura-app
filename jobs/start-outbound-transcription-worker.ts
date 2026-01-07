#!/usr/bin/env tsx

import { createOutboundTranscriptionWorker } from "@/lib/jobs/outboundTranscriptionQueue";

async function main() {
  console.log("🚀 Starting Outbound Transcription Worker (queue: outbound-transcription)");

  const worker = createOutboundTranscriptionWorker();

  worker.on("completed", (job) => {
    console.log(`✅ Outbound transcription job ${job.id} completed`);
  });

  worker.on("failed", (job, error) => {
    console.error(`❌ Outbound transcription job ${job?.id} failed`, error);
  });

  const shutdown = async () => {
    console.log("\n🛑 Shutting down outbound transcription worker...");
    await worker.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("Failed to start outbound transcription worker", error);
  process.exit(1);
});
