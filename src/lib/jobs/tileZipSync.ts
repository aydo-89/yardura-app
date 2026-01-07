import type { ServiceTileStatus } from "@prisma/client";

import {
  describePostgisPool,
  getPostgisPool,
} from "@/lib/geo/postgis";

export interface SyncTileZipsOptions {
  orgId: string;
  status?: string;
  dryRun?: boolean;
  logger?: (message: string) => void;
}

export interface SyncTileZipsResult {
  orgId: string;
  tileCount: number;
  inserted: number;
  status: string;
  dryRun: boolean;
  zeroZipTiles: Array<{ slug: string; name: string }>;
}

function normaliseStatus(value?: string): ServiceTileStatus | string {
  if (!value) return "AVAILABLE";
  return value.toUpperCase();
}

export async function syncTileZipsForOrg(
  options: SyncTileZipsOptions,
): Promise<SyncTileZipsResult> {
  const pool = getPostgisPool();
  const client = await pool.connect();

  const log = options.logger ?? ((msg: string) => console.log(`[tile-zip-sync] ${msg}`));
  const status = normaliseStatus(options.status);
  const dryRun = Boolean(options.dryRun);

  log(`PostGIS target: ${describePostgisPool()}`);
  log(`Reconciling tile ZIP coverage for org: ${options.orgId}`);
  if (dryRun) {
    log("Dry run enabled – changes will be rolled back.");
  }

  let inserted = 0;
  let tileCount = 0;
  let zeroZipTiles: Array<{ slug: string; name: string }> = [];

  try {
    await client.query("BEGIN");

    const tileCountRes = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM geo.service_tile WHERE org_id = $1`,
      [options.orgId],
    );
    tileCount = Number(tileCountRes.rows[0]?.count ?? "0");

    if (tileCount === 0) {
      log("No service tiles found for organisation – skipping.");
      await client.query("ROLLBACK");
      return {
        orgId: options.orgId,
        tileCount,
        inserted,
        status,
        dryRun,
        zeroZipTiles,
      };
    }

    if (!dryRun) {
      await client.query(
        `DELETE FROM geo.service_tile_zip WHERE tile_id IN (
          SELECT tile_id FROM geo.service_tile WHERE org_id = $1
        )`,
        [options.orgId],
      );

      const insertResult = await client.query(
        `WITH tile_geom AS (
           SELECT tile_id, geom
           FROM geo.service_tile
           WHERE org_id = $1
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
           tg.tile_id,
           z.zip,
           $2,
           'postgis-sync',
           CASE
             WHEN ST_Area(z.geom::geography) = 0 THEN 1
             ELSE ST_Area(ST_Intersection(z.geom, tg.geom)::geography) / ST_Area(z.geom::geography)
           END,
           now()
         FROM tile_geom tg
         JOIN geo.zcta z ON ST_Intersects(z.geom, tg.geom)
         ORDER BY tg.tile_id, z.zip`,
        [options.orgId, status],
      );
      inserted = insertResult.rowCount ?? 0;
    }

    const zeroRes = await client.query<{ slug: string; name: string; zip_count: string }>(
      `SELECT st.slug, st.name, COUNT(stz.zip)::text AS zip_count
       FROM geo.service_tile st
       LEFT JOIN geo.service_tile_zip stz ON stz.tile_id = st.tile_id
       WHERE st.org_id = $1
       GROUP BY st.tile_id, st.slug, st.name
       ORDER BY st.name`,
      [options.orgId],
    );

    zeroZipTiles = zeroRes.rows
      .filter((row) => Number(row.zip_count ?? "0") === 0)
      .map((row) => ({ slug: row.slug, name: row.name }));

    if (zeroZipTiles.length > 0) {
      zeroZipTiles.forEach((tile) => {
        log(`⚠️  Tile ${tile.slug} (${tile.name}) has no ZIP coverage after sync.`);
      });
    }

    if (dryRun) {
      await client.query("ROLLBACK");
    } else {
      await client.query("COMMIT");
      log(`Synchronized ${inserted.toLocaleString()} tile/ZIP assignments.`);
    }
  } catch (error) {
    await client.query("ROLLBACK");
    log(`❌ Tile ZIP synchronization failed: ${(error as Error).message}`);
    throw error;
  } finally {
    client.release();
  }

  return {
    orgId: options.orgId,
    tileCount,
    inserted,
    status,
    dryRun,
    zeroZipTiles,
  };
}
