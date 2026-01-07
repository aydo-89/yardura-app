import { NextRequest, NextResponse } from 'next/server';

import { buildCustomerSetupResponse, canSetupCustomer } from '@/lib/mobile/customer-setup';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { query } from '@/lib/geo/postgis';

type ParcelBoundary = {
  parcelId: string;
  source: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
};

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const ENABLE_POSTGIS = process.env.ENABLE_POSTGIS_GEO === 'true';
const PARCEL_FALLBACK_RADIUS_METERS = 25;
const PARCEL_SNAP_DISTANCE_METERS = 45;
const PARCEL_FALLBACK_RADIUS_DEGREES = PARCEL_FALLBACK_RADIUS_METERS / 111111;
const PARCEL_QUERY_TIMEOUT_MS = Number(
  process.env.POOP_MAP_PARCEL_QUERY_TIMEOUT_MS ?? '5000',
);
const MAX_ACCURACY_METERS = Number(process.env.POOP_MAP_MAX_ACCURACY_METERS ?? '40');
const APPROX_FENCE_RADIUS_METERS = Number(
  process.env.POOP_MAP_APPROX_FENCE_RADIUS_METERS ?? '20',
);

const isAccuracyAcceptable = (value: number | null | undefined) => {
  if (value === null || value === undefined) return true;
  if (!Number.isFinite(value)) return true;
  return value <= MAX_ACCURACY_METERS;
};

async function loadParcelBoundary(lat: number, lng: number): Promise<ParcelBoundary | null> {
  if (!ENABLE_POSTGIS) return null;
  const sql = `SELECT parcel_id, source, ST_AsGeoJSON(geom) AS geom_geojson
    FROM geo.parcel
    WHERE geom && ST_Expand(ST_SetSRID(ST_Point($1, $2), 4326), $4)
      AND (
        ST_Contains(geom, ST_SetSRID(ST_Point($1, $2), 4326))
        OR ST_DWithin(
          geom::geography,
          ST_SetSRID(ST_Point($1, $2), 4326)::geography,
          $3
        )
      )
    ORDER BY ST_Distance(
      geom::geography,
      ST_SetSRID(ST_Point($1, $2), 4326)::geography
    ) ASC
    LIMIT 1;`;

  const { rows } = await query(
    sql,
    [lng, lat, PARCEL_FALLBACK_RADIUS_METERS, PARCEL_FALLBACK_RADIUS_DEGREES],
    { timeoutMs: PARCEL_QUERY_TIMEOUT_MS },
  );
  if (!rows.length || !rows[0]?.geom_geojson) return null;
  return {
    parcelId: rows[0].parcel_id,
    source: rows[0].source,
    geometry: JSON.parse(rows[0].geom_geojson),
  } satisfies ParcelBoundary;
}

async function snapPointsToParcel(
  parcelId: string,
  source: string,
  points: Array<{
    id: string;
    lat: number;
    lng: number;
    accuracy: number | null;
    capturedAt: string;
    source: 'OWNER' | 'PRO';
  }>,
) {
  if (!ENABLE_POSTGIS || points.length === 0) return points;
  const ids = points.map((point) => point.id);
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const capturedAt = points.map((point) => point.capturedAt);
  const sources = points.map((point) => point.source);

  const sql = `WITH parcel AS (
      SELECT geom
      FROM geo.parcel
      WHERE parcel_id = $1 AND source = $2
      LIMIT 1
    ),
    points AS (
      SELECT *
      FROM unnest($3::text[], $4::float8[], $5::float8[], $6::timestamptz[], $7::text[])
        AS p(id, lat, lng, captured_at, source)
    )
    SELECT
      p.id,
      p.source,
      p.captured_at,
      ST_Y(adjusted) AS lat,
      ST_X(adjusted) AS lng
    FROM points p
    CROSS JOIN parcel
    CROSS JOIN LATERAL (
      SELECT CASE
        WHEN ST_DWithin(
          parcel.geom::geography,
          ST_SetSRID(ST_Point(p.lng, p.lat), 4326)::geography,
          $8
        )
          THEN CASE
            WHEN ST_Contains(parcel.geom, ST_SetSRID(ST_Point(p.lng, p.lat), 4326))
              THEN ST_SetSRID(ST_Point(p.lng, p.lat), 4326)
            ELSE ST_ClosestPoint(parcel.geom, ST_SetSRID(ST_Point(p.lng, p.lat), 4326))
          END
        ELSE ST_SetSRID(ST_Point(p.lng, p.lat), 4326)
      END AS adjusted
    ) snap;`;

  const { rows } = await query(
    sql,
    [
      parcelId,
      source,
      ids,
      lats,
      lngs,
      capturedAt,
      sources,
      PARCEL_SNAP_DISTANCE_METERS,
    ],
    { timeoutMs: PARCEL_QUERY_TIMEOUT_MS },
  );

  const snapped = new Map<string, { lat: number; lng: number }>();
  rows.forEach((row) => {
    if (!row?.id) return;
    snapped.set(String(row.id), {
      lat: Number(row.lat),
      lng: Number(row.lng),
    });
  });

  return points.map((point) => {
    const snappedPoint = snapped.get(point.id);
    return snappedPoint ? { ...point, ...snappedPoint } : point;
  });
}

export async function GET(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let payload: ReturnType<typeof verifyMobileToken>;
  try {
    payload = verifyMobileToken(token);
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 401 });
  }

  const userId = payload.sub;
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Customer access required' }, { status: 403 });
  }
  const canSetup = canSetupCustomer(payload.roles);

  const customer = await prisma.customer.findFirst({
    where: { userId },
    select: { id: true, latitude: true, longitude: true },
  });

  if (!customer) {
    return canSetup
      ? buildCustomerSetupResponse(userId)
      : NextResponse.json({ ok: false, error: 'Customer access required' }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const daysParam = Number(searchParams.get('days') ?? 45);
  const days = Number.isFinite(daysParam) ? clampNumber(Math.floor(daysParam), 7, 120) : 45;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [ownerCaptures, proCaptures] = await Promise.all([
    prisma.customerWellnessCapture.findMany({
      where: {
        customerId: customer.id,
        capturedAt: { gte: since },
        gpsLat: { not: null },
        gpsLng: { not: null },
      },
      select: {
        id: true,
        gpsLat: true,
        gpsLng: true,
        gpsAccuracy: true,
        capturedAt: true,
      },
      orderBy: { capturedAt: 'desc' },
      take: 300,
    }),
    prisma.serviceVisitMedia.findMany({
      where: {
        assetType: 'INSIGHTSCOOP',
        capturedAt: { gte: since },
        gpsLat: { not: null },
        gpsLng: { not: null },
        stoolSampleView: { not: 'CROSS_SECTION' },
        serviceVisit: {
          customerId: customer.id,
        },
      },
      select: {
        id: true,
        gpsLat: true,
        gpsLng: true,
        gpsAccuracy: true,
        capturedAt: true,
      },
      orderBy: { capturedAt: 'desc' },
      take: 300,
    }),
  ]);

  const points = [
    ...ownerCaptures.map((capture) => ({
      id: `owner-${capture.id}`,
      lat: capture.gpsLat ?? 0,
      lng: capture.gpsLng ?? 0,
      accuracy: capture.gpsAccuracy ?? null,
      capturedAt: capture.capturedAt.toISOString(),
      source: 'OWNER' as const,
    })),
    ...proCaptures.map((capture) => ({
      id: `pro-${capture.id}`,
      lat: capture.gpsLat ?? 0,
      lng: capture.gpsLng ?? 0,
      accuracy: capture.gpsAccuracy ?? null,
      capturedAt: capture.capturedAt.toISOString(),
      source: 'PRO' as const,
    })),
  ]
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
    .filter((point) => isAccuracyAcceptable(point.accuracy));

  const homeLocation =
    typeof customer.latitude === 'number' && typeof customer.longitude === 'number'
      ? { lat: customer.latitude, lng: customer.longitude }
      : null;

  let parcelBoundary: ParcelBoundary | null = null;
  let snappedPoints = points;
  let parcelAvailability: 'available' | 'missing' | 'unknown' = homeLocation
    ? 'missing'
    : 'unknown';
  const approxFence = homeLocation
    ? { ...homeLocation, radiusMeters: APPROX_FENCE_RADIUS_METERS }
    : null;
  if (homeLocation) {
    const boundary = await loadParcelBoundary(homeLocation.lat, homeLocation.lng).catch((error) => {
      console.warn('poop-map.parcel.load.failed', error);
      return null;
    });
    if (boundary) {
      parcelBoundary = boundary;
      parcelAvailability = 'available';
      try {
        snappedPoints = await snapPointsToParcel(boundary.parcelId, boundary.source, points);
      } catch (error) {
        console.warn('poop-map.parcel.snap.failed', error);
        snappedPoints = points;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    data: {
      points: snappedPoints,
      homeLocation,
      parcel: parcelBoundary,
      parcelAvailability,
      approxFence: parcelBoundary ? null : approxFence,
    },
  });
}

export const runtime = 'nodejs';
