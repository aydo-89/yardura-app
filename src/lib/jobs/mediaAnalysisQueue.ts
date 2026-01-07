import { Queue, Worker, QueueEvents, JobsOptions } from "bullmq";
import IORedis from "ioredis";

import { runMediaAnalysis } from "@/lib/service-visits/media-analysis-core";

const REDIS_URL = process.env.REDIS_URL ?? "";
const IS_BUILD_PHASE = process.env.NEXT_PHASE === "phase-production-build";

type QueueGlobals = typeof globalThis & {
  __mediaAnalysisRedis?: IORedis | null;
  __mediaAnalysisQueue?: Queue | null;
  __mediaAnalysisEvents?: QueueEvents | null;
  __mediaAnalysisDisabledLogged?: boolean;
};

const globals = globalThis as QueueGlobals;

function shouldDisableQueue() {
  return !REDIS_URL || IS_BUILD_PHASE;
}

function logDisabled() {
  if (globals.__mediaAnalysisDisabledLogged) return;
  globals.__mediaAnalysisDisabledLogged = true;
  const reason = !REDIS_URL ? "REDIS_URL missing" : "Next.js build phase";
  console.warn(`[queue] Media analysis queue disabled (${reason})`);
}

function createRedisConnection(options?: { lazy?: boolean }): IORedis {
  return new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    tls: REDIS_URL.startsWith("rediss://") ? {} : undefined,
    connectTimeout: 10_000,
    lazyConnect: options?.lazy ?? false,
    retryStrategy: (times) => Math.min(times * 1000, 30_000),
    reconnectOnError: (err) => {
      const targetErrors = ["READONLY", "ECONNRESET", "ETIMEDOUT", "ECONNREFUSED"];
      return targetErrors.some((e) => err.message.includes(e));
    },
  });
}

function getRedis(): IORedis | null {
  if (shouldDisableQueue()) {
    logDisabled();
    return null;
  }

  if (!globals.__mediaAnalysisRedis) {
    globals.__mediaAnalysisRedis = createRedisConnection({ lazy: true });
  }

  return globals.__mediaAnalysisRedis;
}

export const MEDIA_ANALYSIS_QUEUE = "visit-media-analysis";

type MediaAnalysisJobData = {
  mediaId: string;
  force?: boolean;
};

function getQueue(): Queue | null {
  const connection = getRedis();
  if (!connection) return null;

  if (!globals.__mediaAnalysisQueue) {
    globals.__mediaAnalysisQueue = new Queue(MEDIA_ANALYSIS_QUEUE, {
      connection,
    });
  }

  return globals.__mediaAnalysisQueue;
}

function getQueueEvents(): QueueEvents | null {
  const connection = getRedis();
  if (!connection) return null;

  if (!globals.__mediaAnalysisEvents) {
    globals.__mediaAnalysisEvents = new QueueEvents(MEDIA_ANALYSIS_QUEUE, {
      connection,
    });
    globals.__mediaAnalysisEvents.on("error", (error) => {
      const message = error?.message ?? "";
      const isTimeoutError = message.includes("timed out") || message.includes("ETIMEDOUT");
      if (!isTimeoutError) {
        console.error("[mediaAnalysisQueue] events error", error);
      }
    });
  }

  return globals.__mediaAnalysisEvents;
}

export async function addMediaAnalysisJob(
  payload: MediaAnalysisJobData,
  options?: JobsOptions,
): Promise<string | null> {
  const queue = getQueue();
  if (!queue) return null;

  const job = await queue.add("analyze", payload, {
    attempts: 2,
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 50 },
    ...options,
  });

  return job.id ?? null;
}

export async function waitForMediaAnalysisJob(jobId: string) {
  const queue = getQueue();
  const events = getQueueEvents();
  if (!queue || !events) return null;

  const job = await queue.getJob(jobId);
  if (!job) return null;

  return job.waitUntilFinished(events);
}

export function createMediaAnalysisWorker() {
  if (shouldDisableQueue()) {
    throw new Error("Redis not available for media analysis worker");
  }

  const workerConnection = createRedisConnection({ lazy: false });
  const worker = new Worker(
    MEDIA_ANALYSIS_QUEUE,
    async (job) => {
      const data = job.data as MediaAnalysisJobData;
      await runMediaAnalysis(data.mediaId, Boolean(data.force));
    },
    {
      connection: workerConnection,
      concurrency: 2,
    },
  );

  worker.on("error", (error) => {
    const message = error?.message ?? "";
    const isTimeoutError = message.includes("timed out") || message.includes("ETIMEDOUT");
    if (!isTimeoutError) {
      console.error("[MediaAnalysisWorker] worker error", error);
    }
  });

  return worker;
}
