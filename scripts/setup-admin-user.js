const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function setupAdminUser() {
  try {
    const email = 'ayden@yardura.com';
    const password = 'G00g00gaj00b^^'; // Use the same password the user tried
    const name = 'Ayden';

    console.log('Setting up admin user:', email);

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Check if user already exists
    let user = await prisma.user.findUnique({
      where: { email },
      include: { accounts: true },
    });

    if (user) {
      console.log('User already exists, updating...');

      // Update user role to admin
      await prisma.user.update({
        where: { email },
        data: {
          role: 'ADMIN',
          orgId: 'yardura',
          name: name,
        },
      });

      // Check if credentials account exists
      const credentialsAccount = user.accounts.find(
        (account) => account.provider === 'credentials'
      );

      if (credentialsAccount) {
        // Update the password
        await prisma.account.update({
          where: { id: credentialsAccount.id },
          data: {
            access_token: hashedPassword,
          },
        });
        console.log('Updated existing credentials account');
      } else {
        // Create credentials account
        await prisma.account.create({
          data: {
            userId: user.id,
            type: 'credentials',
            provider: 'credentials',
            providerAccountId: email,
            access_token: hashedPassword,
          },
        });
        console.log('Created new credentials account');
      }
    } else {
      console.log('Creating new admin user...');

      // Create the organization if it doesn't exist
      let org = await prisma.org.findUnique({
        where: { id: 'yardura' },
      });

      if (!org) {
        org = await prisma.org.create({
          data: {
            id: 'yardura',
            name: 'Yardura Service OS',
            slug: 'yardura',
          },
        });
        console.log('Created yardura organization');
      }

      // Create the user with admin role and credentials account
      user = await prisma.user.create({
        data: {
          name: name,
          email,
          role: 'ADMIN',
          orgId: 'yardura',
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

      console.log('Created new admin user with credentials');
    }

    console.log('Admin user setup complete!');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('Role: ADMIN');
    console.log('Org: yardura');

  } catch (error) {
    console.error('Error setting up admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupAdminUser();
