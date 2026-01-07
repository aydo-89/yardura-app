import { Queue, Worker, Job, JobsOptions } from "bullmq";
import { addHours, addMinutes, differenceInMinutes } from "date-fns";
import {
  AvailabilityWindow,
  CertificationStatus,
  ScooperStatus,
  ServiceStatus,
  VisitOfferStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { info } from "@/lib/log";
import { getBusinessConfig } from "@/lib/business-config";
import { extractPreferredTimeWindow } from "@/lib/time-window";
import { getZonedWeekday, SERVICE_TIME_ZONE } from "@/lib/timezone";
import { peekStrikeCount, STRIKE_LIMIT } from "@/lib/marketplace/discipline";
import {
  markAutoAssignAttempt,
  readAutoAssignState,
} from "@/lib/marketplace/offer-auto-assign";
import { sendScooperDirectOfferPush } from "@/lib/notifications/push";

import {
  getRedisConnectionConfig,
  queueUnavailableReason,
  shouldAutoStartWorkers,
} from "./shared";

export interface OfferAutoAssignJobData {
  orgId: string;
}

const QUEUE_NAME = "marketplace-offer-auto-assign";
const DEFAULT_AUTO_ASSIGN_LEAD_HOURS = 6;
const DEFAULT_DIRECT_HOLD_MINUTES = 30;

type AutoAssignState = {
  queue?: Queue<OfferAutoAssignJobData>;
  worker?: Worker<OfferAutoAssignJobData> | null;
  disabledLogged?: boolean;
};

const globalState = globalThis as typeof globalThis & {
  __marketplaceOfferAutoAssignState?: AutoAssignState;
};

if (!globalState.__marketplaceOfferAutoAssignState) {
  globalState.__marketplaceOfferAutoAssignState = {};
}

const state = globalState.__marketplaceOfferAutoAssignState;

function logDisabledOnce(reason: string) {
  if (state.disabledLogged) return;
  state.disabledLogged = true;
  console.warn(
    `[jobs] ${QUEUE_NAME} queue disabled (${reason}); requests will be ignored`,
  );
}

function getQueueInstance(): Queue<OfferAutoAssignJobData> | null {
  const disabledReason = queueUnavailableReason();
  if (disabledReason) {
    logDisabledOnce(disabledReason);
    return null;
  }

  if (!state.queue) {
    state.queue = new Queue<OfferAutoAssignJobData>(QUEUE_NAME, {
      connection: getRedisConnectionConfig(),
    });
  }

  return state.queue;
}

function resolveAutoAssignLeadHours(config?: Awaited<ReturnType<typeof getBusinessConfig>>) {
  const hours = config?.operations?.offerAutoAssignLeadHours;
  if (typeof hours === "number" && Number.isFinite(hours) && hours > 0) {
    return hours;
  }
  if (typeof hours === "number" && Number.isFinite(hours) && hours <= 0) {
    return 0;
  }
  return DEFAULT_AUTO_ASSIGN_LEAD_HOURS;
}

function resolveDirectHoldMinutes(config?: Awaited<ReturnType<typeof getBusinessConfig>>) {
  const minutes = config?.operations?.offerDirectHoldMinutes;
  if (typeof minutes === "number" && Number.isFinite(minutes) && minutes > 0) {
    return minutes;
  }
  return DEFAULT_DIRECT_HOLD_MINUTES;
}

function resolveMinBoardMinutes(config?: Awaited<ReturnType<typeof getBusinessConfig>>) {
  const minutes = config?.operations?.offerRefreshMinutes;
  if (typeof minutes === "number" && Number.isFinite(minutes) && minutes > 0) {
    return minutes;
  }
  return DEFAULT_DIRECT_HOLD_MINUTES;
}

function toCertificationSet(profile: {
  certifications: Array<{ type: string; status: CertificationStatus }>;
}) {
  return new Set(
    profile.certifications
      .filter((cert) => cert.status === CertificationStatus.ACTIVE)
      .map((cert) => cert.type),
  );
}

function extractRequiredCertifications(value: unknown): string[] {
  if (!value || !Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function resolveAvailabilityWindows(slug: string | null): AvailabilityWindow[] {
  if (slug === "morning") {
    return [AvailabilityWindow.AM, AvailabilityWindow.FULL, AvailabilityWindow.CUSTOM];
  }
  if (slug === "afternoon") {
    return [AvailabilityWindow.PM, AvailabilityWindow.FULL, AvailabilityWindow.CUSTOM];
  }
  return [
    AvailabilityWindow.AM,
    AvailabilityWindow.PM,
    AvailabilityWindow.FULL,
    AvailabilityWindow.CUSTOM,
  ];
}

export async function enqueueOfferAutoAssign(
  data: OfferAutoAssignJobData,
  options?: JobsOptions,
): Promise<void> {
  const queue = getQueueInstance();
  if (!queue) {
    return;
  }

  await queue.add("auto-assign", data, {
    removeOnComplete: 50,
    removeOnFail: 20,
    attempts: 3,
    ...options,
  });
}

export async function scheduleRecurringOfferAutoAssign(
  orgId: string,
  cron: string = "*/10 * * * *",
) {
  const queue = getQueueInstance();
  if (!queue) {
    return;
  }

  const jobId = `recurring-offer-auto-assign-${orgId}`;
  await queue.add(
    "auto-assign",
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

export async function handleOfferAutoAssign(data: OfferAutoAssignJobData) {
  const { orgId } = data;
  const config = await getBusinessConfig(orgId);
  const now = new Date();
  const leadHours = resolveAutoAssignLeadHours(config);
  if (leadHours <= 0) {
    info("marketplace.offerAutoAssign", {
      orgId,
      autoAssigned: 0,
      skippedNoCandidate: 0,
      skippedNoTile: 0,
      skippedActiveDirect: 0,
      leadHours,
      disabled: true,
    });
    return {
      autoAssigned: 0,
      skippedNoCandidate: 0,
      skippedNoTile: 0,
      skippedActiveDirect: 0,
    };
  }
  const directHoldMinutes = resolveDirectHoldMinutes(config);
  const minBoardMinutes = resolveMinBoardMinutes(config);
  const cutoff = addHours(now, leadHours);

  const visits = await prisma.serviceVisit.findMany({
    where: {
      orgId,
      status: ServiceStatus.SCHEDULED,
      assignedToId: null,
      backupAssignedToId: null,
      scheduledDate: {
        gt: now,
        lte: cutoff,
      },
    },
    include: {
      visitOffers: {
        where: { status: VisitOfferStatus.PENDING },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  let autoAssigned = 0;
  let skippedNoCandidate = 0;
  let skippedNoTile = 0;
  let skippedActiveDirect = 0;
  const skippedNoOffer = 0;
  let skippedTooFresh = 0;

  for (const visit of visits) {
    if (!visit.tileId) {
      skippedNoTile += 1;
      continue;
    }

    const offer = visit.visitOffers[0] ?? null;
    if (offer?.offeredToId && (!offer.expiresAt || offer.expiresAt > now)) {
      skippedActiveDirect += 1;
      continue;
    }
    if (
      offer?.dispatchStrategy !== "auto_assign" &&
      offer?.createdAt &&
      differenceInMinutes(now, offer.createdAt) < minBoardMinutes
    ) {
      skippedTooFresh += 1;
      continue;
    }

    const window = extractPreferredTimeWindow(visit.metadata ?? null, visit.preferredTimeWindow ?? null);
    const windowSlug = window.slug ?? null;
    const weekday = getZonedWeekday(visit.scheduledDate, SERVICE_TIME_ZONE);
    const windows = resolveAvailabilityWindows(windowSlug);

    const availabilities = await prisma.scooperAvailability.findMany({
      where: {
        orgId,
        weekday,
        window: { in: windows },
        OR: [{ tileId: visit.tileId }, { tileId: null }],
        AND: [
          { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: visit.scheduledDate } }] },
          { OR: [{ effectiveTo: null }, { effectiveTo: { gte: visit.scheduledDate } }] },
        ],
        scooper: {
          status: ScooperStatus.CERTIFIED,
        },
      },
      include: {
        scooper: {
          select: {
            id: true,
            userId: true,
            status: true,
            metadata: true,
            certifications: {
              select: {
                type: true,
                status: true,
              },
            },
          },
        },
      },
    });

    const requiredCerts = extractRequiredCertifications(visit.requiredCertifications);
    const declinedBy = readAutoAssignState(offer?.metadata ?? null).declinedBy;

    const candidates = new Map<
      string,
      { userId: string; rating: number; stops: number; metadata: unknown; certs: Set<string> }
    >();

    for (const availability of availabilities) {
      const scooper = availability.scooper;
      if (!scooper?.userId) continue;
      if (declinedBy.includes(scooper.userId)) continue;

      const strikeStatus = peekStrikeCount(scooper.metadata, now);
      if (strikeStatus.count >= STRIKE_LIMIT) {
        continue;
      }

      const certs = toCertificationSet(scooper);
      const missing = requiredCerts.filter((cert) => !certs.has(cert));
      if (missing.length) {
        continue;
      }

      const metadata =
        scooper.metadata && typeof scooper.metadata === "object" && !Array.isArray(scooper.metadata)
          ? (scooper.metadata as Record<string, unknown>)
          : {};
      const rating =
        typeof metadata.avgRating === "number" && Number.isFinite(metadata.avgRating)
          ? metadata.avgRating
          : 0;
      const stops =
        typeof metadata.lifetimeStops === "number" && Number.isFinite(metadata.lifetimeStops)
          ? metadata.lifetimeStops
          : typeof metadata.totalStops === "number" && Number.isFinite(metadata.totalStops)
            ? metadata.totalStops
            : 0;

      candidates.set(scooper.userId, {
        userId: scooper.userId,
        rating,
        stops,
        metadata,
        certs,
      });
    }

    if (!candidates.size) {
      skippedNoCandidate += 1;
      continue;
    }

    const sorted = Array.from(candidates.values()).sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      return b.stops - a.stops;
    });

    const winner = sorted[0];
    if (!winner) {
      skippedNoCandidate += 1;
      continue;
    }

    const expiresAt = addMinutes(now, directHoldMinutes);
    const updatedMetadata = markAutoAssignAttempt(offer?.metadata ?? visit.metadata ?? null, {
      userId: winner.userId,
      now,
    });

    if (offer) {
      await prisma.visitOffer.update({
        where: { id: offer.id },
        data: {
          offeredToId: winner.userId,
          dispatchStrategy: "auto_assign",
          expiresAt,
          metadata: updatedMetadata,
        },
      });
    } else {
      await prisma.visitOffer.create({
        data: {
          orgId,
          serviceVisitId: visit.id,
          tileId: visit.tileId,
          status: VisitOfferStatus.PENDING,
          priority: 0,
          dispatchStrategy: "auto_assign",
          offeredToId: winner.userId,
          expiresAt,
          metadata: updatedMetadata,
        },
      });
    }

    void sendScooperDirectOfferPush({
      userId: winner.userId,
      windowLabel: window.label ?? null,
      scheduledDate: visit.scheduledDate,
    }).catch(() => {
      // Do not block assignments on push errors.
    });

    autoAssigned += 1;
  }

  info("marketplace.offerAutoAssign", {
    orgId,
    totalVisits: visits.length,
    autoAssigned,
    skippedNoCandidate,
    skippedNoTile,
    skippedActiveDirect,
    skippedNoOffer,
    skippedTooFresh,
    leadHours,
  });

  return {
    autoAssigned,
    skippedNoCandidate,
    skippedNoTile,
    skippedActiveDirect,
  };
}

export function startMarketplaceOfferAutoAssignWorker():
  | Worker<OfferAutoAssignJobData>
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
  const worker = new Worker<OfferAutoAssignJobData>(
    QUEUE_NAME,
    async (job: Job<OfferAutoAssignJobData>) => handleOfferAutoAssign(job.data),
    { connection },
  );

  worker.on("completed", (job, result) => {
    console.log("[MarketplaceOfferAutoAssign] completed", job.id, JSON.stringify(result));
  });

  worker.on("failed", (job, err) => {
    console.error("[MarketplaceOfferAutoAssign] failed", job?.id, err);
  });

  state.worker = worker;
  return worker;
}

if (shouldAutoStartWorkers()) {
  startMarketplaceOfferAutoAssignWorker();
}
