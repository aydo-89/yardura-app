import { Prisma } from "@prisma/client";

type HandoffType = "visit" | "job";

interface HandoffEntry {
  windowStart: string;
  count: number;
}

interface HandoffMetadataShape {
  handoff?: Record<string, unknown>;
  [key: string]: unknown;
}

const DEFAULT_LIMIT = Number.POSITIVE_INFINITY;

function startOfQuarterUTC(date: Date): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const quarterStartMonth = Math.floor(month / 3) * 3;
  return new Date(Date.UTC(year, quarterStartMonth, 1, 0, 0, 0, 0));
}

function normalizeMetadata(raw: Prisma.JsonValue | null | undefined): HandoffMetadataShape {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  return { ...(raw as Record<string, unknown>) };
}

function normalizeEntry(value: unknown, quarterIso: string): HandoffEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { windowStart: quarterIso, count: 0 };
  }

  const entry = value as Record<string, unknown>;
  const windowStart = typeof entry.windowStart === "string" ? entry.windowStart : quarterIso;
  const count = typeof entry.count === "number" && Number.isFinite(entry.count) ? entry.count : 0;

  const needsReset = new Date(windowStart).getTime() < new Date(quarterIso).getTime();

  return needsReset ? { windowStart: quarterIso, count: 0 } : { windowStart, count };
}

export function incrementHandoffMetadata(
  rawMetadata: Prisma.JsonValue | null | undefined,
  type: HandoffType,
  now: Date,
  limit: number = DEFAULT_LIMIT,
) {
  const metadata = normalizeMetadata(rawMetadata);
  const handoff = normalizeMetadata(metadata.handoff as Prisma.JsonValue | null | undefined);

  const quarterStart = startOfQuarterUTC(now);
  const quarterIso = quarterStart.toISOString();

  const entryKey = type;
  const existingEntry = normalizeEntry(handoff[entryKey], quarterIso);

  if (existingEntry.count >= limit) {
    return {
      allowed: false,
      metadata: rawMetadata as Prisma.InputJsonValue,
      currentCount: existingEntry.count,
      windowStart: existingEntry.windowStart,
    };
  }

  const nextEntry: HandoffEntry = {
    windowStart: quarterIso,
    count: existingEntry.count + 1,
  };

  handoff[entryKey] = nextEntry;
  metadata.handoff = handoff;

  return {
    allowed: true,
    metadata: metadata as Prisma.InputJsonValue,
    currentCount: nextEntry.count,
    windowStart: nextEntry.windowStart,
  };
}

export function peekHandoffCount(
  rawMetadata: Prisma.JsonValue | null | undefined,
  type: HandoffType,
  now: Date,
) {
  const metadata = normalizeMetadata(rawMetadata);
  const handoff = normalizeMetadata(metadata.handoff as Prisma.JsonValue | null | undefined);
  const entry = normalizeEntry(handoff[type], startOfQuarterUTC(now).toISOString());
  return entry.count;
}
