import { redirect } from "next/navigation";

import { CustomersDashboard } from "./CustomersDashboard";
import { authOptions } from "@/lib/auth";
import { safeGetServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qRaw = params?.q;
  const query = Array.isArray(qRaw) ? qRaw[0] : qRaw;

  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user) {
    redirect("/signin?callbackUrl=/admin/customers");
  }
  // Default to "yardura" org - this supports multi-tenancy while keeping a sensible default
  const orgId = (session.user as any)?.orgId || "yardura";

  const now = new Date();

  const customers = await prisma.customer.findMany({
    where: {
      orgId,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
              { phone: { contains: query, mode: "insensitive" } },
              { city: { contains: query, mode: "insensitive" } },
              { zip: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      jobs: {
        select: {
          id: true,
          status: true,
          frequency: true,
          nextVisitAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
      serviceVisits: {
        where: {
          status: { in: ["SCHEDULED", "IN_PROGRESS"] },
          scheduledDate: { gte: now },
        },
        orderBy: { scheduledDate: "asc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const serializable = customers.map((customer) => ({
    ...customer,
    createdAt: customer.createdAt.toISOString(),
    jobs: customer.jobs.map((job) => ({
      ...job,
      nextVisitAt: job.nextVisitAt ? job.nextVisitAt.toISOString() : null,
    })),
    serviceVisits: customer.serviceVisits.map((visit) => ({
      scheduledDate: visit.scheduledDate.toISOString(),
    })),
  }));

  return (
    <CustomersDashboard
      initialCustomers={serializable}
      orgId={orgId}
      initialSearchTerm={query ?? ""}
    />
  );
}
