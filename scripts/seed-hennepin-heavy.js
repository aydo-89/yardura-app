#!/usr/bin/env node

/**
 * HIGH-VOLUME Hennepin County Seeding Script
 * 
 * Seeds database with realistic high-volume production load:
 * - All Hennepin County service tiles
 * - 4 scoopers with various availability windows
 * - 120+ CUSTOMERS with realistic frequency distribution
 * - 130-150+ upcoming visits to test API call optimization
 * - Tests route optimization under realistic load
 * 
 * Use this to verify:
 * - Google Maps API caching effectiveness
 * - Route optimization performance at scale
 * - Cost estimates for production deployment
 */

const { PrismaClient, Frequency } = require("@prisma/client");
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

const DEFAULT_ORG = {
  id: "yardura",
  name: "InsightScoop",
  slug: "yardura",
};

// Test scoopers with different availability patterns
const TEST_SCOOPERS = [
  {
    email: "jordan.scooper@example.com",
    name: "Jordan Thompson",
    phone: "+1-612-555-0201",
    vehicleDetail: "2019 Ford Transit",
    tiles: [
      { slug: "minneapolis-central", weekday: 1, window: "AM", maxStops: 30 },
      { slug: "minneapolis-central", weekday: 3, window: "AM", maxStops: 30 },
      { slug: "minneapolis-central", weekday: 5, window: "AM", maxStops: 30 },
      { slug: "edina-north", weekday: 2, window: "PM", maxStops: 25 },
      { slug: "edina-north", weekday: 4, window: "PM", maxStops: 25 },
    ],
  },
  {
    email: "alex.field@example.com",
    name: "Alex Martinez",
    phone: "+1-612-555-0202",
    vehicleDetail: "2021 Toyota Tacoma",
    tiles: [
      { slug: "bloomington-west", weekday: 1, window: "AM", maxStops: 35 },
      { slug: "bloomington-west", weekday: 3, window: "AM", maxStops: 35 },
      { slug: "bloomington-east", weekday: 2, window: "PM", maxStops: 30 },
      { slug: "bloomington-east", weekday: 4, window: "PM", maxStops: 30 },
      { slug: "richfield-core", weekday: 5, window: "AM", maxStops: 28 },
    ],
  },
  {
    email: "taylor.swift@example.com",
    name: "Taylor Anderson",
    phone: "+1-612-555-0203",
    vehicleDetail: "2020 Honda Ridgeline",
    tiles: [
      { slug: "maple-grove-northwest", weekday: 1, window: "PM", maxStops: 32 },
      { slug: "maple-grove-southeast", weekday: 3, window: "PM", maxStops: 32 },
      { slug: "brooklyn-park-south", weekday: 2, window: "AM", maxStops: 28 },
      { slug: "brooklyn-park-south", weekday: 4, window: "AM", maxStops: 28 },
      { slug: "plymouth-east", weekday: 5, window: "PM", maxStops: 30 },
    ],
  },
  {
    email: "sam.rivers@example.com",
    name: "Sam Rivers",
    phone: "+1-612-555-0204",
    vehicleDetail: "2022 Chevrolet Colorado",
    tiles: [
      { slug: "minnetonka-east", weekday: 1, window: "AM", maxStops: 30 },
      { slug: "minnetonka-west", weekday: 2, window: "AM", maxStops: 30 },
      { slug: "eden-prairie-north", weekday: 3, window: "PM", maxStops: 28 },
      { slug: "eden-prairie-south", weekday: 4, window: "PM", maxStops: 28 },
      { slug: "hopkins-downtown", weekday: 5, window: "AM", maxStops: 25 },
    ],
  },
];

// Test customers distributed across tiles
// HIGH VOLUME: 120 total customers creating 130-150+ visits
const TEST_CUSTOMERS = [
  // High-frequency customers (DAILY) - 20 customers (realistic for production)
  ...Array.from({ length: 20 }, (_, i) => ({
    email: `daily.customer.${i + 1}@example.com`,
    name: `Daily Customer ${i + 1}`,
    phone: `+1-612-555-${String(1001 + i).padStart(4, "0")}`,
    city: ["Minneapolis", "Bloomington", "Edina", "Maple Grove", "Plymouth"][i],
    address: `${(i + 1) * 100} Main St`,
    zipCode: ["55401", "55425", "55436", "55369", "55441"][i],
    frequency: Frequency.DAILY,
  })),
  // Twice-weekly customers - 30 customers (common frequency)
  ...Array.from({ length: 30 }, (_, i) => ({
    email: `twice.customer.${i + 1}@example.com`,
    name: `Twice Weekly Customer ${i + 1}`,
    phone: `+1-612-555-${String(2001 + i).padStart(4, "0")}`,
    city: [
      "Minneapolis",
      "Bloomington",
      "Edina",
      "Maple Grove",
      "Plymouth",
      "Minnetonka",
      "Eden Prairie",
      "Brooklyn Park",
      "Richfield",
      "Hopkins",
    ][i],
    address: `${(i + 1) * 200} Oak Ave`,
    zipCode: [
      "55401",
      "55425",
      "55436",
      "55369",
      "55441",
      "55305",
      "55344",
      "55443",
      "55423",
      "55305",
    ][i],
    frequency: Frequency.TWICE_WEEKLY,
  })),
  // Weekly customers - 50 customers (most common frequency)
  ...Array.from({ length: 50 }, (_, i) => ({
    email: `weekly.customer.${i + 1}@example.com`,
    name: `Weekly Customer ${i + 1}`,
    phone: `+1-612-555-${String(3001 + i).padStart(4, "0")}`,
    city: [
      "Minneapolis",
      "Bloomington",
      "Edina",
      "Maple Grove",
      "Plymouth",
      "Minnetonka",
      "Eden Prairie",
      "Brooklyn Park",
      "Richfield",
      "Hopkins",
      "St. Louis Park",
      "Crystal",
      "Brooklyn Center",
      "Champlin",
      "Rogers",
    ][i],
    address: `${(i + 1) * 300} Pine St`,
    zipCode: [
      "55401",
      "55425",
      "55436",
      "55369",
      "55441",
      "55305",
      "55344",
      "55443",
      "55423",
      "55305",
      "55416",
      "55427",
      "55429",
      "55316",
      "55374",
    ][i],
    frequency: Frequency.WEEKLY,
  })),
  // Bi-weekly customers - 20 customers
  ...Array.from({ length: 20 }, (_, i) => ({
    email: `biweekly.customer.${i + 1}@example.com`,
    name: `Bi-Weekly Customer ${i + 1}`,
    phone: `+1-612-555-${String(4001 + i).padStart(4, "0")}`,
    city: [
      "Minneapolis",
      "Bloomington",
      "Edina",
      "Maple Grove",
      "Plymouth",
      "Minnetonka",
      "Eden Prairie",
      "Brooklyn Park",
      "Richfield",
      "Hopkins",
    ][i],
    address: `${(i + 1) * 400} Elm St`,
    zipCode: [
      "55401",
      "55425",
      "55436",
      "55369",
      "55441",
      "55305",
      "55344",
      "55443",
      "55423",
      "55305",
    ][i],
    frequency: Frequency.BI_WEEKLY,
  })),
];

console.log("🌱 Starting comprehensive Hennepin County seed...\n");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const TILE_GEOJSON_PATH = path.resolve(PROJECT_ROOT, "data/tiles/hennepin.geojson");

function runCommand(binary, args, options = {}) {
  const result = spawnSync(binary, args, {
    cwd: PROJECT_ROOT,
    stdio: "inherit",
    env: { ...process.env, ...(options.env ?? {}) },
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${binary} ${args.join(" ")}`);
  }
}

function runNpmScript(script, extraArgs = []) {
  const base = ["run", script];
  if (extraArgs.length > 0) {
    base.push("--", ...extraArgs);
  }
  runCommand("npm", base);
}

function loadTilesFromGeoJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || parsed.type !== "FeatureCollection" || !Array.isArray(parsed.features)) {
    throw new Error(`GeoJSON at ${filePath} is not a FeatureCollection.`);
  }

  return parsed.features.map((feature, index) => {
    const props = feature?.properties ?? {};
    if (!props.slug) {
      throw new Error(`GeoJSON feature at index ${index} is missing a slug property.`);
    }

    const toWindows = Array.isArray(props.serviceWindows)
      ? props.serviceWindows.map((win) => ({
          weekday: Number(win.weekday ?? win.day ?? win.dow ?? 0),
          window: (win.window ?? win.windowSlot ?? win.slot ?? "AM").toUpperCase(),
          maxStops: Number(win.maxStops ?? win.max ?? 0),
        }))
      : [];

    return {
      slug: String(props.slug),
      name: props.name ?? props.title ?? props.slug,
      status: (props.status ?? "WAITLIST").toUpperCase(),
      minCertifiedScoopers: Number(
        props.minCertifiedScoopers ?? props.min_scoopers ?? props.minScoopers ?? 0,
      ),
      minCustomerUnits: Number(
        props.minCustomerUnits ?? props.min_units ?? props.minUnits ?? 0,
      ),
      coverageRadiusMeters: props.coverageRadiusMeters ?? props.coverage_radius_m ?? null,
      serviceWindows: toWindows,
      notes: props.notes ?? props.description ?? undefined,
    };
  });
}

async function loadLegacyTileSeeds() {
  const modulePath = path.resolve(PROJECT_ROOT, "prisma/seed-data/hennepinTiles.ts");
  const hennepinModule = await import(modulePath);
  return (
    hennepinModule.HENNEPIN_TILE_SEEDS ||
    hennepinModule.MAJOR_CITY_TILE_SEEDS ||
    hennepinModule.default ||
    []
  );
}

async function resolveTileDefinitions() {
  if (fs.existsSync(TILE_GEOJSON_PATH)) {
    console.log("📦 Loading tile definitions from data/tiles/hennepin.geojson\n");
    const tiles = loadTilesFromGeoJson(TILE_GEOJSON_PATH);
    console.log(`  ✅ Parsed ${tiles.length} tile definitions from GeoJSON\n`);
    return { tiles, source: "geojson" };
  }

  console.log("📦 Loading Hennepin County tiles from legacy TypeScript seeds...\n");
  try {
    const tiles = await loadLegacyTileSeeds();
    console.log(`  ✅ Loaded ${tiles.length} tile definitions\n`);
    return { tiles, source: "legacy" };
  } catch (error) {
    console.error("  ❌ Failed to load Hennepin tiles:", error.message);
    return { tiles: [], source: "legacy" };
  }
}

function importTilesIntoPostgis(orgId) {
  if (!fs.existsSync(TILE_GEOJSON_PATH)) {
    console.warn(
      "⚠️  data/tiles/hennepin.geojson not found. Skipping PostGIS tile import.\n" +
        "    See NATIONWIDE_DATA_SETUP.md for instructions on generating the GeoJSON.",
    );
    return false;
  }

  console.log("🛰️  Importing Hennepin tiles into PostGIS...");
  runNpmScript("etl:tiles", [
    `--from=${TILE_GEOJSON_PATH}`,
    `--org=${orgId}`,
    "--status=WAITLIST",
  ]);

  console.log("🔁 Synchronising tile ↔ ZIP coverage via PostGIS...");
  runNpmScript("etl:tile-zips", [`--org=${orgId}`, "--status=WAITLIST"]);
  console.log("  ✅ PostGIS tile import complete\n");
  return true;
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
  console.log(`🏢 Organization: ${org.name} (${org.id})\n`);
  return org;
}

async function seedHennepinTiles(orgId, tileDefs) {
  console.log("🗺️  Seeding Hennepin County service tiles...");
  const created = [];

  for (const def of tileDefs) {
    try {
      const tile = await prisma.serviceTile.upsert({
        where: {
          orgId_slug: {
            orgId,
            slug: def.slug,
          },
        },
        update: {
          name: def.name,
          status: def.status,
          minCertifiedScoopers: def.minCertifiedScoopers,
          minCustomerUnits: def.minCustomerUnits,
          serviceWindows: def.serviceWindows,
          coverageRadiusMeters: def.coverageRadiusMeters,
        },
        create: {
          orgId,
          slug: def.slug,
          name: def.name,
          status: def.status,
          minCertifiedScoopers: def.minCertifiedScoopers,
          minCustomerUnits: def.minCustomerUnits,
          serviceWindows: def.serviceWindows,
          coverageRadiusMeters: def.coverageRadiusMeters,
        },
      });
      created.push(tile);
    } catch (error) {
      console.error(`  ❌ Failed to seed tile ${def.slug}:`, error.message);
    }
  }

  console.log(`  ✅ Seeded ${created.length} tiles\n`);
  return created;
}

async function seedScoopers(orgId, tiles) {
  console.log("👷 Seeding field technicians...");
  const profiles = [];

  for (const scooper of TEST_SCOOPERS) {
    try {
      // Create/update user
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

      // Create credentials
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

      // Create profile
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

      // Add certification
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

      // Clear and recreate availability
      await prisma.scooperAvailability.deleteMany({
        where: { scooperId: profile.id },
      });

      const tileMap = new Map(tiles.map((t) => [t.slug, t]));
      for (const avail of scooper.tiles) {
        const tile = tileMap.get(avail.slug);
        if (!tile) {
          console.warn(`    ⚠️  Tile ${avail.slug} not found for ${scooper.name}`);
          continue;
        }

        await prisma.scooperAvailability.create({
          data: {
            orgId,
            scooperId: profile.id,
            tileId: tile.id,
            weekday: avail.weekday,
            window: avail.window,
            maxStops: avail.maxStops,
          },
        });
      }

      profiles.push({ user, profile });
      console.log(
        `  ✅ ${scooper.name} - ${scooper.tiles.length} availability windows`
      );
    } catch (error) {
      console.error(`  ❌ Failed to seed ${scooper.email}:`, error.message);
    }
  }

  console.log(`\n`);
  return profiles;
}

async function seedCustomersAndVisits(orgId, tiles) {
  console.log("👥 Seeding customers and service visits...");
  let totalVisits = 0;
  let totalJobs = 0;

  const tilesByCity = new Map();
  tiles.forEach((tile) => {
    const city = tile.name.split("–")[0].trim().toLowerCase();
    if (!tilesByCity.has(city)) {
      tilesByCity.set(city, []);
    }
    tilesByCity.get(city).push(tile);
  });

  for (const customerData of TEST_CUSTOMERS) {
    try {
      // Create user
      const user = await prisma.user.upsert({
        where: { email: customerData.email },
        update: {
          name: customerData.name,
          role: "CUSTOMER",
          phone: customerData.phone,
          orgId,
        },
        create: {
          email: customerData.email,
          name: customerData.name,
          role: "CUSTOMER",
          phone: customerData.phone,
          orgId,
        },
      });

      // Find appropriate tile
      const cityLower = customerData.city.toLowerCase();
      const cityTiles = tilesByCity.get(cityLower) || [];
      const tile = cityTiles[Math.floor(Math.random() * cityTiles.length)] || tiles[0];

      if (!tile) {
        console.warn(`  ⚠️  No tile found for ${customerData.name} in ${customerData.city}`);
        continue;
      }

      // Create customer
      const customer = await prisma.customer.upsert({
        where: { userId: user.id },
        update: {
          name: customerData.name,
          email: customerData.email,
          phone: customerData.phone,
          addressLine1: customerData.address,
          city: customerData.city,
          state: "MN",
          zip: customerData.zipCode,
        },
        create: {
          orgId,
          userId: user.id,
          name: customerData.name,
          email: customerData.email,
          phone: customerData.phone,
          addressLine1: customerData.address,
          city: customerData.city,
          state: "MN",
          zip: customerData.zipCode,
        },
      });

      // Create recurring job
      const perVisitCents =
        customerData.frequency === Frequency.DAILY
          ? 550
          : customerData.frequency === Frequency.TWICE_WEEKLY
            ? 950
            : customerData.frequency === Frequency.WEEKLY
              ? 1200
              : 1600;

      const job = await prisma.job.create({
        data: {
          orgId,
          customerId: customer.id,
          frequency: customerData.frequency,
          tileId: tile.id,
          perVisitRevenueCents: perVisitCents,
          status: "ACTIVE",
        },
      });
      totalJobs++;

      // Generate visits
      const daysBetween =
        customerData.frequency === Frequency.DAILY
          ? 1
          : customerData.frequency === Frequency.TWICE_WEEKLY
            ? 3
            : customerData.frequency === Frequency.WEEKLY
              ? 7
              : 14;

      // Create past visits (last 30 days) and future visits (next 30 days)
      const visitCount = Math.floor(60 / daysBetween);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      for (let i = 0; i < visitCount; i++) {
        const scheduledDate = new Date(startDate);
        scheduledDate.setDate(scheduledDate.getDate() + i * daysBetween);
        scheduledDate.setHours(9, 0, 0, 0);

        const isPast = scheduledDate < new Date();

        await prisma.serviceVisit.create({
          data: {
            orgId,
            customerId: customer.id,
            jobId: job.id,
            userId: user.id,
            scheduledDate,
            completedDate: isPast
              ? new Date(scheduledDate.getTime() + 60 * 60 * 1000)
              : null,
            status: isPast ? "COMPLETED" : "SCHEDULED",
            serviceType: "REGULAR",
            yardSize: "MEDIUM",
            dogsServiced: Math.floor(Math.random() * 2) + 1,
            tileId: tile.id,
            revenueCents: perVisitCents,
            metadata: {
              seeded: true,
              frequency: customerData.frequency,
            },
          },
        });
        totalVisits++;
      }

      // Update job with next visit
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
          nextVisitAt: nextVisit?.scheduledDate,
          dayOfWeek: nextVisit?.scheduledDate.getDay(),
        },
      });
    } catch (error) {
      console.error(
        `  ❌ Failed to seed ${customerData.email}:`,
        error.message
      );
    }
  }

  console.log(`  ✅ Created ${totalJobs} jobs with ${totalVisits} visits\n`);
}

async function seedCompSchedules(orgId) {
  console.log("💵 Seeding compensation schedules...");
  const schedules = [
    {
      frequency: Frequency.DAILY,
      baseRateCents: 550,
      haulAwayBonusCents: 300,
      sharePercent: 0.45,
    },
    {
      frequency: Frequency.TWICE_WEEKLY,
      baseRateCents: 950,
      haulAwayBonusCents: 300,
      sharePercent: 0.45,
    },
    {
      frequency: Frequency.WEEKLY,
      baseRateCents: 1200,
      haulAwayBonusCents: 400,
      sharePercent: 0.45,
    },
    {
      frequency: Frequency.BI_WEEKLY,
      baseRateCents: 1600,
      haulAwayBonusCents: 400,
      sharePercent: 0.45,
    },
    {
      frequency: Frequency.MONTHLY,
      baseRateCents: 2200,
      haulAwayBonusCents: 500,
      sharePercent: 0.5,
    },
    {
      frequency: Frequency.ONE_TIME,
      baseRateCents: 4500,
      haulAwayBonusCents: 700,
      sharePercent: 0.5,
    },
  ];

  for (const config of schedules) {
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
          haulAwayBonusCents: config.haulAwayBonusCents,
          certificationMatrix: {
            defaultSharePercent: config.sharePercent,
          },
        },
      });
    } else {
      await prisma.visitCompSchedule.create({
        data: {
          orgId,
          frequency: config.frequency,
          baseRateCents: config.baseRateCents,
          haulAwayBonusCents: config.haulAwayBonusCents,
          ecoDiversionBonusCents: 200,
          effectiveFrom: new Date("2024-01-01T00:00:00Z"),
          isDefault: true,
          certificationMatrix: {
            defaultSharePercent: config.sharePercent,
          },
        },
      });
    }
  }

  console.log("  ✅ Compensation schedules ready\n");
}

async function createVisitOffers(orgId) {
  console.log("📣 Creating visit offers for upcoming visits...");

  // Find all unassigned future visits
  const unassignedVisits = await prisma.serviceVisit.findMany({
    where: {
      orgId,
      status: "SCHEDULED",
      assignedToId: null,
      scheduledDate: {
        gte: new Date(),
        lte: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Next 2 weeks
      },
    },
    take: 50,
  });

  let offerCount = 0;
  for (const visit of unassignedVisits) {
    const existing = await prisma.visitOffer.findFirst({
      where: {
        serviceVisitId: visit.id,
        status: { in: ["PENDING", "ACCEPTED"] },
      },
    });

    if (!existing && visit.tileId) {
      await prisma.visitOffer.create({
        data: {
          orgId,
          serviceVisitId: visit.id,
          tileId: visit.tileId,
          status: "PENDING",
          priority: 0,
          dispatchStrategy: "hennepin-seed",
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
          metadata: {
            seeded: true,
          },
        },
      });
      offerCount++;
    }
  }

  console.log(`  ✅ Created ${offerCount} visit offers\n`);
}

async function main() {
  try {
    console.log("=" + "=".repeat(70));
    console.log("🌱 HENNEPIN COUNTY COMPREHENSIVE SEED");
    console.log("=" + "=".repeat(70) + "\n");

    // 1. Load tile definitions (GeoJSON preferred)
    const { tiles: tileDefs, source } = await resolveTileDefinitions();
    if (!tileDefs.length) {
      console.error("❌ No tile definitions loaded. Exiting.\n");
      process.exit(1);
    }

    // 2. Ensure org
    const org = await ensureOrg();

    // 3. Import tiles into PostGIS if GeoJSON present
    const postgisImported = source === "geojson" ? importTilesIntoPostgis(org.id) : false;

    if (source === "legacy" && !postgisImported) {
      console.warn(
        "⚠️  PostGIS tile import skipped. To enable spatial workflows, create data/tiles/hennepin.geojson",
      );
    }

    // 4. Seed tiles into Prisma for operational workflows
    const tiles = await seedHennepinTiles(org.id, tileDefs);

    // 5. Seed compensation schedules
    await seedCompSchedules(org.id);

    // 6. Seed scoopers with availability
    const scooperProfiles = await seedScoopers(org.id, tiles);

    // 7. Seed customers and visits
    await seedCustomersAndVisits(org.id, tiles);

    // 8. Create visit offers
    await createVisitOffers(org.id);

    // 9. Final stats
    const stats = {
      tiles: tiles.length,
      scoopers: scooperProfiles.length,
      customers: TEST_CUSTOMERS.length,
      jobs: await prisma.job.count({ where: { orgId: org.id } }),
      visits: await prisma.serviceVisit.count({ where: { orgId: org.id } }),
      offers: await prisma.visitOffer.count({
        where: { orgId: org.id, status: "PENDING" },
      }),
    };

    console.log("=" + "=".repeat(70));
    console.log("✅ SEEDING COMPLETE");
    console.log("=" + "=".repeat(70));
    console.log(`Service Tiles: ${stats.tiles}`);
    console.log(`Field Techs: ${stats.scoopers}`);
    console.log(`Customers: ${stats.customers}`);
    console.log(`Active Jobs: ${stats.jobs}`);
    console.log(`Service Visits: ${stats.visits}`);
    console.log(`Pending Offers: ${stats.offers}`);
    console.log("=" + "=".repeat(70));

    console.log("\n🔐 Test Credentials:");
    console.log("   Field Tech: jordan.scooper@example.com");
    console.log("   Field Tech: alex.field@example.com");
    console.log("   Field Tech: taylor.swift@example.com");
    console.log("   Field Tech: sam.rivers@example.com");
    console.log("   Password: yardura25!");
    console.log("\n   Customers: daily.customer.1@example.com ... weekly.customer.15@example.com");
    console.log("   (Use any password for testing)\n");
  } catch (error) {
    console.error("\n❌ Seeding failed:", error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
