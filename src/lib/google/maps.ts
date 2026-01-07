import { config } from "@/lib/env";

const MAX_ELEMENTS_PER_REQUEST = 80;
const MAX_DIMENSION_SIZE = 25;

// 🔍 Google API Call Tracking (enable with TRACK_GOOGLE_API_CALLS=true)
const TRACK_API_CALLS = process.env.TRACK_GOOGLE_API_CALLS === "true";
const apiCallStats = {
  distanceMatrix: { actual: 0, cached: 0 },
  directions: { actual: 0, cached: 0 },
  geocode: { actual: 0, cached: 0 },
};

function logApiCall(type: keyof typeof apiCallStats, cached: boolean) {
  if (!TRACK_API_CALLS) return;
  
  if (cached) {
    apiCallStats[type].cached++;
  } else {
    apiCallStats[type].actual++;
    console.log(`[💰 Google API] ${type.toUpperCase()} - ACTUAL API CALL #${apiCallStats[type].actual}`);
  }
}

function logApiSummary() {
  if (!TRACK_API_CALLS) return;
  
  const total = Object.values(apiCallStats).reduce((sum, stat) => sum + stat.actual, 0);
  const totalCached = Object.values(apiCallStats).reduce((sum, stat) => sum + stat.cached, 0);
  
  console.log("\n" + "=".repeat(60));
  console.log("📊 GOOGLE MAPS API USAGE SUMMARY");
  console.log("=".repeat(60));
  console.log(`Distance Matrix:  ${apiCallStats.distanceMatrix.actual} actual | ${apiCallStats.distanceMatrix.cached} cached`);
  console.log(`Directions:       ${apiCallStats.directions.actual} actual | ${apiCallStats.directions.cached} cached`);
  console.log(`Geocoding:        ${apiCallStats.geocode.actual} actual | ${apiCallStats.geocode.cached} cached`);
  console.log("-".repeat(60));
  console.log(`TOTAL API CALLS:  ${total} actual | ${totalCached} cached`);
  console.log(`💵 CACHE SAVINGS:  ${totalCached} calls avoided (${totalCached > 0 ? ((totalCached / (total + totalCached)) * 100).toFixed(1) : 0}%)`);
  console.log("=".repeat(60) + "\n");
}

if (TRACK_API_CALLS) {
  console.log("\n🔍 [Google API Tracking] ENABLED - monitoring all API calls\n");
  // Log summary every 5 minutes
  setInterval(logApiSummary, 5 * 60 * 1000);
  // Log on process exit
  process.on("SIGINT", () => {
    logApiSummary();
    process.exit();
  });
}

function getApiKey(): string {
  const key = config.googleMapsServerApiKey ?? config.googleMapsApiKey;
  if (!key) {
    throw new Error(
      "Google Maps server API key is not configured. Set GOOGLE_MAPS_SERVER_API_KEY (preferred) or GOOGLE_MAPS_API_KEY.",
    );
  }
  return key;
}

function decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

export interface GeocodeResult {
  formattedAddress: string;
  location: { lat: number; lng: number };
  placeId?: string;
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  logApiCall("geocode", false);
  const query = new URLSearchParams({ address, key: getApiKey() });
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${query.toString()}`,
  );

  if (!response.ok) {
    throw new Error(`Google Geocoding failed (${response.status})`);
  }

  const json = (await response.json()) as {
    status: string;
    results: Array<{
      formatted_address: string;
      geometry: { location: { lat: number; lng: number } };
      place_id?: string;
    }>;
  };

  if (json.status !== "OK" || !json.results.length) {
    return null;
  }

  const top = json.results[0];
  const result: GeocodeResult = {
    formattedAddress: top.formatted_address,
    location: top.geometry.location,
    placeId: top.place_id,
  };

  return result;
}

export interface DistanceMatrixLeg {
  origin: string;
  destination: string;
  distanceMeters: number;
  durationSeconds: number;
}

export interface DistanceMatrixResponse {
  legs: DistanceMatrixLeg[];
  raw?: unknown;
  matrix: Array<Array<{ distanceMeters: number; durationSeconds: number } | null>>;
}

export interface DirectionsRoute {
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline: string | null;
}

export async function fetchDirectionsRoute(
  origin: string,
  destination: string,
): Promise<DirectionsRoute | null> {
  if (!origin || !destination) {
    return null;
  }
  
  logApiCall("directions", false);
  const params = new URLSearchParams({
    origin,
    destination,
    key: getApiKey(),
    mode: "driving",
    units: "imperial",
  });

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error(`Google Directions failed (${response.status})`);
  }

  const json = (await response.json()) as {
    status: string;
    routes?: Array<{
      overview_polyline?: { points?: string };
      legs?: Array<{
        distance?: { value: number };
        duration?: { value: number };
        steps?: Array<{ polyline?: { points?: string } }>;
      }>;
    }>;
  };

  if (json.status !== "OK" || !json.routes?.length) {
    return null;
  }

  const route = json.routes[0];
  const leg = route.legs?.[0];
  const overview = route.overview_polyline?.points ?? "";

  let coordinates: [number, number][] = [];
  if (overview) {
    coordinates = decodePolyline(overview).map((point) => [point.lng, point.lat]);
  }

  if (!coordinates.length && leg?.steps?.length) {
    leg.steps.forEach((step) => {
      if (!step.polyline?.points) return;
      const segment = decodePolyline(step.polyline.points).map((point) => [point.lng, point.lat] as [number, number]);
      if (!segment.length) return;
      if (coordinates.length) {
        // Avoid duplicating the connecting coordinate
        const last = coordinates[coordinates.length - 1];
        const first = segment[0];
        if (last[0] === first[0] && last[1] === first[1]) {
          coordinates.push(...segment.slice(1));
        } else {
          coordinates.push(...segment);
        }
      } else {
        coordinates = segment;
      }
    });
  }

  const payload: DirectionsRoute = {
    coordinates,
    distanceMeters: leg?.distance?.value ?? 0,
    durationSeconds: leg?.duration?.value ?? 0,
    encodedPolyline: overview || null,
  };

  return payload;
}

type TravelMode = "driving" | "walking" | "bicycling" | "transit";

const ROUTES_TRAVEL_MODE: Record<TravelMode, string> = {
  driving: "DRIVE",
  walking: "WALK",
  bicycling: "BICYCLE",
  transit: "DRIVE",
};

function parseLatLngString(coord: string): { latitude: number; longitude: number } {
  const [latRaw, lngRaw] = coord.split(",");
  const latitude = Number(latRaw?.trim());
  const longitude = Number(lngRaw?.trim());
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    throw new Error(`Invalid coordinate: ${coord}`);
  }
  return { latitude, longitude };
}

function parseDurationSeconds(duration?: string | null | { seconds?: string | number }): number {
  if (!duration) {
    return 0;
  }
  
  // Handle duration as object (e.g., { seconds: "123" })
  if (typeof duration === "object" && duration.seconds !== undefined) {
    const seconds = typeof duration.seconds === "string" ? duration.seconds : String(duration.seconds);
    const match = seconds.match(/([0-9.]+)/);
    return match ? Number(match[1]) || 0 : 0;
  }
  
  // Handle duration as string (e.g., "123s" or "123")
  if (typeof duration === "string") {
    const match = duration.match(/([0-9.]+)s?/);
    if (match) {
      return Number(match[1]) || 0;
    }
    return Number(duration) || 0;
  }
  
  return 0;
}

async function fetchRoutesMatrixData(
  origins: string[],
  destinations: string[],
  travelMode: TravelMode,
): Promise<DistanceMatrixResponse> {
  const originWaypoints = origins.map((coord) => ({
    waypoint: { location: { latLng: parseLatLngString(coord) } },
  }));
  const destinationWaypoints = destinations.map((coord) => ({
    waypoint: { location: { latLng: parseLatLngString(coord) } },
  }));

  const response = await fetch(
    "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": getApiKey(),
        "X-Goog-FieldMask": "originIndex,destinationIndex,distanceMeters,duration,status",
      },
      body: JSON.stringify({
        origins: originWaypoints,
        destinations: destinationWaypoints,
        travelMode: ROUTES_TRAVEL_MODE[travelMode] ?? ROUTES_TRAVEL_MODE.driving,
        routingPreference: "TRAFFIC_AWARE",
      }),
    },
  );

  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Routes API distance matrix failed (${response.status}): ${rawText.slice(0, 200)}`,
    );
  }

  const legs: DistanceMatrixLeg[] = [];
  const matrix: DistanceMatrixResponse["matrix"] = Array.from(
    { length: origins.length },
    () => Array.from({ length: destinations.length }, () => null),
  );

  const applyRouteMatrixEntries = (
    entries: Array<{
      originIndex?: number;
      destinationIndex?: number;
      distanceMeters?: number;
      duration?: string | { seconds?: string | number };
      status?: { code?: number | string; message?: string };
    }>,
  ) => {
    for (const entry of entries) {
      if (!Number.isInteger(entry.originIndex) || !Number.isInteger(entry.destinationIndex)) {
        continue;
      }

      const statusCode = entry.status?.code;
      if (statusCode && statusCode !== 0 && statusCode !== "OK" && statusCode !== 200) {
        continue;
      }

      const originIndex = entry.originIndex as number;
      const destinationIndex = entry.destinationIndex as number;
      const distanceMeters = entry.distanceMeters ?? 0;
      const durationSeconds = parseDurationSeconds(entry.duration);

      const leg: DistanceMatrixLeg = {
        origin: origins[originIndex] ?? "",
        destination: destinations[destinationIndex] ?? "",
        distanceMeters,
        durationSeconds,
      };
      legs.push(leg);

      if (!matrix[originIndex]) {
        matrix[originIndex] = [];
      }
      matrix[originIndex][destinationIndex] = { distanceMeters, durationSeconds };
    }
  };

  // Try to parse as newline-delimited JSON (streaming format)
  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length > 0) {
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as {
          originIndex?: number;
          destinationIndex?: number;
          distanceMeters?: number;
          duration?: string | { seconds?: string | number };
          status?: { code?: number | string; message?: string };
        };
        applyRouteMatrixEntries([entry]);
      } catch (error) {
        continue;
      }
    }
  }

  if (legs.length === 0) {
    try {
      const parsed = JSON.parse(rawText) as
        | Array<{
            originIndex?: number;
            destinationIndex?: number;
            distanceMeters?: number;
            duration?: string | { seconds?: string | number };
            status?: { code?: number | string; message?: string };
          }>
        | {
            routeMatrix?: Array<{
              originIndex?: number;
              destinationIndex?: number;
              distanceMeters?: number;
              duration?: string | { seconds?: string | number };
              status?: { code?: number | string; message?: string };
            }>;
          };

      if (Array.isArray(parsed)) {
        applyRouteMatrixEntries(parsed);
      } else if (Array.isArray(parsed.routeMatrix)) {
        applyRouteMatrixEntries(parsed.routeMatrix);
      }
    } catch (error) {
      console.warn("[google-routes] Failed to parse Routes Matrix response", error);
      console.warn("[google-routes] Response preview:", rawText.slice(0, 500));
      throw new Error(`Failed to parse Routes Matrix API response: ${error}`);
    }
  }

  // If we didn't get any valid entries, log warning but don't throw
  if (legs.length === 0) {
    console.warn("[google-routes] Routes Matrix API returned no valid entries");
    console.warn("[google-routes] Response preview:", rawText.slice(0, 500));
  }

  return { legs, matrix };
}

async function fetchLegacyDistanceMatrixData(
  origins: string[],
  destinations: string[],
  travelMode: TravelMode,
): Promise<DistanceMatrixResponse> {
  const params = new URLSearchParams({
    origins: origins.join("|"),
    destinations: destinations.join("|"),
    key: getApiKey(),
    mode: travelMode,
    units: "imperial",
  });

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error(`Google Distance Matrix failed (${response.status})`);
  }

  const json = (await response.json()) as {
    status: string;
    origin_addresses: string[];
    destination_addresses: string[];
    rows: Array<{ elements: Array<{ status: string; distance?: { value: number }; duration?: { value: number } }> }>;
  };

  if (json.status !== "OK") {
    throw new Error(`Google Distance Matrix error: ${json.status}`);
  }

  const legs: DistanceMatrixLeg[] = [];
  const matrix: DistanceMatrixResponse["matrix"] = [];

  json.rows.forEach((row, originIndex) => {
    const matrixRow: Array<{ distanceMeters: number; durationSeconds: number } | null> = [];
    row.elements.forEach((element, destinationIndex) => {
      if (element.status !== "OK") {
        matrixRow.push(null);
        return;
      }
      const distanceMeters = element.distance?.value ?? 0;
      const durationSeconds = element.duration?.value ?? 0;
      legs.push({
        origin: json.origin_addresses[originIndex] ?? origins[originIndex],
        destination:
          json.destination_addresses[destinationIndex] ??
          destinations[destinationIndex],
        distanceMeters,
        durationSeconds,
      });
      matrixRow.push({ distanceMeters, durationSeconds });
    });
    matrix.push(matrixRow);
  });

  return { legs, matrix };
}

async function fetchDistanceMatrixChunk(
  origins: string[],
  destinations: string[],
  options?: {
    travelMode?: TravelMode;
  },
): Promise<DistanceMatrixResponse> {
  if (!origins.length || !destinations.length) {
    return { legs: [], matrix: [] };
  }
  
  logApiCall("distanceMatrix", false);

  const travelMode = options?.travelMode ?? "driving";

  // Try Routes Matrix API first (newer, more efficient)
  // Falls back to legacy API if it fails
  try {
    const payload = await fetchRoutesMatrixData(origins, destinations, travelMode);
    return payload;
  } catch (routeError) {
    console.warn("[google] Routes Matrix API failed, falling back to legacy Distance Matrix API", routeError);
    const payload = await fetchLegacyDistanceMatrixData(origins, destinations, travelMode);
    return payload;
  }
}

export async function fetchDistanceMatrix(
  origins: string[],
  destinations: string[],
  options?: {
    travelMode?: "driving" | "walking" | "bicycling" | "transit";
  },
): Promise<DistanceMatrixResponse> {
  if (!origins.length || !destinations.length) {
    return { legs: [], matrix: [] };
  }

  if (origins.length <= MAX_DIMENSION_SIZE && destinations.length <= MAX_DIMENSION_SIZE && origins.length * destinations.length <= MAX_ELEMENTS_PER_REQUEST) {
    return fetchDistanceMatrixChunk(origins, destinations, options);
  }

  const matrix: DistanceMatrixResponse["matrix"] = Array.from({ length: origins.length }, () =>
    Array.from({ length: destinations.length }, () => null),
  );
  const legs: DistanceMatrixLeg[] = [];

  for (let originStart = 0; originStart < origins.length; originStart += MAX_DIMENSION_SIZE) {
    const originSlice = origins.slice(originStart, originStart + MAX_DIMENSION_SIZE);
    const maxDestPerChunk = Math.max(
      1,
      Math.min(
        MAX_DIMENSION_SIZE,
        Math.floor(MAX_ELEMENTS_PER_REQUEST / originSlice.length) || 1,
      ),
    );

    for (let destStart = 0; destStart < destinations.length; destStart += maxDestPerChunk) {
      const destSlice = destinations.slice(destStart, destStart + maxDestPerChunk);
      const chunk = await fetchDistanceMatrixChunk(originSlice, destSlice, options);
      chunk.legs.forEach((leg) => legs.push(leg));
      chunk.matrix.forEach((row, rowIdx) => {
        row?.forEach((cell, colIdx) => {
          matrix[originStart + rowIdx][destStart + colIdx] = cell;
        });
      });
    }
  }

  return { legs, matrix };
}

export interface DirectionsPath {
  coordinates: Array<{ lat: number; lng: number }>;
  distanceMeters?: number;
  durationSeconds?: number;
}

export async function fetchDrivingDirections(
  points: Array<{ lat: number; lng: number }>,
): Promise<DirectionsPath | null> {
  if (!points.length) return null;
  if (points.length === 1) {
    return { coordinates: points.slice() };
  }

  const origin = `${points[0].lat},${points[0].lng}`;
  const destination = `${points[points.length - 1].lat},${points[points.length - 1].lng}`;

  const params = new URLSearchParams({
    origin,
    destination,
    key: getApiKey(),
    mode: "driving",
    units: "imperial",
  });

  if (points.length > 2) {
    params.set(
      "waypoints",
      points
        .slice(1, -1)
        .map((point) => `${point.lat},${point.lng}`)
        .join("|"),
    );
  }

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error(`Google Directions failed (${response.status})`);
  }

  const json = (await response.json()) as {
    status: string;
    routes: Array<{
      overview_polyline?: { points: string };
      legs?: Array<{ distance?: { value: number }; duration?: { value: number } }>;
    }>;
  };

  if (json.status !== "OK" || !json.routes.length) {
    return null;
  }

  const primary = json.routes[0];
  const encoded = primary.overview_polyline?.points;
  if (!encoded) {
    return null;
  }

  const decoded = decodePolyline(encoded);
  const totalDistance = primary.legs?.reduce((sum, leg) => sum + (leg.distance?.value ?? 0), 0);
  const totalDuration = primary.legs?.reduce((sum, leg) => sum + (leg.duration?.value ?? 0), 0);

  const payload: DirectionsPath = {
    coordinates: decoded,
    distanceMeters: totalDistance,
    durationSeconds: totalDuration,
  };
  return payload;
}
