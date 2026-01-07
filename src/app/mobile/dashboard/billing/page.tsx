import { redirect } from "next/navigation";

import { safeGetServerSession, authOptions } from "@/lib/auth";
import {
  extractActiveRole,
  extractUserRoles,
  getDefaultRedirectForRole,
} from "@/lib/auth/roles";
import type { AppUserRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import MobileBillingSummary from "@/components/dashboard/mobile/MobileBillingSummary";
import MobileLedgerList from "@/components/dashboard/mobile/MobileLedgerList";

export default async function MobileBillingPage() {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user?.email) {
    redirect("/signin?callbackUrl=/mobile/dashboard/billing");
  }

  const roles = extractUserRoles(session);
  const activeRole = extractActiveRole(session);
  const prioritizedRole = activeRole ?? roles[0] ?? null;

  const redirectForRole = (
    role: AppUserRole | null | undefined,
    options?: { requireCustomer?: boolean },
  ) => {
    if (!role) {
      return options?.requireCustomer ? "/quote" : "/dashboard";
    }
    if (role === "TECH") {
      return "/field-tech";
    }
    if (role === "CUSTOMER" && options?.requireCustomer) {
      return "/quote";
    }
    return getDefaultRedirectForRole(role);
  };

  if (activeRole && activeRole !== "CUSTOMER") {
    redirect(redirectForRole(activeRole));
  }

  const customer = await prisma.customer.findFirst({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!customer) {
    let fallbackRole: AppUserRole | null | undefined =
      prioritizedRole ??
      ((session as any)?.userRole as AppUserRole | null | undefined) ??
      ((session?.user as any)?.role as AppUserRole | null | undefined) ??
      null;

    if (!fallbackRole) {
      const userRecord = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { role: true },
      });
      fallbackRole = (userRecord?.role as AppUserRole | undefined) ?? null;
    }

    redirect(redirectForRole(fallbackRole, { requireCustomer: true }));
  }

  let ledgerEntries: {
    id: string;
    type: any;
    status: any;
    amountCents: number;
    description: string | null;
    createdAt: Date;
    appliedAt: Date | null;
  }[] = [];

  try {
    ledgerEntries = await prisma.customerBillingLedgerEntry.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        type: true,
        status: true,
        amountCents: true,
        description: true,
        createdAt: true,
        appliedAt: true,
      },
    });
  } catch (error: any) {
    if (error?.code !== "P2021") {
      throw error;
    }
  }

  const totals = ledgerEntries.reduce(
    (
      acc,
      entry,
    ): {
      appliedCents: number;
      pendingCents: number;
      balanceDueCents: number;
    } => {
      const amount = entry.amountCents;
      if (entry.status === "APPLIED") {
        acc.appliedCents += amount;
      } else if (entry.status === "PENDING") {
        acc.pendingCents += amount;
      }
      acc.balanceDueCents = acc.appliedCents + acc.pendingCents;
      return acc;
    },
    { appliedCents: 0, pendingCents: 0, balanceDueCents: 0 },
  );

  return (
    <div className="px-4 py-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">Billing</h1>
        <p className="text-sm text-slate-400">
          Track charges, credits, and upcoming invoices.
        </p>
      </header>

      <MobileBillingSummary
        balanceDueCents={totals.balanceDueCents}
        pendingCents={totals.pendingCents}
      />

      <MobileLedgerList
        entries={ledgerEntries.map((entry) => ({
          id: entry.id,
          type: entry.type,
          status: entry.status,
          amountCents: entry.amountCents,
          description: entry.description,
          createdAt: entry.createdAt.toISOString(),
          appliedAt: entry.appliedAt ? entry.appliedAt.toISOString() : null,
        }))}
      />
    </div>
  );
}
