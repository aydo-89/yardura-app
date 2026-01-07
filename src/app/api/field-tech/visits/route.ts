import crypto from "crypto";

import { NextRequest, NextResponse } from "next/server";
import { addDays } from "date-fns";
import { z } from "zod";
import { Frequency, Prisma, ServiceStatus, VisitCompSchedule } from "@prisma/client";

import { getScooperAuth } from "@/lib/auth/scooper";
import { prisma } from "@/lib/prisma";
import { extractPreferredTimeWindow } from "@/lib/time-window";
import { ensureVisitGeoSnapshot } from "@/lib/dispatch/geo";
import {
  constructZonedDate,
  convertUtcToZonedParts,
  isValidTimeZone,
  SERVICE_TIME_ZONE,
} from "@/lib/timezone";
import {
  DEFAULT_MILEAGE_RATE_CENTS,
  DEFAULT_PPE_STIPEND_CENTS,
  estimateVisitPayoutPreview,
  getActiveCompSchedule,
} from "@/lib/marketplace/payouts";
import {
  fetchDistanceMatrix,
  fetchDirectionsRoute,
  geocodeAddress,
} from "@/lib/google/maps";

type MatrixCell = { distanceMeters: number; durationSeconds: number } | null;

type OptimizeAnchor = { lat: number; lng: number };

const ROUTE_PLAN_VERSION = "2026-02-10"; // Bumped to include mileage + PPE in projections
const ROUTE_PLAN_TTL_DAYS = 2;
const CUSTOM_ANCHOR_CREDIT_COST = 1;
const DEFAULT_AVERAGE_SPEED_MPH = 25;
const METERS_PER_SECOND = DEFAULT_AVERAGE_SPEED_MPH * 0.44704;

type OptimizeOptions = {
  start?: OptimizeAnchor | null;
  end?: OptimizeAnchor | null;
};

type OptimizeDailyVisitsResult = {
  visits: any[];
  matrixLookup: Map<string, MatrixCell>;
};

type ScooperMetadata = {
  homeAnchor?: OptimizeAnchor & { address?: string };
  routeCredits?: number;
  [key: string]: unknown;
};

type ScooperWithUser = Prisma.ScooperProfileGetPayload<{
  include: { user: { select: { address: true; city: true; zipCode: true } } };
}>;

type RoutePlanPayload = {
  visits: any[];
  summary: {
    betweenStopsDistanceMeters: number;
    betweenStopsDurationSeconds: number;
    startToFirstDistanceMeters: number;
    startToFirstDurationSeconds: number;
    endToHomeDistanceMeters: number;
    endToHomeDurationSeconds: number;
    totalDistanceMeters: number;
    totalDurationSeconds: number;
  };
};

async function resolveCompSchedule(
  orgId: string,
  frequency: Frequency,
  cache: Map<Frequency, VisitCompSchedule | null>,
) {
  if (cache.has(frequency)) {
    return cache.get(frequency) ?? null;
  }
  const schedule = await getActiveCompSchedule(orgId, frequency);
  cache.set(frequency, schedule ?? null);
  return schedule ?? null;
}

async function attachProjectedPayoutCents(
  visits: any[],
  orgId: string,
  cache: Map<Frequency, VisitCompSchedule | null>,
  homeAnchor?: OptimizeAnchor | null,
) {
  return Promise.all(
    visits.map(async (visit) => {
      const frequency = (visit.job?.frequency as Frequency) ?? Frequency.WEEKLY;
      const schedule = await resolveCompSchedule(orgId, frequency, cache);
      if (!schedule) {
        return { ...visit, projectedPayoutCents: null };
      }
      const travelMeters = visit.travelFromPrevious?.distanceMeters ?? 0;
      let mileageMiles = travelMeters > 0 ? travelMeters / 1609.34 : 0;
      if (!mileageMiles && homeAnchor && visit.geo) {
        const { latitude, longitude } = visit.geo;
        if (typeof latitude === "number" && typeof longitude === "number") {
          mileageMiles = haversineMiles(
            homeAnchor.lat,
            homeAnchor.lng,
            latitude,
            longitude,
          );
        }
      }
      const preview = estimateVisitPayoutPreview({
        schedule,
        revenueCents: typeof visit.revenueCents === "number" ? visit.revenueCents : null,
        metadata: visit.metadata ?? null,
        deodorize: visit.deodorize ?? false,
        mileageMiles,
        mileageRateCents: DEFAULT_MILEAGE_RATE_CENTS,
        ppeStipendCents: DEFAULT_PPE_STIPEND_CENTS,
      });
      return { ...visit, projectedPayoutCents: preview.totalAmountCents };
    }),
  );
}

function parseLatLng(value: string): OptimizeAnchor | null {
  const [latRaw, lngRaw] = value.split(",").map((part) => Number(part.trim()));
  if ([latRaw, lngRaw].some((val) => Number.isNaN(val))) {
    return null;
  }
  return { lat: latRaw, lng: lngRaw };
}

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const earthRadius = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  return haversineMeters(lat1, lng1, lat2, lng2) / 1609.34;
}

function estimateLeg(origin: string, destination: string): MatrixCell {
  const start = parseLatLng(origin);
  const end = parseLatLng(destination);
  if (!start || !end) return null;
  const distanceMeters = haversineMeters(start.lat, start.lng, end.lat, end.lng);
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) {
    return null;
  }
  const durationSeconds = Math.max(60, Math.round(distanceMeters / METERS_PER_SECOND));
  return { distanceMeters, durationSeconds };
}

function parseScooperMetadata(metadata: Prisma.JsonValue | null): ScooperMetadata {
  if (!metadata || typeof metadata !== "object") {
    return {};
  }
  return metadata as ScooperMetadata;
}

function normalizeAnchor(anchor: OptimizeAnchor | null | undefined): OptimizeAnchor | null {
  if (!anchor) return null;
  return {
    lat: Number(anchor.lat.toFixed(6)),
    lng: Number(anchor.lng.toFixed(6)),
  };
}

function anchorsMatch(a?: OptimizeAnchor | null, b?: OptimizeAnchor | null) {
  if (!a || !b) return false;
  return Math.abs(a.lat - b.lat) < 1e-5 && Math.abs(a.lng - b.lng) < 1e-5;
}

function normalizeAddressPart(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function buildCustomerAddressKey(customer?: {
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
} | null): string | null {
  if (!customer) return null;
  const parts = [
    normalizeAddressPart(customer.addressLine1),
    normalizeAddressPart(customer.city),
    normalizeAddressPart(customer.state),
    normalizeAddressPart(customer.zip),
  ].filter((part) => part.length > 0);
  return parts.length ? parts.join("|") : null;
}

async function optimizeDailyVisits(
  visits: any[],
  options: OptimizeOptions = {},
): Promise<OptimizeDailyVisitsResult> {
  const geocoded = visits.filter((visit) => visit.geo);
  const withoutGeo = visits.filter((visit) => !visit.geo);

  const matrixLookup = new Map<string, MatrixCell>();

  if (geocoded.length <= 1) {
    return { visits: [...geocoded, ...withoutGeo], matrixLookup };
  }

  try {
    const coords = geocoded.map((visit) => `${visit.geo!.latitude},${visit.geo!.longitude}`);
    const matrix = await fetchDistanceMatrix(coords, coords, {
      travelMode: "driving",
    });

    let startIndex: number | null = null;
    if (options.start) {
      try {
        const startResponse = await fetchDistanceMatrix(
          [`${options.start.lat},${options.start.lng}`],
          coords,
          { travelMode: "driving" },
        );
        const row = startResponse.matrix[0] ?? [];
        let bestDistance = Number.POSITIVE_INFINITY;
        row.forEach((cell, idx) => {
          if (!cell) return;
          if (cell.distanceMeters < bestDistance) {
            bestDistance = cell.distanceMeters;
            startIndex = idx;
          }
        });
      } catch (error) {
        console.warn("[field-tech.routes] start anchor fallback", error);
        startIndex = null;
      }
    }

    let endIndex: number | null = null;
    if (options.end) {
      try {
        const endResponse = await fetchDistanceMatrix(
          coords,
          [`${options.end.lat},${options.end.lng}`],
          { travelMode: "driving" },
        );
        let bestDistance = Number.POSITIVE_INFINITY;
        endResponse.matrix.forEach((row, originIdx) => {
          const cell = row?.[0];
          if (!cell) return;
          if (cell.distanceMeters < bestDistance) {
            bestDistance = cell.distanceMeters;
            endIndex = originIdx;
          }
        });
      } catch (error) {
        console.warn("[field-tech.routes] end anchor fallback", error);
        endIndex = null;
      }
    }

    matrix.matrix.forEach((row, originIdx) => {
      row?.forEach((cell, destinationIdx) => {
        if (!cell) return;
        const from = geocoded[originIdx];
        const to = geocoded[destinationIdx];
        if (!from?.id || !to?.id) return;
        matrixLookup.set(`${from.id}::${to.id}`, cell);
      });
    });

    const order = computeNearestNeighborOrder(matrix.matrix, {
      startIndex,
      endIndex,
    });
    if (!order.length) {
      return { visits: [...geocoded, ...withoutGeo], matrixLookup };
    }

    const orderedGeocoded = order.map((idx) => geocoded[idx]);
    return { visits: [...orderedGeocoded, ...withoutGeo], matrixLookup };
  } catch (error) {
    console.warn("[field-tech.routes] optimization fallback", error);
    return { visits: [...geocoded, ...withoutGeo], matrixLookup };
  }
}

function computeNearestNeighborOrder(
  matrix: MatrixCell[][],
  options?: { startIndex?: number | null; endIndex?: number | null },
): number[] {
  if (!matrix.length) return [];
  const remaining = matrix.map((_, idx) => idx);
  if (!remaining.length) return [];
  let current: number | null = null;

  if (
    typeof options?.startIndex === "number" &&
    options.startIndex >= 0 &&
    options.startIndex < matrix.length
  ) {
    const pos = remaining.indexOf(options.startIndex);
    if (pos !== -1) {
      current = remaining.splice(pos, 1)[0];
    }
  }

  if (current === null) {
    current = remaining.shift()!;
  }

  const ordered: number[] = [current];

  while (remaining.length) {
    let bestIdx = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    remaining.forEach((candidate, idx) => {
      const cell = matrix[current!]?.[candidate];
      if (!cell) return;
      if (cell.distanceMeters < bestDistance) {
        bestDistance = cell.distanceMeters;
        bestIdx = idx;
      }
    });

    if (bestIdx === -1) {
      ordered.push(...remaining);
      break;
    }

    current = remaining.splice(bestIdx, 1)[0];
    ordered.push(current);
  }

  if (
    typeof options?.endIndex === "number" &&
    options.endIndex >= 0 &&
    options.endIndex < matrix.length
  ) {
    const endPos = ordered.indexOf(options.endIndex);
    if (endPos !== -1 && endPos !== ordered.length - 1) {
      const [endNode] = ordered.splice(endPos, 1);
      ordered.push(endNode);
    }
  }

  return ordered;
}

async function saveScooperMetadata(scooperId: string, metadata: ScooperMetadata) {
  await prisma.scooperProfile.update({
    where: { id: scooperId },
    data: { metadata: metadata as Prisma.InputJsonValue },
  });
}

async function ensureHomeAnchor(
  scooper: ScooperWithUser,
  metadata: ScooperMetadata,
): Promise<OptimizeAnchor | null> {
  if (metadata.homeAnchor?.lat && metadata.homeAnchor?.lng) {
    return metadata.homeAnchor;
  }

  const addressParts = [
    scooper.user?.address,
    scooper.user?.city,
    scooper.user?.zipCode,
  ].filter(Boolean);

  if (!addressParts.length) {
    return null;
  }

  const formatted = addressParts.join(", ");
  try {
    const result = await geocodeAddress(formatted);
    if (!result) {
      return null;
    }
    metadata.homeAnchor = {
      lat: result.location.lat,
      lng: result.location.lng,
      address: result.formattedAddress,
    };
    await saveScooperMetadata(scooper.id, metadata);
    return metadata.homeAnchor;
  } catch (error) {
    console.warn("[field-tech.routes] home anchor geocode failed", error);
    return null;
  }
}

const querySchema = z.object({
  date: z.string().optional(),
  includeCompleted: z.coerce.boolean().optional(),
  startLat: z.coerce.number().optional(),
  startLng: z.coerce.number().optional(),
  endLat: z.coerce.number().optional(),
  endLng: z.coerce.number().optional(),
});

function buildFallbackCoordinates(
  origin: string,
  destination: string,
): [number, number][] | null {
  const [originLat, originLng] = origin.split(",").map((value) => Number(value.trim()));
  const [destLat, destLng] = destination.split(",").map((value) => Number(value.trim()));

  if ([originLat, originLng, destLat, destLng].some((value) => Number.isNaN(value))) {
    return null;
  }

  return [
    [originLng, originLat],
    [destLng, destLat],
  ];
}

function resolveTimeZone(request: NextRequest): string {
  const header = request.headers.get("x-time-zone");
  return isValidTimeZone(header) ? header : SERVICE_TIME_ZONE;
}

function getZonedDayStart(date: Date, timeZone: string): Date {
  const parts = convertUtcToZonedParts(date, timeZone);
  return constructZonedDate(parts.year, parts.month, parts.day, 0, 0, 0, 0, timeZone);
}

function getZonedDayKey(date: Date, timeZone: string): number {
  return getZonedDayStart(date, timeZone).getTime();
}

export async function GET(request: NextRequest) {
  const auth = await getScooperAuth(request);
  const userId = auth?.userId;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const timeZone = resolveTimeZone(request);
  const { date, includeCompleted, startLat, startLng, endLat, endLng } = parsed.data;
  const requestedStartAnchor =
    typeof startLat === "number" && typeof startLng === "number"
      ? ({ lat: startLat, lng: startLng } as OptimizeAnchor)
      : null;
  const requestedEndAnchor =
    typeof endLat === "number" && typeof endLng === "number"
      ? ({ lat: endLat, lng: endLng } as OptimizeAnchor)
      : null;
  const scooperProfile = (await prisma.scooperProfile.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          address: true,
          city: true,
          zipCode: true,
        },
      },
    },
  })) as ScooperWithUser | null;

  if (!scooperProfile) {
    return NextResponse.json({ error: "scooper_not_found" }, { status: 404 });
  }

  const metadata = parseScooperMetadata(scooperProfile.metadata);
  const homeAnchor = await ensureHomeAnchor(scooperProfile, metadata);
  const orgId = scooperProfile.orgId;
  const scheduleCache = new Map<Frequency, VisitCompSchedule | null>();

  const startAnchorFinal: OptimizeAnchor | null = requestedStartAnchor ?? homeAnchor ?? null;
  const endAnchorFinal: OptimizeAnchor | null = requestedEndAnchor ?? startAnchorFinal;

  if (!startAnchorFinal || !endAnchorFinal) {
    return NextResponse.json(
      { error: "home_anchor_missing", message: "Add a home address in your profile to unlock routing." },
      { status: 400 },
    );
  }

  const usingCustomAnchors =
    Boolean(requestedStartAnchor && !anchorsMatch(requestedStartAnchor, homeAnchor ?? null)) ||
    Boolean(
      requestedEndAnchor &&
        !anchorsMatch(requestedEndAnchor, requestedStartAnchor ?? homeAnchor ?? null),
    );

  const currentCredits =
    typeof metadata.routeCredits === "number" ? metadata.routeCredits : 0;
  let creditsToDebit = 0;

  const scooperId = scooperProfile.id;
  let dateRange: { gte: Date; lt: Date } | undefined;

  if (date) {
    const [year, month, day] = date.split("-").map((value) => Number(value));
    if (!year || !month || !day) {
      return NextResponse.json(
        { error: "invalid_date" },
        { status: 400 },
      );
    }
    const parsedDate = constructZonedDate(year, month, day, 0, 0, 0, 0, timeZone);
    dateRange = {
      gte: parsedDate,
      lt: addDays(parsedDate, 1),
    };
  }

  const dateKey = dateRange?.gte ?? null;

  const baseWhere = {
    assignedToId: userId,
    ...(dateRange ? { scheduledDate: dateRange } : {}),
    ...(includeCompleted
      ? {}
      : {
          status: {
            in: [ServiceStatus.SCHEDULED, ServiceStatus.IN_PROGRESS],
          },
        }),
  } satisfies Prisma.ServiceVisitWhereInput;

  // Common relations that are safe across environments
  const commonInclude = {
    customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          addressLine1: true,
          city: true,
          state: true,
          zip: true,
          latitude: true,
          longitude: true,
          dogs: {
            select: {
              id: true,
              name: true,
              breed: true,
            },
          },
        },
      },
    job: true,
    communications: {
      orderBy: { createdAt: "desc" },
      take: 5,
    },
  } satisfies Prisma.ServiceVisitInclude;

  let visits;
  // Helper to check if error is a schema mismatch (missing table/column)
  const isSchemaMismatchError = (err: unknown): boolean =>
    err instanceof Prisma.PrismaClientKnownRequestError &&
    (err.code === "P2021" || err.code === "P2022"); // P2021 = missing table, P2022 = missing column

  try {
    // Full include: media + insights (preferred)
    visits = await prisma.serviceVisit.findMany({
      where: baseWhere,
      orderBy: { scheduledDate: "asc" },
      include: {
        ...commonInclude,
        media: true,
        insights: true,
      },
    });
  } catch (error) {
    if (isSchemaMismatchError(error)) {
      // Fallback 1: remove media, keep insights
      try {
        visits = await prisma.serviceVisit.findMany({
          where: baseWhere,
          orderBy: { scheduledDate: "asc" },
          include: {
            ...commonInclude,
            insights: true,
          },
        });
      } catch (error2) {
        if (isSchemaMismatchError(error2)) {
          // Fallback 2: remove insights as well
          visits = await prisma.serviceVisit.findMany({
            where: baseWhere,
            orderBy: { scheduledDate: "asc" },
            include: commonInclude,
          });
        } else {
          throw error2;
        }
      }
    } else {
      throw error;
    }
  }

  const hydrated = visits.map((visit) => {
    const { slug, label } = extractPreferredTimeWindow(visit.metadata);
    return {
      ...visit,
      preferredTimeWindowSlug: slug,
      preferredTimeWindowLabel: label,
    };
  });

  const visitsWithGeo = await Promise.all(
    hydrated.map(async (visit) => {
      const orgId = visit.orgId ?? auth?.orgId ?? undefined;
      if (!orgId) {
        return { ...visit, geo: null, navigationUrl: null };
      }

      try {
        const geo = await ensureVisitGeoSnapshot({
          orgId,
          customer: {
            id: visit.customer?.id ?? undefined,
            latitude: visit.customer?.latitude ?? undefined,
            longitude: visit.customer?.longitude ?? undefined,
            addressLine1: visit.customer?.addressLine1 ?? undefined,
            city: visit.customer?.city ?? undefined,
            state: visit.customer?.state ?? undefined,
            zip: visit.customer?.zip ?? undefined,
          },
          visit: {
            id: visit.id,
            customerId: visit.customerId ?? undefined,
            metadata: visit.metadata ?? undefined,
            addressLine1: visit.customer?.addressLine1 ?? undefined,
            city: visit.customer?.city ?? undefined,
            state: visit.customer?.state ?? undefined,
            zip: visit.customer?.zip ?? undefined,
          },
        });

        return {
          ...visit,
          geo,
          navigationUrl: `https://www.google.com/maps/dir/?api=1&destination=${geo.latitude},${geo.longitude}`,
        };
      } catch (error) {
        console.warn("Unable to resolve geo for visit", visit.id, error);
        return {
          ...visit,
          geo: null,
          navigationUrl: null,
        };
      }
    }),
  );

  const visitsFingerprint = visitsWithGeo.map((visit) => ({
    id: visit.id,
    status: visit.status,
    scheduledDate: visit.scheduledDate,
    addressKey: buildCustomerAddressKey(visit.customer),
    geo: visit.geo
      ? {
          lat: Number(visit.geo.latitude.toFixed(6)),
          lng: Number(visit.geo.longitude.toFixed(6)),
        }
      : null,
  }));

  const signaturePayload = {
    version: ROUTE_PLAN_VERSION,
    userId,
    date: dateKey ? dateKey.toISOString() : null,
    includeCompleted: Boolean(includeCompleted),
    startAnchor: normalizeAnchor(startAnchorFinal),
    endAnchor: normalizeAnchor(endAnchorFinal),
    visits: visitsFingerprint,
  };

  const signature = crypto
    .createHash("sha1")
    .update(JSON.stringify(signaturePayload))
    .digest("hex");

  const cachedPlan = await prisma.scooperRoutePlan.findUnique({ where: { signature } });
  const now = new Date();
  if (cachedPlan && (!cachedPlan.expiresAt || cachedPlan.expiresAt > now)) {
    const payload = cachedPlan.payload as RoutePlanPayload;
    const needsProjection = payload.visits.some(
      (visit: any) => typeof visit.projectedPayoutCents !== "number",
    );
    if (!needsProjection) {
      return NextResponse.json({ ok: true, cached: true, ...payload });
    }
    const visitsWithProjection = await attachProjectedPayoutCents(
      payload.visits,
      orgId,
      scheduleCache,
      startAnchorFinal,
    );
    return NextResponse.json({
      ok: true,
      cached: true,
      visits: visitsWithProjection,
      summary: payload.summary,
    });
  }

  if (usingCustomAnchors) {
    if (currentCredits < CUSTOM_ANCHOR_CREDIT_COST) {
      return NextResponse.json(
        { error: "insufficient_route_credits", message: "Add route credits before requesting a custom start/end." },
        { status: 402 },
      );
    }
    creditsToDebit = CUSTOM_ANCHOR_CREDIT_COST;
  }

  const visitsByDay = new Map<number, any[]>();
  visitsWithGeo.forEach((visit) => {
    const dayKey = getZonedDayKey(new Date(visit.scheduledDate), timeZone);
    if (!visitsByDay.has(dayKey)) {
      visitsByDay.set(dayKey, []);
    }
    visitsByDay.get(dayKey)!.push(visit);
  });

  const sortedDayKeys = Array.from(visitsByDay.keys()).sort((a, b) => a - b);
  const orderedVisits: typeof visitsWithGeo = [];
  const matrixLookupByDay = new Map<number, Map<string, MatrixCell>>();
  let globalSequence = 0;

  for (const dayKey of sortedDayKeys) {
    const dayVisits = visitsByDay.get(dayKey)!;
    const { visits: optimized, matrixLookup } = await optimizeDailyVisits(dayVisits, {
      start: startAnchorFinal,
      end: endAnchorFinal,
    });
    matrixLookupByDay.set(dayKey, matrixLookup);
    optimized.forEach((visit) => {
      (visit as any).routeSequence = globalSequence;
      globalSequence += 1;
      orderedVisits.push(visit);
    });
  }

  visitsByDay.clear();

  orderedVisits.forEach((visit) => {
    (visit as any).travelFromPrevious = null;
  });

  const segments: Array<{
    fromIndex: number;
    toIndex: number;
    origin: string;
    destination: string;
    originId: string;
    destinationId: string;
    dayKey: number;
  }> = [];

  orderedVisits.forEach((visit, index) => {
    if (index === 0) return;
    const prev = orderedVisits[index - 1];
    if (!prev.geo || !visit.geo) return;
    const prevDayKey = getZonedDayKey(new Date(prev.scheduledDate), timeZone);
    const currentDayKey = getZonedDayKey(new Date(visit.scheduledDate), timeZone);
    if (prevDayKey !== currentDayKey) {
      return;
    }
    segments.push({
      fromIndex: index - 1,
      toIndex: index,
      origin: `${prev.geo.latitude},${prev.geo.longitude}`,
      destination: `${visit.geo.latitude},${visit.geo.longitude}`,
      originId: prev.id,
      destinationId: visit.id,
      dayKey: currentDayKey,
    });
  });

  let betweenStopsDistanceMeters = 0;
  let betweenStopsDurationSeconds = 0;
  let startToFirstDistanceMeters = 0;
  let startToFirstDurationSeconds = 0;
  let endToHomeDistanceMeters = 0;
  let endToHomeDurationSeconds = 0;

  if (segments.length) {
    segments.forEach((segment) => {
      const lookup = matrixLookupByDay.get(segment.dayKey);
      if (!lookup) {
        return;
      }
      const cell = lookup.get(`${segment.originId}::${segment.destinationId}`);
      const fallback = cell ? null : estimateLeg(segment.origin, segment.destination);
      const resolvedDistance = cell?.distanceMeters ?? fallback?.distanceMeters ?? 0;
      const resolvedDuration = cell?.durationSeconds ?? fallback?.durationSeconds ?? 0;
      if (resolvedDistance <= 0 || resolvedDuration <= 0) {
        return;
      }

      betweenStopsDistanceMeters += resolvedDistance;
      betweenStopsDurationSeconds += resolvedDuration;

      const targetVisit = orderedVisits[segment.toIndex];
      if (!targetVisit) {
        return;
      }
      (targetVisit as any).travelFromPrevious = {
        distanceMeters: resolvedDistance,
        durationSeconds: resolvedDuration,
        origin: segment.origin,
        destination: segment.destination,
      };
    });

    try {
      const legGeometries = await Promise.all(
        segments.map(async (segment) => {
          try {
            const route = await fetchDirectionsRoute(segment.origin, segment.destination);
            const coordinates = route?.coordinates?.length
              ? route.coordinates
              : buildFallbackCoordinates(segment.origin, segment.destination);
            if (!coordinates?.length) {
              return null;
            }
            return {
              toIndex: segment.toIndex,
              coordinates,
            };
          } catch (geoError) {
            console.warn("Failed to fetch directions for field tech segment", geoError);
            const fallback = buildFallbackCoordinates(segment.origin, segment.destination);
            if (!fallback?.length) {
              return null;
            }
            return {
              toIndex: segment.toIndex,
              coordinates: fallback,
            };
          }
        }),
      );

      legGeometries.forEach((leg) => {
        if (!leg?.coordinates?.length) return;
        const targetVisit = orderedVisits[leg.toIndex];
        if (!targetVisit) return;
        const existing = (targetVisit as any).travelFromPrevious ?? {};
        (targetVisit as any).travelFromPrevious = {
          ...existing,
          geometry: leg.coordinates,
        };
      });
    } catch (error) {
      console.warn("Failed to compute route geometry for field tech map", error);
    }
  }

  const dayKeysForAnchors = Array.from(
    new Set(
      orderedVisits.map((visit) => getZonedDayKey(new Date(visit.scheduledDate), timeZone)),
    ),
  );

  const fetchAnchorLeg = async (origin: string, destination: string) => {
    try {
      const matrix = await fetchDistanceMatrix([origin], [destination], {
        travelMode: "driving",
      });
      return matrix.matrix?.[0]?.[0] ?? null;
    } catch (error) {
      console.warn("[field-tech.routes] anchor leg fallback", error);
      return null;
    }
  };

  for (const dayKey of dayKeysForAnchors) {
    const dayVisits = orderedVisits.filter((visit) => {
      const visitDayKey = getZonedDayKey(new Date(visit.scheduledDate), timeZone);
      return visitDayKey === dayKey && visit.geo;
    });
    if (!dayVisits.length) continue;

    const firstVisit = dayVisits[0];
    const lastVisit = dayVisits[dayVisits.length - 1];
    const startOrigin = `${startAnchorFinal.lat},${startAnchorFinal.lng}`;
    const startDestination = `${firstVisit.geo!.latitude},${firstVisit.geo!.longitude}`;
    const endOrigin = `${lastVisit.geo!.latitude},${lastVisit.geo!.longitude}`;
    const endDestination = `${endAnchorFinal.lat},${endAnchorFinal.lng}`;

    const startLeg = await fetchAnchorLeg(startOrigin, startDestination);
    const resolvedStartLeg = startLeg ?? estimateLeg(startOrigin, startDestination);
    if (resolvedStartLeg) {
      startToFirstDistanceMeters += resolvedStartLeg.distanceMeters;
      startToFirstDurationSeconds += resolvedStartLeg.durationSeconds;
    }

    const endLeg = await fetchAnchorLeg(endOrigin, endDestination);
    const resolvedEndLeg = endLeg ?? estimateLeg(endOrigin, endDestination);
    if (resolvedEndLeg) {
      endToHomeDistanceMeters += resolvedEndLeg.distanceMeters;
      endToHomeDurationSeconds += resolvedEndLeg.durationSeconds;
    }
  }

  const totalDistanceMeters =
    betweenStopsDistanceMeters + startToFirstDistanceMeters + endToHomeDistanceMeters;
  const totalDurationSeconds =
    betweenStopsDurationSeconds + startToFirstDurationSeconds + endToHomeDurationSeconds;

  const visitsWithProjection = await attachProjectedPayoutCents(
    orderedVisits,
    orgId,
    scheduleCache,
    startAnchorFinal,
  );

  const visitsResponse = visitsWithProjection.map((visit) => ({
    ...visit,
    travelFromPrevious: (visit as any).travelFromPrevious ?? null,
    routeSequence: (visit as any).routeSequence ?? null,
  }));

  const responsePayload: RoutePlanPayload = {
    visits: visitsResponse,
    summary: {
      betweenStopsDistanceMeters,
      betweenStopsDurationSeconds,
      startToFirstDistanceMeters,
      startToFirstDurationSeconds,
      endToHomeDistanceMeters,
      endToHomeDurationSeconds,
      totalDistanceMeters,
      totalDurationSeconds,
    },
  };

  const planExpiresAt = addDays(
    dateKey ?? getZonedDayStart(new Date(), timeZone),
    ROUTE_PLAN_TTL_DAYS,
  );

  await prisma.scooperRoutePlan.upsert({
    where: { signature },
    update: {
      payload: responsePayload,
      summary: responsePayload.summary,
      startLat: startAnchorFinal.lat,
      startLng: startAnchorFinal.lng,
      endLat: endAnchorFinal.lat,
      endLng: endAnchorFinal.lng,
      creditsUsed: creditsToDebit,
      expiresAt: planExpiresAt,
      dateKey,
      scooperId,
    },
    create: {
      signature,
      scooperId,
      dateKey,
      payload: responsePayload,
      summary: responsePayload.summary,
      startLat: startAnchorFinal.lat,
      startLng: startAnchorFinal.lng,
      endLat: endAnchorFinal.lat,
      endLng: endAnchorFinal.lng,
      creditsUsed: creditsToDebit,
      expiresAt: planExpiresAt,
    },
  });

  if (creditsToDebit > 0) {
    metadata.routeCredits = Math.max(0, currentCredits - creditsToDebit);
    await saveScooperMetadata(scooperId, metadata);
  }

  return NextResponse.json({ ok: true, cached: false, ...responsePayload });
}

export const runtime = "nodejs";
