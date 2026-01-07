import { Job, Worker } from "bullmq";

import { BillingLedgerEntryStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  BillingQueuePayload,
  billingInvoiceQueueName,
  enqueueBillingInvoiceJob,
  scheduleBillingSweep,
} from "./billingInvoiceQueue";
import { processPendingLedgerEntriesForJob } from "@/lib/billing/invoice-processor";

import {
  getRedisConnectionConfig,
  queueUnavailableReason,
  shouldAutoStartWorkers,
} from "./shared";

const MIN_DEFER_DELAY_MS = 60 * 1000;

export async function ensureBillingSweepScheduled(everyMs = 15 * 60 * 1000) {
  try {
    await scheduleBillingSweep({
      repeat: {
        every: everyMs,
      },
    });
  } catch (error: any) {
    if (!error?.message?.includes("already exists")) {
      throw error;
    }
  }
}

type BillingWorkerState = {
  worker?: Worker<BillingQueuePayload> | null;
  disabledLogged?: boolean;
};

const globalState = globalThis as typeof globalThis & {
  __billingWorkerState?: BillingWorkerState;
};

if (!globalState.__billingWorkerState) {
  globalState.__billingWorkerState = {};
}

const state = globalState.__billingWorkerState;

function logWorkerDisabledOnce(reason: string) {
  if (state.disabledLogged) return;
  state.disabledLogged = true;
  console.warn(
    `[jobs] ${billingInvoiceQueueName} worker disabled (${reason}); jobs will not process`,
  );
}

export function startBillingInvoiceWorker(): Worker<BillingQueuePayload> | null {
  if (state.worker) {
    return state.worker;
  }

  const disabledReason = queueUnavailableReason();
  if (disabledReason) {
    logWorkerDisabledOnce(disabledReason);
    return null;
  }

  const worker = new Worker<BillingQueuePayload>(
    billingInvoiceQueueName,
    async (job: Job<BillingQueuePayload>) => {
      if ("sweep" in job.data) {
        const pending = await prisma.customerBillingLedgerEntry.findMany({
          where: {
            status: BillingLedgerEntryStatus.PENDING,
            stripeInvoiceId: null,
          },
          select: { jobId: true },
          distinct: ["jobId"],
        });

        const uniqueJobIds = Array.from(
          new Set(pending.map((entry) => entry.jobId).filter(Boolean)),
        );
        await Promise.all(
          uniqueJobIds.map((jobId) =>
            enqueueBillingInvoiceJob({ jobId, reason: "sweep" }).catch((error) => {
              console.error("[billing-worker] failed to enqueue job from sweep", {
                jobId,
                error,
              });
            }),
          ),
        );

        return { enqueued: uniqueJobIds.length };
      }

      if (!("jobId" in job.data)) {
        return { skipped: true };
      }

      const { jobId, reason } = job.data;
      try {
        const result = await processPendingLedgerEntriesForJob(jobId);

        if (result.status === "deferred") {
          const delay = Math.max(
            result.retryAt.getTime() - Date.now(),
            MIN_DEFER_DELAY_MS,
          );
          await enqueueBillingInvoiceJob(
            { jobId, reason: "deferred" },
            { delay },
          );
        }

        if (result.status === "missing-customer") {
          console.warn("[billing-worker] missing Stripe customer on plan", {
            jobId,
          });
        }

        if (result.status === "no-plan") {
          console.warn("[billing-worker] no billing plan found for job", {
            jobId,
          });
        }

        return { status: result.status, reason };
      } catch (error) {
        const retryDelay = 5 * 60 * 1000;
        await enqueueBillingInvoiceJob(
          { jobId, reason: "retry" },
          { delay: retryDelay },
        );
        console.error("[billing-worker] processing failed", {
          jobId,
          error,
        });
        throw error;
      }
    },
    {
      connection: getRedisConnectionConfig(),
      concurrency: 3,
    },
  );

  worker.on("failed", (job, err) => {
    console.error("[billing-worker] job failed", {
      id: job?.id,
      name: job?.name,
      data: job?.data,
      error: err,
    });
  });

  worker.on("completed", (job, result) => {
    if (job.name === "billing-sweep") {
      console.log("[billing-worker] sweep completed", result);
    }
  });

  state.worker = worker;
  return worker;
}

if (shouldAutoStartWorkers()) {
  startBillingInvoiceWorker();
}
