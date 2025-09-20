import { NextRequest, NextResponse } from 'next/server';
import { getBusinessConfig } from '@/lib/business-config';
import { getPlaceByCityState, getZctasInBbox, getZctaFeature, getZctasIntersectingPlace } from '@/lib/pmtiles';
import { clipZctasToPlace, scoreZctas, simplifyForRender, unionFeatures } from '@/lib/geo';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as turf from '@turf/turf';

// Cache for place polygons and clipped results to improve performance
const placeCache = new Map<string, any>();

// Path to real ZIP code data
const ZIP_DATA_PATH = join(process.cwd(), 'src', 'lib', 'zip-city-data.csv');

// Cache for parsed ZIP data
let zipDataCache: { cities: Map<string, string[]>, counties: Map<string, string[]> } | null = null;

// Load ZIP data from CSV file (copied from pmtiles.ts)
function loadZipData(): { cities: Map<string, string[]>, counties: Map<string, string[]> } {
  if (zipDataCache) {
    return zipDataCache;
  }

  console.log('Loading ZIP code database...');
  const csvData = readFileSync(ZIP_DATA_PATH, 'utf-8');
  const lines = csvData.split('\n').slice(1); // Skip header

  const cities = new Map<string, string[]>();
  const counties = new Map<string, string[]>();

  for (const line of lines) {
    if (!line.trim()) continue;

    const [stateFips, stateName, stateAbbr, zipcode, county, city] = line.split(',');

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
  console.log(`Loaded ZIP data for ${cities.size} cities and ${counties.size} counties`);
  return zipDataCache;
}


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get('businessId') || 'yardura';

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
      console.log('No service zones configured - returning empty response');
      
      return NextResponse.json({
        businessId,
        groups: [],
        combined: { type: 'FeatureCollection', features: [] },
        union: null,
        stats: {
          totalZips: 0,
          totalGroups: 0,
          totalFeatures: 0
        }
      });
    }

    // If we have city/state grouping (not implemented yet), use it
    // For now, create a single group for all ZIPs
    if (allZips.size > 0) {
      // Load ZIP to city mapping to properly group ZIPs
      const { cities, counties } = loadZipData();
      const cityGroups = new Map<string, string[]>();
      
      // Group ZIPs by their actual cities
      for (const zip of allZips) {
        let foundCity = false;
        
        // Check cities first
        for (const [cityKey, cityZips] of cities.entries()) {
          if (cityZips.includes(zip)) {
            const [city, state] = cityKey.split(',');
            const groupKey = `${city}, ${state}`;
            if (!cityGroups.has(groupKey)) {
              cityGroups.set(groupKey, []);
            }
            cityGroups.get(groupKey)!.push(zip);
            foundCity = true;
            break;
          }
        }
        
        // If not found in cities, check counties
        if (!foundCity) {
          for (const [countyKey, countyZips] of counties.entries()) {
            if (countyZips.includes(zip)) {
              const [county, state] = countyKey.split(',');
              const groupKey = `${county} County, ${state}`;
              if (!cityGroups.has(groupKey)) {
                cityGroups.set(groupKey, []);
              }
              cityGroups.get(groupKey)!.push(zip);
              foundCity = true;
              break;
            }
          }
        }
        
        // If still not found, add to unknown group
        if (!foundCity) {
          const unknownKey = 'Unknown Location';
          if (!cityGroups.has(unknownKey)) {
            cityGroups.set(unknownKey, []);
          }
          cityGroups.get(unknownKey)!.push(zip);
        }
      }
      
      // Convert to service groups
      for (const [location, zips] of cityGroups.entries()) {
        const [cityPart, state] = location.includes(' County,') 
          ? location.split(' County, ')
          : location.split(', ');
        
        serviceGroups.push({
          city: cityPart,
          state: state || 'Unknown',
          zips: zips.sort()
        });
      }
      
      console.log(`Created ${serviceGroups.length} service groups:`, serviceGroups.map(g => `${g.city}, ${g.state} (${g.zips.length} ZIPs)`));

      // Get actual ZCTA polygons by finding cities that contain these ZIPs
      try {
        console.log(`Getting ZCTA polygons for ${allZips.size} ZIP codes`);

        // Group ZIP codes by city/state to use existing place lookup logic
        const zipToLocation = new Map<string, { city: string, state: string }>();

        // Load the ZIP data to find which cities contain these ZIPs
        const { cities, counties } = loadZipData();

        // Create reverse lookup from ZIP to city/state
        for (const [cityKey, zips] of cities) {
          const [city, state] = cityKey.split(',');
          for (const zip of zips) {
            if (allZips.has(zip)) {
              zipToLocation.set(zip, { city, state });
            }
          }
        }

        // Also check counties
        for (const [countyKey, zips] of counties) {
          const [county, state] = countyKey.split(',');
          for (const zip of zips) {
            if (allZips.has(zip) && !zipToLocation.has(zip)) {
              zipToLocation.set(zip, { city: county, state });
            }
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
            const [city, state] = locationKey.split(',');
            console.log(`Getting ZCTAs for ${city}, ${state} (${zips.length} ZIPs)`);

            // Get place polygon
            const place = await getPlaceByCityState(city, state);

            // Get ZCTAs that intersect with this place
            const zctaCollection = await getZctasIntersectingPlace(place);

            // Filter to only include the ZIPs we care about
            const relevantZctas = zctaCollection.features.filter(feature => {
              const props = feature.properties;
              const zip = props?.ZCTA5CE20 || props?.zip || props?.GEOID;
              return zip && zips.includes(String(zip));
            });

            console.log(`Found ${relevantZctas.length} relevant ZCTA features for ${city}, ${state}`);

            allClippedFeatures.push(...relevantZctas);
          } catch (error) {
            console.warn(`Failed to get ZCTAs for ${locationKey}:`, error);
          }
        }

        console.log(`Total ZCTA features collected: ${allClippedFeatures.length}`);
      } catch (error) {
        console.warn('Error getting ZCTA features:', error);
      }
    }

    // Create combined FeatureCollection
    const combined: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: allClippedFeatures
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
        totalFeatures: allClippedFeatures.length
      }
    };

    console.log(`Service areas response: ${allZips.size} ZIPs, ${allClippedFeatures.length} features`);

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('Service areas error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get service areas',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

// POST endpoint for managing service areas (keeping existing functionality)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, businessId = 'yardura' } = body;

    switch (action) {
      case 'search-zips':
        // Forward to the new ZIP search API
        const zipSearchResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/geo/zip-search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        if (!zipSearchResponse.ok) {
          throw new Error(`ZIP search failed: ${zipSearchResponse.status}`);
        }

        return zipSearchResponse;

      case 'add-manual-zips':
      case 'create-zone':
      case 'update-zone':
        // These would use the existing business-config functions
        return NextResponse.json(
          { error: 'Action not implemented in new service areas API' },
          { status: 501 }
        );

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Service areas POST error:', error);
    return NextResponse.json(
      { error: 'Failed to manage service areas' },
      { status: 500 }
    );
  }
}
