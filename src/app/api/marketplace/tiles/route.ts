import { NextRequest, NextResponse } from "next/server";
import type { Feature, FeatureCollection, Geometry } from "geojson";

import { resolveBusinessId } from "@/lib/tenant";
import { listTileReadiness } from "@/lib/marketplace/tiles";
import { listServiceAreas } from "@/lib/tiles/service-areas";

function parseGeometry(value: string | Feature | FeatureCollection | null | undefined): Feature | FeatureCollection | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as Feature | Geometry | FeatureCollection;
      if (!parsed) return null;
      if ((parsed as FeatureCollection).type === "FeatureCollection") {
        return parsed as FeatureCollection;
      }
      if ((parsed as Feature).type === "Feature" && "geometry" in (parsed as Feature)) {
        return parsed as Feature;
      }
      if ((parsed as Geometry).type) {
        return {
          type: "Feature",
          geometry: parsed as Geometry,
          properties: {},
        };
      }
      return null;
    } catch (error) {
      console.warn("Failed to parse tile geometry payload", error);
      return null;
    }
  }

  return value as Feature | FeatureCollection;
}

function toFeatureCollection(feature: Feature | FeatureCollection | null): FeatureCollection | null {
  if (!feature) return null;
  if ((feature as FeatureCollection).type === "FeatureCollection") {
    return feature as FeatureCollection;
  }
  return {
    type: "FeatureCollection",
    features: [feature as Feature],
  };
}

export async function GET(request: NextRequest) {
  const orgId = await resolveBusinessId(request);

  try {
    const [readinessList, serviceAreas] = await Promise.all([
      listTileReadiness(orgId),
      (async () => {
        try {
          return await listServiceAreas(orgId);
        } catch (error) {
          console.warn("marketplace tiles: service area summary unavailable", error);
          return [];
        }
      })(),
    ]);

    const serviceAreaBySlug = new Map(
      serviceAreas.map((area) => [area.tile.slug, area]),
    );

    const data = readinessList.map((entry) => {
      const area = serviceAreaBySlug.get(entry.tile.slug);
      const geometry = toFeatureCollection(
        parseGeometry(area?.tileGeometry ?? entry.tile.geometryGeoJSON ?? null),
      );

      const latestSnapshot = entry.latestSnapshot
        ? {
            activeScoopers: entry.latestSnapshot.activeScoopers,
            scheduledStops: entry.latestSnapshot.scheduledStops,
            completedStops: entry.latestSnapshot.completedStops,
            weekOf: entry.latestSnapshot.weekOf.toISOString(),
          }
        : null;

      const coverage = area
        ? {
            zipCount: area.zipCount,
            coveragePercent: area.coveragePercent,
            tileAreaSqMeters: area.tileAreaSqMeters,
            coveredAreaSqMeters: area.coveredAreaSqMeters,
            conflictZipCount: area.conflictZipCount,
          }
        : {
            zipCount: 0,
            coveragePercent: null,
            tileAreaSqMeters: null,
            coveredAreaSqMeters: null,
            conflictZipCount: 0,
          };

      const zips = area?.zips ?? [];
      const cities = Array.from(
        new Set(
          zips
            .map((zip) => zip.placeName?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b));

      return {
        tile: {
          slug: entry.tile.slug,
          name: entry.tile.name,
          status: entry.tile.status,
          goLiveDate: entry.tile.goLiveDate ? entry.tile.goLiveDate.toISOString() : null,
          minCertifiedScoopers: entry.thresholds.minCertifiedScoopers,
          minCustomerUnits: entry.thresholds.minCustomerUnits,
          coverageRadiusMeters: entry.tile.coverageRadiusMeters,
          territoryId: entry.tile.territoryId,
          geometry,
          cities,
          zips: zips.map((zip) => zip.zip),
          coverage,
        },
        readiness: {
          activationEligible: entry.activationEligible,
          unmetScooperCount: entry.unmetScooperCount,
          unmetCustomerCount: entry.unmetCustomerCount,
          advisoryReasons: entry.advisoryReasons,
        },
        latestSnapshot,
      };
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error("marketplace tiles GET error", error);
    return NextResponse.json(
      { error: "failed_to_load_tiles" },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
