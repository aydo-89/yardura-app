import { query } from "./postgis";

/**
 * Parcel boundary snapping utilities for GPS coordinate validation.
 *
 * SCOOPER USE CASE:
 * - Scoopers are ALWAYS on the property when capturing stool samples
 * - GPS inaccuracy can place points outside the parcel boundary
 * - We snap points to the nearest location within the parcel
 *
 * OWNER USE CASE:
 * - Owners may capture at home (should snap to parcel) or on a walk (no snapping)
 * - Caller must determine context and pass appropriate options
 */

// Check at runtime (not module load) for scripts using dotenv
const isPostgisEnabled = () => process.env.ENABLE_POSTGIS_GEO === "true";

// Maximum distance (meters) for snapping - points further than this are suspicious
const MAX_SNAP_DISTANCE_METERS = 50;
// Query timeout to prevent blocking
const SNAP_QUERY_TIMEOUT_MS = 3000;
// Fallback radius when looking for nearby parcel
const PARCEL_SEARCH_RADIUS_METERS = 75;

export type ParcelInfo = {
  parcelId: string;
  source: string;
  geometry?: GeoJSON.Polygon | GeoJSON.MultiPolygon;
};

export type SnapResult = {
  /** Whether snapping was applied */
  snapped: boolean;
  /** Whether the point is inside the parcel (before any snapping) */
  wasInside: boolean;
  /** Original GPS coordinates */
  rawLat: number;
  rawLng: number;
  /** Snapped coordinates (same as raw if already inside or no parcel) */
  lat: number;
  lng: number;
  /** Distance moved during snapping (meters), null if no snap */
  correctionMeters: number | null;
  /** Parcel info if found */
  parcel: ParcelInfo | null;
  /** Status of snapping operation */
  status: "inside" | "snapped" | "too_far" | "no_parcel" | "disabled" | "error";
};

/**
 * Find the parcel boundary for a given location (customer's home address).
 * Uses the address coordinates, not the GPS capture point.
 */
export async function findParcelForLocation(
  homeLat: number,
  homeLng: number,
): Promise<ParcelInfo | null> {
  if (!isPostgisEnabled()) return null;

  const sql = `
    SELECT parcel_id, source, ST_AsGeoJSON(geom) AS geom_geojson
    FROM geo.parcel
    WHERE
      geom && ST_Expand(ST_SetSRID(ST_Point($1, $2), 4326), $4)
      AND (
        ST_Contains(geom, ST_SetSRID(ST_Point($1, $2), 4326))
        OR ST_DWithin(
          centroid::geography,
          ST_SetSRID(ST_Point($1, $2), 4326)::geography,
          $3
        )
      )
    ORDER BY ST_Distance(
      centroid,
      ST_SetSRID(ST_Point($1, $2), 4326)
    ) ASC
    LIMIT 1`;

  try {
    const radiusDegrees = PARCEL_SEARCH_RADIUS_METERS / 111111;
    const { rows } = await query(
      sql,
      [homeLng, homeLat, PARCEL_SEARCH_RADIUS_METERS, radiusDegrees],
      { timeoutMs: SNAP_QUERY_TIMEOUT_MS },
    );

    if (!rows.length || !rows[0]?.geom_geojson) return null;

    return {
      parcelId: rows[0].parcel_id,
      source: rows[0].source,
      geometry: JSON.parse(rows[0].geom_geojson),
    };
  } catch (error) {
    console.warn("[parcelSnap] Failed to find parcel:", error);
    return null;
  }
}

/**
 * Validate and snap a GPS point to be within a parcel boundary.
 *
 * This is the core function for ensuring stool capture locations are valid.
 * For scoopers, points MUST be within the parcel, so we snap if outside.
 *
 * @param gpsLat - Captured GPS latitude
 * @param gpsLng - Captured GPS longitude
 * @param homeLat - Customer's home address latitude
 * @param homeLng - Customer's home address longitude
 * @param options - Additional options for snapping behavior
 */
export async function snapToParcel(
  gpsLat: number,
  gpsLng: number,
  homeLat: number,
  homeLng: number,
  options?: {
    /** Pre-fetched parcel info to avoid extra query */
    parcel?: ParcelInfo | null;
    /** Maximum distance to snap (meters) - beyond this, flag as suspicious */
    maxSnapDistance?: number;
  },
): Promise<SnapResult> {
  const maxSnapDistance = options?.maxSnapDistance ?? MAX_SNAP_DISTANCE_METERS;

  // Base result with raw coordinates
  const baseResult = {
    rawLat: gpsLat,
    rawLng: gpsLng,
    lat: gpsLat,
    lng: gpsLng,
    correctionMeters: null as number | null,
  };

  if (!isPostgisEnabled()) {
    return {
      ...baseResult,
      snapped: false,
      wasInside: false,
      parcel: null,
      status: "disabled",
    };
  }

  // Find parcel if not provided
  let parcel = options?.parcel;
  if (parcel === undefined) {
    parcel = await findParcelForLocation(homeLat, homeLng);
  }

  if (!parcel) {
    return {
      ...baseResult,
      snapped: false,
      wasInside: false,
      parcel: null,
      status: "no_parcel",
    };
  }

  try {
    // Single query to check if inside and get snapped point if not
    const sql = `
      WITH parcel AS (
        SELECT geom
        FROM geo.parcel
        WHERE parcel_id = $1 AND source = $2
        LIMIT 1
      ),
      capture AS (
        SELECT ST_SetSRID(ST_Point($3, $4), 4326) AS point
      )
      SELECT
        ST_Contains(parcel.geom, capture.point) AS is_inside,
        ST_Distance(parcel.geom::geography, capture.point::geography) AS distance_meters,
        CASE
          WHEN ST_Contains(parcel.geom, capture.point) THEN capture.point
          WHEN ST_DWithin(parcel.geom::geography, capture.point::geography, $5)
            THEN ST_ClosestPoint(parcel.geom, capture.point)
          ELSE capture.point
        END AS snapped_point
      FROM parcel, capture`;

    const { rows } = await query(
      sql,
      [parcel.parcelId, parcel.source, gpsLng, gpsLat, maxSnapDistance],
      { timeoutMs: SNAP_QUERY_TIMEOUT_MS },
    );

    if (!rows.length) {
      return {
        ...baseResult,
        snapped: false,
        wasInside: false,
        parcel,
        status: "no_parcel",
      };
    }

    const row = rows[0];
    const isInside = Boolean(row.is_inside);
    const distanceMeters = Number(row.distance_meters) || 0;

    if (isInside) {
      // Point is already inside parcel - no snapping needed
      return {
        ...baseResult,
        snapped: false,
        wasInside: true,
        parcel,
        status: "inside",
      };
    }

    // Point is outside - check if we should snap
    if (distanceMeters > maxSnapDistance) {
      // Too far from parcel - this is suspicious, don't auto-snap
      return {
        ...baseResult,
        snapped: false,
        wasInside: false,
        parcel,
        correctionMeters: distanceMeters,
        status: "too_far",
      };
    }

    // Extract snapped coordinates
    const snappedPointSql = `
      SELECT
        ST_Y($1::geometry) AS lat,
        ST_X($1::geometry) AS lng
    `;
    const { rows: coordRows } = await query(snappedPointSql, [row.snapped_point]);

    if (!coordRows.length) {
      return {
        ...baseResult,
        snapped: false,
        wasInside: false,
        parcel,
        status: "error",
      };
    }

    const snappedLat = Number(coordRows[0].lat);
    const snappedLng = Number(coordRows[0].lng);

    return {
      rawLat: gpsLat,
      rawLng: gpsLng,
      lat: snappedLat,
      lng: snappedLng,
      snapped: true,
      wasInside: false,
      parcel,
      correctionMeters: Math.round(distanceMeters * 10) / 10,
      status: "snapped",
    };
  } catch (error) {
    console.warn("[parcelSnap] Snap query failed:", error);
    return {
      ...baseResult,
      snapped: false,
      wasInside: false,
      parcel,
      status: "error",
    };
  }
}

/**
 * Check if a point is inside a parcel boundary (simple containment check).
 * Faster than full snap when you just need validation.
 */
export async function isPointInParcel(
  lat: number,
  lng: number,
  parcelId: string,
  source: string,
): Promise<boolean> {
  if (!isPostgisEnabled()) return false;

  try {
    const sql = `
      SELECT ST_Contains(geom, ST_SetSRID(ST_Point($3, $4), 4326)) AS is_inside
      FROM geo.parcel
      WHERE parcel_id = $1 AND source = $2
      LIMIT 1`;

    const { rows } = await query(
      sql,
      [parcelId, source, lng, lat],
      { timeoutMs: SNAP_QUERY_TIMEOUT_MS },
    );

    return Boolean(rows[0]?.is_inside);
  } catch (error) {
    console.warn("[parcelSnap] Containment check failed:", error);
    return false;
  }
}

/**
 * Calculate haversine distance between two points (for non-PostGIS use).
 * Returns distance in meters.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Determine if a capture is likely at home vs on a walk.
 * Uses distance from home address as primary heuristic.
 */
export function isCaptureAtHome(
  captureLat: number,
  captureLng: number,
  homeLat: number,
  homeLng: number,
  thresholdMeters: number = 100,
): boolean {
  const distance = haversineDistance(captureLat, captureLng, homeLat, homeLng);
  return distance <= thresholdMeters;
}
