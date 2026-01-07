import { Prisma } from "@prisma/client";

import {
  getPreferredTimeWindowStart,
  normalizePreferredTimeWindowSlug,
  resolvePreferredTimeWindowLabel,
  type PreferredTimeWindowSlug,
} from "@/lib/time-window";
import { constructZonedDate, convertUtcToZonedParts, SERVICE_TIME_ZONE } from "@/lib/timezone";
import { addDays, startOfDay } from "@/lib/dispatch/frequency";

type DelaySchedule = {
  scheduledDate: Date;
  windowSlug: PreferredTimeWindowSlug | null;
  windowLabel: string | null;
  usedAlternateWindow: boolean;
};

type DelayMetadata = {
  count: number;
  lastAt: string;
  lastReason: string;
  previousScheduledAt: string;
  previousWindowSlug?: string | null;
  previousWindowLabel?: string | null;
  windowOverride: boolean;
};

type MetadataShape = {
  marketplaceDelay?: Record<string, unknown>;
  [key: string]: unknown;
};

function toMetadata(raw: Prisma.JsonValue | null | undefined): MetadataShape {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  return { ...(raw as Record<string, unknown>) };
}

function inferWindowSlugFromTime(date: Date): PreferredTimeWindowSlug {
  const parts = convertUtcToZonedParts(date, SERVICE_TIME_ZONE);
  return parts.hour >= 12 ? "afternoon" : "morning";
}

export function resolveDelayedSchedule(options: {
  scheduledDate: Date;
  preferredWindowSlug?: string | null;
  now?: Date;
}): DelaySchedule {
  const now = options.now ?? new Date();
  const normalizedSlug =
    normalizePreferredTimeWindowSlug(options.preferredWindowSlug ?? null) ??
    inferWindowSlugFromTime(options.scheduledDate);

  const scheduledParts = convertUtcToZonedParts(options.scheduledDate, SERVICE_TIME_ZONE);
  const windowStart = getPreferredTimeWindowStart(normalizedSlug) ?? { hour: 9, minute: 0 };

  const nextDay = addDays(startOfDay(options.scheduledDate), 1);
  const nextDayParts = convertUtcToZonedParts(nextDay, SERVICE_TIME_ZONE);

  if (normalizedSlug === "morning") {
    const afternoonStart = getPreferredTimeWindowStart("afternoon") ?? { hour: 14, minute: 0 };
    const afternoonDate = constructZonedDate(
      scheduledParts.year,
      scheduledParts.month,
      scheduledParts.day,
      afternoonStart.hour,
      afternoonStart.minute,
      0,
      0,
      SERVICE_TIME_ZONE,
    );

    if (afternoonDate.getTime() > now.getTime()) {
      return {
        scheduledDate: afternoonDate,
        windowSlug: "afternoon",
        windowLabel: resolvePreferredTimeWindowLabel("afternoon", null),
        usedAlternateWindow: true,
      };
    }

    const nextMorning = constructZonedDate(
      nextDayParts.year,
      nextDayParts.month,
      nextDayParts.day,
      windowStart.hour,
      windowStart.minute,
      0,
      0,
      SERVICE_TIME_ZONE,
    );

    return {
      scheduledDate: nextMorning,
      windowSlug: normalizedSlug,
      windowLabel: resolvePreferredTimeWindowLabel(normalizedSlug, null),
      usedAlternateWindow: false,
    };
  }

  const nextAfternoon = constructZonedDate(
    nextDayParts.year,
    nextDayParts.month,
    nextDayParts.day,
    windowStart.hour,
    windowStart.minute,
    0,
    0,
    SERVICE_TIME_ZONE,
  );

  return {
    scheduledDate: nextAfternoon,
    windowSlug: normalizedSlug,
    windowLabel: resolvePreferredTimeWindowLabel(normalizedSlug, null),
    usedAlternateWindow: false,
  };
}

export function applyMarketplaceDelayMetadata(options: {
  raw: Prisma.JsonValue | null | undefined;
  now: Date;
  reason: string;
  previousScheduledAt: Date;
  previousWindowSlug?: string | null;
  previousWindowLabel?: string | null;
}): Prisma.InputJsonValue {
  const metadata = toMetadata(options.raw);
  const prior =
    metadata.marketplaceDelay && typeof metadata.marketplaceDelay === "object"
      ? (metadata.marketplaceDelay as Record<string, unknown>)
      : null;
  const previousCount =
    prior && typeof prior.count === "number" && Number.isFinite(prior.count)
      ? prior.count
      : 0;

  const nextDelay: DelayMetadata = {
    count: previousCount + 1,
    lastAt: options.now.toISOString(),
    lastReason: options.reason,
    previousScheduledAt: options.previousScheduledAt.toISOString(),
    previousWindowSlug: options.previousWindowSlug ?? null,
    previousWindowLabel: options.previousWindowLabel ?? null,
    windowOverride: true,
  };

  metadata.marketplaceDelay = nextDelay as Record<string, unknown>;

  return metadata as Prisma.InputJsonValue;
}
