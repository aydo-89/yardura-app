/**
 * City Search API
 * Uses the same autocomplete endpoint as tile studio
 * Returns cities merged with tile data when available
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/geo/postgis";
import { prisma } from "@/lib/prisma";

const MAX_RESULTS = 50;
const GOOGLE_PLACES_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

interface CitySearchResult {
  placeId: string;
  name: string;
  state: string;
  population: number;
  // Tile data (if we have coverage)
  hasService: boolean;
  status: "LIVE" | "WAITLIST" | "DRAFT" | "NONE";
  tileCount: number;
  zipCount: number;
  // Waitlist data
  waitlistCount: number;
  // Whether this city has a detailed page
  hasDetailPage: boolean;
  slug: string;
}

interface LocationOption {
  id: string;
  label: string;
  city: string;
  state: string;
  type: "city" | "county";
  zipCount: number;
}

// Cities that have detailed /city/[slug] pages
const CITIES_WITH_DETAIL_PAGES: Record<string, string> = {
  "minneapolis": "minneapolis",
  "st. paul": "st-paul",
  "bloomington": "bloomington",
  "edina": "edina",
  "eden prairie": "eden-prairie",
  "maple grove": "maple-grove",
  "plymouth": "plymouth",
  "eagan": "eagan",
  "burnsville": "burnsville",
  "lakeville": "lakeville",
  "woodbury": "woodbury",
  "st. louis park": "st-louis-park",
  "richfield": "richfield",
  "apple valley": "apple-valley",
  "maplewood": "maplewood",
  "shoreview": "shoreview",
  "inver grove heights": "inver-grove-heights",
  "cottage grove": "cottage-grove",
  "mendota heights": "mendota-heights",
  "minnetonka": "minnetonka",
  "st. cloud": "st-cloud",
};

// Fetch cities from geo.place or Google Places API (same as tile studio autocomplete)
async function fetchCities(
  queryText: string,
  limit: number,
  stateFilter: string | null
): Promise<LocationOption[]> {
  const trimmed = queryText.trim();
  if (trimmed.length < 2) return [];

  // Parse "City, ST" format
  const parts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);
  const cityPart = parts[0] ?? trimmed;
  const queryStatePart = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : null;
  const effectiveState = stateFilter || (queryStatePart && queryStatePart.length <= 2 ? queryStatePart : null);

  // Try geo.place first
  let places: LocationOption[] = [];
  try {
    const params: unknown[] = [];
    let whereClause = "";

    if (effectiveState) {
      params.push(effectiveState);
      whereClause += ` AND p.state = $${params.length}`;
    }

    if (cityPart) {
      const sanitizedCity = cityPart.replace(/[%_]+/g, "");
      params.push(`${sanitizedCity}%`);
      whereClause += ` AND p.name ILIKE $${params.length}`;
    }

    params.push(limit);
    const sql = `
      SELECT place_id, name, state, COALESCE(population, 0) as population
      FROM geo.place p
      WHERE TRUE ${whereClause}
      ORDER BY population DESC, name ASC
      LIMIT $${params.length};
    `;

    const { rows } = await query<{ place_id: string; name: string; state: string; population: number }>(sql, params);
    places = rows.map((row) => ({
      id: `place-${row.place_id}`,
      label: `${row.name}, ${row.state}`,
      city: row.name,
      state: row.state.toUpperCase(),
      type: "city" as const,
      zipCount: 0,
      population: row.population,
    }));
  } catch (err) {
    console.warn("[cities/search] geo.place query failed:", err);
  }

  // Fallback to Google Places API if no results and API key is available
  if (places.length === 0 && GOOGLE_PLACES_API_KEY) {
    try {
      console.log("[cities/search] Falling back to Google Places API");
      const placesUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(trimmed)}&types=(cities)&components=country:us&key=${GOOGLE_PLACES_API_KEY}`;
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
              const stateName = terms[terms.length - 2]?.value?.toUpperCase() ?? "";
              return {
                id: `google-${prediction.place_id}`,
                label: `${cityName}, ${stateName}`,
                city: cityName,
                state: stateName,
                type: "city" as const,
                zipCount: 0,
                population: 0, // Google doesn't provide population
              };
            });
        }
      }
    } catch (placesError) {
      console.warn("[cities/search] Google Places fallback failed:", placesError);
    }
  }

  return places;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get("q")?.trim() || "";
  const state = searchParams.get("state")?.trim().toUpperCase() || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), MAX_RESULTS);

  if (q.length < 2 && !state) {
    return NextResponse.json({ cities: [], message: "Query too short" });
  }

  try {
    // Fetch cities using the same approach as tile studio
    const locationOptions = await fetchCities(q, limit, state || null);

    // Convert to our format with population
    const cities = locationOptions.map((opt) => ({
      place_id: opt.id,
      name: opt.city,
      state: opt.state,
      population: (opt as any).population || 0,
    }));

    if (cities.length === 0) {
      return NextResponse.json({ cities: [], message: "No cities found" });
    }

    // Get waitlist counts for these cities
    const placeIds = cities.map((c) => c.place_id);
    let waitlistMap = new Map<string, number>();
    try {
      const waitlistCounts = await prisma.cityWaitlist.groupBy({
        by: ["placeId"],
        where: { placeId: { in: placeIds } },
        _count: { id: true },
      });
      waitlistMap = new Map(
        waitlistCounts.map((w: { placeId: string; _count: { id: number } }) => [w.placeId, w._count.id])
      );
    } catch (waitlistError) {
      // Table might not exist yet - ignore
      console.warn("[cities/search] Could not get waitlist counts:", waitlistError);
    }

    // Check for tile coverage by city name
    // This queries our tiles to see if we have service in these cities
    const cityNames = cities.map((c) => c.name.toLowerCase());
    const tileQuery = `
      SELECT
        regexp_replace(st.slug, '-[0-9]+$', '') AS city_slug,
        st.name,
        st.status,
        COUNT(*) as tile_count,
        COUNT(DISTINCT stz.zip) as zip_count
      FROM geo.service_tile st
      LEFT JOIN geo.service_tile_zip stz ON stz.tile_id = st.tile_id
      WHERE st.org_id = 'yardura'
        AND regexp_replace(lower(st.name), ' [0-9]+$', '') = ANY($1::text[])
      GROUP BY regexp_replace(st.slug, '-[0-9]+$', ''), st.name, st.status
    `;
    
    const { rows: tiles } = await query<{
      city_slug: string;
      name: string;
      status: string;
      tile_count: number;
      zip_count: number;
    }>(tileQuery, [cityNames]);

    // Aggregate tile data by city
    const tileDataMap = new Map<string, {
      status: "LIVE" | "WAITLIST" | "DRAFT";
      tileCount: number;
      zipCount: number;
    }>();

    for (const tile of tiles) {
      const cityKey = tile.name.toLowerCase().replace(/ \d+$/, "");
      const existing = tileDataMap.get(cityKey);
      
      // Priority: LIVE > WAITLIST > DRAFT
      const statusPriority = { LIVE: 3, WAITLIST: 2, DRAFT: 1, SUSPENDED: 0 };
      const newStatus = tile.status as "LIVE" | "WAITLIST" | "DRAFT";
      
      if (!existing) {
        tileDataMap.set(cityKey, {
          status: newStatus,
          tileCount: Number(tile.tile_count),
          zipCount: Number(tile.zip_count),
        });
      } else {
        // Use highest priority status
        if (statusPriority[newStatus] > statusPriority[existing.status]) {
          existing.status = newStatus;
        }
        existing.tileCount += Number(tile.tile_count);
        existing.zipCount += Number(tile.zip_count);
      }
    }

    // Build response
    const results: CitySearchResult[] = cities.map((city) => {
      const cityKey = city.name.toLowerCase();
      const tileData = tileDataMap.get(cityKey);
      const detailSlug = CITIES_WITH_DETAIL_PAGES[cityKey];

      return {
        placeId: city.place_id,
        name: city.name,
        state: city.state,
        population: city.population,
        hasService: !!tileData,
        status: tileData?.status || "NONE",
        tileCount: tileData?.tileCount || 0,
        zipCount: tileData?.zipCount || 0,
        waitlistCount: waitlistMap.get(city.place_id) ?? 0,
        hasDetailPage: !!detailSlug,
        slug: detailSlug || city.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      };
    });

    return NextResponse.json({ cities: results });
  } catch (error) {
    console.error("[cities/search] Error:", error);
    return NextResponse.json(
      { error: "Failed to search cities", cities: [] },
      { status: 500 }
    );
  }
}

