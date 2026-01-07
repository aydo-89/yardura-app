import { JobsOptions, Queue } from "bullmq";

import {
  getRedisConnectionConfig,
  queueUnavailableReason,
} from "./shared";

export type BillingInvoiceJobPayload = {
  jobId: string;
  reason?: string;
};

export type BillingSweepPayload = {
  sweep: true;
};

export type BillingQueuePayload = BillingInvoiceJobPayload | BillingSweepPayload;

export const billingInvoiceQueueName = "billing-invoice-runner";

type BillingQueueState = {
  queue?: Queue<BillingQueuePayload>;
  disabledLogged?: boolean;
};

const globalState = globalThis as typeof globalThis & {
  __billingQueueState?: BillingQueueState;
};

if (!globalState.__billingQueueState) {
  globalState.__billingQueueState = {};
}

const state = globalState.__billingQueueState;

function logDisabledOnce(reason: string) {
  if (state.disabledLogged) return;
  state.disabledLogged = true;
  console.warn(
    `[jobs] ${billingInvoiceQueueName} queue disabled (${reason}); requests will be ignored`,
  );
}

export function getBillingInvoiceQueue(): Queue<BillingQueuePayload> | null {
  const disabledReason = queueUnavailableReason();
  if (disabledReason) {
    logDisabledOnce(disabledReason);
    return null;
  }

  if (!state.queue) {
    state.queue = new Queue<BillingQueuePayload>(billingInvoiceQueueName, {
      connection: getRedisConnectionConfig(),
    });
  }

  return state.queue;
}

export async function enqueueBillingInvoiceJob(
  data: BillingInvoiceJobPayload,
  options?: JobsOptions,
) {
  const queue = getBillingInvoiceQueue();
  if (!queue) {
    return;
  }

  await queue.add(
    "process",
    data,
    {
      jobId: `invoice-${data.jobId}-${Date.now()}`,
      removeOnComplete: 200,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 60_000,
      },
      ...options,
    },
  );
}

export async function scheduleBillingSweep(options?: JobsOptions) {
  const queue = getBillingInvoiceQueue();
  if (!queue) {
    return;
  }

  await queue.add(
    "billing-sweep",
    { sweep: true },
    {
      jobId: "billing-sweep",
      removeOnComplete: true,
      removeOnFail: 10,
      ...options,
    },
  );
}
