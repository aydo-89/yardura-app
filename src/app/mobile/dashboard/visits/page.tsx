import { redirect } from "next/navigation";

import { safeGetServerSession, authOptions } from "@/lib/auth";
import {
  extractActiveRole,
  extractUserRoles,
  getDefaultRedirectForRole,
} from "@/lib/auth/roles";
import type { AppUserRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import MobileVisitTimeline from "@/components/dashboard/mobile/MobileVisitTimeline";

export default async function MobileVisitsPage() {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user?.email) {
    redirect("/signin?callbackUrl=/mobile/dashboard/visits");
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

  const visits = await prisma.serviceVisit.findMany({
    where: { customerId: customer.id },
    orderBy: { scheduledDate: "desc" },
    take: 20,
    include: {
      media: true,
    },
  });

  const timeline = visits.map((visit) => ({
    id: visit.id,
    scheduledDate: visit.scheduledDate.toISOString(),
    status: visit.status,
    serviceType: visit.serviceType,
    yardSize: visit.yardSize,
    media: visit.media.map((media) => ({
      id: media.id,
      assetType: media.assetType,
      capturedAt: media.capturedAt.toISOString(),
      analysisStatus: media.analysisStatus,
      analysisModel: media.analysisModel,
      analysisConfidence: media.analysisConfidence,
    })),
  }));

  return (
    <div className="px-4 py-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">Visits</h1>
        <p className="text-sm text-slate-400">
          Review recent visits and upcoming appointments.
        </p>
      </header>

      <MobileVisitTimeline visits={timeline} />
    </div>
  );
}
