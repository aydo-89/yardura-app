import { Prisma } from "@prisma/client";

export const MISSED_VISIT_LIMIT = 3;
export const LATE_RELEASE_LIMIT = 5;
export const EARLY_RELEASE_LIMIT = 10;
export const JOB_RELEASE_LIMIT = 3;
export const STRIKE_LIMIT = MISSED_VISIT_LIMIT;

type DisciplineMetadataShape = {
  discipline?: Record<string, unknown>;
  [key: string]: unknown;
};

type StrikeEntry = {
  windowStart: string;
  count: number;
  lastAt?: string;
  lastReason?: string;
};

export type DisciplineKey = "strikes" | "lateRelease" | "earlyRelease" | "jobRelease";

type StrikeIncrementOptions = {
  limit?: number;
  reason?: string;
};

type StrikeDetails = {
  windowStart: string;
  count: number;
  lastAt?: string;
  lastReason?: string;
};

export function startOfQuarterUTC(date: Date): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const quarterStartMonth = Math.floor(month / 3) * 3;
  return new Date(Date.UTC(year, quarterStartMonth, 1, 0, 0, 0, 0));
}

function normalizeMetadata(raw: Prisma.JsonValue | null | undefined): DisciplineMetadataShape {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  return { ...(raw as Record<string, unknown>) };
}

function normalizeEntry(value: unknown, quarterIso: string): StrikeEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { windowStart: quarterIso, count: 0 };
  }

  const entry = value as Record<string, unknown>;
  const windowStart = typeof entry.windowStart === "string" ? entry.windowStart : quarterIso;
  const count = typeof entry.count === "number" && Number.isFinite(entry.count) ? entry.count : 0;
  const lastAt = typeof entry.lastAt === "string" ? entry.lastAt : undefined;
  const lastReason = typeof entry.lastReason === "string" ? entry.lastReason : undefined;

  const needsReset = new Date(windowStart).getTime() < new Date(quarterIso).getTime();

  return needsReset
    ? { windowStart: quarterIso, count: 0 }
    : { windowStart, count, lastAt, lastReason };
}

export function getDisciplineEntry(
  rawMetadata: Prisma.JsonValue | null | undefined,
  now: Date,
  key: DisciplineKey,
  fallbackKey?: DisciplineKey,
): StrikeEntry {
  const metadata = normalizeMetadata(rawMetadata);
  const discipline = normalizeMetadata(metadata.discipline as Prisma.JsonValue | null | undefined);
  const quarterIso = startOfQuarterUTC(now).toISOString();
  const primary = normalizeEntry(discipline[key], quarterIso);
  if (primary.count > 0 || primary.lastAt || !fallbackKey) {
    return primary;
  }
  return normalizeEntry(discipline[fallbackKey], quarterIso);
}

export function incrementDisciplineEntry(
  rawMetadata: Prisma.JsonValue | null | undefined,
  now: Date,
  key: DisciplineKey,
  options: StrikeIncrementOptions = {},
) {
  const limit = options.limit ?? Number.POSITIVE_INFINITY;
  const metadata = normalizeMetadata(rawMetadata);
  const discipline = normalizeMetadata(metadata.discipline as Prisma.JsonValue | null | undefined);

  const quarterIso = startOfQuarterUTC(now).toISOString();
  const existingEntry = normalizeEntry(discipline[key], quarterIso);
  if (existingEntry.count >= limit) {
    return {
      metadata: rawMetadata as Prisma.InputJsonValue,
      currentCount: existingEntry.count,
      limit,
      windowStart: existingEntry.windowStart,
      lastAt: existingEntry.lastAt,
      lastReason: existingEntry.lastReason,
      reachedLimit: true,
      allowed: false,
    };
  }

  const nextCount = Math.min(existingEntry.count + 1, limit);

  const nextEntry: StrikeEntry = {
    windowStart: quarterIso,
    count: nextCount,
    lastAt: now.toISOString(),
    lastReason: options.reason ?? existingEntry.lastReason,
  };

  discipline[key] = nextEntry;
  metadata.discipline = discipline;

  return {
    metadata: metadata as Prisma.InputJsonValue,
    currentCount: nextEntry.count,
    limit,
    windowStart: nextEntry.windowStart,
    lastAt: nextEntry.lastAt,
    lastReason: nextEntry.lastReason,
    reachedLimit: nextEntry.count >= limit,
    allowed: true,
  };
}

export function applyDisciplineEvent(
  rawMetadata: Prisma.JsonValue | null | undefined,
  now: Date,
  key: DisciplineKey,
  options: StrikeIncrementOptions = {},
) {
  const limit = options.limit ?? Number.POSITIVE_INFINITY;
  const metadata = normalizeMetadata(rawMetadata);
  const discipline = normalizeMetadata(metadata.discipline as Prisma.JsonValue | null | undefined);

  const quarterIso = startOfQuarterUTC(now).toISOString();
  const existingEntry = normalizeEntry(discipline[key], quarterIso);
  const nextCount = Math.min(existingEntry.count + 1, limit);

  const nextEntry: StrikeEntry = {
    windowStart: quarterIso,
    count: nextCount,
    lastAt: now.toISOString(),
    lastReason: options.reason ?? existingEntry.lastReason,
  };

  discipline[key] = nextEntry;
  metadata.discipline = discipline;

  return {
    metadata: metadata as Prisma.InputJsonValue,
    currentCount: nextEntry.count,
    limit,
    windowStart: nextEntry.windowStart,
    lastAt: nextEntry.lastAt,
    lastReason: nextEntry.lastReason,
    reachedLimit: nextEntry.count >= limit,
    allowed: true,
  };
}

export function setDisciplineEntry(
  rawMetadata: Prisma.JsonValue | null | undefined,
  now: Date,
  key: DisciplineKey,
  count: number,
  options: StrikeIncrementOptions = {},
) {
  const limit = options.limit ?? Number.POSITIVE_INFINITY;
  const metadata = normalizeMetadata(rawMetadata);
  const discipline = normalizeMetadata(metadata.discipline as Prisma.JsonValue | null | undefined);

  const quarterIso = startOfQuarterUTC(now).toISOString();
  const existingEntry = normalizeEntry(discipline[key], quarterIso);
  const nextCount = Math.max(0, Math.min(Math.floor(count), limit));

  const nextEntry: StrikeEntry = {
    windowStart: quarterIso,
    count: nextCount,
    lastAt: now.toISOString(),
    lastReason: options.reason ?? existingEntry.lastReason,
  };

  discipline[key] = nextEntry;
  metadata.discipline = discipline;

  return {
    metadata: metadata as Prisma.InputJsonValue,
    currentCount: nextEntry.count,
    limit,
    windowStart: nextEntry.windowStart,
    lastAt: nextEntry.lastAt,
    lastReason: nextEntry.lastReason,
  };
}

export function getStrikeDetails(rawMetadata: Prisma.JsonValue | null | undefined, now: Date): StrikeDetails {
  const entry = getDisciplineEntry(rawMetadata, now, "strikes");

  return {
    windowStart: entry.windowStart,
    count: entry.count,
    lastAt: entry.lastAt,
    lastReason: entry.lastReason,
  };
}

export function incrementStrikeMetadata(
  rawMetadata: Prisma.JsonValue | null | undefined,
  now: Date,
  options: StrikeIncrementOptions = {},
) {
  return incrementDisciplineEntry(rawMetadata, now, "strikes", {
    limit: options.limit ?? STRIKE_LIMIT,
    reason: options.reason,
  });
}

export function peekStrikeCount(rawMetadata: Prisma.JsonValue | null | undefined, now: Date) {
  const entry = getDisciplineEntry(rawMetadata, now, "strikes");

  return {
    count: entry.count,
    windowStart: entry.windowStart,
  };
}

export function setStrikeCount(
  rawMetadata: Prisma.JsonValue | null | undefined,
  now: Date,
  count: number,
  reason?: string | null,
) {
  const metadata = normalizeMetadata(rawMetadata);
  const discipline = normalizeMetadata(metadata.discipline as Prisma.JsonValue | null | undefined);
  const quarterIso = startOfQuarterUTC(now).toISOString();
  const entry = normalizeEntry(discipline.strikes, quarterIso);
  const nextCount = Math.max(0, Math.min(Math.floor(count), STRIKE_LIMIT));

  const nextEntry: StrikeEntry = {
    windowStart: entry.windowStart ?? quarterIso,
    count: nextCount,
    lastAt: now.toISOString(),
    lastReason: reason ?? entry.lastReason,
  };

  discipline.strikes = nextEntry;
  metadata.discipline = discipline;

  return {
    metadata: metadata as Prisma.InputJsonValue,
    currentCount: nextEntry.count,
    windowStart: nextEntry.windowStart,
    lastAt: nextEntry.lastAt,
    lastReason: nextEntry.lastReason,
  };
}
