type WellnessFlagResult = {
  wellness_flag?: boolean;
  flag_reason?: string | null;
};

type WellnessFlagMediaInput = {
  analysisResult?: unknown;
  reviewStatus?: string | null;
  visibilityState?: string | null;
};

type WellnessFlagOptions = {
  requireVisible?: boolean;
  treatApprovedAsCleared?: boolean;
};

function getWellnessFlagResult(analysisResult: unknown): WellnessFlagResult | null {
  if (!analysisResult || typeof analysisResult !== "object") {
    return null;
  }
  return analysisResult as WellnessFlagResult;
}

export function hasWellnessAnalysisFlag(analysisResult: unknown): boolean {
  const result = getWellnessFlagResult(analysisResult);
  if (!result) return false;
  const flagReason = typeof result.flag_reason === "string" ? result.flag_reason.trim() : "";
  return Boolean(result.wellness_flag) || Boolean(flagReason);
}

export function isWellnessFlaggedMedia(
  media: WellnessFlagMediaInput,
  options: WellnessFlagOptions = {},
): boolean {
  const { requireVisible = false, treatApprovedAsCleared = true } = options;
  if (requireVisible && media.visibilityState !== "VISIBLE") return false;
  if (!hasWellnessAnalysisFlag(media.analysisResult)) return false;
  if (treatApprovedAsCleared && media.reviewStatus === "APPROVED") return false;
  return true;
}
