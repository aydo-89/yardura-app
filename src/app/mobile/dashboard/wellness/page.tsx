import { redirect } from "next/navigation";

import { safeGetServerSession, authOptions } from "@/lib/auth";
import {
  extractActiveRole,
  extractUserRoles,
  getDefaultRedirectForRole,
} from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { getCustomerWellnessAccess } from "@/lib/wellness/access";
import {
  buildWellnessReadingsFromCaptures,
  buildWellnessReadingsFromMedia,
} from "@/lib/wellness/readings";
import MobileWellnessScreen from "@/components/dashboard/mobile/MobileWellnessScreen";
import type { DataReading, ServiceVisit } from "@/shared/wellness";

export default async function MobileWellnessPage() {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user?.email) {
    redirect("/signin?callbackUrl=/mobile/dashboard/wellness");
  }

  const roles = extractUserRoles(session);
  const activeRole = extractActiveRole(session);
  const prioritizedRole = activeRole ?? roles[0] ?? null;

  const redirectForRole = (
    role: typeof prioritizedRole,
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
    redirect(redirectForRole(prioritizedRole, { requireCustomer: true }));
  }

  const visits = await prisma.serviceVisit.findMany({
    where: { customerId: customer.id },
    orderBy: { scheduledDate: "desc" },
    take: 40,
    include: {
      insights: true,
      media: {
        where: {
          assetType: "INSIGHTSCOOP",
          analysisStatus: { in: ["COMPLETED", "NEEDS_REVIEW"] },
        },
        orderBy: { capturedAt: "asc" },
      },
    },
  });

  const ownerCaptures = await prisma.customerWellnessCapture.findMany({
    where: {
      customerId: customer.id,
      analysisStatus: { in: ["COMPLETED", "NEEDS_REVIEW"] },
    },
    orderBy: { capturedAt: "desc" },
    take: 40,
    include: {
      dog: { select: { name: true } },
    },
  });

  const dataReadings: DataReading[] = [
    ...buildWellnessReadingsFromMedia(
      visits.flatMap((visit) =>
        visit.media.map((m) => ({
          id: m.id,
          capturedAt: m.capturedAt,
          analysisResult: m.analysisResult as Record<string, unknown> | null,
          stoolSampleId: m.stoolSampleId,
          stoolSampleView: m.stoolSampleView,
          assetType: m.assetType,
        })),
      ),
    ),
    ...buildWellnessReadingsFromCaptures(
      ownerCaptures.map((capture) => ({
        id: capture.id,
        capturedAt: capture.capturedAt,
        analysisResult: capture.analysisResult as Record<string, unknown> | null,
        dogName: capture.dog?.name ?? null,
        storagePath: capture.storagePath,
      })),
    ),
  ].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const serviceVisits: ServiceVisit[] = visits.map((visit) => ({
    id: visit.id,
    date: visit.scheduledDate.toISOString(),
    type: "residential",
    areas: [],
    notes: visit.insights?.[0]?.observations ?? undefined,
  }));

  const accessSummary = await getCustomerWellnessAccess({
    customerId: customer.id,
    orgId: customer.orgId,
  });

  return (
    <div className="px-4 py-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">Wellness</h1>
        <p className="text-sm text-slate-400">
          Monitor stool health trends and weekly insights.
        </p>
      </header>

      <MobileWellnessScreen
        dataReadings={dataReadings}
        serviceVisits={serviceVisits}
        access={{
          tier: accessSummary.tier,
          source: accessSummary.source,
          planEndsAt: accessSummary.planEndsAt?.toISOString() ?? null,
        }}
      />
    </div>
  );
}
