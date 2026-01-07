import { config } from "@/lib/env";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface OptimizedLeg {
  distanceMeters: number;
  durationSeconds: number;
  coordinates: LatLng[];
}

export interface OptimizedRoutePlan {
  orderedIndices: number[];
  legs: OptimizedLeg[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
}

const ROUTES_API_ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes";
const ROUTES_FIELD_MASK = [
  "routes.distanceMeters",
  "routes.duration",
  "routes.optimizedIntermediateWaypointIndex",
  "routes.legs.duration",
  "routes.legs.distanceMeters",
  "routes.legs.polyline.geoJsonLinestring",
  "routes.legs.polyline.encodedPolyline",
].join(",");

export const ROUTES_API_MAX_INTERMEDIATES = 23;

function requireServerKey(): string {
  const key = config.googleMapsServerApiKey ?? config.googleMapsApiKey;
  if (!key) {
    throw new Error("Google Maps server API key missing for Routes API calls");
  }
  return key;
}

function parseDuration(value?: string | null): number {
  if (!value) return 0;
  if (value.endsWith("s")) {
    return Number(value.replace("s", ""));
  }
  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const [, hours, minutes, seconds] = match;
  return (
    Number(hours ?? 0) * 3600 +
    Number(minutes ?? 0) * 60 +
    Number(seconds ?? 0)
  );
}

function decodeGeoJsonCoordinates(polyline: any): LatLng[] {
  const coords = polyline?.geoJsonLinestring?.coordinates;
  if (!Array.isArray(coords)) {
    return [];
  }
  return coords.map((pair: [number, number]) => ({
    lng: Number(pair[0]),
    lat: Number(pair[1]),
  }));
}

export async function computeOptimizedRoute(
  params: {
    start: LatLng;
    end?: LatLng | null;
    waypoints: Array<{ lat: number; lng: number; label?: string }>;
  },
): Promise<OptimizedRoutePlan | null> {
  if (!params.waypoints.length) {
    return null;
  }

  const apiKey = requireServerKey();
  const destination = params.end ?? params.start;

  const requestBody = {
    origin: { location: { latLng: { latitude: params.start.lat, longitude: params.start.lng } } },
    destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
    intermediates: params.waypoints.map((waypoint) => ({
      location: {
        latLng: {
          latitude: waypoint.lat,
          longitude: waypoint.lng,
        },
      },
    })),
    travelMode: "DRIVE",
    // Omit routingPreference when using optimizeWaypointOrder - it's not compatible
    optimizeWaypointOrder: true,
    computeAlternativeRoutes: false,
    polylineEncoding: "GEO_JSON_LINESTRING",
  };

  const response = await fetch(ROUTES_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": ROUTES_FIELD_MASK,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Routes API error ${response.status}: ${errText}`);
  }

  const payload = (await response.json()) as any;
  const route = payload?.routes?.[0];
  if (!route) {
    return null;
  }

  const waypointOrder: number[] = route.optimizedIntermediateWaypointIndex ??
    params.waypoints.map((_, idx) => idx);

  const legsData = Array.isArray(route.legs) ? route.legs : [];
  const visitLegs: OptimizedLeg[] = waypointOrder.map((_, idx) => {
    const leg = legsData[idx];
    return {
      distanceMeters: Number(leg?.distanceMeters ?? 0),
      durationSeconds: parseDuration(leg?.duration),
      coordinates: decodeGeoJsonCoordinates(leg?.polyline),
    };
  });

  const totalDistanceMeters = Number(route.distanceMeters ?? 0);
  const totalDurationSeconds = parseDuration(route.duration);

  return {
    orderedIndices: waypointOrder,
    legs: visitLegs,
    totalDistanceMeters,
    totalDurationSeconds,
  };
}
