import { NextRequest, NextResponse } from "next/server";

import { buildCustomerSetupResponse, canSetupCustomer } from "@/lib/mobile/customer-setup";
import { prisma } from "@/lib/prisma";
import { verifyMobileToken } from "@/lib/mobile-auth";
import { sendCustomerEmailReport } from "@/lib/emails/customer-report";
import {
  buildCustomerEmailReportData,
  resolveReportPeriod,
} from "@/lib/reports/customer-email-report";
import type { CustomerEmailReportCadence } from "@prisma/client";

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

export async function POST(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let payload: ReturnType<typeof verifyMobileToken>;
  try {
    payload = verifyMobileToken(token);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
  }

  const userId = payload.sub;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Customer access required" }, { status: 403 });
  }
  const canSetup = canSetupCustomer(payload.roles);

  const customer = await prisma.customer.findFirst({
    where: { userId },
    include: { user: true, dogs: true },
  });

  if (!customer) {
    return canSetup
      ? buildCustomerSetupResponse(userId)
      : NextResponse.json({ ok: false, error: "Customer access required" }, { status: 403 });
  }

  // Get report preferences (or use defaults)
  const preference = await prisma.customerEmailReportPreference.findUnique({
    where: { customerId: customer.id },
  });

  // Use WEEKLY as default period if no preferences set
  const cadence: CustomerEmailReportCadence = preference?.cadence ?? "WEEKLY";
  const period = resolveReportPeriod({ cadence });

  // Build the report data using the customer's section preferences
  const sections = {
    includeWellness: preference?.includeWellness ?? true,
    includeScooping: preference?.includeScooping ?? true,
    includeFood: preference?.includeFood ?? true,
    includeWalks: preference?.includeWalks ?? true,
    includeReminders: preference?.includeReminders ?? true,
    includeChats: preference?.includeChats ?? true,
    includePhotos: preference?.includePhotos ?? false, // Default photos off
  };

  try {
    const reportData = await buildCustomerEmailReportData({
      customerId: customer.id,
      orgId: customer.orgId,
      period,
      sections,
    });

    if (!reportData) {
      return NextResponse.json(
        { ok: false, error: "Unable to generate report data" },
        { status: 500 },
      );
    }

    // Send to customer's email (and any additional recipients)
    const recipients = preference?.recipients?.length
      ? preference.recipients
      : customer.email
        ? [customer.email]
        : customer.user?.email
          ? [customer.user.email]
          : [];

    if (recipients.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No email address found for customer" },
        { status: 400 },
      );
    }

    // Build dashboard URL for the customer
    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://getinsightscoop.com"}/customer/dashboard`;
    const manageUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://getinsightscoop.com"}/customer/account`;

    // Send the report
    await sendCustomerEmailReport({
      report: reportData,
      recipients,
      dashboardUrl,
      manageUrl,
    });

    return NextResponse.json({
      ok: true,
      message: `Report sent to ${recipients.join(", ")}`,
      periodLabel: period.label,
    });
  } catch (err) {
    console.error("[send-now] Error generating/sending report:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to send report",
      },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";

