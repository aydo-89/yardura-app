import {
  CustomerEmailReportCadence,
  FoodLogType,
  ServiceStatus,
} from "@prisma/client";

import { env } from "@/lib/env";
import { query as geoQuery } from "@/lib/geo/postgis";
import { prisma } from "@/lib/prisma";
import { createSignedUrl, uploadFile } from "@/lib/supabase-admin";
import {
  SERVICE_TIME_ZONE,
  constructZonedDateFromParts,
  convertUtcToZonedParts,
  formatZonedDate,
} from "@/lib/timezone";
import {
  buildWellnessReadingsFromCaptures,
  buildWellnessReadingsFromMedia,
} from "@/lib/wellness/readings";

// Check at runtime, not at module load time (for scripts using dotenv)
const isPostgisEnabled = () => process.env.ENABLE_POSTGIS_GEO === "true";
const PARCEL_QUERY_TIMEOUT_MS = 5000;

export type EmailReportSections = {
  includeWellness: boolean;
  includeScooping: boolean;
  includeFood: boolean;
  includeWalks: boolean;
  includeReminders: boolean;
  includeChats: boolean;
  includePhotos: boolean;
};

export type EmailReportPeriod = {
  start: Date;
  end: Date;
  label: string;
  cadence: CustomerEmailReportCadence;
  days: number;
  periodKey: string;
};

export type CustomerEmailReportData = {
  customer: {
    id: string;
    name: string | null;
    email: string | null;
    city: string | null;
    state: string | null;
  };
  dogs: Array<{ id: string; name: string | null }>;
  period: EmailReportPeriod;
  stats: {
    wellnessScore: number;
    wellnessLabel: string;
    totalCaptures: number;
    checkInsCount: number;
    visitCount: number;
    walkDistanceMiles: number;
    foodLogCount: number;
  };
  highlights: string[];
  wellness?: {
    issues: Array<{ label: string; count: number }>;
    colorSummary: string;
    consistencySummary: string;
    hydrationAvg: number | null;
    firmnessAvg: number | null;
    indicatorSummary: string;
    latestSummary: string | null;
    latestIndicator: string | null;
    weeklyNotes: string | null;
    stoolNotes: string | null;
  };
  checkIns?: {
    vomitingCount: number;
    diarrheaCount: number;
    medsGivenCount: number;
    appetiteMode: string | null;
    energyMode: string | null;
    waterMode: string | null;
    total: number;
  };
  food?: {
    total: number;
    typeCounts: Record<string, number>;
    topAllergens: string[];
    topItems: string[];
  };
  walks?: {
    total: number;
    distanceMiles: number;
    durationMinutes: number;
    latestRouteMapUrl?: string | null;
    latestRouteDogName?: string | null;
    latestRouteDistanceMiles?: number | null;
    latestRouteDurationMinutes?: number | null;
  };
  reminders?: {
    upcoming: Array<{ title: string; dueAt: string }>;
  };
  chats?: {
    entries: Array<{
      message: string;
      riskLevel: string | null;
      redFlags: string[];
      suggestedActions: string[];
    }>;
  };
  visits?: {
    completed: number;
    skipped: number;
    upcoming: number;
    nextVisitDate: string | null;
    lastVisitDate: string | null;
  };
  photos?: {
    owner: Array<{ url: string; caption: string }>;
    pro: Array<{ url: string; caption: string }>;
  };
  poopMap?: {
    heatmapUrl: string;
    pointsCount: number;
    ownerCount: number;
    proCount: number;
  };
};

const MAX_PHOTOS_PER_SOURCE = 2;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const HEATMAP_MAX_ACCURACY = 30;
const HEATMAP_DEFAULT_ACCURACY = 8;

const computeHeatmapWeight = (accuracy?: number | null) => {
  const raw = typeof accuracy === "number" && Number.isFinite(accuracy)
    ? accuracy
    : HEATMAP_DEFAULT_ACCURACY;
  const safe = clamp(raw, 2, HEATMAP_MAX_ACCURACY);
  return 1 / (safe * safe);
};

type ParcelGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;

/**
 * Load parcel boundary from PostGIS for a given lat/lng.
 * Optimized query using centroid index for faster lookups.
 */
async function loadParcelBoundary(
  lat: number,
  lng: number,
): Promise<ParcelGeometry | null> {
  if (!isPostgisEnabled()) {
    console.log('[email-report] PostGIS disabled, skipping parcel lookup');
    return null;
  }

  try {
    // Optimized query: Uses bounding box for index, centroid for ordering (faster than geom::geography)
    const sql = `
      SELECT ST_AsGeoJSON(geom) AS geom_geojson
      FROM geo.parcel
      WHERE 
        -- Bounding box filter (uses GIST index, very fast)
        geom && ST_Expand(ST_SetSRID(ST_Point($1, $2), 4326), 0.0003)
        AND (
          -- Exact containment check
          ST_Contains(geom, ST_SetSRID(ST_Point($1, $2), 4326))
          OR 
          -- Fallback: within 30m of centroid (uses centroid index)
          ST_DWithin(
            centroid::geography,
            ST_SetSRID(ST_Point($1, $2), 4326)::geography,
            30
          )
        )
      ORDER BY ST_Distance(
        centroid,
        ST_SetSRID(ST_Point($1, $2), 4326)
      ) ASC
      LIMIT 1`;

    const { rows } = await geoQuery(sql, [lng, lat], {
      timeoutMs: PARCEL_QUERY_TIMEOUT_MS,
    });
    if (!rows.length || !rows[0]?.geom_geojson) {
      console.log('[email-report] No parcel found for', lat, lng);
      return null;
    }
    return JSON.parse(rows[0].geom_geojson) as ParcelGeometry;
  } catch (err) {
    console.warn('[email-report] Parcel lookup failed:', err);
    return null;
  }
}

/**
 * Convert GeoJSON polygon to Google Static Maps path format
 * Returns simplified path string for URL (max ~50 points to avoid URL length issues)
 */
function polygonToStaticMapPath(geometry: ParcelGeometry): string | null {
  let coords: number[][];

  if (geometry.type === "Polygon") {
    coords = geometry.coordinates[0] as number[][];
  } else if (geometry.type === "MultiPolygon") {
    // Use the largest polygon
    let largest = geometry.coordinates[0][0] as number[][];
    for (const poly of geometry.coordinates) {
      if ((poly[0] as number[][]).length > largest.length) {
        largest = poly[0] as number[][];
      }
    }
    coords = largest;
  } else {
    return null;
  }

  // Simplify to max 40 points to keep URL short
  const step = Math.max(1, Math.floor(coords.length / 40));
  const simplified = coords.filter((_, i) => i % step === 0 || i === coords.length - 1);

  // Format: lat,lng|lat,lng|...
  const pathPoints = simplified
    .map((coord) => `${coord[1].toFixed(6)},${coord[0].toFixed(6)}`)
    .join("|");

  return pathPoints;
}

// Brand colors matching the native app
const COLORS = {
  mint: "0x19B4A3",      // Owner captures - teal/mint
  coral: "0xF3645B",     // Pro/scooper captures - coral/red
  parcel: "0x22C55E",    // Parcel boundary - green
};

/**
 * Build a Google Static Maps URL with markers for poop locations.
 * This generates a real map image that works in all email clients.
 * Uses different colors for OWNER vs PRO captures to match the native app.
 */
const buildStaticMapUrl = (
  points: Array<{ lat: number; lng: number; weight: number; source: "OWNER" | "PRO" }>,
  apiKey: string,
  parcelGeometry?: ParcelGeometry | null,
): string | null => {
  if (points.length === 0) return null;

  // Group points into buckets by source to reduce markers (Static Maps has a URL length limit)
  const GRID_SIZE = 0.00005; // ~5m grid
  const ownerBuckets = new Map<string, { lat: number; lng: number; count: number }>();
  const proBuckets = new Map<string, { lat: number; lng: number; count: number }>();
  
  points.forEach((point) => {
    const bx = Math.round(point.lat / GRID_SIZE);
    const by = Math.round(point.lng / GRID_SIZE);
    const key = `${bx}:${by}`;
    const buckets = point.source === "OWNER" ? ownerBuckets : proBuckets;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count++;
    } else {
      buckets.set(key, {
        lat: bx * GRID_SIZE,
        lng: by * GRID_SIZE,
        count: 1,
      });
    }
  });

  const ownerLocations = Array.from(ownerBuckets.values());
  const proLocations = Array.from(proBuckets.values());
  const allLocations = [...ownerLocations, ...proLocations];

  // Calculate center and appropriate zoom based on spread
  const lats = allLocations.map((loc) => loc.lat);
  const lngs = allLocations.map((loc) => loc.lng);
  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  
  // Calculate spread to determine zoom level
  const latSpread = Math.max(...lats) - Math.min(...lats);
  const lngSpread = Math.max(...lngs) - Math.min(...lngs);
  const maxSpread = Math.max(latSpread, lngSpread);
  
  // Zoom: larger spread = lower zoom. Default to 20 for yard-level detail (shows house/garage)
  let zoom = 20;
  if (maxSpread > 0.0005) zoom = 19;
  if (maxSpread > 0.001) zoom = 18;
  if (maxSpread > 0.002) zoom = 17;
  if (maxSpread > 0.004) zoom = 16;

  // Build URL with styled markers
  const params = new URLSearchParams({
    center: `${centerLat.toFixed(6)},${centerLng.toFixed(6)}`,
    zoom: String(zoom),
    size: "600x360",
    scale: "2", // High-res
    maptype: "roadmap", // Clean roadmap view - trees don't block the yard
    key: apiKey,
  });

  // Clean map styling - light background, subtle roads
  params.append("style", "feature:poi|visibility:off");
  params.append("style", "feature:transit|visibility:off");
  params.append("style", "feature:road|element:labels|visibility:off");
  params.append("style", "feature:landscape|element:geometry.fill|color:0xE8F5E9"); // Light green for lawns
  params.append("style", "feature:road|element:geometry|color:0xffffff");
  params.append("style", "feature:water|element:geometry|color:0xB3E5FC");

  // Add parcel boundary if available (green outline)
  if (parcelGeometry) {
    const parcelPath = polygonToStaticMapPath(parcelGeometry);
    if (parcelPath) {
      // Green outline with slight fill, 3px weight
      params.append("path", `color:${COLORS.parcel}FF|weight:3|fillcolor:${COLORS.parcel}20|${parcelPath}`);
    }
  }

  // Add markers by source - limit each group to 25 to avoid URL length issues
  // Owner captures = mint (teal)
  const ownerCoords = ownerLocations
    .sort((a, b) => b.count - a.count)
    .slice(0, 25)
    .map((loc) => `${loc.lat.toFixed(6)},${loc.lng.toFixed(6)}`);
  
  // Pro captures = coral (red)
  const proCoords = proLocations
    .sort((a, b) => b.count - a.count)
    .slice(0, 25)
    .map((loc) => `${loc.lat.toFixed(6)},${loc.lng.toFixed(6)}`);

  if (ownerCoords.length > 0) {
    params.append("markers", `color:${COLORS.mint}|size:small|${ownerCoords.join("|")}`);
  }
  if (proCoords.length > 0) {
    params.append("markers", `color:${COLORS.coral}|size:small|${proCoords.join("|")}`);
  }

  const url = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
  
  // Static Maps URLs have a ~16KB limit. Check and warn.
  if (url.length > 16000) {
    console.warn("[buildStaticMapUrl] URL exceeds 16KB, may fail");
  }

  return url;
};

/**
 * Build a Google Static Maps URL for a walk route polyline.
 */
const buildWalkRouteMapUrl = (
  path: Array<{ lat: number; lng: number }>,
  apiKey: string,
): string | null => {
  if (path.length < 2) return null;

  // Simplify path to max 100 points to keep URL short
  const step = Math.max(1, Math.floor(path.length / 100));
  const simplified = path.filter((_, i) => i % step === 0 || i === path.length - 1);

  // Calculate bounds for center
  const lats = simplified.map((p) => p.lat);
  const lngs = simplified.map((p) => p.lng);
  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

  // Calculate spread to determine zoom level
  const latSpread = Math.max(...lats) - Math.min(...lats);
  const lngSpread = Math.max(...lngs) - Math.min(...lngs);
  const maxSpread = Math.max(latSpread, lngSpread);

  let zoom = 17;
  if (maxSpread > 0.002) zoom = 16;
  if (maxSpread > 0.004) zoom = 15;
  if (maxSpread > 0.008) zoom = 14;
  if (maxSpread > 0.016) zoom = 13;
  if (maxSpread > 0.032) zoom = 12;

  const params = new URLSearchParams({
    center: `${centerLat.toFixed(6)},${centerLng.toFixed(6)}`,
    zoom: String(zoom),
    size: "600x300",
    scale: "2",
    maptype: "roadmap",
    key: apiKey,
  });

  // Clean map styling
  params.append("style", "feature:poi|visibility:off");
  params.append("style", "feature:transit|visibility:off");

  // Build the path parameter - coral/emerald gradient line
  const pathPoints = simplified
    .map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`)
    .join("|");
  
  // Coral walking route line
  params.append("path", `color:0xF3645BFF|weight:4|${pathPoints}`);

  // Start marker (green)
  const start = simplified[0];
  params.append("markers", `color:0x10B981|label:S|${start.lat.toFixed(6)},${start.lng.toFixed(6)}`);

  // End marker (coral)
  const end = simplified[simplified.length - 1];
  if (end.lat !== start.lat || end.lng !== start.lng) {
    params.append("markers", `color:0xF3645B|label:E|${end.lat.toFixed(6)},${end.lng.toFixed(6)}`);
  }

  const url = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
  if (url.length > 16000) {
    console.warn("[buildWalkRouteMapUrl] URL exceeds 16KB, may fail");
  }
  return url;
};

/**
 * Fetch the static map image and return as a Buffer.
 */
const fetchStaticMapImage = async (url: string): Promise<Buffer | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[fetchStaticMapImage] Failed to fetch: ${response.status}`);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.warn("[fetchStaticMapImage] Error fetching map:", error);
    return null;
  }
};

const formatRangeLabel = (start: Date, end: Date) => {
  const startLabel = formatZonedDate(start, { month: "short", day: "numeric" });
  const endLabel = formatZonedDate(end, { month: "short", day: "numeric" });
  const startYear = formatZonedDate(start, { year: "numeric" });
  const endYear = formatZonedDate(end, { year: "numeric" });
  return startYear === endYear ? `${startLabel} – ${endLabel}, ${startYear}` : `${startLabel}, ${startYear} – ${endLabel}, ${endYear}`;
};

export function resolveReportPeriod(options: {
  cadence: CustomerEmailReportCadence;
  now?: Date;
  timeZone?: string | null;
}): EmailReportPeriod {
  const now = options.now ?? new Date();
  const timeZone = options.timeZone ?? SERVICE_TIME_ZONE;
  const parts = convertUtcToZonedParts(now, timeZone);
  const zonedNow = constructZonedDateFromParts(parts, timeZone);
  const days = options.cadence === "MONTHLY" ? 30 : 7;
  const start = new Date(zonedNow);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const end = zonedNow;
  const label = formatRangeLabel(start, end);
  const periodKey = `${options.cadence.toLowerCase()}-${start.toISOString().slice(0, 10)}`;

  return {
    start,
    end,
    label,
    cadence: options.cadence,
    days,
    periodKey,
  };
}

const summarizeCounts = (counts: Record<string, number>, fallback: string) => {
  const entries = Object.entries(counts)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => `${key} ${value}`);
  return entries.length ? entries.join(" · ") : fallback;
};

const modeFromCounts = (counts: Record<string, number>) => {
  const entries = Object.entries(counts).filter(([, value]) => value > 0);
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
};

const toMiles = (meters: number) => meters / 1609.34;

const sanitizeEmailList = (recipients: string[]) =>
  recipients
    .map((email) => email.trim().toLowerCase())
    .filter((email, index, list) => Boolean(email) && list.indexOf(email) === index);

export async function buildCustomerEmailReportData(options: {
  orgId: string;
  customerId: string;
  period: EmailReportPeriod;
  sections: EmailReportSections;
}): Promise<CustomerEmailReportData | null> {
  const { orgId, customerId, period, sections } = options;

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, orgId },
    select: {
      id: true,
      name: true,
      email: true,
      city: true,
      state: true,
      latitude: true,
      longitude: true,
      dogs: { select: { id: true, name: true } },
    },
  });

  if (!customer) return null;

  const start = period.start;
  const end = period.end;

  const shouldFetchWellness = sections.includeWellness || sections.includePhotos;
  const shouldFetchChat = sections.includeChats;
  const shouldFetchFood = sections.includeFood;
  const shouldFetchWalks = sections.includeWalks;
  const shouldFetchReminders = sections.includeReminders;
  const shouldFetchVisits = sections.includeScooping;

  const [
    weeklyReports,
    ownerCaptures,
    proMedia,
    chatLogs,
    foodLogs,
    walks,
    reminders,
    visits,
  ] = await Promise.all([
    sections.includeWellness
      ? prisma.weeklyWellnessReport.findMany({
          where: { customerId, weekStart: { gte: start }, weekEnd: { lte: end } },
          orderBy: { weekStart: "desc" },
          select: {
            behaviorNotes: true,
            stoolNotes: true,
            appetite: true,
            hydration: true,
            energy: true,
            stoolFrequency: true,
            vomiting: true,
            diarrhea: true,
            medsGiven: true,
            medsNotes: true,
          },
        })
      : Promise.resolve([]),
    shouldFetchWellness
      ? prisma.customerWellnessCapture.findMany({
          where: {
            customerId,
            capturedAt: { gte: start, lte: end },
          },
          orderBy: { capturedAt: "desc" },
          include: { dog: { select: { name: true } } },
        })
      : Promise.resolve([]),
    shouldFetchWellness
      ? prisma.serviceVisitMedia.findMany({
          where: {
            serviceVisit: { customerId },
            capturedAt: { gte: start, lte: end },
            assetType: "INSIGHTSCOOP",
            analysisStatus: { in: ["COMPLETED", "NEEDS_REVIEW"] },
            visibilityState: "VISIBLE",
          },
          orderBy: { capturedAt: "desc" },
          take: 6,
        })
      : Promise.resolve([]),
    shouldFetchChat
      ? prisma.customerWellnessChatLog.findMany({
          where: { customerId, createdAt: { gte: start, lte: end } },
          orderBy: { createdAt: "desc" },
          take: 3,
        })
      : Promise.resolve([]),
    shouldFetchFood
      ? prisma.customerFoodLog.findMany({
          where: { customerId, loggedAt: { gte: start, lte: end } },
          orderBy: { loggedAt: "desc" },
          take: 40,
        })
      : Promise.resolve([]),
    shouldFetchWalks
      ? prisma.customerWellnessWalk.findMany({
          where: { customerId, startedAt: { gte: start, lte: end } },
          orderBy: { startedAt: "desc" },
          take: 20,
        })
      : Promise.resolve([]),
    shouldFetchReminders
      ? prisma.customerWellnessReminder.findMany({
          where: {
            customerId,
            active: true,
            nextDueAt: { gte: new Date(), lte: new Date(Date.now() + 14 * 86400000) },
          },
          orderBy: { nextDueAt: "asc" },
          take: 5,
        })
      : Promise.resolve([]),
    shouldFetchVisits
      ? prisma.serviceVisit.findMany({
          where: { customerId, scheduledDate: { gte: start, lte: end } },
          orderBy: { scheduledDate: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const ownerReadings = shouldFetchWellness
    ? buildWellnessReadingsFromCaptures(
        ownerCaptures.map((capture) => ({
          id: capture.id,
          capturedAt: capture.capturedAt,
          analysisResult: capture.analysisResult as Record<string, unknown> | null,
          dogName: capture.dog?.name ?? null,
          storagePath: capture.storagePath ?? null,
        })),
      )
    : [];

  const proReadings = shouldFetchWellness
    ? buildWellnessReadingsFromMedia(
        proMedia.map((media) => ({
          id: media.id,
          capturedAt: media.capturedAt,
          analysisResult: media.analysisResult as Record<string, unknown> | null,
          stoolSampleId: media.stoolSampleId ?? null,
          stoolSampleView: media.stoolSampleView ?? null,
          assetType: media.assetType ?? null,
          reviewStatus: media.reviewStatus ?? null,
        })),
      )
    : [];

  const allReadings = [...ownerReadings, ...proReadings];
  const totalCaptures = ownerCaptures.length + proMedia.length;

  const issueCounts = new Map<string, number>();
  const colorCounts: Record<string, number> = {};
  const consistencyCounts: Record<string, number> = {};
  const indicatorCounts = { watch: 0, monitor: 0, vet_now: 0 };

  let hydrationTotal = 0;
  let hydrationCount = 0;
  let firmnessTotal = 0;
  let firmnessCount = 0;

  allReadings.forEach((reading) => {
    if (reading.color) {
      colorCounts[reading.color] = (colorCounts[reading.color] ?? 0) + 1;
    }
    if (reading.consistencyLabel) {
      consistencyCounts[reading.consistencyLabel] = (consistencyCounts[reading.consistencyLabel] ?? 0) + 1;
    }
    reading.issues.forEach((issue) => {
      issueCounts.set(issue, (issueCounts.get(issue) ?? 0) + 1);
    });
    if (reading.indicator) {
      indicatorCounts[reading.indicator] += 1;
    }
    if (typeof reading.hydrationScore === "number") {
      hydrationTotal += reading.hydrationScore;
      hydrationCount += 1;
    }
    if (typeof reading.firmnessScale === "number") {
      firmnessTotal += reading.firmnessScale;
      firmnessCount += 1;
    }
  });

  const issues = Array.from(issueCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));

  // Calculate hydration average, but treat values <= 5 as invalid (AI couldn't determine)
  const rawHydrationAvg = hydrationCount ? hydrationTotal / hydrationCount : null;
  const hydrationAvg = rawHydrationAvg != null && rawHydrationAvg > 5 ? rawHydrationAvg : null;
  const firmnessAvg = firmnessCount ? firmnessTotal / firmnessCount : null;

  const latestOwnerReading = ownerReadings[0];
  const latestSummary = latestOwnerReading?.summary ?? null;
  const latestIndicator = latestOwnerReading?.indicator ?? null;

  const latestReport = weeklyReports[0] ?? null;
  const checkInsCount = weeklyReports.length;
  const vomitingCount = weeklyReports.filter((entry) => entry.vomiting).length;
  const diarrheaCount = weeklyReports.filter((entry) => entry.diarrhea).length;
  const medsGivenCount = weeklyReports.filter((entry) => entry.medsGiven).length;

  const appetiteCounts: Record<string, number> = {};
  const energyCounts: Record<string, number> = {};
  const waterCounts: Record<string, number> = {};
  weeklyReports.forEach((entry) => {
    if (entry.appetite) {
      appetiteCounts[entry.appetite.toLowerCase()] = (appetiteCounts[entry.appetite.toLowerCase()] ?? 0) + 1;
    }
    if (entry.energy) {
      energyCounts[entry.energy.toLowerCase()] = (energyCounts[entry.energy.toLowerCase()] ?? 0) + 1;
    }
    if (entry.hydration) {
      waterCounts[entry.hydration.toLowerCase()] = (waterCounts[entry.hydration.toLowerCase()] ?? 0) + 1;
    }
  });

  const appetiteMode = modeFromCounts(appetiteCounts);
  const energyMode = modeFromCounts(energyCounts);
  const waterMode = modeFromCounts(waterCounts);

  const foodLogCount = foodLogs.length;
  const typeCounts: Record<string, number> = {};
  const allergenCounts: Record<string, number> = {};
  const itemCounts: Record<string, number> = {};

  foodLogs.forEach((log) => {
    const type = log.type ?? FoodLogType.FOOD;
    typeCounts[type] = (typeCounts[type] ?? 0) + 1;
    log.allergenMatches.forEach((allergen) => {
      allergenCounts[allergen] = (allergenCounts[allergen] ?? 0) + 1;
    });
    const label = [log.brand, log.productName].filter(Boolean).join(" ").trim();
    if (label) {
      itemCounts[label] = (itemCounts[label] ?? 0) + 1;
    }
  });

  const topAllergens = Object.entries(allergenCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label]) => label);
  const topItems = Object.entries(itemCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label]) => label);

  const walkDistanceMeters = walks.reduce((sum, walk) => sum + walk.distanceMeters, 0);
  const walkDurationSeconds = walks.reduce((sum, walk) => sum + walk.durationSeconds, 0);

  const completedVisits = visits.filter((visit) => visit.status === ServiceStatus.COMPLETED).length;
  const skippedVisits = visits.filter((visit) => visit.status === ServiceStatus.SKIPPED).length;
  const upcomingVisits = visits.filter((visit) => visit.status === ServiceStatus.SCHEDULED).length;

  const nextVisit = sections.includeScooping
    ? await prisma.serviceVisit.findFirst({
        where: { customerId, scheduledDate: { gt: end }, status: ServiceStatus.SCHEDULED },
        orderBy: { scheduledDate: "asc" },
        select: { scheduledDate: true },
      })
    : null;

  const lastVisit = sections.includeScooping
    ? await prisma.serviceVisit.findFirst({
        where: { customerId, completedDate: { not: null } },
        orderBy: { completedDate: "desc" },
        select: { completedDate: true },
      })
    : null;

  const chatEntries = chatLogs.map((log) => {
    const response = (log.response ?? {}) as Record<string, unknown>;
    return {
      message: log.message,
      riskLevel: log.riskLevel ?? null,
      redFlags: Array.isArray(response.red_flags) ? (response.red_flags as string[]).slice(0, 3) : [],
      suggestedActions: Array.isArray(response.suggested_actions)
        ? (response.suggested_actions as string[]).slice(0, 3)
        : [],
    };
  });

  const highlightList: string[] = [];
  if (issues.length) {
    highlightList.push(`Stool observations: ${issues.slice(0, 2).map((item) => item.label).join(", ")}`);
  }
  if (vomitingCount > 0) {
    highlightList.push(`Vomiting reported ${vomitingCount} time${vomitingCount === 1 ? "" : "s"}`);
  }
  if (diarrheaCount > 0) {
    highlightList.push(`Diarrhea reported ${diarrheaCount} time${diarrheaCount === 1 ? "" : "s"}`);
  }
  if (topAllergens.length) {
    highlightList.push(`Top allergens: ${topAllergens.join(", ")}`);
  }
  if (completedVisits > 0) {
    highlightList.push(`${completedVisits} visit${completedVisits === 1 ? "" : "s"} completed`);
  }
  if (reminders.length) {
    highlightList.push(`${reminders.length} reminder${reminders.length === 1 ? "" : "s"} coming up`);
  }

  const chatRiskPenalty =
    chatEntries.filter((entry) => entry.riskLevel === "vet_now").length * 10 +
    chatEntries.filter((entry) => entry.riskLevel === "monitor").length * 5;

  const wellnessScore = clamp(
    100 -
      issues.length * 5 -
      indicatorCounts.vet_now * 12 -
      indicatorCounts.monitor * 6 -
      indicatorCounts.watch * 3 -
      vomitingCount * 6 -
      diarrheaCount * 6 -
      chatRiskPenalty,
    0,
    100,
  );

  const wellnessLabel =
    wellnessScore >= 85 ? "Strong" : wellnessScore >= 70 ? "Stable" : wellnessScore >= 55 ? "Watch" : "Needs attention";

  const bucket = env.STORAGE_BUCKET;
  const ownerPhotoItems: Array<{ url: string; caption: string }> = [];
  const proPhotoItems: Array<{ url: string; caption: string }> = [];

  if (sections.includePhotos && bucket) {
    const ownerPhotos = ownerCaptures.slice(0, MAX_PHOTOS_PER_SOURCE);
    const proPhotos = proMedia.slice(0, MAX_PHOTOS_PER_SOURCE);

    for (const capture of ownerPhotos) {
      if (!capture.storagePath) continue;
      try {
        const url = await createSignedUrl(bucket, capture.storagePath, 60 * 60 * 12);
        ownerPhotoItems.push({
          url,
          caption: capture.dog?.name ? `${capture.dog.name} · Owner capture` : "Owner capture",
        });
      } catch {
        // ignore signed url errors
      }
    }

    for (const media of proPhotos) {
      try {
        const url = await createSignedUrl(bucket, media.storagePath, 60 * 60 * 12);
        proPhotoItems.push({
          url,
          caption: "Scooper capture",
        });
      } catch {
        // ignore signed url errors
      }
    }
  }

  let poopMap: CustomerEmailReportData["poopMap"] | undefined;
  // Use process.env directly as fallback since env module may be cached before dotenv loads in scripts
  const mapsApiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY
    ?? process.env.GOOGLE_MAPS_API_KEY
    ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  
  if (shouldFetchWellness && mapsApiKey) {
    const mapPoints: Array<{ lat: number; lng: number; weight: number; source: "OWNER" | "PRO" }> = [
      ...ownerCaptures
        .filter((capture) => typeof capture.gpsLat === "number" && typeof capture.gpsLng === "number")
        .map((capture) => ({
          lat: capture.gpsLat as number,
          lng: capture.gpsLng as number,
          weight: computeHeatmapWeight(capture.gpsAccuracy ?? null),
          source: "OWNER" as const,
        })),
      ...proMedia
        .filter((media) => typeof media.gpsLat === "number" && typeof media.gpsLng === "number")
        .map((media) => ({
          lat: media.gpsLat as number,
          lng: media.gpsLng as number,
          weight: computeHeatmapWeight(media.gpsAccuracy ?? null),
          source: "PRO" as const,
        })),
    ];
    
    // Count by source for legend display
    const ownerCount = mapPoints.filter((p) => p.source === "OWNER").length;
    const proCount = mapPoints.filter((p) => p.source === "PRO").length;

    if (mapPoints.length > 0) {
      // Use customer's home location for parcel lookup (like the app does)
      const homeLocation = typeof customer.latitude === "number" && typeof customer.longitude === "number"
        ? { lat: customer.latitude, lng: customer.longitude }
        : null;
      
      let parcelGeometry: ParcelGeometry | null = null;
      if (homeLocation) {
        parcelGeometry = await loadParcelBoundary(homeLocation.lat, homeLocation.lng);
      }
      
      const staticMapUrl = buildStaticMapUrl(mapPoints, mapsApiKey, parcelGeometry);
      
      if (staticMapUrl && bucket) {
        // Fetch the static map image and store it for reliable email delivery
        const imageBuffer = await fetchStaticMapImage(staticMapUrl);
        if (imageBuffer) {
          const storagePath = `reports/poop-maps/${orgId}/${customerId}/${period.periodKey}.png`;
          try {
            await uploadFile(bucket, storagePath, imageBuffer, "image/png");
            const url = await createSignedUrl(bucket, storagePath, 60 * 60 * 24 * 7); // 7 days
            if (url) {
              poopMap = { heatmapUrl: url, pointsCount: mapPoints.length, ownerCount, proCount };
            }
          } catch {
            // ignore storage failures, fall back to direct URL
          }
        }
        
        // If storage failed, use the static map URL directly (less reliable for some email clients)
        if (!poopMap && staticMapUrl) {
          poopMap = { heatmapUrl: staticMapUrl, pointsCount: mapPoints.length, ownerCount, proCount };
        }
      } else if (staticMapUrl) {
        // No storage bucket, use direct URL
        poopMap = { heatmapUrl: staticMapUrl, pointsCount: mapPoints.length, ownerCount, proCount };
      }
    }
  }

  const reportData: CustomerEmailReportData = {
    customer: {
      id: customer.id,
      name: customer.name ?? null,
      email: customer.email ?? null,
      city: customer.city ?? null,
      state: customer.state ?? null,
    },
    dogs: customer.dogs,
    period,
    stats: {
      wellnessScore,
      wellnessLabel,
      totalCaptures,
      checkInsCount,
      visitCount: completedVisits + upcomingVisits,
      walkDistanceMiles: Number.isFinite(walkDistanceMeters) ? toMiles(walkDistanceMeters) : 0,
      foodLogCount,
    },
    highlights: highlightList.slice(0, 4),
    poopMap,
  };

  if (sections.includeWellness) {
    reportData.wellness = {
      issues,
      colorSummary: summarizeCounts(colorCounts, "No color trends yet"),
      consistencySummary: summarizeCounts(consistencyCounts, "No consistency trends yet"),
      hydrationAvg,
      firmnessAvg,
      indicatorSummary: summarizeCounts(indicatorCounts, "No urgency tags yet"),
      latestSummary,
      latestIndicator,
      weeklyNotes: latestReport?.behaviorNotes ?? null,
      stoolNotes: latestReport?.stoolNotes ?? null,
    };
  }

  if (sections.includeWellness) {
    reportData.checkIns = {
      vomitingCount,
      diarrheaCount,
      medsGivenCount,
      appetiteMode,
      energyMode,
      waterMode,
      total: checkInsCount,
    };
  }

  if (sections.includeFood) {
    reportData.food = {
      total: foodLogCount,
      typeCounts,
      topAllergens,
      topItems,
    };
  }

  if (sections.includeWalks) {
    let latestRouteMapUrl: string | null = null;
    const latestWalk = walks[0]; // Already sorted by startedAt desc
    
    // Generate route map for the latest walk if it has a path
    if (latestWalk?.path && mapsApiKey) {
      const pathData = latestWalk.path as Array<{ lat: number; lng: number }>;
      if (Array.isArray(pathData) && pathData.length >= 2) {
        const routeMapUrl = buildWalkRouteMapUrl(pathData, mapsApiKey);
        
        if (routeMapUrl && bucket) {
          const imageBuffer = await fetchStaticMapImage(routeMapUrl);
          if (imageBuffer) {
            const storagePath = `reports/walk-routes/${orgId}/${customerId}/${period.periodKey}-latest.png`;
            try {
              await uploadFile(bucket, storagePath, imageBuffer, "image/png");
              const url = await createSignedUrl(bucket, storagePath, 60 * 60 * 24 * 7);
              if (url) {
                latestRouteMapUrl = url;
              }
            } catch {
              // Fall back to direct URL
            }
          }
          if (!latestRouteMapUrl && routeMapUrl) {
            latestRouteMapUrl = routeMapUrl;
          }
        } else if (routeMapUrl) {
          latestRouteMapUrl = routeMapUrl;
        }
      }
    }

    reportData.walks = {
      total: walks.length,
      distanceMiles: Number.isFinite(walkDistanceMeters) ? toMiles(walkDistanceMeters) : 0,
      durationMinutes: walkDurationSeconds / 60,
      latestRouteMapUrl,
      latestRouteDogName: latestWalk?.dogId ? customer.dogs.find(d => d.id === latestWalk.dogId)?.name ?? null : null,
      latestRouteDistanceMiles: latestWalk ? toMiles(latestWalk.distanceMeters) : null,
      latestRouteDurationMinutes: latestWalk ? latestWalk.durationSeconds / 60 : null,
    };
  }

  if (sections.includeReminders) {
    reportData.reminders = {
      upcoming: reminders.map((reminder) => ({
        title: reminder.title,
        dueAt: reminder.nextDueAt.toISOString(),
      })),
    };
  }

  if (sections.includeChats) {
    reportData.chats = {
      entries: chatEntries,
    };
  }

  if (sections.includeScooping) {
    reportData.visits = {
      completed: completedVisits,
      skipped: skippedVisits,
      upcoming: upcomingVisits,
      nextVisitDate: nextVisit?.scheduledDate?.toISOString() ?? null,
      lastVisitDate: lastVisit?.completedDate?.toISOString() ?? null,
    };
  }

  // NOTE: We intentionally do NOT include stool photos in email reports.
  // People don't want to see poop images in their inbox!
  // Instead, we just note the count - they can view details in the app.
  // Flagged items (if any) are mentioned in the highlights.

  return reportData;
}

export const emailReportUtils = {
  sanitizeEmailList,
};
