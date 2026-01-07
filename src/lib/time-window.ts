export const SERVICE_TIME_ZONE = "America/Chicago" as const;

export type PreferredTimeWindowSlug = "morning" | "afternoon";

const FLEXIBLE_RANGE = "8:00am – 4:00pm";
const FLEXIBLE_LABEL = `Flexible (${FLEXIBLE_RANGE})`;

type PreferredTimeWindowConfig = {
  slug: PreferredTimeWindowSlug;
  label: string;
  shortLabel: string;
  range: string;
  startHour: number;
  startMinute: number;
};

export const PREFERRED_TIME_WINDOWS: Record<PreferredTimeWindowSlug, PreferredTimeWindowConfig> = {
  morning: {
    slug: "morning" as const,
    label: "Morning (8:00am – 12:00pm)",
    shortLabel: "Morning",
    range: "8:00am – 12:00pm",
    startHour: 9,
    startMinute: 0,
  },
  afternoon: {
    slug: "afternoon" as const,
    label: "Afternoon (12:00pm – 4:00pm)",
    shortLabel: "Afternoon",
    range: "12:00pm – 4:00pm",
    startHour: 14,
    startMinute: 0,
  },
};

type SupportedDateInput = Date | string | number | null | undefined;

function isFlexibleLabel(value?: string | null): boolean {
  if (!value) return false;
  const normalized = value.toString().trim().toLowerCase();
  return normalized.includes("flex") || normalized.includes("anytime");
}

export function normalizePreferredTimeWindowSlug(value?: string | null): PreferredTimeWindowSlug | null {
  if (!value) return null;
  const normalized = value.toString().trim().toLowerCase();
  return normalized in PREFERRED_TIME_WINDOWS
    ? (normalized as PreferredTimeWindowSlug)
    : null;
}

function findSlugByLabel(value?: string | null): PreferredTimeWindowSlug | null {
  if (!value) return null;
  const normalized = value.toString().trim().toLowerCase();
  if (!normalized) return null;
  const match = Object.values(PREFERRED_TIME_WINDOWS).find((config) => {
    const label = config.label.toLowerCase();
    const shortLabel = config.shortLabel.toLowerCase();
    const range = config.range.toLowerCase();
    return (
      label === normalized ||
      shortLabel === normalized ||
      range === normalized ||
      normalized === `${config.shortLabel.toLowerCase()} window` ||
      normalized === `${config.label.toLowerCase()} window`
    );
  });
  return match?.slug ?? null;
}

export function resolvePreferredTimeWindowLabel(
  slug?: string | null,
  fallback?: string | null,
): string | null {
  const normalizedSlug = normalizePreferredTimeWindowSlug(slug);
  if (normalizedSlug) {
    return PREFERRED_TIME_WINDOWS[normalizedSlug].label;
  }
  if (isFlexibleLabel(fallback)) {
    return FLEXIBLE_LABEL;
  }
  return fallback ?? null;
}

export function resolvePreferredTimeWindowShortLabel(
  slug?: string | null,
  fallback?: string | null,
): string | null {
  const normalizedSlug = normalizePreferredTimeWindowSlug(slug);
  if (normalizedSlug) {
    return PREFERRED_TIME_WINDOWS[normalizedSlug].label;
  }
  if (isFlexibleLabel(fallback)) {
    return FLEXIBLE_LABEL;
  }
  return fallback ?? null;
}

export function resolvePreferredTimeWindowRange(
  slug?: string | null,
  fallback?: string | null,
): string | null {
  const normalizedSlug = normalizePreferredTimeWindowSlug(slug);
  if (normalizedSlug) {
    return PREFERRED_TIME_WINDOWS[normalizedSlug].range;
  }
  if (isFlexibleLabel(fallback)) {
    return FLEXIBLE_RANGE;
  }
  return fallback ?? null;
}

export function getPreferredTimeWindowStart(
  slug?: string | null,
): { hour: number; minute: number } | null {
  const normalizedSlug = normalizePreferredTimeWindowSlug(slug);
  if (normalizedSlug) {
    const config = PREFERRED_TIME_WINDOWS[normalizedSlug];
    return { hour: config.startHour, minute: config.startMinute };
  }
  return null;
}

function toDate(input: SupportedDateInput): Date | null {
  if (!input && input !== 0) return null;
  const value = input instanceof Date ? input : new Date(input as string | number);
  return Number.isNaN(value.getTime()) ? null : value;
}

export function formatServiceDate(
  input: SupportedDateInput,
  options: Intl.DateTimeFormatOptions = {
    month: "long",
    day: "numeric",
    year: "numeric",
  },
): string | null {
  const date = toDate(input);
  if (!date) return null;
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: SERVICE_TIME_ZONE,
  }).format(date);
}

export function formatServiceTime(
  input: SupportedDateInput,
  options: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
  },
): string | null {
  const date = toDate(input);
  if (!date) return null;
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: SERVICE_TIME_ZONE,
  }).format(date);
}

export const preferredTimeWindowOptions = (Object.values(
  PREFERRED_TIME_WINDOWS,
) satisfies Array<(typeof PREFERRED_TIME_WINDOWS)[PreferredTimeWindowSlug]>);

export function extractPreferredTimeWindow(
  metadata: unknown,
  fallback?: string | null,
): {
  slug: PreferredTimeWindowSlug | null;
  label: string | null;
} {
  if (!metadata || typeof metadata !== "object") {
    const fallbackSlug = findSlugByLabel(fallback ?? undefined);
    return {
      slug: fallbackSlug,
      label: resolvePreferredTimeWindowLabel(fallbackSlug, fallback ?? null),
    };
  }

  const record = metadata as Record<string, unknown>;
  const slugCandidate = (() => {
    const possibleKeys = [
      "preferredTimeWindowSlug",
      "preferredTimeSlug",
      "timeWindowSlug",
      "preferredWindowSlug",
    ];
    for (const key of possibleKeys) {
      const value = record[key];
      if (typeof value === "string") {
        const normalized = normalizePreferredTimeWindowSlug(value);
        if (normalized) return normalized;
      }
    }
    return null;
  })();

  const labelCandidate = (() => {
    const possibleKeys = [
      "preferredTimeWindow",
      "preferredTime",
      "preferredWindow",
      "timeWindow",
    ];
    for (const key of possibleKeys) {
      const value = record[key];
      if (typeof value === "string" && value.trim().length > 0) {
        return value;
      }
    }
    return fallback ?? null;
  })();

  const slugFromLabel = slugCandidate ?? findSlugByLabel(labelCandidate ?? undefined);
  const label = resolvePreferredTimeWindowLabel(slugFromLabel, labelCandidate);
  return {
    slug: slugFromLabel,
    label,
  };
}
