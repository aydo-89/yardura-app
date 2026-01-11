import { getPostgisPool } from "@/lib/geo/postgis";
import type { Feature } from "geojson";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export type TileGenerationStrategy = "kmeans";

export interface TileGenerationOptions {
  placeId: string;
  orgId?: string;
  tileCount: number;
  status?: string;
  strategy?: TileGenerationStrategy;
  createdBy?: string;
  generationMode?: "cluster" | "perZip";
}

export interface GeneratedTileSummary {
  tileId: string;
  slug: string;
  name: string;
  zipCount: number;
  population: number;
  areaSqMeters: number;
  coveragePercent: number | null;
  zips: string[];
}

export interface TileGenerationResult {
  placeId: string;
  placeName: string;
  placeState: string | null;
  placeAreaSqMeters: number;
  placeGeometry: Feature | null;
  tileCount: number;
  tiles: GeneratedTileSummary[];
}

const DEFAULT_ORG_ID = "yardura";
const DEFAULT_STATUS = "WAITLIST"; // New tiles start as Waitlist (was DRAFT)

/**
 * Sync ZIPs to a tile using spatial intersection.
 * WARNING: This can create overlaps if multiple tiles intersect the same ZIP.
 * Use assignZipsToTile() instead for exclusive ZIP assignment during generation.
 */
export async function syncTileZips(
  tileId: string,
  options: { status?: string; addedBy?: string } = {},
) {
  const pool = getPostgisPool();
  const client = await pool.connect();

  const status = options.status ?? "AVAILABLE";
  const addedBy = options.addedBy ?? "tile-sync";

  try {
    // Ensure the coverage_ratio column exists even if migrations
    // have not been executed yet. This keeps tile generation resilient
    // in local/dev environments where the latest migration may lag.
    await client.query(
      `ALTER TABLE geo.service_tile_zip
         ADD COLUMN IF NOT EXISTS coverage_ratio DOUBLE PRECISION DEFAULT 0`,
    );

    await client.query("BEGIN");

    await client.query(`DELETE FROM geo.service_tile_zip WHERE tile_id = $1`, [tileId]);

    await client.query(
      `WITH tile_geom AS (
         SELECT geom FROM geo.service_tile WHERE tile_id = $1
       )
       INSERT INTO geo.service_tile_zip (
         tile_id,
         zip,
         status,
         added_by,
         coverage_ratio,
         added_at
       )
       SELECT
         $1,
         z.zip,
         $2,
         $3,
         CASE
           WHEN ST_Area(z.geom::geography) = 0 THEN 1
           ELSE ST_Area(ST_Intersection(z.geom, tg.geom)::geography) / ST_Area(z.geom::geography)
         END,
         now()
       FROM geo.zcta z, tile_geom tg
       WHERE ST_Intersects(z.geom, tg.geom)
       ORDER BY z.zip`,
      [tileId, status, addedBy],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function refreshTileZipCoverage(tileId: string) {
  const pool = getPostgisPool();
  const client = await pool.connect();

  try {
    await client.query(
      `WITH tile_geom AS (
         SELECT geom
         FROM geo.service_tile
         WHERE tile_id = $1
       )
       UPDATE geo.service_tile_zip stz
       SET coverage_ratio = CASE
         WHEN ST_Area(z.geom::geography) = 0 THEN 1
         ELSE ST_Area(ST_Intersection(z.geom, tg.geom)::geography) / ST_Area(z.geom::geography)
       END
       FROM tile_geom tg,
            geo.zcta z
       WHERE stz.tile_id = $1
         AND z.zip = stz.zip`,
      [tileId],
    );
  } finally {
    client.release();
  }
}

/**
 * Assign specific ZIPs to a tile (used during generation to avoid overlaps).
 * This function directly assigns the provided ZIP list without spatial intersection.
 */
export async function assignZipsToTile(
  client: any,
  tileId: string,
  zipList: string[],
  options: { status?: string; addedBy?: string } = {},
) {
  const status = options.status ?? "AVAILABLE";
  const addedBy = options.addedBy ?? "tile-generator";

  if (!zipList || zipList.length === 0) {
    return;
  }

  // Ensure the coverage_ratio column exists
  await client.query(
    `ALTER TABLE geo.service_tile_zip
       ADD COLUMN IF NOT EXISTS coverage_ratio DOUBLE PRECISION DEFAULT 0`,
  );

  // Delete any existing ZIPs for this tile
  await client.query(`DELETE FROM geo.service_tile_zip WHERE tile_id = $1`, [tileId]);

  // Remove these ZIPs from ANY other tiles (for "stealing" ZIPs with better coverage)
  await client.query(
    `DELETE FROM geo.service_tile_zip 
     WHERE zip = ANY($1::text[]) 
     AND tile_id != $2`,
    [zipList, tileId]
  );

  // Insert the specific ZIP list (ensuring 100% coverage ratio since these are the tile's ZIPs)
  await client.query(
    `INSERT INTO geo.service_tile_zip (
       tile_id,
       zip,
       status,
       added_by,
       coverage_ratio,
       added_at
     )
     SELECT
       $1,
       unnest($2::text[]),
       $3,
       $4,
       1.0,
       now()`,
    [tileId, zipList, status, addedBy],
  );
}

export async function generateTilesForPlace(
  options: TileGenerationOptions,
): Promise<TileGenerationResult> {
  const pool = getPostgisPool();
  const client = await pool.connect();

  const orgId = options.orgId ?? DEFAULT_ORG_ID;
  const requestedTileCount = Math.max(1, Math.floor(options.tileCount));
  const status = options.status ?? DEFAULT_STATUS;
  const createdBy = options.createdBy ?? "tile-generator";

  if (!options.placeId) {
    client.release();
    throw new Error("placeId is required");
  }

  if (requestedTileCount < 1) {
    client.release();
    throw new Error("tileCount must be >= 1");
  }

  try {
    await client.query("BEGIN");

    const placeRes = await client.query<{
      place_id: string;
      place_name: string;
      place_state: string | null;
      place_area_sq_m: string;
      place_geom_geojson: string | null;
    }>(
      `SELECT
         place_id,
         name AS place_name,
         state AS place_state,
         ST_Area(geom::geography)::text AS place_area_sq_m,
         COALESCE(ST_AsGeoJSON(geom_simplified), ST_AsGeoJSON(geom)) AS place_geom_geojson
       FROM geo.place
       WHERE place_id = $1
       LIMIT 1`,
      [options.placeId],
    );

    if (placeRes.rowCount === 0) {
      throw new Error(`Place ${options.placeId} was not found in geo.place`);
    }

    const placeRow = placeRes.rows[0];
    const placeName = placeRow.place_name || "Unknown";
    const placeAreaSqMeters = Number(placeRow.place_area_sq_m || "0");
    const placeGeometry = placeRow.place_geom_geojson
      ? (JSON.parse(placeRow.place_geom_geojson) as Feature)
      : null;

    // First, let's see ALL ZIPs that intersect this place, with their coverage %
    const allZipsDebug = await client.query(
      `WITH place AS (SELECT geom FROM geo.place WHERE place_id = $1)
       SELECT 
         z.zip,
         ROUND((ST_Area(ST_Intersection(z.geom, p.geom)::geography) / 
                NULLIF(ST_Area(z.geom::geography), 0) * 100)::numeric, 1) as coverage_pct,
         EXISTS(
           SELECT 1 FROM geo.service_tile_zip stz
           JOIN geo.service_tile st ON st.tile_id = stz.tile_id
           WHERE st.org_id = $2 AND stz.zip = z.zip
         ) as is_assigned
       FROM geo.zcta z, place p
       WHERE ST_Intersects(z.geom, p.geom)
       ORDER BY coverage_pct DESC`,
      [options.placeId, orgId]
    );
    console.log(`\n=== ALL ZIPs for place ${options.placeId} (${placeName}) ===`);
    allZipsDebug.rows.forEach(row => {
      console.log(`  ${row.zip}: ${row.coverage_pct}% coverage ${row.is_assigned ? '(ALREADY ASSIGNED)' : ''}`);
    });

    // Try with 50% threshold first
    // Include ZIPs that are either:
    // 1. Not assigned yet, OR
    // 2. Already assigned BUT this city has better coverage
    let coverageThreshold = 0.50;
    let debugZips = await client.query<{ zip: string; coverage_pct: string; can_steal: boolean }>(
      `WITH place AS (SELECT geom FROM geo.place WHERE place_id = $1),
       current_coverage AS (
         SELECT 
           z.zip,
           ROUND((ST_Area(ST_Intersection(z.geom, p.geom)::geography) / 
                  NULLIF(ST_Area(z.geom::geography), 0) * 100)::numeric, 1) as coverage_pct
         FROM geo.zcta z, place p
         WHERE ST_Intersects(z.geom, p.geom)
           AND (ST_Area(z.geom::geography) = 0 OR 
                (ST_Area(ST_Intersection(z.geom, p.geom)::geography) / ST_Area(z.geom::geography)) >= $3)
       ),
       existing_assignment AS (
         SELECT DISTINCT
           stz.zip,
           st.tile_id,
           (SELECT ST_AsText(geom) FROM geo.service_tile WHERE tile_id = st.tile_id) as tile_geom_text
         FROM geo.service_tile_zip stz
         JOIN geo.service_tile st ON st.tile_id = stz.tile_id
         WHERE st.org_id = $2
       ),
       existing_coverage AS (
         SELECT 
           ea.zip,
           MAX(ROUND((ST_Area(ST_Intersection(z.geom, ST_GeomFromText(ea.tile_geom_text, 4326))::geography) / 
                  NULLIF(ST_Area(z.geom::geography), 0) * 100)::numeric, 1)) as max_existing_coverage_pct
         FROM existing_assignment ea
         JOIN geo.zcta z ON z.zip = ea.zip
         GROUP BY ea.zip
       )
       SELECT DISTINCT
         cc.zip,
         cc.coverage_pct,
         (ea.zip IS NULL OR cc.coverage_pct > COALESCE(ec.max_existing_coverage_pct, 0)) as can_steal
       FROM current_coverage cc
       LEFT JOIN existing_assignment ea ON ea.zip = cc.zip
       LEFT JOIN existing_coverage ec ON ec.zip = cc.zip
       WHERE ea.zip IS NULL OR cc.coverage_pct > COALESCE(ec.max_existing_coverage_pct, 0)`,
      [options.placeId, orgId, coverageThreshold]
    );
    let actualAvailableZipCount = debugZips.rows.length;

    // If no ZIPs meet the 50% threshold, fallback to 10% threshold
    if (actualAvailableZipCount === 0) {
      console.log(`No ZIPs with ≥50% coverage available for place ${options.placeId}, trying 10% threshold...`);
      coverageThreshold = 0.10;
      debugZips = await client.query(
        `WITH place AS (SELECT geom FROM geo.place WHERE place_id = $1),
         existing_zips AS (
           SELECT DISTINCT zip FROM geo.service_tile_zip stz
           JOIN geo.service_tile st ON st.tile_id = stz.tile_id
           WHERE st.org_id = $2
         )
         SELECT z.zip FROM geo.zcta z, place p
         WHERE ST_Intersects(z.geom, p.geom)
           AND z.zip NOT IN (SELECT zip FROM existing_zips)
           AND (ST_Area(z.geom::geography) = 0 OR 
                (ST_Area(ST_Intersection(z.geom, p.geom)::geography) / ST_Area(z.geom::geography)) >= $3)`,
        [options.placeId, orgId, coverageThreshold]
      );
      actualAvailableZipCount = debugZips.rows.length;
    }

    if (actualAvailableZipCount === 0) {
      throw new Error(
        `No ZIP codes available for the selected place (placeId=${options.placeId}). ` +
          `Either the place boundary doesn't intersect with any ZIP codes, or all ZIPs are already assigned to other tiles.`,
      );
    }

    console.log(`Using ${actualAvailableZipCount} available ZIPs with ≥${coverageThreshold * 100}% coverage threshold`);
    console.log(
      `ZIPs available for clustering:`,
      debugZips.rows.map((r) => `${r.zip}${r.can_steal ? " (STEALING - better coverage!)" : ""}`),
    );

    const generationMode = options.generationMode ?? "cluster";
    console.log(`Tile generation mode: ${generationMode}`);

    let clusterCount = Math.max(1, Math.min(requestedTileCount, actualAvailableZipCount));
    if (generationMode === "perZip") {
      clusterCount = actualAvailableZipCount;
    }

    if (generationMode === "cluster" && clusterCount < requestedTileCount) {
      console.log(
        `Note: Requested ${requestedTileCount} tiles, but only ${actualAvailableZipCount} ZIPs are available. Creating ${clusterCount} tiles.`,
      );
    }

    type AggregatedRow = {
      zip_count: string;
      population: string | null;
      zip_list: string[];
      geom_geojson: string;
      geom_simplified_geojson: string;
      area_sq_m: string;
    };

    const candidateZipList = debugZips.rows.map((row) => row.zip);

    let aggregatedRows: AggregatedRow[] = [];

    if (generationMode === "perZip") {
      const perZipRes = await client.query<{
        zip: string;
        population: string | null;
        geom_geojson: string | null;
        geom_simplified_geojson: string | null;
        area_sq_m: string | null;
      }>(
        `WITH place AS (SELECT geom FROM geo.place WHERE place_id = $2),
         candidate AS (SELECT unnest($1::text[]) AS zip)
         SELECT
           c.zip,
           COALESCE(z.population, 0)::text AS population,
           COALESCE(
             ST_AsGeoJSON(ST_Intersection(z.geom, p.geom)),
             ST_AsGeoJSON(z.geom)
           ) AS geom_geojson,
           COALESCE(
             ST_AsGeoJSON(ST_SimplifyPreserveTopology(ST_Intersection(z.geom, p.geom), 0.0005)),
             ST_AsGeoJSON(ST_SimplifyPreserveTopology(z.geom, 0.0005))
           ) AS geom_simplified_geojson,
           COALESCE(
             ST_Area(ST_Intersection(z.geom, p.geom)::geography)::text,
             ST_Area(z.geom::geography)::text
           ) AS area_sq_m
         FROM candidate c
         JOIN geo.zcta z ON z.zip = c.zip
         JOIN place p ON TRUE
         ORDER BY c.zip`,
        [candidateZipList, options.placeId],
      );

      aggregatedRows = perZipRes.rows
        .filter((row) => row.geom_geojson !== null)
        .map((row) => ({
          zip_count: "1",
          population: row.population,
          zip_list: [row.zip],
          geom_geojson: row.geom_geojson as string,
          geom_simplified_geojson: row.geom_simplified_geojson ?? (row.geom_geojson as string),
          area_sq_m: row.area_sq_m ?? "0",
        }));

      if (!aggregatedRows.length) {
        throw new Error(
          `Failed to build per-ZIP tiles for place ${options.placeId}. No candidate ZIP geometries were returned.`,
        );
      }

      console.log(`Per-ZIP generation will create ${aggregatedRows.length} tiles.`);
    } else {
      const aggregatedRes = await client.query<{
        cluster: number;
        zip_count: string;
        population: string | null;
        zip_list: string[];
        geom_geojson: string;
        geom_simplified_geojson: string;
        area_sq_m: string;
      }>(
        `WITH place AS (
           SELECT name, geom FROM geo.place WHERE place_id = $1
         ),
         current_coverage AS (
           SELECT 
             z.zip,
             z.population,
             z.geom,
             ROUND((ST_Area(ST_Intersection(z.geom, p.geom)::geography) / 
                    NULLIF(ST_Area(z.geom::geography), 0) * 100)::numeric, 1) as coverage_pct
           FROM geo.zcta z, place p
           WHERE ST_Intersects(z.geom, p.geom)
             AND (ST_Area(z.geom::geography) = 0 OR 
                  (ST_Area(ST_Intersection(z.geom, p.geom)::geography) / ST_Area(z.geom::geography)) >= $4)
         ),
         existing_assignment AS (
           SELECT DISTINCT
             stz.zip,
             st.tile_id,
             (SELECT ST_AsText(geom) FROM geo.service_tile WHERE tile_id = st.tile_id) as tile_geom_text
           FROM geo.service_tile_zip stz
           JOIN geo.service_tile st ON st.tile_id = stz.tile_id
           WHERE st.org_id = $3
         ),
         existing_coverage AS (
           SELECT 
             ea.zip,
             MAX(ROUND((ST_Area(ST_Intersection(z.geom, ST_GeomFromText(ea.tile_geom_text, 4326))::geography) / 
                    NULLIF(ST_Area(z.geom::geography), 0) * 100)::numeric, 1)) as max_existing_coverage_pct
           FROM existing_assignment ea
           JOIN geo.zcta z ON z.zip = ea.zip
           GROUP BY ea.zip
         ),
         zcta AS (
           SELECT DISTINCT cc.zip, cc.population, cc.geom
           FROM current_coverage cc
           LEFT JOIN existing_assignment ea ON ea.zip = cc.zip
           LEFT JOIN existing_coverage ec ON ec.zip = cc.zip
           WHERE ea.zip IS NULL OR cc.coverage_pct > COALESCE(ec.max_existing_coverage_pct, 0)
         ),
         clustered AS (
           SELECT
             z.*,
             CASE
               WHEN $2 = 1 THEN 0
               ELSE COALESCE(ST_ClusterKMeans(ST_Centroid(z.geom), $2) OVER (), 0)
             END AS cluster
           FROM zcta z
         ),
         aggregated AS (
           SELECT
             cluster,
             COUNT(*)::text AS zip_count,
             COALESCE(SUM(population), 0)::text AS population,
             array_agg(zip ORDER BY zip) AS zip_list,
             ST_AsGeoJSON(ST_Union(geom)) AS geom_geojson,
             ST_AsGeoJSON(ST_SimplifyPreserveTopology(ST_Union(geom), 0.0005)) AS geom_simplified_geojson,
             ST_Area(ST_Union(geom)::geography)::text AS area_sq_m
           FROM clustered
           GROUP BY cluster
         )
         SELECT *
         FROM aggregated
         ORDER BY cluster ASC`,
        [options.placeId, clusterCount, orgId, coverageThreshold],
      );

      if (aggregatedRes.rowCount === 0) {
        throw new Error(
          `Failed to cluster ZIPs for place ${options.placeId}. Generation returned no clusters.`,
        );
      }

      aggregatedRows = aggregatedRes.rows;
    }

    const existingSlugsRes = await client.query<{ slug: string }>(
      `SELECT slug FROM geo.service_tile WHERE org_id = $1`,
      [orgId],
    );
    const slugSet = new Set(existingSlugsRes.rows.map((row) => row.slug));

    // Find existing tiles for this place to continue numbering
    const existingTilesRes = await client.query<{ name: string }>(
      `SELECT name FROM geo.service_tile 
       WHERE org_id = $1 
       AND name LIKE $2`,
      [orgId, `${placeRow.place_name} – Tile %`],
    );
    
    // Extract highest tile number from existing tiles
    let maxTileNumber = 0;
    const tileNumberPattern = new RegExp(`^${placeRow.place_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} – Tile (\\d+)$`);
    for (const row of existingTilesRes.rows) {
      const match = row.name.match(tileNumberPattern);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num > maxTileNumber) {
          maxTileNumber = num;
        }
      }
    }

    const tiles: GeneratedTileSummary[] = [];

    let clusterIndex = maxTileNumber; // Start from highest existing number
    for (const row of aggregatedRows) {
      const zips = row.zip_list;

      if (!zips || zips.length === 0) {
        continue;
      }

      clusterIndex += 1;
      const baseLabel =
        generationMode === "perZip" && zips.length === 1
          ? `${placeRow.place_name} – ZIP ${zips[0]}`
          : `${placeRow.place_name} – Tile ${clusterIndex}`;

      const name = baseLabel;

      const slugSeed =
        generationMode === "perZip" && zips.length === 1
          ? `${placeRow.place_name}-${zips[0]}`
          : `${placeRow.place_name}-${clusterIndex}`;

      let baseSlug = slugify(slugSeed);
      if (!baseSlug) {
        const fallbackSeed =
          generationMode === "perZip" && zips.length === 1
            ? `${placeRow.place_id}-${zips[0]}`
            : `${placeRow.place_id}-${clusterIndex}`;
        baseSlug = slugify(fallbackSeed);
      }

      let slug = baseSlug;
      let suffix = 1;
      while (slugSet.has(slug)) {
        suffix += 1;
        slug = `${baseSlug}-${suffix}`;
      }
      slugSet.add(slug);

      const notes = `Generated ${new Date().toISOString()} from place ${placeRow.place_name} (${options.placeId})`;

      // Calculate MVD defaults based on population
      const tilePopulation = Number(row.population || "0");
      const minScoopers = tilePopulation > 40000 ? 4 : tilePopulation > 30000 ? 3 : tilePopulation > 15000 ? 2 : 1;
      const minCustomerUnits = minScoopers * 15; // Assume ~15 stops per scooper
      const coverageRadiusMeters = 3200; // Default coverage radius

      const insertRes = await client.query<{ tile_id: string }>(
        `INSERT INTO geo.service_tile (
           org_id,
           slug,
           name,
           status,
           geom,
           geom_simplified,
           min_scoopers,
           min_customer_units,
           coverage_radius_m,
           notes,
           created_at,
           updated_at
         )
         VALUES (
           $1,
           $2,
           $3,
           $4,
           ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($5), 4326)),
           ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($6), 4326)),
           $7,
           $8,
           $9,
           $10,
           now(),
           now()
         )
         RETURNING tile_id`,
        [
          orgId,
          slug,
          name,
          status,
          row.geom_geojson,
          row.geom_simplified_geojson,
          minScoopers,
          minCustomerUnits,
          coverageRadiusMeters,
          notes,
        ],
      );

      const tileId = insertRes.rows[0].tile_id;

      // Use assignZipsToTile instead of syncTileZips to avoid overlaps
      // This directly assigns the ZIPs from K-means clustering (row.zip_list)
      await assignZipsToTile(client, tileId, zips, { status, addedBy: createdBy });

      const zipCount = Number(row.zip_count || "0");
      const population = Number(row.population || "0");
      const areaSqMeters = Number(row.area_sq_m || "0");
      const coveragePercent = placeAreaSqMeters
        ? Math.min(100, Number(((areaSqMeters / placeAreaSqMeters) * 100).toFixed(2)))
        : null;

      tiles.push({
        tileId,
        slug,
        name,
        zipCount,
        population,
        areaSqMeters,
        coveragePercent,
        zips,
      });
    }

    await client.query("COMMIT");

    return {
      placeId: placeRow.place_id,
      placeName: placeRow.place_name,
      placeState: placeRow.place_state,
      placeAreaSqMeters,
      placeGeometry,
      tileCount: tiles.length,
      tiles,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
