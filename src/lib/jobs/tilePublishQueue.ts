import { Queue, Worker, QueueEvents, JobsOptions } from "bullmq";
import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "";
const IS_BUILD_PHASE = process.env.NEXT_PHASE === "phase-production-build";

type QueueGlobals = typeof globalThis & {
  __tilePublishRedis?: IORedis | null;
  __tilePublishQueue?: Queue | null;
  __tilePublishEvents?: QueueEvents | null;
  __tilePublishDisabledLogged?: boolean;
};

const globalQueues = globalThis as QueueGlobals;

function shouldDisableQueue() {
  return !REDIS_URL || IS_BUILD_PHASE;
}

function logQueueDisabledOnce() {
  if (globalQueues.__tilePublishDisabledLogged) return;
  globalQueues.__tilePublishDisabledLogged = true;
  const reason = !REDIS_URL
    ? "REDIS_URL is not configured"
    : "Next.js build phase";
  console.warn(`[queue] Tile publish queue disabled (${reason}); falling back to synchronous processing`);
}

function getRedis(): IORedis | null {
  if (shouldDisableQueue()) {
    logQueueDisabledOnce();
    return null;
  }

  if (!globalQueues.__tilePublishRedis) {
    globalQueues.__tilePublishRedis = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      tls: REDIS_URL.startsWith("rediss://") ? {} : undefined,
      connectTimeout: 5_000,
      commandTimeout: 3_000,
      lazyConnect: true,
    });
  }

  return globalQueues.__tilePublishRedis;
}

export const TILE_PUBLISH_QUEUE = "tile-publish";

function getQueue(): Queue | null {
  const connection = getRedis();
  if (!connection) return null;

  if (!globalQueues.__tilePublishQueue) {
    globalQueues.__tilePublishQueue = new Queue(TILE_PUBLISH_QUEUE, { connection });
  }

  return globalQueues.__tilePublishQueue;
}

function getQueueEvents(): QueueEvents | null {
  const connection = getRedis();
  if (!connection) return null;

  if (!globalQueues.__tilePublishEvents) {
    globalQueues.__tilePublishEvents = new QueueEvents(TILE_PUBLISH_QUEUE, {
      connection,
    });
    globalQueues.__tilePublishEvents.on("error", (error) => {
      console.error("[tilePublishQueue] QueueEvents error", error);
    });
  }

  return globalQueues.__tilePublishEvents;
}

export interface TilePublishJobData {
  jobId: string;
  tileId: string;
  slug: string;
  orgId: string;
  status: string;
  goLiveDate?: string | null;
  addedBy?: string | null;
  mode?: "sync" | "refresh";
}

export interface TilePublishJobStatus {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  error?: string;
  result?: any;
  createdAt: number;
  completedAt?: number;
  tileId?: string;
  slug?: string;
  orgId?: string;
  mode?: "sync" | "refresh";
}

export async function addTilePublishJob(
  payload: TilePublishJobData,
  options?: JobsOptions,
): Promise<string | null> {
  const queue = getQueue();
  if (!queue) return null;

  const job = await queue.add("publish-tile", payload, {
    attempts: 2,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
    ...options,
  });

  return job.id ?? null;
}

export async function waitForTilePublishJob(jobId: string) {
  const queue = getQueue();
  const events = getQueueEvents();
  if (!queue || !events) return null;

  const job = await queue.getJob(jobId);
  if (!job) return null;

  return job.waitUntilFinished(events);
}

export async function getTilePublishJobStatus(
  jobId: string,
): Promise<TilePublishJobStatus | null> {
  const queue = getQueue();
  if (!queue) return null;

  const job = await queue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  let status: TilePublishJobStatus["status"] = "pending";

  if (state === "active") {
    status = "processing";
  } else if (state === "completed") {
    status = "completed";
  } else if (state === "failed") {
    status = "failed";
  }

  const progress =
    typeof job.progress === "number"
      ? (job.progress as number)
      : undefined;

  const data = job.data as TilePublishJobData | undefined;

  return {
    jobId,
    status,
    progress,
    error: job.failedReason ?? undefined,
    result: job.returnvalue,
    createdAt: job.timestamp,
    completedAt: job.finishedOn ?? undefined,
    tileId: data?.tileId,
    slug: data?.slug,
    orgId: data?.orgId,
    mode: data?.mode,
  } satisfies TilePublishJobStatus;
}

export function createTilePublishWorker(
  handler: (data: TilePublishJobData) => Promise<any>,
) {
  const connection = getRedis();
  if (!connection) {
    throw new Error("Redis connection not available for tile publish worker");
  }

  const worker = new Worker(
    TILE_PUBLISH_QUEUE,
    async (job) => {
      console.log(`[TilePublishWorker] Processing job ${job.id} (tile ${job.data.slug})`);
      try {
        const result = await handler(job.data as TilePublishJobData);
        console.log(`[TilePublishWorker] Job ${job.id} succeeded`);
        return result;
      } catch (error) {
        console.error(`[TilePublishWorker] Job ${job.id} failed`, error);
        throw error;
      }
    },
    {
      connection,
      concurrency: 2,
    },
  );

  worker.on("error", (error) => {
    console.error("[TilePublishWorker] worker error", error);
  });

  return worker;
}
