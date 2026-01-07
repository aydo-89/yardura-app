import { query, getPostgisPool } from "@/lib/geo/postgis";
import type { ServiceTileStatus } from "@prisma/client";

import type { TileRepository, TileQueryOptions } from "./repository";
import type {
  CreateTileWithZipsInput,
  TileMetricRecord,
  TileRecord,
  TileTerritorySummary,
  TileWithContext,
  TileServiceWindowInput,
} from "./types";

const DEFAULT_METRIC_LIMIT = 12;

type TileRow = {
  tile_id: string;
  org_id: string;
  slug: string;
  name: string;
  status: ServiceTileStatus;
  min_scoopers: number | null;
  min_customer_units: number | null;
  coverage_radius_m: number | null;
  notes: string | null;
  go_live_date: Date | null;
  territory_id: string | null;
  geom_geojson: string | null;
  metrics_json: any | null;
};

type MetricRow = {
  id: string;
  tile_id: string;
  week_of: Date;
  active_scoopers: number | null;
  scheduled_stops: number | null;
  completed_stops: number | null;
};

function resolveLimit(options?: TileQueryOptions): number {
  const limit = options?.metricsLimit ?? DEFAULT_METRIC_LIMIT;
  if (!Number.isFinite(limit) || limit <= 0) return DEFAULT_METRIC_LIMIT;
  return Math.min(Math.floor(limit), 52);
}

function toTileRecord(row: TileRow): TileRecord {
  return {
    id: row.tile_id,
    orgId: row.org_id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    minCertifiedScoopers: row.min_scoopers ?? 0,
    minCustomerUnits: row.min_customer_units ?? 0,
    coverageRadiusMeters: row.coverage_radius_m ?? null,
  goLiveDate: row.go_live_date ?? null,
  notes: row.notes ?? null,
  territoryId: row.territory_id ?? null,
  geometryGeoJSON: row.geom_geojson ?? null,
  };
}

function toTerritory(row: TileRow): TileTerritorySummary | null {
  if (!row.territory_id) return null;
  return {
    id: row.territory_id,
    name: null,
  };
}

function parseMetrics(raw: any, limit: number): TileMetricRecord[] {
  if (!raw) return [];
  const array = Array.isArray(raw) ? raw : JSON.parse(raw as string);
  return array.slice(0, limit).map((metric: any) => ({
    id: metric.id,
    tileId: metric.tile_id,
    weekOf: new Date(metric.week_of),
    activeScoopers: Number(metric.active_scoopers ?? 0),
    scheduledStops: Number(metric.scheduled_stops ?? 0),
    completedStops: Number(metric.completed_stops ?? 0),
  }));
}

function mapTile(row: TileRow, limit: number): TileWithContext {
  return {
    tile: toTileRecord(row),
    metrics: parseMetrics(row.metrics_json, limit),
    territory: toTerritory(row),
  };
}

async function fetchTiles(orgId: string, limit: number): Promise<TileWithContext[]> {
  const sql = `
    SELECT
      st.tile_id,
      st.org_id,
      st.slug,
      st.name,
      st.status::text AS status,
      st.min_scoopers,
      st.min_customer_units,
      st.coverage_radius_m,
      st.notes,
      st.go_live_date,
      st.territory_id,
      CASE 
        WHEN st.geom_simplified IS NOT NULL THEN ST_AsGeoJSON(st.geom_simplified)::text
        WHEN st.geom IS NOT NULL THEN ST_AsGeoJSON(st.geom)::text
        ELSE NULL
      END AS geom_geojson,
      metrics.metrics_json
    FROM geo.service_tile st
    LEFT JOIN LATERAL (
      SELECT json_agg(metric_row) AS metrics_json
      FROM (
        SELECT
          id,
          tile_id,
          week_of,
          active_scoopers,
          scheduled_stops,
          completed_stops
        FROM geo.service_tile_metric
        WHERE tile_id = st.tile_id
        ORDER BY week_of DESC
        LIMIT $2
      ) metric_row
    ) metrics ON TRUE
    WHERE st.org_id = $1
    ORDER BY st.name ASC;
  `;

  const { rows } = await query<TileRow>(sql, [orgId, limit]);
  return rows.map((row) => mapTile(row, limit));
}

async function fetchTileBy(
  whereClause: string,
  whereParams: any[],
  limit: number,
): Promise<TileWithContext | null> {
  const metricsIndex = whereParams.length + 1;
  const sql = `
    SELECT
      st.tile_id,
      st.org_id,
      st.slug,
      st.name,
      st.status::text AS status,
      st.min_scoopers,
      st.min_customer_units,
      st.coverage_radius_m,
      st.notes,
      st.go_live_date,
      st.territory_id,
      CASE 
        WHEN st.geom_simplified IS NOT NULL THEN ST_AsGeoJSON(st.geom_simplified)::text
        WHEN st.geom IS NOT NULL THEN ST_AsGeoJSON(st.geom)::text
        ELSE NULL
      END AS geom_geojson,
      metrics.metrics_json
    FROM geo.service_tile st
    LEFT JOIN LATERAL (
      SELECT json_agg(metric_row) AS metrics_json
      FROM (
        SELECT
          id,
          tile_id,
          week_of,
          active_scoopers,
          scheduled_stops,
          completed_stops
        FROM geo.service_tile_metric
        WHERE tile_id = st.tile_id
        ORDER BY week_of DESC
        LIMIT $${metricsIndex}
      ) metric_row
    ) metrics ON TRUE
    WHERE ${whereClause}
    ORDER BY st.name ASC
    LIMIT 1;
  `;

  const params = [...whereParams, limit];
  const { rows } = await query<TileRow>(sql, params);
  const row = rows[0];
  return row ? mapTile(row, limit) : null;
}

async function fetchTileByZip(
  orgId: string,
  zip: string,
  limit: number,
): Promise<TileWithContext | null> {
  const sql = `
    SELECT
      st.tile_id,
      st.org_id,
      st.slug,
      st.name,
      st.status::text AS status,
      st.min_scoopers,
      st.min_customer_units,
      st.coverage_radius_m,
      st.notes,
      st.go_live_date,
      st.territory_id,
      CASE 
        WHEN st.geom_simplified IS NOT NULL THEN ST_AsGeoJSON(st.geom_simplified)::text
        WHEN st.geom IS NOT NULL THEN ST_AsGeoJSON(st.geom)::text
        ELSE NULL
      END AS geom_geojson,
      metrics.metrics_json
    FROM geo.service_tile st
    JOIN geo.service_tile_zip stz ON stz.tile_id = st.tile_id
    LEFT JOIN LATERAL (
      SELECT json_agg(metric_row) AS metrics_json
      FROM (
        SELECT
          id,
          tile_id,
          week_of,
          active_scoopers,
          scheduled_stops,
          completed_stops
        FROM geo.service_tile_metric
        WHERE tile_id = st.tile_id
        ORDER BY week_of DESC
        LIMIT $3
      ) metric_row
    ) metrics ON TRUE
    WHERE st.org_id = $1 AND stz.zip = $2
    ORDER BY CASE WHEN st.status = 'LIVE' THEN 0 ELSE 1 END, st.name
    LIMIT 1;
  `;

  const { rows } = await query<TileRow>(sql, [orgId, zip, limit]);
  const row = rows[0];
  return row ? mapTile(row, limit) : null;
}

async function fetchMetrics(tileId: string, limit: number): Promise<TileMetricRecord[]> {
  const sql = `
    SELECT id, tile_id, week_of, active_scoopers, scheduled_stops, completed_stops
    FROM geo.service_tile_metric
    WHERE tile_id = $1
    ORDER BY week_of DESC
    LIMIT $2;
  `;
  const { rows } = await query<MetricRow>(sql, [tileId, limit]);
  return rows.map((row) => ({
    id: row.id,
    tileId: row.tile_id,
    weekOf: new Date(row.week_of),
    activeScoopers: Number(row.active_scoopers ?? 0),
    scheduledStops: Number(row.scheduled_stops ?? 0),
    completedStops: Number(row.completed_stops ?? 0),
  }));
}

function dedupeZips(zipCodes: string[]): string[] {
  const seen = new Set<string>();
  return zipCodes
    .map((zip) => zip.trim())
    .filter((zip) => {
      if (!zip) return false;
      if (seen.has(zip)) return false;
      seen.add(zip);
      return true;
    });
}

async function createTileWithZips(
  input: CreateTileWithZipsInput,
  limit: number,
): Promise<TileWithContext> {
  const pool = getPostgisPool();
  const client = await pool.connect();

  const zipCodes = dedupeZips(input.zipCodes);
  if (zipCodes.length === 0) {
    throw new Error("At least one ZIP code is required to create a tile.");
  }

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT 1 FROM geo.service_tile WHERE org_id = $1 AND slug = $2 LIMIT 1`,
      [input.orgId, input.slug],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      throw new Error(`Tile with slug "${input.slug}" already exists.`);
    }

    const insertTileSql = `
      WITH selected AS (
        SELECT ST_Multi(ST_Union(geom))::geometry(MultiPolygon, 4326) AS geom
        FROM geo.zcta
        WHERE zip = ANY($3::text[])
      )
      INSERT INTO geo.service_tile (
        org_id,
        slug,
        name,
        status,
        min_scoopers,
        min_customer_units,
        coverage_radius_m,
        notes,
        go_live_date,
        territory_id,
        geom,
        geom_simplified
      )
      SELECT
        $1,
        $2,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        selected.geom,
        ST_SimplifyPreserveTopology(selected.geom, 0.0005)
      FROM selected
      WHERE selected.geom IS NOT NULL
      RETURNING tile_id;
    `;

    const insertParams = [
      input.orgId,
      input.slug,
      zipCodes,
      input.name,
      input.status,
      input.minCertifiedScoopers,
      input.minCustomerUnits,
      input.coverageRadiusMeters ?? null,
      input.notes ?? null,
      input.goLiveDate ?? null,
      input.territoryId ?? null,
    ];

    const insertRes = await client.query<{ tile_id: string }>(insertTileSql, insertParams);
    const tileId = insertRes.rows[0]?.tile_id;

    if (!tileId) {
      throw new Error(
        "Failed to build tile geometry – ensure the provided ZIP codes are valid and intersecting.",
      );
    }

    if (input.serviceWindows.length > 0) {
      const windowParams: any[] = [tileId];
      const values: string[] = [];

      input.serviceWindows.forEach((window, index) => {
        const base = index * 3;
        windowParams.push(window.weekday, window.window, window.maxStops);
        values.push(`($1, $${base + 2}, $${base + 3}, $${base + 4})`);
      });

      await client.query(
        `INSERT INTO geo.service_tile_window (tile_id, weekday, window_slot, max_stops)
         VALUES ${values.join(", ")}`,
        windowParams,
      );
    }

    await client.query(
      `INSERT INTO geo.service_tile_zip (tile_id, zip, status, added_by)
       SELECT $1, z.zip, 'AVAILABLE', 'admin-create'
       FROM geo.zcta z
       WHERE z.zip = ANY($2::text[])`,
      [tileId, zipCodes],
    );

    await client.query("COMMIT");

    const created = await fetchTileBy("st.tile_id = $1", [tileId], limit);
    if (!created) {
      throw new Error("Tile created but could not be retrieved after insertion.");
    }
    return created;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function createPostgisTileRepository(): TileRepository {
  return {
    async listTiles(orgId, options) {
      const limit = resolveLimit(options);
      return fetchTiles(orgId, limit);
    },

    async getTileById(tileId, options) {
      const limit = resolveLimit(options);
      return fetchTileBy("st.tile_id = $1", [tileId], limit);
    },

    async getTileBySlug(orgId, slug, options) {
      const limit = resolveLimit(options);
      return fetchTileBy("st.org_id = $1 AND st.slug = $2", [orgId, slug], limit);
    },

    async listTileMetrics(tileId, limit) {
      const resolvedLimit = resolveLimit({ metricsLimit: limit });
      return fetchMetrics(tileId, resolvedLimit);
    },

    async findTileByZip(orgId, zip, options) {
      const limit = resolveLimit(options);
      return fetchTileByZip(orgId, zip, limit);
    },
    async createTileWithZips(input) {
      const limit = resolveLimit();
      return createTileWithZips(input, limit);
    },
  };
}
