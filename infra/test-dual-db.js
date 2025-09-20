/**
 * Dual Database Setup Test
 *
 * Tests that the dual database infrastructure is properly configured
 * Usage: node infra/test-dual-db.js
 */

const fs = require("fs");
const path = require("path");

// Load environment variables
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });

function testDualDatabaseSetup() {
  console.log("🧪 Testing Dual Database Setup...\n");

  const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
  };

  function test(name, condition, message = "") {
    if (condition) {
      console.log(`✅ ${name}`);
      results.passed++;
    } else {
      console.log(`❌ ${name}${message ? ` - ${message}` : ""}`);
      results.failed++;
    }
  }

  function warn(name, condition, message = "") {
    if (condition) {
      console.log(`⚠️  ${name}${message ? ` - ${message}` : ""}`);
      results.warnings++;
    } else {
      console.log(`✅ ${name}`);
      results.passed++;
    }
  }

  try {
    // Test 1: Check if required files exist
    console.log("1. Checking file structure...");
    const requiredFiles = [
      "src/lib/database-access.ts",
      "src/lib/prisma.ts",
      "prisma/schema.prisma",
      "infra/pg/init.sql",
      "infra/migration/export-sqlite.js",
      "infra/migration/import-postgres.js",
      "infra/migration/migrate.js",
    ];

    requiredFiles.forEach((file) => {
      const exists = fs.existsSync(path.join(__dirname, "..", file));
      test(`${file} exists`, exists);
    });

    // Test 2: Check environment variables
    console.log("\n2. Checking environment configuration...");
    const envVars = {
      DATABASE_URL: process.env.DATABASE_URL,
      POSTGRES_DATABASE_URL: process.env.POSTGRES_DATABASE_URL,
      SHADOW_DATABASE_URL: process.env.SHADOW_DATABASE_URL,
    };

    Object.entries(envVars).forEach(([key, value]) => {
      if (key === "POSTGRES_DATABASE_URL" || key === "SHADOW_DATABASE_URL") {
        warn(
          `${key} configured`,
          !value,
          "Optional - set for Postgres migration",
        );
      } else {
        test(`${key} configured`, !!value);
      }
    });

    // Test 3: Check Prisma schema
    console.log("\n3. Checking Prisma schema...");
    const schemaPath = path.join(__dirname, "..", "prisma", "schema.prisma");
    const schemaContent = fs.readFileSync(schemaPath, "utf8");

    test(
      "SQLite datasource configured",
      schemaContent.includes("datasource db"),
    );
    test(
      "Postgres datasource configured",
      schemaContent.includes("datasource pg"),
    );
    test(
      "Postgres URL configured",
      schemaContent.includes("POSTGRES_DATABASE_URL"),
    );

    // Test 4: Check package.json scripts
    console.log("\n4. Checking package.json scripts...");
    const packagePath = path.join(__dirname, "..", "package.json");
    const packageContent = fs.readFileSync(packagePath, "utf8");
    const packageJson = JSON.parse(packageContent);

    const migrationScripts = [
      "migrate",
      "migrate:export",
      "migrate:import",
      "migrate:validate",
      "test:dual-db",
    ];

    migrationScripts.forEach((script) => {
      test(`npm run ${script} configured`, !!packageJson.scripts[script]);
    });

    // Test 5: Check data directory
    console.log("\n5. Checking data directory...");
    const dataDir = path.join(__dirname, "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log("   📁 Created data directory");
    }
    test("Data directory exists", fs.existsSync(dataDir));

    // Test 6: Check feature flags
    console.log("\n6. Checking feature flags...");
    const featureFlags = [
      "USE_POSTGRES",
      "READ_POSTGRES",
      "WRITE_POSTGRES",
      "MIGRATION_MODE",
    ];

    featureFlags.forEach((flag) => {
      const value = process.env[flag];
      warn(
        `${flag} configured`,
        value === undefined,
        "Optional - defaults to false",
      );
    });

    // Summary
    console.log("\n📊 Test Summary:");
    console.log(`   ✅ ${results.passed} tests passed`);
    console.log(`   ❌ ${results.failed} tests failed`);
    console.log(`   ⚠️  ${results.warnings} warnings`);

    if (results.failed === 0) {
      console.log("\n🎉 Dual database setup is ready!");
      console.log("\n📋 Next Steps:");
      console.log("   1. Set up Postgres database (if not already done)");
      console.log("   2. Configure POSTGRES_DATABASE_URL in .env");
      console.log("   3. Run: npm run migrate:export (to test export)");
      console.log("   4. Run: npm run migrate (for full migration)");
    } else {
      console.log("\n❌ Setup issues found - please fix before proceeding");
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testDualDatabaseSetup();
}

module.exports = { testDualDatabaseSetup };
