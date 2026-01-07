import { Queue, Worker, QueueEvents, JobsOptions } from "bullmq";
import IORedis from "ioredis";

import { generateVisitSummary, VisitSummaryResult } from "@/lib/field-tech/visitSummary";

const REDIS_URL = process.env.REDIS_URL ?? "";
const IS_BUILD_PHASE = process.env.NEXT_PHASE === "phase-production-build";

type QueueGlobals = typeof globalThis & {
  __visitSummaryRedis?: IORedis | null;
  __visitSummaryQueue?: Queue | null;
  __visitSummaryEvents?: QueueEvents | null;
  __visitSummaryDisabledLogged?: boolean;
};

const globals = globalThis as QueueGlobals;

function shouldDisableQueue() {
  return !REDIS_URL || IS_BUILD_PHASE;
}

function logDisabled() {
  if (globals.__visitSummaryDisabledLogged) return;
  globals.__visitSummaryDisabledLogged = true;
  const reason = !REDIS_URL
    ? "REDIS_URL missing"
    : "Next.js build phase";
  console.warn(`[queue] Visit summary queue disabled (${reason})`);
}

function createRedisConnection(options?: { lazy?: boolean }): IORedis {
  return new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    tls: REDIS_URL.startsWith("rediss://") ? {} : undefined,
    connectTimeout: 10_000,
    // Don't set commandTimeout - BullMQ uses blocking commands that need to wait indefinitely
    lazyConnect: options?.lazy ?? false, // Workers need immediate connection, queues can be lazy
    retryStrategy: (times) => {
      // Reconnect after increasing delays, max 30 seconds
      const delay = Math.min(times * 1000, 30_000);
      console.log(`[Redis] Reconnecting in ${delay}ms (attempt ${times})`);
      return delay;
    },
    reconnectOnError: (err) => {
      // Reconnect on connection-related errors
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

  if (!globals.__visitSummaryRedis) {
    // Use lazy connection for queue/events (only connects when needed in API routes)
    globals.__visitSummaryRedis = createRedisConnection({ lazy: true });
  }

  return globals.__visitSummaryRedis;
}

export const VISIT_SUMMARY_QUEUE = "visit-summary";

type VisitSummaryJobData = {
  jobId: string;
  visitId: string;
  userId: string;
};

export interface VisitSummaryJobStatus {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  error?: string;
  result?: VisitSummaryResult | null;
  createdAt: number;
  completedAt?: number;
  visitId?: string;
  requestedBy?: string;
}

function getQueue(): Queue | null {
  const connection = getRedis();
  if (!connection) return null;

  if (!globals.__visitSummaryQueue) {
    globals.__visitSummaryQueue = new Queue(VISIT_SUMMARY_QUEUE, {
      connection,
    });
  }

  return globals.__visitSummaryQueue;
}

function getQueueEvents(): QueueEvents | null {
  const connection = getRedis();
  if (!connection) return null;

  if (!globals.__visitSummaryEvents) {
    globals.__visitSummaryEvents = new QueueEvents(VISIT_SUMMARY_QUEUE, {
      connection,
    });
    // Only log non-timeout errors (timeouts are expected during idle periods)
    globals.__visitSummaryEvents.on("error", (error) => {
      const message = error?.message ?? "";
      const isTimeoutError = message.includes("timed out") || message.includes("ETIMEDOUT");
      if (!isTimeoutError) {
        console.error("[visitSummaryQueue] events error", error);
      }
    });
  }

  return globals.__visitSummaryEvents;
}

export async function addVisitSummaryJob(
  payload: VisitSummaryJobData,
  options?: JobsOptions,
): Promise<string | null> {
  const queue = getQueue();
  if (!queue) return null;

  const job = await queue.add("summarize", payload, {
    attempts: 1,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 20 },
    ...options,
  });

  return job.id ?? null;
}

export async function waitForVisitSummaryJob(jobId: string) {
  const queue = getQueue();
  const events = getQueueEvents();
  if (!queue || !events) return null;

  const job = await queue.getJob(jobId);
  if (!job) return null;

  return job.waitUntilFinished(events);
}

export async function getVisitSummaryJobStatus(
  jobId: string,
): Promise<VisitSummaryJobStatus | null> {
  const queue = getQueue();
  if (!queue) return null;

  const job = await queue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  let status: VisitSummaryJobStatus["status"] = "pending";

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

  const data = job.data as VisitSummaryJobData | undefined;

  return {
    jobId,
    status,
    progress,
    error: job.failedReason ?? undefined,
    result: (job.returnvalue as VisitSummaryResult | undefined) ?? null,
    createdAt: job.timestamp,
    completedAt: job.finishedOn ?? undefined,
    visitId: data?.visitId,
    requestedBy: data?.userId,
  } satisfies VisitSummaryJobStatus;
}

export function createVisitSummaryWorker() {
  if (shouldDisableQueue()) {
    throw new Error("Redis not available for visit summary worker");
  }

  // BullMQ recommends using separate connections for workers
  // Worker connection must NOT be lazy - needs to listen immediately
  const workerConnection = createRedisConnection({ lazy: false });

  const worker = new Worker(
    VISIT_SUMMARY_QUEUE,
    async (job) => {
      const data = job.data as VisitSummaryJobData;
      const result = await generateVisitSummary(data.visitId, data.userId);
      return result satisfies VisitSummaryResult;
    },
    {
      connection: workerConnection,
      concurrency: 1,
    },
  );

  // Only log non-timeout errors (timeouts are expected during idle periods with managed Redis)
  worker.on("error", (error) => {
    const message = error?.message ?? "";
    const isTimeoutError = message.includes("timed out") || message.includes("ETIMEDOUT");
    if (!isTimeoutError) {
      console.error("[VisitSummaryWorker] worker error", error);
    }
  });

  return worker;
}
