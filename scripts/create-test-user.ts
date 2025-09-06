import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    const email = 'test@example.com';
    const password = 'password123';

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.log('✅ Test user already exists');
      console.log('📧 Email: test@example.com');
      console.log('🔒 Password: password123');
      console.log('🌐 Dashboard: http://localhost:3001/dashboard');
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create the user account
    const user = await prisma.user.create({
      data: {
        name: 'Test User',
        email,
        role: 'CUSTOMER',
        // Create a direct password account
        accounts: {
          create: {
            type: 'credentials',
            provider: 'credentials',
            providerAccountId: email,
            access_token: hashedPassword,
          },
        },
      },
    });

    console.log('✅ Test user created successfully!');
    console.log('👤 User ID:', user.id);
    console.log('📧 Email: test@example.com');
    console.log('🔒 Password: password123');
    console.log('🌐 Sign in: http://localhost:3001/signin');
    console.log('📊 Dashboard: http://localhost:3001/dashboard');
  } catch (error) {
    console.error('❌ Error creating test user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();
