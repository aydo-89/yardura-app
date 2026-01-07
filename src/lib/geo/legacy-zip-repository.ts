import type { Feature, FeatureCollection, Polygon, MultiPolygon } from "geojson";
import * as turf from "@turf/turf";
import type {
  PlaceSearchParams,
  PlaceSearchResult,
  PlaceZipFeature,
  PlaceCoverageStats,
} from "./types";
import {
  getPlaceByCityState,
  getPlaceByCountyState,
  getZctasIntersectingPlace,
} from "@/lib/pmtiles";
import {
  clipZctasToPlace,
  scoreZctas,
  calculateCoverageStats,
  simplifyForRender,
} from "@/lib/geo";

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeKey(parts: (string | null | undefined)[]): string {
  return parts
    .filter(Boolean)
    .map((part) => String(part).trim().toLowerCase())
    .join(":");
}

function ensurePolygonFeature(
  feature: Feature,
): Feature<Polygon | MultiPolygon> {
  const { geometry } = feature;
  if (!geometry) {
    throw new Error("Feature missing geometry");
  }
  if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
    return feature as Feature<Polygon | MultiPolygon>;
  }
  throw new Error(`Unsupported geometry type: ${geometry.type}`);
}

function toPlaceResult(
  label: string,
  state: string,
  place: Feature<Polygon | MultiPolygon>,
  zipped: PlaceZipFeature[],
  stats: PlaceCoverageStats,
): PlaceSearchResult {
  const placeArea = turf.area(place);
  return {
    placeId: `legacy:${normalizeKey([label, state])}`,
    name: label,
    state,
    type: null,
    population: null,
    geometry: simplifyForRender(place, 1),
    bbox: place.bbox
      ? {
          type: "Polygon",
          coordinates: [
            [
              [place.bbox[0], place.bbox[1]],
              [place.bbox[2], place.bbox[1]],
              [place.bbox[2], place.bbox[3]],
              [place.bbox[0], place.bbox[3]],
              [place.bbox[0], place.bbox[1]],
            ],
          ],
        }
      : null,
    zips: zipped,
    stats: {
      zipCount: stats.zipCount,
      population: stats.population,
      totalAreaSqMeters: stats.totalAreaSqMeters ?? Math.round(placeArea),
    },
  };
}

function buildZipFeatures(clips: ReturnType<typeof clipZctasToPlace>): PlaceZipFeature[] {
  return clips.map((clip) => ({
    zip: clip.zip,
    state: undefined,
    population: toNumber(clip.feature.properties?.population ?? clip.feature.properties?.POP10),
    areaSqMeters: toNumber(clip.fullArea),
    coverageRatio: Number(clip.overlapRatio.toFixed(6)),
    geometry: clip.feature.geometry,
  }));
}

export function createLegacyZipRepository() {
  return {
    async searchPlaces(params: PlaceSearchParams): Promise<PlaceSearchResult[]> {
      const cityOrCounty = params.query?.trim();
      const state = params.state?.trim();
      if (!cityOrCounty || !state) {
        return [];
      }
      const searchType = params.searchType === "county" ? "county" : "city";

      try {
        const placeFeature =
          searchType === "county"
            ? await getPlaceByCountyState(cityOrCounty, state)
            : await getPlaceByCityState(cityOrCounty, state);

        const place = ensurePolygonFeature(placeFeature);

        const zctas = await getZctasIntersectingPlace(place);
        if (!zctas.features.length) {
          return [];
        }

        const clips = clipZctasToPlace(
          zctas as FeatureCollection<Polygon | MultiPolygon>,
          place,
        );
        const scored = scoreZctas(clips);
        if (!scored.length) {
          return [];
        }

        const zipFeatures = buildZipFeatures(scored);
        const coverageStatsRaw = calculateCoverageStats(place, scored);
        const aggregated: PlaceCoverageStats = {
          zipCount: zipFeatures.length,
          population: null,
          totalAreaSqMeters: coverageStatsRaw.placeAreaSqm,
          coveredAreaSqMeters: coverageStatsRaw.clipsAreaSqm,
          coverageRatio: coverageStatsRaw.ratio,
          coveragePercent: coverageStatsRaw.coveragePercent,
        };

        const result = toPlaceResult(
          cityOrCounty,
          state,
          place,
          zipFeatures,
          aggregated,
        );

        return [result];
      } catch (error) {
        console.error("Legacy ZIP search failed", error);
        return [];
      }
    },
  };
}
