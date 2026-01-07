import { Queue, Worker, JobsOptions, QueueEvents } from "bullmq";
import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "";
const IS_BUILD_PHASE = process.env.NEXT_PHASE === "phase-production-build";

type QueueGlobals = typeof globalThis & {
  __tileGenRedis?: IORedis | null;
  __tileGenQueue?: Queue | null;
  __tileGenQueueEvents?: QueueEvents | null;
  __tileGenDisabledLogged?: boolean;
};

const globalForQueues = globalThis as QueueGlobals;

function shouldDisableQueues() {
  return !REDIS_URL || IS_BUILD_PHASE;
}

function logQueuesDisabledOnce() {
  if (globalForQueues.__tileGenDisabledLogged) return;
  globalForQueues.__tileGenDisabledLogged = true;
  const reason = !REDIS_URL
    ? "REDIS_URL is not configured"
    : "Next.js production build phase";
  console.warn(
    `[queue] Tile generation queue disabled (${reason}); jobs will run synchronously`,
  );
}

function getRedisConnection(): IORedis | null {
  if (shouldDisableQueues()) {
    logQueuesDisabledOnce();
    return null;
  }

  if (!globalForQueues.__tileGenRedis) {
    globalForQueues.__tileGenRedis = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null, // BullMQ requires this to be null
      enableReadyCheck: false,
      tls: REDIS_URL.startsWith("rediss://") ? { rejectUnauthorized: false } : undefined,
      connectTimeout: 10000, // Increased for remote Redis
      commandTimeout: 10000, // Increased for remote Redis
      retryStrategy: (times) => {
        if (times > 3) {
          console.error("[TileGenQueue] Max retries reached, giving up");
          return null;
        }
        const delay = Math.min(times * 1000, 3000);
        console.log(`[TileGenQueue] Retry attempt ${times}, waiting ${delay}ms`);
        return delay;
      },
    });
  }

  return globalForQueues.__tileGenRedis;
}

export const TILE_GENERATION_QUEUE = "tile-generation";

function getTileGenerationQueue(): Queue | null {
  const connection = getRedisConnection();
  if (!connection) {
    return null;
  }

  if (!globalForQueues.__tileGenQueue) {
    globalForQueues.__tileGenQueue = new Queue(TILE_GENERATION_QUEUE, {
      connection,
    });
  }

  return globalForQueues.__tileGenQueue;
}

function getTileGenerationQueueEvents(): QueueEvents | null {
  const connection = getRedisConnection();
  if (!connection) return null;

  if (!globalForQueues.__tileGenQueueEvents) {
    globalForQueues.__tileGenQueueEvents = new QueueEvents(TILE_GENERATION_QUEUE, {
      connection,
    });
    globalForQueues.__tileGenQueueEvents.on("error", (error) => {
      console.error("[tileGenQueue] QueueEvents error", error);
    });
  }

  return globalForQueues.__tileGenQueueEvents;
}

export interface TileGenerationJobData {
  jobId: string;
  placeId: string;
  tileCount: number;
  strategy?: "kmeans";
  status?: string;
  generationMode: "cluster" | "perZip";
  orgId: string;
  createdBy: string;
  city?: string;
  state?: string;
}

export interface TileGenerationJobStatus {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  tilesGenerated?: number;
  error?: string;
  result?: any;
  createdAt: number;
  completedAt?: number;
}

export async function addTileGenerationJob(
  payload: TileGenerationJobData,
  opts?: JobsOptions,
): Promise<string | null> {
  const queue = getTileGenerationQueue();
  if (!queue) {
    console.warn("[tileGenQueue] Queue not available, job will run synchronously");
    return null;
  }

  const job = await queue.add("generate-tiles", payload, {
    attempts: 2,
    removeOnComplete: { count: 100 }, // Keep last 100 completed jobs
    removeOnFail: { count: 50 }, // Keep last 50 failed jobs
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    ...opts,
  });

  return job.id ?? null;
}

export async function getTileGenerationJobStatus(
  jobId: string,
): Promise<TileGenerationJobStatus | null> {
  const queue = getTileGenerationQueue();
  if (!queue) {
    return null;
  }

  const job = await queue.getJob(jobId);
  if (!job) {
    return null;
  }

  const state = await job.getState();
  const progress = job.progress as number | undefined;

  let status: TileGenerationJobStatus["status"] = "pending";
  if (state === "active") status = "processing";
  else if (state === "completed") status = "completed";
  else if (state === "failed") status = "failed";

  return {
    jobId,
    status,
    progress,
    tilesGenerated: job.returnvalue?.tiles?.length,
    error: job.failedReason,
    result: job.returnvalue,
    createdAt: job.timestamp,
    completedAt: job.finishedOn,
  };
}

export async function waitForTileGenerationJob(jobId: string) {
  const queue = getTileGenerationQueue();
  const events = getTileGenerationQueueEvents();
  if (!queue || !events) {
    return null;
  }

  const job = await queue.getJob(jobId);
  if (!job) return null;

  return job.waitUntilFinished(events);
}

export function createTileGenerationWorker(
  handler: (data: TileGenerationJobData) => Promise<any>,
) {
  const connection = getRedisConnection();
  if (!connection) {
    throw new Error(
      "Redis connection not available; cannot start tile generation worker",
    );
  }

  return new Worker(
    TILE_GENERATION_QUEUE,
    async (job) => {
      console.log(`[TileGenWorker] Processing job ${job.id} for place ${job.data.placeId}`);
      
      try {
        const result = await handler(job.data as TileGenerationJobData);
        console.log(`[TileGenWorker] Job ${job.id} completed successfully. Generated ${result.tiles?.length || 0} tiles`);
        return result;
      } catch (error) {
        console.error(`[TileGenWorker] Job ${job.id} failed:`, error);
        throw error;
      }
    },
    {
      connection,
      concurrency: 2, // Process up to 2 tile generation jobs concurrently
    },
  );
}
