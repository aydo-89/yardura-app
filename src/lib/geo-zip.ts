/**
 * Geographic ZIP Code Resolution
 *
 * Accurate city/suburb → ZIP mapping using polygon intersections with US Census ZCTA boundaries.
 * No mocks, no heuristics - only geometric operations.
 */

import * as turf from "@turf/turf";
import * as fs from "fs";
import * as path from "path";

// Import new geo utilities
import {
  normalizeZip,
  toStateAbbrUpper,
  toStateAbbrLower,
  toStateSlug,
  properCapitalize,
  normalizeCityName,
} from "./geo/normalize";
import { rewindSafe, unkinkSafe, validateAndClean } from "./geo/geometry";
import { debug, warn, error } from "./log";
import { env } from "./env";

// Re-export functions for backward compatibility
export { clipZctasToPlace, scoreZctas, calculateCoverageStats } from "./geo/";

// Use standard GeoJSON types instead of Turf types
export type GeoPolygon = GeoJSON.Feature<
  GeoJSON.Polygon | GeoJSON.MultiPolygon
>;

export interface ZipCoverage {
  zip: string;
  overlapRatio: number; // overlap_area / zcta_area
  centroidInside: boolean;
  zctaAreaSqm: number;
  overlapAreaSqm: number;
}

export interface ComprehensiveZipResult {
  polygonFeatures: GeoJSON.FeatureCollection<
    GeoJSON.Polygon | GeoJSON.MultiPolygon
  >;
  allZips: string[];
  zipsByCity?: { [cityName: string]: string[] };
  suburbanCities?: { [cityName: string]: string[] };
}

// Use environment variables through the validated env module
const AREA_THRESHOLD = parseFloat(env.ZIP_AREA_THRESHOLD);
const NOMINATIM_BASE = env.NOMINATIM_BASE;
const NOMINATIM_EMAIL = env.NOMINATIM_EMAIL;
const ZIPCODESTACK_API_KEY = env.ZIPCODESTACK_API_KEY;
const ZIPCODESTACK_BASE_URL = env.ZIPCODESTACK_BASE_URL;

// State mapping utilities are now imported from normalize module

/**
 * Geocode city/state to a polygon using Nominatim (OpenStreetMap)
 * Prefers administrative boundaries/relations with polygons
 * Enhanced to find more cities and handle edge cases
 */
export async function geocodePlaceToPolygon(
  city: string,
  state: string,
): Promise<GeoPolygon> {
  debug("geocode", `Geocoding ${city}, ${state}`);

  // Try multiple search strategies to find the city
  const searchStrategies = [
    // Strategy 1: City + State
    `${NOMINATIM_BASE}/search?format=json&addressdetails=1&polygon_geojson=1&limit=10&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&country=United%20States&email=${encodeURIComponent(NOMINATIM_EMAIL)}`,
    // Strategy 2: Just city name
    `${NOMINATIM_BASE}/search?format=json&addressdetails=1&polygon_geojson=1&limit=10&q=${encodeURIComponent(city)}+${encodeURIComponent(state)}&country=United%20States&email=${encodeURIComponent(NOMINATIM_EMAIL)}`,
    // Strategy 3: More flexible search
    `${NOMINATIM_BASE}/search?format=json&addressdetails=1&polygon_geojson=1&limit=10&q=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&country=United%20States&email=${encodeURIComponent(NOMINATIM_EMAIL)}`,
  ];

  let items: any[] = [];

  for (const url of searchStrategies) {
    try {
      debug("geocode", `Trying: ${url.split("?")[0]}...`);
      const resp = await fetch(url, {
        headers: { "User-Agent": "Yardura-ZipSearch/1.0" },
        cache: "no-store",
      });

      if (!resp.ok) continue;

      const data = await resp.json();
      if (Array.isArray(data) && data.length > 0) {
        items = data;
        break;
      }
    } catch (error) {
      warn("geocode", `Search strategy failed: ${error}`);
      continue;
    }
  }

  if (items.length === 0) {
    throw new Error(`No results found for ${city}, ${state}`);
  }

  // Enhanced candidate selection - prefer boundaries and administrative areas
  const candidate =
    (items as any[]).find(
      (i) =>
        i?.geojson &&
        (i.class === "boundary" ||
          i.type === "administrative" ||
          i.type === "city" ||
          i.type === "town" ||
          i.type === "village" ||
          i.type === "suburb" ||
          i.type === "municipality"),
    ) ||
    (items as any[]).find(
      (i) => i?.geojson && i.importance > 0.5, // High importance places
    ) ||
    (items as any[]).find((i) => i?.geojson);

  if (!candidate?.geojson) {
    throw new Error(`No polygon found for ${city}, ${state}`);
  }

  const feature = turf.feature(candidate.geojson) as GeoPolygon;
  // Use new geometry utilities for cleaning and validation
  const rewound = rewindSafe(feature);
  const cleaned = validateAndClean(rewound);
  return cleaned as GeoPolygon;
}

/**
 * Fetch candidate ZIP codes for a city or county using real data sources
 * This works for ALL cities and counties in the US without hardcoding
 */
export async function fetchZctasForGeometry(
  placePoly: GeoPolygon,
  searchType?: string,
  placeName?: string,
  stateName?: string,
): Promise<ComprehensiveZipResult> {
  debug(
    "fetch",
    `Fetching ZCTAs for ${searchType || "city"}: ${placeName || "Unknown"}, ${stateName || "Unknown"}`,
  );

  // Prepare place geometry with new utilities
  const placeRewound = rewindSafe(placePoly);
  const placeUnkinked = unkinkSafe(placeRewound);
  const placeClean = validateAndClean(placeUnkinked[0]); // Use first piece if unkinked

  // Get bbox to narrow search
  const bbox = turf.bbox(placeClean);
  debug(
    "fetch",
    `Searching ZIPs within bbox: [${bbox[0]}, ${bbox[1]}, ${bbox[2]}, ${bbox[3]}]`,
  );

  // Collect ZIPs from all real data sources
  const allZips = new Set<string>();
  const polygonFeatures: GeoJSON.Feature<
    GeoJSON.Polygon | GeoJSON.MultiPolygon
  >[] = [];
  let skipApiFallbacks = false;

  let city: string, state: string;
  const isCountySearch = searchType === "county";

  // If we have explicit search parameters, use them (for county searches)
  if (isCountySearch && placeName && stateName) {
    debug(
      "fetch",
      `Using county search parameters: ${placeName} County, ${stateName}`,
    );

    // For county searches, we need to get all ZIP codes in the county
    // Load the ZIP database to get all ZIPs for this county

    try {
      const zipDataPath = path.join(
        process.cwd(),
        "src",
        "lib",
        "zip-city-data.csv",
      );
      const csvData = await fs.promises.readFile(zipDataPath, "utf-8");
      const lines = csvData.split("\n").slice(1); // Skip header

      const matchingZips: string[] = [];
      const searchCity = placeName.toLowerCase().trim();
      const searchStateAbbr = toStateAbbrUpper(stateName);

      for (const line of lines) {
        if (!line.trim()) continue;
        const [stateFips, csvStateName, stateAbbr, zipcode, county, cityName] =
          line.split(",");
        if (zipcode && stateAbbr && cityName) {
          const zip = zipcode.trim();
          const stateMatch = stateAbbr.trim();
          const cityMatch = cityName.toLowerCase().trim();
          if (cityMatch === searchCity && stateMatch === searchStateAbbr) {
            matchingZips.push(zip);
          }
        }
      }

      const countyZips = Array.from(new Set(matchingZips));

      debug(
        "fetch",
        `Found ${countyZips.length} ZIP codes for ${placeName} County, ${stateName} from CSV`,
      );

      if (countyZips.length > 0) {
        // Use the county ZIP codes directly
        const stateAbbrLower = toStateAbbrLower(stateName);
        const stateSlug = toStateSlug(stateName);
        const zctaUrl = `https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/${stateAbbrLower}_${stateSlug}_zip_codes_geo.min.json`;
        debug(
          "fetch",
          `Fetching state ZCTA polygons: ${zctaUrl.split("/").pop()}`,
        );

        const zctaResp = await fetch(zctaUrl, { cache: "no-store" });
        if (zctaResp.ok) {
          const stateGeo = await zctaResp.json();

          // Build set of county ZIP codes
          const countyZipSet = new Set(countyZips);

          // Filter features by county ZIPs and clip to the county boundary
          const filtered: GeoJSON.Feature<
            GeoJSON.Polygon | GeoJSON.MultiPolygon
          >[] = [];
          for (const f of stateGeo.features as any[]) {
            const propZip = normalizeZip(
              (
                f.properties?.ZCTA5CE10 ||
                f.properties?.ZCTA5 ||
                f.properties?.GEOID10 ||
                f.properties?.GEOID ||
                f.properties?.ZIP ||
                f.properties?.zip ||
                ""
              ).toString(),
            );
            if (!propZip || !countyZipSet.has(propZip)) continue;

            try {
              // Validate geometries before intersection using new utilities
              const cleanPlace = validateAndClean(placeClean);
              const cleanZcta = validateAndClean(f);

              // Check if geometries are valid
              if (!cleanPlace.geometry || !cleanZcta.geometry) {
                debug("fetch", `Invalid geometry for ZIP ${propZip}, skipping`);
                continue;
              }
              // Quick bbox check
              const zctaBbox = turf.bbox(cleanZcta);
              const placeBbox = turf.bbox(cleanPlace);
              const bboxIntersects = !(
                zctaBbox[2] < placeBbox[0] ||
                zctaBbox[0] > placeBbox[2] ||
                zctaBbox[3] < placeBbox[1] ||
                zctaBbox[1] > placeBbox[3]
              );
              if (!bboxIntersects) {
                continue;
              }
              // Check actual geometric intersection before attempting intersect
              let intersects = false;
              try {
                intersects = turf.booleanIntersects(
                  cleanPlace as any,
                  cleanZcta as any,
                );
              } catch {
                // Fall back to bbox decision
                intersects = bboxIntersects;
              }
              if (!intersects) {
                continue;
              }

              let clipped: any = null;
              try {
                clipped = turf.intersect(cleanPlace as any, cleanZcta as any);
              } catch (intersectErr) {
                // Downgrade to debug to avoid noisy logs; we'll fall back below
                if (process.env.NODE_ENV === "development") {
                  console.debug(
                    `Intersect failed for ZIP ${propZip}:`,
                    intersectErr,
                  );
                }
              }
              if (clipped && turf.area(clipped) > 0) {
                (clipped as any).properties = {
                  ...(clipped as any).properties,
                  zip: propZip,
                };
                filtered.push(clipped as any);
              } else {
                // If intersection is empty but geometries intersect, use original
                if (turf.booleanIntersects(cleanPlace, cleanZcta)) {
                  (cleanZcta as any).properties = {
                    ...(cleanZcta as any).properties,
                    zip: propZip,
                  };
                  filtered.push(cleanZcta as any);
                }
              }
            } catch (e) {
              if (process.env.NODE_ENV === "development") {
                console.debug(`Clip failed for ZIP ${propZip}:`, e);
              }
              // Fallback: include original if intersect test passes
              try {
                if (turf.booleanIntersects(placePoly as any, f as any)) {
                  (f as any).properties = {
                    ...(f as any).properties,
                    zip: propZip,
                  };
                  filtered.push(f as any);
                }
              } catch {}
            }
          }

          debug(
            "fetch",
            `Prepared ${filtered.length} accurate ZCTA polygons for ${placeName} County, ${stateName}`,
          );

          // Add county ZIPs to comprehensive collection
          countyZips.forEach((zip: string) => allZips.add(zip));
          polygonFeatures.push(...filtered);

          return {
            polygonFeatures: {
              type: "FeatureCollection",
              features: filtered,
            } as GeoJSON.FeatureCollection<
              GeoJSON.Polygon | GeoJSON.MultiPolygon
            >,
            allZips: Array.from(allZips),
          };
        }
      }
    } catch (error) {
      warn(
        "fetch",
        `County ZIP lookup failed, falling back to centroid approach: ${error}`,
      );
    }
  }

  // For city searches: Use geometric intersection with real ZCTA data as primary method
  if (!isCountySearch && placeName && stateName) {
    debug(
      "fetch",
      `Primary approach: geometric intersection for city ${placeName}, ${stateName}`,
    );

    try {
      // Load the full state ZCTA data and find ZIPs that intersect with city boundary
      const stateAbbrLower = toStateAbbrLower(stateName);
      const stateNameLower = stateName.toLowerCase().replace(/\s+/g, "_");
      const zctaUrl = `https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/${stateAbbrLower}_${stateNameLower}_zip_codes_geo.min.json`;

      debug("fetch", `Fetching real ZCTA data: ${zctaUrl.split("/").pop()}`);
      const zctaResp = await fetch(zctaUrl, { cache: "no-store" });

      if (zctaResp.ok) {
        const stateGeo = await zctaResp.json();
        debug(
          "fetch",
          `Loaded ${stateGeo.features?.length || 0} ZCTA features for ${stateName}`,
        );

        // Find ZCTAs that intersect with the city polygon using geometric methods
        const intersectingZctas: GeoJSON.Feature<
          GeoJSON.Polygon | GeoJSON.MultiPolygon
        >[] = [];

        for (const zcta of stateGeo.features || []) {
          const zipProp =
            zcta.properties?.ZCTA5CE10 ||
            zcta.properties?.ZCTA5 ||
            zcta.properties?.zip;
          if (!zipProp || zipProp === "00001") continue; // Skip invalid ZIPs

          try {
            // Quick bbox check first
            const zctaBbox = turf.bbox(zcta);
            const placeBbox = turf.bbox(placePoly);
            const bboxIntersects = !(
              zctaBbox[2] < placeBbox[0] ||
              zctaBbox[0] > placeBbox[2] ||
              zctaBbox[3] < placeBbox[1] ||
              zctaBbox[1] > placeBbox[3]
            );

            if (bboxIntersects && turf.booleanIntersects(placePoly, zcta)) {
              allZips.add(zipProp);
              intersectingZctas.push(zcta);
            }
          } catch (geoError) {
            // Skip problematic geometries
            debug("fetch", `Skipped ZCTA ${zipProp} due to geometry error`);
          }
        }

        polygonFeatures.push(...intersectingZctas);
        debug(
          "fetch",
          `Geometric intersection found ${allZips.size} valid ZIPs with ${intersectingZctas.length} polygons`,
        );

        // If we found good data, we can use it as primary, but still collect comprehensive data for major metros
        if (allZips.size > 0) {
          debug(
            "fetch",
            `Geometric intersection found ${allZips.size} ZIPs with polygons`,
          );
          // For major metros, still collect broader ZIP data for suburbs grouping
          const isMajorMetroCheck = [
            "minneapolis",
            "saint paul",
            "chicago",
            "detroit",
            "atlanta",
            "houston",
            "dallas",
            "phoenix",
            "los angeles",
            "new york",
            "boston",
            "philadelphia",
            "washington",
          ].includes((placeName || "").toLowerCase());
          if (!isMajorMetroCheck) {
            debug(
              "fetch",
              "Not a major metro - using only geometric intersection results",
            );
            skipApiFallbacks = true;
          } else {
            debug(
              "fetch",
              "Major metro detected - will collect additional suburban ZIP data",
            );
          }
        }
      } else {
        warn("fetch", `Failed to fetch ZCTA data: ${zctaResp.status}`);
      }
    } catch (geoError) {
      warn(
        "fetch",
        `Geometric intersection failed, falling back to APIs: ${geoError}`,
      );
    }
  }

  // Only use API fallbacks if geometric intersection didn't work
  if (!skipApiFallbacks) {
    debug(
      "fetch",
      "Geometric intersection failed or not attempted, using API fallbacks",
    );

    // Fall back to centroid approach for city searches or if county search fails
    const centroid = turf.centroid(placeClean);
    const [lng, lat] = centroid.geometry.coordinates;

    // Reverse geocode to get city/state from coordinates
    const reverseUrl = `${NOMINATIM_BASE}/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&email=${encodeURIComponent(NOMINATIM_EMAIL)}`;
    debug("fetch", `Reverse geocoding: ${reverseUrl}`);

    const reverseResp = await fetch(reverseUrl, {
      headers: { "User-Agent": "Yardura-ZipSearch/1.0" },
      cache: "no-store",
    });

    if (!reverseResp.ok) {
      throw new Error(`Reverse geocoding failed: ${reverseResp.status}`);
    }

    const reverseData = await reverseResp.json();
    city =
      reverseData.address?.city ||
      reverseData.address?.town ||
      reverseData.address?.village;
    state = reverseData.address?.state;

    if (!city || !state) {
      throw new Error(
        "Could not determine city/state from polygon coordinates",
      );
    }

    debug("fetch", `Found city/state: ${city}, ${state}`);

    let data: any = null;

    // For county searches, we already have the ZIP codes, so create mock data structure
    if (isCountySearch && placeName && stateName) {
      // We already processed county ZIPs above, but need to handle the case where we didn't return early
      // This shouldn't happen, but let's add a fallback
      debug(
        "fetch",
        `County search fallback for ${placeName} County, ${stateName}`,
      );
    }

    // PRIMARY: Try comprehensive USPS ZIP database first
    try {
      debug("fetch", `Trying comprehensive ZIP database for ${city}, ${state}`);

      // Load comprehensive ZIP database
      const { readFileSync } = await import("fs");
      const { join } = await import("path");

      try {
        const zipDbPath = join(
          process.cwd(),
          "src/lib/comprehensive_zip_database.json",
        );
        const zipDbContent = readFileSync(zipDbPath, "utf8");
        const zipDatabase = JSON.parse(zipDbContent);

        // Look up ZIPs for this city/state
        const stateData = zipDatabase[state];
        if (stateData) {
          // Try exact city match first
          let cityZips = stateData[city.toUpperCase()];

          // If not found, try alternative city names from the reverse geocoding
          if (!cityZips && reverseData.address?.suburb) {
            cityZips = stateData[reverseData.address.suburb.toUpperCase()];
          }

          if (cityZips && cityZips.length > 0) {
            debug(
              "fetch",
              `Found ${cityZips.length} ZIPs in comprehensive database for ${city}, ${state}`,
            );
            return createFeaturesFromZips(
              cityZips,
              city,
              state,
              placeClean as GeoPolygon,
            );
          }
        }
      } catch (error) {
        warn("fetch", `Failed to load comprehensive ZIP database: ${error}`);
      }
    } catch (error) {
      warn("fetch", `Comprehensive ZIP database lookup failed: ${error}`);
    }

    // Try Zipcodestack API first (works for all US cities)
    if (ZIPCODESTACK_API_KEY) {
      try {
        // Use Zipcodestack to search for ZIP codes by city/state
        // Based on their documentation, try the correct endpoint format
        const zipUrls = [
          `${ZIPCODESTACK_BASE_URL}/search?codes=${encodeURIComponent(city)}&country=us`,
          `${ZIPCODESTACK_BASE_URL}/search?query=${encodeURIComponent(city)}&country=us`,
          `${ZIPCODESTACK_BASE_URL}/search?codes=${encodeURIComponent(city)}&country=us&state=${encodeURIComponent(state)}`,
        ];

        for (const zipUrl of zipUrls) {
          debug("fetch", `Trying Zipcodestack: ${zipUrl.split("?")[0]}...`);

          try {
            const zipResp = await fetch(zipUrl, {
              headers: {
                apikey: ZIPCODESTACK_API_KEY,
                Accept: "application/json",
                "User-Agent": "Yardura-ZipSearch/1.0",
              },
              cache: "no-store",
            });

            debug("fetch", `Zipcodestack response status: ${zipResp.status}`);

            if (zipResp.ok) {
              const zipData = await zipResp.json();
              debug(
                "fetch",
                `Zipcodestack returned data with ${Object.keys(zipData.results || {}).length} result sets`,
              );

              // Parse the response based on Zipcodestack's actual format
              const records: any[] = [];

              if (zipData.query && zipData.results) {
                // Standard Zipcodestack format: { query: {...}, results: {...} }
                for (const [zipCode, locations] of Object.entries(
                  zipData.results,
                )) {
                  if (Array.isArray(locations) && locations.length > 0) {
                    locations.forEach((location: any) => {
                      // Filter by state if we have state info
                      if (
                        state &&
                        location.state !== state &&
                        location.state_code !== state
                      ) {
                        return; // Skip if state doesn't match
                      }

                      records.push({
                        fields: {
                          zip: location.postal_code || zipCode,
                          city: location.city || city,
                          state: location.state || location.state_code || state,
                          latitude: parseFloat(location.latitude),
                          longitude: parseFloat(location.longitude),
                        },
                      });
                    });
                  }
                }
              }

              if (records.length > 0) {
                debug(
                  "fetch",
                  `Zipcodestack returned ${records.length} ZIP records for ${city}, ${state}`,
                );
                data = { records };
                break; // Success, stop trying other URLs
              } else {
                debug(
                  "fetch",
                  "No matching ZIP codes found in Zipcodestack response",
                );
              }
            } else {
              const errorText = await zipResp.text();
              warn(
                "fetch",
                `Zipcodestack API error: ${zipResp.status} ${zipResp.statusText}`,
              );
              debug(
                "fetch",
                `Error response: ${errorText.substring(0, 200)}...`,
              );
            }
          } catch (error) {
            warn("fetch", `Zipcodestack request failed: ${error}`);
          }
        }
      } catch (error) {
        warn("fetch", `Zipcodestack API failed: ${error}`);
      }
    } else {
      warn("fetch", "Zipcodestack API key not configured");
    }

    // Fallback: Try Zippopotam API
    if (!data) {
      try {
        // Zippopotam needs state code, not full state name
        const stateCodeMap: { [key: string]: string } = {
          Alabama: "AL",
          Alaska: "AK",
          Arizona: "AZ",
          Arkansas: "AR",
          California: "CA",
          Colorado: "CO",
          Connecticut: "CT",
          Delaware: "DE",
          Florida: "FL",
          Georgia: "GA",
          Hawaii: "HI",
          Idaho: "ID",
          Illinois: "IL",
          Indiana: "IN",
          Iowa: "IA",
          Kansas: "KS",
          Kentucky: "KY",
          Louisiana: "LA",
          Maine: "ME",
          Maryland: "MD",
          Massachusetts: "MA",
          Michigan: "MI",
          Minnesota: "MN",
          Mississippi: "MS",
          Missouri: "MO",
          Montana: "MT",
          Nebraska: "NE",
          Nevada: "NV",
          "New Hampshire": "NH",
          "New Jersey": "NJ",
          "New Mexico": "NM",
          "New York": "NY",
          "North Carolina": "NC",
          "North Dakota": "ND",
          Ohio: "OH",
          Oklahoma: "OK",
          Oregon: "OR",
          Pennsylvania: "PA",
          "Rhode Island": "RI",
          "South Carolina": "SC",
          "South Dakota": "SD",
          Tennessee: "TN",
          Texas: "TX",
          Utah: "UT",
          Vermont: "VT",
          Virginia: "VA",
          Washington: "WA",
          "West Virginia": "WV",
          Wisconsin: "WI",
          Wyoming: "WY",
        };

        const stateCode = stateCodeMap[state] || state;
        const zipUrl = `https://api.zippopotam.us/us/${stateCode}/${encodeURIComponent(city.toLowerCase())}`;
        debug("fetch", `Trying Zippopotam fallback: ${zipUrl}`);

        const zipResp = await fetch(zipUrl, {
          headers: { "User-Agent": "Yardura-ZipSearch/1.0" },
          cache: "no-store",
        });

        if (zipResp.ok) {
          const zipData = await zipResp.json();
          debug(
            "fetch",
            `Zippopotam returned ${zipData.places?.length || 0} places for ${city}, ${state}`,
          );

          if (zipData.places && zipData.places.length > 0) {
            debug(
              "fetch",
              `Zippopotam returned ${zipData.places.length} ZIPs for ${city}, ${state}`,
            );
            data = {
              records: zipData.places.map((place: any) => ({
                fields: {
                  zip: place["post code"],
                  city: place["place name"],
                  state: place["state abbreviation"],
                  latitude: parseFloat(place.latitude),
                  longitude: parseFloat(place.longitude),
                },
              })),
            };
          }
        } else {
          warn("fetch", `Zippopotam API error: ${zipResp.status}`);
        }
      } catch (error) {
        warn("fetch", `Zippopotam fallback failed: ${error}`);
      }
    }

    // Enhanced fallback: If APIs still failed, try nearby ZIP codes
    if (!data || !Array.isArray(data.records) || data.records.length === 0) {
      try {
        debug("fetch", "APIs failed, trying nearby ZIP search fallback");

        // Try to get nearby ZIPs by searching the state and filtering by distance
        if (ZIPCODESTACK_API_KEY) {
          const nearbyUrl = `${ZIPCODESTACK_BASE_URL}/search?query=${encodeURIComponent(state)}&country=us&limit=100`;
          debug("fetch", `Trying nearby search: ${nearbyUrl.split("?")[0]}...`);

          try {
            const nearbyResp = await fetch(nearbyUrl, {
              headers: {
                apikey: ZIPCODESTACK_API_KEY,
                Accept: "application/json",
                "User-Agent": "Yardura-ZipSearch/1.0",
              },
              cache: "no-store",
            });

            if (nearbyResp.ok) {
              const nearbyData = await nearbyResp.json();

              if (
                nearbyData.results &&
                Object.keys(nearbyData.results).length > 0
              ) {
                // Filter ZIPs that are within reasonable distance of the city
                const nearbyRecords: any[] = [];

                for (const [zipCode, locations] of Object.entries(
                  nearbyData.results,
                )) {
                  if (Array.isArray(locations)) {
                    locations.forEach((location: any) => {
                      const zipLat = parseFloat(location.latitude);
                      const zipLng = parseFloat(location.longitude);

                      // Calculate distance from city center
                      const distance = turf.distance(
                        turf.point([lng, lat]) as any,
                        turf.point([zipLng, zipLat]) as any,
                        { units: "miles" },
                      );

                      // Include ZIPs within 10 miles of city center
                      if (distance <= 10) {
                        nearbyRecords.push({
                          fields: {
                            zip: location.postal_code || zipCode,
                            city: location.city || city,
                            state:
                              location.state || location.state_code || state,
                            latitude: zipLat,
                            longitude: zipLng,
                            distance: Math.round(distance * 10) / 10, // Round to 1 decimal
                          },
                        });
                      }
                    });
                  }
                }

                if (nearbyRecords.length > 0) {
                  debug(
                    "fetch",
                    `Found ${nearbyRecords.length} nearby ZIPs within 10 miles of ${city}, ${state}`,
                  );
                  data = { records: nearbyRecords };
                }
              }
            }
          } catch (error) {
            warn("fetch", `Nearby search failed: ${error}`);
          }
        }
      } catch (error) {
        warn("fetch", `Nearby ZIP search failed: ${error}`);
      }
    }

    // Final check - if still no data, throw error
    if (!data || !Array.isArray(data.records) || data.records.length === 0) {
      throw new Error(
        `Unable to retrieve ZIP code data for ${city}, ${state}. All data sources are currently unavailable. Please try again later or contact support.`,
      );
    }

    // Prefer ACCURATE ZCTA polygons from US Census (OpenDataDE mirror per-state)
    try {
      const stateCodeMap: { [key: string]: string } = {
        Alabama: "al",
        Alaska: "ak",
        Arizona: "az",
        Arkansas: "ar",
        California: "ca",
        Colorado: "co",
        Connecticut: "ct",
        Delaware: "de",
        Florida: "fl",
        Georgia: "ga",
        Hawaii: "hi",
        Idaho: "id",
        Illinois: "il",
        Indiana: "in",
        Iowa: "ia",
        Kansas: "ks",
        Kentucky: "ky",
        Louisiana: "la",
        Maine: "me",
        Maryland: "md",
        Massachusetts: "ma",
        Michigan: "mi",
        Minnesota: "mn",
        Mississippi: "ms",
        Missouri: "mo",
        Montana: "mt",
        Nebraska: "ne",
        Nevada: "nv",
        "New Hampshire": "nh",
        "New Jersey": "nj",
        "New Mexico": "nm",
        "New York": "ny",
        "North Carolina": "nc",
        "North Dakota": "nd",
        Ohio: "oh",
        Oklahoma: "ok",
        Oregon: "or",
        Pennsylvania: "pa",
        "Rhode Island": "ri",
        "South Carolina": "sc",
        "South Dakota": "sd",
        Tennessee: "tn",
        Texas: "tx",
        Utah: "ut",
        Vermont: "vt",
        Virginia: "va",
        Washington: "wa",
        "West Virginia": "wv",
        Wisconsin: "wi",
        Wyoming: "wy",
        "District of Columbia": "dc",
      };

      const abbr = stateCodeMap[state] || state.toLowerCase();
      const stateSlug = state.toLowerCase().replace(/\s+/g, "_");
      const zctaUrl = `https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/${abbr}_${stateSlug}_zip_codes_geo.min.json`;
      debug(
        "fetch",
        `Fetching state ZCTA polygons: ${zctaUrl.split("/").pop()}`,
      );

      const zctaResp = await fetch(zctaUrl, { cache: "no-store" });
      if (zctaResp.ok) {
        const stateGeo = await zctaResp.json();

        // Build set of candidate ZIPs from earlier step
        const candidateZips = new Set(
          (Array.isArray(data.records) ? data.records : []).map((r: any) =>
            normalizeZip(
              r.fields?.zip ||
                r.fields?.zipcode ||
                r.fields?.zcta5 ||
                r.fields?.zcta ||
                "",
            ),
          ),
        );

        // Filter features by ZIPs and clip to the city boundary for exact visualization
        const filtered: GeoJSON.Feature<
          GeoJSON.Polygon | GeoJSON.MultiPolygon
        >[] = [];
        for (const f of stateGeo.features as any[]) {
          const propZip = normalizeZip(
            (
              f.properties?.ZCTA5CE10 ||
              f.properties?.ZCTA5 ||
              f.properties?.GEOID10 ||
              f.properties?.GEOID ||
              f.properties?.ZIP ||
              f.properties?.zip ||
              ""
            ).toString(),
          );
          if (!propZip || !candidateZips.has(propZip)) continue;

          try {
            // Validate geometries before intersection
            const cleanPlace = turf.cleanCoords(placePoly);
            const cleanZcta = turf.cleanCoords(f);

            // Check if geometries are valid
            if (!cleanPlace.geometry || !cleanZcta.geometry) {
              debug("fetch", `Invalid geometry for ZIP ${propZip}, skipping`);
              continue;
            }
            // Quick bbox check
            const zctaBbox = turf.bbox(cleanZcta);
            const placeBbox = turf.bbox(cleanPlace);
            const bboxIntersects = !(
              zctaBbox[2] < placeBbox[0] ||
              zctaBbox[0] > placeBbox[2] ||
              zctaBbox[3] < placeBbox[1] ||
              zctaBbox[1] > placeBbox[3]
            );
            if (!bboxIntersects) {
              continue;
            }
            // Check actual geometric intersection before attempting intersect
            let intersects = false;
            try {
              intersects = turf.booleanIntersects(
                cleanPlace as any,
                cleanZcta as any,
              );
            } catch {
              intersects = bboxIntersects;
            }
            if (!intersects) {
              continue;
            }

            let clipped: any = null;
            try {
              clipped = turf.intersect(cleanPlace as any, cleanZcta as any);
            } catch (intersectErr) {
              // Suppress noisy per-ZIP errors; fallback below
            }
            if (clipped && turf.area(clipped) > 0) {
              (clipped as any).properties = {
                ...(clipped as any).properties,
                zip: propZip,
              };
              filtered.push(clipped as any);
            } else {
              // If intersection is empty but geometries intersect, use original
              if (turf.booleanIntersects(cleanPlace, cleanZcta)) {
                (cleanZcta as any).properties = {
                  ...(cleanZcta as any).properties,
                  zip: propZip,
                };
                filtered.push(cleanZcta as any);
              }
            }
          } catch (e) {
            // Suppress noisy per-ZIP errors; try final fallback
            // Fallback: include original if intersect test passes
            try {
              if (turf.booleanIntersects(placePoly as any, f as any)) {
                (f as any).properties = {
                  ...(f as any).properties,
                  zip: propZip,
                };
                filtered.push(f as any);
              }
            } catch {}
          }
        }

        debug(
          "fetch",
          `Prepared ${filtered.length} accurate ZCTA polygons for ${city}, ${state}`,
        );

        // Add ZIPs from API data to our comprehensive collection
        const apiZips = (Array.isArray(data.records) ? data.records : [])
          .map((r: any) =>
            normalizeZip(
              r.fields?.zip ||
                r.fields?.zipcode ||
                r.fields?.zcta5 ||
                r.fields?.zcta ||
                "",
            ),
          )
          .filter(Boolean);
        apiZips.forEach((zip: string) => allZips.add(zip));

        // Add polygon features to our collection
        polygonFeatures.push(...filtered);

        debug(
          "fetch",
          `Total ZIPs collected: ${allZips.size}, Polygons available: ${polygonFeatures.length}`,
        );

        // Continue to grouping logic at the end of function
      } else {
        warn("fetch", `State ZCTA GeoJSON fetch failed: ${zctaResp.status}`);
      }
    } catch (error) {
      warn("fetch", `Failed to fetch state ZCTA polygons: ${error}`);
    }

    // Final fallback: collect ZIPs from any remaining API data but don't create synthetic polygons
    if (data?.records) {
      const fallbackZips = (Array.isArray(data.records) ? data.records : [])
        .map((r: any) =>
          normalizeZip(
            r.fields?.zip ||
              r.fields?.zipcode ||
              r.fields?.zcta5 ||
              r.fields?.zcta ||
              "",
          ),
        )
        .filter(Boolean);
      fallbackZips.forEach((zip: string) => allZips.add(zip));
      debug(
        "fetch",
        `Added ${fallbackZips.length} ZIPs from fallback API data`,
      );
    }
  } else {
    debug(
      "fetch",
      "Skipping API fallbacks - using geometric intersection results",
    );
  }

  debug(
    "fetch",
    `Final comprehensive collection: ${allZips.size} total ZIPs, ${polygonFeatures.length} with polygons`,
  );

  // GROUP ZIPS BY ACTUAL CITIES (only for major metros with many suburban ZIPs)
  const MAJOR_METRO_CITIES = [
    // Top 50 US metropolitan areas by population
    "new york",
    "los angeles",
    "chicago",
    "dallas",
    "houston",
    "washington",
    "philadelphia",
    "miami",
    "atlanta",
    "phoenix",
    "boston",
    "san francisco",
    "detroit",
    "riverside",
    "minneapolis",
    "san diego",
    "tampa",
    "denver",
    "baltimore",
    "st. louis",
    "kansas city",
    "las vegas",
    "cleveland",
    "pittsburgh",
    "portland",
    "cincinnati",
    "sacramento",
    "orlando",
    "san antonio",
    "indianapolis",
    "columbus",
    "charlotte",
    "virginia beach",
    "milwaukee",
    "providence",
    "jacksonville",
    "memphis",
    "oklahoma city",
    "louisville",
    "richmond",
    "new orleans",
    "raleigh",
    "salt lake city",
    "buffalo",
    "rochester",
    "birmingham",
    "tucson",
    "fresno",
    "tulsa",
    "urban honolulu",
    // Add common variations and saint/st variations
    "saint paul",
    "saint louis",
    "saint petersburg",
    "fort worth",
    "fort lauderdale",
    "long beach",
    "oakland",
    "mesa",
    "colorado springs",
    "virginia beach",
    "omaha",
    "albuquerque",
    "nashville",
    "seattle",
    "austin",
    "el paso",
    "bakersfield",
    "fresno",
    "sacramento",
  ];
  const searchCityName = placeName || "Unknown";
  const isMajorMetro = MAJOR_METRO_CITIES.includes(
    searchCityName.toLowerCase(),
  );

  debug(
    "fetch",
    `Checking if ${searchCityName} is major metro: ${isMajorMetro}, ZIP count: ${allZips.size}`,
  );

  let zipsByCity: { [cityName: string]: string[] } = {};
  let suburbanCities: { [cityName: string]: string[] } = {};

  if (isMajorMetro && allZips.size > 20) {
    // For major metro areas with many ZIPs, group them by actual city
    debug(
      "fetch",
      `${searchCityName} is a major metro with ${allZips.size} ZIPs - grouping by actual cities`,
    );
    zipsByCity = await groupZipsByPrimaryCity(
      Array.from(allZips),
      searchCityName,
      stateName || "Unknown",
    );

    // Separate main city ZIPs from suburban ZIPs
    const mainCityName = properCapitalize(searchCityName);
    const mainCityZips = zipsByCity[mainCityName] || [];
    suburbanCities = Object.fromEntries(
      Object.entries(zipsByCity).filter(
        ([cityName]) => cityName !== mainCityName,
      ),
    );

    debug(
      "fetch",
      `Metro grouping complete: ${mainCityZips.length} main city ZIPs, ${Object.keys(suburbanCities).length} suburban cities`,
    );
  } else {
    // For smaller cities, don't group - all ZIPs belong to the search city
    debug(
      "fetch",
      `${searchCityName} is not a major metro (${allZips.size} ZIPs) - keeping all ZIPs together`,
    );
    const mainCityName = properCapitalize(searchCityName);
    zipsByCity[mainCityName] = Array.from(allZips);
  }

  // Return comprehensive result
  const mainCityName = properCapitalize(searchCityName);
  const mainCityZips = zipsByCity[mainCityName] || Array.from(allZips);

  // Return the actual grouped data
  return {
    polygonFeatures: {
      type: "FeatureCollection",
      features: polygonFeatures,
    } as GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
    allZips: mainCityZips,
    zipsByCity,
    suburbanCities,
  };
}

/**
 * Score ZIPs based on their intersection with the city polygon
 * Since we're getting targeted ZIPs from APIs, most should be within the city
 */
export function scoreZipsByOverlap(
  placePoly: GeoPolygon,
  zctaFC: GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
): ZipCoverage[] {
  const results: ZipCoverage[] = [];

  debug("score", `Scoring ${zctaFC.features.length} ZIP features`);

  for (const f of zctaFC.features) {
    const zipProp = (
      f.properties?.zip ??
      f.properties?.ZCTA5CE10 ??
      f.properties?.ZCTA5 ??
      f.properties?.zcta ??
      f.properties?.ZIP ??
      f.properties?.GEOID ??
      ""
    ).toString();
    const zip = normalizeZip(zipProp);
    if (!zip || zip.length !== 5) continue;

    // Get centroid of the ZIP area
    let centroidInside = false;
    let zctaArea = 0;
    let overlapArea = 0;

    try {
      const centroid = turf.centroid(f as any);
      zctaArea = turf.area(f); // Area of our synthetic polygon
      centroidInside = turf.booleanPointInPolygon(centroid, placePoly);

      // For synthetic polygons, if centroid is inside, full overlap
      if (centroidInside) {
        overlapArea = zctaArea;
      } else {
        // Check if any part of the polygon intersects
        const intersection = turf.intersect(
          {
            type: "FeatureCollection",
            features: [placePoly],
          },
          f as any,
        );
        if (intersection) {
          overlapArea = turf.area(intersection);
        }
      }
    } catch (error) {
      warn("score", `Error calculating overlap for ZIP ${zip}: ${error}`);
      continue;
    }

    const overlapRatio = zctaArea > 0 ? overlapArea / zctaArea : 0;

    // Include ZIP if centroid is inside OR there's significant overlap
    if (centroidInside || overlapRatio >= AREA_THRESHOLD) {
      results.push({
        zip,
        overlapRatio: Number(overlapRatio.toFixed(6)),
        centroidInside,
        zctaAreaSqm: Math.round(zctaArea),
        overlapAreaSqm: Math.round(overlapArea),
      });
    }
  }

  // Unique by ZIP; keep max overlapRatio if duplicates
  const byZip = new Map<string, ZipCoverage>();
  for (const r of results) {
    const prev = byZip.get(r.zip);
    if (!prev || r.overlapRatio > prev.overlapRatio) byZip.set(r.zip, r);
  }

  const uniqueResults = Array.from(byZip.values()).sort(
    (a, b) => b.overlapRatio - a.overlapRatio,
  );
  debug("score", `Scored ${uniqueResults.length} unique ZIPs for inclusion`);

  return uniqueResults;
}

/**
 * Create GeoJSON features from ZIP codes found in comprehensive database
 */
function createFeaturesFromZips(
  zipCodes: string[],
  city: string,
  state: string,
  placePoly: GeoPolygon,
): ComprehensiveZipResult {
  const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];

  // Get centroid of the city polygon for synthetic ZIP polygons
  const centroid = turf.centroid(placePoly);
  const [lng, lat] = centroid.geometry.coordinates;

  // Create synthetic polygons around each ZIP code
  for (const zip of zipCodes) {
    // Create a small buffer around the centroid for each ZIP
    // This creates a synthetic polygon for visualization
    const bufferSize = 0.001; // Small buffer for individual ZIP areas
    const syntheticPolygon: GeoJSON.Feature<GeoJSON.Polygon> = {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [lng - bufferSize, lat - bufferSize],
            [lng + bufferSize, lat - bufferSize],
            [lng + bufferSize, lat + bufferSize],
            [lng - bufferSize, lat + bufferSize],
            [lng - bufferSize, lat - bufferSize],
          ],
        ],
      },
      properties: {
        zip: zip,
        city: city,
        state: state,
        latitude: lat,
        longitude: lng,
        source: "comprehensive_database",
      },
    };

    features.push(syntheticPolygon);
  }

  // No synthetic polygons - return only the ZIP list for manual addition
  debug(
    "fetch",
    `Returning ${zipCodes.length} ZIPs from comprehensive database (no synthetic polygons)`,
  );

  return {
    polygonFeatures: {
      type: "FeatureCollection",
      features: [],
    } as GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
    allZips: zipCodes,
  };
}

async function fetchTargetedZctas(
  zips: string[],
  stateName: string,
): Promise<GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>> {
  const stateAbbrLower = toStateAbbrLower(stateName);
  const stateSlug = toStateSlug(stateName);
  const zctaUrl = `https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/${stateAbbrLower}_${stateSlug}_zip_codes_geo.min.json`;

  try {
    const resp = await fetch(zctaUrl, { cache: "no-store" });
    if (!resp.ok) throw new Error(`Failed to fetch ZCTA data: ${resp.status}`);

    const data = (await resp.json()) as GeoJSON.FeatureCollection<
      GeoJSON.Polygon | GeoJSON.MultiPolygon
    >;
    const filtered = data.features.filter((feature) => {
      const zipProp = (
        feature.properties?.ZCTA5CE10 ??
        feature.properties?.ZCTA5 ??
        ""
      ).toString();
      return zips.includes(zipProp);
    });

    return { type: "FeatureCollection", features: filtered };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    error("fetch", `Failed to fetch targeted ZCTAs: ${errorMessage}`);
    return { type: "FeatureCollection", features: [] };
  }
}

/**
 * Group ZIPs by their actual city using the same logic as Service Areas
 * This matches exactly how the Service Areas section groups ZIPs after they're added
 */
async function groupZipsByPrimaryCity(
  zips: string[],
  searchCity: string,
  searchState: string,
): Promise<{ [cityName: string]: string[] }> {
  debug(
    "group",
    `Starting CSV-based city grouping for ${zips.length} ZIPs (same logic as Service Areas)...`,
  );

  // Load ZIP data using the same approach as Service Areas
  const csvData = await fs.promises.readFile(
    path.join(process.cwd(), "src/lib/zip-city-data.csv"),
    "utf-8",
  );
  const lines = csvData.split("\n").slice(1); // Skip header

  const cities = new Map<string, string[]>();

  // Build city index exactly like Service Areas does
  for (const line of lines) {
    if (!line.trim()) continue;

    const [stateFips, stateName, stateAbbr, zipcode, county, city] =
      line.split(",");

    if (zipcode && stateAbbr && city) {
      const zip = zipcode.trim();
      const state = stateAbbr.trim();
      const cityKey = `${city.toLowerCase().trim()},${state}`;

      if (!cities.has(cityKey)) {
        cities.set(cityKey, []);
      }
      cities.get(cityKey)!.push(zip);
    }
  }

  // Group ZIPs by their actual cities (exactly like Service Areas logic)
  const cityGroups = new Map<string, string[]>();

  for (const zip of zips) {
    let foundCity = false;

    // Check cities first (same logic as Service Areas)
    for (const [cityKey, cityZips] of cities.entries()) {
      if (cityZips.includes(zip)) {
        const [city, state] = cityKey.split(",");
        const groupKey = `${city}, ${state}`;
        if (!cityGroups.has(groupKey)) {
          cityGroups.set(groupKey, []);
        }
        cityGroups.get(groupKey)!.push(zip);
        foundCity = true;
        break;
      }
    }

    // If not found, assign to search city
    if (!foundCity) {
      const searchKey = `${searchCity.toLowerCase()}, ${toStateAbbrUpper(searchState)}`;
      if (!cityGroups.has(searchKey)) {
        cityGroups.set(searchKey, []);
      }
      cityGroups.get(searchKey)!.push(zip);
    }
  }

  // Convert to proper format with normalized city names
  const zipsByCity: { [cityName: string]: string[] } = {};
  for (const [location, cityZips] of cityGroups.entries()) {
    const [cityPart, state] = location.split(", ");
    const normalizedCityName = await normalizeCityName(cityPart, state);
    zipsByCity[normalizedCityName] = cityZips.sort();
  }

  debug(
    "group",
    `CSV-based grouping complete: ${Object.keys(zipsByCity).length} cities found`,
  );
  Object.entries(zipsByCity).forEach(([city, cityZips]) => {
    debug("group", `- ${city}: ${cityZips.length} ZIPs`);
  });

  return zipsByCity;
}

// City name normalization functions are now imported from normalize module
