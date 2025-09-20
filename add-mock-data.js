const {
  PrismaClient,
  UserRole,
  ServiceStatus,
  ServiceType,
  YardSize,
} = require("@prisma/client");

const prisma = new PrismaClient();

async function addMockData() {
  try {
    console.log("Adding mock customers...");

    // Create mock customers
    const customer1 = await prisma.user.create({
      data: {
        name: "Sarah Johnson",
        email: "sarah@example.com",
        phone: "612-555-0123",
        address: "123 Oak Street",
        city: "Minneapolis",
        zipCode: "55401",
        role: UserRole.CUSTOMER,
        accounts: {
          create: {
            type: "credentials",
            provider: "credentials",
            providerAccountId: "sarah@example.com",
            access_token: "$2a$12$hashedpassword", // Mock hashed password
          },
        },
      },
    });

    const customer2 = await prisma.user.create({
      data: {
        name: "Mike Chen",
        email: "mike@example.com",
        phone: "612-555-0456",
        address: "456 Pine Avenue",
        city: "St. Paul",
        zipCode: "55102",
        role: UserRole.CUSTOMER,
        accounts: {
          create: {
            type: "credentials",
            provider: "credentials",
            providerAccountId: "mike@example.com",
            access_token: "$2a$12$hashedpassword",
          },
        },
      },
    });

    const customer3 = await prisma.user.create({
      data: {
        name: "Lisa Rodriguez",
        email: "lisa@example.com",
        phone: "612-555-0789",
        address: "789 Maple Drive",
        city: "Eden Prairie",
        zipCode: "55344",
        role: UserRole.CUSTOMER,
        accounts: {
          create: {
            type: "credentials",
            provider: "credentials",
            providerAccountId: "lisa@example.com",
            access_token: "$2a$12$hashedpassword",
          },
        },
      },
    });

    console.log("✅ Created customers:", [
      customer1.id,
      customer2.id,
      customer3.id,
    ]);

    // Add dogs to customers
    await prisma.dog.createMany({
      data: [
        {
          name: "Buddy",
          breed: "Golden Retriever",
          age: 3,
          weight: 65.5,
          userId: customer1.id,
        },
        {
          name: "Max",
          breed: "Labrador",
          age: 2,
          weight: 75.2,
          userId: customer2.id,
        },
        {
          name: "Luna",
          breed: "Mixed Breed",
          age: 1,
          weight: 45.8,
          userId: customer3.id,
        },
      ],
    });

    console.log("✅ Added dogs to customers");

    // Create service visits
    const visit1 = await prisma.serviceVisit.create({
      data: {
        userId: customer1.id,
        scheduledDate: new Date("2024-01-15T10:00:00Z"),
        completedDate: new Date("2024-01-15T10:30:00Z"),
        status: ServiceStatus.COMPLETED,
        serviceType: ServiceType.REGULAR,
        yardSize: YardSize.MEDIUM,
        dogsServiced: 1,
        notes: "Regular weekly service - yard was clean, dog waste collected",
      },
    });

    const visit2 = await prisma.serviceVisit.create({
      data: {
        userId: customer2.id,
        scheduledDate: new Date("2024-01-16T14:00:00Z"),
        status: ServiceStatus.SCHEDULED,
        serviceType: ServiceType.REGULAR,
        yardSize: YardSize.LARGE,
        dogsServiced: 1,
        notes: "Scheduled for tomorrow - customer requested afternoon pickup",
      },
    });

    const visit3 = await prisma.serviceVisit.create({
      data: {
        userId: customer3.id,
        scheduledDate: new Date("2024-01-10T09:00:00Z"),
        completedDate: new Date("2024-01-10T09:45:00Z"),
        status: ServiceStatus.COMPLETED,
        serviceType: ServiceType.ONE_TIME,
        yardSize: YardSize.SMALL,
        dogsServiced: 1,
        notes:
          "One-time spring cleanup - heavy leaf cover, multiple waste piles",
      },
    });

    console.log("✅ Created service visits:", [
      visit1.id,
      visit2.id,
      visit3.id,
    ]);

    // Add some data readings (eco impact data)
    await prisma.dataReading.createMany({
      data: [
        {
          userId: customer1.id,
          serviceVisitId: visit1.id,
          weight: 1200, // grams
          color: "brown",
          consistency: "firm",
          temperature: 72.5,
          methaneLevel: 45.2,
          deviceId: "raspberry-pi-001",
        },
        {
          userId: customer3.id,
          serviceVisitId: visit3.id,
          weight: 2800, // grams
          color: "dark brown",
          consistency: "moist",
          temperature: 68.3,
          methaneLevel: 52.1,
          deviceId: "raspberry-pi-002",
        },
      ],
    });

    console.log("✅ Added eco impact data readings");

    // Create a sales rep
    const salesRep = await prisma.user.create({
      data: {
        name: "Jane Sales",
        email: "jane@sales.yardura.com",
        phone: "612-555-9999",
        role: UserRole.SALES_REP,
        commissionRate: 0.1,
        accounts: {
          create: {
            type: "credentials",
            provider: "credentials",
            providerAccountId: "jane@sales.yardura.com",
            access_token: "$2a$12$salesreppassword",
          },
        },
      },
    });

    // Link customer1 to sales rep
    await prisma.user.update({
      where: { id: customer1.id },
      data: { salesRepId: salesRep.id },
    });

    console.log("✅ Created sales rep and linked customer");

    // Create commission record for completed service
    await prisma.commission.create({
      data: {
        salesRepId: salesRep.id,
        customerId: customer1.id,
        serviceVisitId: visit1.id,
        amount: 25.0, // 10% of $250 service
        status: "PENDING",
      },
    });

    console.log("✅ Created commission record");

    console.log("\n🎉 Mock data added successfully!");
    console.log("\n📊 Summary:");
    console.log(
      `   - 3 Customers: ${customer1.name}, ${customer2.name}, ${customer3.name}`,
    );
    console.log(`   - 3 Dogs: Buddy, Max, Luna`);
    console.log(`   - 3 Service visits: 2 completed, 1 scheduled`);
    console.log(`   - 2 Service deposits with eco data`);
    console.log(`   - 1 Sales rep: ${salesRep.name}`);
    console.log(`   - 1 Commission record: $25.00 pending`);

    console.log("\n🔑 Admin access:");
    console.log("   Visit: http://localhost:3000/admin/dashboard");
    console.log("   Use admin email from .env.local ADMIN_EMAILS");
  } catch (error) {
    console.error("Error adding mock data:", error);
  } finally {
    await prisma.$disconnect();
  }
}

addMockData();
