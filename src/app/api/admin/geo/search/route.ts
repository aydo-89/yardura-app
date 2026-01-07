import { NextRequest } from "next/server";
import { searchPlacesWithZips } from "@/lib/geo/queries";
import type { PlaceSearchParams } from "@/lib/geo/types";

export const runtime = "nodejs";

function parseParams(request: NextRequest): PlaceSearchParams {
  const { searchParams } = request.nextUrl;
  const rawQuery = searchParams.get("query") ?? searchParams.get("q") ?? "";
  const state = searchParams.get("state") ?? undefined;
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;
  
  // Parse "City, ST" format - extract just the city name
  const parts = rawQuery.trim().split(",").map((part) => part.trim()).filter(Boolean);
  const query = parts[0] ?? rawQuery;
  
  return { query, state, limit };
}

export async function GET(request: NextRequest) {
  try {
    const params = parseParams(request);
    if (!params.query || params.query.trim().length < 2) {
      return Response.json(
        { error: "Query must be at least 2 characters." },
        { status: 400 },
      );
    }

    const results = await searchPlacesWithZips({
      query: params.query,
      state: params.state,
      limit: params.limit,
    });

    return Response.json({ results });
  } catch (error) {
    console.error("/api/admin/geo/search error", error);
    return Response.json(
      { error: "Failed to search places." },
      { status: 500 },
    );
  }
}
