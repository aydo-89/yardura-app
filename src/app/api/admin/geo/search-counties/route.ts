import { NextRequest } from "next/server";
import { getPostgisPool } from "@/lib/geo/postgis";

export const runtime = "nodejs";

type CountySearchResult = {
  countyId: string;
  name: string;
  state: string;
  placeCount: number;
  totalPopulation: number;
};

const COUNTY_CACHE_TTL_MS = 1000 * 60 * 5;
const COUNTY_RATE_LIMIT_MS = 150;
const countyCache = new Map<
  string,
  { timestamp: number; payload: { ok: true; results: CountySearchResult[] } }
>();
const countyRateMap = new Map<string, number>();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const query = searchParams.get("query") ?? searchParams.get("q") ?? "";
    const limitParam = Number.parseInt(searchParams.get("limit") ?? "12", 10);
    const stateParam = searchParams.get("state") ?? undefined;
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 25) : 12;

    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      return Response.json(
        { error: "Query must be at least 2 characters." },
        { status: 400 },
      );
    }

    const normalizedState = stateParam ? stateParam.trim().toUpperCase() : undefined;
    const cacheKey = `${normalizedState ?? "ALL"}|${trimmedQuery.toLowerCase()}|${limit}`;
    const now = Date.now();

    const cached = countyCache.get(cacheKey);
    if (cached && now - cached.timestamp < COUNTY_CACHE_TTL_MS) {
      return Response.json(cached.payload);
    }

    const lastRequest = countyRateMap.get(cacheKey);
    if (lastRequest && now - lastRequest < COUNTY_RATE_LIMIT_MS) {
      if (cached) {
        return Response.json(cached.payload);
      }
    }
    countyRateMap.set(cacheKey, now);

    const pool = getPostgisPool();
    const client = await pool.connect();

    try {
      const values: any[] = [`${trimmedQuery}%`, limit];
      let stateFilter = "";

      if (normalizedState) {
        stateFilter = "AND c.state = $3";
        values.push(normalizedState);
      }

      const sql = `
        SELECT 
          c.county_id,
          c.name,
          c.state,
          COUNT(DISTINCT p.place_id) AS place_count,
          COALESCE(SUM(p.population), 0) AS total_population
        FROM geo.county c
        LEFT JOIN geo.place p ON p.county_name = c.name AND p.state = c.state
        WHERE c.name ILIKE $1 ${stateFilter}
        GROUP BY c.county_id, c.name, c.state
        ORDER BY total_population DESC NULLS LAST, c.name
        LIMIT $2
      `;

      const result = await client.query<{
        county_id: string;
        name: string;
        state: string;
        place_count: string;
        total_population: string;
      }>(sql, values);

      const payload: { ok: true; results: CountySearchResult[] } = {
        ok: true,
        results: result.rows.map((row) => ({
          countyId: row.county_id,
          name: row.name,
          state: row.state,
          placeCount: parseInt(row.place_count, 10),
          totalPopulation: parseInt(row.total_population, 10),
        })),
      };

      countyCache.set(cacheKey, { timestamp: now, payload });
      return Response.json(payload);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("/api/admin/geo/search-counties error", error);
    return Response.json(
      { ok: false, error: "Failed to search counties." },
      { status: 500 },
    );
  }
}


