import type { BusinessConfig } from "@/lib/business-config";

const CARE_CREDITS_PER_DOLLAR = 1;

export function resolveRatingCareCredits(
  config?: BusinessConfig | null,
): number {
  const explicit = config?.operations?.ratingCareCredits;
  if (typeof explicit === "number" && Number.isFinite(explicit) && explicit > 0) {
    return Math.floor(explicit);
  }

  const cents = config?.operations?.ratingCreditCents ?? 0;
  if (typeof cents === "number" && Number.isFinite(cents) && cents > 0) {
    const credits = Math.round(cents / 100) * CARE_CREDITS_PER_DOLLAR;
    return Math.max(1, credits);
  }

  return 0;
}

export function extractCareCreditsAwarded(
  metadata: unknown,
  fallback = 0,
): number {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const value = (metadata as Record<string, unknown>).careCreditsAwarded;
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return fallback;
}
