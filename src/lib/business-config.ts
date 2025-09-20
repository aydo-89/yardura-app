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

import { prisma } from '@/lib/prisma';

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
  frequency: 'weekly' | 'twice-weekly' | 'bi-weekly' | 'monthly' | 'one-time';
  multiplier: number;
  visitsPerMonth: number;
}

export interface AddOnConfig {
  id: string;
  name: string;
  priceCents: number;
  description: string;
  available: boolean;
  billingMode: 'first-visit' | 'each-visit' | 'every-other' | 'one-time';
  required: boolean;
}

export interface YardSizePricing {
  size: 'small' | 'medium' | 'large' | 'xlarge';
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
  };

  // Communication Settings
  communication: {
    welcomeEmailEnabled: boolean;
    smsNotificationsEnabled: boolean;
    portalAccessEnabled: boolean;
    marketingEmailsEnabled: boolean;
  };
}

// Default configuration for Yardura (can be overridden)
export const DEFAULT_YARDURA_CONFIG: BusinessConfig = {
  businessId: 'yardura',
  businessName: 'Yardura',

  serviceZones: [
    {
      zoneId: 'zone-urban-core',
      name: 'Urban Core',
      baseMultiplier: 1.2,
      description: 'High-demand urban area',
      serviceable: true,
      zipCodes: [],
    },
    {
      zoneId: 'zone-suburban',
      name: 'Suburban',
      baseMultiplier: 1.0,
      description: 'Standard suburban area',
      serviceable: true,
      zipCodes: [],
    },
    {
      zoneId: 'zone-rural',
      name: 'Rural',
      baseMultiplier: 0.95,
      description: 'Rural area with extended travel time',
      serviceable: true,
      zipCodes: [],
    },
  ],

  basePricing: {
    tiers: [
      { dogCount: 1, basePriceCents: 2500 }, // $25 for 1 dog
      { dogCount: 2, basePriceCents: 3000 }, // $30 for 2 dogs
      { dogCount: 3, basePriceCents: 3500 }, // $35 for 3 dogs
      { dogCount: 4, basePriceCents: 4000, extraDogPriceCents: 500 }, // $40 for 4+ dogs, $5 each additional
    ],
    frequencies: [
      { frequency: 'weekly', multiplier: 1.0, visitsPerMonth: 4.33 },
      { frequency: 'twice-weekly', multiplier: 1.8, visitsPerMonth: 8.67 },
      { frequency: 'bi-weekly', multiplier: 0.5, visitsPerMonth: 2.17 },
      { frequency: 'monthly', multiplier: 1.5, visitsPerMonth: 1 },
      { frequency: 'one-time', multiplier: 1.0, visitsPerMonth: 1 },
    ],
    yardSizes: [
      { size: 'small', multiplier: 0.8, description: '< 1/4 acre', enabled: true },
      { size: 'medium', multiplier: 1.0, description: '1/4 - 1/2 acre', enabled: true },
      { size: 'large', multiplier: 1.2, description: '1/2 - 1 acre', enabled: true },
      { size: 'xlarge', multiplier: 1.4, description: '> 1 acre', enabled: true },
    ],
    areaPricing: {
      enabled: true,
      baseAreas: 1, // First area free
      extraAreaCostCents: 500, // $5 per additional area for one-time
      recurringExtraAreaCostCents: 300, // $3 per additional area for recurring
    },
    initialClean: {
      enabled: true,
      multiplier: 2.7222, // Matches the original 1.25 * 2.1778 calculation
      floorPriceCents: 4900, // $49 minimum
      useDaysSinceLastClean: true,
      buckets: [
        { bucket: '7', multiplier: 1.0, floorPriceCents: 4900, label: 'Today / ≤ 7 days (Well maintained)' },
        { bucket: '14', multiplier: 1.0, floorPriceCents: 4900, label: '≤ 2 weeks (Well maintained)' },
        { bucket: '42', multiplier: 1.75, floorPriceCents: 6900, label: "2–6 weeks (It's pretty neglected)" },
        { bucket: '999', multiplier: 2.5, floorPriceCents: 8900, label: '> 6 weeks (Watch your step!)' },
      ],
    },
    addOns: [
      {
        id: 'deodorize',
        name: 'Enhanced Deodorizing',
        priceCents: 2500,
        description: 'Premium odor-neutralizing treatment',
        available: true,
        billingMode: 'each-visit' as const,
        required: false,
      },
      {
        id: 'spray-deck',
        name: 'Spray Deck/Patio',
        priceCents: 1750,
        description: 'Pressure wash and clean outdoor surfaces',
        available: true,
        billingMode: 'each-visit' as const,
        required: false,
      },
      {
        id: 'divert-takeaway',
        name: 'Take Away Waste (100% Diversion)',
        priceCents: 200,
        description: 'Remove 100% of waste, 100% diverted from landfills to compost',
        available: true,
        billingMode: 'each-visit' as const,
        required: false,
      },
      {
        id: 'divert-25',
        name: 'Waste Diversion (25% Compost)',
        priceCents: 150,
        description: '25% of waste diverted to compost facilities',
        available: true,
        billingMode: 'each-visit' as const,
        required: false,
      },
      {
        id: 'divert-50',
        name: 'Waste Diversion (50% Compost)',
        priceCents: 100,
        description: '50% of waste diverted to compost facilities',
        available: true,
        billingMode: 'each-visit' as const,
        required: false,
      },
      {
        id: 'divert-100',
        name: 'Waste Diversion (100% Compost)',
        priceCents: 250,
        description: '100% of waste diverted to compost facilities (no landfill)',
        available: true,
        billingMode: 'each-visit' as const,
        required: false,
      },
      {
        id: 'litter',
        name: 'Cat Litter Cleanup',
        priceCents: 800,
        description: 'Clean up cat litter from outdoor areas',
        available: true,
        billingMode: 'each-visit' as const,
        required: false,
      },
    ],
  },

  settings: {
    defaultZoneMultiplier: 1.0,
    minimumServiceFeeCents: 2000, // $20 minimum
    rushFeeCents: 1500, // $15 rush fee
    commercialPricingMultiplier: 2.0, // 2x pricing for commercial
    weekendSurchargeCents: 1000, // $10 weekend surcharge
  },

  operations: {
    maxServiceRadiusMiles: 50,
    minimumAdvanceBookingHours: 24,
    maximumDogsPerVisit: 8,
    requiresPhotoVerification: true,
    allowsSameDayService: false,
  },

  communication: {
    welcomeEmailEnabled: true,
    smsNotificationsEnabled: true,
    portalAccessEnabled: true,
    marketingEmailsEnabled: false,
  },
};

/**
 * Get business configuration from database
 */
export async function getBusinessConfig(businessId: string = 'yardura'): Promise<BusinessConfig> {
  try {
    // Try to load BusinessConfig directly (avoids Org include typing issues)
    const org = await prisma.org.findUnique({ where: { id: businessId } });
    const bc = await (prisma as any).businessConfig.findUnique({ where: { orgId: businessId } });

    if (bc) {
      // Normalize shapes defensively so callers never crash on undefined
      const rawServiceZones = (bc.serviceZones as any);
      const serviceZones = Array.isArray(rawServiceZones)
        ? rawServiceZones
        : DEFAULT_YARDURA_CONFIG.serviceZones;

      const rawBasePricing = (bc.basePricing as any) || {};
      const basePricing = {
        tiers: Array.isArray(rawBasePricing.tiers)
          ? rawBasePricing.tiers
          : DEFAULT_YARDURA_CONFIG.basePricing.tiers,
        frequencies: Array.isArray(rawBasePricing.frequencies)
          ? rawBasePricing.frequencies
          : DEFAULT_YARDURA_CONFIG.basePricing.frequencies,
        yardSizes: Array.isArray(rawBasePricing.yardSizes)
          ? rawBasePricing.yardSizes
          : DEFAULT_YARDURA_CONFIG.basePricing.yardSizes,
        areaPricing:
          rawBasePricing.areaPricing && typeof rawBasePricing.areaPricing === 'object'
            ? {
                ...DEFAULT_YARDURA_CONFIG.basePricing.areaPricing,
                ...rawBasePricing.areaPricing,
              }
            : DEFAULT_YARDURA_CONFIG.basePricing.areaPricing,
        initialClean:
          rawBasePricing.initialClean && typeof rawBasePricing.initialClean === 'object'
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
      } as BusinessConfig['basePricing'];

      const settings = (bc.settings as any) && typeof (bc.settings as any) === 'object'
        ? { ...DEFAULT_YARDURA_CONFIG.settings, ...(bc.settings as any) }
        : DEFAULT_YARDURA_CONFIG.settings;

      const operations = (bc.operations as any) && typeof (bc.operations as any) === 'object'
        ? { ...DEFAULT_YARDURA_CONFIG.operations, ...(bc.operations as any) }
        : DEFAULT_YARDURA_CONFIG.operations;

      const communication = (bc.communication as any) && typeof (bc.communication as any) === 'object'
        ? { ...DEFAULT_YARDURA_CONFIG.communication, ...(bc.communication as any) }
        : DEFAULT_YARDURA_CONFIG.communication;

      return {
        businessId,
        businessName: bc.businessName || org?.name || 'Business',
        serviceZones,
        basePricing,
        settings,
        operations,
        communication,
      };
    }
  } catch (error) {
    console.error('Error loading business config from database:', error);
  }

  // Fall back to default configuration
  return DEFAULT_YARDURA_CONFIG;
}

/**
 * Register a new business configuration in database
 */
export async function registerBusinessConfig(config: BusinessConfig): Promise<void> {
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
      },
    });
  } catch (error) {
    console.error('Error saving business config to database:', error);
    throw error;
  }
}

/**
 * Update existing business configuration in database
 */
export async function updateBusinessConfig(businessId: string, updates: Partial<BusinessConfig>): Promise<void> {
  try {
    const existing = await getBusinessConfig(businessId);

    if (existing) {
      const updatedConfig = { ...existing, ...updates };
      await registerBusinessConfig(updatedConfig);
    }
  } catch (error) {
    console.error('Error updating business config in database:', error);
    throw error;
  }
}

/**
 * Get service zones for a business
 */
export async function getServiceZones(businessId: string = 'yardura'): Promise<ServiceZoneConfig[]> {
  const config = await getBusinessConfig(businessId);
  console.log('getServiceZones result:', typeof config.serviceZones, Array.isArray(config.serviceZones), config.serviceZones);
  return config.serviceZones;
}

/**
 * Get zone multiplier for a ZIP code
 */
export async function getZoneMultiplierForZip(zipCode: string, businessId: string = 'yardura'): Promise<number> {
  const zones = await getServiceZones(businessId);
  const cleanZip = zipCode.replace(/\s+/g, '').toUpperCase();

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
export async function isZipServiceable(zipCode: string, businessId: string = 'yardura'): Promise<boolean> {
  const zones = await getServiceZones(businessId);
  const cleanZip = zipCode.replace(/\s+/g, '').toUpperCase();

  for (const zone of zones) {
    if (zone.zipCodes.includes(cleanZip)) {
      return zone.serviceable;
    }
  }

  return false; // Default to not serviceable if ZIP not found
}

/**
 * Get zone information for a ZIP code
 */
export async function getZoneForZip(zipCode: string, businessId: string = 'yardura'): Promise<ServiceZoneConfig | null> {
  const zones = await getServiceZones(businessId);
  const cleanZip = zipCode.replace(/\s+/g, '').toUpperCase();

  for (const zone of zones) {
    if (zone.zipCodes.includes(cleanZip)) {
      return zone;
    }
  }

  return null;
}

/**
 * Add ZIP codes to an existing zone
 */
export async function addZipsToZone(businessId: string, zoneId: string, zipCodes: string[]): Promise<boolean> {
  const config = await getBusinessConfig(businessId);
  const zone = config.serviceZones.find(z => z.zoneId === zoneId);

  if (!zone) {
    return false;
  }

  // Add new ZIP codes (avoid duplicates)
  const existingZips = new Set(zone.zipCodes);
  zipCodes.forEach(zip => existingZips.add(zip.toUpperCase()));
  zone.zipCodes = Array.from(existingZips);

  await updateBusinessConfig(businessId, { serviceZones: config.serviceZones });
  return true;
}

/**
 * Create a new service zone
 */
export async function createServiceZone(businessId: string, zone: ServiceZoneConfig): Promise<boolean> {
  const config = await getBusinessConfig(businessId);

  // Check if zone ID already exists
  if (config.serviceZones.some(z => z.zoneId === zone.zoneId)) {
    return false;
  }

  config.serviceZones.push(zone);
  await updateBusinessConfig(businessId, { serviceZones: config.serviceZones });
  return true;
}

/**
 * Get all serviceable ZIP codes for a business
 */
export async function getServiceableZips(businessId: string = 'yardura'): Promise<string[]> {
  const zones = await getServiceZones(businessId);
  return zones
    .filter(zone => zone.serviceable)
    .flatMap(zone => zone.zipCodes);
}

/**
 * Export configuration for backup/admin purposes
 */
export async function exportBusinessConfig(businessId: string): Promise<string> {
  const config = await getBusinessConfig(businessId);
  return JSON.stringify(config, null, 2);
}

/**
 * Import configuration from JSON
 */
export async function importBusinessConfig(jsonConfig: string): Promise<boolean> {
  try {
    const config: BusinessConfig = JSON.parse(jsonConfig);
    await registerBusinessConfig(config);
    return true;
  } catch (error) {
    console.error('Failed to import business config:', error);
    return false;
  }
}

/**
 * Get all registered business IDs
 */
export async function getRegisteredBusinesses(): Promise<string[]> {
  try {
    const businesses = await (prisma as any).businessConfig.findMany({
      select: { orgId: true }
    });
    return (businesses as Array<{ orgId: string }>).map((b) => b.orgId);
  } catch (error) {
    console.error('Error getting registered businesses:', error);
    return [];
  }
}

/**
 * Validate business configuration
 */
export function validateBusinessConfig(config: BusinessConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.businessId) {
    errors.push('Business ID is required');
  }

  if (!config.businessName) {
    errors.push('Business name is required');
  }

  if (!config.serviceZones || config.serviceZones.length === 0) {
    errors.push('At least one service zone is required');
  }

  if (!config.basePricing.tiers || config.basePricing.tiers.length === 0) {
    errors.push('At least one pricing tier is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
