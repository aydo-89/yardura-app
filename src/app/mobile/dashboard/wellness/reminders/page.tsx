import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { safeGetServerSession, authOptions } from "@/lib/auth";
import {
  extractActiveRole,
  extractUserRoles,
  getDefaultRedirectForRole,
} from "@/lib/auth/roles";
import type { AppUserRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { getCustomerWellnessAccess } from "@/lib/wellness/access";
import MobileWellnessReminders from "@/components/dashboard/mobile/MobileWellnessReminders";

export default async function MobileWellnessRemindersPage() {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user?.email) {
    redirect("/signin?callbackUrl=/mobile/dashboard/wellness/reminders");
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
    select: { id: true, orgId: true },
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

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      dogs: {
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      },
    },
  });

  if (!user) {
    redirect(redirectForRole(prioritizedRole, { requireCustomer: true }));
  }

  const accessSummary = await getCustomerWellnessAccess({
    customerId: customer.id,
    orgId: customer.orgId,
  });

  return (
    <div className="px-4 py-6 space-y-6">
      <header className="space-y-3">
        <Link
          href="/mobile/dashboard/wellness"
          className="inline-flex items-center gap-2 text-sm text-slate-400"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to wellness
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-white">Reminders</h1>
          <p className="text-sm text-slate-400">
            Track meds, vaccines, and vet visits with gentle nudges.
          </p>
        </div>
      </header>

      <MobileWellnessReminders
        dogs={user.dogs}
        access={{
          tier: accessSummary.tier,
          maxDogs: accessSummary.maxDogs,
          planEndsAt: accessSummary.planEndsAt?.toISOString() ?? null,
        }}
      />
    </div>
  );
}
