import { NextRequest, NextResponse } from "next/server";
import { getBusinessConfig } from "@/lib/business-config";
import {
  getPlaceByCityState,
  getZctasInBbox,
  getZctaFeature,
  getZctasIntersectingPlace,
} from "@/lib/pmtiles";
import {
  clipZctasToPlace,
  scoreZctas,
  simplifyForRender,
  unionFeatures,
} from "@/lib/geo";
import * as turf from "@turf/turf";
import { getSiteUrl } from "@/lib/env";
import { getCitiesForZip } from "@/lib/zip-data";
import { properCapitalize } from "@/lib/geo/normalize";

// Cache for place polygons and clipped results to improve performance
const placeCache = new Map<string, any>();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get("businessId") || "yardura";

    console.log(`Getting service areas for business: ${businessId}`);

    // Get current business configuration
    const config = await getBusinessConfig(businessId);

    // Group ZIPs by city/state if available, otherwise return all
    const serviceGroups: Array<{
      city: string;
      state: string;
      zips: string[];
    }> = [];

    const allZips = new Set<string>();
    const allClippedFeatures: any[] = [];

    // For each service zone, collect ZIPs
    for (const zone of config.serviceZones) {
      for (const zip of zone.zipCodes) {
        allZips.add(zip);
      }
    }

    // If no service zones are configured, return empty response
    if (allZips.size === 0) {
      console.log("No service zones configured - returning empty response");

      return NextResponse.json({
        businessId,
        groups: [],
        combined: { type: "FeatureCollection", features: [] },
        union: null,
        stats: {
          totalZips: 0,
          totalGroups: 0,
          totalFeatures: 0,
        },
      });
    }

    // If we have city/state grouping (not implemented yet), use it
    // For now, create a single group for all ZIPs
    if (allZips.size > 0) {
      const cityGroups = new Map<string, string[]>();

      for (const zip of allZips) {
        const matches = getCitiesForZip(zip);

        if (matches.length) {
          matches.forEach(({ city, state }) => {
            const capitalizedCity = properCapitalize(city);
            const groupKey = `${capitalizedCity}, ${state}`;
            if (!cityGroups.has(groupKey)) {
              cityGroups.set(groupKey, []);
            }
            cityGroups.get(groupKey)!.push(zip);
          });
        } else {
          const unknownKey = "Unknown Location";
          if (!cityGroups.has(unknownKey)) {
            cityGroups.set(unknownKey, []);
          }
          cityGroups.get(unknownKey)!.push(zip);
        }
      }

      // Convert to service groups
      for (const [location, zips] of cityGroups.entries()) {
        const [cityPart, state] = location.includes(" County,")
          ? location.split(" County, ")
          : location.split(", ");

        serviceGroups.push({
          city: cityPart,
          state: state || "Unknown",
          zips: zips.sort(),
        });
      }

      console.log(
        `Created ${serviceGroups.length} service groups:`,
        serviceGroups.map(
          (g) => `${g.city}, ${g.state} (${g.zips.length} ZIPs)`,
        ),
      );

      // Get actual ZCTA polygons by finding cities that contain these ZIPs
      try {
        console.log(`Getting ZCTA polygons for ${allZips.size} ZIP codes`);

        // Group ZIP codes by city/state to use existing place lookup logic
        const zipToLocation = new Map<
          string,
          { city: string; state: string }
        >();

        for (const zip of allZips) {
          const matches = getCitiesForZip(zip);
          if (matches.length) {
            zipToLocation.set(zip, {
              city: properCapitalize(matches[0].city),
              state: matches[0].state,
            });
          }
        }

        console.log(`Mapped ${zipToLocation.size} ZIP codes to locations`);

        // Group ZIPs by city/state
        const locationGroups = new Map<string, string[]>();
        for (const [zip, location] of zipToLocation) {
          const key = `${location.city},${location.state}`;
          if (!locationGroups.has(key)) {
            locationGroups.set(key, []);
          }
          locationGroups.get(key)!.push(zip);
        }

        // For each city/state group, get the place polygon and find intersecting ZCTAs
        for (const [locationKey, zips] of locationGroups) {
          try {
            const [city, state] = locationKey.split(",");
            console.log(
              `Getting ZCTAs for ${city}, ${state} (${zips.length} ZIPs)`,
            );

            // Get place polygon
            const place = await getPlaceByCityState(city, state);

            // Get ZCTAs that intersect with this place
            const zctaCollection = await getZctasIntersectingPlace(place);

            // Filter to only include the ZIPs we care about
            const relevantZctas = zctaCollection.features.filter((feature) => {
              const props = feature.properties;
              const zip = props?.ZCTA5CE20 || props?.zip || props?.GEOID;
              return zip && zips.includes(String(zip));
            });

            console.log(
              `Found ${relevantZctas.length} relevant ZCTA features for ${city}, ${state}`,
            );

            allClippedFeatures.push(...relevantZctas);
          } catch (error) {
            console.warn(`Failed to get ZCTAs for ${locationKey}:`, error);
          }
        }

        console.log(
          `Total ZCTA features collected: ${allClippedFeatures.length}`,
        );
      } catch (error) {
        console.warn("Error getting ZCTA features:", error);
      }
    }

    // Create combined FeatureCollection
    const combined: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: allClippedFeatures,
    };

    // Optional: Create union for more efficient rendering if there are many features
    let unionFeature = null;
    if (allClippedFeatures.length > 10) {
      unionFeature = unionFeatures(allClippedFeatures);
    }

    const response = {
      businessId,
      groups: serviceGroups,
      combined: simplifyForRender(combined as any, 0.5), // Reduced from 5m to 0.5m for better detail
      union: unionFeature ? simplifyForRender(unionFeature, 0.5) : null,
      stats: {
        totalZips: allZips.size,
        totalGroups: serviceGroups.length,
        totalFeatures: allClippedFeatures.length,
      },
    };

    console.log(
      `Service areas response: ${allZips.size} ZIPs, ${allClippedFeatures.length} features`,
    );

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Service areas error:", error);
    return NextResponse.json(
      {
        error: "Failed to get service areas",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      { status: 500 },
    );
  }
}

// POST endpoint for managing service areas (keeping existing functionality)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, businessId = "yardura" } = body;

    switch (action) {
      case "search-zips":
        // Forward to the new ZIP search API
        const zipSearchResponse = await fetch(
          `${getSiteUrl()}/api/geo/zip-search`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );

        if (!zipSearchResponse.ok) {
          throw new Error(`ZIP search failed: ${zipSearchResponse.status}`);
        }

        return zipSearchResponse;

      case "add-manual-zips":
      case "create-zone":
      case "update-zone":
        // These would use the existing business-config functions
        return NextResponse.json(
          { error: "Action not implemented in new service areas API" },
          { status: 501 },
        );

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Service areas POST error:", error);
    return NextResponse.json(
      { error: "Failed to manage service areas" },
      { status: 500 },
    );
  }
}
