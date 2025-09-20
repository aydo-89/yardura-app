import { NextRequest, NextResponse } from 'next/server';
import {
  getBusinessConfig,
  updateBusinessConfig,
  addZipsToZone,
  createServiceZone,
  ServiceZoneConfig,
} from '@/lib/business-config';
import { geocodePlaceToPolygon, fetchZctasForGeometry, scoreZipsByOverlap } from '@/lib/geo-zip';

interface ZipCodeSearchRequest {
  city: string;
  state: string;
  businessId?: string;
}

interface ManualZipRequest {
  zipCodes: string[];
  zoneId: string;
  businessId?: string;
}

interface ServiceZoneRequest {
  zone: Omit<ServiceZoneConfig, 'zipCodes'>;
  businessId?: string;
}

// GET /api/admin/service-areas - Get service areas for a business
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId') || 'yardura';

    const config = await getBusinessConfig(businessId);
    const serviceAreas = config.serviceZones.map(zone => ({
      ...zone,
      zipCount: zone.zipCodes.length,
      coverage: `${zone.zipCodes.length} ZIP codes`,
    }));

    return NextResponse.json({
      businessId,
      serviceAreas,
      totalZips: serviceAreas.reduce((sum, area) => sum + area.zipCount, 0),
    });
  } catch (error) {
    console.error('Error fetching service areas:', error);
    return NextResponse.json(
      { error: 'Failed to fetch service areas' },
      { status: 500 }
    );
  }
}

// POST /api/admin/service-areas - Manage service areas
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, businessId = 'yardura' } = body;

    switch (action) {
      case 'search-zips':
        return await handleZipSearch(body as ZipCodeSearchRequest);

      case 'add-manual-zips':
        return await handleManualZips(body as ManualZipRequest);

      case 'create-zone':
        return await handleCreateZone(body as ServiceZoneRequest);

      case 'update-zone':
        return await handleUpdateZone(body);

      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be search-zips, add-manual-zips, create-zone, or update-zone' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error managing service areas:', error);
    return NextResponse.json(
      { error: 'Failed to manage service areas' },
      { status: 500 }
    );
  }
}

// Handle ZIP code search by city/area using geometric intersection
async function handleZipSearch(request: ZipCodeSearchRequest): Promise<NextResponse> {
  const { city, state, businessId = 'yardura' } = request;

  if (!city || !state) {
    return NextResponse.json(
      { error: 'City and state are required for ZIP search' },
      { status: 400 }
    );
  }

  try {
    // Step 1: Geocode city/state to polygon
    const placePoly = await geocodePlaceToPolygon(city, state);

    // Step 2: Fetch candidate ZCTA features
    const zipResult = await fetchZctasForGeometry(placePoly);
    const zctaFC = zipResult.polygonFeatures;

    // Step 3: Score overlap and determine included ZIPs
    const scored = scoreZipsByOverlap(placePoly, zctaFC);

    const zips = scored.map(s => s.zip);
    const unique = Array.from(new Set(zips));

    if (unique.length === 0) {
      return NextResponse.json({
        searchCriteria: { city, state },
        results: [],
        count: 0,
        message: `No ZIP codes found from polygon/ZCTA intersection for ${city}, ${state}.`,
      });
    }

    // Build map visualization data
    const includedSet = new Set(unique);
    const includedFeatures = zctaFC.features.filter((f: any) => {
      const zipProp = (f.properties?.zip ?? f.properties?.ZCTA5CE10 ?? f.properties?.ZCTA5 ?? f.properties?.zcta ?? f.properties?.ZIP ?? f.properties?.GEOID ?? '').toString();
      const zip = zipProp.replace(/\D/g, '').slice(0, 5);
      return includedSet.has(zip);
    });

    const payload: any = {
      searchCriteria: { city, state },
      results: unique,
      count: unique.length,
      message: `Found ${unique.length} ZIP codes for ${city}, ${state} via polygon/ZCTA intersection.`,
      map: {
        place: placePoly,
        includedZctas: { type: 'FeatureCollection', features: includedFeatures },
      },
    };

    // Optional debug mode with scores (enable via query param)
    // Note: Debug mode disabled for now - can be re-enabled when needed
    // const url = new URL(request.url.toString());
    // if (url.searchParams.get('debug') === '1') {
    //   payload.debug = { scores: scored };
    // }

    return NextResponse.json(payload);
  } catch (error: any) {
    console.error('ZIP search error:', error?.message || error);
    return NextResponse.json(
      { error: `Failed to search ZIP codes: ${error?.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// Handle manual ZIP code addition
async function handleManualZips(request: ManualZipRequest): Promise<NextResponse> {
  const { zipCodes, zoneId, businessId = 'yardura' } = request;

  if (!zipCodes || !Array.isArray(zipCodes) || zipCodes.length === 0) {
    return NextResponse.json(
      { error: 'ZIP codes array is required' },
      { status: 400 }
    );
  }

  if (!zoneId) {
    return NextResponse.json(
      { error: 'Zone ID is required' },
      { status: 400 }
    );
  }

  // Validate ZIP code format
  const invalidZips = zipCodes.filter(zip => !/^\d{5}(-\d{4})?$/.test(zip));
  if (invalidZips.length > 0) {
    return NextResponse.json(
      { error: `Invalid ZIP code format: ${invalidZips.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    // First check if zone exists, if not create it
    const config = await getBusinessConfig(businessId);
    const zone = config.serviceZones.find(z => z.zoneId === zoneId);
    
    if (!zone) {
      // Create the default zone if it doesn't exist
      const defaultZone: ServiceZoneConfig = {
        zoneId,
        name: zoneId === 'zone-urban-core' ? 'Urban Core' : 'Service Zone',
        baseMultiplier: 1.0,
        description: 'Primary service area',
        serviceable: true,
        zipCodes: [],
      };
      
      const zoneCreated = await createServiceZone(businessId, defaultZone);
      if (!zoneCreated) {
        return NextResponse.json(
          { error: `Failed to create zone ${zoneId}` },
          { status: 500 }
        );
      }
    }

    const success = await addZipsToZone(businessId, zoneId, zipCodes);

    if (!success) {
      return NextResponse.json(
        { error: `Failed to add ZIP codes to zone ${zoneId}` },
        { status: 500 }
      );
    }

    const updatedConfig = await getBusinessConfig(businessId);
    const updatedZone = updatedConfig.serviceZones.find(z => z.zoneId === zoneId);

    return NextResponse.json({
      message: `Successfully added ${zipCodes.length} ZIP codes to zone ${zoneId}`,
      zone: updatedZone,
      addedZips: zipCodes,
    });
  } catch (error) {
    console.error('Manual ZIP addition error:', error);
    return NextResponse.json(
      { error: 'Failed to add ZIP codes' },
      { status: 500 }
    );
  }
}

// Handle service zone creation
async function handleCreateZone(request: ServiceZoneRequest): Promise<NextResponse> {
  const { zone, businessId = 'yardura' } = request;

  if (!zone.zoneId || !zone.name) {
    return NextResponse.json(
      { error: 'Zone ID and name are required' },
      { status: 400 }
    );
  }

  const newZone: ServiceZoneConfig = {
    ...zone,
    zipCodes: [], // Start with empty ZIP codes
  };

  try {
    const success = await createServiceZone(businessId, newZone);

    if (!success) {
      return NextResponse.json(
        { error: `Zone ${zone.zoneId} already exists for business ${businessId}` },
        { status: 409 }
      );
    }

    return NextResponse.json({
      message: `Successfully created service zone ${zone.name}`,
      zone: newZone,
    });
  } catch (error) {
    console.error('Zone creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create service zone' },
      { status: 500 }
    );
  }
}

// Handle service zone updates
async function handleUpdateZone(request: any): Promise<NextResponse> {
  const { zoneId, updates, businessId = 'yardura' } = request;

  if (!zoneId || !updates) {
    return NextResponse.json(
      { error: 'Zone ID and updates are required' },
      { status: 400 }
    );
  }

  try {
    const config = await getBusinessConfig(businessId);
    const zoneIndex = config.serviceZones.findIndex(z => z.zoneId === zoneId);

    if (zoneIndex === -1) {
      return NextResponse.json(
        { error: `Zone ${zoneId} not found` },
        { status: 404 }
      );
    }

    // Update the zone
    config.serviceZones[zoneIndex] = {
      ...config.serviceZones[zoneIndex],
      ...updates,
    };

    await updateBusinessConfig(businessId, { serviceZones: config.serviceZones });

    return NextResponse.json({
      message: `Successfully updated service zone ${zoneId}`,
      zone: config.serviceZones[zoneIndex],
    });
  } catch (error) {
    console.error('Zone update error:', error);
    return NextResponse.json(
      { error: 'Failed to update service zone' },
      { status: 500 }
    );
  }
}


// DELETE /api/admin/service-areas - Remove ZIP codes or zones
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId') || 'yardura';
    const zoneId = searchParams.get('zoneId');
    const zipCode = searchParams.get('zipCode');

    const config = await getBusinessConfig(businessId);
    const zoneIndex = config.serviceZones.findIndex(z => z.zoneId === zoneId);

    if (zoneIndex === -1) {
      return NextResponse.json(
        { error: `Zone ${zoneId} not found` },
        { status: 404 }
      );
    }

    if (zipCode) {
      // Remove specific ZIP code
      const zone = config.serviceZones[zoneIndex];
      const originalLength = zone.zipCodes.length;
      zone.zipCodes = zone.zipCodes.filter(zip => zip !== zipCode);

      if (zone.zipCodes.length === originalLength) {
        return NextResponse.json(
          { error: `ZIP code ${zipCode} not found in zone ${zoneId}` },
          { status: 404 }
        );
      }

      await updateBusinessConfig(businessId, { serviceZones: config.serviceZones });

      return NextResponse.json({
        message: `Removed ZIP code ${zipCode} from zone ${zoneId}`,
        zone: zone,
      });
    } else {
      // Remove entire zone
      config.serviceZones.splice(zoneIndex, 1);
      await updateBusinessConfig(businessId, { serviceZones: config.serviceZones });

      return NextResponse.json({
        message: `Removed service zone ${zoneId}`,
      });
    }
  } catch (error) {
    console.error('Error deleting service area:', error);
    return NextResponse.json(
      { error: 'Failed to delete service area' },
      { status: 500 }
    );
  }
}

// Export an empty object to ensure clean module structure
export {};
