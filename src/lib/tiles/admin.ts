import { getPostgisPool } from "@/lib/geo/postgis";
import type { Feature } from "geojson";

export interface TileSummaryRow {
  tileId: string;
  slug: string;
  name: string;
  status: string;
  zipCount: number;
  areaSqMeters: number;
  population: number | null;
  coveragePercent: number | null;
  zips: string[];
  geometry: Feature | null;
}

export interface TileListOptions {
  limit?: number;
  offset?: number;
}

export async function listTilesByStatus(
  orgId: string,
  status: string,
  options: TileListOptions = {},
): Promise<TileSummaryRow[]> {
  const pool = getPostgisPool();
  const { limit, offset } = options;
  const values: Array<string | number> = [orgId, status];

  let pagingClause = "";
  if (typeof limit === "number" && Number.isFinite(limit)) {
    values.push(Math.max(1, Math.floor(limit)));
    pagingClause += ` LIMIT $${values.length}`;
  }
  if (typeof offset === "number" && Number.isFinite(offset)) {
    values.push(Math.max(0, Math.floor(offset)));
    pagingClause += ` OFFSET $${values.length}`;
  }

  const { rows } = await pool.query<{
    tile_id: string;
    slug: string;
    name: string;
    status: string;
    zip_count: string | null;
    zips: string[] | null;
    area_sq_m: string | null;
    population: string | null;
    place_area_sq_m: string | null;
    covered_area_sq_m: string | null;
    geom_geojson: string | null;
    created_at: string | null;
  }>(
    `WITH tile_base AS (
       SELECT
         st.tile_id,
         st.slug,
         st.name,
         st.status,
         st.geom,
         st.geom_simplified,
          NULLIF(st.notes, '') AS notes,
         st.created_at
       FROM geo.service_tile st
       WHERE st.org_id = $1 AND st.status = $2
     ),
     place_note AS (
       SELECT
         tb.tile_id,
         note.place_id
       FROM tile_base tb
       LEFT JOIN LATERAL (
         SELECT (regexp_match(tb.notes, 'place ([^\(]+) \(([^\)]+)\)'))[2] AS place_id
       ) note ON TRUE
     ),
     place_area AS (
       SELECT
         pn.tile_id,
         MAX(ST_Area(p.geom::geography))::text AS place_area_sq_m
       FROM place_note pn
       JOIN geo.place p ON pn.place_id IS NOT NULL AND p.place_id = pn.place_id
       GROUP BY pn.tile_id
     )
       SELECT
         tb.tile_id,
         tb.slug,
         tb.name,
         tb.status,
         COUNT(stz.zip)::text AS zip_count,
         array_remove(array_agg(stz.zip ORDER BY stz.zip), NULL) AS zips,
         ST_Area(tb.geom::geography)::text AS area_sq_m,
         COALESCE(SUM(z.population), 0)::text AS population,
         pa.place_area_sq_m,
         COALESCE(SUM(ST_Area(ST_Intersection(tb.geom, z.geom)::geography)), 0)::text AS covered_area_sq_m,
         CASE 
           WHEN tb.geom_simplified IS NOT NULL THEN ST_AsGeoJSON(tb.geom_simplified)
           WHEN tb.geom IS NOT NULL THEN ST_AsGeoJSON(tb.geom)
           ELSE NULL
         END AS geom_geojson,
         MAX(tb.created_at)::text AS created_at
     FROM tile_base tb
     LEFT JOIN geo.service_tile_zip stz ON stz.tile_id = tb.tile_id
     LEFT JOIN geo.zcta z ON z.zip = stz.zip
     LEFT JOIN place_area pa ON pa.tile_id = tb.tile_id
     GROUP BY tb.tile_id, tb.slug, tb.name, tb.status, tb.geom, tb.geom_simplified, pa.place_area_sq_m
     ORDER BY MAX(tb.created_at) DESC NULLS LAST, tb.name ASC${pagingClause}`,
    values,
  );

  return rows.map((row) => {
    const areaSqMeters = Number(row.area_sq_m || "0");
    const coveredArea = Number(row.covered_area_sq_m || "0");
    const coveragePercent = areaSqMeters > 0
      ? Math.min(100, Number(((coveredArea / areaSqMeters) * 100).toFixed(2)))
      : null;

    const geometry = row.geom_geojson
      ? ({
          type: "Feature",
          geometry: JSON.parse(row.geom_geojson),
          properties: {
            tileId: row.tile_id,
            slug: row.slug,
            name: row.name,
          },
        } as Feature)
      : null;

    return {
      tileId: row.tile_id,
      slug: row.slug,
      name: row.name,
      status: row.status,
      zipCount: Number(row.zip_count || "0"),
      areaSqMeters,
      population: row.population ? Number(row.population) : null,
      coveragePercent,
      zips: row.zips ?? [],
      geometry,
    };
  });
}

export async function countTilesByStatus(orgId: string, status: string): Promise<number> {
  const pool = getPostgisPool();
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM geo.service_tile WHERE org_id = $1 AND status = $2`,
    [orgId, status],
  );

  return Number(rows[0]?.count ?? 0);
}

export async function getTileSummary(tileId: string): Promise<TileSummaryRow | null> {
  const pool = getPostgisPool();
  const { rows } = await pool.query<{
    tile_id: string;
    slug: string;
    name: string;
    status: string;
    zip_count: string | null;
    zips: string[] | null;
    area_sq_m: string | null;
    population: string | null;
    place_area_sq_m: string | null;
    geom_geojson: string | null;
  }>(
    `WITH target AS (
       SELECT st.tile_id, st.slug, st.name, st.status, st.geom, st.geom_simplified, NULLIF(st.notes, '') AS notes
       FROM geo.service_tile st
       WHERE st.tile_id = $1
     ),
     place_area AS (
       SELECT
         t.tile_id,
         MAX(ST_Area(p.geom::geography))::text AS place_area_sq_m
       FROM target t
       LEFT JOIN LATERAL (
         SELECT (regexp_match(t.notes, 'place ([^\(]+) \(([^\)]+)\)'))[2] AS place_id
       ) note ON TRUE
       JOIN geo.place p ON note.place_id IS NOT NULL AND p.place_id = note.place_id
       GROUP BY t.tile_id
     )
     SELECT
       t.tile_id,
       t.slug,
       t.name,
       t.status,
       COUNT(stz.zip)::text AS zip_count,
       array_remove(array_agg(stz.zip ORDER BY stz.zip), NULL) AS zips,
       ST_Area(t.geom::geography)::text AS area_sq_m,
       COALESCE(SUM(z.population), 0)::text AS population,
       pa.place_area_sq_m,
       CASE 
         WHEN t.geom_simplified IS NOT NULL THEN ST_AsGeoJSON(t.geom_simplified)
         WHEN t.geom IS NOT NULL THEN ST_AsGeoJSON(t.geom)
         ELSE NULL
       END AS geom_geojson
     FROM target t
     LEFT JOIN geo.service_tile_zip stz ON stz.tile_id = t.tile_id
     LEFT JOIN geo.zcta z ON z.zip = stz.zip
     LEFT JOIN place_area pa ON pa.tile_id = t.tile_id
     GROUP BY t.tile_id, t.slug, t.name, t.status, t.geom, t.geom_simplified, pa.place_area_sq_m`,
    [tileId],
  );

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  const areaSqMeters = Number(row.area_sq_m || "0");
  const placeArea = Number(row.place_area_sq_m || "0");
  const coveragePercent = placeArea
    ? Math.min(100, Number(((areaSqMeters / placeArea) * 100).toFixed(2)))
    : null;

  const geometry = row.geom_geojson
    ? ({
        type: "Feature",
        geometry: JSON.parse(row.geom_geojson),
        properties: {
          tileId: row.tile_id,
          slug: row.slug,
          name: row.name,
        },
      } as Feature)
    : null;

  return {
    tileId: row.tile_id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    zipCount: Number(row.zip_count || "0"),
    areaSqMeters,
    population: row.population ? Number(row.population) : null,
    coveragePercent,
    zips: row.zips ?? [],
    geometry,
  };
}
