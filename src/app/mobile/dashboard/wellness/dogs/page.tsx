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
import { resolveStorageUrl } from "@/lib/storage";
import { getCustomerWellnessAccess } from "@/lib/wellness/access";
import MobileWellnessDogHub from "@/components/dashboard/mobile/MobileWellnessDogHub";

export default async function MobileWellnessDogsPage() {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user?.email) {
    redirect("/signin?callbackUrl=/mobile/dashboard/wellness/dogs");
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
    select: { id: true, orgId: true, userId: true },
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

  const dogs = await prisma.dog.findMany({
    where: customer.userId
      ? { OR: [{ customerId: customer.id }, { userId: customer.userId }] }
      : { customerId: customer.id },
    select: {
      id: true,
      name: true,
      breed: true,
      age: true,
      weight: true,
      allergies: true,
      medications: true,
      dietNotes: true,
      vetName: true,
      vetPhone: true,
      vetClinic: true,
      photoUrl: true,
      customerId: true,
    },
    orderBy: { name: "asc" },
  });

  const unlinkedDogIds = dogs
    .filter((dog) => !dog.customerId)
    .map((dog) => dog.id);
  if (unlinkedDogIds.length) {
    await prisma.dog.updateMany({
      where: { id: { in: unlinkedDogIds } },
      data: { customerId: customer.id },
    });
  }

  const dogsWithPhotos = await Promise.all(
    dogs.map(async ({ customerId: _customerId, ...dog }) => ({
      ...dog,
      photoUrl: await resolveStorageUrl(dog.photoUrl),
    })),
  );

  const weightEntries = await prisma.dogWeightEntry.findMany({
    where: { customerId: customer.id },
    orderBy: { recordedAt: "desc" },
    take: 200,
    include: { dog: { select: { name: true } } },
  });

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
          <h1 className="text-2xl font-semibold text-white">Dog profiles</h1>
          <p className="text-sm text-slate-400">
            Track health details, weight trends, and vet info.
          </p>
        </div>
      </header>

      <MobileWellnessDogHub
        dogs={dogsWithPhotos}
        weightEntries={weightEntries.map((entry) => ({
          id: entry.id,
          dogId: entry.dogId,
          dogName: entry.dog?.name ?? null,
          weightLbs: entry.weightLbs,
          recordedAt: entry.recordedAt.toISOString(),
          notes: entry.notes,
          source: entry.source,
        }))}
        access={{
          tier: accessSummary.tier,
          maxDogs: accessSummary.maxDogs,
          planEndsAt: accessSummary.planEndsAt?.toISOString() ?? null,
        }}
      />
    </div>
  );
}
