/**
 * Geographic utilities for ZIP code analysis
 *
 * Provides polygon clipping, scoring, and rendering optimization functions.
 */

import * as turf from "@turf/turf";

export type GeoPolygon = GeoJSON.Feature<
  GeoJSON.Polygon | GeoJSON.MultiPolygon
>;
export type GeoFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Polygon | GeoJSON.MultiPolygon
>;

export interface ClippedZcta {
  feature: GeoPolygon;
  zip: string;
  clipArea: number;
  fullArea: number;
  overlapRatio: number;
  centroidInside: boolean;
  keep: boolean;
}

export interface ZipCoverage {
  zip: string;
  overlapRatio: number;
  centroidInside: boolean;
  zctaAreaSqm: number;
  overlapAreaSqm: number;
}

/**
 * Clip ZCTA polygons to place boundary and calculate areas
 */
export function clipZctasToPlace(
  zctaFC: GeoFeatureCollection,
  place: GeoPolygon,
): ClippedZcta[] {
  const results: ClippedZcta[] = [];

  for (const zctaFeature of zctaFC.features) {
    try {
      // Get ZIP code from feature properties
      const zip = (
        zctaFeature.properties?.ZCTA5CE20 ||
        zctaFeature.properties?.ZCTA5 ||
        zctaFeature.properties?.GEOID ||
        zctaFeature.properties?.zip ||
        ""
      )
        .toString()
        .trim();

      if (!zip || zip.length !== 5) {
        console.warn(
          `Invalid ZIP code in feature: ${JSON.stringify(zctaFeature.properties)}`,
        );
        continue;
      }

      // Calculate full ZCTA area
      const fullArea = turf.area(zctaFeature);

      // Check if centroid is inside place
      const centroid = turf.centroid(zctaFeature);
      const centroidInside = turf.booleanPointInPolygon(centroid, place);

      // Clip ZCTA to place boundary
      let clippedFeature: GeoPolygon;
      let clipArea = 0;

      try {
        // Clean geometries first to ensure they're valid
        const cleanZcta = turf.cleanCoords(zctaFeature);
        const cleanPlace = turf.cleanCoords(place);

        // First check if ZCTA intersects with place using bounding boxes
        const zctaBbox = turf.bbox(cleanZcta);
        const placeBbox = turf.bbox(cleanPlace);

        // Quick bbox intersection check
        const bboxIntersects = !(
          zctaBbox[2] < placeBbox[0] || // zcta right < place left
          zctaBbox[0] > placeBbox[2] || // zcta left > place right
          zctaBbox[3] < placeBbox[1] || // zcta top < place bottom
          zctaBbox[1] > placeBbox[3] // zcta bottom > place top
        );

        if (!bboxIntersects) {
          // Skip silently if bounding boxes don't intersect
          continue;
        }

        // Check if geometries actually intersect using booleanIntersects
        let geometriesIntersect = false;
        try {
          geometriesIntersect = turf.booleanIntersects(
            cleanZcta as any,
            cleanPlace as any,
          );
        } catch {
          // Fallback to bbox overlap if booleanIntersects fails
          geometriesIntersect = bboxIntersects;
        }

        if (!geometriesIntersect) {
          console.log(`No geometric intersection for ZIP ${zip}, skipping`);
          continue;
        }

        // Try intersection to get clipped area
        try {
          // First try turf.intersect only when we have validated intersection
          const intersection = turf.intersect(
            cleanZcta as any,
            cleanPlace as any,
          );
          if (intersection && turf.area(intersection) > 0) {
            clippedFeature = intersection as GeoPolygon;
            clipArea = turf.area(clippedFeature);
          } else {
            // Intersection returned empty or null, use original ZCTA as approximation
            clippedFeature = cleanZcta;
            clipArea = turf.area(cleanZcta);
          }
        } catch (intersectError) {
          // Suppress noisy per-ZIP errors; fall back to original ZCTA
          // Fallback to original ZCTA if intersection fails
          clippedFeature = cleanZcta;
          clipArea = turf.area(cleanZcta);
        }
      } catch (error) {
        console.warn(`Geometry processing failed for ZIP ${zip}:`, error);
        continue;
      }

      // Add ZIP property to clipped feature
      clippedFeature.properties = {
        ...clippedFeature.properties,
        zip: zip,
      };

      const overlapRatio = fullArea > 0 ? clipArea / fullArea : 0;

      results.push({
        feature: clippedFeature,
        zip,
        clipArea,
        fullArea,
        overlapRatio,
        centroidInside,
        keep: false, // Will be determined by scoring function
      });
    } catch (error) {
      console.warn(`Error processing ZCTA feature:`, error);
      continue;
    }
  }

  return results;
}

/**
 * Score clipped ZCTAs and determine which ones to keep
 */
export function scoreZctas(clips: ClippedZcta[]): ClippedZcta[] {
  const AREA_THRESHOLD = Number(process.env.ZIP_AREA_THRESHOLD ?? "0.25");

  return clips
    .map((clip) => ({
      ...clip,
      keep: clip.overlapRatio > 0, // Select all clipped ZCTAs with any overlap
    }))
    .filter((clip) => clip.keep);
}

/**
 * Convert clipped ZCTAs to ZipCoverage format for API responses
 */
export function clipsToCoverage(clips: ClippedZcta[]): ZipCoverage[] {
  return clips.map((clip) => ({
    zip: clip.zip,
    overlapRatio: Number(clip.overlapRatio.toFixed(6)),
    centroidInside: clip.centroidInside,
    zctaAreaSqm: Math.round(clip.fullArea),
    overlapAreaSqm: Math.round(clip.clipArea),
  }));
}

/**
 * Union multiple polygon features for efficient rendering
 */
export function unionFeatures(
  features: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>[],
): GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null {
  if (features.length === 0) {
    console.warn("No features to union");
    return null;
  }

  // Filter out invalid features first
  const validFeatures = features.filter((feature) => {
    return (
      feature &&
      feature.geometry &&
      (feature.geometry.type === "Polygon" ||
        feature.geometry.type === "MultiPolygon") &&
      feature.geometry.coordinates &&
      feature.geometry.coordinates.length > 0
    );
  });

  if (validFeatures.length === 0) {
    console.warn("No valid features to union after filtering");
    return null;
  }

  try {
    if (validFeatures.length === 1) {
      // No need to union a single feature
      return validFeatures[0];
    }

    let union = validFeatures[0] as GeoPolygon;

    for (let i = 1; i < validFeatures.length; i++) {
      try {
        const nextUnion = turf.union(union as any, validFeatures[i] as any);
        if (nextUnion && nextUnion.geometry && nextUnion.geometry.coordinates) {
          union = nextUnion as GeoPolygon;
        } else {
          console.warn(
            `Union returned invalid result for feature ${i}, skipping`,
          );
        }
      } catch (unionError) {
        console.warn(
          `Union failed for feature ${i}, skipping:`,
          unionError instanceof Error ? unionError.message : unionError,
        );
        // Continue with the current union, don't break the whole operation
      }
    }

    return union;
  } catch (error) {
    console.warn(
      "Union operation failed, returning first valid feature as fallback:",
      error instanceof Error ? error.message : error,
    );
    // Return the first valid feature as fallback if union fails
    return validFeatures[0] || null;
  }
}

/**
 * Simplify geometries for map rendering performance
 */
export function simplifyForRender(
  input: GeoPolygon | GeoFeatureCollection,
  toleranceMeters: number = 5,
): GeoPolygon | GeoFeatureCollection {
  if (input.type === "FeatureCollection") {
    return {
      ...input,
      features: input.features.map((feature) =>
        simplifyFeature(feature, toleranceMeters),
      ),
    };
  } else {
    return simplifyFeature(input, toleranceMeters);
  }
}

function simplifyFeature(
  feature: GeoPolygon,
  toleranceMeters: number,
): GeoPolygon {
  try {
    // Convert tolerance from meters to degrees (approximate)
    const toleranceDegrees = toleranceMeters / 111320; // Rough conversion

    const simplified = turf.simplify(feature, {
      tolerance: toleranceDegrees,
      highQuality: false,
    });

    return simplified as GeoPolygon;
  } catch (error) {
    console.warn("Simplification failed, returning original:", error);
    return feature;
  }
}

/**
 * Calculate coverage statistics for a set of clipped ZCTAs
 */
export function calculateCoverageStats(
  place: GeoPolygon,
  clips: ClippedZcta[],
): {
  placeAreaSqm: number;
  clipsAreaSqm: number;
  ratio: number;
  coveragePercent: number;
} {
  let placeArea = 0;
  try {
    // Validate geometry before calculating area
    if (
      place &&
      place.geometry &&
      (place.geometry.type === "Polygon" ||
        place.geometry.type === "MultiPolygon")
    ) {
      placeArea = turf.area(place);
    } else {
      console.warn(
        "Invalid place geometry for area calculation, using fallback",
      );
      placeArea = 1000000; // Fallback area in square meters
    }
  } catch (error) {
    console.warn("Failed to calculate place area:", error);
    placeArea = 1000000; // Fallback area
  }

  const clipsArea = clips.reduce((sum, clip) => sum + clip.clipArea, 0);

  return {
    placeAreaSqm: Math.round(placeArea),
    clipsAreaSqm: Math.round(clipsArea),
    ratio: Number((clipsArea / placeArea).toFixed(4)),
    coveragePercent: Number(((clipsArea / placeArea) * 100).toFixed(2)),
  };
}

/**
 * Validate and repair polygon geometries
 */
export function validateAndRepairPolygon(polygon: GeoPolygon): GeoPolygon {
  try {
    // Clean coordinates and fix winding
    let cleaned = turf.cleanCoords(polygon);

    // Ensure proper winding (counter-clockwise for exterior rings)
    if (cleaned.geometry.type === "Polygon") {
      cleaned = turf.rewind(cleaned, { reverse: false });
    } else if (cleaned.geometry.type === "MultiPolygon") {
      // Rewind each polygon in the multipolygon
      cleaned.geometry.coordinates = cleaned.geometry.coordinates.map(
        (polyCoords: any) => {
          return [polyCoords[0].reverse(), ...polyCoords.slice(1)];
        },
      );
    }

    return cleaned as GeoPolygon;
  } catch (error) {
    console.warn("Geometry validation/repair failed:", error);
    return polygon;
  }
}

/**
 * Check if a point is within any of the provided polygons
 */
export function pointInPolygons(
  point: GeoJSON.Feature<GeoJSON.Point>,
  polygons: GeoPolygon[],
): boolean {
  return polygons.some((polygon) => {
    try {
      return turf.booleanPointInPolygon(point, polygon);
    } catch (error) {
      return false;
    }
  });
}

/**
 * Get bounding box that encompasses all features
 */
export function getCombinedBbox(
  features: GeoPolygon[],
): [number, number, number, number] | null {
  if (features.length === 0) return null;

  try {
    const bboxes = features.map(
      (f) => turf.bbox(f) as [number, number, number, number],
    );
    const combinedBbox = turf.bbox({
      type: "FeatureCollection",
      features: bboxes.map((bb) => turf.bboxPolygon(bb)),
    }) as [number, number, number, number];
    return combinedBbox;
  } catch (error) {
    console.warn("Failed to calculate combined bbox:", error);
    return null;
  }
}
