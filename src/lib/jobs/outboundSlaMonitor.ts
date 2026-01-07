import { Job, JobsOptions, Queue, Worker } from "bullmq";

import { prisma } from "@/lib/prisma";

import {
  getRedisConnectionConfig,
  queueUnavailableReason,
  shouldAutoStartWorkers,
} from "./shared";

export interface SlaJobData {
  leadId: string;
}

const QUEUE_NAME = "outbound-sla";

type SlaState = {
  queue?: Queue<SlaJobData>;
  worker?: Worker<SlaJobData> | null;
  disabledLogged?: boolean;
};

const globalState = globalThis as typeof globalThis & {
  __slaState?: SlaState;
};

if (!globalState.__slaState) {
  globalState.__slaState = {};
}

const state = globalState.__slaState;

function logDisabledOnce(reason: string) {
  if (state.disabledLogged) return;
  state.disabledLogged = true;
  console.warn(
    `[jobs] ${QUEUE_NAME} queue disabled (${reason}); requests will be ignored`,
  );
}

function getQueueInstance(): Queue<SlaJobData> | null {
  const disabledReason = queueUnavailableReason();
  if (disabledReason) {
    logDisabledOnce(disabledReason);
    return null;
  }

  if (!state.queue) {
    state.queue = new Queue<SlaJobData>(QUEUE_NAME, {
      connection: getRedisConnectionConfig(),
    });
  }

  return state.queue;
}

export async function enqueueSlaJob(
  data: SlaJobData,
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

export function startSlaWorker(): Worker<SlaJobData> | null {
  if (state.worker) {
    return state.worker;
  }

  const disabledReason = queueUnavailableReason();
  if (disabledReason) {
    logDisabledOnce(disabledReason);
    return null;
  }

  const worker = new Worker<SlaJobData>(
    QUEUE_NAME,
    async (job: Job<SlaJobData>) => {
      const lead = await prisma.lead.findUnique({
        where: { id: job.data.leadId },
        select: { id: true, nextActionAt: true, pipelineStage: true },
      });
      console.log(
        "[SlaWorker] lead next action check",
        lead?.id,
        lead?.nextActionAt,
      );
    },
    {
      connection: getRedisConnectionConfig(),
    },
  );

  worker.on("failed", (job, err) => {
    console.warn("[SlaWorker] failed job", job?.id, err);
  });

  state.worker = worker;
  return worker;
}

if (shouldAutoStartWorkers()) {
  startSlaWorker();
}
