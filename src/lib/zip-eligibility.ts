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

// Re-export types for backward compatibility
export type ServiceZone = ServiceZoneConfig;

// Re-export functions from business-config for convenience
export { getZoneMultiplierForZip } from "./business-config";

export interface ZipEligibilityResult {
  eligible: boolean;
  zone?: ServiceZone;
  message: string;
  estimatedDelivery?: string;
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
    const isEligible = await isZipServiceable(zipCode, businessId);
    console.log("isZipServiceable result:", isEligible);
    const zone = await getZoneForZip(zipCode, businessId);
    console.log("getZoneForZip result:", zone);

    if (isEligible && zone) {
      const estimatedDelivery = await getEstimatedDeliveryTime(
        zipCode,
        businessId,
      );
      return {
        eligible: true,
        zone,
        message: `Service available in ${zone.name}`,
        estimatedDelivery,
      };
    } else {
      return {
        eligible: false,
        message: "Outside Service Area",
      };
    }
  } catch (error) {
    console.error("ZIP eligibility check error:", error);
    return { eligible: false, message: "Unable to check ZIP eligibility" };
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
