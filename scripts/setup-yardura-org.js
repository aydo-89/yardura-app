const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function setupYardDogOrg() {
  try {
    console.log("Setting up YardDog organization...");

    // Create the YardDog organization
    const org = await prisma.org.upsert({
      where: { id: "yarddog" },
      update: {
        name: "YardDog",
        slug: "yarddog",
      },
      create: {
        id: "yarddog",
        name: "YardDog",
        slug: "yarddog",
      },
    });

    console.log("YardDog org created:", org);

    // Register the business configuration
    const config = {
      businessId: "yarddog",
      businessName: "YardDog",
      serviceZones: [
        {
          zoneId: "zone-urban-core",
          name: "Urban Core",
          baseMultiplier: 1.2,
          description: "High-demand urban area",
          serviceable: true,
          zipCodes: [
            "10001",
            "10002",
            "10003",
            "60601",
            "60602",
            "90210",
            "55401",
            "55402",
            "55403",
            "55101",
            "55102",
          ],
        },
        {
          zoneId: "zone-suburban",
          name: "Suburban",
          baseMultiplier: 1,
          description: "Standard suburban area",
          serviceable: true,
          zipCodes: [
            "07001",
            "07002",
            "07003",
            "60001",
            "60002",
            "55404",
            "55405",
            "55406",
            "55103",
            "55104",
          ],
        },
        {
          zoneId: "zone-rural",
          name: "Rural",
          baseMultiplier: 0.95,
          description: "Rural area with extended travel time",
          serviceable: true,
          zipCodes: [
            "05001",
            "05009",
            "13001",
            "13002",
            "55407",
            "55408",
            "55105",
            "55106",
          ],
        },
      ],
      basePricing: {
        dogTiers: [
          { dogCount: 1, basePriceCents: 2500 },
          { dogCount: 2, basePriceCents: 3500 },
          { dogCount: 3, basePriceCents: 4500 },
        ],
        frequencyMultipliers: [
          { frequency: "weekly", multiplier: 1, visitsPerMonth: 4.3 },
          { frequency: "twice-weekly", multiplier: 1.8, visitsPerMonth: 8.7 },
          { frequency: "bi-weekly", multiplier: 2.2, visitsPerMonth: 2.2 },
          { frequency: "monthly", multiplier: 4.5, visitsPerMonth: 1 },
          { frequency: "one-time", multiplier: 1, visitsPerMonth: 1 },
        ],
        yardSizeMultipliers: [
          {
            size: "small",
            multiplier: 1,
            description: "Townhouse or small lot",
          },
          {
            size: "medium",
            multiplier: 1.2,
            description: "Standard residential lot",
          },
          {
            size: "large",
            multiplier: 1.4,
            description: "Large residential lot",
          },
          {
            size: "xlarge",
            multiplier: 1.6,
            description: "Estate or very large lot",
          },
        ],
      },
      settings: {
        defaultZoneMultiplier: 1,
        minimumServiceCharge: 2500,
        maximumDogsPerVisit: 4,
        wellnessProgramEnabled: true,
      },
      operations: {
        scheduling: {
          advanceBookingDays: 7,
          sameDayBookings: false,
          operatingHours: {
            monday: { start: "07:00", end: "18:00" },
            tuesday: { start: "07:00", end: "18:00" },
            wednesday: { start: "07:00", end: "18:00" },
            thursday: { start: "07:00", end: "18:00" },
            friday: { start: "07:00", end: "18:00" },
            saturday: { start: "08:00", end: "16:00" },
            sunday: { start: "08:00", end: "16:00" },
          },
        },
      },
      communication: {
        emailTemplates: {
          quoteReceived: true,
          serviceScheduled: true,
          serviceCompleted: true,
        },
        smsNotifications: {
          dayBefore: true,
          morningOf: true,
          serviceComplete: true,
        },
      },
    };

    await prisma.businessConfig.upsert({
      where: { orgId: "yardura" },
      update: {
        businessName: config.businessName,
        serviceZones: config.serviceZones,
        basePricing: config.basePricing,
        settings: config.settings,
        operations: config.operations,
        communication: config.communication,
      },
      create: {
        orgId: "yardura",
        businessName: config.businessName,
        serviceZones: config.serviceZones,
        basePricing: config.basePricing,
        settings: config.settings,
        operations: config.operations,
        communication: config.communication,
      },
    });

    console.log("Yardura business config created successfully");
  } catch (error) {
    console.error("Error setting up Yardura org:", error);
  } finally {
    await prisma.$disconnect();
  }
}

setupYarduraOrg();
