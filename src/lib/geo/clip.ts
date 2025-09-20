/**
 * ZCTA clipping and intersection utilities
 */

import * as turf from "@turf/turf";
import type { GeoJSON } from "geojson";
import { normalizeZip } from "./normalize";
import {
  rewindSafe,
  unkinkSafe,
  validateAndClean,
  safeIntersects,
  fastDisjoint,
} from "./geometry";
import { buildIndex, queryCandidates } from "./rtree";
import { debug } from "../log";

export interface ClippedZcta {
  feature: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
  zip: string;
  clipArea: number;
  fullArea: number;
  overlapRatio: number;
  centroidInside: boolean;
}

/**
 * Clip ZCTAs to place boundary with R-tree pre-filtering and improved error handling
 */
export function clipZctasToPlace(
  zctaFC: GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
  place: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
): ClippedZcta[] {
  const results: ClippedZcta[] = [];

  debug("clip", `Starting clip operation with ${zctaFC.features.length} ZCTAs`);

  // Prepare place geometry - be less aggressive to preserve accuracy
  const placeClean = rewindSafe(place); // Just rewind for winding order
  const placeBbox = turf.bbox(placeClean);

  // Build R-tree index for ZCTAs
  const zctaIndex = buildIndex(zctaFC.features);
  const candidates = queryCandidates(zctaIndex, placeBbox);

  debug("clip", `R-tree found ${candidates.length} candidate ZCTAs`);

  for (const zctaFeature of candidates) {
    try {
      // Extract ZIP code
      const zip = normalizeZip(zctaFeature.properties);
      if (!zip || zip.length !== 5) {
        debug(
          "clip",
          `Invalid ZIP in feature: ${JSON.stringify(zctaFeature.properties)}`,
        );
        continue;
      }

      // Prepare ZCTA geometry - minimal processing to preserve accuracy
      const zctaClean = rewindSafe(zctaFeature); // Just rewind for winding order

      // Fast disjoint check
      if (fastDisjoint(placeClean, zctaClean)) {
        debug("clip", `ZIP ${zip} disjoint, skipping`);
        continue;
      }

      // Check intersection
      if (!safeIntersects(placeClean, zctaClean)) {
        debug("clip", `ZIP ${zip} doesn't intersect, skipping`);
        continue;
      }

      // Calculate areas
      const fullArea = turf.area(zctaClean);

      // Check centroid
      const centroid = turf.centroid(zctaClean);
      const centroidInside = turf.booleanPointInPolygon(
        centroid,
        placeClean as any,
      );

      // Attempt intersection
      let clippedFeature: GeoJSON.Feature<
        GeoJSON.Polygon | GeoJSON.MultiPolygon
      >;
      let clipArea = 0;

      try {
        const intersection = turf.intersect(
          placeClean as any,
          zctaClean as any,
        );

        if (intersection && turf.area(intersection) > 0) {
          // Just rewind the intersection result to ensure proper winding
          clippedFeature = rewindSafe(intersection) as GeoJSON.Feature<
            GeoJSON.Polygon | GeoJSON.MultiPolygon
          >;
          clipArea = turf.area(clippedFeature);
        } else {
          // Use original as approximation
          clippedFeature = zctaClean as GeoJSON.Feature<
            GeoJSON.Polygon | GeoJSON.MultiPolygon
          >;
          clipArea = fullArea;
        }
      } catch (intersectError) {
        debug(
          "clip",
          `Intersection failed for ZIP ${zip}, using original:`,
          intersectError,
        );
        clippedFeature = zctaClean as GeoJSON.Feature<
          GeoJSON.Polygon | GeoJSON.MultiPolygon
        >;
        clipArea = fullArea;
      }

      // Add ZIP property
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
      });
    } catch (error) {
      debug("clip", `Error processing ZCTA:`, error);
      continue;
    }
  }

  debug("clip", `Clipping complete: ${results.length} successful clips`);
  return results;
}
