import { NextResponse } from "next/server";

import {
  BillingLedgerEntryStatus,
  BillingLedgerEntryType,
} from "@prisma/client";

import { authOptions, safeGetServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const formatEntry = (entry: any) => ({
  id: entry.id,
  type: entry.type,
  status: entry.status,
  amountCents: entry.amountCents,
  description: entry.description,
  createdAt: entry.createdAt.toISOString(),
  appliedAt: entry.appliedAt ? entry.appliedAt.toISOString() : null,
  voidedAt: entry.voidedAt ? entry.voidedAt.toISOString() : null,
  stripeInvoiceId: entry.stripeInvoiceId,
  stripeInvoiceItemId: entry.stripeInvoiceItemId,
  serviceVisitId: entry.serviceVisitId,
  metadata: entry.metadata ?? null,
});

export async function GET() {
  const session = (await safeGetServerSession(authOptions as any)) as
    | { user?: { email?: string | null } }
    | null;

  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const customer = await prisma.customer.findFirst({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!customer) {
    return NextResponse.json({ ok: false, error: "Customer not found" }, { status: 404 });
  }

  const ledgerEntries = await prisma.customerBillingLedgerEntry.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const totals = ledgerEntries.reduce(
    (
      acc,
      entry,
    ): {
      appliedCents: number;
      pendingCents: number;
      creditsCents: number;
      chargesCents: number;
    } => {
      const amount = entry.amountCents;
      if (entry.status === BillingLedgerEntryStatus.APPLIED) {
        acc.appliedCents += amount;
      } else if (entry.status === BillingLedgerEntryStatus.PENDING) {
        acc.pendingCents += amount;
      }
      if (entry.type === BillingLedgerEntryType.CREDIT || amount < 0) {
        acc.creditsCents += amount;
      } else {
        acc.chargesCents += amount;
      }
      return acc;
    },
    { appliedCents: 0, pendingCents: 0, creditsCents: 0, chargesCents: 0 },
  );

  return NextResponse.json({
    ok: true,
    data: {
      entries: ledgerEntries.map(formatEntry),
      totals: {
        appliedCents: totals.appliedCents,
        pendingCents: totals.pendingCents,
        creditsCents: totals.creditsCents,
        chargesCents: totals.chargesCents,
        balanceDueCents: totals.appliedCents + totals.pendingCents,
      },
    },
  });
}
