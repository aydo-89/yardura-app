import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

// Google Places API configuration (using existing Maps API key)
const GOOGLE_PLACES_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// Path to real ZIP code data
const ZIP_DATA_PATH = join(process.cwd(), "src", "lib", "zip-city-data.csv");

interface LocationOption {
  id: string;
  label: string;
  city: string;
  state: string;
  type: "city" | "county";
  zipCount: number;
}

let locationCache: LocationOption[] | null = null;

// Common city name fixes for truncated CSV data (Minnesota focus)
const CITY_NAME_FIXES: { [truncated: string]: string } = {
  "inver grove heig": "Inver Grove Heights",
  mendota: "Mendota Heights",
  "white bear": "White Bear Lake",
  "saint louis park": "St. Louis Park",
  "saint paul": "St. Paul",
  "saint anthony": "St. Anthony",
  "new brighton": "New Brighton",
  "brooklyn park": "Brooklyn Park",
  "brooklyn center": "Brooklyn Center",
  "coon rapids": "Coon Rapids",
  "columbia heights": "Columbia Heights",
  "little canada": "Little Canada",
  "north saint paul": "North St. Paul",
  "apple valley": "Apple Valley",
  "prior lake": "Prior Lake",
  "eden prairie": "Eden Prairie",
  "maple grove": "Maple Grove",
  "spring lake park": "Spring Lake Park",
  "ham lake": "Ham Lake",
  "lino lakes": "Lino Lakes",
  "circle pines": "Circle Pines",
};

// Helper function for proper capitalization with common fixes
function properCapitalize(text: string): string {
  const normalized = text.toLowerCase().trim();

  // Check for known fixes first
  if (CITY_NAME_FIXES[normalized]) {
    return CITY_NAME_FIXES[normalized];
  }

  // Default capitalization
  return text
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function loadLocationOptions(): LocationOption[] {
  if (locationCache) {
    return locationCache;
  }

  console.log("Loading location options for autocomplete...");
  const csvData = readFileSync(ZIP_DATA_PATH, "utf-8");
  const lines = csvData.split("\n").slice(1); // Skip header

  const cityZipCounts = new Map<string, number>();

  // Count ZIP codes per city only
  for (const line of lines) {
    if (!line.trim()) continue;

    const [stateFips, stateName, stateAbbr, zipcode, county, city] =
      line.split(",");

    if (zipcode && stateAbbr && city) {
      const cityKey = `${city.toLowerCase().trim()},${stateAbbr.trim()}`;
      cityZipCounts.set(cityKey, (cityZipCounts.get(cityKey) || 0) + 1);
    }
  }

  const options: LocationOption[] = [];

  // Add city options only
  for (const [key, zipCount] of cityZipCounts.entries()) {
    const [city, state] = key.split(",");
    if (zipCount >= 1) {
      // Only include cities with ZIP codes
      options.push({
        id: `city-${key}`,
        label: `${properCapitalize(city)}, ${state}`,
        city: properCapitalize(city),
        state: state,
        type: "city",
        zipCount,
      });
    }
  }

  // Sort by ZIP count (descending) then by name
  options.sort((a, b) => {
    if (b.zipCount !== a.zipCount) {
      return b.zipCount - a.zipCount;
    }
    return a.label.localeCompare(b.label);
  });

  locationCache = options;
  console.log(
    `Loaded ${options.length} city options (${cityZipCounts.size} cities)`,
  );

  return options;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.toLowerCase() || "";
    const limit = parseInt(searchParams.get("limit") || "20");

    // Always use Google Places for queries when available (don't mix with CSV)
    if (query && query.length >= 2 && GOOGLE_PLACES_API_KEY) {
      try {
        const placesUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&types=(cities)&components=country:us&key=${GOOGLE_PLACES_API_KEY}`;

        const response = await fetch(placesUrl);
        if (response.ok) {
          const data = await response.json();

          if (data.predictions && data.predictions.length > 0) {
            const googleOptions: LocationOption[] = data.predictions
              .filter((prediction: any) => {
                // Only include US cities
                return prediction.terms && prediction.terms.length >= 2;
              })
              .slice(0, limit)
              .map((prediction: any, index: number) => {
                const terms = prediction.terms;
                const cityName = terms[0].value;
                const stateName = terms[terms.length - 2].value; // Second to last is usually state

                return {
                  id: `google-${prediction.place_id}`,
                  label: `${cityName}, ${stateName}`,
                  city: cityName,
                  state: stateName,
                  type: "city" as const,
                  zipCount: 0, // Will be determined after search
                };
              });

            console.log(
              `Google Places returned ${googleOptions.length} options for "${query}"`,
            );
            return NextResponse.json({ options: googleOptions });
          }
        }
      } catch (placesError) {
        console.warn(
          "Google Places API failed, falling back to CSV:",
          placesError,
        );
      }
    }

    // Fallback to CSV-based options with name fixes
    const allOptions = loadLocationOptions();

    if (!query) {
      // Return top options by ZIP count
      return NextResponse.json({
        options: allOptions.slice(0, limit),
      });
    }

    // Filter options based on query
    const filtered = allOptions.filter(
      (option) =>
        option.label.toLowerCase().includes(query) ||
        option.city.toLowerCase().includes(query) ||
        option.state.toLowerCase().includes(query),
    );

    return NextResponse.json({
      options: filtered.slice(0, limit),
    });
  } catch (error) {
    console.error("Autocomplete error:", error);
    return NextResponse.json({ error: "Autocomplete failed" }, { status: 500 });
  }
}
