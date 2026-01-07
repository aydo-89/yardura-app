import { Queue, Worker, Job, JobsOptions } from "bullmq";

import { prisma } from "@/lib/prisma";
import { createVisitOffersForTile } from "@/lib/marketplace/offers";
import { ServiceTileStatus } from "@prisma/client";

import {
  getRedisConnectionConfig,
  queueUnavailableReason,
  shouldAutoStartWorkers,
} from "./shared";

export interface OfferPublishJobData {
  orgId: string;
  tileSlugs?: string[];
  lookaheadDays?: number;
  limitPerTile?: number;
}

const queueName = "marketplace-offer-publisher";

type PublisherModuleState = {
  queue?: Queue<OfferPublishJobData>;
  worker?: Worker<OfferPublishJobData> | null;
  disabledLogged?: boolean;
};

const globalState = globalThis as typeof globalThis & {
  __marketplaceOfferPublisherState?: PublisherModuleState;
};

if (!globalState.__marketplaceOfferPublisherState) {
  globalState.__marketplaceOfferPublisherState = {};
}

const state = globalState.__marketplaceOfferPublisherState;

function logQueueDisabledOnce(reason: string) {
  if (state.disabledLogged) return;
  state.disabledLogged = true;
  console.warn(
    `[jobs] ${queueName} queue disabled (${reason}); requests will be ignored`,
  );
}

function getQueueInstance(): Queue<OfferPublishJobData> | null {
  const disabledReason = queueUnavailableReason();
  if (disabledReason) {
    logQueueDisabledOnce(disabledReason);
    return null;
  }

  if (!state.queue) {
    state.queue = new Queue<OfferPublishJobData>(queueName, {
      connection: getRedisConnectionConfig(),
    });
  }

  return state.queue;
}

export async function enqueueOfferPublishing(
  data: OfferPublishJobData,
  options?: JobsOptions,
): Promise<string | null> {
  const queue = getQueueInstance();
  if (!queue) {
    return null;
  }

  const job = await queue.add("publish", data, {
    removeOnComplete: 100,
    removeOnFail: 20,
    attempts: 3,
    ...options,
  });

  return job.id ?? null;
}

export async function scheduleRecurringOfferPublishing(
  orgId: string,
  cron: string = "*/30 * * * *", // every 30 minutes
) {
  const queue = getQueueInstance();
  if (!queue) {
    return;
  }

  const jobId = `recurring-offers-${orgId}`;
  await queue.add(
    "publish",
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

export function startMarketplaceOfferWorker(): Worker<OfferPublishJobData> | null {
  if (state.worker) {
    return state.worker;
  }

  const disabledReason = queueUnavailableReason();
  if (disabledReason) {
    logQueueDisabledOnce(disabledReason);
    return null;
  }

  const connection = getRedisConnectionConfig();
  const worker = new Worker<OfferPublishJobData>(
    queueName,
    async (job: Job<OfferPublishJobData>) => {
      const { orgId, tileSlugs, lookaheadDays = 7, limitPerTile = 25 } = job.data;

      const tiles = await prisma.serviceTile.findMany({
        where: {
          orgId,
          status: { in: [ServiceTileStatus.LIVE, ServiceTileStatus.WAITLIST] },
          ...(tileSlugs?.length
            ? {
                slug: { in: tileSlugs },
              }
            : {}),
        },
        select: {
          id: true,
          slug: true,
        },
      });

      let totalCreated = 0;

      for (const tile of tiles) {
        const offers = await createVisitOffersForTile({
          orgId,
          tileId: tile.id,
          lookaheadDays,
          limit: limitPerTile,
        });
        totalCreated += offers.length;
      }

      return {
        tilesProcessed: tiles.length,
        offersEvaluated: totalCreated,
      };
    },
    { connection },
  );

  worker.on("completed", (job, result) => {
    console.log(
      "[MarketplaceOfferWorker] completed",
      job.id,
      JSON.stringify(result),
    );
  });

  worker.on("failed", (job, err) => {
    console.error("[MarketplaceOfferWorker] failed", job?.id, err);
  });

  state.worker = worker;
  return worker;
}

if (shouldAutoStartWorkers()) {
  startMarketplaceOfferWorker();
}

export type OfferPublishJobStatus = {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  result?: any;
  error?: string | null;
  createdAt: number;
  processedAt?: number | null;
  completedAt?: number | null;
  data?: OfferPublishJobData;
};

export async function getOfferPublishJobStatus(
  jobId: string,
): Promise<OfferPublishJobStatus | null> {
  const queue = getQueueInstance();
  if (!queue) return null;

  const job = await queue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  let status: OfferPublishJobStatus["status"] = "pending";

  if (state === "active") {
    status = "processing";
  } else if (state === "completed") {
    status = "completed";
  } else if (state === "failed") {
    status = "failed";
  }

  return {
    jobId,
    status,
    progress:
      typeof job.progress === "number" ? (job.progress as number) : undefined,
    result: job.returnvalue ?? null,
    error: job.failedReason ?? null,
    createdAt: job.timestamp,
    processedAt: job.processedOn ?? null,
    completedAt: job.finishedOn ?? null,
    data: job.data,
  };
}
