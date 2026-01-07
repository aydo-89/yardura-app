/**
 * City-level aggregation of tile data for the /city page
 * Reads real tile status, metrics, and zip coverage from PostGIS
 */

import { query } from "@/lib/geo/postgis";
import { prisma } from "@/lib/prisma";
import type { ServiceTileStatus } from "@prisma/client";
import type { CityStatus } from "@/lib/cityData";

export interface CityTileAggregation {
  citySlug: string;
  cityName: string;
  state: string;
  status: CityStatus;
  tileCount: number;
  liveTileCount: number;
  waitlistTileCount: number;
  draftTileCount: number;
  zipCodes: string[];
  totalPopulation: number;
  activeScoopers: number;
  scheduledStops: number;
  goLiveDate: Date | null;
  waitlistSignups: number; // Count from CityWaitlist table
}

interface TileAggRow {
  city_slug: string;
  city_name: string;
  state: string;
  tile_count: number;
  live_count: number;
  waitlist_count: number;
  draft_count: number;
  zip_codes: string[];
  total_population: number;
  active_scoopers: number;
  scheduled_stops: number;
  earliest_go_live: Date | null;
}

/**
 * Determine overall city status based on tile statuses:
 * - LIVE: At least one tile is LIVE
 * - WAITLIST: No LIVE tiles, but at least one WAITLIST tile
 * - COMING_SOON: All tiles are DRAFT/SUSPENDED or no tiles exist
 */
function determineCityStatus(
  liveCount: number,
  waitlistCount: number,
  totalCount: number
): CityStatus {
  if (liveCount > 0) return "LIVE";
  if (waitlistCount > 0) return "WAITLIST";
  return "COMING_SOON";
}

/**
 * Extract city slug from tile slug (e.g., "minneapolis-7" -> "minneapolis")
 * Handles multi-word cities like "apple-valley-1" -> "apple-valley"
 */
function extractCitySlug(tileSlug: string): string {
  // Remove trailing number segment (e.g., "-7", "-12")
  return tileSlug.replace(/-\d+$/, "");
}

/**
 * Fetch aggregated city data from PostGIS tiles
 * Groups tiles by city and calculates overall metrics
 */
export async function getCityTileAggregations(
  orgId: string = "yardura"
): Promise<CityTileAggregation[]> {
  try {
    console.log("[city-aggregation] Fetching tiles for org:", orgId);
    
    // Query tiles with zip coverage, grouped by city
    // Note: geo.service_tile_metric has coverage stats, not scooper counts
    // Scooper counts come from Prisma's TileMetricSnapshot
    const sql = `
      WITH tile_data AS (
        SELECT
          st.tile_id,
          st.slug,
          st.name,
          st.status
        FROM geo.service_tile st
        WHERE st.org_id = $1
      ),
      tile_zips AS (
        SELECT
          td.tile_id,
          td.slug,
          array_agg(DISTINCT stz.zip) FILTER (WHERE stz.zip IS NOT NULL) AS zips,
          COALESCE(SUM(z.population), 0) AS population
        FROM tile_data td
        LEFT JOIN geo.service_tile_zip stz ON stz.tile_id = td.tile_id
        LEFT JOIN geo.zcta z ON z.zip = stz.zip
        GROUP BY td.tile_id, td.slug
      ),
      city_groups AS (
        SELECT
          -- Extract city slug by removing trailing -N
          regexp_replace(td.slug, '-[0-9]+$', '') AS city_slug,
          -- Use the name without number suffix as city name
          regexp_replace(td.name, ' [0-9]+$', '') AS city_name,
          COUNT(*) AS tile_count,
          COUNT(*) FILTER (WHERE td.status = 'LIVE') AS live_count,
          COUNT(*) FILTER (WHERE td.status = 'WAITLIST') AS waitlist_count,
          COUNT(*) FILTER (WHERE td.status IN ('DRAFT', 'SUSPENDED')) AS draft_count,
          -- Combine all zip codes for the city
          array_agg(DISTINCT unnest_zip) FILTER (WHERE unnest_zip IS NOT NULL) AS zip_codes,
          -- Sum population across all tiles
          COALESCE(SUM(tz.population), 0)::bigint AS total_population
        FROM tile_data td
        LEFT JOIN tile_zips tz ON tz.tile_id = td.tile_id
        LEFT JOIN LATERAL unnest(tz.zips) AS unnest_zip ON true
        GROUP BY 
          regexp_replace(td.slug, '-[0-9]+$', ''),
          regexp_replace(td.name, ' [0-9]+$', '')
      )
      SELECT
        city_slug,
        city_name,
        'MN' AS state,
        tile_count::int,
        live_count::int,
        waitlist_count::int,
        draft_count::int,
        COALESCE(zip_codes, ARRAY[]::text[]) AS zip_codes,
        total_population::bigint,
        0 AS active_scoopers,
        0 AS scheduled_stops,
        NULL::timestamptz AS earliest_go_live
      FROM city_groups
      ORDER BY 
        CASE 
          WHEN live_count > 0 THEN 0
          WHEN waitlist_count > 0 THEN 1
          ELSE 2
        END,
        city_name ASC;
    `;

    const { rows } = await query<TileAggRow>(sql, [orgId]);
    
    console.log("[city-aggregation] Found", rows.length, "city groups from tiles");
    if (rows.length > 0) {
      console.log("[city-aggregation] Sample:", rows.slice(0, 3).map(r => ({
        city: r.city_name,
        status: determineCityStatus(r.live_count, r.waitlist_count, r.tile_count),
        tiles: r.tile_count,
        live: r.live_count,
      })));
    }

    // Fetch waitlist signup counts by city
    let waitlistCounts: Map<string, number> = new Map();
    try {
      const waitlistAgg = await prisma.cityWaitlist.groupBy({
        by: ["cityName"],
        _count: { id: true },
      });
      waitlistCounts = new Map(
        waitlistAgg.map((w) => [w.cityName.toLowerCase(), w._count.id])
      );
      console.log("[city-aggregation] Waitlist counts:", Object.fromEntries(waitlistCounts));
    } catch (waitlistError) {
      console.warn("[city-aggregation] Could not fetch waitlist counts:", waitlistError);
    }

    return rows.map((row) => {
      // Match waitlist count by city name (case-insensitive)
      const waitlistSignups = waitlistCounts.get(row.city_name.toLowerCase()) ?? 0;
      
      return {
        citySlug: row.city_slug,
        cityName: row.city_name,
        state: row.state,
        status: determineCityStatus(row.live_count, row.waitlist_count, row.tile_count),
        tileCount: row.tile_count,
        liveTileCount: row.live_count,
        waitlistTileCount: row.waitlist_count,
        draftTileCount: row.draft_count,
        zipCodes: row.zip_codes || [],
        totalPopulation: Number(row.total_population) || 0,
        activeScoopers: row.active_scoopers,
        scheduledStops: row.scheduled_stops,
        goLiveDate: row.earliest_go_live,
        waitlistSignups,
      };
    });
  } catch (error) {
    console.error("[city-aggregation] Failed to fetch tile aggregations:", error);
    return [];
  }
}

/**
 * Merge static city data with live tile aggregations
 * Falls back to static data for cities without tiles
 * Also checks if city's ZIPs are covered by any LIVE tile
 */
export async function mergeCityWithTileData(
  staticCities: Array<{ name: string; displayName: string; state: string; population: number; zipCodes?: string[] }>,
  tileAggregations: CityTileAggregation[]
): Promise<Array<{
  name: string;
  displayName: string;
  state: string;
  liveStatus: CityStatus;
  tileCount: number;
  zipCount: number;
  population: number;
  activeScoopers: number;
  hasLiveTiles: boolean;
  waitlistSignups: number;
  zipCodes: string[];
}>> {
  const tileMap = new Map(tileAggregations.map((t) => [t.citySlug, t]));
  
  // Build a set of all ZIPs covered by LIVE tiles
  const liveZips = new Set<string>();
  tileAggregations.forEach((t) => {
    if (t.status === "LIVE") {
      t.zipCodes.forEach((zip) => liveZips.add(zip));
    }
  });
  console.log("[city-aggregation] Live ZIPs count:", liveZips.size);

  return staticCities.map((city) => {
    const tileData = tileMap.get(city.name);
    const cityZips = city.zipCodes ?? [];

    if (tileData) {
      return {
        name: city.name,
        displayName: city.displayName,
        state: city.state,
        liveStatus: tileData.status,
        tileCount: tileData.tileCount,
        zipCount: tileData.zipCodes.length,
        population: tileData.totalPopulation || city.population,
        activeScoopers: tileData.activeScoopers,
        hasLiveTiles: tileData.liveTileCount > 0,
        waitlistSignups: tileData.waitlistSignups,
        zipCodes: tileData.zipCodes.length > 0 ? tileData.zipCodes : cityZips,
      };
    }

    // No direct tile data - check if any of the city's ZIPs are covered by LIVE tiles
    const hasLiveZipCoverage = cityZips.some((zip) => liveZips.has(zip));
    
    if (hasLiveZipCoverage) {
      console.log(`[city-aggregation] ${city.displayName} has LIVE coverage via ZIP overlap`);
    }

    return {
      name: city.name,
      displayName: city.displayName,
      state: city.state,
      liveStatus: hasLiveZipCoverage ? "LIVE" : ("COMING_SOON" as CityStatus),
      tileCount: 0,
      zipCount: cityZips.length,
      population: city.population,
      activeScoopers: 0,
      hasLiveTiles: hasLiveZipCoverage,
      waitlistSignups: 0,
      zipCodes: cityZips,
    };
  });
}

