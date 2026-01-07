/**
 * ZIP Code Eligibility and Zone Pricing Service
 *
 * Handles service area validation and zone-based pricing adjustments
 * Uses configurable business settings for multi-tenant support
 */

import {
  getZoneForZip,
  getZoneMultiplierForZip,
  isZipServiceable,
  ServiceZoneConfig,
  getServiceableZips,
  addZipsToZone,
  createServiceZone,
  getBusinessConfig,
} from "./business-config";
import { getPrimaryCityForZip } from "@/lib/zip-data";
import { resolveTileSlugForCity } from "@/lib/marketplace/tile-map";
import { getTileReadinessBySlug } from "@/lib/marketplace";
import { getTileRepository } from "@/lib/tiles/repository";
import { classifyZipByDensity, type ZoneClassification } from "./zone-classification";
import { properCapitalize } from "@/lib/geo/normalize";
import type { ServiceTileStatus } from "@prisma/client";

// Re-export types for backward compatibility
export type ServiceZone = ServiceZoneConfig;

// Re-export functions from business-config for convenience
export { getZoneMultiplierForZip } from "./business-config";

export interface DensityClassification {
  zoneType: "urban-core" | "suburban" | "rural";
  zoneName: string;
  baseMultiplier: number;
  populationDensity?: number; // people per sq mile
  population?: number;
  areaSqMiles?: number;
  source: "density" | "static" | "fallback";
}

export interface ZipEligibilityResult {
  eligible: boolean;
  zone?: ServiceZone;
  message: string;
  estimatedDelivery?: string;
  densityClassification?: DensityClassification;
  // City/state info for the ZIP code
  cityInfo?: {
    city: string;
    state: string;
  } | null;
  tile?: {
    slug: string;
    status: ServiceTileStatus;
    activationEligible: boolean;
    advisoryReasons: string[];
    goLiveDate?: string | null;
  } | null;
}

/**
 * Check if a ZIP code is eligible for service
 */
export async function checkZipEligibility(
  zipCode: string,
  businessId: string = "yardura",
): Promise<ZipEligibilityResult> {
  try {
    console.log("Checking ZIP eligibility for:", zipCode, businessId);

    const usePostgisTiles = process.env.ENABLE_POSTGIS_TILES === "true";
    const tileRepository = getTileRepository();
    let readiness = null;
    let tileSlug: string | null = null;
    let tileStatus: ServiceTileStatus | null = null;

    if (usePostgisTiles) {
      try {
        const tileForZip = await tileRepository.findTileByZip(businessId, zipCode, {
          metricsLimit: 1,
        });
        if (tileForZip) {
          tileSlug = tileForZip.tile.slug;
          tileStatus = tileForZip.tile.status;
          try {
            readiness = await getTileReadinessBySlug(businessId, tileSlug);
          } catch (readinessError) {
            console.warn("getTileReadinessBySlug failed, continuing without readiness", {
              businessId,
              tileSlug,
              error: readinessError,
            });
          }
          console.log("PostGIS tile match:", tileSlug, readiness?.tile?.status);
        }
      } catch (postgisError) {
        console.warn("PostGIS findTileByZip failed, falling back to legacy eligibility", {
          businessId,
          zipCode,
          error: postgisError,
        });
      }
    }

    const zone = await getZoneForZip(zipCode, businessId);
    console.log("getZoneForZip result:", zone);

    // Get city/state info for the ZIP code
    const rawCityInfo = getPrimaryCityForZip(zipCode);
    const cityInfo = rawCityInfo
      ? {
          city: properCapitalize(rawCityInfo.city),
          state: rawCityInfo.state,
        }
      : null;
    console.log("City info for ZIP:", cityInfo);

    // Get density classification for additional context
    let densityClassification: DensityClassification | undefined;
    try {
      const classification = await classifyZipByDensity(zipCode);
      if (classification) {
        densityClassification = {
          zoneType: classification.zoneType,
          zoneName: classification.zoneName,
          baseMultiplier: classification.baseMultiplier,
          populationDensity: classification.populationDensity,
          population: classification.population,
          areaSqMiles: classification.areaSqMiles,
          source: classification.source,
        };
        console.log(`[zip-eligibility] Density classification for ${zipCode}:`, densityClassification);
      }
    } catch (densityError) {
      console.warn("[zip-eligibility] Could not get density classification:", densityError);
    }

    let eligible = false;

    if (readiness) {
      tileStatus = readiness.tile.status;
      eligible = tileStatus === "LIVE";
    }

    if (!eligible) {
      const legacyEligible = await isZipServiceable(zipCode, businessId);
      console.log("isZipServiceable result:", legacyEligible);
      eligible = legacyEligible;

      if (!readiness && legacyEligible) {
        const cityEntry = getPrimaryCityForZip(zipCode) as { city: string; state: string } | null;
        const fallbackCity = cityEntry?.city ? properCapitalize(cityEntry.city) : undefined;
        const fallbackTile = await resolveTileSlugForCity(
          businessId,
          fallbackCity,
        );
        if (fallbackTile) {
          try {
            readiness = await getTileReadinessBySlug(businessId, fallbackTile.slug);
          } catch (fallbackReadinessError) {
            console.warn("getTileReadinessBySlug (fallback) failed, continuing", {
              businessId,
              slug: fallbackTile.slug,
              error: fallbackReadinessError,
            });
          }
          tileSlug = fallbackTile.slug;
          tileStatus = readiness?.tile.status ?? tileStatus;
        }
      }
    }

    let tileDetails: ZipEligibilityResult["tile"] = null;
    if (readiness) {
      tileDetails = {
        slug: readiness.tile.slug,
        status: readiness.tile.status,
        activationEligible: readiness.activationEligible,
        advisoryReasons: readiness.advisoryReasons,
        goLiveDate: readiness.tile.goLiveDate?.toISOString() ?? null,
      };
    } else if (tileSlug && tileStatus) {
      tileDetails = {
        slug: tileSlug,
        status: tileStatus,
        activationEligible: false,
        advisoryReasons: [],
        goLiveDate: null,
      };
    }

    if (eligible && zone) {
      const estimatedDelivery = await getEstimatedDeliveryTime(
        zipCode,
        businessId,
      );
      return {
        eligible: true,
        zone,
        message: `Service available in ${zone.name}`,
        estimatedDelivery,
        densityClassification,
        cityInfo,
        tile: tileDetails,
      };
    }

    if (tileDetails) {
      return {
        eligible: false,
        message: "Outside Service Area",
        cityInfo,
        densityClassification,
        tile: tileDetails,
      };
    }

    return {
      eligible: false,
      message: "Outside Service Area",
      densityClassification,
      cityInfo,
      tile: null,
    };
  } catch (error) {
    console.error("ZIP eligibility check error:", error);
    return { eligible: false, message: "Unable to check ZIP eligibility", cityInfo: null };
  }
}

/**
 * Get zone-based price adjustment for a ZIP code
 */
export async function getZonePriceMultiplier(
  zipCode: string,
  businessId: string = "yardura",
): Promise<number> {
  return await getZoneMultiplierForZip(zipCode, businessId);
}

/**
 * Get estimated delivery time based on ZIP and business configuration
 */
export async function getEstimatedDeliveryTime(
  zipCode: string,
  businessId: string = "yardura",
): Promise<string> {
  const zone = await getZoneForZip(zipCode, businessId);

  if (!zone) {
    return "Service scheduling timeline will be confirmed upon quote completion.";
  }

  // Use business configuration for delivery estimates
  const config = await getBusinessConfig(businessId);

  switch (zone.zoneId) {
    case "zone-urban-core":
      return "Service typically scheduled within 2-3 business days.";
    case "zone-suburban":
      return "Service typically scheduled within 3-5 business days.";
    case "zone-rural":
      return "Service typically scheduled within 5-7 business days due to travel distance.";
    default:
      return "Service scheduling timeline will be confirmed upon quote completion.";
  }
}

/**
 * Get all serviceable ZIP codes (for admin use)
 */
export async function getAllServiceableZips(
  businessId: string = "yardura",
): Promise<string[]> {
  const config = await getBusinessConfig(businessId);
  return config.serviceZones
    .filter((zone: ServiceZoneConfig) => zone.serviceable)
    .flatMap((zone: ServiceZoneConfig) => zone.zipCodes);
}

/**
 * Get zone information for a ZIP code
 */
export async function getZoneInfo(
  zipCode: string,
  businessId: string = "yardura",
): Promise<ServiceZone | null> {
  return await getZoneForZip(zipCode, businessId);
}

/**
 * Add new ZIP code to service area (admin function)
 */
export async function addZipToService(
  zipCode: string,
  zoneId: string,
  businessId: string = "yardura",
): Promise<boolean> {
  return await addZipsToZone(businessId, zoneId, [zipCode]);
}

/**
 * Get all available zones for a business
 */
export async function getAvailableZones(
  businessId: string = "yardura",
): Promise<ServiceZone[]> {
  const config = await getBusinessConfig(businessId);
  return config.serviceZones;
}
