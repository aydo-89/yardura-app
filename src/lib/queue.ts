import { Queue, Worker, JobsOptions } from "bullmq";
import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "";
const IS_BUILD_PHASE = process.env.NEXT_PHASE === "phase-production-build";

type QueueGlobals = typeof globalThis & {
  __sampleScoreRedis?: IORedis | null;
  __sampleScoreQueue?: Queue | null;
  __sampleScoreDisabledLogged?: boolean;
};

const globalForQueues = globalThis as QueueGlobals;

function shouldDisableQueues() {
  return !REDIS_URL || IS_BUILD_PHASE;
}

function logQueuesDisabledOnce() {
  if (globalForQueues.__sampleScoreDisabledLogged) return;
  globalForQueues.__sampleScoreDisabledLogged = true;
  const reason = !REDIS_URL
    ? "REDIS_URL is not configured"
    : "Next.js production build phase";
  console.warn(
    `[queue] Sample scoring queue disabled (${reason}); jobs will be skipped`,
  );
}

function getRedisConnection(): IORedis | null {
  if (shouldDisableQueues()) {
    logQueuesDisabledOnce();
    return null;
  }

  if (!globalForQueues.__sampleScoreRedis) {
    globalForQueues.__sampleScoreRedis = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null, // BullMQ requires this to be null
      enableReadyCheck: false,
      tls: REDIS_URL.startsWith("rediss://") ? {} : undefined,
      connectTimeout: 5000,
      commandTimeout: 3000,
      lazyConnect: true,
    });
  }

  return globalForQueues.__sampleScoreRedis;
}

export const SAMPLE_SCORE_QUEUE = "sample-score";

function getSampleScoreQueue(): Queue | null {
  const connection = getRedisConnection();
  if (!connection) {
    return null;
  }

  if (!globalForQueues.__sampleScoreQueue) {
    globalForQueues.__sampleScoreQueue = new Queue(SAMPLE_SCORE_QUEUE, {
      connection,
    });
  }

  return globalForQueues.__sampleScoreQueue;
}

export async function addSampleScoreJob(
  payload: { sampleId: string },
  opts?: JobsOptions,
) {
  const queue = getSampleScoreQueue();
  if (!queue) {
    return;
  }

  await queue.add("score-sample", payload, {
    attempts: 3,
    removeOnComplete: true,
    removeOnFail: 50,
    ...opts,
  });
}

export function createWorker(
  handler: (data: { sampleId: string }) => Promise<void>,
) {
  const connection = getRedisConnection();
  if (!connection) {
    throw new Error(
      "Redis connection not available; cannot start sample score worker",
    );
  }

  return new Worker(
    SAMPLE_SCORE_QUEUE,
    async (job) => {
      await handler(job.data as { sampleId: string });
    },
    { connection },
  );
}
