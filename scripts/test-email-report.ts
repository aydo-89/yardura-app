/**
 * Test script to send a sample customer email report
 * Usage: npx tsx scripts/test-email-report.ts [email]
 * 
 * Options:
 *   --production  Use production database (DATABASE_URL from env)
 *   [email]       Customer email to send report to (default: ayden@yardura.com)
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

const useProduction = process.argv.includes("--production");
if (useProduction) {
  console.log("🌐 Using production database...");
}

import { prisma } from "../src/lib/prisma";
import { CustomerEmailReportCadence } from "@prisma/client";
import { sendCustomerEmailReport } from "../src/lib/emails/customer-report";
import {
  buildCustomerEmailReportData,
  resolveReportPeriod,
} from "../src/lib/reports/customer-email-report";
import { getSiteUrl } from "../src/lib/env";

async function main() {
  const email = process.argv[2] || "ayden@yardura.com";
  
  console.log(`🔍 Looking up customer by email: ${email}`);
  
  // Find the customer
  const customer = await prisma.customer.findFirst({
    where: {
      user: {
        email: email.toLowerCase(),
      },
    },
    include: {
      user: true,
      dogs: true,
    },
  });

  if (!customer) {
    console.error(`❌ No customer found for email: ${email}`);
    process.exit(1);
  }

  const customerLabel =
    customer.user?.name || customer.user?.email || customer.email || "Unknown";
  console.log(`✅ Found customer: ${customerLabel}`);
  console.log(`   Dogs: ${customer.dogs.map(d => d.name).join(", ") || "None"}`);
  console.log(`   Org: ${customer.orgId}`);

  // Build the report data for the last 7 days
  console.log("\n📊 Building report data...");
  
  const reportData = await buildCustomerEmailReportData({
    customerId: customer.id,
    orgId: customer.orgId,
    period: resolveReportPeriod({ cadence: CustomerEmailReportCadence.WEEKLY }),
    sections: {
      includeWellness: true,
      includeScooping: true,
      includeFood: true,
      includeWalks: true,
      includeReminders: true,
      includeChats: true,
      includePhotos: false, // Don't include stool photos
    },
  });

  if (!reportData) {
    console.error("❌ Failed to build report data");
    process.exit(1);
  }

  console.log(`✅ Report data built successfully`);
  console.log(`   Period: ${reportData.period.label}`);
  console.log(`   Wellness Score: ${reportData.stats.wellnessScore}`);
  console.log(`   Check-ins: ${reportData.checkIns?.total || 0}`);
  console.log(`   Walks: ${reportData.walks?.total || 0}`);
  console.log(`   Poop Map: ${reportData.poopMap ? `${reportData.poopMap.pointsCount} points` : "No GPS data"}`);
  console.log(`   Captures: ${reportData.stats.totalCaptures || 0}`);

  // Send the email
  console.log(`\n📧 Sending test email to: ${email}`);
  
  const siteUrl = getSiteUrl();
  const dashboardUrl = `${siteUrl}/customer/dashboard`;
  const manageUrl = `${siteUrl}/customer/account`;

  const messageId = await sendCustomerEmailReport({
    report: reportData,
    recipients: [email],
    dashboardUrl,
    manageUrl,
  });

  if (messageId) {
    console.log(`✅ Email sent successfully! Message ID: ${messageId}`);
  } else {
    console.log(`⚠️ Email may have been sent (no message ID returned)`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
