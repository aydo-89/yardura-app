#!/usr/bin/env node

/**
 * Yardura Database Migration Script
 *
 * Orchestrates the complete SQLite → Postgres migration process
 *
 * Usage:
 *   npm run migrate         # Full migration (export + import + validate)
 *   npm run migrate:export  # Export only
 *   npm run migrate:import  # Import only
 *   npm run migrate:validate # Validate only
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const EXPORT_SCRIPT = path.join(__dirname, 'export-sqlite.js');
const IMPORT_SCRIPT = path.join(__dirname, 'import-postgres.js');
const INIT_SQL = path.join(__dirname, '..', 'pg', 'init.sql');

function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : level === 'success' ? '✅' : 'ℹ️';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    log(`Running: ${command} ${args.join(' ')}`);

    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options,
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', reject);
  });
}

async function checkPrerequisites() {
  log('Checking prerequisites...');

  // Check Node.js version
  const nodeVersion = process.version;
  log(`Node.js version: ${nodeVersion}`);

  // Check if SQLite database exists
  const sqliteDbPath = process.env.DATABASE_URL?.replace('file:', '') || './prisma/dev.db';
  if (!fs.existsSync(sqliteDbPath)) {
    throw new Error(`SQLite database not found at ${sqliteDbPath}`);
  }
  log(`SQLite database found: ${sqliteDbPath}`);

  // Check Postgres connection
  if (!process.env.POSTGRES_DATABASE_URL) {
    throw new Error('POSTGRES_DATABASE_URL environment variable is required');
  }
  log('Postgres database URL configured');

  // Check if data directory exists
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    log(`Created data directory: ${dataDir}`);
  }
}

async function exportData() {
  log('Starting data export from SQLite...');
  await runCommand('node', [EXPORT_SCRIPT]);
  log('Data export completed successfully', 'success');
}

async function initializePostgres() {
  log('Initializing Postgres database...');

  if (!fs.existsSync(INIT_SQL)) {
    throw new Error(`Postgres init script not found: ${INIT_SQL}`);
  }

  // Initialize schema
  const { Client } = require('pg');
  const client = new Client({
    connectionString: process.env.POSTGRES_DATABASE_URL,
  });

  try {
    await client.connect();
    const sql = fs.readFileSync(INIT_SQL, 'utf8');
    await client.query(sql);
    log('Postgres schema initialized successfully', 'success');
  } finally {
    await client.end();
  }
}

async function importData() {
  log('Starting data import to Postgres...');
  await runCommand('node', [IMPORT_SCRIPT]);
  log('Data import completed successfully', 'success');
}

async function validateMigration() {
  log('Validating migration...');

  const { PrismaClient } = require('@prisma/client');

  // Connect to both databases
  const sqlitePrisma = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
  });

  const postgresPrisma = new PrismaClient({
    datasourceUrl: process.env.POSTGRES_DATABASE_URL,
  });

  try {
    // Compare record counts
    const tables = [
      'User', 'Account', 'Session', 'Dog', 'ServiceVisit',
      'DataReading', 'Commission', 'Org', 'Customer', 'Job'
    ];

    log('Comparing record counts between databases:');
    console.log('Table\t\tSQLite\tPostgres\tMatch');
    console.log('-----\t\t------\t--------\t-----');

    let allMatch = true;

    for (const table of tables) {
      const sqliteCount = await sqlitePrisma[table.toLowerCase()].count();
      const postgresCount = await postgresPrisma[table.toLowerCase()].count();
      const match = sqliteCount === postgresCount;

      if (!match) allMatch = false;

      console.log(`${table}\t\t${sqliteCount}\t${postgresCount}\t\t${match ? '✅' : '❌'}`);
    }

    if (allMatch) {
      log('Migration validation passed!', 'success');
    } else {
      log('Migration validation failed - record counts do not match', 'error');
      throw new Error('Migration validation failed');
    }

  } finally {
    await sqlitePrisma.$disconnect();
    await postgresPrisma.$disconnect();
  }
}

async function createBackup() {
  log('Creating backup of current SQLite database...');

  const sqliteDbPath = process.env.DATABASE_URL?.replace('file:', '') || './prisma/dev.db';
  const backupPath = `${sqliteDbPath}.backup-${Date.now()}`;

  fs.copyFileSync(sqliteDbPath, backupPath);
  log(`Backup created: ${backupPath}`, 'success');

  return backupPath;
}

async function runFullMigration() {
  try {
    log('🚀 Starting full database migration (SQLite → Postgres)');

    // Step 1: Prerequisites check
    await checkPrerequisites();

    // Step 2: Create backup
    const backupPath = await createBackup();

    // Step 3: Export data from SQLite
    await exportData();

    // Step 4: Initialize Postgres schema
    await initializePostgres();

    // Step 5: Import data to Postgres
    await importData();

    // Step 6: Validate migration
    await validateMigration();

    log('🎉 Migration completed successfully!', 'success');
    log(`Backup location: ${backupPath}`);
    log('You can now set USE_POSTGRES=true to switch to Postgres');

  } catch (error) {
    log(`Migration failed: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  }
}

async function runExportOnly() {
  try {
    await checkPrerequisites();
    await exportData();
  } catch (error) {
    log(`Export failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

async function runImportOnly() {
  try {
    await checkPrerequisites();
    await initializePostgres();
    await importData();
  } catch (error) {
    log(`Import failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

async function runValidateOnly() {
  try {
    await validateMigration();
  } catch (error) {
    log(`Validation failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Main execution logic
const command = process.argv[2] || 'full';

switch (command) {
  case 'full':
    runFullMigration();
    break;
  case 'export':
    runExportOnly();
    break;
  case 'import':
    runImportOnly();
    break;
  case 'validate':
    runValidateOnly();
    break;
  default:
    console.log('Usage:');
    console.log('  npm run migrate        # Full migration');
    console.log('  npm run migrate:export # Export only');
    console.log('  npm run migrate:import # Import only');
    console.log('  npm run migrate:validate # Validate only');
    process.exit(1);
}


