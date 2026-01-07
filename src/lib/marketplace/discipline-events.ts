import {
  DisciplineEventSource,
  DisciplineEventType,
  Prisma,
  PrismaClient,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  applyDisciplineEvent,
  DisciplineKey,
  EARLY_RELEASE_LIMIT,
  JOB_RELEASE_LIMIT,
  LATE_RELEASE_LIMIT,
  STRIKE_LIMIT,
  incrementDisciplineEntry,
  startOfQuarterUTC,
} from "@/lib/marketplace/discipline";

const TYPE_TO_KEY: Record<DisciplineEventType, DisciplineKey> = {
  MISSED_VISIT: "strikes",
  LATE_RELEASE: "lateRelease",
  EARLY_RELEASE: "earlyRelease",
  JOB_RELEASE: "jobRelease",
};

export const DISCIPLINE_LIMITS: Record<DisciplineKey, number> = {
  strikes: STRIKE_LIMIT,
  lateRelease: LATE_RELEASE_LIMIT,
  earlyRelease: EARLY_RELEASE_LIMIT,
  jobRelease: JOB_RELEASE_LIMIT,
};

export function resolveDisciplineKey(type: DisciplineEventType): DisciplineKey {
  return TYPE_TO_KEY[type];
}

export function resolveDisciplineLimit(type: DisciplineEventType): number {
  return DISCIPLINE_LIMITS[resolveDisciplineKey(type)];
}

type DisciplineSummaryEntry = {
  count: number;
  limit: number;
  windowStart: string;
  lastAt: string | null;
  lastReason: string | null;
};

export type DisciplineSummary = Record<DisciplineKey, DisciplineSummaryEntry>;

function cloneMetadata(raw: Prisma.JsonValue | null | undefined) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  return { ...(raw as Record<string, unknown>) };
}

export function summarizeDisciplineEvents(
  events: Array<{
    type: DisciplineEventType;
    reason: string | null;
    createdAt: Date;
  }>,
  now: Date,
): DisciplineSummary {
  const windowStart = startOfQuarterUTC(now).toISOString();
  const summary = Object.fromEntries(
    (Object.keys(DISCIPLINE_LIMITS) as DisciplineKey[]).map((key) => [
      key,
      {
        count: 0,
        limit: DISCIPLINE_LIMITS[key],
        windowStart,
        lastAt: null,
        lastReason: null,
      },
    ]),
  ) as DisciplineSummary;

  events.forEach((event) => {
    const key = resolveDisciplineKey(event.type);
    const entry = summary[key];
    entry.count += 1;
    if (!entry.lastAt || new Date(entry.lastAt).getTime() < event.createdAt.getTime()) {
      entry.lastAt = event.createdAt.toISOString();
      entry.lastReason = event.reason ?? null;
    }
  });

  return summary;
}

export function rebuildDisciplineMetadataFromEvents(
  rawMetadata: Prisma.JsonValue | null | undefined,
  now: Date,
  events: Array<{
    type: DisciplineEventType;
    reason: string | null;
    createdAt: Date;
  }>,
) {
  const metadata = cloneMetadata(rawMetadata);
  const discipline = cloneMetadata(metadata.discipline as Prisma.JsonValue | null | undefined);
  const summary = summarizeDisciplineEvents(events, now);

  (Object.entries(summary) as Array<[DisciplineKey, DisciplineSummaryEntry]>).forEach(
    ([key, entry]) => {
      discipline[key] = {
        windowStart: entry.windowStart,
        count: Math.min(entry.count, entry.limit),
        lastAt: entry.lastAt ?? undefined,
        lastReason: entry.lastReason ?? undefined,
      };
    },
  );

  metadata.discipline = discipline;
  return {
    metadata: metadata as Prisma.InputJsonValue,
    summary,
  };
}

export async function recordDisciplineEvent({
  tx,
  profile,
  type,
  reason,
  serviceVisitId,
  jobId,
  createdById,
  source = "SYSTEM",
  enforceLimit = true,
  now = new Date(),
}: {
  tx?: Prisma.TransactionClient | PrismaClient;
  profile: { id: string; orgId: string; metadata: Prisma.JsonValue | null };
  type: DisciplineEventType;
  reason?: string | null;
  serviceVisitId?: string | null;
  jobId?: string | null;
  createdById?: string | null;
  source?: DisciplineEventSource;
  enforceLimit?: boolean;
  now?: Date;
}) {
  const client = tx ?? prisma;
  const key = resolveDisciplineKey(type);
  const limit = resolveDisciplineLimit(type);

  const metadataUpdate = enforceLimit
    ? incrementDisciplineEntry(profile.metadata, now, key, { limit, reason: reason ?? undefined })
    : applyDisciplineEvent(profile.metadata, now, key, { limit, reason: reason ?? undefined });

  if (enforceLimit && !metadataUpdate.allowed) {
    return {
      allowed: false,
      limit,
      currentCount: metadataUpdate.currentCount,
      windowStart: metadataUpdate.windowStart,
    };
  }

  const updatedProfile = await client.scooperProfile.update({
    where: { id: profile.id },
    data: { metadata: metadataUpdate.metadata as Prisma.InputJsonValue },
  });

  const event = await client.scooperDisciplineEvent.create({
    data: {
      orgId: profile.orgId,
      scooperId: profile.id,
      type,
      source,
      reason: reason ?? null,
      serviceVisitId: serviceVisitId ?? null,
      jobId: jobId ?? null,
      createdById: createdById ?? null,
    },
  });

  return {
    allowed: true,
    event,
    updatedProfile,
    limit,
    currentCount: metadataUpdate.currentCount,
    windowStart: metadataUpdate.windowStart,
  };
}
