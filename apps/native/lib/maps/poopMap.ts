const MS_PER_DAY = 1000 * 60 * 60 * 24;

export const DEFAULT_ACCURACY_METERS = 5;
export const GOOD_ACCURACY_METERS = 5;
export const LOW_CONFIDENCE_THRESHOLD_METERS = 8;
export const MAX_VISUAL_ACCURACY_METERS = 12;

export const clampNumber = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const getAccuracyMeters = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return DEFAULT_ACCURACY_METERS;
  }
  return clampNumber(value, 2, MAX_VISUAL_ACCURACY_METERS);
};

export const getAgeDays = (capturedAt: string) => {
  const timestamp = Date.parse(capturedAt);
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, (Date.now() - timestamp) / MS_PER_DAY);
};

export const getDecayWeight = (capturedAt: string) => {
  const ageDays = getAgeDays(capturedAt);
  if (ageDays <= 2) return 1;
  if (ageDays <= 7) {
    return clampNumber(1 - (ageDays - 2) * 0.12, 0.4, 1);
  }
  if (ageDays <= 30) {
    return clampNumber(0.4 - (ageDays - 7) * 0.013, 0.1, 0.4);
  }
  return 0.08;
};

export const getAccuracyWeight = (accuracyMeters: number) => {
  const safe = clampNumber(accuracyMeters, 2, MAX_VISUAL_ACCURACY_METERS);
  return 1 / (safe * safe);
};

export const getAccuracyFactor = (accuracyMeters: number) => {
  const ratio =
    1 -
    (accuracyMeters - 2) / (MAX_VISUAL_ACCURACY_METERS - 2);
  return clampNumber(ratio, 0.2, 1);
};
