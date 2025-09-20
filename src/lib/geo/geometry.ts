/**
 * Geometry operations and validation utilities
 */

import * as turf from "@turf/turf";
import { unkinkPolygon } from "@turf/unkink-polygon";
import type { GeoJSON, Feature, Point } from "geojson";

/**
 * Safely rewind a feature to correct winding order
 */
export function rewindSafe<T extends GeoJSON.Feature>(feature: T): T {
  try {
    return turf.rewind(feature, { reverse: false }) as T;
  } catch (error) {
    console.warn("Rewind failed, returning original:", error);
    return feature;
  }
}

/**
 * Safely unkink self-intersecting polygons
 */
export function unkinkSafe<T extends GeoJSON.Feature>(feature: T): T[] {
  try {
    const unkinked = unkinkPolygon(feature as any);
    return unkinked.features as T[];
  } catch (error) {
    console.warn("Unkink failed, returning original:", error);
    return [feature];
  }
}

/**
 * Latitude-aware geometry simplification
 */
export function simplifyMeters<
  T extends GeoJSON.Feature | GeoJSON.FeatureCollection,
>(geometry: T, meters: number): T {
  try {
    // Calculate centroid to get latitude for proper conversion
    let centroid: Feature<Point>;
    if (geometry.type === "FeatureCollection") {
      // For feature collections, use the first feature's centroid
      if (geometry.features.length > 0) {
        centroid = turf.centroid(geometry.features[0] as any);
      } else {
        // Fallback to US center
        centroid = turf.point([-98.5795, 39.8283]);
      }
    } else {
      centroid = turf.centroid(geometry as any);
    }

    const [, lat] = centroid.geometry.coordinates;
    const latRadians = (lat * Math.PI) / 180;

    // More accurate conversion: meters to degrees accounting for latitude
    // Base conversion: 1 degree ≈ 111,320 meters at equator
    // Adjust for latitude: cos(lat) scales the east-west distance
    const metersPerDegree = 111320 * Math.cos(latRadians);

    // Convert meters to degrees, with bounds to prevent extreme values
    let toleranceDegrees = meters / metersPerDegree;
    toleranceDegrees = Math.max(1e-6, Math.min(toleranceDegrees, 0.01));

    return turf.simplify(geometry, {
      tolerance: toleranceDegrees,
      highQuality: false,
    });
  } catch (error) {
    console.warn("Simplify failed, returning original:", error);
    return geometry;
  }
}

/**
 * Fast disjoint check with fallback to bbox logic
 */
export function fastDisjoint(a: GeoJSON.Feature, b: GeoJSON.Feature): boolean {
  try {
    return turf.booleanDisjoint(a, b);
  } catch (error) {
    // Fallback to bbox check
    try {
      const bboxA = turf.bbox(a);
      const bboxB = turf.bbox(b);

      return !(
        bboxA[2] > bboxB[0] && // a.right > b.left
        bboxA[0] < bboxB[2] && // a.left < b.right
        bboxA[3] > bboxB[1] && // a.top > b.bottom
        bboxA[1] < bboxB[3] // a.bottom < b.top
      );
    } catch (bboxError) {
      console.warn("Both disjoint check and bbox fallback failed:", bboxError);
      return false; // Assume they might intersect if we can't determine
    }
  }
}

/**
 * Validate and clean polygon geometry
 */
export function validateAndClean(polygon: GeoJSON.Feature): GeoJSON.Feature {
  try {
    return turf.cleanCoords(polygon);
  } catch (error) {
    console.warn("Geometry cleaning failed:", error);
    return polygon;
  }
}

/**
 * Check if geometries intersect with proper error handling
 */
export function safeIntersects(
  a: GeoJSON.Feature,
  b: GeoJSON.Feature,
): boolean {
  try {
    // First try bbox check for performance
    const bboxA = turf.bbox(a);
    const bboxB = turf.bbox(b);

    const bboxIntersects = !(
      bboxA[2] < bboxB[0] ||
      bboxA[0] > bboxB[2] ||
      bboxA[3] < bboxB[1] ||
      bboxA[1] > bboxB[3]
    );

    if (!bboxIntersects) {
      return false;
    }

    // If bboxes intersect, check actual geometry
    return turf.booleanIntersects(a, b);
  } catch (error) {
    // On error, assume they might intersect
    console.warn("Intersection check failed:", error);
    return true;
  }
}
