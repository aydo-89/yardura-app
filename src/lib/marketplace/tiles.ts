import { getTileRepository } from "@/lib/tiles/repository";
import { prisma } from "@/lib/prisma";
import type { TileMetricRecord, TileReadiness, TileWithContext } from "@/lib/tiles/types";

// Default waitlist threshold if population data unavailable
const DEFAULT_MIN_WAITLIST = 15;

// Population-based thresholds for MVD
// Larger cities need more signups to indicate real demand
const POPULATION_THRESHOLDS = [
  { maxPop: 10_000, minSignups: 10 },    // Small towns: 10 signups
  { maxPop: 50_000, minSignups: 15 },    // Small cities: 15 signups
  { maxPop: 100_000, minSignups: 25 },   // Medium cities: 25 signups
  { maxPop: 250_000, minSignups: 40 },   // Large cities: 40 signups
  { maxPop: 500_000, minSignups: 60 },   // Major cities: 60 signups
  { maxPop: Infinity, minSignups: 100 }, // Metro areas: 100 signups
];

/**
 * Calculate minimum waitlist signups needed based on population
 */
function calculateMinWaitlistSignups(population?: number | null): number {
  if (!population || population <= 0) {
    return DEFAULT_MIN_WAITLIST;
  }
  
  const tier = POPULATION_THRESHOLDS.find(t => population <= t.maxPop);
  return tier?.minSignups ?? DEFAULT_MIN_WAITLIST;
}

function extractLatestSnapshot(metrics: readonly TileMetricRecord[]): TileMetricRecord | null {
  if (!metrics.length) return null;
  return metrics.reduce((latest, metric) =>
    !latest || metric.weekOf > latest.weekOf ? metric : latest,
  );
}

/**
 * Get waitlist signups for a tile by matching city name from tile slug
 * Tile slugs are typically like "minneapolis-1", "st-paul-2", etc.
 */
async function getWaitlistCountForTile(tileSlug: string): Promise<number> {
  try {
    // Extract city name from tile slug (e.g., "minneapolis-1" -> "minneapolis")
    const cityNameFromSlug = tileSlug
      .replace(/-\d+$/, "") // Remove trailing numbers
      .replace(/-/g, " ") // Replace dashes with spaces
      .toLowerCase();

    // Query waitlist for matching city names (case-insensitive)
    const count = await prisma.cityWaitlist.count({
      where: {
        cityName: {
          contains: cityNameFromSlug,
          mode: "insensitive",
        },
      },
    });

    return count;
  } catch (error) {
    // Table might not exist yet or other error - return 0
    console.warn(`[tiles] Could not get waitlist count for ${tileSlug}:`, error);
    return 0;
  }
}

/**
 * Get population estimate for a tile from PostGIS
 * Uses the city name from the tile slug to look up in geo.place
 */
async function getPopulationForTile(tileSlug: string): Promise<{ population: number | null; source: "postgis" | "static" | "unknown" }> {
  try {
    // Extract city name from tile slug
    const cityNameFromSlug = tileSlug
      .replace(/-\d+$/, "")
      .replace(/-/g, " ");

    // Try PostGIS geo.place table first
    const result = await prisma.$queryRaw<{ population: number }[]>`
      SELECT population
      FROM geo.place
      WHERE LOWER(name) = LOWER(${cityNameFromSlug})
      AND population IS NOT NULL
      ORDER BY population DESC
      LIMIT 1
    `;

    if (result.length > 0 && result[0].population) {
      return { population: result[0].population, source: "postgis" };
    }

    return { population: null, source: "unknown" };
  } catch (error) {
    console.warn(`[tiles] Could not get population for ${tileSlug}:`, error);
    return { population: null, source: "unknown" };
  }
}

interface BuildReadinessOptions {
  waitlistSignups?: number;
  estimatedPopulation?: number | null;
  populationSource?: "postgis" | "static" | "unknown";
}

function buildReadiness(entry: TileWithContext, options: BuildReadinessOptions = {}): TileReadiness {
  const { 
    waitlistSignups = 0, 
    estimatedPopulation = null,
    populationSource = "unknown"
  } = options;

  const latestSnapshot = extractLatestSnapshot(entry.metrics);
  
  // Calculate population-based waitlist threshold
  const minWaitlistSignups = calculateMinWaitlistSignups(estimatedPopulation);
  
  const thresholds = {
    minCertifiedScoopers: entry.tile.minCertifiedScoopers,
    minCustomerUnits: entry.tile.minCustomerUnits,
    minWaitlistSignups,
  };

  const activeScoopers = latestSnapshot?.activeScoopers ?? 0;
  const scheduledStops = latestSnapshot?.scheduledStops ?? 0;

  const unmetScooperCount = Math.max(0, thresholds.minCertifiedScoopers - activeScoopers);
  const unmetCustomerCount = Math.max(0, thresholds.minCustomerUnits - scheduledStops);
  
  // For MVD: waitlist signups is the PRIMARY demand metric for DRAFT/WAITLIST tiles
  const unmetWaitlistCount = Math.max(0, minWaitlistSignups - waitlistSignups);

  const advisoryReasons: string[] = [];

  // Scooper requirements apply to all statuses
  if (unmetScooperCount > 0) {
    advisoryReasons.push(
      `Needs ${unmetScooperCount} more certified scooper${unmetScooperCount === 1 ? "" : "s"}.`,
    );
  }

  // For DRAFT/WAITLIST tiles: use waitlist signups as demand metric (MVD)
  // For LIVE tiles: use actual customer counts
  const isPreLaunch = entry.tile.status === "DRAFT" || entry.tile.status === "WAITLIST";
  
  if (isPreLaunch) {
    // MVD: Show waitlist progress
    if (unmetWaitlistCount > 0) {
      advisoryReasons.push(
        `${waitlistSignups}/${minWaitlistSignups} waitlist signups for MVD.`,
      );
    } else {
      advisoryReasons.push(
        `✓ Waitlist MVD reached (${waitlistSignups}/${minWaitlistSignups}).`,
      );
    }
  } else if (unmetCustomerCount > 0) {
    // LIVE tiles: show actual customer demand
    advisoryReasons.push(
      `Needs ${unmetCustomerCount} more weekly stop${unmetCustomerCount === 1 ? "" : "s"}.`,
    );
  }

  if (entry.tile.status === "SUSPENDED") {
    advisoryReasons.push("Tile is suspended.");
  }

  // LIVE tile activation: based on scoopers + actual customers
  const activationEligible =
    entry.tile.status !== "SUSPENDED" &&
    unmetScooperCount === 0 &&
    unmetCustomerCount === 0;

  // MVD eligibility for DRAFT/WAITLIST tiles: based on scoopers + waitlist signups
  const waitlistMvdEligible =
    entry.tile.status !== "SUSPENDED" &&
    unmetScooperCount === 0 &&
    unmetWaitlistCount === 0;

  return {
    tile: { ...entry.tile, territory: entry.territory ?? null },
    latestSnapshot,
    thresholds,
    activationEligible,
    waitlistMvdEligible,
    unmetScooperCount,
    unmetCustomerCount,
    unmetWaitlistCount,
    advisoryReasons,
    waitlistSignups,
    estimatedPopulation: estimatedPopulation ?? undefined,
    populationSource,
  };
}

export async function getTileReadiness(tileId: string): Promise<TileReadiness | null> {
  const repository = getTileRepository();
  const tile = await repository.getTileById(tileId);
  if (!tile) return null;
  
  const [waitlistSignups, populationData] = await Promise.all([
    getWaitlistCountForTile(tile.tile.slug),
    getPopulationForTile(tile.tile.slug),
  ]);
  
  return buildReadiness(tile, {
    waitlistSignups,
    estimatedPopulation: populationData.population,
    populationSource: populationData.source,
  });
}

export async function getTileReadinessBySlug(
  orgId: string,
  slug: string,
): Promise<TileReadiness | null> {
  const repository = getTileRepository();
  const tile = await repository.getTileBySlug(orgId, slug);
  if (!tile) return null;
  
  const [waitlistSignups, populationData] = await Promise.all([
    getWaitlistCountForTile(slug),
    getPopulationForTile(slug),
  ]);
  
  return buildReadiness(tile, {
    waitlistSignups,
    estimatedPopulation: populationData.population,
    populationSource: populationData.source,
  });
}

export async function listTileReadiness(orgId: string): Promise<TileReadiness[]> {
  const repository = getTileRepository();
  const tiles = await repository.listTiles(orgId);
  
  // Fetch waitlist counts and population data in parallel for all tiles
  const [waitlistCounts, populationData] = await Promise.all([
    Promise.all(tiles.map((tile) => getWaitlistCountForTile(tile.tile.slug))),
    Promise.all(tiles.map((tile) => getPopulationForTile(tile.tile.slug))),
  ]);
  
  return tiles.map((tile, index) => buildReadiness(tile, {
    waitlistSignups: waitlistCounts[index],
    estimatedPopulation: populationData[index].population,
    populationSource: populationData[index].source,
  }));
}

export function summarizeTileReadiness(readiness: TileReadiness) {
  const isPreLaunch = readiness.tile.status === "DRAFT" || readiness.tile.status === "WAITLIST";
  
  return {
    tileId: readiness.tile.id,
    tileSlug: readiness.tile.slug,
    tileName: readiness.tile.name,
    status: readiness.tile.status,
    goLiveDate: readiness.tile.goLiveDate,
    // For LIVE tiles: activation based on customers
    activationEligible: readiness.activationEligible,
    // For DRAFT/WAITLIST tiles: MVD based on waitlist signups
    waitlistMvdEligible: readiness.waitlistMvdEligible,
    // Use appropriate eligibility based on tile status
    launchReady: isPreLaunch ? readiness.waitlistMvdEligible : readiness.activationEligible,
    unmetScooperCount: readiness.unmetScooperCount,
    unmetCustomerCount: readiness.unmetCustomerCount,
    unmetWaitlistCount: readiness.unmetWaitlistCount,
    minCertifiedScoopers: readiness.thresholds.minCertifiedScoopers,
    minCustomerUnits: readiness.thresholds.minCustomerUnits,
    minWaitlistSignups: readiness.thresholds.minWaitlistSignups,
    coverageRadiusMeters: readiness.tile.coverageRadiusMeters,
    territoryId: readiness.tile.territoryId,
    latestSnapshot: readiness.latestSnapshot,
    thresholds: readiness.thresholds,
    advisoryReasons: readiness.advisoryReasons,
    // Waitlist/demand data
    waitlistSignups: readiness.waitlistSignups,
    // Population data for threshold context
    estimatedPopulation: readiness.estimatedPopulation,
    populationSource: readiness.populationSource,
  };
}
