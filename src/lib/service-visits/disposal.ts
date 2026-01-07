export type DisposalMode = "standard" | "haul-away" | "compost";

const HAUL_AWAY_MODES = new Set(["takeaway", "haul-away", "haulaway"]);
const COMPOST_MODES = new Set(["compost", "compost-routing", "zero-waste"]);
const LEGACY_COMPOST_PATTERN = /^\d{1,3}%?$/;

export const resolveDisposalMode = (raw?: string | null): DisposalMode => {
  const normalized = raw?.toLowerCase().trim();
  if (!normalized) return "standard";
  if (HAUL_AWAY_MODES.has(normalized)) return "haul-away";
  if (COMPOST_MODES.has(normalized)) return "compost";
  if (LEGACY_COMPOST_PATTERN.test(normalized)) return "compost";
  if (normalized.startsWith("eco") && /\d/.test(normalized)) return "compost";
  return "standard";
};

export const isDisposalProofRequired = (raw?: string | null): boolean =>
  resolveDisposalMode(raw) !== "standard";
