import { Queue, Worker, Job, JobsOptions } from "bullmq";

import {
  getRedisConnectionConfig,
  queueUnavailableReason,
  shouldAutoStartWorkers,
} from "./shared";

export interface CadenceJobData {
  enrollmentId: string;
}

const QUEUE_NAME = "outbound-cadence";

type CadenceState = {
  queue?: Queue<CadenceJobData>;
  worker?: Worker<CadenceJobData> | null;
  disabledLogged?: boolean;
};

const globalState = globalThis as typeof globalThis & {
  __cadenceState?: CadenceState;
};

if (!globalState.__cadenceState) {
  globalState.__cadenceState = {};
}

const state = globalState.__cadenceState;

function logDisabledOnce(reason: string) {
  if (state.disabledLogged) return;
  state.disabledLogged = true;
  console.warn(
    `[jobs] ${QUEUE_NAME} queue disabled (${reason}); requests will be ignored`,
  );
}

function getQueueInstance(): Queue<CadenceJobData> | null {
  const disabledReason = queueUnavailableReason();
  if (disabledReason) {
    logDisabledOnce(disabledReason);
    return null;
  }

  if (!state.queue) {
    state.queue = new Queue<CadenceJobData>(QUEUE_NAME, {
      connection: getRedisConnectionConfig(),
    });
  }

  return state.queue;
}

export async function enqueueCadenceJob(
  data: CadenceJobData,
  options?: JobsOptions,
): Promise<void> {
  const queue = getQueueInstance();
  if (!queue) {
    return;
  }

  await queue.add("process", data, {
    attempts: 3,
    removeOnFail: 10,
    ...options,
  });
}

export function startCadenceWorker(): Worker<CadenceJobData> | null {
  if (state.worker) {
    return state.worker;
  }

  const disabledReason = queueUnavailableReason();
  if (disabledReason) {
    logDisabledOnce(disabledReason);
    return null;
  }

  const worker = new Worker<CadenceJobData>(
    QUEUE_NAME,
    async (job: Job<CadenceJobData>) => {
      console.log("[CadenceWorker] processing enrollment", job.data.enrollmentId);
    },
    {
      connection: getRedisConnectionConfig(),
    },
  );

  worker.on("completed", (job) => {
    console.log("[CadenceWorker] completed job", job.id);
  });

  worker.on("failed", (job, err) => {
    console.warn("[CadenceWorker] failed job", job?.id, err);
  });

  state.worker = worker;
  return worker;
}

if (shouldAutoStartWorkers()) {
  startCadenceWorker();
}
