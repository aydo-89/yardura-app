#!/usr/bin/env node

/**
 * User Management Script for God Mode Admin Panel
 * Run with: node scripts/user-management.js [command] [email]
 *
 * Commands:
 *   list - List all users
 *   delete [email] - Delete user by email
 *   promote [email] - Promote user to admin
 *   demote [email] - Demote admin to customer
 *   reset-password [email] - Reset user password
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function listUsers() {
  console.log('👥 Listing all users...\n');

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      orgId: true,
      createdAt: true,
        _count: {
          select: {
            assignedLeads: true,
            serviceVisits: true,
            accounts: true,
            dogs: true,
          },
        },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (users.length === 0) {
    console.log('No users found.');
    return;
  }

  users.forEach((user, index) => {
    console.log(`${index + 1}. ${user.email}`);
    console.log(`   Name: ${user.name || 'Not set'}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Org: ${user.orgId || 'Not set'}`);
    console.log(`   Assigned Leads: ${user._count.assignedLeads}`);
    console.log(`   Service Visits: ${user._count.serviceVisits}`);
    console.log(`   Dogs: ${user._count.dogs}`);
    console.log(`   Accounts: ${user._count.accounts}`);
    console.log(`   Created: ${user.createdAt.toLocaleDateString()}`);
    console.log('');
  });
}

async function deleteUser(email) {
  console.log(`🗑️  Deleting user: ${email}`);

  try {
    // Find the user first
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        _count: {
          select: {
            leads: true,
            serviceVisits: true,
            accounts: true,
          },
        },
      },
    });

    if (!user) {
      console.log('❌ User not found.');
      return;
    }

    console.log(`Found user: ${user.name} (${user.role})`);
    console.log(`Associated data: ${user._count.leads} leads, ${user._count.serviceVisits} visits, ${user._count.accounts} accounts`);

    // Ask for confirmation (in a real script, you'd want user input)
    console.log('⚠️  WARNING: This will permanently delete the user and all associated data!');
    console.log('This action cannot be undone.');

    // Actually delete the user (cascade delete will handle related records)
    await prisma.user.delete({
      where: { email },
    });

    console.log('✅ User deleted successfully!');

  } catch (error) {
    console.error('❌ Error deleting user:', error.message);
  }
}

async function promoteUser(email) {
  console.log(`⬆️  Promoting user to admin: ${email}`);

  try {
    const user = await prisma.user.update({
      where: { email },
      data: {
        role: 'ADMIN',
        orgId: 'yardura',
      },
    });

    console.log(`✅ User promoted to admin: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Org: ${user.orgId}`);

  } catch (error) {
    console.error('❌ Error promoting user:', error.message);
  }
}

async function demoteUser(email) {
  console.log(`⬇️  Demoting admin to customer: ${email}`);

  try {
    const user = await prisma.user.update({
      where: { email },
      data: { role: 'CUSTOMER' },
    });

    console.log(`✅ Admin demoted to customer: ${user.email}`);

  } catch (error) {
    console.error('❌ Error demoting user:', error.message);
  }
}

async function resetPassword(email) {
  console.log(`🔑 Resetting password for: ${email}`);

  try {
    // Generate a new secure password
    const newPassword = Math.random().toString(36).slice(-16) + 'A1!';
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update the user's account
    await prisma.account.updateMany({
      where: {
        user: { email },
        provider: 'credentials',
      },
      data: {
        access_token: hashedPassword,
      },
    });

    console.log(`✅ Password reset successfully!`);
    console.log(`🔒 New temporary password: ${newPassword}`);
    console.log('⚠️  IMPORTANT: Save this password and share securely with the user!');

  } catch (error) {
    console.error('❌ Error resetting password:', error.message);
  }
}

// Main script logic
async function main() {
  const [,, command, email] = process.argv;

  try {
    switch (command) {
      case 'list':
        await listUsers();
        break;

      case 'delete':
        if (!email) {
          console.error('❌ Email required for delete command');
          console.log('Usage: node scripts/user-management.js delete user@example.com');
          process.exit(1);
        }
        await deleteUser(email);
        break;

      case 'promote':
        if (!email) {
          console.error('❌ Email required for promote command');
          console.log('Usage: node scripts/user-management.js promote user@example.com');
          process.exit(1);
        }
        await promoteUser(email);
        break;

      case 'demote':
        if (!email) {
          console.error('❌ Email required for demote command');
          console.log('Usage: node scripts/user-management.js demote user@example.com');
          process.exit(1);
        }
        await demoteUser(email);
        break;

      case 'reset-password':
        if (!email) {
          console.error('❌ Email required for reset-password command');
          console.log('Usage: node scripts/user-management.js reset-password user@example.com');
          process.exit(1);
        }
        await resetPassword(email);
        break;

      default:
        console.log('🏛️  Yardura God Mode - User Management');
        console.log('');
        console.log('Usage: node scripts/user-management.js [command] [email]');
        console.log('');
        console.log('Commands:');
        console.log('  list                           - List all users');
        console.log('  delete [email]                 - Delete user by email');
        console.log('  promote [email]                - Promote user to admin');
        console.log('  demote [email]                 - Demote admin to customer');
        console.log('  reset-password [email]         - Reset user password');
        console.log('');
        console.log('Examples:');
        console.log('  node scripts/user-management.js list');
        console.log('  node scripts/user-management.js delete user@example.com');
        console.log('  node scripts/user-management.js promote admin@example.com');
        break;
    }

  } catch (error) {
    console.error('💥 Script failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { listUsers, deleteUser, promoteUser, demoteUser, resetPassword };
