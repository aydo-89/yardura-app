#!/usr/bin/env tsx
/**
 * Tile Publish Background Worker
 *
 * Applies heavy ZIP synchronization for published tiles without blocking API requests.
 */

import { createTilePublishWorker, TilePublishJobData } from "@/lib/jobs/tilePublishQueue";
import { refreshTileZipCoverage, syncTileZips } from "@/lib/tiles/generator";
import { getServiceArea } from "@/lib/tiles/service-areas";

async function processPublishJob(data: TilePublishJobData) {
  console.log(`\n📦 Publishing tile ${data.slug} (${data.tileId})`);

  const mode = data.mode ?? "sync";

  if (mode === "refresh") {
    await refreshTileZipCoverage(data.tileId);
  } else {
    await syncTileZips(data.tileId, {
      status: data.status,
      addedBy: data.addedBy ?? "tile-publish",
    });
  }

  const summary = await getServiceArea(data.orgId, data.slug);
  return {
    summary,
  };
}

async function main() {
  console.log("🚀 Starting Tile Publish Worker (queue: tile-publish)");

  const worker = createTilePublishWorker(processPublishJob);

  worker.on("completed", (job) => {
    console.log(`✅ Publish job ${job.id} completed`);
  });

  worker.on("failed", (job, error) => {
    console.error(`❌ Publish job ${job?.id} failed`, error);
  });

  process.on("SIGINT", async () => {
    console.log("\n🛑 Shutting down tile publish worker...");
    await worker.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("\n🛑 Shutting down tile publish worker...");
    await worker.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Failed to start tile publish worker", error);
  process.exit(1);
});
