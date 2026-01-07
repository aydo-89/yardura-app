import { query } from "@/lib/geo/postgis";
import { normalizeZip } from "@/lib/geo/normalize";
import { getTileRepository } from "./repository";
import type { ServiceTileStatus } from "@prisma/client";
import type { Feature, Geometry } from "geojson";

export interface ServiceAreaZipEntry {
  zip: string;
  status: string | null;
  addedAt: string | null;
  addedBy: string | null;
  notes: string | null;
  population: number | null;
  state: string | null;
  placeName: string | null;
  conflict: boolean;
  conflictTiles: string[];
  conflictCount: number;
}

export interface ServiceAreaSummary {
  tile: {
    id: string;
    slug: string;
    name: string;
    status: ServiceTileStatus;
    goLiveDate: Date | null;
    minCertifiedScoopers: number;
    minCustomerUnits: number;
    coverageRadiusMeters: number | null;
    territoryId: string | null;
    notes: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  };
  zipCount: number;
  tileAreaSqMeters: number;
  coveredAreaSqMeters: number;
  coverageRatio: number;
  coveragePercent: number;
  totalPopulation: number | null;
  zips: ServiceAreaZipEntry[];
  tileGeometry: Feature | null;
  conflictZipCount: number;
  conflictZips: string[];
  hasConflicts: boolean;
}

export interface ServiceAreaListOptions {
  slug?: string;
}

interface ServiceAreaRow {
  tile_id: string;
  slug: string;
  name: string;
  status: ServiceTileStatus;
  min_scoopers: number | null;
  min_customer_units: number | null;
  coverage_radius_m: number | null;
  go_live_date: Date | null;
  territory_id: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  zip_count: number | null;
  tile_area_sqm: number | null;
  covered_area_sqm: number | null;
  population: number | null;
  zips: unknown;
  geom_geojson: string | null;
  conflict_zip_count: number | null;
  conflict_zips: string[] | null;
}

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  return String(value);
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => toStringOrNull(item))
    .filter((item): item is string => Boolean(item));
}

function parseZips(raw: unknown): ServiceAreaZipEntry[] {
  if (!raw) return [];
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((entry: Record<string, unknown>) => ({
      zip: String(entry.zip ?? "").padStart(5, "0"),
      status: toStringOrNull(entry.status),
      addedAt: toStringOrNull(entry.addedAt ?? entry.added_at),
      addedBy: toStringOrNull(entry.addedBy ?? entry.added_by),
      notes: toStringOrNull(entry.notes),
      population: toNumberOrNull(entry.population),
      state: toStringOrNull(entry.state),
      placeName: toStringOrNull(entry.placeName ?? entry.place_name),
      conflict: Boolean(entry.conflict ?? false),
      conflictTiles: toStringArray(entry.conflictTiles),
      conflictCount: Number(entry.conflictCount ?? (entry.conflict ? 1 : 0)) || 0,
    }))
    .filter((entry) => /^\d{5}$/.test(entry.zip));
}

function parseGeometry(value: string | null): Feature | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    if ((parsed as Feature).type === "Feature" && "geometry" in parsed) {
      return parsed as Feature;
    }
    return {
      type: "Feature",
      geometry: parsed as Geometry,
      properties: {},
    };
  } catch (error) {
    console.error("Failed to parse tile geometry", error);
    return null;
  }
}

function toSummary(row: ServiceAreaRow): ServiceAreaSummary {
  const tileArea = Number(row.tile_area_sqm ?? 0);
  const coveredArea = Number(row.covered_area_sqm ?? 0);
  const ratio = tileArea > 0 ? coveredArea / tileArea : 0;

  return {
    tile: {
      id: row.tile_id,
      slug: row.slug,
      name: row.name,
      status: row.status,
      goLiveDate: row.go_live_date ?? null,
      minCertifiedScoopers: row.min_scoopers ?? 0,
      minCustomerUnits: row.min_customer_units ?? 0,
      coverageRadiusMeters: row.coverage_radius_m ?? null,
      territoryId: row.territory_id ?? null,
      notes: row.notes ?? null,
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null,
    },
    zipCount: Number(row.zip_count ?? 0),
    tileAreaSqMeters: tileArea,
    coveredAreaSqMeters: coveredArea,
    coverageRatio: Number(ratio.toFixed(4)),
    coveragePercent: Number((ratio * 100).toFixed(2)),
    totalPopulation: row.population ?? null,
    zips: parseZips(row.zips),
    tileGeometry: parseGeometry(row.geom_geojson),
    conflictZipCount: Number(row.conflict_zip_count ?? 0),
    conflictZips: (row.conflict_zips ?? []).map((zip) => String(zip).padStart(5, "0")),
    hasConflicts: Number(row.conflict_zip_count ?? 0) > 0,
  };
}

async function fetchServiceAreas(
  orgId: string,
  options: ServiceAreaListOptions = {},
): Promise<ServiceAreaSummary[]> {
  const params: unknown[] = [orgId];
  const conditions: string[] = ["st.org_id = $1"];

  if (options.slug) {
    params.push(options.slug);
    conditions.push(`st.slug = $${params.length}`);
  }

  const whereClause = conditions.join(" AND ");

  const sql = `
    WITH conflict_data AS (
      SELECT
        stz.zip,
        COUNT(DISTINCT stz.tile_id) AS tile_count,
        array_agg(DISTINCT st.slug) AS tile_slugs
      FROM geo.service_tile_zip stz
      JOIN geo.service_tile st ON st.tile_id = stz.tile_id
      GROUP BY stz.zip
    )
    SELECT
      st.tile_id,
      st.slug,
      st.name,
      st.status::text AS status,
      st.min_scoopers,
      st.min_customer_units,
      st.coverage_radius_m,
      st.go_live_date,
      st.territory_id,
      st.notes,
      st.created_at,
      st.updated_at,
      COUNT(DISTINCT stz.zip) AS zip_count,
      ST_Area(st.geom::geography) AS tile_area_sqm,
      COALESCE(SUM(ST_Area(ST_Intersection(st.geom, z.geom)::geography)), 0) AS covered_area_sqm,
      SUM(z.population) AS population,
      COALESCE(
        jsonb_agg(
          DISTINCT jsonb_build_object(
            'zip', stz.zip,
            'status', stz.status,
            'addedAt', stz.added_at,
            'addedBy', stz.added_by,
            'notes', stz.notes,
            'population', z.population,
            'state', z.state,
            'placeName', z.place_name,
            'conflict', COALESCE(conf.tile_count, 0) > 1,
            'conflictCount', COALESCE(conf.tile_count, 0),
            'conflictTiles', COALESCE(array_remove(conf.tile_slugs, st.slug), ARRAY[]::text[])
          )
        ) FILTER (WHERE stz.zip IS NOT NULL),
        '[]'::jsonb
      ) AS zips,
      CASE 
        WHEN st.geom_simplified IS NOT NULL THEN ST_AsGeoJSON(st.geom_simplified)
        WHEN st.geom IS NOT NULL THEN ST_AsGeoJSON(st.geom)
        ELSE NULL
      END AS geom_geojson,
      COUNT(DISTINCT CASE WHEN COALESCE(conf.tile_count, 0) > 1 THEN stz.zip END) AS conflict_zip_count,
      COALESCE(
        array_agg(DISTINCT CASE WHEN COALESCE(conf.tile_count, 0) > 1 THEN stz.zip END)
          FILTER (WHERE COALESCE(conf.tile_count, 0) > 1),
        ARRAY[]::text[]
      ) AS conflict_zips
    FROM geo.service_tile st
    LEFT JOIN geo.service_tile_zip stz ON stz.tile_id = st.tile_id
    LEFT JOIN geo.zcta z ON z.zip = stz.zip
    LEFT JOIN conflict_data conf ON conf.zip = stz.zip
    WHERE ${whereClause}
    GROUP BY
      st.tile_id,
      st.slug,
      st.name,
      st.status,
      st.min_scoopers,
      st.min_customer_units,
      st.coverage_radius_m,
      st.go_live_date,
      st.territory_id,
      st.notes,
      st.created_at,
      st.updated_at,
      st.geom,
      st.geom_simplified
    ORDER BY st.name ASC;
  `;

  const { rows } = await query<ServiceAreaRow>(sql, params);

  return rows.map(toSummary);
}

export async function listServiceAreas(
  orgId: string,
  options: ServiceAreaListOptions = {},
): Promise<ServiceAreaSummary[]> {
  return fetchServiceAreas(orgId, options);
}

export async function getServiceArea(
  orgId: string,
  tileSlug: string,
): Promise<ServiceAreaSummary | null> {
  const results = await fetchServiceAreas(orgId, { slug: tileSlug });
  return results[0] ?? null;
}

export interface ZipReassignment {
  zip: string;
  previousTileSlug: string;
}

export interface ServiceAreaUpdateResult {
  summary: ServiceAreaSummary | null;
  reassignedZips: ZipReassignment[];
}

function normalizeZipArray(zips: string[]): string[] {
  const normalized = new Set<string>();
  for (const zip of zips) {
    const value = normalizeZip(zip);
    if (value) {
      normalized.add(value);
    }
  }
  return Array.from(normalized);
}

async function resolveTileId(orgId: string, tileSlug: string): Promise<string> {
  const repository = getTileRepository();
  const tile = await repository.getTileBySlug(orgId, tileSlug, { metricsLimit: 1 });
  if (!tile) {
    throw new Error(`Tile not found for slug ${tileSlug}`);
  }
  return tile.tile.id;
}

export async function addZipsToTile(
  orgId: string,
  tileSlug: string,
  zips: string[],
  addedBy?: string | null,
): Promise<ServiceAreaUpdateResult> {
  const normalizedZips = normalizeZipArray(zips);
  if (!normalizedZips.length) {
    return {
      summary: await getServiceArea(orgId, tileSlug),
      reassignedZips: [],
    };
  }

  const tileId = await resolveTileId(orgId, tileSlug);

  const reassignmentQuery = `
    SELECT stz.zip, st.slug
    FROM geo.service_tile_zip stz
    JOIN geo.service_tile st ON st.tile_id = stz.tile_id
    WHERE stz.zip = ANY($1::text[])
      AND st.org_id = $2
      AND st.tile_id <> $3
  `;

  const { rows: existingAssignments } = await query<{ zip: string; slug: string }>(
    reassignmentQuery,
    [normalizedZips, orgId, tileId],
  );

  if (existingAssignments.length) {
    await query(
      `
        DELETE FROM geo.service_tile_zip
        WHERE zip = ANY($1::text[])
          AND tile_id IN (
            SELECT tile_id
            FROM geo.service_tile
            WHERE org_id = $2
              AND tile_id <> $3
          )
      `,
      [normalizedZips, orgId, tileId],
    );
  }

  const sql = `
    WITH valid_zips AS (
      SELECT z.zip
      FROM unnest($2::text[]) AS z(zip)
      JOIN geo.zcta c ON c.zip = z.zip
    )
    INSERT INTO geo.service_tile_zip (tile_id, zip, status, added_by)
    SELECT $1, vz.zip, 'ACTIVE', $3
    FROM valid_zips vz
    ON CONFLICT (tile_id, zip)
    DO UPDATE SET status = EXCLUDED.status, added_by = EXCLUDED.added_by, added_at = now();
  `;

  await query(sql, [tileId, normalizedZips, addedBy ?? null]);

  return {
    summary: await getServiceArea(orgId, tileSlug),
    reassignedZips: existingAssignments.map((assignment) => ({
      zip: normalizeZip(assignment.zip) ?? assignment.zip,
      previousTileSlug: assignment.slug,
    })),
  };
}

export async function removeZipsFromTile(
  orgId: string,
  tileSlug: string,
  zips: string[],
): Promise<ServiceAreaSummary | null> {
  const normalizedZips = normalizeZipArray(zips);
  if (!normalizedZips.length) {
    return getServiceArea(orgId, tileSlug);
  }

  const tileId = await resolveTileId(orgId, tileSlug);

  await query(
    `DELETE FROM geo.service_tile_zip WHERE tile_id = $1 AND zip = ANY($2::text[])`,
    [tileId, normalizedZips],
  );

  return getServiceArea(orgId, tileSlug);
}
