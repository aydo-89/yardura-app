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

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Configuration based on environment
const environment = process.argv[2] || 'development';
const isProduction = environment === 'production';
const isStaging = environment === 'staging';

console.log(`🌱 Seeding database for ${environment} environment...\n`);

// =============================================================================
// DEMO DATA CONFIGURATION
// =============================================================================

const DEMO_USERS = [
  {
    email: 'demo@yardura.com',
    name: 'Demo User',
    phone: '+1-612-555-0101',
    address: '123 Main St',
    city: 'Minneapolis',
    zipCode: '55401',
    role: 'CUSTOMER',
  },
  {
    email: 'sarah.johnson@example.com',
    name: 'Sarah Johnson',
    phone: '+1-612-555-0102',
    address: '456 Oak Ave',
    city: 'St. Paul',
    zipCode: '55101',
    role: 'CUSTOMER',
  },
  {
    email: 'mike.wilson@example.com',
    name: 'Mike Wilson',
    phone: '+1-612-555-0103',
    address: '789 Pine St',
    city: 'Minneapolis',
    zipCode: '55402',
    role: 'CUSTOMER',
  },
  {
    email: 'sales@yardura.com',
    name: 'Alex Rodriguez',
    phone: '+1-612-555-0199',
    address: '100 Sales Blvd',
    city: 'Minneapolis',
    zipCode: '55415',
    role: 'SALES_REP',
  },
];

const DEMO_DOGS = [
  { name: 'Max', breed: 'Golden Retriever', age: 3, weight: 65 },
  { name: 'Bella', breed: 'Labrador', age: 2, weight: 55 },
  { name: 'Charlie', breed: 'Beagle', age: 4, weight: 25 },
  { name: 'Luna', breed: 'German Shepherd', age: 1, weight: 70 },
  { name: 'Rocky', breed: 'Bulldog', age: 5, weight: 45 },
  { name: 'Sadie', breed: 'Poodle', age: 2, weight: 35 },
  { name: 'Buddy', breed: 'Mixed Breed', age: 3, weight: 40 },
  { name: 'Maggie', breed: 'Boxer', age: 4, weight: 60 },
];

const SERVICE_TYPES = ['REGULAR', 'ONE_TIME', 'SPRING_CLEANUP'];
const YARD_SIZES = ['SMALL', 'MEDIUM', 'LARGE', 'XLARGE'];
const SERVICE_STATUSES = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED'];

const SAMPLE_NOTES = [
  'Regular weekly service',
  'Spring cleanup - extra attention needed',
  'First-time customer - welcome package',
  'Large yard with multiple dogs',
  'Customer requested deodorizer',
  'Rescheduled from last week',
  'New customer onboarding',
  'Regular maintenance visit',
];

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function generateServiceVisits(userId, dogCount) {
  const visits = [];
  const now = new Date();
  const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Generate 3-8 service visits per user over the last 3 months
  const visitCount = Math.floor(Math.random() * 6) + 3;

  for (let i = 0; i < visitCount; i++) {
    const scheduledDate = getRandomDate(threeMonthsAgo, now);
    const isCompleted = scheduledDate < now;
    const completedDate = isCompleted ? new Date(scheduledDate.getTime() + Math.random() * 2 * 60 * 60 * 1000) : null;

    visits.push({
      userId,
      scheduledDate,
      completedDate,
      status: isCompleted ? 'COMPLETED' : getRandomElement(['SCHEDULED', 'IN_PROGRESS']),
      serviceType: getRandomElement(SERVICE_TYPES),
      yardSize: getRandomElement(YARD_SIZES),
      dogsServiced: Math.min(dogCount, Math.floor(Math.random() * 3) + 1),
      notes: Math.random() > 0.7 ? getRandomElement(SAMPLE_NOTES) : null,
      deodorize: Math.random() > 0.6,
      litterService: Math.random() > 0.8,
    });
  }

  return visits.sort((a, b) => b.scheduledDate - a.scheduledDate);
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
      volume: Math.floor(Math.random() * 200) + 50,   // 50-250ml
      color: `rgb(${Math.floor(Math.random() * 100) + 100}, ${Math.floor(Math.random() * 100) + 100}, ${Math.floor(Math.random() * 100) + 50})`,
      consistency: getRandomElement(['firm', 'soft', 'normal', 'loose']),
      temperature: Math.floor(Math.random() * 10) + 20, // 20-30°C
      methaneLevel: Math.floor(Math.random() * 100), // 0-100 ppm
      deviceId: `YRD-${Math.floor(Math.random() * 100).toString().padStart(3, '0')}`,
    });
  }

  return readings;
}

// =============================================================================
// SEEDING FUNCTIONS
// =============================================================================

async function seedUsers() {
  console.log('👥 Seeding users...');

  const usersToCreate = isProduction ? DEMO_USERS.slice(0, 1) : DEMO_USERS;
  const createdUsers = [];

  for (const userData of usersToCreate) {
    try {
      const user = await prisma.user.upsert({
        where: { email: userData.email },
        update: userData,
        create: userData,
      });
      createdUsers.push(user);
      console.log(`  ✅ Created user: ${user.name} (${user.email})`);
    } catch (error) {
      console.error(`  ❌ Failed to create user ${userData.email}:`, error.message);
    }
  }

  return createdUsers;
}

async function seedDogs(users) {
  console.log('\n🐕 Seeding dogs...');

  const createdDogs = [];

  for (const user of users.filter(u => u.role === 'CUSTOMER')) {
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
          },
        });
        userDogs.push(dog);
        console.log(`  ✅ Created dog: ${dog.name} for ${user.name}`);
      } catch (error) {
        console.error(`  ❌ Failed to create dog for ${user.name}:`, error.message);
      }
    }

    createdDogs.push(...userDogs);
  }

  return createdDogs;
}

async function seedServiceVisits(users) {
  console.log('\n📅 Seeding service visits...');

  const customerUsers = users.filter(u => u.role === 'CUSTOMER');
  const createdVisits = [];

  for (const user of customerUsers) {
    const userDogs = await prisma.dog.findMany({
      where: { userId: user.id },
    });

    const visits = generateServiceVisits(user.id, userDogs.length);

    for (const visitData of visits) {
      try {
        const visit = await prisma.serviceVisit.create({
          data: visitData,
        });
        createdVisits.push(visit);
        console.log(`  ✅ Created service visit for ${user.name} on ${visit.scheduledDate.toDateString()}`);
      } catch (error) {
        console.error(`  ❌ Failed to create service visit for ${user.name}:`, error.message);
      }
    }
  }

  return createdVisits;
}

async function seedDataReadings(serviceVisits) {
  console.log('\n📊 Seeding data readings...');

  let totalReadings = 0;

  for (const visit of serviceVisits) {
    if (visit.status === 'COMPLETED') {
      const readings = generateDataReadings(visit.id, visit.dogsServiced);

      for (const readingData of readings) {
        try {
          await prisma.dataReading.create({
            data: readingData,
          });
          totalReadings++;
        } catch (error) {
          console.error(`  ❌ Failed to create data reading for visit ${visit.id}:`, error.message);
        }
      }
    }
  }

  console.log(`  ✅ Created ${totalReadings} data readings`);
  return totalReadings;
}

async function seedCommissions(users, serviceVisits) {
  console.log('\n💰 Seeding commissions...');

  const salesRep = users.find(u => u.role === 'SALES_REP');
  if (!salesRep) {
    console.log('  ⚠️  No sales rep found, skipping commission seeding');
    return 0;
  }

  let commissionCount = 0;

  for (const visit of serviceVisits) {
    if (visit.status === 'COMPLETED' && Math.random() > 0.3) { // 70% of completed visits get commissions
      try {
        const customer = users.find(u => u.id === visit.userId);
        if (customer) {
          await prisma.commission.create({
            data: {
              salesRepId: salesRep.id,
              customerId: customer.id,
              serviceVisitId: visit.id,
              amount: Math.floor(Math.random() * 50) + 10, // $10-$60 commission
              status: Math.random() > 0.2 ? 'PAID' : 'PENDING', // 80% paid
              paidAt: Math.random() > 0.2 ? new Date() : null,
            },
          });
          commissionCount++;
        }
      } catch (error) {
        console.error(`  ❌ Failed to create commission for visit ${visit.id}:`, error.message);
      }
    }
  }

  console.log(`  ✅ Created ${commissionCount} commissions`);
  return commissionCount;
}

async function seedGlobalStats() {
  console.log('\n🌍 Seeding global statistics...');

  try {
    const stats = await prisma.globalStats.upsert({
      where: { id: 'global' },
      update: {
        totalWasteDiverted: 1250.5, // lbs
        totalMethaneAvoided: 890.2, // ft³
        totalUsers: DEMO_USERS.filter(u => u.role === 'CUSTOMER').length,
        totalDogs: DEMO_DOGS.length,
        totalServiceVisits: 0, // Will be updated after service visits are counted
      },
      create: {
        id: 'global',
        totalWasteDiverted: 1250.5,
        totalMethaneAvoided: 890.2,
        totalUsers: DEMO_USERS.filter(u => u.role === 'CUSTOMER').length,
        totalDogs: DEMO_DOGS.length,
        totalServiceVisits: 0,
      },
    });

    console.log(`  ✅ Global stats updated: ${stats.totalUsers} users, ${stats.totalDogs} dogs`);
    return stats;
  } catch (error) {
    console.error('  ❌ Failed to seed global stats:', error.message);
    return null;
  }
}

async function updateGlobalStats() {
  console.log('\n📈 Updating global statistics...');

  try {
    const userCount = await prisma.user.count({ where: { role: 'CUSTOMER' } });
    const dogCount = await prisma.dog.count();
    const serviceVisitCount = await prisma.serviceVisit.count();

    await prisma.globalStats.update({
      where: { id: 'global' },
      data: {
        totalUsers: userCount,
        totalDogs: dogCount,
        totalServiceVisits: serviceVisitCount,
        updatedAt: new Date(),
      },
    });

    console.log(`  ✅ Updated global stats: ${userCount} users, ${dogCount} dogs, ${serviceVisitCount} visits`);
  } catch (error) {
    console.error('  ❌ Failed to update global stats:', error.message);
  }
}

async function seedOutboundDemo(users) {
  console.log('\n🗺️  Seeding outbound demo data...');

  try {
    const org = await prisma.org.findFirst();
    const salesRepUser = users.find((u) => u.role === 'SALES_REP');

    if (!org || !salesRepUser) {
      console.warn('  ⚠️  Skipping outbound demo seed (missing org or sales rep)');
      return;
    }

    const slug = `outbound-${Date.now()}`;

    const territory = await prisma.territory.create({
      data: {
        orgId: org.id,
        name: 'South Uptown',
        slug,
        type: 'AREA',
        color: '#0ea5e9',
        geometry: {
          type: 'Polygon',
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
            role: 'OWNER',
            isPrimary: true,
          },
        },
      },
    });

    const lead = await prisma.lead.create({
      data: {
        orgId: org.id,
        leadType: 'outbound',
        pipelineStage: 'cold',
        firstName: 'Jordan',
        lastName: 'Neighbor',
        email: `outbound-${Date.now()}@yardura.test`,
        phone: '555-0100',
        address: '5630 Colfax Ave S',
        city: 'Minneapolis',
        state: 'MN',
        zipCode: '55419',
        ownerId: salesRepUser.id,
        createdById: salesRepUser.id,
        territoryId: territory.id,
        source: 'outbound',
        pricingBreakdown: {
          metadata: {
            preferredStartDate: new Date().toISOString(),
            howDidYouHear: 'Door knock',
          },
        },
        activities: {
          create: {
            orgId: org.id,
            userId: salesRepUser.id,
            type: 'DOOR_KNOCK',
            notes: 'Friendly dog, wants info',
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
        name: 'Uptown Sweep',
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

    console.log('  ✅ Outbound demo data added');
  } catch (error) {
    console.error('  ❌ Failed to seed outbound demo data:', error.message);
  }
}

// =============================================================================
// MAIN SEEDING FUNCTION
// =============================================================================

async function main() {
  try {
    // Clear existing data in development (not in production)
    if (!isProduction) {
      console.log('🧹 Clearing existing demo data...');
      await prisma.commission.deleteMany();
      await prisma.dataReading.deleteMany();
      await prisma.serviceVisit.deleteMany();
      await prisma.dog.deleteMany();
      await prisma.user.deleteMany({ where: { email: { in: DEMO_USERS.map(u => u.email) } } });
      console.log('  ✅ Cleared existing demo data');
    }

    // Seed data in order
    const users = await seedUsers();
    const dogs = await seedDogs(users);
    await seedGlobalStats();
    const serviceVisits = await seedServiceVisits(users);
    const dataReadingsCount = await seedDataReadings(serviceVisits);
    const commissionsCount = await seedCommissions(users, serviceVisits);

    await seedOutboundDemo(users);

    // Update global statistics with final counts
    await updateGlobalStats();

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('🎉 DATABASE SEEDING COMPLETED');
    console.log('='.repeat(50));
    console.log(`Environment: ${environment}`);
    console.log(`Users: ${users.length}`);
    console.log(`Dogs: ${dogs.length}`);
    console.log(`Service Visits: ${serviceVisits.length}`);
    console.log(`Data Readings: ${dataReadingsCount}`);
    console.log(`Commissions: ${commissionsCount}`);
    console.log('='.repeat(50));

    if (!isProduction) {
      console.log('\n🔐 Demo Credentials:');
      console.log('   Customer: demo@yardura.com');
      console.log('   Sales Rep: sales@yardura.com');
      console.log('   (Use any password for testing)');
    }

  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Handle command line arguments
if (require.main === module) {
  const validEnvironments = ['development', 'staging', 'production'];
  if (process.argv[2] && !validEnvironments.includes(process.argv[2])) {
    console.error(`Invalid environment. Must be one of: ${validEnvironments.join(', ')}`);
    process.exit(1);
  }

  main();
}

module.exports = { main, seedUsers, seedDogs, seedServiceVisits };

