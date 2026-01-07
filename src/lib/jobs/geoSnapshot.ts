import { Queue, Worker, Job, JobsOptions } from "bullmq";
import { startOfDay, addDays } from "date-fns";

import { prisma } from "@/lib/prisma";
import { ensureVisitGeoSnapshot, warmDistanceMatrixForCoordinates } from "@/lib/dispatch/geo";
import { ServiceStatus } from "@prisma/client";

import {
  getRedisConnectionConfig,
  queueUnavailableReason,
  shouldAutoStartWorkers,
} from "./shared";

export interface GeoSnapshotJobData {
  orgId: string;
  date?: string;
  lookAheadDays?: number;
  limit?: number;
}

const QUEUE_NAME = "dispatch-geo-snapshot";

type GeoSnapshotState = {
  queue?: Queue<GeoSnapshotJobData>;
  worker?: Worker<GeoSnapshotJobData> | null;
  disabledLogged?: boolean;
};

const globalState = globalThis as typeof globalThis & {
  __geoSnapshotState?: GeoSnapshotState;
};

if (!globalState.__geoSnapshotState) {
  globalState.__geoSnapshotState = {};
}

const state = globalState.__geoSnapshotState;

function logDisabledOnce(reason: string) {
  if (state.disabledLogged) return;
  state.disabledLogged = true;
  console.warn(
    `[jobs] ${QUEUE_NAME} queue disabled (${reason}); requests will be ignored`,
  );
}

function getQueueInstance(): Queue<GeoSnapshotJobData> | null {
  const disabledReason = queueUnavailableReason();
  if (disabledReason) {
    logDisabledOnce(disabledReason);
    return null;
  }

  if (!state.queue) {
    state.queue = new Queue<GeoSnapshotJobData>(QUEUE_NAME, {
      connection: getRedisConnectionConfig(),
    });
  }

  return state.queue;
}

export async function enqueueGeoSnapshot(
  data: GeoSnapshotJobData,
  options?: JobsOptions,
): Promise<void> {
  const queue = getQueueInstance();
  if (!queue) {
    return;
  }

  await queue.add("hydrate", data, {
    attempts: 3,
    removeOnComplete: 50,
    removeOnFail: 20,
    ...options,
  });
}

export function startGeoSnapshotWorker(): Worker<GeoSnapshotJobData> | null {
  if (state.worker) {
    return state.worker;
  }

  const disabledReason = queueUnavailableReason();
  if (disabledReason) {
    logDisabledOnce(disabledReason);
    return null;
  }

  const connection = getRedisConnectionConfig();
  const worker = new Worker<GeoSnapshotJobData>(
    QUEUE_NAME,
    async (job: Job<GeoSnapshotJobData>) => {
      const baseDate = job.data.date
        ? startOfDay(new Date(job.data.date))
        : startOfDay(new Date());
      const lookAheadDays = job.data.lookAheadDays ?? 2;
      const limit = job.data.limit ?? 200;
      const to = addDays(baseDate, lookAheadDays + 1);

      const visits = await prisma.serviceVisit.findMany({
        where: {
          orgId: job.data.orgId,
          status: ServiceStatus.SCHEDULED,
          scheduledDate: {
            gte: baseDate,
            lt: to,
          },
        },
        include: {
          customer: {
            select: {
              id: true,
              addressLine1: true,
              city: true,
              state: true,
              zip: true,
              latitude: true,
              longitude: true,
            },
          },
        },
        orderBy: { scheduledDate: "asc" },
        take: limit,
      });

      const coordinates: Array<{ latitude: number; longitude: number }> = [];

      for (const visit of visits) {
        if (!visit.customer) continue;
        try {
          const geo = await ensureVisitGeoSnapshot({
            orgId: job.data.orgId,
            customer: visit.customer,
            visit,
          });
          coordinates.push({ latitude: geo.latitude, longitude: geo.longitude });
        } catch (error) {
          console.warn("[dispatch] geo snapshot failed", visit.id, error);
        }
      }

      if (coordinates.length > 1) {
        const uniqueOrigins = new Map<string, { latitude: number; longitude: number }>();
        coordinates.forEach((coord) => {
          const key = `${coord.latitude.toFixed(4)}:${coord.longitude.toFixed(4)}`;
          if (!uniqueOrigins.has(key)) {
            uniqueOrigins.set(key, coord);
          }
        });

        const originList = Array.from(uniqueOrigins.values()).slice(0, 25);
        await warmDistanceMatrixForCoordinates(originList, originList);
      }

      return {
        processed: visits.length,
        coordinates: coordinates.length,
      };
    },
    { connection },
  );

  worker.on("completed", (job, result) => {
    console.log("[GeoSnapshotWorker] completed", job.id, result);
  });

  worker.on("failed", (job, err) => {
    console.error("[GeoSnapshotWorker] failed", job?.id, err);
  });

  state.worker = worker;
  return worker;
}

if (shouldAutoStartWorkers()) {
  startGeoSnapshotWorker();
}
