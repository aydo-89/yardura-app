import { NextRequest, NextResponse } from "next/server";
import {
  getPlaceByCityState,
  getPlaceByCountyState,
  getZctasIntersectingPlace,
} from "@/lib/pmtiles";
import {
  clipZctasToPlace,
  scoreZctas,
  simplifyForRender,
  calculateCoverageStats,
  clipsToCoverage,
} from "@/lib/geo";
import { fetchZctasForGeometry } from "@/lib/geo-zip";
import { debug, warn, error } from "@/lib/log";
import * as turf from "@turf/turf";

export async function POST(req: NextRequest) {
  try {
    const { city, state, searchType } = await req.json();
    if (!city || !state) {
      return NextResponse.json(
        { error: "City and state are required" },
        { status: 400 },
      );
    }

    const isCountySearch = searchType === "county";
    const searchLabel = isCountySearch ? `${city} County` : city;
    debug(
      "api",
      `Searching ZIP codes for ${isCountySearch ? "county" : "city"}: ${searchLabel}, ${state}`,
    );

    // Step 1: Get place polygon (city or county)
    let place: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;

    if (isCountySearch) {
      place = await getPlaceByCountyState(city, state);
    } else {
      place = await getPlaceByCityState(city, state);
    }

    debug(
      "api",
      `Found place polygon with geometry type: ${place.geometry.type}`,
    );

    // Step 2: Get ZCTAs that intersect with the place polygon
    const zctas = await getZctasIntersectingPlace(place);
    debug(
      "api",
      `Found ${zctas.features.length} ZCTA features intersecting place`,
    );

    if (zctas.features.length === 0) {
      return NextResponse.json({
        searchCriteria: { city, state },
        zips: [],
        count: 0,
        message: `No ZCTA features found near ${city}, ${state}`,
        map: {
          place: simplifyForRender(place, 5),
          includedZctas: { type: "FeatureCollection", features: [] },
        },
        coverageStats: {
          placeAreaSqm: Math.round(turf.area(place)),
          clipsAreaSqm: 0,
          ratio: 0,
        },
      });
    }

    // Step 3: Clip ZCTAs to place boundary
    const clips = clipZctasToPlace(zctas, place);
    debug("api", `Clipped ${clips.length} ZCTAs to place boundary`);

    // Step 4: Score and filter ZCTAs
    const scoredClips = scoreZctas(clips);
    debug("api", `After scoring: ${scoredClips.length} ZCTAs kept`);

    // Step 5: Extract ZIP codes and create response
    const zips = Array.from(new Set(scoredClips.map((c) => c.zip))).sort();

    // Step 6: Calculate coverage statistics
    const coverageStats = calculateCoverageStats(place, scoredClips);

    // Step 7: Prepare map data with minimal simplification for accuracy
    const placeRender = simplifyForRender(place, 1); // Reduce from 5m to 1m for better accuracy
    const zctaClipsFC = {
      type: "FeatureCollection" as const,
      features: scoredClips.map((c) => c.feature),
    };

    const response = {
      searchCriteria: { city, state },
      zips,
      count: zips.length,
      message: `Found ${zips.length} ZIP code${zips.length === 1 ? "" : "s"} for ${city}, ${state}`,
      map: {
        place: placeRender,
        includedZctas: simplifyForRender(zctaClipsFC, 1), // Reduce from 5m to 1m for better accuracy
      },
      coverageStats: {
        placeAreaSqm: coverageStats.placeAreaSqm,
        clipsAreaSqm: coverageStats.clipsAreaSqm,
        ratio: coverageStats.ratio,
        coveragePercent: coverageStats.coveragePercent,
      },
      debug:
        process.env.NODE_ENV === "development"
          ? {
              totalZctasFound: zctas.features.length,
              clipsProcessed: clips.length,
              scoredAndKept: scoredClips.length,
              coverageDetails: clipsToCoverage(scoredClips),
            }
          : undefined,
    };

    debug(
      "api",
      `Response: ${zips.length} ZIPs, ${coverageStats.coveragePercent}% coverage`,
    );

    return NextResponse.json(response);
  } catch (err: any) {
    error("api", `ZIP search error: ${err.message || err}`);

    // Provide more specific error messages
    let errorMessage = "ZIP search failed";
    if (err.message?.includes("Place not found")) {
      errorMessage = `City not found: ${err.message.split(":")[1]?.trim() || "Unknown city"}`;
    } else if (err.message?.includes("PMTiles")) {
      errorMessage =
        "Data source unavailable. Please ensure PMTiles are built and accessible.";
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details:
          process.env.NODE_ENV === "development" ? err.message : undefined,
      },
      { status: 500 },
    );
  }
}
