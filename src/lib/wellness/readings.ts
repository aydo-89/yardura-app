import type { DataReading } from "@/shared/wellness";

type MediaInput = {
  id: string;
  capturedAt: Date;
  analysisResult: Record<string, unknown> | null;
  stoolSampleId: string | null;
  stoolSampleView: string | null;
  assetType?: string | null;
  reviewStatus?: string | null;
};

type CaptureInput = {
  id: string;
  capturedAt: Date;
  analysisResult: Record<string, unknown> | null;
  dogName?: string | null;
  storagePath?: string | null;
};

type NormalizedResult = {
  color?: string;
  consistency?: string;
  content?: string;
  issues: string[];
  hasWellnessFlag: boolean;
};

const normalizeText = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const normalizeColor = (value: unknown): string | undefined => {
  const normalized = normalizeText(value);
  if (!normalized) return undefined;
  if (normalized === "normal") return "normal";
  if (normalized === "dark") return "black";
  if (normalized === "light") return "yellow";
  if (normalized === "mixed") return "yellow";
  if (normalized === "other") return undefined;
  return normalized;
};

const normalizeConsistency = (value: unknown, content: string): string | undefined => {
  const normalized = normalizeText(value);
  if (content === "mucus") {
    return "mucous";
  }
  if (!normalized) return undefined;
  if (normalized === "firm") return "normal";
  if (["soft", "loose", "watery"].includes(normalized)) return "soft";
  if (normalized === "other") return undefined;
  return normalized;
};

const normalizeContent = (value: unknown): string | undefined => {
  const normalized = normalizeText(value);
  if (!normalized) return undefined;
  if (normalized === "foreign material") return "foreign material";
  if (normalized === "other") return "other";
  return normalized;
};

const hasCustomerClear = (result: Record<string, unknown>): boolean => {
  const cleared = (result as Record<string, unknown>).customer_flag_cleared;
  const legacyCleared = (result as Record<string, unknown>).customer_cleared;
  return Boolean(cleared) || Boolean(legacyCleared);
};

const buildIssues = (
  result: Record<string, unknown>,
  options?: { reviewStatus?: string | null },
): NormalizedResult => {
  const issues = new Set<string>();
  const content = normalizeContent(result.content);
  const flagReason = normalizeText(result.flag_reason);
  const hasWellnessFlag = Boolean(result.wellness_flag);
  const needsReview = Boolean(result.needs_review);
  const cleared = hasCustomerClear(result) || options?.reviewStatus === "APPROVED";

  if (cleared) {
    return {
      color: needsReview ? undefined : normalizeColor(result.color),
      consistency: needsReview ? undefined : normalizeConsistency(result.consistency, content ?? ""),
      content,
      issues: [],
      hasWellnessFlag: false,
    };
  }

  if (content === "mucus") {
    issues.add("Mucous");
  }
  if (content === "blood") {
    issues.add("Blood detected");
  }
  if (content === "foreign material") {
    issues.add("Foreign material");
  }
  if (flagReason.includes("parasite") || flagReason.includes("worm")) {
    issues.add("Parasite risk");
  }
  if (hasWellnessFlag && issues.size === 0) {
    issues.add("Wellness alert");
  }
  if (needsReview) {
    issues.add("Unclear sample");
  }

  return {
    color: needsReview ? undefined : normalizeColor(result.color),
    consistency: needsReview ? undefined : normalizeConsistency(result.consistency, content ?? ""),
    content,
    issues: Array.from(issues),
    hasWellnessFlag,
  };
};

const colorSeverity: Record<string, number> = {
  normal: 0,
  yellow: 1,
  red: 2,
  black: 3,
};

const consistencySeverity: Record<string, number> = {
  normal: 0,
  soft: 1,
  dry: 1,
  mucous: 2,
  greasy: 2,
};

const contentSeverity: Record<string, number> = {
  typical: 0,
  other: 0,
  mucus: 1,
  "foreign material": 2,
  blood: 3,
};

export const buildWellnessReadingsFromMedia = (
  media: MediaInput[],
): DataReading[] => {
  const grouped = new Map<string, MediaInput[]>();

  media.forEach((item) => {
    if (item.assetType && item.assetType !== "INSIGHTSCOOP") {
      return;
    }
    if (!item.analysisResult || typeof item.analysisResult !== "object") {
      return;
    }
    const key = item.stoolSampleId ?? item.id;
    const existing = grouped.get(key) ?? [];
    existing.push(item);
    grouped.set(key, existing);
  });

  const readings: DataReading[] = [];

  grouped.forEach((items, key) => {
    let resolvedColor: string | undefined;
    let resolvedConsistency: string | undefined;
    let resolvedContent: string | undefined;
    let colorScore = -1;
    let consistencyScore = -1;
    let contentScore = -1;
    const issues = new Set<string>();
    let hasWellnessFlag = false;

    const capturedAt = items
      .map((item) => item.capturedAt)
      .sort((a, b) => a.getTime() - b.getTime())[0];

    items.forEach((item) => {
      const normalized = buildIssues(item.analysisResult as Record<string, unknown>, {
        reviewStatus: item.reviewStatus ?? null,
      });
      normalized.issues.forEach((issue) => issues.add(issue));
      hasWellnessFlag = hasWellnessFlag || normalized.hasWellnessFlag;

      if (normalized.color) {
        const score = colorSeverity[normalized.color] ?? 0;
        if (score > colorScore) {
          colorScore = score;
          resolvedColor = normalized.color;
        }
      }

      if (normalized.consistency) {
        const score = consistencySeverity[normalized.consistency] ?? 0;
        if (score > consistencyScore) {
          consistencyScore = score;
          resolvedConsistency = normalized.consistency;
        }
      }

      if (normalized.content) {
        const score = contentSeverity[normalized.content] ?? 0;
        if (score > contentScore) {
          contentScore = score;
          resolvedContent = normalized.content;
        }
      }
    });

    if (hasWellnessFlag && issues.size === 0) {
      issues.add("Wellness alert");
    }

    readings.push({
      id: key,
      timestamp: capturedAt.toISOString(),
      colors: { normal: 0, yellow: 0, red: 0, black: 0, total: 0 },
      consistency: { normal: 0, soft: 0, dry: 0, total: 0 },
      issues: Array.from(issues),
      color: resolvedColor,
      consistencyLabel: resolvedConsistency,
      contentLabel: resolvedContent,
      volume: 1,
      imageUrl: key,
      source: "PRO",
    });
  });

  return readings.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
};

export const buildWellnessReadingsFromCaptures = (
  captures: CaptureInput[],
): DataReading[] => {
  const readings: DataReading[] = [];

  captures.forEach((capture) => {
    if (!capture.analysisResult || typeof capture.analysisResult !== "object") {
      return;
    }

    const normalized = buildIssues(capture.analysisResult as Record<string, unknown>);
    const issues = normalized.issues.length > 0 ? normalized.issues : [];

    const hydrationScore =
      typeof (capture.analysisResult as Record<string, unknown>).hydration_score === "number"
        ? ((capture.analysisResult as Record<string, unknown>).hydration_score as number)
        : undefined;
    const firmnessScale =
      typeof (capture.analysisResult as Record<string, unknown>).firmness_scale === "number"
        ? ((capture.analysisResult as Record<string, unknown>).firmness_scale as number)
        : undefined;
    const indicatorRaw =
      typeof (capture.analysisResult as Record<string, unknown>).indicator === "string"
        ? ((capture.analysisResult as Record<string, unknown>).indicator as string)
        : undefined;
    const indicator =
      indicatorRaw === "watch" || indicatorRaw === "monitor" || indicatorRaw === "vet_now"
        ? indicatorRaw
        : undefined;
    const summary =
      typeof (capture.analysisResult as Record<string, unknown>).summary === "string"
        ? ((capture.analysisResult as Record<string, unknown>).summary as string)
        : undefined;
    const whatThisCouldMean =
      typeof (capture.analysisResult as Record<string, unknown>).what_this_could_mean === "string"
        ? ((capture.analysisResult as Record<string, unknown>).what_this_could_mean as string)
        : undefined;

    readings.push({
      id: capture.id,
      timestamp: capture.capturedAt.toISOString(),
      colors: { normal: 0, yellow: 0, red: 0, black: 0, total: 0 },
      consistency: { normal: 0, soft: 0, dry: 0, total: 0 },
      issues,
      color: normalized.color,
      consistencyLabel: normalized.consistency,
      contentLabel: normalized.content,
      volume: 1,
      imageUrl: capture.storagePath ?? capture.id,
      source: "OWNER",
      dogName: capture.dogName ?? undefined,
      hydrationScore,
      firmnessScale,
      indicator,
      summary,
      whatThisCouldMean,
    });
  });

  return readings.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
};
