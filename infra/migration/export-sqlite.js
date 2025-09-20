/**
 * SQLite Data Export Script
 *
 * Exports data from SQLite database to JSON files for migration to Postgres
 * Usage: node infra/migration/export-sqlite.js
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const TABLES_TO_EXPORT = [
  'User',
  'Account',
  'Session',
  'VerificationToken',
  'Dog',
  'ServiceVisit',
  'DataReading',
  'GlobalStats',
  'Commission',
  'Org',
  'Customer',
  'Job',
  'Device',
  'Sample',
  'SampleScore',
  'Alert',
  'EcoStat',
  'BillingSnapshot',
  'GroundTruth',
];

async function exportTable(tableName, batchSize = 1000) {
  console.log(`Exporting ${tableName}...`);

  const outputDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputFile = path.join(outputDir, `${tableName.toLowerCase()}.json`);
  const writeStream = fs.createWriteStream(outputFile);
  writeStream.write('[\n');

  let offset = 0;
  let firstBatch = true;

  while (true) {
    const records = await prisma[tableName.toLowerCase()].findMany({
      skip: offset,
      take: batchSize,
      orderBy: { id: 'asc' },
    });

    if (records.length === 0) break;

    for (const record of records) {
      if (!firstBatch || offset > 0) {
        writeStream.write(',\n');
      }
      writeStream.write(JSON.stringify(record, null, 2));
      firstBatch = false;
    }

    offset += batchSize;
    console.log(`  Exported ${offset} records from ${tableName}...`);
  }

  writeStream.write('\n]');
  writeStream.end();

  console.log(`✅ Exported ${tableName} to ${outputFile}`);
  return offset;
}

async function exportAllTables() {
  console.log('🚀 Starting SQLite data export...\n');

  const results = {};

  for (const tableName of TABLES_TO_EXPORT) {
    try {
      const count = await exportTable(tableName);
      results[tableName] = count;
    } catch (error) {
      console.error(`❌ Failed to export ${tableName}:`, error.message);
      results[tableName] = 0;
    }
  }

  // Export summary
  const summaryFile = path.join(__dirname, '..', 'data', 'export-summary.json');
  fs.writeFileSync(summaryFile, JSON.stringify({
    exportDate: new Date().toISOString(),
    results,
    totalTables: TABLES_TO_EXPORT.length,
    successfulExports: Object.values(results).filter(count => count > 0).length,
  }, null, 2));

  console.log('\n📊 Export Summary:');
  console.log('================');
  Object.entries(results).forEach(([table, count]) => {
    console.log(`${table}: ${count} records`);
  });

  console.log(`\n✅ Export complete! Summary saved to ${summaryFile}`);
}

async function main() {
  try {
    await exportAllTables();
  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { exportAllTables, exportTable };


