/**
 * ZCTA scoring and filtering utilities
 */

import { ClippedZcta } from "./clip";
import { debug } from "../log";

/**
 * Default area threshold for ZCTA inclusion - reduced for better accuracy
 */
const DEFAULT_AREA_THRESHOLD = 0.1; // Reduced from 0.25 to 0.1 for more inclusive ZIP coverage

/**
 * Score and filter clipped ZCTAs based on overlap and centroid criteria
 */
export function scoreZctas(
  clips: ClippedZcta[],
  threshold: number = DEFAULT_AREA_THRESHOLD,
  biasCentroid = true,
): ClippedZcta[] {
  debug(
    "score",
    `Scoring ${clips.length} ZCTAs with threshold ${threshold}, centroid bias: ${biasCentroid}`,
  );

  const scored = clips.map((clip) => {
    const shouldKeep =
      clip.overlapRatio >= threshold || (biasCentroid && clip.centroidInside);

    if (shouldKeep) {
      debug(
        "score",
        `Keeping ZIP ${clip.zip}: ratio=${clip.overlapRatio.toFixed(4)}, centroidInside=${clip.centroidInside}`,
      );
    }

    return {
      ...clip,
      keep: shouldKeep,
    };
  });

  const kept = scored.filter((clip) => clip.keep);
  debug("score", `Scored complete: ${kept.length}/${clips.length} ZCTAs kept`);

  return kept;
}

/**
 * Get area threshold from environment or use default
 */
export function getAreaThreshold(): number {
  const envThreshold = process.env.ZIP_AREA_THRESHOLD;
  if (envThreshold) {
    const parsed = parseFloat(envThreshold);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
      return parsed;
    }
    console.warn(
      `Invalid ZIP_AREA_THRESHOLD: ${envThreshold}, using default ${DEFAULT_AREA_THRESHOLD}`,
    );
  }
  return DEFAULT_AREA_THRESHOLD;
}

/**
 * Calculate coverage statistics from scored ZCTAs
 */
export function calculateCoverageFromClips(
  placeArea: number,
  clips: ClippedZcta[],
): {
  clipsAreaSqm: number;
  ratio: number;
  coveragePercent: number;
  zipsByStatus: {
    highOverlap: string[];
    centroidOnly: string[];
    lowOverlap: string[];
  };
} {
  const clipsArea = clips.reduce((sum, clip) => sum + clip.clipArea, 0);

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

  return {
    clipsAreaSqm: Math.round(clipsArea),
    ratio: Number((clipsArea / placeArea).toFixed(4)),
    coveragePercent: Number(((clipsArea / placeArea) * 100).toFixed(2)),
    zipsByStatus,
  };
}
