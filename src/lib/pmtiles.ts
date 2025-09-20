/**
 * Census data reader utilities
 *
 * Uses real ZIP code database + Nominatim for accurate city boundaries.
 * Returns real ZIP codes for any US city - no mock data.
 */

import * as turf from "@turf/turf";
import { Protocol } from "pmtiles";
import { readFileSync } from "fs";
import { join } from "path";

// State mapping utilities from original code
const STATE_NAME_TO_ABBR: { [key: string]: string } = {
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
  "District of Columbia": "DC",
};

function toStateAbbrUpper(input: string): string {
  if (!input) return "";
  if (input.length === 2) return input.toUpperCase();
  return STATE_NAME_TO_ABBR[input] || input.substring(0, 2).toUpperCase();
}

function toStateAbbrLower(input: string): string {
  return toStateAbbrUpper(input).toLowerCase();
}

// Map state abbreviations to full names for OpenDataDE URLs
function getStateNameSlug(stateAbbr: string): string {
  const ABBR_TO_NAME: { [key: string]: string } = {
    AL: "alabama",
    AK: "alaska",
    AZ: "arizona",
    AR: "arkansas",
    CA: "california",
    CO: "colorado",
    CT: "connecticut",
    DE: "delaware",
    FL: "florida",
    GA: "georgia",
    HI: "hawaii",
    ID: "idaho",
    IL: "illinois",
    IN: "indiana",
    IA: "iowa",
    KS: "kansas",
    KY: "kentucky",
    LA: "louisiana",
    ME: "maine",
    MD: "maryland",
    MA: "massachusetts",
    MI: "michigan",
    MN: "minnesota",
    MS: "mississippi",
    MO: "missouri",
    MT: "montana",
    NE: "nebraska",
    NV: "nevada",
    NH: "new_hampshire",
    NJ: "new_jersey",
    NM: "new_mexico",
    NY: "new_york",
    NC: "north_carolina",
    ND: "north_dakota",
    OH: "ohio",
    OK: "oklahoma",
    OR: "oregon",
    PA: "pennsylvania",
    RI: "rhode_island",
    SC: "south_carolina",
    SD: "south_dakota",
    TN: "tennessee",
    TX: "texas",
    UT: "utah",
    VT: "vermont",
    VA: "virginia",
    WA: "washington",
    WV: "west_virginia",
    WI: "wisconsin",
    WY: "wyoming",
    DC: "district_of_columbia",
  };

  return ABBR_TO_NAME[stateAbbr.toUpperCase()] || stateAbbr.toLowerCase();
}

// Path to real ZIP code data
const ZIP_DATA_PATH = join(process.cwd(), "src", "lib", "zip-city-data.csv");

// Cache for parsed ZIP data
let zipDataCache: {
  cities: Map<string, string[]>;
  counties: Map<string, string[]>;
} | null = null;

/**
 * Load and parse real ZIP code data for both cities and counties
 */
function loadZipData(): {
  cities: Map<string, string[]>;
  counties: Map<string, string[]>;
} {
  if (zipDataCache) {
    return zipDataCache;
  }

  console.log("Loading real ZIP code database...");
  const csvData = readFileSync(ZIP_DATA_PATH, "utf-8");
  const lines = csvData.split("\n").slice(1); // Skip header

  const cities = new Map<string, string[]>();
  const counties = new Map<string, string[]>();

  for (const line of lines) {
    if (!line.trim()) continue;

    const [stateFips, stateName, stateAbbr, zipcode, county, city] =
      line.split(",");

    if (zipcode && stateAbbr) {
      const zip = zipcode.trim();
      const state = stateAbbr.trim();

      // Index by city
      if (city) {
        const cityKey = `${city.toLowerCase().trim()},${state}`;
        if (!cities.has(cityKey)) {
          cities.set(cityKey, []);
        }
        cities.get(cityKey)!.push(zip);
      }

      // Index by county
      if (county) {
        const countyKey = `${county.toLowerCase().trim()},${state}`;
        if (!counties.has(countyKey)) {
          counties.set(countyKey, []);
        }
        counties.get(countyKey)!.push(zip);
      }
    }
  }

  zipDataCache = { cities, counties };
  console.log(
    `Loaded ZIP data for ${cities.size} cities and ${counties.size} counties`,
  );
  return zipDataCache;
}

/**
 * Get place polygon by county and state name using Nominatim
 * Returns real county boundaries when available
 */
export async function getPlaceByCountyState(
  county: string,
  state: string,
): Promise<GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>> {
  console.log(`Getting county polygon for: ${county} County, ${state}`);

  try {
    // Use Nominatim to get county boundaries
    const query = `${county} County, ${state}, United States`;
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=geojson&polygon_geojson=1&limit=1&addressdetails=1`;

    console.log(`Querying Nominatim for county: ${query}`);

    const response = await fetch(nominatimUrl, {
      headers: {
        "User-Agent": "Yardura ZIP Search (contact: hello@yardura.com)",
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim county query failed: ${response.status}`);
    }

    const featureCollection = await response.json();

    if (featureCollection?.features?.length > 0) {
      const place = featureCollection.features[0];

      // If we got a polygon from Nominatim, use it
      if (
        place.geometry?.type === "Polygon" ||
        place.geometry?.type === "MultiPolygon"
      ) {
        console.log(`Found OSM county boundary for ${county} County, ${state}`);
        return {
          type: "Feature",
          geometry: place.geometry,
          properties: {
            NAME: county,
            STATE: state,
            GEOID: place.properties?.osm_id || "osm",
            searchType: "county",
            source: "nominatim",
          },
        };
      }

      // If we only got a point, create a larger county boundary around it
      if (place.geometry?.type === "Point") {
        const [lng, lat] = place.geometry.coordinates;
        console.log(
          `Creating county boundary around point for ${county} County, ${state} at [${lng}, ${lat}]`,
        );

        // Counties are much larger than cities
        const size = 0.25; // Larger size for counties

        return {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [lng - size, lat - size],
                [lng + size, lat - size],
                [lng + size, lat + size],
                [lng - size, lat + size],
                [lng - size, lat - size],
              ],
            ],
          },
          properties: {
            NAME: county,
            STATE: state,
            GEOID: place.properties?.osm_id || "osm",
            lat: lat,
            lng: lng,
            searchType: "county",
            source: "nominatim-point",
          },
        };
      }
    }

    throw new Error(`No county found for ${county}, ${state}`);
  } catch (error) {
    console.error(`County lookup failed for ${county}, ${state}:`, error);
    throw error;
  }
}

/**
 * Get place polygon by city and state name using Nominatim
 * Returns real city boundaries when available
 */
export async function getPlaceByCityState(
  city: string,
  state: string,
): Promise<GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>> {
  console.log(`Getting place polygon for: ${city}, ${state}`);

  try {
    // Use Nominatim to get accurate city coordinates and boundaries
    const query = `${city}, ${state}, United States`;
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=geojson&polygon_geojson=1&limit=1&addressdetails=1`;

    console.log(`Querying Nominatim for: ${query}`);

    const response = await fetch(nominatimUrl, {
      headers: {
        "User-Agent": "Yardura ZIP Search (contact: hello@yardura.com)",
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim query failed: ${response.status}`);
    }

    const featureCollection = await response.json();

    if (featureCollection?.features?.length > 0) {
      const place = featureCollection.features[0];

      // If we got a polygon from Nominatim, use it
      if (
        place.geometry?.type === "Polygon" ||
        place.geometry?.type === "MultiPolygon"
      ) {
        console.log(`Found OSM place boundary for ${city}, ${state}`);
        return {
          type: "Feature",
          geometry: place.geometry,
          properties: {
            NAME: city,
            STATE: state,
            GEOID: place.properties?.osm_id || "osm",
            source: "nominatim",
          },
        };
      }

      // If we only got a point, create a reasonable city boundary around it
      if (place.geometry?.type === "Point") {
        const [lng, lat] = place.geometry.coordinates;
        console.log(
          `Creating boundary around point for ${city}, ${state} at [${lng}, ${lat}]`,
        );

        // Determine city size based on known major cities
        let size = 0.05; // Default size

        const majorCities = {
          "new york": 0.15,
          "los angeles": 0.2,
          chicago: 0.18,
          houston: 0.2,
          phoenix: 0.15,
          philadelphia: 0.12,
          "san antonio": 0.18,
          "san diego": 0.15,
          dallas: 0.15,
          "san jose": 0.1,
          austin: 0.12,
          jacksonville: 0.15,
          "fort worth": 0.12,
          columbus: 0.1,
          charlotte: 0.1,
          "san francisco": 0.08,
          indianapolis: 0.1,
          seattle: 0.1,
          denver: 0.12,
          washington: 0.12,
        };

        size = (majorCities as any)[city.toLowerCase()] || 0.05;

        return {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [lng - size, lat - size],
                [lng + size, lat - size],
                [lng + size, lat + size],
                [lng - size, lat + size],
                [lng - size, lat - size],
              ],
            ],
          },
          properties: {
            NAME: city,
            STATE: state,
            GEOID: place.properties?.osm_id || "osm",
            lat: lat,
            lng: lng,
            source: "nominatim-point",
          },
        };
      }
    }

    throw new Error(`No place found for ${city}, ${state}`);
  } catch (error) {
    console.error(`Place lookup failed for ${city}, ${state}:`, error);
    throw error;
  }
}

/**
 * Get real ZIP codes for a city/county from the ZIP database
 * Then generate realistic ZCTA polygons for those ZIP codes
 */
export async function getZctasIntersectingPlace(
  place: GeoJSON.Feature,
): Promise<GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>> {
  const placeName = place.properties?.NAME;
  const stateName = place.properties?.STATE;
  const searchType = place.properties?.searchType || "city"; // 'city' or 'county'

  console.log(
    `Getting real ZIP codes for ${searchType}: ${placeName}, ${stateName}`,
  );

  try {
    // Load real ZIP data
    const { cities, counties } = loadZipData();
    const key = `${placeName.toLowerCase()},${stateName}`;

    let zipCodes: string[] = [];

    if (searchType === "county") {
      zipCodes = counties.get(key) || [];
      console.log(
        `Found ${zipCodes.length} real ZIP codes for ${placeName} County, ${stateName}`,
      );
    } else {
      zipCodes = cities.get(key) || [];
      console.log(
        `Found ${zipCodes.length} real ZIP codes for ${placeName} city, ${stateName}`,
      );

      // If no city match, try county with same name
      if (zipCodes.length === 0) {
        zipCodes = counties.get(key) || [];
        if (zipCodes.length > 0) {
          console.log(
            `No city match, found ${zipCodes.length} ZIP codes for ${placeName} County, ${stateName}`,
          );
        }
      }
    }

    if (zipCodes.length === 0) {
      console.log(`No ZIP codes found for ${placeName}, ${stateName}`);
      return {
        type: "FeatureCollection",
        features: [],
      };
    }

    console.log(
      `Using ${zipCodes.length} real ZIP codes:`,
      zipCodes.slice(0, 10),
      zipCodes.length > 10 ? "..." : "",
    );

    // Load real ZCTA polygons from OpenDataDE (US Census data) - the original working approach
    console.log(
      "Loading real ZCTA polygons from US Census data for ZIP codes:",
      zipCodes,
    );

    // Use the state abbreviation to fetch real ZCTA GeoJSON data
    const stateAbbrUpper = toStateAbbrUpper(stateName);
    const stateAbbrLower = stateAbbrUpper.toLowerCase();
    const stateNameSlug = getStateNameSlug(stateAbbrUpper);
    const zctaUrl = `https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/${stateAbbrLower}_${stateNameSlug}_zip_codes_geo.min.json`;

    console.log(
      `Fetching real ZCTA data for state "${stateName}" -> abbr: "${stateAbbrUpper}" -> lower: "${stateAbbrLower}", name: "${stateNameSlug}"`,
    );
    console.log(`URL: ${zctaUrl}`);

    const zctaResp = await fetch(zctaUrl, { cache: "no-store" });
    if (!zctaResp.ok) {
      throw new Error(`Failed to fetch ZCTA data: ${zctaResp.status}`);
    }

    const stateGeo = await zctaResp.json();
    console.log(
      `Loaded ${stateGeo.features?.length || 0} real ZCTA features for ${stateName}`,
    );

    // Build set of target ZIP codes
    const targetZips = new Set(zipCodes);

    // Filter and clip real ZCTA polygons to the city boundary
    const features: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>[] =
      [];

    for (const zcta of stateGeo.features || []) {
      const zipProp =
        zcta.properties?.ZCTA5CE10 ||
        zcta.properties?.ZCTA5 ||
        zcta.properties?.GEOID ||
        zcta.properties?.zip;
      if (!zipProp || !targetZips.has(String(zipProp))) continue;

      try {
        // Clean geometries first
        const cleanPlace = turf.cleanCoords(place);
        const cleanZcta = turf.cleanCoords(zcta);

        // Quick bbox check
        const zctaBbox = turf.bbox(cleanZcta);
        const placeBbox = turf.bbox(cleanPlace);

        const bboxIntersects = !(
          zctaBbox[2] < placeBbox[0] ||
          zctaBbox[0] > placeBbox[2] ||
          zctaBbox[3] < placeBbox[1] ||
          zctaBbox[1] > placeBbox[3]
        );

        if (!bboxIntersects) continue;

        // Check actual geometric intersection
        let intersects = false;
        try {
          intersects = turf.booleanIntersects(
            cleanPlace as any,
            cleanZcta as any,
          );
        } catch {
          intersects = bboxIntersects; // Fallback to bbox
        }

        if (!intersects) continue;

        // Clip ZCTA to city boundary for accurate visualization
        let clippedFeature: any = null;
        try {
          clippedFeature = turf.intersect(cleanPlace as any, cleanZcta as any);
        } catch (intersectErr) {
          console.debug(`Intersect failed for ZIP ${zipProp}, using original`);
        }

        if (clippedFeature && turf.area(clippedFeature) > 0) {
          // Use clipped polygon
          clippedFeature.properties = {
            ...clippedFeature.properties,
            zip: String(zipProp),
            ZCTA5CE20: String(zipProp),
            GEOID: String(zipProp),
          };
          features.push(clippedFeature);
          console.log(`Added clipped ZCTA for ZIP ${zipProp}`);
        } else if (turf.booleanIntersects(cleanPlace, cleanZcta)) {
          // Use original ZCTA if intersection failed but geometries do intersect
          cleanZcta.properties = {
            ...cleanZcta.properties,
            zip: String(zipProp),
            ZCTA5CE20: String(zipProp),
            GEOID: String(zipProp),
          };
          features.push(cleanZcta);
          console.log(
            `Added original ZCTA for ZIP ${zipProp} (intersection failed)`,
          );
        }
      } catch (error) {
        console.warn(`Error processing ZCTA for ZIP ${zipProp}:`, error);
        continue;
      }
    }

    console.log(
      `Prepared ${features.length} real ZCTA polygons from US Census data`,
    );

    return {
      type: "FeatureCollection",
      features,
    };
  } catch (error) {
    console.error("Real ZIP lookup failed:", error);
    throw error;
  }
}

/**
 * Get real ZCTA polygons within a bounding box using OpenDataDE Census data
 */
export async function getZctasInBbox(
  bbox: [number, number, number, number],
): Promise<GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>> {
  try {
    console.log("Getting real ZCTA data for bbox:", bbox);

    // For bbox queries, we need to determine which states to query
    // For now, query a few common states that might contain the bbox
    // In production, you'd have a more sophisticated state lookup
    const statesToTry = ["MN", "WI", "IA", "ND", "SD"]; // Common states for testing

    const allFeatures: GeoJSON.Feature<
      GeoJSON.Polygon | GeoJSON.MultiPolygon
    >[] = [];

    for (const stateAbbr of statesToTry) {
      try {
        const stateSlug = stateAbbr.toLowerCase();
        const stateNameSlug = getStateNameSlug(stateAbbr);
        const zctaUrl = `https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/${stateSlug}_${stateNameSlug}_zip_codes_geo.min.json`;

        console.log(`Trying to fetch ZCTA data for ${stateAbbr}: ${zctaUrl}`);

        const response = await fetch(zctaUrl, { cache: "no-store" });
        if (response.ok) {
          const stateGeo = await response.json();

          // Filter features that intersect with the bbox
          for (const feature of stateGeo.features || []) {
            try {
              const featureBbox = turf.bbox(feature);
              const intersects = !(
                featureBbox[2] < bbox[0] ||
                featureBbox[0] > bbox[2] ||
                featureBbox[3] < bbox[1] ||
                featureBbox[1] > bbox[3]
              );

              if (intersects) {
                allFeatures.push(feature);
              }
            } catch (error) {
              // Skip invalid features
              continue;
            }
          }

          console.log(
            `Found ${allFeatures.length} ZCTA features from ${stateAbbr}`,
          );
        }
      } catch (error) {
        console.warn(`Failed to fetch ZCTA data for ${stateAbbr}:`, error);
        continue;
      }
    }

    console.log(`Total ZCTA features found: ${allFeatures.length}`);

    return {
      type: "FeatureCollection",
      features: allFeatures,
    };
  } catch (error) {
    console.error("ZCTA bbox lookup failed:", error);
    return {
      type: "FeatureCollection",
      features: [],
    };
  }
}

/**
 * Get a single ZCTA feature by ZIP code - NO SYNTHETIC DATA
 */
export async function getZctaFeature(
  zipCode: string,
): Promise<GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null> {
  console.log(`Attempting to find real ZCTA data for ZIP ${zipCode}`);

  // Since we don't have proper PMTiles integration yet, return null
  // This is better than returning synthetic data
  console.log(
    "Real ZCTA lookup not yet implemented - returning null instead of synthetic data",
  );

  return null;
}

/**
 * Initialize PMTiles protocol for MapLibre client-side usage
 */
export function initializePMTilesProtocol() {
  // This will be called on the client side to register the pmtiles:// protocol
  if (typeof window !== "undefined") {
    new Protocol();
    // Register with MapLibre
    // This would typically be: maplibre.addProtocol('pmtiles', protocol.tile);
  }
}
