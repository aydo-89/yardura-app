export const COLOR_OPTIONS = ["Normal", "Dark", "Light", "Mixed", "Other"] as const;
export const CONSISTENCY_OPTIONS = ["Firm", "Soft", "Loose", "Watery", "Other"] as const;
export const CONTENT_OPTIONS = [
  "Typical",
  "Mucus",
  "Blood",
  "Foreign material",
  "Other",
] as const;

export type ColorIndicator = (typeof COLOR_OPTIONS)[number];
export type ConsistencyIndicator = (typeof CONSISTENCY_OPTIONS)[number];
export type ContentIndicator = (typeof CONTENT_OPTIONS)[number];

export type MediaAnalysisResult = {
  color: ColorIndicator;
  consistency: ConsistencyIndicator;
  content: ContentIndicator;
  confidence: number;
  observations?: string | null;
  needs_review: boolean;
  wellness_flag: boolean;
  flag_reason?: string | null;
};
