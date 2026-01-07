import { addDays, addMinutes, startOfDay } from "date-fns";

import { prisma } from "@/lib/prisma";
import { ensureVisitGeoSnapshot } from "@/lib/dispatch/geo";
import { Frequency, ServiceStatus } from "@prisma/client";
import { fetchDistanceMatrix } from "@/lib/google/maps";
import { collectScooperProfileEmails } from "@/lib/dispatch/scooper-profile";
import { sendScooperProfileEmail } from "@/lib/emails/scooper-profile";

interface CandidateVisit {
  id: string;
  scheduledDate: Date;
  windowSlug: "morning" | "afternoon";
  latitude: number;
  longitude: number;
  customerId: string;
  jobId: string;
  frequency: Frequency;
}

interface RoutePlan {
  date: Date;
  windowSlug: "morning" | "afternoon";
  visits: CandidateVisit[];
}

const WINDOW_HOURS: Record<"morning" | "afternoon", { start: number; end: number }> = {
  morning: { start: 8, end: 12 },
  afternoon: { start: 12, end: 16 },
};

const MAX_VISITS_PER_WINDOW = 10;
const DEFAULT_TRAVEL_MINUTES = 10;
const SERVICE_MINUTES = 15;

type RouteWithStops = {
  notes: string | null;
  scheduledDate: Date;
  stops: Array<{
    scheduledArrival: Date | null;
    serviceVisit: {
      preferredTimeWindowSlug: string | null;
      scheduledDate: Date | null;
    } | null;
  }>;
};

function inferWindowSlugFromRoute(
  route: RouteWithStops,
  fallback: "morning" | "afternoon" = "morning",
): "morning" | "afternoon" {
  const noteMatch = route.notes?.match(/\[AUTO:(morning|afternoon)\]/);
  if (noteMatch?.[1]) {
    return noteMatch[1] as "morning" | "afternoon";
  }

  let morningCount = 0;
  let afternoonCount = 0;

  route.stops.forEach((stop) => {
    const slug = stop.serviceVisit?.preferredTimeWindowSlug ?? null;
    if (slug === "morning" || slug === "afternoon") {
      if (slug === "morning") morningCount += 1;
      else afternoonCount += 1;
      return;
    }
    const arrival = stop.scheduledArrival ?? stop.serviceVisit?.scheduledDate;
    if (arrival) {
      const hour = new Date(arrival).getHours();
      if (hour >= 12) {
        afternoonCount += 1;
      } else {
        morningCount += 1;
      }
    }
  });

  if (morningCount === 0 && afternoonCount === 0) {
    return fallback;
  }

  return afternoonCount > morningCount ? "afternoon" : "morning";
}

function normalizeWindowSlug(slug: string | null | undefined): "morning" | "afternoon" {
  if (slug === "afternoon") return "afternoon";
  return "morning";
}

async function loadCandidateVisits(orgId: string, anchor: Date, lookAheadDays: number) {
  const start = startOfDay(anchor);
  const to = addDays(start, lookAheadDays + 1);

  const visits = await prisma.serviceVisit.findMany({
    where: {
      orgId,
      status: ServiceStatus.SCHEDULED,
      scheduledDate: {
        gte: start,
        lt: to,
      },
    },
    include: {
      customer: {
        select: {
          id: true,
          addressLine1: true,
          city: true,
          state: true,
          zip: true,
          latitude: true,
          longitude: true,
        },
      },
      job: {
        select: {
          id: true,
          frequency: true,
        },
      },
    },
  });

  const enriched: CandidateVisit[] = [];

  for (const visit of visits) {
    if (!visit.customer) continue;

    const windowSlug = normalizeWindowSlug(
      (visit.metadata as any)?.preferredTimeWindowSlug ?? visit.preferredTimeWindowSlug ?? null,
    );

    const geo = await ensureVisitGeoSnapshot({
      orgId,
      customer: visit.customer,
      visit,
    });

    enriched.push({
      id: visit.id,
      scheduledDate: new Date(visit.scheduledDate),
      latitude: geo.latitude,
      longitude: geo.longitude,
      windowSlug,
      customerId: visit.customerId!,
      jobId: visit.jobId!,
      frequency: visit.job?.frequency ?? Frequency.WEEKLY,
    });
  }

  return enriched;
}

function groupByDateAndWindow(candidates: CandidateVisit[]): RoutePlan[] {
  const map = new Map<string, RoutePlan>();

  candidates.forEach((visit) => {
    const key = `${visit.scheduledDate.toDateString()}:${visit.windowSlug}`;
    if (!map.has(key)) {
      map.set(key, {
        date: new Date(visit.scheduledDate),
        windowSlug: visit.windowSlug,
        visits: [],
      });
    }
    map.get(key)!.visits.push(visit);
  });

  return Array.from(map.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
}

async function sequenceRouteVisits(plan: RoutePlan): Promise<{
  visits: CandidateVisit[];
  travelMinutes: number[];
}> {
  if (plan.visits.length <= 1) {
    return { visits: [...plan.visits], travelMinutes: [0] };
  }

  const naiveOrder = [...plan.visits].sort(
    (a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime(),
  );

  if (plan.visits.length <= 3) {
    const travel = new Array(plan.visits.length).fill(DEFAULT_TRAVEL_MINUTES);
    travel[travel.length - 1] = 0;
    return { visits: naiveOrder, travelMinutes: travel };
  }

  const origins = plan.visits.map((v) => `${v.latitude},${v.longitude}`);

  let matrix;
  try {
    matrix = await fetchDistanceMatrix(origins, origins, { travelMode: "driving" });
  } catch (error) {
    console.warn("[dispatch] Distance matrix unavailable, falling back to naive ordering", error);
    const travel = new Array(plan.visits.length).fill(DEFAULT_TRAVEL_MINUTES);
    travel[travel.length - 1] = 0;
    return { visits: naiveOrder, travelMinutes: travel };
  }

  const remaining = plan.visits.map((_, index) => index);
  const orderedIndices: number[] = [];
  let currentIndex = remaining.shift()!;
  orderedIndices.push(currentIndex);

  while (remaining.length) {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    remaining.forEach((candidateIndex, idx) => {
      const cell = matrix.matrix[currentIndex]?.[candidateIndex];
      if (!cell) return;
      if (cell.distanceMeters < bestDistance) {
        bestDistance = cell.distanceMeters;
        bestIndex = idx;
      }
    });

    currentIndex = remaining.splice(bestIndex, 1)[0];
    orderedIndices.push(currentIndex);
  }

  const ordered = orderedIndices.map((idx) => plan.visits[idx]);
  const travelMinutes = orderedIndices.map((fromIdx, i) => {
    if (i === orderedIndices.length - 1) return 0;
    const toIdx = orderedIndices[i + 1];
    const leg = matrix.matrix[fromIdx]?.[toIdx];
    if (leg?.durationSeconds) {
      return Math.max(5, Math.round(leg.durationSeconds / 60));
    }
    return DEFAULT_TRAVEL_MINUTES;
  });

  return { visits: ordered, travelMinutes };
}

export async function autoGenerateRoutes(
  orgId: string,
  anchor: Date,
  lookAheadDays: number,
  technicianIds: string[] = [],
) {
  const candidates = await loadCandidateVisits(orgId, anchor, lookAheadDays);
  const plans = groupByDateAndWindow(candidates);
  const createdRoutes: string[] = [];
  const scooperProfileVisitIds = new Set<string>();

  const technicianCycle = technicianIds.length ? technicianIds : undefined;
  let technicianCursor = 0;

  const windowKey = (date: Date, windowSlug: "morning" | "afternoon") =>
    `${startOfDay(date).toISOString()}:${windowSlug}`;

  const dayKeyForDate = (date: Date) => startOfDay(date).toISOString();

  const baselineRoutes = await prisma.routeInstance.findMany({
    where: {
      orgId,
      scheduledDate: {
        gte: startOfDay(anchor),
        lt: addDays(startOfDay(anchor), lookAheadDays + 1),
      },
    },
    include: {
      stops: {
        include: {
          serviceVisit: {
            select: {
              id: true,
              preferredTimeWindowSlug: true,
              scheduledDate: true,
            },
          },
        },
      },
    },
  });

  const existingRoutes = await prisma.routeInstance.findMany({
    where: {
      orgId,
      scheduledDate: {
        gte: startOfDay(anchor),
        lt: addDays(startOfDay(anchor), lookAheadDays + 1),
      },
      notes: { contains: "[AUTO:" },
    },
    include: {
      stops: {
        include: {
          serviceVisit: {
            select: {
              id: true,
              preferredTimeWindowSlug: true,
              scheduledDate: true,
            },
          },
        },
      },
    },
  });

  const existingMap = new Map<string, (typeof existingRoutes)[number]>();
  existingRoutes.forEach((route) => {
    const windowSlug = inferWindowSlugFromRoute(route as RouteWithStops);
    existingMap.set(windowKey(route.scheduledDate, windowSlug), route);
  });

  const capacityByTech = new Map<string, Map<string, number>>();

  const adjustCapacity = (techId: string | null | undefined, capacityKey: string, delta: number) => {
    if (!techId || delta === 0) return;
    const techMap = capacityByTech.get(techId) ?? new Map<string, number>();
    const nextValue = (techMap.get(capacityKey) ?? 0) + delta;
    if (nextValue <= 0) {
      techMap.delete(capacityKey);
    } else {
      techMap.set(capacityKey, nextValue);
    }
    if (techMap.size === 0) {
      capacityByTech.delete(techId);
    } else {
      capacityByTech.set(techId, techMap);
    }
  };

  const currentCount = (techId: string, capacityKey: string) =>
    capacityByTech.get(techId)?.get(capacityKey) ?? 0;

  const canAssign = (techId: string, capacityKey: string, additionalStops: number) =>
    currentCount(techId, capacityKey) + additionalStops <= MAX_VISITS_PER_WINDOW;

  const selectTechnician = (
    capacityKey: string,
    stopCount: number,
    preferred?: string | null,
  ): string | undefined => {
    if (preferred && canAssign(preferred, capacityKey, stopCount)) {
      if (technicianCycle && technicianCycle.length) {
        const preferredIndex = technicianCycle.indexOf(preferred);
        if (preferredIndex >= 0) {
          technicianCursor = (preferredIndex + 1) % technicianCycle.length;
        }
      }
      return preferred;
    }

    if (!technicianCycle || technicianCycle.length === 0) {
      return undefined;
    }

    for (let offset = 0; offset < technicianCycle.length; offset += 1) {
      const index = (technicianCursor + offset) % technicianCycle.length;
      const techId = technicianCycle[index];
      if (canAssign(techId, capacityKey, stopCount)) {
        technicianCursor = (index + 1) % technicianCycle.length;
        return techId;
      }
    }

    return undefined;
  };

  baselineRoutes.forEach((route) => {
    if (!route.technicianId) return;
    const dayKey = dayKeyForDate(route.scheduledDate);
    const windowSlug = inferWindowSlugFromRoute(route as RouteWithStops);
    const capacityKey = `${dayKey}:${windowSlug}`;
    adjustCapacity(route.technicianId, capacityKey, route.stops.length);
  });

  existingRoutes.forEach((route) => {
    if (!route.technicianId) return;
    const dayKey = dayKeyForDate(route.scheduledDate);
    const windowSlug = inferWindowSlugFromRoute(route as RouteWithStops);
    const capacityKey = `${dayKey}:${windowSlug}`;
    adjustCapacity(route.technicianId, capacityKey, -route.stops.length);
  });

  for (const plan of plans) {
    if (!plan.visits.length) continue;

    const { visits: visitsSorted, travelMinutes } = await sequenceRouteVisits(plan);
    const window = WINDOW_HOURS[plan.windowSlug];

    const key = windowKey(plan.date, plan.windowSlug);
    const existingRoute = existingMap.get(key);
    const dayKey = dayKeyForDate(plan.date);
    const capacityKey = `${dayKey}:${plan.windowSlug}`;

    const chunkAssignments: Array<{
      visits: CandidateVisit[];
      travel: number[];
      stops: Array<{ visitId: string; scheduledDate: Date }>;
      technicianId?: string;
      useExisting: boolean;
      chunkIndex: number;
    }> = [];

    let startIndex = 0;
    let chunkIndex = 0;
    while (startIndex < visitsSorted.length) {
      const endIndex = Math.min(startIndex + MAX_VISITS_PER_WINDOW, visitsSorted.length);
      const chunkVisits = visitsSorted.slice(startIndex, endIndex);
      const chunkTravel = travelMinutes.slice(startIndex, endIndex);
      const preferredTech = chunkIndex === 0 ? existingRoute?.technicianId ?? undefined : undefined;
      let assignmentTech = selectTechnician(capacityKey, chunkVisits.length, preferredTech);
      if (
        !assignmentTech &&
        preferredTech &&
        canAssign(preferredTech, capacityKey, chunkVisits.length)
      ) {
        assignmentTech = preferredTech;
      }
      if (!assignmentTech && technicianCycle && technicianCycle.length) {
        assignmentTech = technicianCycle
          .filter((techId) => canAssign(techId, capacityKey, chunkVisits.length))
          .sort((a, b) => currentCount(a, capacityKey) - currentCount(b, capacityKey))[0];
      }
      if (assignmentTech) {
        adjustCapacity(assignmentTech, capacityKey, chunkVisits.length);
      }
      chunkAssignments.push({
        visits: chunkVisits,
        travel: chunkTravel,
        stops: [],
        technicianId: assignmentTech,
        useExisting: Boolean(existingRoute) && chunkIndex === 0,
        chunkIndex,
      });
      startIndex = endIndex;
      chunkIndex += 1;
    }

    const chunkCount = chunkAssignments.length;
    const windowStartMinutes = window.start * 60;
    const windowEndMinutes = window.end * 60;
    const windowSpan = Math.max(windowEndMinutes - windowStartMinutes, 240);
    const blockMinutes = chunkCount > 0 ? Math.max(60, Math.floor(windowSpan / chunkCount)) : windowSpan;

    chunkAssignments.forEach((assignment) => {
      const offset = Math.min(
        Math.max(0, windowSpan - blockMinutes),
        assignment.chunkIndex * blockMinutes,
      );
      let cursor = addMinutes(startOfDay(plan.date), windowStartMinutes + offset);
      assignment.stops = assignment.visits.map((visit, index) => {
        const scheduledDate = new Date(cursor.getTime());
        const travelAfter = assignment.travel[index] ?? DEFAULT_TRAVEL_MINUTES;
        cursor = addMinutes(scheduledDate, SERVICE_MINUTES + travelAfter);
        return {
          visitId: visit.id,
          scheduledDate,
        };
      });
    });

    for (const [assignmentIndex, assignment] of chunkAssignments.entries()) {
      if (assignment.useExisting && existingRoute) {
        const existingStops = existingRoute.stops ?? [];
        const existingStopMap = new Map(
          existingStops
            .filter((stop) => stop.serviceVisitId)
            .map((stop) => [stop.serviceVisitId!, stop]),
        );

        const desiredIds = assignment.stops.map((stop) => stop.visitId);
        if (desiredIds.length === 0) {
          continue;
        }
        // Detach from any other routes first to avoid uniqueness conflicts.
        await prisma.routeStop.deleteMany({
          where: {
            serviceVisitId: { in: desiredIds },
            NOT: { routeInstanceId: existingRoute.id },
          },
        });
        const removeIds = existingStops
          .filter((stop) => !desiredIds.includes(stop.serviceVisitId ?? ""))
          .map((stop) => stop.id);
        if (removeIds.length) {
          await prisma.routeStop.deleteMany({ where: { id: { in: removeIds } } });
        }

        const updatePromises: Promise<unknown>[] = [];
        const serviceVisitUpdates: Promise<unknown>[] = [];
        for (const [index, stop] of assignment.stops.entries()) {
          const scheduledArrival = stop.scheduledDate;
          const existing = existingStopMap.get(stop.visitId);
          if (existing) {
            const existingArrival = existing.scheduledArrival
              ? new Date(existing.scheduledArrival)
              : null;
            const arrivalChanged =
              (existingArrival ? existingArrival.getTime() : undefined) !==
              scheduledArrival.getTime();
            const needsUpdate = existing.position !== index || arrivalChanged;
            if (needsUpdate) {
              updatePromises.push(
                prisma.routeStop.update({
                  where: { id: existing.id },
                  data: {
                    position: index,
                    scheduledArrival,
                  },
                }),
              );
            }
          } else {
            updatePromises.push(
              prisma.routeStop.create({
                data: {
                  orgId,
                  routeInstanceId: existingRoute.id,
                  serviceVisitId: stop.visitId,
                  position: index,
                  scheduledArrival,
                },
              }),
            );
          }

          const visitUpdate: Record<string, unknown> = {
            scheduledDate: scheduledArrival,
          };
          if (assignment.technicianId) {
            visitUpdate.assignedToId = assignment.technicianId;
            scooperProfileVisitIds.add(stop.visitId);
          }
          serviceVisitUpdates.push(
            prisma.serviceVisit.update({
              where: { id: stop.visitId },
              data: visitUpdate,
            }),
          );
        }

        if (updatePromises.length) {
          await Promise.all(updatePromises);
        }
        if (serviceVisitUpdates.length) {
          await Promise.all(serviceVisitUpdates);
        }

        const newScheduledDate = assignment.stops[0]?.scheduledDate ?? existingRoute.scheduledDate;
        const desiredTechnicianId =
          assignment.technicianId !== undefined
            ? assignment.technicianId ?? null
            : existingRoute.technicianId ?? null;
        const shouldUpdateRoute =
          (existingRoute.scheduledDate?.getTime() ?? 0) !== newScheduledDate.getTime() ||
          existingRoute.technicianId !== desiredTechnicianId ||
          existingRoute.notes !== `[AUTO:${plan.windowSlug}] ${plan.windowSlug} route`;

        if (shouldUpdateRoute) {
          await prisma.routeInstance.update({
            where: { id: existingRoute.id },
            data: {
              scheduledDate: newScheduledDate,
              notes: `[AUTO:${plan.windowSlug}] ${plan.windowSlug} route`,
              technicianId: desiredTechnicianId,
            },
          });
        }

        createdRoutes.push(existingRoute.id);
      } else {
        const technicianId = assignment.technicianId;
        if (!assignment.stops.length) {
          continue;
        }

        await prisma.routeStop.deleteMany({
          where: {
            serviceVisitId: { in: assignment.stops.map((stop) => stop.visitId) },
          },
        });

        const route = await prisma.routeInstance.create({
          data: {
            orgId,
            date: new Date(plan.date),
            scheduledDate: assignment.stops[0]?.scheduledDate ?? new Date(plan.date),
            status: "PLANNED",
            notes: `[AUTO:${plan.windowSlug}] ${plan.windowSlug} route`,
            ...(technicianId
              ? {
                  technician: {
                    connect: { id: technicianId },
                  },
                }
              : {}),
            stops: {
              create: assignment.stops.map((stop, position) => ({
                serviceVisitId: stop.visitId,
                position,
                scheduledArrival: stop.scheduledDate,
              })),
            },
          },
        });

        const visitUpdates = assignment.stops.map((stop) => {
          const data: Record<string, unknown> = {
            scheduledDate: stop.scheduledDate,
          };
          if (technicianId) {
            data.assignedToId = technicianId;
            scooperProfileVisitIds.add(stop.visitId);
          }
          return prisma.serviceVisit.update({
            where: { id: stop.visitId },
            data,
          });
        });

        if (visitUpdates.length) {
          await Promise.all(visitUpdates);
        }

        createdRoutes.push(route.id);
      }

      if (!existingRoute && assignmentIndex === 0) {
        // no-op placeholder for future naming hooks
      }
    }
  }

  // Remove any empty auto-generated routes left behind by adjustments.
  await prisma.routeInstance.deleteMany({
    where: {
      orgId,
      notes: { contains: "[AUTO:" },
      stops: { none: {} },
    },
  });

  if (scooperProfileVisitIds.size) {
    const payloads = await collectScooperProfileEmails(
      prisma,
      Array.from(scooperProfileVisitIds),
    );

    for (const payload of payloads) {
      try {
        await sendScooperProfileEmail(payload);
      } catch (error) {
        console.error(
          "dispatch.scooper-profile-email.optimizer",
          {
            to: payload.toEmail,
            scheduledDate: payload.scheduledDate.toISOString(),
          },
          error,
        );
      }
    }
  }

  return createdRoutes;
}
