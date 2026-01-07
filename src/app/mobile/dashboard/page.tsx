import { redirect } from "next/navigation";

import { Prisma, ServiceStatus } from "@prisma/client";

import { safeGetServerSession, authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ServiceSummary } from "@/components/dashboard/types";
import MobileServiceSummary from "@/components/dashboard/mobile/MobileServiceSummary";
import MobileSkipAction from "@/components/dashboard/mobile/MobileSkipAction";
import MobileSupportCard from "@/components/dashboard/mobile/MobileSupportCard";
import {
  extractActiveRole,
  extractUserRoles,
  getDefaultRedirectForRole,
} from "@/lib/auth/roles";
import type { AppUserRole } from "@/lib/auth/roles";

function selectServiceSummary(summary: ServiceSummary | null) {
  return summary;
}

export default async function MobileDashboardPage() {
  const session = await safeGetServerSession(authOptions as any);
  const roles = extractUserRoles(session);
  const activeRole = extractActiveRole(session);

  console.log("[MobileDashboard] Session email:", session?.user?.email);
  console.log("[MobileDashboard] Extracted roles:", roles);
  console.log("[MobileDashboard] Session userRole:", (session as any)?.userRole);
  console.log("[MobileDashboard] User role:", (session?.user as any)?.role);
  console.log("[MobileDashboard] Active role:", activeRole);

  if (!session?.user?.email) {
    redirect("/signin?callbackUrl=/mobile/dashboard");
  }

  const prioritizedRole = activeRole ?? roles[0] ?? null;

  const redirectForRole = (
    role: AppUserRole | null | undefined,
    options?: { requireCustomer?: boolean },
  ) => {
    if (!role) {
      return options?.requireCustomer ? "/quote" : "/dashboard";
    }
    if (role === "TECH") {
      return "/field-tech/schedule";
    }
    if (role === "CUSTOMER" && options?.requireCustomer) {
      return "/quote";
    }
    return getDefaultRedirectForRole(role);
  };

  if (activeRole && activeRole !== "CUSTOMER") {
    redirect(redirectForRole(activeRole));
  }

  // Check if the user has a customer record first
  // Admins/owners/sales reps who are also customers should be able to use the mobile dashboard
  const customer = await prisma.customer.findFirst({
    where: { email: session.user.email },
  });

  // If they don't have a customer record, redirect based on their role
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

  let billingPlan: {
    metadata: Prisma.JsonValue | null;
  } | null = null;
  try {
    const plan = await prisma.customerBillingPlan.findFirst({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      select: {
        metadata: true,
      },
    });
    billingPlan = plan ?? null;
  } catch (error: any) {
    if (error?.code !== "P2021") {
      throw error;
    }
    billingPlan = null;
  }
  const metadata =
    billingPlan?.metadata && typeof billingPlan.metadata === "object"
      ? (billingPlan.metadata as Record<string, unknown>)
      : null;

  const serviceSummary = selectServiceSummary(
    (metadata?.serviceSummary as ServiceSummary | null) ?? null,
  );

  const serviceOptionsRaw =
    metadata && typeof metadata["serviceOptions"] === "object" && !Array.isArray(metadata["serviceOptions"])
      ? (metadata["serviceOptions"] as Record<string, unknown>)
      : null;

  const nextVisit = await prisma.serviceVisit.findFirst({
    where: {
      customerId: customer.id,
      status: ServiceStatus.SCHEDULED,
    },
    orderBy: { scheduledDate: "asc" },
    select: {
      id: true,
      scheduledDate: true,
      status: true,
      jobId: true,
      job: {
        select: {
          id: true,
          frequency: true,
        },
      },
    },
  });

  let jobServiceOptions: Record<string, unknown> | undefined;
  if (nextVisit?.job?.id) {
    try {
      const jobPlan = await prisma.customerBillingPlan.findFirst({
        where: { jobId: nextVisit.job.id },
        orderBy: { createdAt: "desc" },
        select: { metadata: true },
      });
      if (jobPlan?.metadata && typeof jobPlan.metadata === "object" && !Array.isArray(jobPlan.metadata)) {
        const raw = (jobPlan.metadata as Record<string, unknown>)["serviceOptions"];
        if (raw && typeof raw === "object" && !Array.isArray(raw)) {
          jobServiceOptions = raw as Record<string, unknown>;
        }
      }
    } catch (error: any) {
      if (error?.code !== "P2021") {
        throw error;
      }
    }
  }

  const weekendUpgrade =
    serviceSummary?.weekendUpgrade ??
    (serviceOptionsRaw ? Boolean(serviceOptionsRaw["weekendUpgrade"]) : undefined) ??
    (jobServiceOptions ? Boolean(jobServiceOptions["weekendUpgrade"]) : false);

  const resolvedFrequencyRaw =
    serviceSummary?.frequency ??
    (nextVisit?.job?.frequency ? String(nextVisit.job.frequency) : null);

  const normalizedFrequency = resolvedFrequencyRaw
    ? resolvedFrequencyRaw.toLowerCase().replace(/_/g, "-")
    : null;

  const mergedSummary: ServiceSummary = {
    ...(serviceSummary ?? {}),
    frequency: normalizedFrequency,
    nextVisitDate:
      serviceSummary?.nextVisitDate ??
      (nextVisit ? nextVisit.scheduledDate.toISOString() : null),
    weekendUpgrade,
  };

  return (
    <div className="px-4 py-6 space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          Welcome back
        </p>
        <h1 className="text-2xl font-semibold text-white">
          {customer.name ?? "Your Yardura dashboard"}
        </h1>
      </header>

      <MobileServiceSummary summary={mergedSummary} />

      <MobileSkipAction
        zipCode={customer.zip}
        visitId={nextVisit?.id ?? null}
        frequency={normalizedFrequency}
        weekendUpgrade={mergedSummary.weekendUpgrade ?? null}
      />

      <MobileSupportCard />
    </div>
  );
}
