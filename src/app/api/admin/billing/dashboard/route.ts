import { NextRequest, NextResponse } from "next/server";
import { BillingLedgerEntryStatus, Prisma } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { safeGetServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getQuickBooksSettings } from "@/lib/business-config";

export const runtime = "nodejs";

const ADMIN_ROLES = new Set(["OWNER", "ADMIN", "GOD_MODE"]);

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

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

export async function GET(request: NextRequest) {
  const session = await safeGetServerSession(authOptions as any);
  const role =
    (session as any)?.userRole ??
    ((session?.user as { role?: string } | undefined)?.role ?? null);

  if (!session?.user || !role || !ADMIN_ROLES.has(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const orgIdParam = url.searchParams.get("orgId");
  const customerId = url.searchParams.get("customerId") ?? undefined;
  const jobId = url.searchParams.get("jobId") ?? undefined;
  const ledgerStatusParam = url.searchParams.get("status");
  const startDateParam = url.searchParams.get("startDate");
  const endDateParam = url.searchParams.get("endDate");
  const skipParam = url.searchParams.get("skip");
  const takeParam = url.searchParams.get("take");

  const defaultOrgId =
    orgIdParam ||
    ((session as any)?.orgId as string | undefined) ||
    ((session?.user as any)?.orgId as string | undefined) ||
    "yardura";

  const skip = Math.max(Number(skipParam ?? "0") || 0, 0);
  const take = Math.min(Math.max(Number(takeParam ?? "25") || 25, 1), 100);

  const startDate = parseDate(startDateParam);
  const endDate = parseDate(endDateParam);

  let ledgerStatus: BillingLedgerEntryStatus | undefined;
  if (ledgerStatusParam) {
    const normalized = ledgerStatusParam.toUpperCase();
    if (Object.values(BillingLedgerEntryStatus).includes(normalized as any)) {
      ledgerStatus = normalized as BillingLedgerEntryStatus;
    }
  }

  const planWhere: Prisma.CustomerBillingPlanWhereInput = {
    orgId: defaultOrgId,
  };

  if (customerId) {
    planWhere.customerId = customerId;
  }
  if (jobId) {
    planWhere.jobId = jobId;
  }

  const ledgerWhere: Prisma.CustomerBillingLedgerEntryWhereInput = {
    orgId: defaultOrgId,
  };
  if (customerId) {
    ledgerWhere.customerId = customerId;
  }
  if (jobId) {
    ledgerWhere.jobId = jobId;
  }
  if (ledgerStatus) {
    ledgerWhere.status = ledgerStatus;
  }
  if (startDate || endDate) {
    ledgerWhere.createdAt = {};
    if (startDate) {
      (ledgerWhere.createdAt as Prisma.DateTimeFilter).gte = startDate;
    }
    if (endDate) {
      (ledgerWhere.createdAt as Prisma.DateTimeFilter).lte = endDate;
    }
  }

  const [
    planTotal,
    planRows,
    ledgerTotal,
    ledgerRows,
    pendingChargeSum,
    pendingCreditSum,
    appliedSum,
    pendingQuickBooksCount,
    queuedQuickBooksCount,
    blockedQuickBooksCount,
    quickBooksSettings,
  ] = await Promise.all([
    prisma.customerBillingPlan.count({ where: planWhere }),
    prisma.customerBillingPlan.findMany({
      where: planWhere,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            addressLine1: true,
            city: true,
            state: true,
            zip: true,
          },
        },
        job: {
          select: {
            id: true,
            frequency: true,
            status: true,
          },
        },
      },
    }),
    prisma.customerBillingLedgerEntry.count({ where: ledgerWhere }),
    prisma.customerBillingLedgerEntry.findMany({
      where: ledgerWhere,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        serviceVisit: {
          select: {
            id: true,
            scheduledDate: true,
            status: true,
          },
        },
      },
    }),
    prisma.customerBillingLedgerEntry.aggregate({
      where: {
        ...ledgerWhere,
        status: BillingLedgerEntryStatus.PENDING,
        amountCents: { gt: 0 },
      },
      _sum: { amountCents: true },
    }),
    prisma.customerBillingLedgerEntry.aggregate({
      where: {
        ...ledgerWhere,
        status: BillingLedgerEntryStatus.PENDING,
        amountCents: { lt: 0 },
      },
      _sum: { amountCents: true },
    }),
    prisma.customerBillingLedgerEntry.aggregate({
      where: {
        ...ledgerWhere,
        status: BillingLedgerEntryStatus.APPLIED,
      },
      _sum: { amountCents: true },
    }),
    prisma.customerBillingLedgerEntry.count({
      where: {
        ...ledgerWhere,
        metadata: {
          path: ["quickbooks", "status"],
          equals: "pending",
        },
      },
    }),
    prisma.customerBillingLedgerEntry.count({
      where: {
        ...ledgerWhere,
        metadata: {
          path: ["quickbooks", "status"],
          equals: "queued",
        },
      },
    }),
    prisma.customerBillingLedgerEntry.count({
      where: {
        ...ledgerWhere,
        metadata: {
          path: ["quickbooks", "status"],
          equals: "blocked",
        },
      },
    }),
    getQuickBooksSettings(defaultOrgId),
  ]);

  const plans = planRows.map((plan) => {
    const metadata = asObject(plan.metadata);
    const billingAutomation = metadata ? asObject(metadata["billingAutomation"]) : null;
    const serviceOptions = metadata ? asObject(metadata["serviceOptions"]) : null;

    const weekendUpgrade = Boolean(serviceOptions?.weekendUpgrade);
    const trialStatus = (() => {
      if (plan.trialEndsAt && plan.trialEndsAt.getTime() > Date.now()) {
        return "active";
      }
      if (plan.trialEndsAt && plan.trialEndsAt.getTime() <= Date.now()) {
        return "complete";
      }
      return null;
    })();

    return {
      jobId: plan.jobId,
      customerId: plan.customerId,
      orgId: plan.orgId,
      billingPreference: plan.billingPreference,
      recurringAmountCents: plan.recurringAmountCents,
      perVisitAmountCents: plan.perVisitAmountCents,
      trial: {
        trialEndsAt: plan.trialEndsAt ? plan.trialEndsAt.toISOString() : null,
        firstChargeAt: asIsoString(billingAutomation?.["firstChargeAt"]),
        status: trialStatus,
      },
      billingAutomation: {
        lastBaseEntryAt: asIsoString(billingAutomation?.["lastBaseEntryAt"]),
        billingCadenceDays: asNumber(billingAutomation?.["billingCadenceDays"]),
      },
      weekendUpgrade,
      stripe: {
        customerId: plan.stripeCustomerId,
        subscriptionId: plan.stripeSubscriptionId,
        scheduleId: plan.stripeScheduleId,
      },
      customer: plan.customer
        ? {
            id: plan.customer.id,
            name: plan.customer.name,
            email: plan.customer.email,
            phone: plan.customer.phone,
            address: `${plan.customer.addressLine1}, ${plan.customer.city}, ${plan.customer.state} ${plan.customer.zip}`,
          }
        : null,
      job: plan.job
        ? {
            id: plan.job.id,
            frequency: plan.job.frequency,
            status: plan.job.status,
          }
        : null,
    };
  });

  const ledgerEntries = ledgerRows.map((entry) => {
    const metadata = asObject(entry.metadata);
    const quickBooksMetadata = metadata ? asObject(metadata["quickbooks"]) : null;
    const stripeMetadata = metadata ? asObject(metadata["stripe"]) : null;
    const quickBooks = quickBooksMetadata
      ? {
          status:
            typeof quickBooksMetadata.status === "string"
              ? quickBooksMetadata.status
              : null,
          lastAttempt: asIsoString(quickBooksMetadata["lastAttempt"]),
          note:
            typeof quickBooksMetadata.note === "string"
              ? quickBooksMetadata.note
              : typeof quickBooksMetadata.error === "string"
                ? quickBooksMetadata.error
                : null,
        }
      : null;
    const stripe = stripeMetadata
      ? {
          status:
            typeof stripeMetadata.status === "string"
              ? stripeMetadata.status
              : typeof stripeMetadata.state === "string"
                ? stripeMetadata.state
                : null,
          invoiceItemId:
            typeof stripeMetadata.invoiceItemId === "string"
              ? stripeMetadata.invoiceItemId
              : typeof stripeMetadata.invoice_item_id === "string"
                ? stripeMetadata.invoice_item_id
                : null,
          description:
            typeof stripeMetadata.description === "string"
              ? stripeMetadata.description
              : null,
        }
      : null;

    return {
      id: entry.id,
      jobId: entry.jobId,
      customerId: entry.customerId,
      serviceVisitId: entry.serviceVisitId,
      type: entry.type,
      status: entry.status,
      amountCents: entry.amountCents,
      description: entry.description,
      createdAt: entry.createdAt.toISOString(),
      appliedAt: entry.appliedAt ? entry.appliedAt.toISOString() : null,
      stripeInvoiceId: entry.stripeInvoiceId,
      metadata: entry.metadata ?? null,
      quickbooks: quickBooks,
      stripe,
      serviceVisit: entry.serviceVisit
        ? {
            id: entry.serviceVisit.id,
            scheduledDate: entry.serviceVisit.scheduledDate
              ? entry.serviceVisit.scheduledDate.toISOString()
              : null,
            status: entry.serviceVisit.status,
          }
        : null,
    };
  });

  return NextResponse.json({
    orgId: defaultOrgId,
    plans: {
      total: planTotal,
      skip,
      take,
      items: plans,
    },
    ledger: {
      total: ledgerTotal,
      skip,
      take,
      items: ledgerEntries,
      summary: {
        pendingChargesCents: pendingChargeSum._sum.amountCents ?? 0,
        pendingCreditsCents: pendingCreditSum._sum.amountCents ?? 0,
        appliedAmountCents: appliedSum._sum.amountCents ?? 0,
      },
    },
    integrations: {
      quickbooks: {
        enabled: quickBooksSettings.enabled ?? false,
        needsReconnect: Boolean(quickBooksSettings.needsReconnect),
        lastSyncAt: asIsoString(quickBooksSettings.lastSyncAt ?? null),
        counts: {
          pending: pendingQuickBooksCount,
          queued: queuedQuickBooksCount,
          blocked: blockedQuickBooksCount,
        },
      },
    },
  });
}
