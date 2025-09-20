/**
 * Web Worker for ZCTA clipping and scoring operations
 */

import * as Comlink from 'comlink';
import * as turf from '@turf/turf';
import type { GeoJSON } from 'geojson';
import { clipZctasToPlace } from '../clip';
import { scoreZctas, getAreaThreshold } from '../score';
import { calculateCoverageStats } from '../coverage';
import { buildIndex } from '../rtree';
import { debug } from '../../log';

export interface ClipWorkerResult {
  clips: any[];
  scored: any[];
  stats: any;
  error?: string;
}

/**
 * Worker-exposed functions for clipping and scoring
 */
const workerAPI = {
  /**
   * Build R-tree index for ZCTAs
   */
  buildIndex(zctaFC: GeoJSON.FeatureCollection): any {
    try {
      debug('worker', 'Building R-tree index');
      return buildIndex(zctaFC.features);
    } catch (error) {
      debug('worker', 'Index build failed:', error);
      throw error;
    }
  },

  /**
   * Run full clip and score pipeline
   */
  async runClipAndScore(
    zctaFC: GeoJSON.FeatureCollection<GeoJSON.Geometry, GeoJSON.GeoJsonProperties>,
    place: GeoJSON.Feature<GeoJSON.Geometry, GeoJSON.GeoJsonProperties>,
    threshold?: number
  ): Promise<ClipWorkerResult> {
    try {
      debug('worker', `Starting clip and score pipeline with ${zctaFC.features.length} ZCTAs`);

      // Step 1: Clip ZCTAs to place
      const clips = clipZctasToPlace(zctaFC as any, place as any);

      // Step 2: Score and filter
      const areaThreshold = threshold ?? getAreaThreshold();
      const scored = scoreZctas(clips, areaThreshold, true);

      // Step 3: Calculate coverage
      const stats = calculateCoverageStats(place as any, scored);

      debug('worker', `Pipeline complete: ${scored.length} ZCTAs scored`);

      return {
        clips: clips.map(c => ({ ...c, feature: JSON.stringify(c.feature) })), // Serialize features
        scored: scored.map(s => ({ ...s, feature: JSON.stringify(s.feature) })),
        stats
      };

    } catch (error) {
      debug('worker', 'Pipeline failed:', error);
      return {
        clips: [],
        scored: [],
        stats: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  /**
   * Health check for worker
   */
  ping(): string {
    return 'worker-ready';
  }
};

// Expose the API to the main thread
Comlink.expose(workerAPI);
