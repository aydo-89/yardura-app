import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/geo/postgis";

// Google Places API configuration (optional fallback)
const GOOGLE_PLACES_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

interface LocationOption {
  id: string;
  label: string;
  city: string;
  state: string;
  type: "city" | "county";
  zipCount: number;
}

type PlaceRow = {
  place_id: string;
  name: string;
  state: string;
};

const AUTOCOMPLETE_CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes
const autocompleteCache = new Map<
  string,
  { timestamp: number; options: LocationOption[] }
>();

function normalizeState(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim().toUpperCase();
}

function buildCacheKey(queryText: string, state: string | null, limit: number) {
  return `${state ?? "ALL"}|${queryText.toLowerCase()}|${limit}`;
}

function formatOption(row: PlaceRow): LocationOption {
  const state = normalizeState(row.state);
  return {
    id: `place-${row.place_id}`,
    label: `${row.name}, ${state}`,
    city: row.name,
    state,
    type: "city",
    zipCount: 0, // ZIP count removed for performance
  };
}

async function fetchPlaces(
  queryText: string,
  limit: number,
  stateFilter: string | null,
): Promise<LocationOption[]> {
  const trimmed = queryText.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const params: unknown[] = [];
  let whereClause = "";

  const parts = trimmed
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const cityPart = parts[0] ?? trimmed;
  const queryStatePart = parts.length > 1 ? normalizeState(parts[parts.length - 1]) : null;
  const effectiveState = stateFilter || (queryStatePart && queryStatePart.length <= 2 ? queryStatePart : null);

  if (effectiveState) {
    params.push(effectiveState);
    whereClause += ` AND p.state = $${params.length}`;
  }

  if (cityPart) {
    const sanitizedCity = cityPart.replace(/[%_]+/g, "");
    params.push(`${sanitizedCity}%`);
    const placeholder = `$${params.length}`;
    whereClause += ` AND p.name ILIKE ${placeholder}`;
  }

  params.push(limit);
  const limitPlaceholder = `$${params.length}`;

  const sql = `
    SELECT place_id, name, state
    FROM geo.place p
    WHERE TRUE ${whereClause}
    ORDER BY p.name ASC
    LIMIT ${limitPlaceholder};
  `;

  const { rows } = await query<PlaceRow>(sql, params);
  return rows.map(formatOption);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawQuery = searchParams.get("q") ?? "";
    const limitParam = Number.parseInt(searchParams.get("limit") ?? "20", 10);
    const stateParam = normalizeState(searchParams.get("state"));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(50, limitParam) : 20;
    const stateFilter = stateParam && stateParam !== "ALL" ? stateParam : null;

    const normalizedQuery = rawQuery.trim();
    const cacheKey = buildCacheKey(normalizedQuery, stateFilter, limit);
    const cached = autocompleteCache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.timestamp < AUTOCOMPLETE_CACHE_TTL_MS) {
      return NextResponse.json({ options: cached.options });
    }

    let places: LocationOption[] = [];
    if (normalizedQuery.length >= 2) {
      places = await fetchPlaces(normalizedQuery, limit, stateFilter);
    }

    if (places.length === 0 && normalizedQuery.length >= 2 && GOOGLE_PLACES_API_KEY) {
      try {
        const placesUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(normalizedQuery)}&types=(cities)&components=country:us&key=${GOOGLE_PLACES_API_KEY}`;
        const response = await fetch(placesUrl, { cache: "force-cache" });
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data.predictions) && data.predictions.length > 0) {
            places = data.predictions
              .filter((prediction: any) => prediction.terms && prediction.terms.length >= 2)
              .slice(0, limit)
              .map((prediction: any) => {
                const terms = prediction.terms;
                const cityName = terms[0].value;
                const stateName = normalizeState(terms[terms.length - 2]?.value ?? "");
                return {
                  id: `google-${prediction.place_id}`,
                  label: `${cityName}, ${stateName}`,
                  city: cityName,
                  state: stateName,
                  type: "city" as const,
                  zipCount: 0,
                } satisfies LocationOption;
              });
          }
        }
      } catch (placesError) {
        console.warn("Google Places fallback failed", placesError);
      }
    }

    autocompleteCache.set(cacheKey, { timestamp: now, options: places });
    return NextResponse.json({ options: places });
  } catch (error) {
    console.error("Autocomplete error:", error);
    return NextResponse.json({ error: "Autocomplete failed" }, { status: 500 });
  }
}
