import { Queue, Worker, Job, JobsOptions } from "bullmq";

import { expireStaleVisitOffers } from "@/lib/marketplace/offers";
import { enqueueOfferPublishing } from "@/lib/jobs/marketplaceOfferPublisher";
import { prisma } from "@/lib/prisma";
import { info } from "@/lib/log";

import {
  getRedisConnectionConfig,
  queueUnavailableReason,
  shouldAutoStartWorkers,
} from "./shared";

export interface OfferSweepJobData {
  orgId: string;
  tileSlugs?: string[];
}

const SWEEPER_QUEUE = "marketplace-offer-sweeper";

type SweeperState = {
  queue?: Queue<OfferSweepJobData>;
  worker?: Worker<OfferSweepJobData> | null;
  disabledLogged?: boolean;
};

const globalState = globalThis as typeof globalThis & {
  __marketplaceOfferSweeperState?: SweeperState;
};

if (!globalState.__marketplaceOfferSweeperState) {
  globalState.__marketplaceOfferSweeperState = {};
}

const state = globalState.__marketplaceOfferSweeperState;

function logDisabledOnce(reason: string) {
  if (state.disabledLogged) return;
  state.disabledLogged = true;
  console.warn(
    `[jobs] ${SWEEPER_QUEUE} queue disabled (${reason}); requests will be ignored`,
  );
}

function getQueueInstance(): Queue<OfferSweepJobData> | null {
  const disabledReason = queueUnavailableReason();
  if (disabledReason) {
    logDisabledOnce(disabledReason);
    return null;
  }

  if (!state.queue) {
    state.queue = new Queue<OfferSweepJobData>(SWEEPER_QUEUE, {
      connection: getRedisConnectionConfig(),
    });
  }

  return state.queue;
}

export async function enqueueOfferSweeper(
  data: OfferSweepJobData,
  options?: JobsOptions,
): Promise<void> {
  const queue = getQueueInstance();
  if (!queue) {
    return;
  }

  await queue.add("sweep", data, {
    removeOnComplete: 100,
    removeOnFail: 20,
    attempts: 3,
    ...options,
  });
}

export async function scheduleRecurringOfferSweeper(
  orgId: string,
  cron: string = "*/10 * * * *", // every 10 minutes
) {
  const queue = getQueueInstance();
  if (!queue) {
    return;
  }

  const jobId = `recurring-offer-sweeper-${orgId}`;
  await queue.add(
    "sweep",
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

export async function handleOfferSweep(data: OfferSweepJobData) {
  const { orgId, tileSlugs } = data;

  const { expiredCount, tileIds } = await expireStaleVisitOffers({ orgId });

  info("marketplace.offerSweeper", {
    orgId,
    expiredCount,
    tileIds,
    providedTileSlugs: tileSlugs,
  });

  if (expiredCount > 0) {
    let slugsToRefresh = tileSlugs && tileSlugs.length ? tileSlugs : undefined;
    if (!slugsToRefresh && tileIds.length) {
      const tiles = await prisma.serviceTile.findMany({
        where: { id: { in: tileIds } },
        select: { slug: true },
      });
      slugsToRefresh = tiles.map((tile) => tile.slug);
    }

    await enqueueOfferPublishing(
      slugsToRefresh && slugsToRefresh.length
        ? { orgId, tileSlugs: slugsToRefresh }
        : { orgId },
    );
  }

  return {
    expiredCount,
    tilesRefreshed: tileIds.length,
  };
}

export function startMarketplaceOfferSweeperWorker():
  | Worker<OfferSweepJobData>
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
  const worker = new Worker<OfferSweepJobData>(
    SWEEPER_QUEUE,
    async (job: Job<OfferSweepJobData>) => handleOfferSweep(job.data),
    { connection },
  );

  worker.on("completed", (job, result) => {
    console.log(
      "[MarketplaceOfferSweeper] completed",
      job.id,
      JSON.stringify(result),
    );
  });

  worker.on("failed", (job, err) => {
    console.error("[MarketplaceOfferSweeper] failed", job?.id, err);
  });

  state.worker = worker;
  return worker;
}

if (shouldAutoStartWorkers()) {
  startMarketplaceOfferSweeperWorker();
}
