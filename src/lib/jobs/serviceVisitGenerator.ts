import { Queue, Worker, Job, JobsOptions } from "bullmq";

import { generateServiceVisits } from "@/lib/dispatch/visit-generator";

import {
  getRedisConnectionConfig,
  queueUnavailableReason,
  shouldAutoStartWorkers,
} from "./shared";

export interface VisitGenerationJobData {
  orgId: string;
  date?: string;
  lookAheadDays?: number;
  dryRun?: boolean;
  jobLimit?: number;
}

const QUEUE_NAME = "dispatch-visit-generation";

type VisitGenerationModuleState = {
  queue?: Queue<VisitGenerationJobData>;
  worker?: Worker<VisitGenerationJobData> | null;
  disabledLogged?: boolean;
};

const globalState = globalThis as typeof globalThis & {
  __visitGenerationState?: VisitGenerationModuleState;
};

if (!globalState.__visitGenerationState) {
  globalState.__visitGenerationState = {};
}

const state = globalState.__visitGenerationState;

function logDisabledOnce(reason: string) {
  if (state.disabledLogged) return;
  state.disabledLogged = true;
  console.warn(
    `[jobs] ${QUEUE_NAME} queue disabled (${reason}); requests will be ignored`,
  );
}

function getQueueInstance(): Queue<VisitGenerationJobData> | null {
  const disabledReason = queueUnavailableReason();
  if (disabledReason) {
    logDisabledOnce(disabledReason);
    return null;
  }

  if (!state.queue) {
    state.queue = new Queue<VisitGenerationJobData>(QUEUE_NAME, {
      connection: getRedisConnectionConfig(),
    });
  }

  return state.queue;
}

export async function enqueueVisitGeneration(
  data: VisitGenerationJobData,
  options?: JobsOptions,
): Promise<void> {
  const queue = getQueueInstance();
  if (!queue) {
    return;
  }

  await queue.add("generate", data, {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    ...options,
  });
}

export async function scheduleRecurringVisitGeneration(
  params: VisitGenerationJobData & { cron?: string },
): Promise<void> {
  const queue = getQueueInstance();
  if (!queue) {
    return;
  }

  const jobId = `recurring-${params.orgId}`;
  await queue.add(
    "generate",
    {
      orgId: params.orgId,
      lookAheadDays: params.lookAheadDays,
      jobLimit: params.jobLimit,
      dryRun: params.dryRun,
    },
    {
      jobId,
      repeat: {
        pattern: params.cron ?? "0 4 * * *",
      },
      removeOnFail: 20,
    },
  );
}

export function startVisitGenerationWorker():
  | Worker<VisitGenerationJobData>
  | null {
  if (state.worker) {
    return state.worker;
  }

  const disabledReason = queueUnavailableReason();
  if (disabledReason) {
    logDisabledOnce(disabledReason);
    return null;
  }

  const connection = getRedisConnectionConfig();
  const worker = new Worker<VisitGenerationJobData>(
    QUEUE_NAME,
    async (job: Job<VisitGenerationJobData>) => {
      const now = new Date();
      const targetDate = job.data.date ? new Date(job.data.date) : now;

      const results = await generateServiceVisits({
        orgId: job.data.orgId,
        date: targetDate,
        lookAheadDays: job.data.lookAheadDays ?? 0,
        dryRun: job.data.dryRun ?? false,
        jobLimit: job.data.jobLimit ?? 250,
      });

      const created = results.filter((entry) => entry.isNew).length;
      const reused = results.length - created;

      return {
        created,
        reused,
        lookAheadDays: job.data.lookAheadDays ?? 0,
        dryRun: job.data.dryRun ?? false,
      };
    },
    { connection },
  );

  worker.on("completed", (job, result) => {
    console.log(
      "[VisitGenerationWorker] completed",
      job.id,
      JSON.stringify(result),
    );
  });

  worker.on("failed", (job, err) => {
    console.error("[VisitGenerationWorker] failed", job?.id, err);
  });

  state.worker = worker;
  return worker;
}

if (shouldAutoStartWorkers()) {
  startVisitGenerationWorker();
}
