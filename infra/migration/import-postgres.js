/**
 * Postgres Data Import Script
 *
 * Imports data from JSON files into Postgres database
 * Usage: node infra/migration/import-postgres.js
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Use the Postgres datasource
const prisma = new PrismaClient({
  datasourceUrl: process.env.POSTGRES_DATABASE_URL,
});

const TABLES_TO_IMPORT = [
  'User',
  'Account',
  'Session',
  'VerificationToken',
  'Org',
  'Customer',
  'Dog',
  'ServiceVisit',
  'DataReading',
  'GlobalStats',
  'Commission',
  'Job',
  'Device',
  'Sample',
  'SampleScore',
  'Alert',
  'EcoStat',
  'BillingSnapshot',
  'GroundTruth',
];

// Tables that should be imported in specific order due to foreign keys
const IMPORT_ORDER = [
  'User',           // No dependencies
  'Account',        // Depends on User
  'Session',        // Depends on User
  'VerificationToken', // No dependencies
  'Org',            // No dependencies
  'Customer',       // Depends on Org
  'Dog',            // Depends on User, Org, Customer
  'ServiceVisit',   // Depends on User
  'DataReading',    // Depends on User, Dog, ServiceVisit
  'GlobalStats',    // No dependencies
  'Commission',     // Depends on User, ServiceVisit
  'Job',            // Depends on Org, Customer
  'Device',         // Depends on Org
  'Sample',         // Depends on Org, Device, Customer, Dog, Job
  'SampleScore',    // Depends on Sample
  'Alert',          // Depends on Org, Sample
  'EcoStat',        // Depends on Org
  'BillingSnapshot', // Depends on Org, Customer
  'GroundTruth',    // Depends on Sample
];

async function importTable(tableName, batchSize = 100) {
  console.log(`\n📥 Importing ${tableName}...`);

  const inputFile = path.join(__dirname, '..', 'data', `${tableName.toLowerCase()}.json`);

  if (!fs.existsSync(inputFile)) {
    console.log(`⚠️  Skipping ${tableName} - file not found: ${inputFile}`);
    return 0;
  }

  const fileContent = fs.readFileSync(inputFile, 'utf8');
  const records = JSON.parse(fileContent);

  if (records.length === 0) {
    console.log(`ℹ️  ${tableName} has no records to import`);
    return 0;
  }

  console.log(`  Found ${records.length} records to import`);

  let imported = 0;
  const errors = [];

  // Import in batches
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    try {
      // Transform records for Postgres compatibility
      const transformedBatch = batch.map(record => ({
        ...record,
        // Handle CUID to UUID conversion if needed
        id: record.id,
        // Ensure proper data types
        createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
        updatedAt: record.updatedAt ? new Date(record.updatedAt) : new Date(),
        // Handle optional date fields
        ...(record.emailVerified && { emailVerified: new Date(record.emailVerified) }),
        ...(record.scheduledDate && { scheduledDate: new Date(record.scheduledDate) }),
        ...(record.completedDate && { completedDate: new Date(record.completedDate) }),
        ...(record.expires && { expires: new Date(record.expires) }),
        ...(record.timestamp && { timestamp: new Date(record.timestamp) }),
        ...(record.paidAt && { paidAt: new Date(record.paidAt) }),
        ...(record.nextVisitAt && { nextVisitAt: new Date(record.nextVisitAt) }),
        ...(record.lastSeenAt && { lastSeenAt: new Date(record.lastSeenAt) }),
        ...(record.capturedAt && { capturedAt: new Date(record.capturedAt) }),
        ...(record.scoredAt && { scoredAt: new Date(record.scoredAt) }),
      }));

      // Use createMany for bulk insert (if supported) or individual creates
      if (prisma[tableName.toLowerCase()].createMany) {
        await prisma[tableName.toLowerCase()].createMany({
          data: transformedBatch,
          skipDuplicates: true, // Skip if record already exists
        });
      } else {
        // Fallback for tables without createMany support
        for (const record of transformedBatch) {
          try {
            await prisma[tableName.toLowerCase()].upsert({
              where: { id: record.id },
              update: record,
              create: record,
            });
          } catch (err) {
            errors.push({ table: tableName, record: record.id, error: err.message });
          }
        }
      }

      imported += transformedBatch.length;
      console.log(`  ✅ Imported batch ${Math.floor(i / batchSize) + 1}: ${transformedBatch.length} records`);

    } catch (error) {
      console.error(`  ❌ Failed to import batch ${Math.floor(i / batchSize) + 1}:`, error.message);
      errors.push({ table: tableName, batch: Math.floor(i / batchSize) + 1, error: error.message });
    }
  }

  if (errors.length > 0) {
    console.log(`  ⚠️  ${errors.length} errors occurred during import`);
  }

  console.log(`✅ Imported ${imported} records into ${tableName}`);
  return { imported, errors: errors.length };
}

async function validateImport() {
  console.log('\n🔍 Validating import...');

  const validationResults = {};

  for (const tableName of IMPORT_ORDER) {
    try {
      const count = await prisma[tableName.toLowerCase()].count();
      validationResults[tableName] = count;
      console.log(`  ${tableName}: ${count} records`);
    } catch (error) {
      console.error(`  ❌ Failed to validate ${tableName}:`, error.message);
      validationResults[tableName] = -1;
    }
  }

  return validationResults;
}

async function importAllTables() {
  console.log('🚀 Starting Postgres data import...\n');

  if (!process.env.POSTGRES_DATABASE_URL) {
    console.error('❌ POSTGRES_DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const results = {};
  const errors = [];

  // Import tables in dependency order
  for (const tableName of IMPORT_ORDER) {
    try {
      const result = await importTable(tableName);
      results[tableName] = result;
    } catch (error) {
      console.error(`❌ Failed to import ${tableName}:`, error.message);
      results[tableName] = { imported: 0, errors: 1 };
      errors.push({ table: tableName, error: error.message });
    }
  }

  // Validate the import
  const validationResults = await validateImport();

  // Save import summary
  const summaryFile = path.join(__dirname, '..', 'data', 'import-summary.json');
  const summary = {
    importDate: new Date().toISOString(),
    postgresUrl: process.env.POSTGRES_DATABASE_URL.replace(/:\/\/.*@/, '://***:***@'), // Mask credentials
    results,
    validationResults,
    totalTables: IMPORT_ORDER.length,
    successfulImports: Object.values(results).filter(r => r.imported > 0).length,
    totalErrors: Object.values(results).reduce((sum, r) => sum + r.errors, 0),
  };

  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));

  console.log('\n📊 Import Summary:');
  console.log('================');
  Object.entries(results).forEach(([table, result]) => {
    console.log(`${table}: ${result.imported} imported, ${result.errors} errors`);
  });

  console.log(`\n✅ Import complete! Summary saved to ${summaryFile}`);

  if (errors.length > 0) {
    console.log('\n❌ Errors encountered:');
    errors.forEach(err => console.log(`  - ${err.table}: ${err.error}`));
  }
}

async function main() {
  try {
    await importAllTables();
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { importAllTables, importTable, validateImport };


