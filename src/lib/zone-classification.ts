/**
 * Smart Zone Classification System
 *
 * Classifies ZIP codes into zone types (Urban Core, Suburban, Rural)
 * based on actual population density data from US Census ZCTA.
 *
 * Density thresholds (people per square mile):
 * - Urban Core: > 3,000 (dense city cores, downtown areas)
 * - Suburban: 500-3,000 (typical residential suburbs)
 * - Rural: < 500 (countryside, farmland, sparse population)
 */

import { query } from "./geo/postgis";
import type { ServiceZoneConfig } from "./business-config";

export type ZoneType = "urban-core" | "suburban" | "rural";

export interface ZoneClassification {
  zoneType: ZoneType;
  zoneName: string;
  zoneId: string;
  baseMultiplier: number;
  description: string;
  source: "density" | "static" | "fallback";
  populationDensity?: number; // people per sq mile
  population?: number;
  areaSqMiles?: number;
}

// Density thresholds (people per square mile)
const URBAN_CORE_THRESHOLD = 3000; // > 3,000/sq mi = urban core
const SUBURBAN_THRESHOLD = 500;    // 500-3,000/sq mi = suburban
// < 500/sq mi = rural

// Zone configurations with pricing multipliers
const ZONE_CONFIGS: Record<ZoneType, Omit<ZoneClassification, "source" | "populationDensity" | "population" | "areaSqMiles">> = {
  "urban-core": {
    zoneType: "urban-core",
    zoneName: "Urban Core",
    zoneId: "zone-urban-core",
    baseMultiplier: 1.2, // 20% premium for dense urban areas
    description: "High-density urban area with excellent route efficiency",
  },
  suburban: {
    zoneType: "suburban",
    zoneName: "Suburban",
    zoneId: "zone-suburban",
    baseMultiplier: 1.0, // Base pricing
    description: "Standard residential suburban area",
  },
  rural: {
    zoneType: "rural",
    zoneName: "Rural",
    zoneId: "zone-rural",
    baseMultiplier: 0.95, // 5% discount for rural (longer drives, fewer stops)
    description: "Rural area with extended travel between stops",
  },
};

/**
 * Get zone classification for a ZIP code based on population density
 */
export async function classifyZipByDensity(zipCode: string): Promise<ZoneClassification | null> {
  const cleanZip = zipCode.replace(/\D/g, "").padStart(5, "0").slice(0, 5);

  try {
    // Query PostGIS for ZIP population and area
    const result = await query<{
      zip: string;
      population: number | null;
      area_sq_m: number | null;
    }>(
      `SELECT zip, population, area_sq_m
       FROM geo.zcta
       WHERE zip = $1
       LIMIT 1`,
      [cleanZip]
    );

    if (!result.rows.length || result.rows[0].area_sq_m === null) {
      return null;
    }

    const row = result.rows[0];
    const population = row.population ?? 0;
    const areaSqMeters = row.area_sq_m ?? 0;

    // Convert sq meters to sq miles (1 sq mile = 2,589,988 sq meters)
    const areaSqMiles = areaSqMeters / 2_589_988;

    // Avoid division by zero for very small areas
    if (areaSqMiles < 0.01) {
      // Tiny area with any population = urban core
      const zoneType: ZoneType = population > 100 ? "urban-core" : "suburban";
      return {
        ...ZONE_CONFIGS[zoneType],
        source: "density",
        populationDensity: population / Math.max(areaSqMiles, 0.01),
        population,
        areaSqMiles,
      };
    }

    // Calculate population density (people per sq mile)
    const density = population / areaSqMiles;

    // Classify based on density thresholds
    let zoneType: ZoneType;
    if (density > URBAN_CORE_THRESHOLD) {
      zoneType = "urban-core";
    } else if (density >= SUBURBAN_THRESHOLD) {
      zoneType = "suburban";
    } else {
      zoneType = "rural";
    }

    return {
      ...ZONE_CONFIGS[zoneType],
      source: "density",
      populationDensity: Math.round(density),
      population,
      areaSqMiles: Math.round(areaSqMiles * 100) / 100,
    };
  } catch (error) {
    console.warn(`[zone-classification] Failed to classify ZIP ${cleanZip} by density:`, error);
    return null;
  }
}

/**
 * Convert ZoneClassification to ServiceZoneConfig format for backward compatibility
 */
export function toServiceZoneConfig(classification: ZoneClassification): ServiceZoneConfig {
  return {
    zoneId: classification.zoneId,
    name: classification.zoneName,
    baseMultiplier: classification.baseMultiplier,
    description: classification.description,
    serviceable: true,
    zipCodes: [], // Not used for density-based classification
  };
}

/**
 * Get a fallback zone classification (suburban) when database is unavailable
 */
export function getFallbackZone(): ZoneClassification {
  return {
    ...ZONE_CONFIGS.suburban,
    source: "fallback",
  };
}

/**
 * Get zone type label for display
 */
export function getZoneLabel(zoneType: ZoneType): string {
  return ZONE_CONFIGS[zoneType].zoneName;
}

/**
 * Get zone multiplier for pricing
 */
export function getZoneMultiplier(zoneType: ZoneType): number {
  return ZONE_CONFIGS[zoneType].baseMultiplier;
}

/**
 * Debug helper: Log density thresholds
 */
export function logDensityThresholds(): void {
  console.log(`Zone Classification Thresholds (people/sq mile):
  - Urban Core: > ${URBAN_CORE_THRESHOLD}
  - Suburban: ${SUBURBAN_THRESHOLD} - ${URBAN_CORE_THRESHOLD}
  - Rural: < ${SUBURBAN_THRESHOLD}
  
Zone Multipliers:
  - Urban Core: ${ZONE_CONFIGS["urban-core"].baseMultiplier}x
  - Suburban: ${ZONE_CONFIGS.suburban.baseMultiplier}x
  - Rural: ${ZONE_CONFIGS.rural.baseMultiplier}x`);
}






