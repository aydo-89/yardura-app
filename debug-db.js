const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugDb() {
  try {
    console.log('Testing database connection...');

    // Test basic connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Check if User table exists and has data
    const userCount = await prisma.user.count();
    console.log(`✅ Found ${userCount} users in database`);

    // Check if Account table exists and has data
    const accountCount = await prisma.account.count();
    console.log(`✅ Found ${accountCount} accounts in database`);

    // Check if our test user exists
    const testUser = await prisma.user.findUnique({
      where: { email: 'test@example.com' },
      include: { accounts: true }
    });

    if (testUser) {
      console.log('✅ Test user found:', {
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        accountsCount: testUser.accounts.length
      });

      // Check if test user has credentials account
      const credentialsAccount = testUser.accounts.find(acc => acc.provider === 'credentials');
      if (credentialsAccount) {
        console.log('✅ Test user has credentials account:', {
          id: credentialsAccount.id,
          hasPassword: !!credentialsAccount.access_token,
          resetToken: !!credentialsAccount.reset_token
        });
      } else {
        console.log('❌ Test user does not have credentials account');
      }
    } else {
      console.log('❌ Test user not found');
    }

    console.log('\n🎉 Database debug complete!');

  } catch (error) {
    console.error('❌ Database error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugDb();


