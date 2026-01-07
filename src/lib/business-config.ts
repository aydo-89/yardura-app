/**
 * Business Configuration System
 *
 * Allows different businesses to customize:
 * - Service areas and ZIP codes
 * - Zone-based pricing multipliers
 * - Pricing rules and tiers
 * - Business-specific settings
 * - Add-on configurations
 */

import { prisma } from "@/lib/prisma";

import defaultBusinessConfig from "../../config/default-business-config.json";

export interface ServiceZoneConfig {
  zoneId: string;
  name: string;
  baseMultiplier: number;
  description: string;
  serviceable: boolean;
  zipCodes: string[]; // Array of ZIP codes in this zone
}

export interface PricingTier {
  dogCount: number;
  basePriceCents: number;
  extraDogPriceCents?: number; // Price per additional dog beyond this tier
}

export interface FrequencyPricing {
  frequency: "weekly" | "twice-weekly" | "daily" | "bi-weekly" | "monthly" | "one-time";
  multiplier: number;
  visitsPerMonth: number;
}

export interface AddOnConfig {
  id: string;
  name: string;
  priceCents: number;
  description: string;
  available: boolean;
  billingMode: "first-visit" | "each-visit" | "every-other" | "one-time";
  required: boolean;
}

export interface YardSizePricing {
  size: "small" | "medium" | "large" | "xlarge";
  multiplier: number;
  description: string;
  enabled: boolean;
}

export interface AreaPricing {
  baseAreas: number; // Number of areas included in base price
  extraAreaCostCents: number; // Cost per additional area
  recurringExtraAreaCostCents: number; // Cost per additional area for recurring services
  enabled: boolean;
}

export interface InitialCleanBucket {
  bucket: string; // e.g., '7', '14', '42', '999'
  multiplier: number;
  floorPriceCents: number;
  label: string;
  floorCents?: number; // Backward compatibility alias
}

export interface InitialCleanPricing {
  enabled: boolean;
  multiplier: number; // Base price multiplier for initial clean
  floorPriceCents: number; // Minimum price for initial clean
  useDaysSinceLastClean: boolean;
  buckets: InitialCleanBucket[]; // Configurable cleanup buckets
}

export interface QuickBooksSettings {
  enabled: boolean;
  realmId?: string | null;
  clientId?: string | null;
  clientSecret?: string | null;
  refreshToken?: string | null;
  lastSyncAt?: string | null;
  needsReconnect?: boolean;
}

export interface IntegrationSettings {
  quickbooks?: QuickBooksSettings;
}

export interface BusinessConfig {
  businessId: string;
  businessName: string;

  // Service Areas
  serviceZones: ServiceZoneConfig[];

  // Pricing Configuration
  basePricing: {
    tiers: PricingTier[];
    frequencies: FrequencyPricing[];
    yardSizes: YardSizePricing[];
    areaPricing: AreaPricing;
    initialClean: InitialCleanPricing;
    addOns: AddOnConfig[];
  };

  // Business Settings
  settings: {
    defaultZoneMultiplier: number;
    minimumServiceFeeCents: number;
    rushFeeCents: number;
    commercialPricingMultiplier: number;
    weekendSurchargeCents: number;
  };

  // Operational Settings
  operations: {
    maxServiceRadiusMiles: number;
    minimumAdvanceBookingHours: number;
    maximumDogsPerVisit: number;
    requiresPhotoVerification: boolean;
    allowsSameDayService: boolean;
    autoAssignTechnicians?: boolean;
    offerRefreshMinutes?: number;
    offerDirectHoldMinutes?: number;
    offerAutoAssignLeadHours?: number;
    ratingCreditCents?: number;
    ratingCareCredits?: number;
  };

  // Communication Settings
  communication: {
    welcomeEmailEnabled: boolean;
    smsNotificationsEnabled: boolean;
    portalAccessEnabled: boolean;
    marketingEmailsEnabled: boolean;
  };

  // Optional integrations (Stripe remains core; QuickBooks optional)
  integrations?: IntegrationSettings;
}

// Default configuration for Yardura (can be overridden)
export const DEFAULT_YARDURA_CONFIG =
  defaultBusinessConfig as BusinessConfig;

let prismaUnavailable = false;

const FALLBACK_QUICKBOOKS_SETTINGS: QuickBooksSettings = {
  enabled: false,
  realmId: null,
  clientId: null,
  clientSecret: null,
  refreshToken: null,
  lastSyncAt: null,
  needsReconnect: false,
};

const DEFAULT_INTEGRATIONS: IntegrationSettings = {
  quickbooks: {
    ...FALLBACK_QUICKBOOKS_SETTINGS,
    ...(DEFAULT_YARDURA_CONFIG.integrations?.quickbooks ?? {}),
  },
};

type CachedBusinessConfig = {
  config: BusinessConfig;
  timestamp: number;
};

const BUSINESS_CONFIG_CACHE = new Map<string, CachedBusinessConfig>();
const BUSINESS_CONFIG_TTL_MS = 5 * 60 * 1000; // 5 minutes
let hasLoggedPrismaError = false;

const logPrismaFallback = (errorMessage: string) => {
  if (hasLoggedPrismaError) return;
  console.warn(
    "[business-config] Falling back to default configuration:",
    errorMessage,
  );
  hasLoggedPrismaError = true;
};

function normalizeQuickBooksSettings(raw: unknown): QuickBooksSettings {
  const defaults = DEFAULT_INTEGRATIONS.quickbooks ?? FALLBACK_QUICKBOOKS_SETTINGS;
  if (!raw || typeof raw !== "object") {
    return { ...defaults };
  }

  const value = raw as Record<string, unknown>;
  return {
    enabled: Boolean(
      value.enabled ?? defaults.enabled ?? FALLBACK_QUICKBOOKS_SETTINGS.enabled,
    ),
    realmId:
      typeof value.realmId === "string"
        ? value.realmId
        : defaults.realmId ?? FALLBACK_QUICKBOOKS_SETTINGS.realmId ?? null,
    clientId:
      typeof value.clientId === "string"
        ? value.clientId
        : defaults.clientId ?? FALLBACK_QUICKBOOKS_SETTINGS.clientId ?? null,
    clientSecret:
      typeof value.clientSecret === "string"
        ? value.clientSecret
        : defaults.clientSecret ?? FALLBACK_QUICKBOOKS_SETTINGS.clientSecret ?? null,
    refreshToken:
      typeof value.refreshToken === "string"
        ? value.refreshToken
        : defaults.refreshToken ?? FALLBACK_QUICKBOOKS_SETTINGS.refreshToken ?? null,
    lastSyncAt:
      typeof value.lastSyncAt === "string" ? value.lastSyncAt : defaults.lastSyncAt ?? null,
    needsReconnect:
      typeof value.needsReconnect === "boolean"
        ? value.needsReconnect
        : defaults.needsReconnect ?? FALLBACK_QUICKBOOKS_SETTINGS.needsReconnect ?? false,
  };
}

/**
 * Get business configuration from database
 */
export async function getBusinessConfig(
  businessId: string = "yardura",
): Promise<BusinessConfig> {
  const cacheKey = businessId || "yardura";
  const cached = BUSINESS_CONFIG_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < BUSINESS_CONFIG_TTL_MS) {
    return cached.config;
  }

  if (prismaUnavailable) {
    return cached?.config ?? DEFAULT_YARDURA_CONFIG;
  }

  if (!process.env.DATABASE_URL) {
    prismaUnavailable = true;
    logPrismaFallback("DATABASE_URL is not set");
    return cached?.config ?? DEFAULT_YARDURA_CONFIG;
  }

  try {
    // Try to load BusinessConfig directly (avoids Org include typing issues)
    const org = await prisma.org.findUnique({ where: { id: businessId } });
    const bc = await (prisma as any).businessConfig.findUnique({
      where: { orgId: businessId },
    });

    if (bc) {
      // Normalize shapes defensively so callers never crash on undefined
      const rawServiceZones = bc.serviceZones as any;
      const serviceZones = Array.isArray(rawServiceZones)
        ? rawServiceZones
        : DEFAULT_YARDURA_CONFIG.serviceZones;

      const rawBasePricing = (bc.basePricing as any) || {};
      const defaultFrequencies = DEFAULT_YARDURA_CONFIG.basePricing.frequencies;
      const mergedFrequenciesMap = new Map<string, FrequencyPricing>();
      defaultFrequencies.forEach((freq) => {
        mergedFrequenciesMap.set(freq.frequency, { ...freq });
      });
      if (Array.isArray(rawBasePricing.frequencies)) {
        rawBasePricing.frequencies.forEach((freq: FrequencyPricing) => {
          mergedFrequenciesMap.set(freq.frequency, {
            ...(mergedFrequenciesMap.get(freq.frequency) || {}),
            ...freq,
          } as FrequencyPricing);
        });
      }
      const mergedFrequencies = Array.from(mergedFrequenciesMap.values());

      const basePricing = {
        tiers: Array.isArray(rawBasePricing.tiers)
          ? rawBasePricing.tiers
          : DEFAULT_YARDURA_CONFIG.basePricing.tiers,
        frequencies: mergedFrequencies,
        yardSizes: Array.isArray(rawBasePricing.yardSizes)
          ? rawBasePricing.yardSizes
          : DEFAULT_YARDURA_CONFIG.basePricing.yardSizes,
        areaPricing:
          rawBasePricing.areaPricing &&
          typeof rawBasePricing.areaPricing === "object"
            ? {
                ...DEFAULT_YARDURA_CONFIG.basePricing.areaPricing,
                ...rawBasePricing.areaPricing,
              }
            : DEFAULT_YARDURA_CONFIG.basePricing.areaPricing,
        initialClean:
          rawBasePricing.initialClean &&
          typeof rawBasePricing.initialClean === "object"
            ? {
                ...DEFAULT_YARDURA_CONFIG.basePricing.initialClean,
                ...rawBasePricing.initialClean,
                buckets: Array.isArray(rawBasePricing.initialClean?.buckets)
                  ? rawBasePricing.initialClean.buckets
                  : DEFAULT_YARDURA_CONFIG.basePricing.initialClean.buckets,
              }
            : DEFAULT_YARDURA_CONFIG.basePricing.initialClean,
        addOns: Array.isArray(rawBasePricing.addOns)
          ? rawBasePricing.addOns
          : DEFAULT_YARDURA_CONFIG.basePricing.addOns,
      } as BusinessConfig["basePricing"];

      const settings =
        (bc.settings as any) && typeof (bc.settings as any) === "object"
          ? { ...DEFAULT_YARDURA_CONFIG.settings, ...(bc.settings as any) }
          : DEFAULT_YARDURA_CONFIG.settings;

      const operations =
        (bc.operations as any) && typeof (bc.operations as any) === "object"
          ? { ...DEFAULT_YARDURA_CONFIG.operations, ...(bc.operations as any) }
          : DEFAULT_YARDURA_CONFIG.operations;

      const communication =
        (bc.communication as any) &&
        typeof (bc.communication as any) === "object"
          ? {
              ...DEFAULT_YARDURA_CONFIG.communication,
              ...(bc.communication as any),
            }
          : DEFAULT_YARDURA_CONFIG.communication;

      const integrations = (() => {
        if (bc.integrations && typeof bc.integrations === "object") {
          const rawIntegrations = bc.integrations as Record<string, unknown>;
          return {
            quickbooks: normalizeQuickBooksSettings(
              rawIntegrations.quickbooks,
            ),
          } satisfies IntegrationSettings;
        }

        return {
          quickbooks: normalizeQuickBooksSettings(null),
        } satisfies IntegrationSettings;
      })();

      const result: BusinessConfig = {
        businessId,
        businessName: bc.businessName || org?.name || "Business",
        serviceZones,
        basePricing,
        settings,
        operations,
        communication,
        integrations,
      };

      BUSINESS_CONFIG_CACHE.set(cacheKey, {
        config: result,
        timestamp: Date.now(),
      });

      return result;
    }
  } catch (error) {
    prismaUnavailable = true;
    const message =
      error instanceof Error ? error.message : "Unknown Prisma error";
    logPrismaFallback(message);
  }

  const fallbackBase = cached?.config ?? DEFAULT_YARDURA_CONFIG;
  const fallback: BusinessConfig = {
    ...fallbackBase,
    integrations: {
      quickbooks: normalizeQuickBooksSettings(
        fallbackBase.integrations?.quickbooks,
      ),
    },
  };
  BUSINESS_CONFIG_CACHE.set(cacheKey, {
    config: fallback,
    timestamp: Date.now(),
  });
  return fallback;
}

/**
 * Register a new business configuration in database
 */
export async function registerBusinessConfig(
  config: BusinessConfig,
): Promise<void> {
  if (prismaUnavailable || !process.env.DATABASE_URL) {
    logPrismaFallback("Database unavailable—skipping registerBusinessConfig");
    return;
  }

  try {
    // Ensure Org record exists first
    await prisma.org.upsert({
      where: { id: config.businessId },
      update: {
        name: config.businessName,
        slug: config.businessId,
        updatedAt: new Date(),
      },
      create: {
        id: config.businessId,
        name: config.businessName,
        slug: config.businessId,
      },
    });

    await (prisma as any).businessConfig.upsert({
      where: { orgId: config.businessId },
      update: {
        businessName: config.businessName,
        serviceZones: config.serviceZones,
        basePricing: config.basePricing,
        settings: config.settings,
        operations: config.operations,
        communication: config.communication,
        integrations: config.integrations ?? DEFAULT_INTEGRATIONS,
        updatedAt: new Date(),
      },
      create: {
        orgId: config.businessId,
        businessName: config.businessName,
        serviceZones: config.serviceZones,
        basePricing: config.basePricing,
        settings: config.settings,
        operations: config.operations,
        communication: config.communication,
        integrations: config.integrations ?? DEFAULT_INTEGRATIONS,
      },
    });

    BUSINESS_CONFIG_CACHE.delete(config.businessId);
  } catch (error) {
    console.error("Error saving business config to database:", error);
    prismaUnavailable = true;
    logPrismaFallback(
      error instanceof Error ? error.message : "Unknown Prisma error",
    );
    // In offline/dev environments we allow the app to continue with defaults
    return;
  }
}

/**
 * Update existing business configuration in database
 */
export async function updateBusinessConfig(
  businessId: string,
  updates: Partial<BusinessConfig>,
): Promise<void> {
  if (prismaUnavailable || !process.env.DATABASE_URL) {
    logPrismaFallback("Database unavailable—skipping updateBusinessConfig");
    return;
  }

  try {
    const existing = await getBusinessConfig(businessId);

    if (existing) {
      const updatedIntegrations = normalizeQuickBooksSettings({
        ...(existing.integrations?.quickbooks ?? {}),
        ...(updates.integrations?.quickbooks ?? {}),
      });

      const updatedConfig: BusinessConfig = {
        ...existing,
        ...updates,
        integrations: {
          quickbooks: updatedIntegrations,
        },
      };

      await registerBusinessConfig(updatedConfig);
    }
  } catch (error) {
    console.error("Error updating business config in database:", error);
    prismaUnavailable = true;
    logPrismaFallback(
      error instanceof Error ? error.message : "Unknown Prisma error",
    );
    return;
  }
}

/**
 * Get service zones for a business
 */
export async function getServiceZones(
  businessId: string = "yardura",
): Promise<ServiceZoneConfig[]> {
  const config = await getBusinessConfig(businessId);
  console.log(
    "getServiceZones result:",
    typeof config.serviceZones,
    Array.isArray(config.serviceZones),
    config.serviceZones,
  );
  return config.serviceZones;
}

/**
 * Get zone multiplier for a ZIP code
 */
export async function getZoneMultiplierForZip(
  zipCode: string,
  businessId: string = "yardura",
): Promise<number> {
  const zones = await getServiceZones(businessId);
  const cleanZip = zipCode.replace(/\s+/g, "").toUpperCase();

  for (const zone of zones) {
    if (zone.zipCodes.includes(cleanZip)) {
      return zone.baseMultiplier;
    }
  }

  const config = await getBusinessConfig(businessId);
  return config.settings.defaultZoneMultiplier;
}

/**
 * Check if ZIP code is serviceable
 */
export async function isZipServiceable(
  zipCode: string,
  businessId: string = "yardura",
): Promise<boolean> {
  const zones = await getServiceZones(businessId);
  const cleanZip = zipCode.replace(/\s+/g, "").toUpperCase();

  for (const zone of zones) {
    if (zone.zipCodes.includes(cleanZip)) {
      return zone.serviceable;
    }
  }

  return false; // Default to not serviceable if ZIP not found
}

/**
 * Get zone information for a ZIP code
 * 
 * Uses a two-tier approach:
 * 1. First checks static zone configuration for explicit ZIP assignments
 * 2. Falls back to density-based classification using Census ZCTA data
 */
export async function getZoneForZip(
  zipCode: string,
  businessId: string = "yardura",
): Promise<ServiceZoneConfig | null> {
  const zones = await getServiceZones(businessId);
  const cleanZip = zipCode.replace(/\s+/g, "").toUpperCase();

  // First: Check static zone configuration
  for (const zone of zones) {
    if (zone.zipCodes.includes(cleanZip)) {
      return zone;
    }
  }

  // Second: Fall back to density-based classification
  try {
    const { classifyZipByDensity, toServiceZoneConfig } = await import("./zone-classification");
    const classification = await classifyZipByDensity(cleanZip);
    
    if (classification) {
      console.log(`[getZoneForZip] ZIP ${cleanZip} classified as ${classification.zoneName} via density (${classification.populationDensity?.toLocaleString()} people/sq mi)`);
      return toServiceZoneConfig(classification);
    }
  } catch (error) {
    // PostGIS may not be available in all environments (e.g., edge runtime)
    console.warn(`[getZoneForZip] Density classification unavailable for ZIP ${cleanZip}:`, error);
  }

  return null;
}

/**
 * Add ZIP codes to an existing zone
 */
export async function addZipsToZone(
  businessId: string,
  zoneId: string,
  zipCodes: string[],
): Promise<boolean> {
  const config = await getBusinessConfig(businessId);
  const zone = config.serviceZones.find((z) => z.zoneId === zoneId);

  if (!zone) {
    return false;
  }

  // Add new ZIP codes (avoid duplicates)
  const existingZips = new Set(zone.zipCodes);
  zipCodes.forEach((zip) => existingZips.add(zip.toUpperCase()));
  zone.zipCodes = Array.from(existingZips);

  await updateBusinessConfig(businessId, { serviceZones: config.serviceZones });
  return true;
}

/**
 * Create a new service zone
 */
export async function createServiceZone(
  businessId: string,
  zone: ServiceZoneConfig,
): Promise<boolean> {
  const config = await getBusinessConfig(businessId);

  // Check if zone ID already exists
  if (config.serviceZones.some((z) => z.zoneId === zone.zoneId)) {
    return false;
  }

  config.serviceZones.push(zone);
  await updateBusinessConfig(businessId, { serviceZones: config.serviceZones });
  return true;
}

/**
 * Get all serviceable ZIP codes for a business
 */
export async function getServiceableZips(
  businessId: string = "yardura",
): Promise<string[]> {
  const zones = await getServiceZones(businessId);
  return zones
    .filter((zone) => zone.serviceable)
    .flatMap((zone) => zone.zipCodes);
}

/**
 * Export configuration for backup/admin purposes
 */
export async function exportBusinessConfig(
  businessId: string,
): Promise<string> {
  const config = await getBusinessConfig(businessId);
  return JSON.stringify(config, null, 2);
}

/**
 * Import configuration from JSON
 */
export async function importBusinessConfig(
  jsonConfig: string,
): Promise<boolean> {
  try {
    const config: BusinessConfig = JSON.parse(jsonConfig);
    await registerBusinessConfig(config);
    return true;
  } catch (error) {
    console.error("Failed to import business config:", error);
    return false;
  }
}

/**
 * Get all registered business IDs
 */
export async function getRegisteredBusinesses(): Promise<string[]> {
  try {
    const businesses = await (prisma as any).businessConfig.findMany({
      select: { orgId: true },
    });
    return (businesses as Array<{ orgId: string }>).map((b) => b.orgId);
  } catch (error) {
    console.error("Error getting registered businesses:", error);
    return [];
  }
}

/**
 * Validate business configuration
 */
export function validateBusinessConfig(config: BusinessConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.businessId) {
    errors.push("Business ID is required");
  }

  if (!config.businessName) {
    errors.push("Business name is required");
  }

  if (!config.serviceZones || config.serviceZones.length === 0) {
    errors.push("At least one service zone is required");
  }

  if (!config.basePricing.tiers || config.basePricing.tiers.length === 0) {
    errors.push("At least one pricing tier is required");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export async function getQuickBooksSettings(
  businessId: string = "yardura",
): Promise<QuickBooksSettings> {
  const config = await getBusinessConfig(businessId);
  return config.integrations?.quickbooks
    ? normalizeQuickBooksSettings(config.integrations.quickbooks)
    : normalizeQuickBooksSettings(null);
}

export async function isQuickBooksEnabled(
  businessId: string = "yardura",
): Promise<boolean> {
  const settings = await getQuickBooksSettings(businessId);
  return Boolean(settings.enabled);
}
