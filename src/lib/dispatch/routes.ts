import {
  Prisma,
  RouteStopStatus,
  RouteStop,
  ServiceStatus,
  Frequency,
} from "@prisma/client";

import { enqueueOfferPublishing } from "@/lib/jobs/marketplaceOfferPublisher";
import { info, warn } from "@/lib/log";
import { prisma } from "@/lib/prisma";
import { addDays, startOfDay } from "./frequency";
import { ensureDispatchSchema } from "./schema-guard";
import {
  extractPreferredTimeWindow,
  normalizePreferredTimeWindowSlug,
  resolvePreferredTimeWindowLabel,
  type PreferredTimeWindowSlug,
} from "@/lib/time-window";
import { fetchDistanceMatrix } from "@/lib/google/maps";
import { ensureVisitGeoSnapshot } from "@/lib/dispatch/geo";
import {
  sendScooperProfileEmail,
  type ScooperProfileEmailPayload,
} from "@/lib/emails/scooper-profile";
import { collectScooperProfileEmails } from "@/lib/dispatch/scooper-profile";

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371e3; // metres
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;

  const sinΔφ = Math.sin(Δφ / 2);
  const sinΔλ = Math.sin(Δλ / 2);
  const value =
    sinΔφ * sinΔφ + Math.cos(φ1) * Math.cos(φ2) * sinΔλ * sinΔλ;
  const c = 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
  return R * c;
}

export interface CreateRouteInput {
  orgId: string;
  scheduledDate: Date;
  dispatcherId?: string | null;
  technicianId?: string | null;
  templateId?: string | null;
  name?: string | null;
  notes?: string | null;
  visitIds?: string[];
}

export async function createRouteInstanceWithStops(input: CreateRouteInput) {
  const {
    orgId,
    scheduledDate,
    dispatcherId,
    technicianId,
    templateId,
    name,
    notes,
    visitIds = [],
  } = input;

  await ensureDispatchSchema();

  return prisma.$transaction(async (tx) => {
    const route = await tx.routeInstance.create({
      data: {
        orgId,
        templateId: templateId ?? undefined,
        dispatcherId: dispatcherId ?? undefined,
        technicianId: technicianId ?? undefined,
        scheduledDate: startOfDay(scheduledDate),
        status: "DRAFT",
        optimizationState: "IDLE",
        date: startOfDay(scheduledDate),
        notes: notes ?? undefined,
      },
    });

    if (visitIds.length) {
      const visits = await tx.serviceVisit.findMany({
        where: {
          id: { in: visitIds },
          orgId,
        },
        select: {
          id: true,
          orgId: true,
          jobId: true,
        },
      });

      if (visits.length !== visitIds.length) {
        throw new Error("Some service visits were not found for this org");
      }

      let position = 0;
      for (const visitId of visitIds) {
        await tx.routeStop.create({
          data: {
            orgId,
            routeInstanceId: route.id,
            serviceVisitId: visitId,
            position: position++,
            status: RouteStopStatus.PENDING,
          },
        });
      }
    }

    return tx.routeInstance.findUnique({
      where: { id: route.id },
      include: {
        stops: {
          orderBy: { position: "asc" },
          include: {
            serviceVisit: true,
          },
        },
      },
    });
  });
}

export interface ListRoutesOptions {
  orgId: string;
  from?: Date;
  to?: Date;
}

export async function listRouteInstances(options: ListRoutesOptions) {
  const { orgId, from, to } = options;
  await ensureDispatchSchema();
  return prisma.routeInstance.findMany({
    where: {
      orgId,
      scheduledDate: {
        gte: from ? startOfDay(from) : undefined,
        lt: to ? addDays(startOfDay(to), 1) : undefined,
      },
    },
    orderBy: { scheduledDate: "asc" },
    include: {
      technician: {
        select: {
          id: true,
          name: true,
        },
      },
      dispatcher: {
        select: {
          id: true,
          name: true,
        },
      },
      stops: {
        orderBy: { position: "asc" },
        include: {
          technician: {
            select: {
              id: true,
              name: true,
            },
          },
          serviceVisit: {
            include: {
              customer: {
                select: {
                  id: true,
                  name: true,
                  addressLine1: true,
                  city: true,
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
          },
        },
      },
    },
  });
}

interface StopCoordinate {
  visitId: string;
  lat: number;
  lng: number;
  scheduledDate: Date;
  routeId?: string;
  frequency?: Frequency | null;
  windowSlug?: PreferredTimeWindowSlug | null;
}

export interface RouteSuggestion {
  type: "existing" | "new";
  scheduledDate: string;
  visitIds: string[];
  routeId?: string;
  routeName?: string;
  distanceMeters?: number;
  frequency?: Frequency | null;
  windowSlug?: PreferredTimeWindowSlug | null;
  windowLabel?: string | null;
  durationSeconds?: number;
}

interface SuggestionOptions {
  orgId: string;
  from?: Date;
  to?: Date;
}

const MAX_ASSIGN_DISTANCE_METERS = 8000;
const NEW_ROUTE_RADIUS_METERS = 5000;
const MAX_CLUSTER_SIZE = 8;

function centroidDistance(
  target: StopCoordinate,
  routeStops: StopCoordinate[],
): number {
  if (!routeStops.length) return Number.POSITIVE_INFINITY;
  const avg = routeStops.reduce(
    (acc, stop) => ({
      lat: acc.lat + stop.lat,
      lng: acc.lng + stop.lng,
    }),
    { lat: 0, lng: 0 },
  );
  avg.lat /= routeStops.length;
  avg.lng /= routeStops.length;
  return haversine(avg, target);
}

export async function computeRouteSuggestions(
  options: SuggestionOptions,
): Promise<RouteSuggestion[]> {
  const { orgId, from, to } = options;

  await ensureDispatchSchema();

  const [routes, unassignedVisits] = await Promise.all([
    listRouteInstances({ orgId, from, to }),
    prisma.serviceVisit.findMany({
      where: {
        orgId,
        status: ServiceStatus.SCHEDULED,
        routeStop: null,
        scheduledDate: {
          gte: from ? startOfDay(from) : undefined,
          lt: to ? addDays(startOfDay(to ?? new Date()), 1) : undefined,
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
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
      orderBy: { scheduledDate: "asc" },
    }),
  ]);

  const suggestions: RouteSuggestion[] = [];

  const routeCoordinateMap = await Promise.all(
    routes.map(async (route) => {
      const stops = (
        await Promise.all(
          route.stops.map(async (stop) => {
            const visit = stop.serviceVisit;
            if (!visit || !visit.customer) return null;
            try {
              const geo = await ensureVisitGeoSnapshot({
                orgId,
                customer: visit.customer,
                visit,
              });

              const { slug: windowSlug } = extractPreferredTimeWindow(
                visit.metadata,
              );

              return {
                visitId: stop.serviceVisitId!,
                lat: geo.latitude,
                lng: geo.longitude,
                scheduledDate: new Date(visit.scheduledDate),
                routeId: route.id,
                frequency: visit.job?.frequency ?? null,
                windowSlug,
            } satisfies StopCoordinate;
            } catch (error) {
              console.warn(
                "[dispatch] Unable to resolve coordinates for stop",
                stop.serviceVisitId,
                error,
              );
              return null;
            }
          }),
        )
      ).filter(Boolean) as StopCoordinate[];

      const frequencyCounts = new Map<Frequency, number>();
      stops.forEach((stop) => {
        if (stop.frequency) {
          frequencyCounts.set(
            stop.frequency,
            (frequencyCounts.get(stop.frequency) ?? 0) + 1,
          );
        }
      });
      const dominantFrequency = Array.from(frequencyCounts.entries()).sort(
        (a, b) => b[1] - a[1],
      )[0]?.[0];

      const windowCounts = new Map<PreferredTimeWindowSlug, number>();
      stops.forEach((stop) => {
        if (stop.windowSlug) {
          windowCounts.set(
            stop.windowSlug,
            (windowCounts.get(stop.windowSlug) ?? 0) + 1,
          );
        }
      });
      const dominantWindowSlug = Array.from(windowCounts.entries()).sort(
        (a, b) => b[1] - a[1],
      )[0]?.[0];

      const centroid = (() => {
        if (!stops.length) return null;
        const total = stops.reduce(
          (acc, stop) => ({ lat: acc.lat + stop.lat, lng: acc.lng + stop.lng }),
          { lat: 0, lng: 0 },
        );
        return {
          lat: total.lat / stops.length,
          lng: total.lng / stops.length,
        };
      })();

      return {
        route,
        stops,
        routeName:
          ((route as any).name as string | undefined)?.trim() ||
          route.technician?.name ||
          route.dispatcher?.name ||
          "Route",
        dominantFrequency,
        dominantWindowSlug: dominantWindowSlug ?? null,
        centroid,
      };
    }),
  );

  const visitCoordinates = (
    await Promise.all(
      unassignedVisits.map(async (visit) => {
        if (!visit.customer) return null;
        try {
          const geo = await ensureVisitGeoSnapshot({
            orgId,
            customer: visit.customer,
            visit,
          });
          const { slug: windowSlug } = extractPreferredTimeWindow(visit.metadata);
          return {
            visitId: visit.id,
            lat: geo.latitude,
            lng: geo.longitude,
            scheduledDate: new Date(visit.scheduledDate),
            frequency: visit.job?.frequency ?? null,
            windowSlug,
          } satisfies StopCoordinate;
        } catch (error) {
          console.warn(
            "[dispatch] Unable to resolve coordinates for visit",
            visit.id,
            error,
          );
          return null;
        }
      }),
    )
  ).filter(Boolean) as StopCoordinate[];

  const googleTravelMatrix = new Map<string, { distanceMeters: number; durationSeconds: number }>();

  const destinationStrings: string[] = [];
  const destinationRouteIndex: number[] = [];
  routeCoordinateMap.forEach((entry, routeIndex) => {
    if (!entry.centroid) return;
    destinationStrings.push(`${entry.centroid.lat},${entry.centroid.lng}`);
    destinationRouteIndex.push(routeIndex);
  });

  const originStrings = visitCoordinates.map(
    (visit) => `${visit.lat},${visit.lng}`,
  );

  if (originStrings.length && destinationStrings.length) {
    try {
      const matrixResponse = await fetchDistanceMatrix(originStrings, destinationStrings, {
        travelMode: "driving",
      });

      matrixResponse.matrix.forEach((row, originIndex) => {
        row.forEach((cell, destIndex) => {
          if (!cell) return;
          const routeIndex = destinationRouteIndex[destIndex];
          const key = `${originIndex}:${routeIndex}`;
          googleTravelMatrix.set(key, {
            distanceMeters: cell.distanceMeters,
            durationSeconds: cell.durationSeconds,
          });
        });
      });
    } catch (error) {
      console.warn("[dispatch] Google Distance Matrix unavailable", error);
    }
  }

  const assignedToExisting = new Set<string>();

  visitCoordinates.forEach((visitStop, visitIndex) => {
    let bestRoute:
      | {
          routeId: string;
          distance: number;
          routeName: string;
          frequency: Frequency | null;
          windowSlug: PreferredTimeWindowSlug | null;
          durationSeconds?: number;
        }
      | null = null;
    routeCoordinateMap.forEach(
      ({ route, stops, routeName, dominantFrequency, dominantWindowSlug, centroid }, routeMapIndex) => {
        if (!stops.length) return;
        if (
          startOfDay(new Date(route.scheduledDate)).getTime() !==
          startOfDay(visitStop.scheduledDate).getTime()
        ) {
          return;
        }
        if (
          dominantFrequency &&
          visitStop.frequency &&
          dominantFrequency !== visitStop.frequency
        ) {
          return;
        }
        if (
          dominantWindowSlug &&
          visitStop.windowSlug &&
          dominantWindowSlug !== visitStop.windowSlug
        ) {
          return;
        }
        const distanceKey = `${visitIndex}:${routeMapIndex}`;
        const travel = googleTravelMatrix.get(distanceKey);
        const distance = travel
          ? travel.distanceMeters
          : centroid
            ? haversine(
                { lat: visitStop.lat, lng: visitStop.lng },
                centroid,
              )
            : centroidDistance(visitStop, stops);
        if (distance < MAX_ASSIGN_DISTANCE_METERS) {
          if (!bestRoute || distance < bestRoute.distance) {
            bestRoute = {
              routeId: route.id,
              distance,
              routeName,
              frequency: dominantFrequency ?? null,
              windowSlug: dominantWindowSlug ?? visitStop.windowSlug ?? null,
              durationSeconds: travel?.durationSeconds,
            };
          }
        }
      },
    );
    if (bestRoute) {
      const { routeId, distance, routeName, frequency, windowSlug, durationSeconds } = bestRoute;
      const existing = suggestions.find(
        (s) => s.type === "existing" && s.routeId === routeId,
      );
      if (existing) {
        existing.visitIds.push(visitStop.visitId);
        existing.distanceMeters = Math.min(
          existing.distanceMeters ?? Number.POSITIVE_INFINITY,
          distance,
        );
        existing.frequency =
          existing.frequency ?? frequency ?? visitStop.frequency ?? null;
        if (!existing.windowSlug) {
          existing.windowSlug = windowSlug ?? visitStop.windowSlug ?? null;
          existing.windowLabel = resolvePreferredTimeWindowLabel(
            existing.windowSlug,
            null,
          );
        }
        if (!existing.routeName) {
          existing.routeName = routeName;
        }
        if (durationSeconds && (existing as any).durationSeconds == null) {
          (existing as any).durationSeconds = durationSeconds;
        }
      } else {
        suggestions.push({
          type: "existing",
          scheduledDate: visitStop.scheduledDate.toISOString(),
          routeId,
          routeName,
          visitIds: [visitStop.visitId],
          distanceMeters: distance,
          frequency: frequency ?? visitStop.frequency ?? null,
          windowSlug: windowSlug ?? visitStop.windowSlug ?? null,
          windowLabel: resolvePreferredTimeWindowLabel(
            windowSlug ?? visitStop.windowSlug ?? null,
            null,
          ),
          ...(durationSeconds ? { durationSeconds } : {}),
        });
      }
      assignedToExisting.add(visitStop.visitId);
    }
  });

  const remainingVisits = visitCoordinates.filter(
    (visit) => !assignedToExisting.has(visit.visitId),
  );

  const remainingByDate = new Map<string, StopCoordinate[]>();
  remainingVisits.forEach((visit) => {
    const dateKey = startOfDay(visit.scheduledDate).getTime();
    const freqKey = visit.frequency ?? "UNKNOWN";
    const windowKey = visit.windowSlug ?? "UNKNOWN";
    const compositeKey = `${dateKey}:${freqKey}:${windowKey}`;
    if (!remainingByDate.has(compositeKey)) {
      remainingByDate.set(compositeKey, []);
    }
    remainingByDate.get(compositeKey)!.push(visit);
  });

  remainingByDate.forEach((stops, compositeKey) => {
    const [datePart, freqPart, windowPart] = compositeKey.split(":");
    const dateStarts = new Date(Number.parseInt(datePart, 10));
    const clusterFrequency =
      freqPart && freqPart !== "UNKNOWN"
        ? (freqPart as Frequency)
        : null;
    const clusterWindowSlug = normalizePreferredTimeWindowSlug(
      windowPart && windowPart !== "UNKNOWN" ? windowPart : null,
    );
    const queue = [...stops];
    queue.sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());

    while (queue.length) {
      const seed = queue.shift()!;
      const cluster = [seed];
      const remaining = [] as StopCoordinate[];
      queue.forEach((candidate) => {
        if (cluster.length >= MAX_CLUSTER_SIZE) {
          remaining.push(candidate);
          return;
        }
        const distance = haversine(seed, candidate);
        if (distance <= NEW_ROUTE_RADIUS_METERS) {
          cluster.push(candidate);
        } else {
          remaining.push(candidate);
        }
      });
      queue.splice(0, queue.length, ...remaining);

      if (cluster.length >= 2) {
        const routeName = clusterWindowSlug
          ? `${clusterWindowSlug.replace(/-/g, " ")} draft`
          : "Proposed route";
        suggestions.push({
          type: "new",
          scheduledDate: dateStarts.toISOString(),
          visitIds: cluster.map((stop) => stop.visitId),
          frequency: clusterFrequency,
          windowSlug: clusterWindowSlug,
          windowLabel: resolvePreferredTimeWindowLabel(clusterWindowSlug, null),
          routeName,
        });
      }
    }
  });

  suggestions.sort((a, b) => {
    const dateDiff =
      new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
    if (dateDiff !== 0) return dateDiff;
    if (a.type === b.type) return 0;
    return a.type === "existing" ? -1 : 1;
  });

  return suggestions;
}

export interface ResequenceStopInput {
  stopId: string;
  position: number;
  scheduledArrival?: Date | null;
  scheduledDeparture?: Date | null;
}

export async function resequenceRouteStops(
  routeInstanceId: string,
  updates: ResequenceStopInput[],
) {
  if (!updates.length) return;

  await ensureDispatchSchema();

  await prisma.$transaction(async (tx) => {
    for (const update of updates) {
      await tx.routeStop.update({
        where: {
          id: update.stopId,
          routeInstanceId,
        },
        data: {
          position: update.position,
          scheduledArrival: update.scheduledArrival ?? undefined,
          scheduledDeparture: update.scheduledDeparture ?? undefined,
        },
      });
    }
  });
}

export async function assignTechnicianToStop(
  routeInstanceId: string,
  stopId: string,
  technicianId: string | null,
) {
  await ensureDispatchSchema();

  const scooperEmails: ScooperProfileEmailPayload[] = [];

  const result = await prisma.$transaction(async (tx) => {
    const stop = await tx.routeStop.update({
      where: {
        id: stopId,
        routeInstanceId,
      },
      data: {
        technicianId: technicianId ?? undefined,
      },
      include: {
        serviceVisit: true,
      },
    });

    if (stop.serviceVisitId) {
      await tx.serviceVisit.update({
        where: { id: stop.serviceVisitId },
        data: { assignedToId: technicianId ?? null },
      });

      if (technicianId) {
        const payloads = await collectScooperProfileEmails(tx, [stop.serviceVisitId]);
        if (payloads.length) {
          scooperEmails.push(...payloads);
        }
      }
    }

    return stop;
  });

  if (scooperEmails.length) {
    for (const payload of scooperEmails) {
      try {
        await sendScooperProfileEmail(payload);
      } catch (error) {
        console.error(
          "dispatch.scooper-profile-email.stop",
          {
            to: payload.toEmail,
            scheduledDate: payload.scheduledDate.toISOString(),
          },
          error,
        );
      }
    }
  }

  return result;
}

export async function assignTechnicianToRoute(
  routeInstanceId: string,
  technicianId: string | null,
) {
  await ensureDispatchSchema();

  const scooperEmails: ScooperProfileEmailPayload[] = [];

  const result = await prisma.$transaction(async (tx) => {
    const stops = await tx.routeStop.findMany({
      where: { routeInstanceId },
      select: { id: true, serviceVisitId: true },
    });

    await tx.routeInstance.update({
      where: { id: routeInstanceId },
      data: { technicianId: technicianId ?? undefined },
    });

    if (stops.length) {
      await tx.routeStop.updateMany({
        where: { routeInstanceId },
        data: { technicianId: technicianId ?? undefined },
      });

      const visitIds = stops
        .map((stop) => stop.serviceVisitId)
        .filter((id): id is string => Boolean(id));

      if (visitIds.length) {
        await tx.serviceVisit.updateMany({
          where: { id: { in: visitIds } },
          data: { assignedToId: technicianId ?? null },
        });

        if (technicianId) {
          const payloads = await collectScooperProfileEmails(tx, visitIds);
          if (payloads.length) {
            scooperEmails.push(...payloads);
          }
        }
      }
    }

    return tx.routeInstance.findUnique({
      where: { id: routeInstanceId },
      include: {
        technician: {
          select: {
            id: true,
            name: true,
          },
        },
        dispatcher: {
          select: {
            id: true,
            name: true,
          },
        },
        stops: {
          orderBy: { position: "asc" },
          include: {
            technician: {
              select: {
                id: true,
                name: true,
              },
            },
            serviceVisit: {
              include: {
                customer: {
                  select: {
                    id: true,
                    name: true,
                    addressLine1: true,
                    city: true,
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
            },
          },
        },
      },
    });
  });

  if (scooperEmails.length) {
    for (const payload of scooperEmails) {
      try {
        await sendScooperProfileEmail(payload);
      } catch (error) {
        console.error(
          "dispatch.scooper-profile-email.route",
          {
            to: payload.toEmail,
            scheduledDate: payload.scheduledDate.toISOString(),
          },
          error,
        );
      }
    }
  }

  return result;
}

export async function autoAssignVisitToRoute(visitId: string) {
  await ensureDispatchSchema();

  const visit = await prisma.serviceVisit.findUnique({
    where: { id: visitId },
    include: {
      routeStop: {
        include: {
          routeInstance: {
            include: {
              technician: {
                select: {
                  id: true,
                  name: true,
                },
              },
              dispatcher: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
      job: {
        select: {
          orgId: true,
          tile: {
            select: {
              slug: true,
            },
          },
        },
      },
      customer: {
        select: {
          latitude: true,
          longitude: true,
          id: true,
        },
      },
    },
  });

  if (!visit) {
    throw new Error("Service visit not found");
  }

  if (visit.routeStop?.routeInstanceId) {
    return prisma.routeInstance.findUnique({
      where: { id: visit.routeStop.routeInstanceId },
      include: {
        stops: {
          orderBy: { position: "asc" },
          include: { serviceVisit: true },
        },
      },
    });
  }

  const orgId = visit.orgId || visit.job?.orgId;
  if (!orgId) {
    return null;
  }

  const tileSlug = visit.job?.tile?.slug ?? null;
  const isWeekend = [0, 6].includes(visit.scheduledDate.getUTCDay());

  const start = startOfDay(visit.scheduledDate);
  const end = addDays(start, 1);

  const existingRoutes = await prisma.routeInstance.findMany({
    where: {
      orgId,
      scheduledDate: {
        gte: start,
        lt: end,
      },
    },
    include: {
      stops: {
        include: {
          serviceVisit: {
            include: {
              customer: {
                select: {
                  latitude: true,
                  longitude: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const routesWithTechnicians = existingRoutes.filter((route) => route.technicianId);

  if (
    isWeekend &&
    existingRoutes.length > 0 &&
    routesWithTechnicians.length === 0
  ) {
    warn("dispatch.autoAssign", {
      orgId,
      visitId,
      scheduledDate: visit.scheduledDate.toISOString(),
      reason: "weekend-routes-without-technicians",
      routesEvaluated: existingRoutes.length,
    });

    if (tileSlug) {
      await enqueueOfferPublishing({
        orgId,
        tileSlugs: [tileSlug],
        lookaheadDays: 3,
      });
    }
  }

  const lat = visit.customer?.latitude;
  const lng = visit.customer?.longitude;

  const candidateRoutes = existingRoutes
    .map((route) => {
      if (!route.stops.length) {
          return {
            route,
            score: 0,
            stopCount: route.stops.length,
          };
      }
      const distances = route.stops
        .map((stop) => {
          const stopLat = stop.serviceVisit?.customer?.latitude;
          const stopLng = stop.serviceVisit?.customer?.longitude;
          if (
            typeof stopLat === "number" &&
            typeof stopLng === "number" &&
            typeof lat === "number" &&
            typeof lng === "number"
          ) {
            return haversine({ lat, lng }, { lat: stopLat, lng: stopLng });
          }
          return Number.POSITIVE_INFINITY;
        })
        .filter((distance) => Number.isFinite(distance));

      if (!distances.length) {
        return {
          route,
          score: Number.POSITIVE_INFINITY,
          stopCount: route.stops.length,
        };
      }

      const avg = distances.reduce((sum, current) => sum + current, 0) /
        distances.length;
      return {
        route,
        score: avg,
        stopCount: route.stops.length,
      };
    })
    .sort((a, b) => a.score - b.score);

  if (candidateRoutes.length) {
    info("dispatch.autoAssign.candidates", {
      orgId,
      visitId,
      totalRoutes: existingRoutes.length,
      scored: candidateRoutes.length,
      bestScore: candidateRoutes[0].score,
      bestRouteId: candidateRoutes[0].route.id,
      bestStopCount: candidateRoutes[0].stopCount,
      weekend: isWeekend,
    });
  }

  if (!candidateRoutes.length || candidateRoutes[0].score === Number.POSITIVE_INFINITY) {
    const created = await createRouteInstanceWithStops({
      orgId,
      scheduledDate: visit.scheduledDate,
      visitIds: [visitId],
    });

    const fallbackPayload = {
      orgId,
      visitId,
      scheduledDate: visit.scheduledDate.toISOString(),
      reason: !candidateRoutes.length
        ? "no-candidate-routes"
        : "missing-geo-coordinates",
      weekend: isWeekend,
      existingRoutes: existingRoutes.length,
    };

    if (isWeekend) {
      warn("dispatch.autoAssign", fallbackPayload);
    } else {
      info("dispatch.autoAssign", fallbackPayload);
    }

    if (isWeekend && tileSlug) {
      await enqueueOfferPublishing({
        orgId,
        tileSlugs: [tileSlug],
        lookaheadDays: 3,
      });
    }

    return created;
  }

  const targetRoute = candidateRoutes[0].route;

  await prisma.routeStop.create({
    data: {
      orgId,
      routeInstanceId: targetRoute.id,
      serviceVisitId: visitId,
      position: targetRoute.stops.length,
      status: RouteStopStatus.PENDING,
    },
  });

  if (isWeekend && !targetRoute.technicianId) {
    warn("dispatch.autoAssign", {
      orgId,
      visitId,
      scheduledDate: visit.scheduledDate.toISOString(),
      reason: "assigned-to-technicianless-route",
      routeId: targetRoute.id,
      stopCount: targetRoute.stops.length + 1,
    });

    if (tileSlug) {
      await enqueueOfferPublishing({
        orgId,
        tileSlugs: [tileSlug],
        lookaheadDays: 3,
      });
    }
  }

  return optimizeRouteInstance(targetRoute.id);
}

export async function attachVisitToRoute(
  routeInstanceId: string,
  visitId: string,
  position?: number,
) {
  await ensureDispatchSchema();

  const route = await prisma.routeInstance.findUnique({
    where: { id: routeInstanceId },
    select: { orgId: true, stops: { select: { id: true }, orderBy: { position: "asc" } } },
  });

  if (!route) {
    throw new Error("Route not found");
  }

  const existingStop = await prisma.routeStop.findFirst({
    where: { routeInstanceId, serviceVisitId: visitId },
  });
  if (existingStop) {
    return existingStop;
  }

  const insertPosition = typeof position === "number" ? position : route.stops.length;

  const stop = await prisma.routeStop.create({
    data: {
      orgId: route.orgId,
      routeInstanceId,
      serviceVisitId: visitId,
      position: insertPosition,
      status: RouteStopStatus.PENDING,
    },
  });

  if (insertPosition < route.stops.length) {
    const updates = route.stops
      .map((stopEntry, idx) => ({ stopId: stopEntry.id, position: idx >= insertPosition ? idx + 1 : idx }))
      .concat([{ stopId: stop.id, position: insertPosition }]);
    await resequenceRouteStops(routeInstanceId, updates);
  }

  return stop;
}

export async function moveStopToRoute(
  stopId: string,
  destinationRouteId: string,
  position?: number,
  scheduledDate?: Date,
) {
  await ensureDispatchSchema();

  return prisma.$transaction(async (tx) => {
    const stop = await tx.routeStop.findUnique({
      where: { id: stopId },
      include: {
        routeInstance: {
          include: {
            stops: { select: { id: true }, orderBy: { position: "asc" } },
          },
        },
      },
    });

    if (!stop || !stop.routeInstanceId) {
      throw new Error("Stop not found");
    }

    // remove from original route order
    const sourceRouteInstance = stop.routeInstance;
    if (!sourceRouteInstance) {
      throw new Error("Stop route details missing");
    }
    const sourceStops = sourceRouteInstance.stops.filter((s) => s.id !== stopId);
    
    // Update source stops positions in the same transaction
    for (const [idx, s] of sourceStops.entries()) {
      await tx.routeStop.update({
        where: { id: s.id, routeInstanceId: stop.routeInstanceId },
        data: { position: idx },
      });
    }

    const targetRoute = await tx.routeInstance.findUnique({
      where: { id: destinationRouteId },
      include: {
        stops: { select: { id: true }, orderBy: { position: "asc" } },
      },
    });

    if (!targetRoute) {
      throw new Error("Destination route not found");
    }

    const insertPosition =
      typeof position === "number" ? position : targetRoute.stops.length;

    const updatedStop = await tx.routeStop.update({
      where: { id: stopId },
      data: {
        routeInstanceId: destinationRouteId,
        position: insertPosition,
      },
    });

    if (scheduledDate && stop.serviceVisitId) {
      await tx.serviceVisit.update({
        where: { id: stop.serviceVisitId },
        data: {
          scheduledDate,
        },
      });
    }

    if (insertPosition < targetRoute.stops.length) {
      const updates = targetRoute.stops.map((s, idx) => ({
        stopId: s.id,
        position: idx >= insertPosition ? idx + 1 : idx,
      }));
      updates.push({ stopId: stopId, position: insertPosition });
      
      // Update target stops positions in the same transaction
      for (const update of updates) {
        await tx.routeStop.update({
          where: { id: update.stopId, routeInstanceId: destinationRouteId },
          data: { position: update.position },
        });
      }
    }

    return updatedStop;
  });
}

export async function removeStopFromRoute(stopId: string) {
  await ensureDispatchSchema();

  return prisma.$transaction(async (tx) => {
    const stop = await tx.routeStop.findUnique({
      where: { id: stopId },
      include: {
        route: {
          include: {
            stops: { select: { id: true }, orderBy: { position: "asc" } },
          },
        },
      },
    });

    if (!stop || !stop.routeInstanceId) {
      throw new Error("Stop not found");
    }

    const sourceRoute = stop.route;
    if (!sourceRoute) {
      throw new Error("Stop route details missing");
    }

    await tx.routeStop.delete({ where: { id: stopId } });

    const remaining = sourceRoute.stops
      .filter((s) => s.id !== stopId)
      .map((s, idx) => ({ stopId: s.id, position: idx }));

    if (remaining.length) {
      await resequenceRouteStops(stop.routeInstanceId, remaining);
    }

    return stop;
  });
}

interface CoordinateStop {
  stopId: string;
  position: number;
  serviceVisitId: string | null;
  lat: number;
  lng: number;
}

export async function optimizeRouteInstance(routeInstanceId: string) {
  await ensureDispatchSchema();

  const route = await prisma.routeInstance.findUnique({
    where: { id: routeInstanceId },
    include: {
      stops: {
        orderBy: { position: "asc" },
        include: {
          serviceVisit: {
            include: {
              customer: {
                select: {
                  latitude: true,
                  longitude: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!route) {
    throw new Error("Route not found");
  }

  if (!route.stops.length) {
    return route;
  }

  const coordinateStops: CoordinateStop[] = [];
  const remainder: RouteStop[] = [];

  route.stops.forEach((stop) => {
    const lat = stop.serviceVisit?.customer?.latitude;
    const lng = stop.serviceVisit?.customer?.longitude;
    if (
      typeof lat === "number" &&
      typeof lng === "number" &&
      Number.isFinite(lat) &&
      Number.isFinite(lng)
    ) {
      coordinateStops.push({
        stopId: stop.id,
        position: stop.position ?? 0,
        serviceVisitId: stop.serviceVisitId,
        lat,
        lng,
      });
    } else {
      remainder.push(stop);
    }
  });

  if (coordinateStops.length < 2) {
    return route; // Nothing to optimize
  }

  const visited = new Set<string>();
  const ordered: CoordinateStop[] = [];

  // start from current first stop (if it has coordinates) else first coordinate stop
  let current = coordinateStops[0];
  const firstWithZeroPosition = coordinateStops.find(
    (stop) => stop.position === 0,
  );
  if (firstWithZeroPosition) {
    current = firstWithZeroPosition;
  }

  ordered.push(current);
  visited.add(current.stopId);

  while (ordered.length < coordinateStops.length) {
    let best: CoordinateStop | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of coordinateStops) {
      if (visited.has(candidate.stopId)) continue;
      const distance = haversine(current, candidate);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    }
    if (!best) {
      break;
    }
    ordered.push(best);
    visited.add(best.stopId);
    current = best;
  }

  // Append remainder stops (without coordinates) after optimized ones in original relative order
  const orderedStops = ordered.map((stop, index) => ({
    stopId: stop.stopId,
    position: index,
  }));

  remainder.forEach((stop, idx) => {
    orderedStops.push({
      stopId: stop.id,
      position: orderedStops.length + idx,
    });
  });

  await resequenceRouteStops(routeInstanceId, orderedStops);

  return prisma.routeInstance.findUnique({
    where: { id: routeInstanceId },
    include: {
      stops: {
        orderBy: { position: "asc" },
        include: {
          serviceVisit: {
            include: {
              customer: true,
            },
          },
        },
      },
    },
  });
}
