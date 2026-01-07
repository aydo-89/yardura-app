import { prisma } from "@/lib/prisma";
import { ServiceStatus } from "@prisma/client";

import { ensureDispatchSchema } from "./schema-guard";

export interface ListVisitsOptions {
  orgId: string;
  from?: Date;
  to?: Date;
  includeAssigned?: boolean;
}

export async function listScheduledVisits(options: ListVisitsOptions) {
  const { orgId, from, to, includeAssigned = true } = options;

  await ensureDispatchSchema();

  return prisma.serviceVisit.findMany({
    where: {
      orgId,
      status: ServiceStatus.SCHEDULED,
      ...(from || to
        ? {
            scheduledDate: {
              gte: from,
              lte: to,
            },
          }
        : {}),
      ...(includeAssigned
        ? {}
        : {
            routeStop: null,
          }),
    },
    orderBy: { scheduledDate: "asc" },
    select: {
      id: true,
      orgId: true,
      customerId: true,
      jobId: true,
      scheduledDate: true,
      status: true,
      metadata: true,
      preferredTimeWindow: true,
      preferredTimeWindowSlug: true,
      job: {
        select: {
          id: true,
          frequency: true,
        },
      },
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          addressLine1: true,
          city: true,
          state: true,
          zip: true,
          latitude: true,
          longitude: true,
        },
      },
      routeStop: {
        select: {
          id: true,
          routeInstanceId: true,
        },
      },
    },
  });
}
