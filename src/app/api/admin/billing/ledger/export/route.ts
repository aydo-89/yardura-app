import { NextRequest, NextResponse } from "next/server";
import { BillingLedgerEntryStatus, Prisma } from "@prisma/client";

import { authOptions, safeGetServerSession } from "@/lib/auth";
import { resolveBusinessId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { ledgerEntriesToCsv, type LedgerCsvRow } from "@/lib/billing/csv";

const ADMIN_ROLES = new Set(["OWNER", "ADMIN", "GOD_MODE"]);

function ensureAdmin(session: any) {
  const role = session?.userRole ?? session?.user?.role ?? null;
  if (!session?.user || !role || !ADMIN_ROLES.has(role)) {
    throw new Error("unauthorized");
  }
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asIsoString(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await safeGetServerSession(authOptions as any);
  try {
    ensureAdmin(session);
  } catch (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const customerId = url.searchParams.get("customerId") ?? undefined;
  const jobId = url.searchParams.get("jobId") ?? undefined;
  const statusParam = url.searchParams.get("status");
  const startDateParam = url.searchParams.get("startDate");
  const endDateParam = url.searchParams.get("endDate");
  const limitParam = url.searchParams.get("limit");

  const orgIdParam = url.searchParams.get("orgId");
  const orgId = orgIdParam && orgIdParam.trim().length ? orgIdParam.trim() : await resolveBusinessId(request);

  const startDate = parseDate(startDateParam);
  const endDate = parseDate(endDateParam);
  const limit = Math.min(Math.max(Number(limitParam ?? "2000") || 2000, 1), 10000);

  let ledgerStatus: BillingLedgerEntryStatus | undefined;
  if (statusParam) {
    const normalized = statusParam.toUpperCase();
    if (Object.values(BillingLedgerEntryStatus).includes(normalized as any)) {
      ledgerStatus = normalized as BillingLedgerEntryStatus;
    }
  }

  const where: Prisma.CustomerBillingLedgerEntryWhereInput = {
    orgId,
  };
  if (customerId) where.customerId = customerId;
  if (jobId) where.jobId = jobId;
  if (ledgerStatus) where.status = ledgerStatus;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) (where.createdAt as Prisma.DateTimeFilter).gte = startDate;
    if (endDate) (where.createdAt as Prisma.DateTimeFilter).lte = endDate;
  }

  const entries = await prisma.customerBillingLedgerEntry.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      serviceVisit: {
        select: {
          scheduledDate: true,
        },
      },
    },
  });

  const rows: LedgerCsvRow[] = entries.map((entry) => {
    const metadata = asObject(entry.metadata);
    const quickBooksMetadata = metadata ? asObject(metadata["quickbooks"]) : null;

    const amount = (entry.amountCents ?? 0) / 100;

    return {
      createdAt: entry.createdAt.toISOString(),
      type: entry.type,
      status: entry.status,
      amountCents: entry.amountCents,
      amount: new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      }).format(amount),
      description: entry.description ?? "",
      customerId: entry.customerId,
      jobId: entry.jobId,
      serviceVisitId: entry.serviceVisitId ?? null,
      stripeInvoiceId: entry.stripeInvoiceId ?? null,
      quickBooksStatus:
        typeof quickBooksMetadata?.status === "string"
          ? quickBooksMetadata.status
          : null,
      quickBooksNote:
        typeof quickBooksMetadata?.note === "string"
          ? quickBooksMetadata.note
          : typeof quickBooksMetadata?.error === "string"
            ? quickBooksMetadata.error
            : null,
      quickBooksLastAttempt: asIsoString(quickBooksMetadata?.lastAttempt),
    };
  });

  const csv = ledgerEntriesToCsv(rows);
  const encoder = new TextEncoder();
  const filename = `ledger-export-${orgId}-${Date.now()}.csv`;

  return new NextResponse(encoder.encode(csv), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
