/**
 * Coverage statistics and reporting utilities
 */

import * as turf from "@turf/turf";
import type { GeoJSON } from "geojson";
import { rewindSafe, unkinkSafe, validateAndClean } from "./geometry";
import { ClippedZcta } from "./clip";
import { debug } from "../log";

export interface CoverageStats {
  placeAreaSqm: number;
  clipsAreaSqm: number;
  ratio: number;
  coveragePercent: number;
  zipsByStatus: {
    highOverlap: string[];
    centroidOnly: string[];
    lowOverlap: string[];
  };
}

/**
 * Calculate comprehensive coverage statistics
 */
export function calculateCoverageStats(
  place: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
  clips: ClippedZcta[],
): CoverageStats {
  debug(
    "coverage",
    `Calculating coverage for place with ${clips.length} clips`,
  );

  // Validate and prepare place geometry
  let placeArea = 0;
  try {
    const placeRewound = rewindSafe(place);
    const placeUnkinked = unkinkSafe(placeRewound);
    const placeClean = validateAndClean(placeUnkinked[0]); // Use first piece

    placeArea = turf.area(placeClean);

    if (placeArea <= 0) {
      debug("coverage", "Invalid place area, using fallback");
      placeArea = 1000000; // 1 sq km fallback
    }
  } catch (error) {
    debug("coverage", "Failed to calculate place area:", error);
    placeArea = 1000000; // Fallback
  }

  const clipsArea = clips.reduce((sum, clip) => sum + clip.clipArea, 0);

  // Categorize ZIPs by coverage type
  const zipsByStatus = {
    highOverlap: [] as string[],
    centroidOnly: [] as string[],
    lowOverlap: [] as string[],
  };

  for (const clip of clips) {
    if (clip.overlapRatio >= 0.5) {
      zipsByStatus.highOverlap.push(clip.zip);
    } else if (clip.centroidInside && clip.overlapRatio < 0.25) {
      zipsByStatus.centroidOnly.push(clip.zip);
    } else {
      zipsByStatus.lowOverlap.push(clip.zip);
    }
  }

  const stats: CoverageStats = {
    placeAreaSqm: Math.round(placeArea),
    clipsAreaSqm: Math.round(clipsArea),
    ratio: Number((clipsArea / placeArea).toFixed(4)),
    coveragePercent: Number(((clipsArea / placeArea) * 100).toFixed(2)),
    zipsByStatus,
  };

  debug(
    "coverage",
    `Coverage calculated: ${stats.coveragePercent}% (${stats.clipsAreaSqm}/${stats.placeAreaSqm} sqm)`,
  );

  return stats;
}

/**
 * Generate coverage report for logging/debugging
 */
export function generateCoverageReport(stats: CoverageStats): string {
  return `
Coverage Report:
- Place Area: ${stats.placeAreaSqm.toLocaleString()} sqm
- Covered Area: ${stats.clipsAreaSqm.toLocaleString()} sqm
- Coverage Ratio: ${stats.ratio}
- Coverage Percent: ${stats.coveragePercent}%
- High Overlap ZIPs: ${stats.zipsByStatus.highOverlap.length}
- Centroid-only ZIPs: ${stats.zipsByStatus.centroidOnly.length}
- Low Overlap ZIPs: ${stats.zipsByStatus.lowOverlap.length}
  `.trim();
}

/**
 * Validate coverage meets minimum thresholds
 */
export function validateCoverage(
  stats: CoverageStats,
  minPercent = 10,
): boolean {
  const isValid = stats.coveragePercent >= minPercent;

  if (!isValid) {
    debug(
      "coverage",
      `Coverage below minimum threshold: ${stats.coveragePercent}% < ${minPercent}%`,
    );
  }

  return isValid;
}
