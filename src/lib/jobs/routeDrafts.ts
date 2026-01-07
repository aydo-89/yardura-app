import { Queue, Worker, Job, JobsOptions } from "bullmq";

import { generateRouteDrafts } from "@/lib/dispatch/draft-generator";

import {
  getRedisConnectionConfig,
  queueUnavailableReason,
  shouldAutoStartWorkers,
} from "./shared";

export interface RouteDraftJobData {
  orgId: string;
  date?: string;
  lookAheadDays?: number;
  autopromote?: boolean;
}

const QUEUE_NAME = "dispatch-route-drafts";

type RouteDraftState = {
  queue?: Queue<RouteDraftJobData>;
  worker?: Worker<RouteDraftJobData> | null;
  disabledLogged?: boolean;
};

const globalState = globalThis as typeof globalThis & {
  __routeDraftState?: RouteDraftState;
};

if (!globalState.__routeDraftState) {
  globalState.__routeDraftState = {};
}

const state = globalState.__routeDraftState;

function logDisabledOnce(reason: string) {
  if (state.disabledLogged) return;
  state.disabledLogged = true;
  console.warn(
    `[jobs] ${QUEUE_NAME} queue disabled (${reason}); requests will be ignored`,
  );
}

function getQueueInstance(): Queue<RouteDraftJobData> | null {
  const disabledReason = queueUnavailableReason();
  if (disabledReason) {
    logDisabledOnce(disabledReason);
    return null;
  }

  if (!state.queue) {
    state.queue = new Queue<RouteDraftJobData>(QUEUE_NAME, {
      connection: getRedisConnectionConfig(),
    });
  }

  return state.queue;
}

export async function enqueueRouteDraftGeneration(
  data: RouteDraftJobData,
  options?: JobsOptions,
): Promise<void> {
  const queue = getQueueInstance();
  if (!queue) {
    return;
  }

  await queue.add("generate", data, {
    attempts: 3,
    removeOnComplete: 50,
    removeOnFail: 20,
    ...options,
  });
}

export function startRouteDraftWorker(): Worker<RouteDraftJobData> | null {
  if (state.worker) {
    return state.worker;
  }

  const disabledReason = queueUnavailableReason();
  if (disabledReason) {
    logDisabledOnce(disabledReason);
    return null;
  }

  const connection = getRedisConnectionConfig();
  const worker = new Worker<RouteDraftJobData>(
    QUEUE_NAME,
    async (job: Job<RouteDraftJobData>) => {
      const date = job.data.date ? new Date(job.data.date) : new Date();
      const result = await generateRouteDrafts({
        orgId: job.data.orgId,
        date,
        lookAheadDays: job.data.lookAheadDays ?? 0,
        autopromote: job.data.autopromote ?? false,
      });

      return {
        draftsCreated: result.draftsCreated,
        autoPromoted: result.autoPromoted,
      };
    },
    { connection },
  );

  worker.on("completed", (job, result) => {
    console.log("[RouteDraftWorker] completed", job.id, result);
  });

  worker.on("failed", (job, err) => {
    console.error("[RouteDraftWorker] failed", job?.id, err);
  });

  state.worker = worker;
  return worker;
}

if (shouldAutoStartWorkers()) {
  startRouteDraftWorker();
}
