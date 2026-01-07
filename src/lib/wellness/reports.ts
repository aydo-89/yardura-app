export const WELLNESS_STOOL_COLORS = [
  "NORMAL",
  "YELLOW",
  "RED",
  "BLACK",
  "GREEN",
  "PALE",
  "ORANGE",
] as const;

export const WELLNESS_STOOL_CONSISTENCY = [
  "NORMAL",
  "SOFT",
  "WATERY",
  "HARD",
  "MUCUS",
  "GREASY",
] as const;

export const WELLNESS_STOOL_CONTENT = [
  "NORMAL",
  "BLOOD",
  "WORMS",
  "UNDIGESTED",
  "FOREIGN",
] as const;

export const WELLNESS_SYMPTOMS = [
  "VOMITING",
  "LETHARGY",
  "APPETITE_LOSS",
  "APPETITE_INCREASE",
  "THIRST_INCREASE",
  "THIRST_DECREASE",
  "WEIGHT_LOSS",
  "WEIGHT_GAIN",
  "COUGHING",
  "SNEEZING",
  "ITCHING",
  "SKIN_IRRITATION",
  "BEHAVIOR_CHANGE",
  "ACCIDENTS",
  "OTHER",
] as const;

export const WELLNESS_APPETITE = ["NORMAL", "LOW", "HIGH"] as const;
export const WELLNESS_HYDRATION = ["NORMAL", "LOW", "HIGH"] as const;
export const WELLNESS_ENERGY = ["NORMAL", "LOW", "HIGH"] as const;
export const WELLNESS_REPORT_SCOPE = ["HOUSEHOLD", "DOG"] as const;
export const WELLNESS_ATTRIBUTION = [
  "HOUSEHOLD",
  "OWNER_GUESS",
  "OWNER_CONFIRMED",
  "DEVICE_CONFIRMED",
] as const;
export const WELLNESS_DIAGNOSIS_SOURCE = [
  "OWNER_REPORTED",
  "VET_CONFIRMED",
] as const;

export type WellnessStoolColor = (typeof WELLNESS_STOOL_COLORS)[number];
export type WellnessStoolConsistency = (typeof WELLNESS_STOOL_CONSISTENCY)[number];
export type WellnessStoolContent = (typeof WELLNESS_STOOL_CONTENT)[number];
export type WellnessSymptomTag = (typeof WELLNESS_SYMPTOMS)[number];
export type WellnessAppetite = (typeof WELLNESS_APPETITE)[number];
export type WellnessHydration = (typeof WELLNESS_HYDRATION)[number];
export type WellnessEnergy = (typeof WELLNESS_ENERGY)[number];
export type WellnessReportScope = (typeof WELLNESS_REPORT_SCOPE)[number];
export type WellnessAttribution = (typeof WELLNESS_ATTRIBUTION)[number];
export type WellnessDiagnosisSource = (typeof WELLNESS_DIAGNOSIS_SOURCE)[number];

export type WellnessWeekWindow = {
  weekStart: Date;
  weekEnd: Date;
};

export const getWeekWindow = (date: Date): WellnessWeekWindow => {
  const base = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  ));
  const day = base.getUTCDay();
  const diff = base.getUTCDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(Date.UTC(
    base.getUTCFullYear(),
    base.getUTCMonth(),
    diff,
    0,
    0,
    0,
    0,
  ));
  const weekEnd = new Date(Date.UTC(
    weekStart.getUTCFullYear(),
    weekStart.getUTCMonth(),
    weekStart.getUTCDate() + 6,
    23,
    59,
    59,
    999,
  ));

  return { weekStart, weekEnd };
};
