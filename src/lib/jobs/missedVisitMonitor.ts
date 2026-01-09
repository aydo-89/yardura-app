import { Job, JobsOptions, Queue, Worker } from "bullmq";
import {
  DisciplineEventType,
  Prisma,
  RouteStopStatus,
  ServiceStatus,
  VisitOfferStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { info, warn } from "@/lib/log";
import { applyMarketplaceDelayMetadata, resolveDelayedSchedule } from "@/lib/marketplace/visit-delay";
import { recordDisciplineEvent } from "@/lib/marketplace/discipline-events";
import { createVisitOffersForVisits } from "@/lib/marketplace/offers";
import { enqueueOfferPublishing } from "@/lib/jobs/marketplaceOfferPublisher";
import { sendVisitDelayEmail } from "@/lib/emails/visit-delay";
import {
  extractPreferredTimeWindow,
  normalizePreferredTimeWindowSlug,
  resolvePreferredTimeWindowLabel,
} from "@/lib/time-window";
import {
  constructZonedDate,
  convertUtcToZonedParts,
  SERVICE_TIME_ZONE,
} from "@/lib/timezone";

import {
  getRedisConnectionConfig,
  queueUnavailableReason,
  shouldAutoStartWorkers,
} from "./shared";

export interface MissedVisitMonitorJobData {
  orgId: string;
}

const QUEUE_NAME = "missed-visit-monitor";
const BATCH_LIMIT = 250;
const VISIT_STATUSES: ServiceStatus[] = [
  ServiceStatus.SCHEDULED,
  ServiceStatus.IN_PROGRESS,
];

const WINDOW_ENDS = {
  morning: { hour: 12, minute: 0 },
  afternoon: { hour: 16, minute: 0 },
  fallback: { hour: 16, minute: 0 },
};

const MISSED_VISIT_SELECT = {
  id: true,
  orgId: true,
  scheduledDate: true,
  scheduledEnd: true,
  status: true,
  assignedToId: true,
  backupAssignedToId: true,
  preferredTimeWindow: true,
  preferredTimeWindowSlug: true,
  metadata: true,
  jobId: true,
  tile: {
    select: {
      slug: true,
    },
  },
  routeStop: {
    select: {
      id: true,
      scheduledDeparture: true,
    },
  },
  customer: {
    select: {
      id: true,
      name: true,
      email: true,
      userId: true,
      addressLine1: true,
      city: true,
      zip: true,
    },
  },
  job: {
    select: {
      id: true,
      status: true,
      primaryScooperId: true,
      nextVisitAt: true,
      tile: {
        select: {
          slug: true,
        },
      },
    },
  },
} satisfies Prisma.ServiceVisitSelect;

type MissedVisitRecord = Prisma.ServiceVisitGetPayload<{
  select: typeof MISSED_VISIT_SELECT;
}>;

type MissedVisitResolution = {
  visitId: string;
  releasedVisitIds: string[];
  tileSlugs: string[];
  email?: {
    toEmail: string;
    customerName: string | null;
    scheduledDate: Date;
    preferredTimeWindow: string | null;
    preferredTimeWindowSlug: string | null;
    addressLine1: string | null;
    city: string | null;
    zip: string | null;
  };
};

type MissedVisitMonitorSummary = {
  scanned: number;
  missed: number;
  rescheduled: number;
  releasedVisits: number;
  emailsQueued: number;
  tileSlugs: string[];
};

type MonitorState = {
  queue?: Queue<MissedVisitMonitorJobData>;
  worker?: Worker<MissedVisitMonitorJobData> | null;
  disabledLogged?: boolean;
};

const globalState = globalThis as typeof globalThis & {
  __missedVisitMonitorState?: MonitorState;
};

if (!globalState.__missedVisitMonitorState) {
  globalState.__missedVisitMonitorState = {};
}

const state = globalState.__missedVisitMonitorState;

function logDisabledOnce(reason: string) {
  if (state.disabledLogged) return;
  state.disabledLogged = true;
  console.warn(
    `[jobs] ${QUEUE_NAME} queue disabled (${reason}); requests will be ignored`,
  );
}

function getQueueInstance(): Queue<MissedVisitMonitorJobData> | null {
  const disabledReason = queueUnavailableReason();
  if (disabledReason) {
    logDisabledOnce(disabledReason);
    return null;
  }

  if (!state.queue) {
    state.queue = new Queue<MissedVisitMonitorJobData>(QUEUE_NAME, {
      connection: getRedisConnectionConfig(),
    });
  }

  return state.queue;
}

export async function enqueueMissedVisitMonitor(
  data: MissedVisitMonitorJobData,
  options?: JobsOptions,
): Promise<void> {
  const queue = getQueueInstance();
  if (!queue) {
    return;
  }

  await queue.add("monitor", data, {
    removeOnComplete: 100,
    removeOnFail: 20,
    attempts: 3,
    ...options,
  });
}

export async function scheduleRecurringMissedVisitMonitor(
  orgId: string,
  cron: string = "*/15 * * * *",
) {
  const queue = getQueueInstance();
  if (!queue) {
    return;
  }

  const jobId = `recurring-missed-visit-monitor-${orgId}`;
  await queue.add(
    "monitor",
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

function resolveWindowSlug(visit: MissedVisitRecord) {
  const directSlug = normalizePreferredTimeWindowSlug(
    visit.preferredTimeWindowSlug ?? null,
  );
  if (directSlug) return directSlug;
  const extracted = extractPreferredTimeWindow(
    visit.metadata ?? null,
    visit.preferredTimeWindow ?? null,
  );
  return normalizePreferredTimeWindowSlug(extracted.slug ?? null);
}

function resolveVisitWindowEnd(visit: MissedVisitRecord): Date | null {
  if (visit.scheduledEnd && visit.scheduledEnd instanceof Date) {
    if (!Number.isNaN(visit.scheduledEnd.getTime())) {
      return visit.scheduledEnd;
    }
  }
  if (visit.routeStop?.scheduledDeparture) {
    const scheduledDeparture = visit.routeStop.scheduledDeparture;
    if (!Number.isNaN(scheduledDeparture.getTime())) {
      return scheduledDeparture;
    }
  }
  const parts = convertUtcToZonedParts(visit.scheduledDate, SERVICE_TIME_ZONE);
  const slug = resolveWindowSlug(visit);
  const endConfig =
    slug === "morning"
      ? WINDOW_ENDS.morning
      : slug === "afternoon"
        ? WINDOW_ENDS.afternoon
        : WINDOW_ENDS.fallback;

  return constructZonedDate(
    parts.year,
    parts.month,
    parts.day,
    endConfig.hour,
    endConfig.minute,
    0,
    0,
    SERVICE_TIME_ZONE,
  );
}

function isMissed(visit: MissedVisitRecord, now: Date) {
  const windowEnd = resolveVisitWindowEnd(visit);
  return windowEnd ? windowEnd.getTime() < now.getTime() : false;
}

async function processMissedVisit(
  visitId: string,
  now: Date,
): Promise<MissedVisitResolution | null> {
  return prisma.$transaction(async (tx) => {
    const visit = await tx.serviceVisit.findUnique({
      where: { id: visitId },
      select: MISSED_VISIT_SELECT,
    });

    if (!visit) {
      return null;
    }

    if (!visit.assignedToId) {
      return null;
    }

    if (!VISIT_STATUSES.includes(visit.status)) {
      return null;
    }

    if (!isMissed(visit, now)) {
      return null;
    }

    const profile = await tx.scooperProfile.findUnique({
      where: { userId: visit.assignedToId },
      select: {
        id: true,
        orgId: true,
        metadata: true,
      },
    });

    const previousWindowLabel =
      visit.preferredTimeWindow ??
      resolvePreferredTimeWindowLabel(visit.preferredTimeWindowSlug, null);

    const delaySchedule = resolveDelayedSchedule({
      scheduledDate: visit.scheduledDate,
      preferredWindowSlug: visit.preferredTimeWindowSlug ?? null,
      now,
    });

    const delayMetadata = applyMarketplaceDelayMetadata({
      raw: visit.metadata,
      now,
      reason: "missed_visit",
      previousScheduledAt: visit.scheduledDate,
      previousWindowSlug: visit.preferredTimeWindowSlug ?? null,
      previousWindowLabel,
    });

    const releaseVisitIds = new Set<string>([visit.id]);
    const routeStopIds = new Set<string>();
    if (visit.routeStop?.id) {
      routeStopIds.add(visit.routeStop.id);
    }

    if (visit.job?.primaryScooperId === visit.assignedToId) {
      const futureVisits = await tx.serviceVisit.findMany({
        where: {
          jobId: visit.job.id,
          status: ServiceStatus.SCHEDULED,
          assignedToId: visit.assignedToId,
          scheduledDate: { gte: now },
        },
        select: {
          id: true,
          routeStop: {
            select: { id: true },
          },
        },
      });

      futureVisits.forEach((futureVisit) => {
        releaseVisitIds.add(futureVisit.id);
        if (futureVisit.routeStop?.id) {
          routeStopIds.add(futureVisit.routeStop.id);
        }
      });

      if (futureVisits.length) {
        await tx.serviceVisit.updateMany({
          where: { id: { in: futureVisits.map((futureVisit) => futureVisit.id) } },
          data: {
            assignedToId: null,
            backupAssignedToId: null,
          },
        });
      }

      await tx.job.update({
        where: { id: visit.job.id },
        data: { primaryScooperId: null },
      });
    }

    await tx.visitOffer.updateMany({
      where: {
        serviceVisitId: { in: Array.from(releaseVisitIds) },
        status: VisitOfferStatus.ACCEPTED,
      },
      data: {
        status: VisitOfferStatus.RECALLED,
        cancelledAt: now,
      },
    });

    await tx.serviceVisit.update({
      where: { id: visit.id },
      data: {
        scheduledDate: delaySchedule.scheduledDate,
        preferredTimeWindow:
          delaySchedule.windowLabel ?? previousWindowLabel ?? undefined,
        preferredTimeWindowSlug:
          delaySchedule.windowSlug ??
          visit.preferredTimeWindowSlug ??
          undefined,
        metadata: delayMetadata,
        assignedToId: null,
        backupAssignedToId: null,
        status: ServiceStatus.SCHEDULED,
        completedDate: null,
        actualStart: null,
        actualEnd: null,
        skipReasonId: null,
      },
    });

    if (visit.job) {
      const nextVisitAt = visit.job.nextVisitAt;
      if (!nextVisitAt || nextVisitAt.getTime() <= visit.scheduledDate.getTime()) {
        await tx.job.update({
          where: { id: visit.job.id },
          data: { nextVisitAt: delaySchedule.scheduledDate },
        });
      }
    }

    if (routeStopIds.size) {
      await tx.routeStop.updateMany({
        where: { id: { in: Array.from(routeStopIds) } },
        data: {
          technicianId: null,
          status: RouteStopStatus.PENDING,
        },
      });
    }

    if (profile) {
      await recordDisciplineEvent({
        tx,
        profile,
        type: DisciplineEventType.MISSED_VISIT,
        reason: "Missed visit (auto-rescheduled)",
        serviceVisitId: visit.id,
        jobId: visit.job?.id ?? null,
        enforceLimit: false,
        now,
      });
    }

    const tileSlugs = [
      visit.tile?.slug,
      visit.job?.tile?.slug,
    ].filter((slug): slug is string => Boolean(slug));

    return {
      visitId: visit.id,
      releasedVisitIds: Array.from(releaseVisitIds),
      tileSlugs,
      email: visit.customer?.email
        ? {
            toEmail: visit.customer.email,
            customerName: visit.customer.name ?? null,
            scheduledDate: delaySchedule.scheduledDate,
            preferredTimeWindow: delaySchedule.windowLabel ?? null,
            preferredTimeWindowSlug: delaySchedule.windowSlug ?? null,
            addressLine1: visit.customer.addressLine1 ?? null,
            city: visit.customer.city ?? null,
            zip: visit.customer.zip ?? null,
          }
        : undefined,
    };
  });
}

export async function handleMissedVisitMonitor(
  data: MissedVisitMonitorJobData,
): Promise<MissedVisitMonitorSummary> {
  const now = new Date();
  const candidates = await prisma.serviceVisit.findMany({
    where: {
      orgId: data.orgId,
      status: { in: VISIT_STATUSES },
      assignedToId: { not: null },
      scheduledDate: { lt: now },
    },
    select: MISSED_VISIT_SELECT,
    orderBy: { scheduledDate: "asc" },
    take: BATCH_LIMIT,
  });

  const missed = candidates.filter((visit) => isMissed(visit, now));
  if (!missed.length) {
    return {
      scanned: candidates.length,
      missed: 0,
      rescheduled: 0,
      releasedVisits: 0,
      emailsQueued: 0,
      tileSlugs: [],
    };
  }

  const resolutions: MissedVisitResolution[] = [];
  for (const visit of missed) {
    try {
      const result = await processMissedVisit(visit.id, now);
      if (result) {
        resolutions.push(result);
      }
    } catch (error) {
      warn("missed-visit-monitor", {
        orgId: data.orgId,
        visitId: visit.id,
        error,
      });
    }
  }

  const visitIds = Array.from(
    new Set(resolutions.flatMap((resolution) => resolution.releasedVisitIds)),
  );
  const tileSlugs = Array.from(
    new Set(resolutions.flatMap((resolution) => resolution.tileSlugs)),
  );

  if (visitIds.length) {
    await createVisitOffersForVisits({
      orgId: data.orgId,
      visitIds,
    });
  }

  if (tileSlugs.length) {
    await enqueueOfferPublishing({ orgId: data.orgId, tileSlugs });
  } else if (visitIds.length) {
    await enqueueOfferPublishing({ orgId: data.orgId });
  }

  const emails = resolutions
    .map((resolution) => resolution.email)
    .filter((email): email is NonNullable<MissedVisitResolution["email"]> => Boolean(email));

  if (emails.length) {
    emails.forEach((email) => {
      void sendVisitDelayEmail({
        toEmail: email.toEmail,
        customerName: email.customerName,
        scheduledDate: email.scheduledDate,
        preferredTimeWindow: email.preferredTimeWindow,
        preferredTimeWindowSlug: email.preferredTimeWindowSlug,
        addressLine1: email.addressLine1,
        city: email.city,
        zip: email.zip,
      }).catch(() => {
        // Ignore delivery errors in background monitor.
      });
    });
  }

  const summary: MissedVisitMonitorSummary = {
    scanned: candidates.length,
    missed: missed.length,
    rescheduled: resolutions.length,
    releasedVisits: visitIds.length,
    emailsQueued: emails.length,
    tileSlugs,
  };

  info("missed-visit-monitor", {
    orgId: data.orgId,
    ...summary,
  });

  return summary;
}

export function startMissedVisitMonitorWorker():
  | Worker<MissedVisitMonitorJobData>
  | null {
  if (state.worker) {
    return state.worker;
  }

  const disabledReason = queueUnavailableReason();
  if (disabledReason) {
    logDisabledOnce(disabledReason);
    return null;
  }

  const worker = new Worker<MissedVisitMonitorJobData>(
    QUEUE_NAME,
    async (job: Job<MissedVisitMonitorJobData>) =>
      handleMissedVisitMonitor(job.data),
    { connection: getRedisConnectionConfig() },
  );

  worker.on("completed", (job, result) => {
    console.log(
      "[MissedVisitMonitor] completed",
      job.id,
      JSON.stringify(result),
    );
  });

  worker.on("failed", (job, err) => {
    console.error("[MissedVisitMonitor] failed", job?.id, err);
  });

  state.worker = worker;
  return worker;
}

if (shouldAutoStartWorkers()) {
  startMissedVisitMonitorWorker();
}
