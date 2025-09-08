import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding sample data for dashboard demonstration...');

  // Create an organization
  const org = await prisma.org.upsert({
    where: { slug: 'test-org' },
    update: {},
    create: {
      name: 'Test Organization',
      slug: 'test-org',
    },
  });

  // Create a test user
  const user = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      name: 'John Doe',
      stripeCustomerId: 'cus_test123',
      orgId: org.id,
    },
  });

  // Create a dog
  const existingDog = await prisma.dog.findFirst({
    where: { userId: user.id }
  });

  let dog;
  if (existingDog) {
    dog = existingDog;
  } else {
    dog = await prisma.dog.create({
      data: {
        name: 'Max',
        breed: 'Golden Retriever',
        age: 3,
        weight: 70,
        userId: user.id,
        orgId: org.id,
      },
    });
  }

  // Create device
  const existingDevice = await prisma.device.findFirst({
    where: { orgId: org.id }
  });

  let device;
  if (existingDevice) {
    device = existingDevice;
  } else {
    device = await prisma.device.create({
      data: {
        name: 'Test Device',
        type: 'sensor',
        apiKeyHash: 'test-hash',
        uniqueId: 'device-001',
        orgId: org.id,
      },
    });
  }

  // Check if we already have data readings
  const existingReadings = await prisma.dataReading.findMany({
    where: { deviceId: device.id }
  });

  if (existingReadings.length === 0) {
    // Generate sample data readings for the last 30 days
    const dataReadings = [];
    const colors = ['brown', 'dark brown', 'light brown', 'yellow', 'green', 'black', 'red'];
    const consistencies = ['firm', 'soft', 'loose', 'mushy', 'watery'];

    for (let i = 0; i < 60; i++) { // 60 readings over 30 days
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(i / 2)); // 2 readings per day

      const reading = {
        deviceId: device.id,
        timestamp: date,
        weight: Math.random() * 500 + 100, // 100-600 grams
        color: colors[Math.floor(Math.random() * colors.length)],
        consistency: consistencies[Math.floor(Math.random() * consistencies.length)],
        temperature: Math.random() * 5 + 35, // 35-40°C
      };

      dataReadings.push(reading);
    }

    // Insert data readings in batches
    for (const reading of dataReadings) {
      await prisma.dataReading.create({ data: reading });
    }
    console.log(`📊 Created ${dataReadings.length} data readings`);
  } else {
    console.log(`📊 Found ${existingReadings.length} existing data readings`);
  }

  // Check if we already have service visits
  const existingVisits = await prisma.serviceVisit.findMany({
    where: { userId: user.id }
  });

  if (existingVisits.length === 0) {
    // Create service visits
    const serviceVisits = [];
    for (let i = 0; i < 8; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (i * 7)); // Weekly services

      serviceVisits.push({
        userId: user.id,
        scheduledDate: date,
        status: 'COMPLETED',
        dogsServiced: 1,
        serviceType: 'REGULAR',
        yardSize: 'MEDIUM',
        notes: `Regular yard clean for ${dog.name}`,
      });
    }

    for (const visit of serviceVisits) {
      await prisma.serviceVisit.create({ data: visit });
    }
    console.log(`🏥 Created ${serviceVisits.length} service visits`);
  } else {
    console.log(`🏥 Found ${existingVisits.length} existing service visits`);
  }

  // Create basic eco stats (simplified)
  const existingEcoStats = await prisma.ecoStat.findMany({
    where: { orgId: org.id }
  });

  if (existingEcoStats.length === 0) {
    // Create eco stats
    const ecoStats = [];
    for (let i = 0; i < 8; i++) {
      const currentMonth = new Date();
      currentMonth.setMonth(currentMonth.getMonth() - i);

      ecoStats.push({
        orgId: org.id,
        periodMonth: currentMonth.toISOString().slice(0, 7), // YYYY-MM format
        lbsDiverted: Math.random() * 50 + 25,
        methaneAvoidedCuFt: Math.random() * 10 + 5,
      });
    }

    for (const stat of ecoStats) {
      await prisma.ecoStat.create({ data: stat });
    }
    console.log(`🌱 Created ${ecoStats.length} eco stats`);
  } else {
    console.log(`🌱 Found ${existingEcoStats.length} existing eco stats`);
  }

  console.log('✅ Sample data seeding completed!');
  console.log('\n🔐 Test user available:');
  console.log('Email: test@example.com');
  console.log('(NextAuth.js authentication - no password needed)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
