import { query, describePostgisPool } from "./postgis";
import type { PlaceSearchParams, PlaceSearchResult, PlaceZipFeature, PlaceCoverageStats } from "./types";

function toNumber(value: any): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toRatio(value: any): number | null {
  const num = toNumber(value);
  if (num === null) return null;
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.min(1, num));
}

function parseMaybeJson<T>(value: any): T | null {
  if (!value) return null;
  if (typeof value === "string") {
    return JSON.parse(value) as T;
  }
  return value as T;
}

const DEFAULT_LIMIT = 8;

async function searchCityPlacesWithZips(params: PlaceSearchParams): Promise<PlaceSearchResult[]> {
  const searchTerm = params.query?.trim();
  if (!searchTerm) {
    return [];
  }
  const limit = Math.min(Math.max(params.limit ?? DEFAULT_LIMIT, 1), 25);
  const values: any[] = [];
  let idx = 1;

  const whereClauses: string[] = [];
  // Search by place name OR county name
  whereClauses.push(`(p.name ILIKE $${idx} OR p.county_name ILIKE $${idx})`);
  values.push(`${searchTerm}%`);
  idx += 1;

  if (params.state) {
    whereClauses.push(`p.state = $${idx}`);
    values.push(params.state.toUpperCase());
    idx += 1;
  }

  values.push(limit);

  const sql = `WITH matched AS (
    SELECT p.place_id, p.name, p.state, p.type, p.population, p.geom, p.geom_simplified, p.bbox, p.county_name,
           ST_Area(p.geom::geography) AS place_area_geo,
           CASE WHEN p.name ILIKE $1 THEN 1 ELSE 2 END AS match_priority
    FROM geo.place p
    WHERE ${whereClauses.join(" AND ")}
    ORDER BY match_priority, p.population DESC NULLS LAST, p.name
    LIMIT $${idx}
  )
  SELECT
    m.place_id,
    m.name,
    m.state,
    m.type,
    m.population,
    m.county_name,
    ST_AsGeoJSON(m.geom_simplified) AS geom_geojson,
    ST_AsGeoJSON(m.bbox) AS bbox_geojson,
    zagg.zips_json,
    COALESCE(zagg.stats_json, json_build_object('zipCount', 0, 'population', 0, 'totalAreaSqMeters', 0)) AS stats_json
  FROM matched m
  LEFT JOIN LATERAL (
    SELECT
      json_agg(json_build_object(
        'zip', z.zip,
        'state', z.state,
        'population', COALESCE(z.population, 0),
        'areaSqMeters', COALESCE(z.area_sq_m, 0),
        'coverageRatio', CASE
          WHEN ST_Area(z.geom::geography) = 0 THEN 1
          ELSE ST_Area(ST_Intersection(z.geom, m.geom)::geography) / ST_Area(z.geom::geography)
        END,
        'geometry', ST_AsGeoJSON(z.geom_simplified)
      ) ORDER BY z.zip) AS zips_json,
      json_build_object(
        'zipCount', COUNT(*),
        'population', COALESCE(SUM(z.population), 0),
        'totalAreaSqMeters', COALESCE(SUM(z.area_sq_m), 0),
        'coveredAreaSqMeters', COALESCE(SUM(ST_Area(ST_Intersection(z.geom, m.geom)::geography)), 0)
      ) AS stats_json
    FROM geo.zcta z
    WHERE ST_Intersects(z.geom, m.geom)
      AND (
        ST_Area(z.geom::geography) = 0 
        OR (ST_Area(ST_Intersection(z.geom, m.geom)::geography) / ST_Area(z.geom::geography)) >= 0.50
      )
  ) AS zagg ON TRUE
  ORDER BY COALESCE((zagg.stats_json->>'zipCount')::int, 0) DESC,
           m.population DESC NULLS LAST,
           m.name;`;

  const { rows } = await query(sql, values);

  return rows.map((row: any) => {
    const zipsRaw = parseMaybeJson<any[]>(row.zips_json) ?? [];
    const zips: PlaceZipFeature[] = zipsRaw.map((zip) => ({
      zip: zip.zip,
      state: zip.state ?? undefined,
      population: toNumber(zip.population),
      areaSqMeters: toNumber(zip.areaSqMeters),
      coverageRatio: toRatio(zip.coverageRatio),
      geometry: zip.geometry ? parseMaybeJson(zip.geometry) : null,
    }));

    const statsValue = parseMaybeJson<any>(row.stats_json) ?? {
      zipCount: 0,
      population: 0,
      totalAreaSqMeters: 0,
      coveredAreaSqMeters: 0,
    };

    const placeArea = toNumber(row.place_area_geo);
    const coveredArea = toNumber(statsValue.coveredAreaSqMeters) ?? 0;
    const stats: PlaceCoverageStats = {
      zipCount: Number(statsValue.zipCount ?? 0),
      population: toNumber(statsValue.population) ?? 0,
      totalAreaSqMeters: toNumber(statsValue.totalAreaSqMeters) ?? 0,
      coveredAreaSqMeters: coveredArea,
      coverageRatio:
        placeArea && placeArea > 0
          ? Number((coveredArea / placeArea).toFixed(4))
          : null,
      coveragePercent:
        placeArea && placeArea > 0
          ? Number(((coveredArea / placeArea) * 100).toFixed(2))
          : null,
    };

    return {
      placeId: row.place_id,
      name: row.name,
      state: row.state,
      type: row.type ?? null,
      population: toNumber(row.population),
      countyName: row.county_name ?? null,
      geometry: row.geom_geojson ? JSON.parse(row.geom_geojson) : null,
      bbox: row.bbox_geojson ? JSON.parse(row.bbox_geojson) : null,
      zips,
      stats,
    } satisfies PlaceSearchResult;
  });
}

async function searchCountiesWithZips(params: PlaceSearchParams): Promise<PlaceSearchResult[]> {
  const searchTerm = params.query?.trim();
  if (!searchTerm) {
    return [];
  }

  const limit = Math.min(Math.max(params.limit ?? DEFAULT_LIMIT, 1), 10);
  const values: any[] = [`${searchTerm}%`, limit];
  let stateClause = "";

  if (params.state) {
    stateClause = "AND c.state = $3";
    values.push(params.state.toUpperCase());
  }

  const sql = `WITH matched AS (
    SELECT 
      c.county_id,
      c.name,
      c.state,
      c.population,
      c.geom,
      c.geom_simplified,
      c.bbox,
      ST_Area(c.geom::geography) AS county_area_geo
    FROM geo.county c
    WHERE c.name ILIKE $1
      ${stateClause}
    ORDER BY c.population DESC NULLS LAST, c.name
    LIMIT $2
  )
  SELECT
    m.county_id,
    m.name,
    m.state,
    m.population,
    m.county_area_geo,
    ST_AsGeoJSON(m.geom_simplified) AS geom_geojson,
    ST_AsGeoJSON(m.bbox) AS bbox_geojson,
    zagg.zips_json,
    COALESCE(zagg.stats_json, json_build_object('zipCount', 0, 'population', 0, 'totalAreaSqMeters', 0, 'coveredAreaSqMeters', 0)) AS stats_json
  FROM matched m
  LEFT JOIN LATERAL (
    SELECT
      json_agg(json_build_object(
        'zip', z.zip,
        'state', z.state,
        'population', COALESCE(z.population, 0),
        'areaSqMeters', COALESCE(z.area_sq_m, 0),
        'coverageRatio', CASE
          WHEN ST_Area(z.geom::geography) = 0 THEN 1
          ELSE ST_Area(ST_Intersection(z.geom, m.geom)::geography) / ST_Area(z.geom::geography)
        END,
        'geometry', ST_AsGeoJSON(z.geom_simplified)
      ) ORDER BY z.zip) AS zips_json,
      json_build_object(
        'zipCount', COUNT(*),
        'population', COALESCE(SUM(z.population), 0),
        'totalAreaSqMeters', COALESCE(SUM(z.area_sq_m), 0),
        'coveredAreaSqMeters', COALESCE(SUM(ST_Area(ST_Intersection(z.geom, m.geom)::geography)), 0)
      ) AS stats_json
    FROM geo.zcta z
    WHERE ST_Intersects(z.geom, m.geom)
  ) AS zagg ON TRUE
  ORDER BY COALESCE((zagg.stats_json->>'zipCount')::int, 0) DESC,
           m.population DESC NULLS LAST,
           m.name;`;

  const { rows } = await query(sql, values);

  return rows.map((row: any) => {
    const zipsRaw = parseMaybeJson<any[]>(row.zips_json) ?? [];
    const zips: PlaceZipFeature[] = zipsRaw.map((zip) => ({
      zip: zip.zip,
      state: zip.state ?? undefined,
      population: toNumber(zip.population),
      areaSqMeters: toNumber(zip.areaSqMeters),
      coverageRatio: toRatio(zip.coverageRatio),
      geometry: zip.geometry ? parseMaybeJson(zip.geometry) : null,
    }));

    const statsValue = parseMaybeJson<any>(row.stats_json) ?? {
      zipCount: 0,
      population: 0,
      totalAreaSqMeters: 0,
      coveredAreaSqMeters: 0,
    };

    const countyArea = toNumber(row.county_area_geo);
    const coveredArea = toNumber(statsValue.coveredAreaSqMeters) ?? 0;
    const stats: PlaceCoverageStats = {
      zipCount: Number(statsValue.zipCount ?? 0),
      population: toNumber(statsValue.population) ?? 0,
      totalAreaSqMeters: toNumber(statsValue.totalAreaSqMeters) ?? 0,
      coveredAreaSqMeters: coveredArea,
      coverageRatio:
        countyArea && countyArea > 0
          ? Number((coveredArea / countyArea).toFixed(4))
          : null,
      coveragePercent:
        countyArea && countyArea > 0
          ? Number(((coveredArea / countyArea) * 100).toFixed(2))
          : null,
    };

    return {
      placeId: row.county_id,
      name: row.name,
      state: row.state,
      type: "county",
      population: toNumber(row.population),
      countyName: row.name,
      geometry: row.geom_geojson ? JSON.parse(row.geom_geojson) : null,
      bbox: row.bbox_geojson ? JSON.parse(row.bbox_geojson) : null,
      zips,
      stats,
    } satisfies PlaceSearchResult;
  });
}

export async function searchPlacesWithZips(params: PlaceSearchParams): Promise<PlaceSearchResult[]> {
  const searchType = params.searchType === "county" ? "county" : "city";
  if (searchType === "county") {
    return searchCountiesWithZips(params);
  }
  return searchCityPlacesWithZips(params);
}

export function describePostgisTarget(): string {
  return describePostgisPool();
}
