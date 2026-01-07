import { closePostgisPool, getPostgisPool } from "@/lib/geo/postgis";
import { syncTileZipsForOrg } from "@/lib/jobs/tileZipSync";

const orgArg = process.argv.find((arg) => arg.startsWith("--org="));

async function fetchOrgIds(): Promise<string[]> {
  const pool = getPostgisPool();
  const { rows } = await pool.query<{ org_id: string }>(
    `SELECT DISTINCT org_id FROM geo.service_tile ORDER BY org_id`,
  );
  return rows.map((row) => row.org_id);
}

(async () => {
  try {
    const explicitOrg = orgArg ? orgArg.split("=")[1] : undefined;
    const targetOrgIds = explicitOrg ? [explicitOrg] : await fetchOrgIds();

    if (targetOrgIds.length === 0) {
      console.log("[tile-zip-sync] No service tiles found for any organisation." );
      await closePostgisPool();
      process.exit(0);
    }

    for (const orgId of targetOrgIds) {
      console.log(`\n[tile-zip-sync] Running sync for org ${orgId}`);
      const result = await syncTileZipsForOrg({ orgId });
      if (result.zeroZipTiles.length > 0) {
        console.warn(
          `[tile-zip-sync] ${result.zeroZipTiles.length} tile(s) missing coverage:`,
          result.zeroZipTiles.map((tile) => `${tile.slug} (${tile.name})`).join(", "),
        );
      }
    }

    await closePostgisPool();
    process.exit(0);
  } catch (error) {
    console.error("[tile-zip-sync] job failed", error);
    await closePostgisPool();
    process.exit(1);
  }
})();
