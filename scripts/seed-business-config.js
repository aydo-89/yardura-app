#!/usr/bin/env node

/**
 * Business Configuration Seeding Script
 *
 * Seeds the database with initial business configuration including service zones and ZIP codes
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DEFAULT_YARDURA_CONFIG = {
  businessId: 'yardura',
  businessName: 'Yardura',

  serviceZones: [
    {
      zoneId: 'zone-urban-core',
      name: 'Urban Core',
      baseMultiplier: 1.2,
      description: 'High-demand urban area',
      serviceable: true,
      zipCodes: ['10001', '10002', '10003', '60601', '60602', '90210', '55401', '55402', '55403', '55101', '55102'],
    },
    {
      zoneId: 'zone-suburban',
      name: 'Suburban',
      baseMultiplier: 1.0,
      description: 'Standard suburban area',
      serviceable: true,
      zipCodes: ['07001', '07002', '07003', '60001', '60002', '55404', '55405', '55406', '55103', '55104'],
    },
    {
      zoneId: 'zone-rural',
      name: 'Rural',
      baseMultiplier: 0.95,
      description: 'Rural area with extended travel time',
      serviceable: true,
      zipCodes: ['05001', '05009', '13001', '13002', '55407', '55408', '55105', '55106'],
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
    },
    addOns: [
      {
        id: 'deodorize',
        name: 'Enhanced Deodorizing',
        priceCents: 2500,
        description: 'Premium odor-neutralizing treatment',
        available: true,
        billingMode: 'each-visit',
        required: false,
      },
      {
        id: 'spray-deck',
        name: 'Spray Deck/Patio',
        priceCents: 1200,
        description: 'Eco-friendly deodorizer spray treatment',
        available: true,
        billingMode: 'every-other',
        required: false,
      },
      {
        id: 'divert-takeaway',
        name: 'Take Away Waste',
        priceCents: 200,
        description: 'Basic waste diversion service',
        available: true,
        billingMode: 'each-visit',
        required: false,
      },
      {
        id: 'litter',
        name: 'Litter Box Service',
        priceCents: 1500,
        description: 'Indoor litter box cleaning and maintenance',
        available: true,
        billingMode: 'each-visit',
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

async function seedBusinessConfig() {
  try {
    console.log('🌱 Seeding business configuration...');

    // Create or update the business configuration
    await prisma.businessConfig.upsert({
      where: { orgId: DEFAULT_YARDURA_CONFIG.businessId },
      update: {
        businessName: DEFAULT_YARDURA_CONFIG.businessName,
        serviceZones: DEFAULT_YARDURA_CONFIG.serviceZones,
        basePricing: DEFAULT_YARDURA_CONFIG.basePricing,
        settings: DEFAULT_YARDURA_CONFIG.settings,
        operations: DEFAULT_YARDURA_CONFIG.operations,
        communication: DEFAULT_YARDURA_CONFIG.communication,
        updatedAt: new Date(),
      },
      create: {
        orgId: DEFAULT_YARDURA_CONFIG.businessId,
        businessName: DEFAULT_YARDURA_CONFIG.businessName,
        serviceZones: DEFAULT_YARDURA_CONFIG.serviceZones,
        basePricing: DEFAULT_YARDURA_CONFIG.basePricing,
        settings: DEFAULT_YARDURA_CONFIG.settings,
        operations: DEFAULT_YARDURA_CONFIG.operations,
        communication: DEFAULT_YARDURA_CONFIG.communication,
      },
    });

    console.log('✅ Business configuration seeded successfully!');
    console.log('📍 Serviceable ZIP codes:');
    const allZips = DEFAULT_YARDURA_CONFIG.serviceZones.flatMap(zone => zone.zipCodes);
    console.log('   ' + allZips.join(', '));
    console.log(`   Total: ${allZips.length} ZIP codes across ${DEFAULT_YARDURA_CONFIG.serviceZones.length} zones`);

  } catch (error) {
    console.error('❌ Error seeding business configuration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeding
seedBusinessConfig()
  .then(() => {
    console.log('🎉 Business configuration seeding completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Business configuration seeding failed:', error);
    process.exit(1);
  });
