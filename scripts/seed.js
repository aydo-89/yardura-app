#!/usr/bin/env node

/**
 * Yardura Database Seeding Script
 *
 * Populates the database with comprehensive demo data for development and testing
 * Usage: node scripts/seed.js [environment]
 *
 * Environments:
 * - development: Full demo data with multiple users
 * - staging: Minimal demo data
 * - production: Only essential seed data
 */

const { PrismaClient, AvailabilityWindow, Frequency } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

// Configuration based on environment
const environment = process.argv[2] || "development";
const isProduction = environment === "production";
const isStaging = environment === "staging";

console.log(`🌱 Seeding database for ${environment} environment...\n`);

// =============================================================================
// DEMO DATA CONFIGURATION
// =============================================================================

const DEMO_USERS = [
  {
    email: "demo@yardura.com",
    name: "Demo User",
    phone: "+1-612-555-0101",
    address: "123 Main St",
    city: "Minneapolis",
    zipCode: "55401",
    role: "CUSTOMER",
  },
  {
    email: "sarah.johnson@example.com",
    name: "Sarah Johnson",
    phone: "+1-612-555-0102",
    address: "456 Oak Ave",
    city: "St. Paul",
    zipCode: "55101",
    role: "CUSTOMER",
  },
  {
    email: "mike.wilson@example.com",
    name: "Mike Wilson",
    phone: "+1-612-555-0103",
    address: "789 Pine St",
    city: "Minneapolis",
    zipCode: "55402",
    role: "CUSTOMER",
  },
  {
    email: "sales@yardura.com",
    name: "Alex Rodriguez",
    phone: "+1-612-555-0199",
    address: "100 Sales Blvd",
    city: "Minneapolis",
    zipCode: "55415",
    role: "SALES_REP",
  },
  {
    email: "jordan.scooper@example.com",
    name: "Jordan Thompson",
    phone: "+1-612-555-0150",
    address: "789 Field Tech Lane",
    city: "Minneapolis",
    zipCode: "55410",
    role: "TECH",
  },
];

const DEMO_DOGS = [
  { name: "Max", breed: "Golden Retriever", age: 3, weight: 65 },
  { name: "Bella", breed: "Labrador", age: 2, weight: 55 },
  { name: "Charlie", breed: "Beagle", age: 4, weight: 25 },
  { name: "Luna", breed: "German Shepherd", age: 1, weight: 70 },
  { name: "Rocky", breed: "Bulldog", age: 5, weight: 45 },
  { name: "Sadie", breed: "Poodle", age: 2, weight: 35 },
  { name: "Buddy", breed: "Mixed Breed", age: 3, weight: 40 },
  { name: "Maggie", breed: "Boxer", age: 4, weight: 60 },
];

const SERVICE_TYPES = ["REGULAR", "ONE_TIME", "SPRING_CLEANUP"];
const YARD_SIZES = ["SMALL", "MEDIUM", "LARGE", "XLARGE"];
const SERVICE_STATUSES = ["SCHEDULED", "IN_PROGRESS", "COMPLETED"];

const SAMPLE_NOTES = [
  "Regular weekly service",
  "Spring cleanup - extra attention needed",
  "First-time customer - welcome package",
  "Large yard with multiple dogs",
  "Customer requested deodorizer",
  "Rescheduled from last week",
  "New customer onboarding",
  "Regular maintenance visit",
];

const DEFAULT_ORG = {
  id: "yardura",
  name: "InsightScoop",
  slug: "yardura",
};

const CITY_TILE_MAP = {
  minneapolis: [
    "minneapolis-central",
    "minneapolis-south",
    "minneapolis-lakes-southwest",
    "minneapolis-north",
  ],
  bloomington: ["bloomington-east", "bloomington-west"],
  "brooklyn park": ["brooklyn-park-south", "brooklyn-park-north"],
  "maple grove": ["maple-grove-arbor", "maple-grove-northwest"],
  edina: ["edina-north", "edina-south"],
  richfield: ["richfield-core"],
  "eden prairie": ["eden-prairie-north", "eden-prairie-south"],
  plymouth: ["plymouth-east", "plymouth-west"],
  minnetonka: ["minnetonka-east", "minnetonka-west"],
  "brooklyn center": ["brooklyn-center-core"],
  champlin: ["champlin-mississippi"],
  crystal: ["crystal-central"],
  hopkins: ["hopkins-downtown"],
  "st. louis park": ["st-louis-park-core"],
  "st louis park": ["st-louis-park-core"],
  "st. anthony": ["st-anthony-northeast"],
  "st anthony": ["st-anthony-northeast"],
  mound: ["mound-westonka"],
  wayzata: ["wayzata-downtown"],
  orono: ["orono-northshore"],
  shorewood: ["shorewood-south"],
  "tonka bay": ["tonka-bay-marina"],
  excelsior: ["excelsior-downtown"],
  deephaven: ["deephaven-lakeside"],
  greenfield: ["greenfield-rural"],
  corcoran: ["corcoran-pioneer"],
  medina: ["medina-hamel"],
  rogers: ["rogers-gateway"],
  hanover: ["hanover-southfork"],
  dayton: ["dayton-river"],
  loretto: ["loretto-hamlet"],
  "maple plain": ["maple-plain-trail"],
  independence: ["independence-pioneer"],
  minnetrista: ["minnetrista-northshore"],
  woodland: ["woodland-peninsula"],
};

const SERVICE_TILE_SEEDS = [
  {
    slug: "minneapolis-central",
    name: "Minneapolis – Central & Northeast",
    minCertifiedScoopers: 4,
    minCustomerUnits: 60,
    serviceWindows: [
      { weekday: 1, window: "AM", maxStops: 60 },
      { weekday: 4, window: "PM", maxStops: 60 },
    ],
  },
  {
    slug: "minneapolis-south",
    name: "Minneapolis – South & Nokomis",
    minCertifiedScoopers: 4,
    minCustomerUnits: 58,
    serviceWindows: [
      { weekday: 2, window: "AM", maxStops: 58 },
      { weekday: 5, window: "PM", maxStops: 58 },
    ],
  },
  {
    slug: "bloomington-east",
    name: "Bloomington – East River",
    minCertifiedScoopers: 3,
    minCustomerUnits: 45,
    serviceWindows: [
      { weekday: 1, window: "AM", maxStops: 45 },
      { weekday: 4, window: "PM", maxStops: 45 },
    ],
  },
  {
    slug: "brooklyn-park-south",
    name: "Brooklyn Park – Zane & 85th",
    minCertifiedScoopers: 3,
    minCustomerUnits: 40,
    serviceWindows: [
      { weekday: 2, window: "AM", maxStops: 40 },
      { weekday: 5, window: "PM", maxStops: 40 },
    ],
  },
  {
    slug: "maple-grove-arbor",
    name: "Maple Grove – Arbor Lakes",
    minCertifiedScoopers: 3,
    minCustomerUnits: 40,
    serviceWindows: [
      { weekday: 3, window: "AM", maxStops: 40 },
      { weekday: 6, window: "AM", maxStops: 28 },
    ],
  },
  {
    slug: "edina-north",
    name: "Edina – 50th & France",
    minCertifiedScoopers: 3,
    minCustomerUnits: 32,
    serviceWindows: [
      { weekday: 1, window: "AM", maxStops: 32 },
      { weekday: 4, window: "PM", maxStops: 32 },
    ],
  },
];

const DEFAULT_COMP_SCHEDULES = [
  {
    frequency: "DAILY",
    baseRateCents: 550,
    haulAwayBonusCents: 300,
    sharePercent: 0.45,
  },
  {
    frequency: "TWICE_WEEKLY",
    baseRateCents: 950,
    haulAwayBonusCents: 300,
    sharePercent: 0.45,
  },
  {
    frequency: "WEEKLY",
    baseRateCents: 1200,
    haulAwayBonusCents: 400,
    sharePercent: 0.45,
  },
  {
    frequency: "BI_WEEKLY",
    baseRateCents: 1600,
    haulAwayBonusCents: 400,
    sharePercent: 0.45,
  },
  {
    frequency: "MONTHLY",
    baseRateCents: 2200,
    haulAwayBonusCents: 500,
    sharePercent: 0.5,
  },
  {
    frequency: "ONE_TIME",
    baseRateCents: 4500,
    haulAwayBonusCents: 700,
    sharePercent: 0.5,
  },
];

const DEMO_SCOOPERS = [
  {
    email: "jordan.scooper@example.com",
    name: "Jordan Scooper",
    phone: "+1-612-555-0201",
    vehicleDetail: "2019 Ford Transit",
    tiles: ["minneapolis-central", "edina-north"],
  },
  {
    email: "ivy.cleaner@example.com",
    name: "Ivy Cleaner",
    phone: "+1-612-555-0202",
    vehicleDetail: "2021 Toyota Rav4",
    tiles: ["bloomington-east", "maple-grove-arbor"],
  },
];

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomDate(start, end) {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime()),
  );
}

async function resolveSeedTile(orgId, city) {
  const normalizedCity = (city || "").trim().toLowerCase();
  const prioritySlugs = CITY_TILE_MAP[normalizedCity] || [];

  for (const slug of prioritySlugs) {
    const found = await prisma.serviceTile.findFirst({
      where: { orgId, slug },
      select: { id: true, slug: true },
    });
    if (found) return found;
  }

  const liveTile = await prisma.serviceTile.findFirst({
    where: { orgId, status: { in: ["LIVE", "WAITLIST"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true, slug: true },
  });
  if (liveTile) return liveTile;

  return prisma.serviceTile.findFirst({
    where: { orgId },
    orderBy: { createdAt: "asc" },
    select: { id: true, slug: true },
  });
}

function generateServiceVisits({ orgId, userId, dogCount, tileIds }) {
  const visits = [];
  const now = new Date();
  const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Generate 3-8 service visits per user over the last 3 months
  const visitCount = Math.floor(Math.random() * 6) + 3;

  for (let i = 0; i < visitCount; i++) {
    const scheduledDate = getRandomDate(threeMonthsAgo, now);
    const isCompleted = scheduledDate < now;
    const completedDate = isCompleted
      ? new Date(scheduledDate.getTime() + Math.random() * 2 * 60 * 60 * 1000)
      : null;

    const tileId = tileIds?.length ? getRandomElement(tileIds) : null;
    const revenueCents = Math.floor(Math.random() * 1200) + 1800; // $18-$30

    visits.push({
      orgId,
      userId,
      tileId,
      scheduledDate,
      completedDate,
      status: isCompleted
        ? "COMPLETED"
        : getRandomElement(["SCHEDULED", "IN_PROGRESS"]),
      serviceType: getRandomElement(SERVICE_TYPES),
      yardSize: getRandomElement(YARD_SIZES),
      dogsServiced: Math.min(dogCount, Math.floor(Math.random() * 3) + 1),
      notes: Math.random() > 0.7 ? getRandomElement(SAMPLE_NOTES) : null,
      deodorize: Math.random() > 0.6,
      litterService: Math.random() > 0.8,
      revenueCents,
    });
  }

  return visits.sort((a, b) => b.scheduledDate - a.scheduledDate);
}

async function ensureOrg() {
  const org = await prisma.org.upsert({
    where: { id: DEFAULT_ORG.id },
    update: {
      name: DEFAULT_ORG.name,
      slug: DEFAULT_ORG.slug,
    },
    create: {
      id: DEFAULT_ORG.id,
      name: DEFAULT_ORG.name,
      slug: DEFAULT_ORG.slug,
    },
  });
  return org;
}

async function seedServiceTilesForOrg(orgId) {
  const createdTiles = [];
  for (const tile of SERVICE_TILE_SEEDS) {
    const record = await prisma.serviceTile.upsert({
      where: {
        orgId_slug: {
          orgId,
          slug: tile.slug,
        },
      },
      update: {
        name: tile.name,
        status: "WAITLIST",
        minCertifiedScoopers: tile.minCertifiedScoopers,
        minCustomerUnits: tile.minCustomerUnits,
        serviceWindows: tile.serviceWindows,
      },
      create: {
        orgId,
        slug: tile.slug,
        name: tile.name,
        status: "WAITLIST",
        minCertifiedScoopers: tile.minCertifiedScoopers,
        minCustomerUnits: tile.minCustomerUnits,
        serviceWindows: tile.serviceWindows,
      },
    });
    createdTiles.push(record);
  }
  console.log(`\n🗺️  Seeded ${createdTiles.length} service tiles`);
  return createdTiles;
}

async function seedCompSchedules(orgId) {
  for (const config of DEFAULT_COMP_SCHEDULES) {
    const existing = await prisma.visitCompSchedule.findFirst({
      where: {
        orgId,
        frequency: config.frequency,
      },
      orderBy: { effectiveFrom: "desc" },
    });

    if (existing) {
      await prisma.visitCompSchedule.update({
        where: { id: existing.id },
        data: {
          baseRateCents: config.baseRateCents,
          haulAwayBonusCents: config.haulAwayBonusCents ?? 0,
          certificationMatrix: {
            defaultSharePercent: config.sharePercent ?? 0.45,
          },
        },
      });
    } else {
      await prisma.visitCompSchedule.create({
        data: {
          orgId,
          frequency: config.frequency,
          baseRateCents: config.baseRateCents,
          haulAwayBonusCents: config.haulAwayBonusCents ?? 0,
          ecoDiversionBonusCents: 200,
          effectiveFrom: new Date("2024-01-01T00:00:00Z"),
          isDefault: true,
          certificationMatrix: {
            defaultSharePercent: config.sharePercent ?? 0.45,
          },
        },
      });
    }
  }
  console.log("💵 Compensation schedules ensured");
}

async function seedScoopers(orgId, tiles) {
  console.log("\n🧑‍🔧 Seeding scooper contractors...");
  const scooperProfiles = [];

  for (const scooper of DEMO_SCOOPERS) {
    const user = await prisma.user.upsert({
      where: { email: scooper.email },
      update: {
        name: scooper.name,
        role: "TECH",
        phone: scooper.phone,
        orgId,
      },
      create: {
        email: scooper.email,
        name: scooper.name,
        role: "TECH",
        phone: scooper.phone,
        orgId,
      },
    });

    const profile = await prisma.scooperProfile.upsert({
      where: { userId: user.id },
      update: {
        orgId,
        status: "CERTIFIED",
        backgroundCheckStatus: "PASSED",
        vehicleVerified: true,
        vehicleDetail: scooper.vehicleDetail,
      },
      create: {
        orgId,
        userId: user.id,
        status: "CERTIFIED",
        backgroundCheckStatus: "PASSED",
        vehicleVerified: true,
        vehicleDetail: scooper.vehicleDetail,
      },
    });

    await prisma.scooperCertification.upsert({
      where: {
        scooperId_type: {
          scooperId: profile.id,
          type: "BIN_DROP",
        },
      },
      update: {
        status: "ACTIVE",
        issuedAt: new Date(),
      },
      create: {
        orgId,
        scooperId: profile.id,
        type: "BIN_DROP",
        status: "ACTIVE",
        issuedAt: new Date(),
      },
    });

    await prisma.scooperAvailability.deleteMany({
      where: { scooperId: profile.id },
    });

    const tileLookup = new Map(tiles.map((tile) => [tile.slug, tile]));
    for (const slug of scooper.tiles) {
      const tile = tileLookup.get(slug);
      if (!tile) continue;
      await prisma.scooperAvailability.create({
        data: {
          orgId,
          scooperId: profile.id,
          tileId: tile.id,
          weekday: 1,
          window: "AM",
          maxStops: 24,
        },
      });
    }

    scooperProfiles.push({ profile, user });
    console.log(`  ✅ Scooper ready: ${scooper.name}`);
  }

  return scooperProfiles;
}

function generateDataReadings(serviceVisitId, dogsServiced) {
  const readings = [];
  const baseTimestamp = new Date();

  // Generate 2-5 readings per service visit
  const readingCount = Math.floor(Math.random() * 4) + 2;

  for (let i = 0; i < readingCount; i++) {
    const timestamp = new Date(baseTimestamp.getTime() + i * 30 * 60 * 1000); // 30 min intervals

    readings.push({
      serviceVisitId,
      timestamp,
      weight: Math.floor(Math.random() * 500) + 100, // 100-600g
      volume: Math.floor(Math.random() * 200) + 50, // 50-250ml
      color: `rgb(${Math.floor(Math.random() * 100) + 100}, ${Math.floor(Math.random() * 100) + 100}, ${Math.floor(Math.random() * 100) + 50})`,
      consistency: getRandomElement(["firm", "soft", "normal", "loose"]),
      temperature: Math.floor(Math.random() * 10) + 20, // 20-30°C
      methaneLevel: Math.floor(Math.random() * 100), // 0-100 ppm
      deviceId: `YRD-${Math.floor(Math.random() * 100)
        .toString()
        .padStart(3, "0")}`,
    });
  }

  return readings;
}

// =============================================================================
// SEEDING FUNCTIONS
// =============================================================================

async function seedUsers(orgId) {
  console.log("👥 Seeding users...");

  const usersToCreate = isProduction ? DEMO_USERS.slice(0, 1) : DEMO_USERS;
  const createdUsers = [];

  for (const userData of usersToCreate) {
    try {
      const user = await prisma.user.upsert({
        where: { email: userData.email },
        update: {
          ...userData,
          orgId,
        },
        create: {
          ...userData,
          orgId,
        },
      });
      createdUsers.push(user);
      console.log(`  ✅ Created user: ${user.name} (${user.email})`);
    } catch (error) {
      console.error(
        `  ❌ Failed to create user ${userData.email}:`,
        error.message,
      );
    }
  }

  return createdUsers;
}

async function seedTechCredentials(users) {
  console.log("\n🔑 Seeding tech credentials...");
  
  const techUsers = users.filter((u) => u.role === "TECH");
  
  for (const user of techUsers) {
    try {
      const hashedPassword = await bcrypt.hash("yardura25!", 10);
      
      await prisma.account.deleteMany({
        where: {
          userId: user.id,
          provider: "credentials",
        },
      });
      
      await prisma.account.create({
        data: {
          userId: user.id,
          type: "credentials",
          provider: "credentials",
          providerAccountId: user.id,
          access_token: hashedPassword,
        },
      });
      
      console.log(`  ✅ Added credentials for ${user.email} (password: yardura25!)`);
    } catch (error) {
      console.error(`  ❌ Failed to add credentials for ${user.email}:`, error.message);
    }
  }
}

async function seedCustomers(users, orgId) {
  console.log("\n📇 Seeding customers...");
  const customers = [];

  for (const user of users.filter((u) => u.role === "CUSTOMER")) {
    const tile = await resolveSeedTile(orgId, user.city);

    let customer = await prisma.customer.findFirst({
      where: { userId: user.id },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          orgId,
          userId: user.id,
          name: user.name || user.email || "Household",
          email: user.email,
          phone: user.phone,
          addressLine1: user.address || "123 Demo St",
          city: user.city || "Minneapolis",
          state: user.state || "MN",
          zip: user.zipCode || "55401",
        },
      });
    } else {
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          email: user.email || customer.email,
          phone: user.phone || customer.phone,
          addressLine1: user.address || customer.addressLine1,
          city: user.city || customer.city,
          state: user.state || customer.state,
          zip: user.zipCode || customer.zip,
        },
      });
      customer = await prisma.customer.findUnique({ where: { id: customer.id } });
    }

    customers.push({ user, customer, tile });
    console.log(`  ✅ Customer ready: ${customer.name}`);
  }

  return customers;
}

async function seedDogs(users, orgId) {
  console.log("\n🐕 Seeding dogs...");

  const createdDogs = [];

  for (const user of users.filter((u) => u.role === "CUSTOMER")) {
    // Each user gets 1-3 dogs
    const dogCount = Math.floor(Math.random() * 3) + 1;
    const userDogs = [];

    for (let i = 0; i < dogCount; i++) {
      const dogData = getRandomElement(DEMO_DOGS);
      try {
        const dog = await prisma.dog.create({
          data: {
            ...dogData,
            userId: user.id,
            orgId,
          },
        });
        userDogs.push(dog);
        console.log(`  ✅ Created dog: ${dog.name} for ${user.name}`);
      } catch (error) {
        console.error(
          `  ❌ Failed to create dog for ${user.name}:`,
          error.message,
        );
      }
    }

    createdDogs.push(...userDogs);
  }

  return createdDogs;
}

async function seedServiceVisits(customers, org, tiles, scooperProfiles) {
  console.log("\n📅 Seeding service visits...");

  const createdVisits = [];
  const availableScoopers = scooperProfiles?.map((entry) => entry.user) ?? [];

  for (const entry of customers) {
    const { customer, tile } = entry;
    const perVisitCents = Math.floor(Math.random() * 1200) + 1800; // $18-$30
    const frequency = getRandomElement([
      Frequency.WEEKLY,
      Frequency.BI_WEEKLY,
      Frequency.TWICE_WEEKLY,
    ]);

    const job = await prisma.job.create({
      data: {
        orgId: org.id,
        customerId: customer.id,
        frequency,
        tileId: tile?.id ?? null,
        perVisitRevenueCents: perVisitCents,
        status: "ACTIVE",
      },
    });

    const visitCount = Math.floor(Math.random() * 4) + 6;
    const visitsPast = Math.floor(visitCount / 2);
    const daysBetween = frequency === Frequency.WEEKLY ? 7 : frequency === Frequency.TWICE_WEEKLY ? 3 : 14;

    for (let index = 0; index < visitCount; index++) {
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() - (visitCount - index) * daysBetween);
      scheduledDate.setHours(9, 0, 0, 0);

      const isPast = index < visitsPast;
      const assignedScooper =
        availableScoopers.length && Math.random() > 0.5
          ? getRandomElement(availableScoopers)
          : null;

      try {
        const visit = await prisma.serviceVisit.create({
          data: {
            orgId: org.id,
            customerId: customer.id,
            jobId: job.id,
            userId: customer.userId,
            scheduledDate,
            completedDate: isPast ? new Date(scheduledDate.getTime() + 60 * 60 * 1000) : null,
            status: isPast ? "COMPLETED" : "SCHEDULED",
            serviceType: frequency === Frequency.ONE_TIME ? "ONE_TIME" : "REGULAR",
            yardSize: "MEDIUM",
            dogsServiced: Math.floor(Math.random() * 2) + 1,
            assignedToId: assignedScooper ? assignedScooper.id : null,
            tileId: tile?.id ?? null,
            revenueCents: perVisitCents,
            metadata: {
              seeded: true,
            },
          },
        });

        createdVisits.push(visit);
      } catch (error) {
        console.error(
          `  ❌ Failed to create visit for ${customer.name}:`,
          error.message,
        );
      }
    }

    const nextVisit = await prisma.serviceVisit.findFirst({
      where: {
        jobId: job.id,
        status: "SCHEDULED",
      },
      orderBy: { scheduledDate: "asc" },
    });

    await prisma.job.update({
      where: { id: job.id },
      data: {
        nextVisitAt: nextVisit ? nextVisit.scheduledDate : null,
        dayOfWeek: nextVisit ? nextVisit.scheduledDate.getDay() : null,
      },
    });
  }

  return createdVisits;
}

async function seedRouteShifts(org, tiles) {
  console.log("\n🗓️  Seeding route shifts...");

  const tileLookup = new Map(tiles.map((tile) => [tile.id, tile]));

  const upcomingVisits = await prisma.serviceVisit.findMany({
    where: {
      orgId: org.id,
      status: "SCHEDULED",
      tileId: { not: null },
      routeShiftId: null,
      scheduledDate: { gte: new Date() },
    },
    orderBy: { scheduledDate: "asc" },
    select: {
      id: true,
      tileId: true,
      scheduledDate: true,
    },
  });

  const grouped = new Map();
  for (const visit of upcomingVisits) {
    if (!visit.tileId) continue;
    if (!grouped.has(visit.tileId)) grouped.set(visit.tileId, []);
    grouped.get(visit.tileId).push(visit);
  }

  const createdShifts = [];
  for (const [tileId, visits] of grouped.entries()) {
    const selected = visits.slice(0, Math.min(5, visits.length));
    if (!selected.length) continue;

    const serviceDate = new Date(selected[0].scheduledDate);

    const shift = await prisma.routeShift.create({
      data: {
        orgId: org.id,
        tileId,
        serviceDate,
        scheduledWindow: AvailabilityWindow.AM,
        status: "PLANNED",
        plannedStops: selected.length,
        primary: true,
      },
    });

    await prisma.serviceVisit.updateMany({
      where: { id: { in: selected.map((visit) => visit.id) } },
      data: { routeShiftId: shift.id },
    });

    createdShifts.push(shift);
  }

  console.log(`  ✅ Created ${createdShifts.length} route shifts`);
  return createdShifts;
}

async function seedVisitOffersForTiles(orgId, tileIds) {
  console.log("\n📣 Publishing visit offers...");
  let total = 0;

  for (const tileId of tileIds) {
    const visits = await prisma.serviceVisit.findMany({
      where: {
        orgId,
        tileId,
        status: "SCHEDULED",
        assignedToId: null,
        scheduledDate: { gte: new Date() },
      },
      select: { id: true, metadata: true, scheduledDate: true },
      take: 20,
    });

    for (const visit of visits) {
      const existing = await prisma.visitOffer.findFirst({
        where: {
          serviceVisitId: visit.id,
          status: { in: ["PENDING", "ACCEPTED"] },
        },
      });

      if (existing) continue;

      await prisma.visitOffer.create({
        data: {
          orgId,
          serviceVisitId: visit.id,
          tileId,
          status: "PENDING",
          priority: 0,
          dispatchStrategy: "seed-demo",
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          metadata: visit.metadata ?? {},
        },
      });
      total++;
    }
  }

  console.log(`  ✅ Created ${total} visit offers`);
}

async function seedDataReadings(serviceVisits) {
  console.log("\n📊 Seeding data readings...");

  let totalReadings = 0;

  for (const visit of serviceVisits) {
    if (visit.status === "COMPLETED") {
      const readings = generateDataReadings(visit.id, visit.dogsServiced);

      for (const readingData of readings) {
        try {
          await prisma.dataReading.create({
            data: readingData,
          });
          totalReadings++;
        } catch (error) {
          console.error(
            `  ❌ Failed to create data reading for visit ${visit.id}:`,
            error.message,
          );
        }
      }
    }
  }

  console.log(`  ✅ Created ${totalReadings} data readings`);
  return totalReadings;
}

async function seedCommissions(users, serviceVisits) {
  console.log("\n💰 Seeding commissions...");

  const salesRep = users.find((u) => u.role === "SALES_REP");
  if (!salesRep) {
    console.log("  ⚠️  No sales rep found, skipping commission seeding");
    return 0;
  }

  let commissionCount = 0;

  for (const visit of serviceVisits) {
    if (visit.status === "COMPLETED" && Math.random() > 0.3) {
      // 70% of completed visits get commissions
      try {
        const customer = users.find((u) => u.id === visit.userId);
        if (customer) {
          await prisma.commission.create({
            data: {
              salesRepId: salesRep.id,
              customerId: customer.id,
              serviceVisitId: visit.id,
              amount: Math.floor(Math.random() * 50) + 10, // $10-$60 commission
              status: Math.random() > 0.2 ? "PAID" : "PENDING", // 80% paid
              paidAt: Math.random() > 0.2 ? new Date() : null,
            },
          });
          commissionCount++;
        }
      } catch (error) {
        console.error(
          `  ❌ Failed to create commission for visit ${visit.id}:`,
          error.message,
        );
      }
    }
  }

  console.log(`  ✅ Created ${commissionCount} commissions`);
  return commissionCount;
}

async function seedGlobalStats() {
  console.log("\n🌍 Seeding global statistics...");

  try {
    const stats = await prisma.globalStats.upsert({
      where: { id: "global" },
      update: {
        totalWasteDiverted: 1250.5, // lbs
        totalMethaneAvoided: 890.2, // ft³
        totalUsers: DEMO_USERS.filter((u) => u.role === "CUSTOMER").length,
        totalDogs: DEMO_DOGS.length,
        totalServiceVisits: 0, // Will be updated after service visits are counted
      },
      create: {
        id: "global",
        totalWasteDiverted: 1250.5,
        totalMethaneAvoided: 890.2,
        totalUsers: DEMO_USERS.filter((u) => u.role === "CUSTOMER").length,
        totalDogs: DEMO_DOGS.length,
        totalServiceVisits: 0,
      },
    });

    console.log(
      `  ✅ Global stats updated: ${stats.totalUsers} users, ${stats.totalDogs} dogs`,
    );
    return stats;
  } catch (error) {
    console.error("  ❌ Failed to seed global stats:", error.message);
    return null;
  }
}

async function updateGlobalStats() {
  console.log("\n📈 Updating global statistics...");

  try {
    const userCount = await prisma.user.count({ where: { role: "CUSTOMER" } });
    const dogCount = await prisma.dog.count();
    const serviceVisitCount = await prisma.serviceVisit.count();

    await prisma.globalStats.update({
      where: { id: "global" },
      data: {
        totalUsers: userCount,
        totalDogs: dogCount,
        totalServiceVisits: serviceVisitCount,
        updatedAt: new Date(),
      },
    });

    console.log(
      `  ✅ Updated global stats: ${userCount} users, ${dogCount} dogs, ${serviceVisitCount} visits`,
    );
  } catch (error) {
    console.error("  ❌ Failed to update global stats:", error.message);
  }
}

async function seedOutboundDemo(users) {
  console.log("\n🗺️  Seeding outbound demo data...");

  try {
    const org = await prisma.org.findFirst();
    const salesRepUser = users.find((u) => u.role === "SALES_REP");

    if (!org || !salesRepUser) {
      console.warn(
        "  ⚠️  Skipping outbound demo seed (missing org or sales rep)",
      );
      return;
    }

    const slug = `outbound-${Date.now()}`;

    const territory = await prisma.territory.create({
      data: {
        orgId: org.id,
        name: "South Uptown",
        slug,
        type: "AREA",
        color: "#0ea5e9",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-93.3076, 44.901],
              [-93.3025, 44.901],
              [-93.3025, 44.896],
              [-93.3076, 44.896],
              [-93.3076, 44.901],
            ],
          ],
        },
        assignments: {
          create: {
            orgId: org.id,
            userId: salesRepUser.id,
            role: "OWNER",
            isPrimary: true,
          },
        },
      },
    });

    const lead = await prisma.lead.create({
      data: {
        orgId: org.id,
        leadType: "outbound",
        pipelineStage: "cold",
        firstName: "Jordan",
        lastName: "Neighbor",
        email: `outbound-${Date.now()}@yardura.test`,
        phone: "555-0100",
        address: "5630 Colfax Ave S",
        city: "Minneapolis",
        state: "MN",
        zipCode: "55419",
        ownerId: salesRepUser.id,
        createdById: salesRepUser.id,
        territoryId: territory.id,
        source: "outbound",
        pricingBreakdown: {
          metadata: {
            preferredStartDate: new Date().toISOString(),
            howDidYouHear: "Door knock",
          },
        },
        activities: {
          create: {
            orgId: org.id,
            userId: salesRepUser.id,
            type: "DOOR_KNOCK",
            notes: "Friendly dog, wants info",
          },
        },
      },
      include: { activities: true },
    });

    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        lastActivityId: lead.activities?.[0]?.id ?? null,
        lastActivityAt: lead.activities?.[0]?.occurredAt ?? new Date(),
      },
    });

    await prisma.trip.create({
      data: {
        orgId: org.id,
        createdById: salesRepUser.id,
        ownerId: salesRepUser.id,
        territoryId: territory.id,
        name: "Uptown Sweep",
        startLocation: { lat: 44.9005, lng: -93.3052 },
        stops: {
          create: {
            leadId: lead.id,
            order: 1,
            plannedAt: new Date(),
          },
        },
      },
    });

    console.log("  ✅ Outbound demo data added");
  } catch (error) {
    console.error("  ❌ Failed to seed outbound demo data:", error.message);
  }
}

// =============================================================================
// MAIN SEEDING FUNCTION
// =============================================================================

async function main() {
  try {
    // Clear existing data in development (not in production)
    if (!isProduction) {
      console.log("🧹 Clearing existing demo data...");
      // Delete in reverse dependency order (with safe checks)
      const deleteIfExists = async (model, modelName) => {
        try {
          if (model && model.deleteMany) {
            await model.deleteMany();
          }
        } catch (error) {
          console.log(`  ⚠️  Could not delete ${modelName}: ${error.message}`);
        }
      };

      await deleteIfExists(prisma.visitOffer, "VisitOffer");
      await deleteIfExists(prisma.routeStop, "RouteStop");
      await deleteIfExists(prisma.routeShift, "RouteShift");
      await deleteIfExists(prisma.visitPayout, "VisitPayout");
      await deleteIfExists(prisma.ledgerEntry, "LedgerEntry");
      await deleteIfExists(prisma.commission, "Commission");
      await deleteIfExists(prisma.dataReading, "DataReading");
      await deleteIfExists(prisma.serviceVisit, "ServiceVisit");
      await deleteIfExists(prisma.job, "Job");
      await deleteIfExists(prisma.customer, "Customer");
      await deleteIfExists(prisma.dog, "Dog");
      await deleteIfExists(prisma.territoryAssignment, "TerritoryAssignment");
      await deleteIfExists(prisma.scooperDevice, "ScooperDevice");
      await deleteIfExists(prisma.scooperAvailability, "ScooperAvailability");
      await deleteIfExists(prisma.scooperProfile, "ScooperProfile");
      
      try {
        await prisma.user.deleteMany({
          where: { email: { in: DEMO_USERS.map((u) => u.email) } },
        });
      } catch (error) {
        console.log(`  ⚠️  Could not delete demo users: ${error.message}`);
      }
      
      console.log("  ✅ Cleared existing demo data");
    }

    // Seed data in order
    const org = await ensureOrg();
    const tiles = await seedServiceTilesForOrg(org.id);
    await seedCompSchedules(org.id);

    const users = await seedUsers(org.id);
    await seedTechCredentials(users);
    const customers = await seedCustomers(users, org.id);
    const dogs = await seedDogs(users, org.id);
    const scooperProfiles = await seedScoopers(org.id, tiles);
    await seedGlobalStats();
    const serviceVisits = await seedServiceVisits(customers, org, tiles, scooperProfiles);
    const routeShifts = await seedRouteShifts(org, tiles);
    await seedVisitOffersForTiles(org.id, tiles.map((tile) => tile.id));
    const dataReadingsCount = await seedDataReadings(serviceVisits);
    const commissionsCount = await seedCommissions(users, serviceVisits);

    await seedOutboundDemo(users);

    // Update global statistics with final counts
    await updateGlobalStats();

    // Summary
    console.log("\n" + "=".repeat(50));
    console.log("🎉 DATABASE SEEDING COMPLETED");
    console.log("=".repeat(50));
    console.log(`Environment: ${environment}`);
    console.log(`Users: ${users.length}`);
    console.log(`Customers: ${customers.length}`);
    console.log(`Dogs: ${dogs.length}`);
    console.log(`Service Visits: ${serviceVisits.length}`);
    console.log(`Data Readings: ${dataReadingsCount}`);
    console.log(`Route Shifts: ${routeShifts.length}`);
    console.log(`Commissions: ${commissionsCount}`);
    console.log("=".repeat(50));

    if (!isProduction) {
      console.log("\n🔐 Demo Credentials:");
      console.log("   Customer: demo@yardura.com");
      console.log("   Sales Rep: sales@yardura.com");
      console.log("   (Use any password for testing)");
      console.log("");
      console.log("   Field Tech: jordan.scooper@example.com");
      console.log("   Password: yardura25!");
    }
  } catch (error) {
    console.error("\n❌ Seeding failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Handle command line arguments
if (require.main === module) {
  const validEnvironments = ["development", "staging", "production"];
  if (process.argv[2] && !validEnvironments.includes(process.argv[2])) {
    console.error(
      `Invalid environment. Must be one of: ${validEnvironments.join(", ")}`,
    );
    process.exit(1);
  }

  main();
}

module.exports = {
  main,
  seedUsers,
  seedCustomers,
  seedDogs,
  seedServiceVisits,
  seedRouteShifts,
  seedVisitOffersForTiles,
};
