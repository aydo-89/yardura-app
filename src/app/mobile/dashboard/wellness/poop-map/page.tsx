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
import MobileWellnessPoopMap from "@/components/dashboard/mobile/MobileWellnessPoopMap";

export default async function MobileWellnessPoopMapPage() {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user?.email) {
    redirect("/signin?callbackUrl=/mobile/dashboard/wellness/poop-map");
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
    select: { id: true, latitude: true, longitude: true },
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

  const [ownerCaptures, proMedia] = await Promise.all([
    prisma.customerWellnessCapture.findMany({
      where: {
        customerId: customer.id,
        gpsLat: { not: null },
        gpsLng: { not: null },
      },
      orderBy: { capturedAt: "desc" },
      take: 200,
      select: {
        id: true,
        gpsLat: true,
        gpsLng: true,
        capturedAt: true,
      },
    }),
    prisma.serviceVisitMedia.findMany({
      where: {
        serviceVisit: { customerId: customer.id },
        gpsLat: { not: null },
        gpsLng: { not: null },
        assetType: "INSIGHTSCOOP",
      },
      orderBy: { capturedAt: "desc" },
      take: 200,
      select: {
        id: true,
        gpsLat: true,
        gpsLng: true,
        capturedAt: true,
      },
    }),
  ]);

  const points = [
    ...ownerCaptures.map((capture) => ({
      id: capture.id,
      lat: capture.gpsLat ?? 0,
      lng: capture.gpsLng ?? 0,
      capturedAt: capture.capturedAt.toISOString(),
      source: "OWNER" as const,
    })),
    ...proMedia.map((media) => ({
      id: media.id,
      lat: media.gpsLat ?? 0,
      lng: media.gpsLng ?? 0,
      capturedAt: media.capturedAt.toISOString(),
      source: "PRO" as const,
    })),
  ].filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));

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
          <h1 className="text-2xl font-semibold text-white">Poop map</h1>
          <p className="text-sm text-slate-400">
            Visualize stool capture locations to keep a consistent routine.
          </p>
        </div>
      </header>

      <MobileWellnessPoopMap
        points={points}
        homeLocation={
          typeof customer.latitude === "number" && typeof customer.longitude === "number"
            ? { lat: customer.latitude, lng: customer.longitude }
            : null
        }
      />
    </div>
  );
}
