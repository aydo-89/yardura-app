import { Queue, Worker, Job, JobsOptions } from "bullmq";
import { PayoutStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { info } from "@/lib/log";
import { releaseVisitPayout } from "@/lib/marketplace/payouts";

import {
  getRedisConnectionConfig,
  queueUnavailableReason,
  shouldAutoStartWorkers,
} from "./shared";

export interface PayoutReleaseJobData {
  orgId: string;
}

const PAYOUT_RELEASE_QUEUE = "scooper-payout-release";
const DEFAULT_RELEASE_CRON = process.env.PAYOUT_RELEASE_CRON || "0 15 * * 5";
const DEFAULT_MIN_RELEASE_CENTS = Number(process.env.PAYOUT_RELEASE_MIN_CENTS ?? 0);

type PayoutReleaseState = {
  queue?: Queue<PayoutReleaseJobData>;
  worker?: Worker<PayoutReleaseJobData> | null;
  disabledLogged?: boolean;
};

const globalState = globalThis as typeof globalThis & {
  __payoutReleaseState?: PayoutReleaseState;
};

if (!globalState.__payoutReleaseState) {
  globalState.__payoutReleaseState = {};
}

const state = globalState.__payoutReleaseState;

function logDisabledOnce(reason: string) {
  if (state.disabledLogged) return;
  state.disabledLogged = true;
  console.warn(
    `[jobs] ${PAYOUT_RELEASE_QUEUE} queue disabled (${reason}); requests will be ignored`,
  );
}

function getQueueInstance(): Queue<PayoutReleaseJobData> | null {
  const disabledReason = queueUnavailableReason();
  if (disabledReason) {
    logDisabledOnce(disabledReason);
    return null;
  }

  if (!state.queue) {
    state.queue = new Queue<PayoutReleaseJobData>(PAYOUT_RELEASE_QUEUE, {
      connection: getRedisConnectionConfig(),
    });
  }

  return state.queue;
}

export async function enqueuePayoutRelease(
  data: PayoutReleaseJobData,
  options?: JobsOptions,
) {
  const queue = getQueueInstance();
  if (!queue) return;

  await queue.add("release", data, {
    removeOnComplete: 100,
    removeOnFail: 20,
    attempts: 3,
    ...options,
  });
}

export async function scheduleRecurringPayoutRelease(
  orgId: string,
  cron: string = DEFAULT_RELEASE_CRON,
) {
  const queue = getQueueInstance();
  if (!queue) return;

  const jobId = `recurring-payout-release-${orgId}`;
  await queue.add(
    "release",
    { orgId },
    {
      jobId,
      repeat: {
        pattern: cron,
      },
      removeOnFail: 20,
    },
  );
}

async function releaseReadyPayoutsForOrg(orgId: string) {
  const now = new Date();
  const minAmountCents = Number.isFinite(DEFAULT_MIN_RELEASE_CENTS)
    ? DEFAULT_MIN_RELEASE_CENTS
    : 0;

  const payouts = await prisma.visitPayout.findMany({
    where: {
      orgId,
      status: PayoutStatus.READY,
      stripeTransferId: null,
      withdrawalRequestId: null,
      totalAmountCents: { gt: Math.max(minAmountCents, 0) },
      OR: [
        { readyAt: { lte: now } },
        { readyAt: null },
      ],
      scooperProfile: {
        payoutAutoReleaseEnabled: true,
      },
      scooper: {
        stripeConnectAccountId: { not: null },
      },
    },
    orderBy: { readyAt: "asc" },
    take: 200,
  });

  let releasedCount = 0;
  let skippedCount = 0;
  const errors: Record<string, number> = {};

  for (const payout of payouts) {
    try {
      await releaseVisitPayout(payout.id);
      releasedCount += 1;
    } catch (error) {
      skippedCount += 1;
      const message = error instanceof Error ? error.message : "unknown";
      errors[message] = (errors[message] ?? 0) + 1;
    }
  }

  return {
    orgId,
    releasedCount,
    skippedCount,
    errorBreakdown: errors,
    evaluated: payouts.length,
  };
}

export async function handlePayoutRelease(data: PayoutReleaseJobData) {
  const result = await releaseReadyPayoutsForOrg(data.orgId);

  info("marketplace.payoutRelease", {
    orgId: data.orgId,
    releasedCount: result.releasedCount,
    skippedCount: result.skippedCount,
    evaluated: result.evaluated,
    errorBreakdown: result.errorBreakdown,
  });

  return result;
}

export function startPayoutReleaseWorker(): Worker<PayoutReleaseJobData> | null {
  if (state.worker) {
    return state.worker;
  }

  const disabledReason = queueUnavailableReason();
  if (disabledReason) {
    logDisabledOnce(disabledReason);
    return null;
  }

  const connection = getRedisConnectionConfig();
  const worker = new Worker<PayoutReleaseJobData>(
    PAYOUT_RELEASE_QUEUE,
    async (job: Job<PayoutReleaseJobData>) => handlePayoutRelease(job.data),
    { connection },
  );

  worker.on("completed", (job, result) => {
    console.log("[PayoutRelease] completed", job.id, JSON.stringify(result));
  });

  worker.on("failed", (job, err) => {
    console.error("[PayoutRelease] failed", job?.id, err);
  });

  state.worker = worker;
  return worker;
}

if (shouldAutoStartWorkers()) {
  startPayoutReleaseWorker();
}
