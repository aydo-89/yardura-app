const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDbSchema() {
  try {
    console.log('🔍 Checking database schema...\n');

    // Check if key tables exist by trying to query them
    const tablesToCheck = [
      'User',
      'Account',
      'BusinessConfig',
      'Org'
    ];

    for (const table of tablesToCheck) {
      try {
        let result;
        switch (table) {
          case 'User':
            result = await prisma.user.count();
            break;
          case 'Account':
            result = await prisma.account.count();
            break;
          case 'BusinessConfig':
            result = await prisma.businessConfig.count();
            break;
          case 'Org':
            result = await prisma.org.count();
            break;
        }
        console.log(`✅ ${table}: ${result} records`);
      } catch (error) {
        console.log(`❌ ${table}: Table doesn't exist or error - ${error.message}`);
      }
    }

    // Check specific columns in Account table
    console.log('\n🔍 Checking Account table columns...');
    try {
      const accounts = await prisma.account.findMany({ take: 1 });
      if (accounts.length > 0) {
        const account = accounts[0];
        console.log('Account columns:', Object.keys(account));
        console.log('Has reset_token:', 'reset_token' in account);
        console.log('Has reset_token_expires:', 'reset_token_expires' in account);
      } else {
        console.log('No accounts found to check columns');
      }
    } catch (error) {
      console.log('❌ Error checking Account columns:', error.message);
    }

    // Check if ayden@yardura.com user exists
    console.log('\n🔍 Checking admin user...');
    try {
      const user = await prisma.user.findUnique({
        where: { email: 'ayden@yardura.com' },
        include: { accounts: true }
      });

      if (user) {
        console.log('✅ Admin user exists:', user.email, user.role);
        console.log('Accounts:', user.accounts.length);
        if (user.accounts.length > 0) {
          console.log('Has credentials account:', user.accounts.some(acc => acc.provider === 'credentials'));
        }
      } else {
        console.log('❌ Admin user not found');
      }
    } catch (error) {
      console.log('❌ Error checking admin user:', error.message);
    }

  } catch (error) {
    console.error('❌ Database check failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDbSchema();
