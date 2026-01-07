import { Queue, Worker, QueueEvents, JobsOptions } from "bullmq";
import IORedis from "ioredis";

import {
  transcribeAndAnalyzeOutbound,
  OutboundTranscriptionResult,
} from "@/lib/outbound/transcription";

const REDIS_URL = process.env.REDIS_URL ?? "";
const IS_BUILD_PHASE = process.env.NEXT_PHASE === "phase-production-build";

type QueueGlobals = typeof globalThis & {
  __outboundRedis?: IORedis | null;
  __outboundQueue?: Queue | null;
  __outboundEvents?: QueueEvents | null;
  __outboundDisabledLogged?: boolean;
};

const globals = globalThis as QueueGlobals;

function shouldDisableQueue() {
  return !REDIS_URL || IS_BUILD_PHASE;
}

function markDisabledOnce() {
  if (globals.__outboundDisabledLogged) return;
  globals.__outboundDisabledLogged = true;
  const reason = !REDIS_URL
    ? "REDIS_URL missing"
    : "Next.js build phase";
  console.warn(`[queue] Outbound transcription queue disabled (${reason})`);
}

function getRedis(): IORedis | null {
  if (shouldDisableQueue()) {
    markDisabledOnce();
    return null;
  }

  if (!globals.__outboundRedis) {
    globals.__outboundRedis = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      tls: REDIS_URL.startsWith("rediss://") ? {} : undefined,
      connectTimeout: 5_000,
      commandTimeout: 3_000,
      lazyConnect: true,
    });
  }

  return globals.__outboundRedis;
}

export const OUTBOUND_TRANSCRIPTION_QUEUE = "outbound-transcription";

type OutboundQueueJobData = {
  jobId: string;
  audioBase64: string;
  filename: string;
  businessId?: string | null;
};

export interface OutboundTranscriptionJobStatus {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  error?: string;
  result?: OutboundTranscriptionResult | null;
  createdAt: number;
  completedAt?: number;
}

function getQueue(): Queue | null {
  const connection = getRedis();
  if (!connection) return null;

  if (!globals.__outboundQueue) {
    globals.__outboundQueue = new Queue(OUTBOUND_TRANSCRIPTION_QUEUE, {
      connection,
    });
  }

  return globals.__outboundQueue;
}

function getQueueEvents(): QueueEvents | null {
  const connection = getRedis();
  if (!connection) return null;

  if (!globals.__outboundEvents) {
    globals.__outboundEvents = new QueueEvents(OUTBOUND_TRANSCRIPTION_QUEUE, {
      connection,
    });
    globals.__outboundEvents.on("error", (error) => {
      console.error("[outboundTranscriptionQueue] events error", error);
    });
  }

  return globals.__outboundEvents;
}

export async function addOutboundTranscriptionJob(
  payload: OutboundQueueJobData,
  options?: JobsOptions,
): Promise<string | null> {
  const queue = getQueue();
  if (!queue) return null;

  const job = await queue.add("transcribe", payload, {
    attempts: 1,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 20 },
    ...options,
  });

  return job.id ?? null;
}

export async function waitForOutboundTranscriptionJob(jobId: string) {
  const queue = getQueue();
  const events = getQueueEvents();
  if (!queue || !events) return null;

  const job = await queue.getJob(jobId);
  if (!job) return null;

  return job.waitUntilFinished(events);
}

export async function getOutboundTranscriptionJobStatus(
  jobId: string,
): Promise<OutboundTranscriptionJobStatus | null> {
  const queue = getQueue();
  if (!queue) return null;

  const job = await queue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  let status: OutboundTranscriptionJobStatus["status"] = "pending";

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

  return {
    jobId,
    status,
    progress,
    error: job.failedReason ?? undefined,
    result: (job.returnvalue as OutboundTranscriptionResult | undefined) ?? null,
    createdAt: job.timestamp,
    completedAt: job.finishedOn ?? undefined,
  } satisfies OutboundTranscriptionJobStatus;
}

export function createOutboundTranscriptionWorker() {
  const connection = getRedis();
  if (!connection) {
    throw new Error("Redis not available for outbound transcription worker");
  }

  const worker = new Worker(
    OUTBOUND_TRANSCRIPTION_QUEUE,
    async (job) => {
      const data = job.data as OutboundQueueJobData;
      const buffer = Buffer.from(data.audioBase64, "base64");
      const result = await transcribeAndAnalyzeOutbound({
        audioBuffer: buffer,
        filename: data.filename,
        businessId: data.businessId,
      });
      return result satisfies OutboundTranscriptionResult;
    },
    {
      connection,
      concurrency: 1,
    },
  );

  worker.on("error", (error) => {
    console.error("[OutboundTranscriptionWorker] worker error", error);
  });

  return worker;
}
