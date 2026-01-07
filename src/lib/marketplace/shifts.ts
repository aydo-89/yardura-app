import {
  AvailabilityWindow,
  Prisma,
  RouteShiftStatus,
  ScooperStatus,
  ServiceStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

export interface CreateRouteShiftInput {
  orgId: string;
  tileId: string;
  serviceDate: Date;
  window: AvailabilityWindow;
  visitIds: string[];
  createdById?: string | null;
  primary?: boolean;
}

export async function createRouteShift(input: CreateRouteShiftInput) {
  const { orgId, tileId, serviceDate, window, visitIds, createdById, primary } = input;

  if (!visitIds.length) {
    throw new Error("Route shift must include at least one visit");
  }

  return prisma.$transaction(async (tx) => {
    const visits = await tx.serviceVisit.findMany({
      where: {
        id: { in: visitIds },
        orgId,
        tileId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (visits.length !== visitIds.length) {
      throw new Error("One or more visits are invalid for this tile/org");
    }

    const shift = await tx.routeShift.create({
      data: {
        orgId,
        tileId,
        serviceDate,
        scheduledWindow: window,
        status: RouteShiftStatus.PLANNED,
        primary: primary ?? false,
        plannedStops: visitIds.length,
        createdById: createdById ?? null,
      },
    });

    await tx.serviceVisit.updateMany({
      where: { id: { in: visitIds } },
      data: {
        routeShiftId: shift.id,
      },
    });

    return shift;
  });
}

export async function listRouteShiftsForOrg(options: {
  orgId: string;
  date?: Date | null;
  status?: RouteShiftStatus;
}) {
  const { orgId, date, status } = options;
  return prisma.routeShift.findMany({
    where: {
      orgId,
      ...(date
        ? {
            serviceDate: {
              gte: new Date(date.setHours(0, 0, 0, 0)),
              lt: new Date(date.setHours(23, 59, 59, 999)),
            },
          }
        : {}),
      ...(status ? { status } : {}),
    },
    include: {
      tile: {
        select: { id: true, name: true, slug: true },
      },
      scooperProfile: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      serviceVisits: {
        select: {
          id: true,
          scheduledDate: true,
          status: true,
          assignedToId: true,
        },
      },
    },
    orderBy: [{ serviceDate: "asc" }, { createdAt: "asc" }],
  });
}

export async function claimRouteShift(options: {
  shiftId: string;
  userId: string;
}) {
  const { shiftId, userId } = options;

  return prisma.$transaction(async (tx) => {
    const shift = await tx.routeShift.findUnique({
      where: { id: shiftId },
      include: {
        scooperProfile: true,
        serviceVisits: true,
        org: { select: { id: true } },
      },
    });

    if (!shift) throw new Error("shift_not_found");
    if (shift.status !== RouteShiftStatus.PLANNED) {
      throw new Error("shift_not_available");
    }

    const profile = await tx.scooperProfile.findUnique({
      where: { userId },
      select: { id: true, status: true },
    });

    if (!profile || profile.status !== ScooperStatus.CERTIFIED) {
      throw new Error("scooper_not_certified");
    }

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { orgId: true },
    });

    if (!user?.orgId || user.orgId !== shift.orgId) {
      throw new Error("unauthorized");
    }

    await tx.routeShift.update({
      where: { id: shiftId },
      data: {
        status: RouteShiftStatus.ACTIVE,
        scooperId: userId,
        scooperProfileId: profile.id,
        activatedAt: new Date(),
      },
    });

    await tx.serviceVisit.updateMany({
      where: {
        routeShiftId: shiftId,
      },
      data: {
        assignedToId: userId,
      },
    });
  });
}

export async function completeRouteShift(options: {
  shiftId: string;
  userId: string;
  actualMiles?: number;
}) {
  const { shiftId, userId, actualMiles } = options;

  return prisma.$transaction(async (tx) => {
    const shift = await tx.routeShift.findUnique({
      where: { id: shiftId },
      select: {
        status: true,
        scooperId: true,
        orgId: true,
      },
    });

    if (!shift) throw new Error("shift_not_found");
    if (shift.scooperId !== userId) throw new Error("not_assigned");

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { orgId: true },
    });

    if (!user?.orgId || user.orgId !== shift.orgId) {
      throw new Error("unauthorized");
    }

    await tx.routeShift.update({
      where: { id: shiftId },
      data: {
        status: RouteShiftStatus.COMPLETED,
        actualMiles: actualMiles ?? null,
        completedAt: new Date(),
      },
    });

    await tx.serviceVisit.updateMany({
      where: {
        routeShiftId: shiftId,
        status: ServiceStatus.SCHEDULED,
      },
      data: {
        status: ServiceStatus.SCHEDULED,
      },
    });
  });
}

export async function cancelRouteShift(options: {
  shiftId: string;
  reason?: string;
}) {
  const { shiftId, reason } = options;

  return prisma.$transaction(async (tx) => {
    await tx.routeShift.update({
      where: { id: shiftId },
      data: {
        status: RouteShiftStatus.CANCELLED,
        cancelledAt: new Date(),
        notes: reason ?? null,
      },
    });

    await tx.serviceVisit.updateMany({
      where: { routeShiftId: shiftId },
      data: {
        routeShiftId: null,
      },
    });
  });
}
