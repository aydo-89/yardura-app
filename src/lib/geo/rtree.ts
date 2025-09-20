/**
 * R-tree spatial indexing for ZCTA pre-filtering
 */

import RBush from 'geojson-rbush';
import { bbox as turfBbox } from '@turf/turf';
import type { GeoJSON, GeoJsonProperties } from 'geojson';
import type { BBox } from 'geojson';

export type RTreeIndex = ReturnType<typeof RBush>;

/**
 * Build R-tree index from ZCTA features
 */
export function buildIndex(features: GeoJSON.Feature[]): RTreeIndex {
  const index = RBush();

  // Insert all features into the index
  index.load(features.map((feature, id) => ({
    ...feature,
    id: id.toString()
  })));

  return index;
}

/**
 * Query index for features that intersect with a bbox
 */
export function queryCandidates(
  index: RTreeIndex,
  bbox: BBox
): GeoJSON.Feature<GeoJSON.Geometry, GeoJsonProperties>[] {
  const results = index.search({
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [bbox[0], bbox[1]],
        [bbox[2], bbox[1]],
        [bbox[2], bbox[3]],
        [bbox[0], bbox[3]],
        [bbox[0], bbox[1]]
      ]]
    },
    properties: {}
  });

  return (results.features || []) as GeoJSON.Feature<GeoJSON.Geometry, GeoJsonProperties>[];
}

/**
 * Create bbox from GeoJSON feature
 */
export function featureToBbox(feature: GeoJSON.Feature): BBox {
  // Use turf.bbox if available, otherwise calculate manually
  try {
    return turfBbox(feature as any);
  } catch {
    // Manual bbox calculation as fallback
    if (feature.geometry.type === 'Point') {
      const [lng, lat] = feature.geometry.coordinates;
      return [lng, lat, lng, lat];
    }

    // For polygons and other geometries, we'd need a more complex implementation
    // For now, return a reasonable default
    return [-180, -90, 180, 90];
  }
}
