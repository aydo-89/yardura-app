#!/usr/bin/env tsx
/**
 * Tile Generation Background Worker
 * 
 * This worker processes tile generation jobs from the queue.
 * Run with: npm run jobs:tiles or tsx -r dotenv/config jobs/start-tile-generation-worker.ts
 */

import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";

// Load .env.local first (if it exists), then .env
// This allows local overrides to take precedence
// IMPORTANT: Use override: true to ensure .env.local overrides .env
const envLocalPath = resolve(process.cwd(), ".env.local");
if (existsSync(envLocalPath)) {
  config({ path: envLocalPath, override: true });
  console.log("📝 Loaded environment from .env.local (with override)");
}
config(); // Load .env as fallback

import { createTileGenerationWorker, TileGenerationJobData } from "@/lib/jobs/tileGenerationQueue";
import { generateTilesForPlace } from "@/lib/tiles/generator";

async function processTileGeneration(data: TileGenerationJobData) {
  console.log(`\n🗺️  Starting tile generation for ${data.city || 'unknown'}, ${data.state || 'unknown'}`);
  console.log(`   Place ID: ${data.placeId}`);
  console.log(`   Tile Count: ${data.tileCount}`);
  console.log(`   Mode: ${data.generationMode}`);

  const result = await generateTilesForPlace({
    placeId: data.placeId,
    tileCount: data.tileCount,
    strategy: data.strategy,
    status: data.status,
    generationMode: data.generationMode,
    orgId: data.orgId,
    createdBy: data.createdBy,
  });

  console.log(`✅ Generated ${result.tiles.length} tiles`);
  
  return result;
}

async function main() {
  console.log("🚀 Starting Tile Generation Worker...");
  console.log("   Queue: tile-generation");
  console.log("   Concurrency: 2 jobs");
  console.log(`   PostGIS: ${process.env.POSTGIS_HOST}:${process.env.POSTGIS_PORT}/${process.env.POSTGIS_DB}`);
  console.log("");

  const worker = createTileGenerationWorker(processTileGeneration);

  worker.on("completed", (job) => {
    console.log(`✅ Job ${job.id} completed`);
  });

  worker.on("failed", (job, error) => {
    console.error(`❌ Job ${job?.id} failed:`, error.message);
  });

  worker.on("error", (error) => {
    console.error("Worker error:", error);
  });

  console.log("✅ Tile Generation Worker started and listening for jobs...");
  console.log("   Press Ctrl+C to stop");

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n🛑 Shutting down worker...");
    await worker.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("\n🛑 Shutting down worker...");
    await worker.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Fatal error starting tile generation worker:", error);
  process.exit(1);
});

