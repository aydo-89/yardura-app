import { notFound, redirect } from "next/navigation";

import { CustomerDetailDashboard } from "../CustomerDetailDashboard";
import { authOptions } from "@/lib/auth";
import { safeGetServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const formatFrequencyLabel = (frequency?: string | null) => {
  if (!frequency) return "Unknown";
  switch (frequency.toUpperCase()) {
    case "WEEKLY":
      return "Weekly";
    case "BI_WEEKLY":
    case "BIWEEKLY":
      return "Bi-weekly";
    case "TWICE_WEEKLY":
      return "Twice weekly";
    case "MONTHLY":
      return "Monthly";
    case "ONE_TIME":
      return "One-time";
    default:
      return frequency.replace(/_/g, " ").toLowerCase();
  }
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user) {
    redirect(`/signin?callbackUrl=/admin/customers/${id}`);
  }

  const orgId = (session.user as any)?.orgId ?? undefined;

  const now = new Date();

  let customerRecord;
  try {
    customerRecord = await prisma.customer.findFirst({
      where: {
        id,
        ...(orgId ? { orgId } : {}),
      },
      include: {
        dogs: {
          select: {
            id: true,
            name: true,
            breed: true,
            age: true,
          },
        },
        jobs: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            frequency: true,
            nextVisitAt: true,
            status: true,
            stripeSubscriptionId: true,
          },
        },
        serviceVisits: {
          orderBy: { scheduledDate: "desc" },
          take: 50,
          include: {
            job: {
              select: {
                id: true,
                frequency: true,
              },
            },
            routeStop: {
              include: {
                route: {
                  select: {
                    id: true,
                    technician: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        },
        billingPlans: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            firstChargeAmountCents: true,
            recurringAmountCents: true,
          },
        },
        billingLedger: {
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            createdAt: true,
            description: true,
            amountCents: true,
            status: true,
            type: true,
          },
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      customerRecord = await prisma.customer.findFirst({
        where: {
          id,
          ...(orgId ? { orgId } : {}),
        },
        include: {
          dogs: true,
          jobs: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              frequency: true,
              nextVisitAt: true,
              status: true,
              stripeSubscriptionId: true,
            },
          },
          serviceVisits: {
            orderBy: { scheduledDate: "desc" },
            take: 50,
            include: {
              job: {
                select: {
                  id: true,
                  frequency: true,
                },
              },
              routeStop: {
                include: {
                  route: {
                    select: {
                      id: true,
                      technician: { select: { id: true, name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });
    } else {
      throw error;
    }
  }

  if (!customerRecord) {
    notFound();
  }

  const customer = customerRecord as any;

  const upcomingVisitsRaw = (customer.serviceVisits ?? [])
    .filter((visit: any) =>
      visit.status === "SCHEDULED" ||
      visit.status === "IN_PROGRESS" ||
      visit.scheduledDate >= now,
    )
    .sort((a: any, b: any) => a.scheduledDate.getTime() - b.scheduledDate.getTime())
    .slice(0, 10);

  const recentVisitsRaw = (customer.serviceVisits ?? [])
    .filter((visit: any) => visit.status === "COMPLETED")
    .slice(0, 10);

  const activeJobs = (customer.jobs ?? []).filter((job: any) => job.status === "ACTIVE");
  const inactiveJobs = (customer.jobs ?? []).filter((job: any) => job.status !== "ACTIVE");

  const serializeJob = (job: any) => {
    return {
      id: job.id,
      frequencyLabel: formatFrequencyLabel(job.frequency),
      nextVisitAt: job.nextVisitAt ? job.nextVisitAt.toISOString() : null,
      status: job.status,
      stripeSubscriptionId: job.stripeSubscriptionId,
      preferredTimeWindowLabel: null,
    };
  };

  const serializeVisit = (visit: any) => ({
    id: visit.id,
    status: visit.status,
    scheduledDate: visit.scheduledDate.toISOString(),
    jobFrequencyLabel: formatFrequencyLabel(visit.job?.frequency ?? undefined),
    technicianName: visit.routeStop?.route?.technician?.name ?? null,
    routeId: visit.routeStop?.route?.id ?? null,
  });

  const ledgerEntries = (customer.billingLedger ?? []).map((entry: any) => ({
    id: entry.id,
    createdAt: entry.createdAt.toISOString(),
    description: entry.description,
    amountCents: entry.amountCents,
    status: entry.status,
    type: entry.type,
  })) as {
    id: string;
    createdAt: string;
    description: string | null;
    amountCents: number | null;
    status: string | null;
    type: string | null;
  }[];

  const lifetimeRevenueCents = ledgerEntries.reduce((sum: number, entry) => {
    if (typeof entry.amountCents === "number" && entry.amountCents > 0) {
      return sum + entry.amountCents;
    }
    return sum;
  }, 0);

  const serializableCustomer = {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    addressLine1: customer.addressLine1,
    city: customer.city,
    state: customer.state,
    zip: customer.zip,
    createdAt: customer.createdAt.toISOString(),
    dogs: (customer.dogs ?? []).map((dog: any) => ({
      id: dog.id,
      name: dog.name,
      breed: dog.breed,
      age: dog.age,
    })),
    activeJobs: activeJobs.map(serializeJob),
    inactiveJobs: inactiveJobs.map(serializeJob),
    upcomingVisits: upcomingVisitsRaw.map(serializeVisit),
    recentVisits: recentVisitsRaw.map(serializeVisit),
    ledgerEntries,
    lifetimeRevenueCents,
  };

  return <CustomerDetailDashboard customer={serializableCustomer} />;
}
