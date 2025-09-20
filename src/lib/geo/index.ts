/**
 * Geo utilities package exports
 */

// Normalization utilities
export {
  normalizeZip,
  toStateAbbrUpper,
  toStateAbbrLower,
  toStateSlug,
  properCapitalize,
  normalizeCityName,
  ZCTA_PROP_KEYS,
} from "./normalize";

// Geometry utilities
export {
  rewindSafe,
  unkinkSafe,
  simplifyMeters,
  fastDisjoint,
  validateAndClean,
  safeIntersects,
} from "./geometry";

// R-tree indexing
export { buildIndex, queryCandidates, featureToBbox } from "./rtree";
export type { RTreeIndex } from "./rtree";

// Clipping utilities
export { clipZctasToPlace } from "./clip";
export type { ClippedZcta } from "./clip";

// Scoring utilities
export {
  scoreZctas,
  getAreaThreshold,
  calculateCoverageFromClips,
} from "./score";

// Coverage utilities
export {
  calculateCoverageStats,
  generateCoverageReport,
  validateCoverage,
} from "./coverage";
export type { CoverageStats } from "./coverage";
