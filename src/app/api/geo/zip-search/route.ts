import { NextRequest, NextResponse } from "next/server";

import { getZipRepository } from "@/lib/geo/zip-repository";
import { properCapitalize } from "@/lib/geo/normalize";
import { getPostgisPool } from "@/lib/geo/postgis";
import type * as GeoJSON from "geojson";

function wrapGeometry(geometry: any, properties?: Record<string, any>) {
  if (!geometry) return null;
  return {
    type: "Feature",
    geometry,
    properties: properties ?? {},
  } as const;
}

function buildZipFeatures(zips: any[]) {
  const features: any[] = [];
  for (const zip of zips as Array<any>) {
    const geometry = typeof zip.geometry === "string" ? JSON.parse(zip.geometry) : zip.geometry;
    if (!geometry) continue;
    features.push({
      type: "Feature",
      geometry,
      properties: {
        zip: zip.zip,
        population: zip.population ?? null,
        areaSqMeters: zip.areaSqMeters ?? null,
        coverageRatio: zip.coverageRatio ?? null,
      },
    });
  }
  return features;
}

function sanitizeNumber(value: number | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return 0;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const city = typeof body?.city === "string" ? body.city.trim() : "";
    const state = typeof body?.state === "string" ? body.state.trim() : "";
    const searchType = body?.searchType === "county" ? "county" : "city";
    const usingPostgis = process.env.ENABLE_POSTGIS_GEO === "true";

    if (!city || !state) {
      return NextResponse.json(
        { error: "City and state are required" },
        { status: 400 },
      );
    }

    const repository = getZipRepository();
    const results = await repository.searchPlaces({
      query: city,
      state,
      limit: 1,
      searchType,
    });

    if (!results.length) {
      return NextResponse.json({
        searchCriteria: { city, state },
        zips: [],
        count: 0,
        message: `No ZIP codes found near ${properCapitalize(city)}, ${state.toUpperCase()}`,
        map: {
          place: null,
          includedZctas: { type: "FeatureCollection", features: [] },
        },
        coverageStats: {
          placeAreaSqm: 0,
          clipsAreaSqm: 0,
          ratio: 0,
          coveragePercent: 0,
        },
      });
    }

    const place = results[0];
    const zipFeatures = buildZipFeatures(place.zips ?? []);
    const zipCodes = place.zips?.map((zip) => zip.zip).filter(Boolean) ?? [];

    const coverageRatio = place.stats.coverageRatio ?? null;
    const coveragePercent = place.stats.coveragePercent ?? (coverageRatio !== null ? Number((coverageRatio * 100).toFixed(2)) : null);

    const mapPlace = wrapGeometry(place.geometry, {
      name: place.name,
      state: place.state,
      type: place.type ?? null,
    });

    const mapCollection = {
      type: "FeatureCollection" as const,
      features: zipFeatures,
    };

    let countyFeature: GeoJSON.Feature | null = null;
    let countyCities: GeoJSON.FeatureCollection | null = null;

    if (searchType === "county" && usingPostgis) {
      const normalizedCounty = city.replace(/\scounty$/i, "").trim();
      const countyNamePattern = `${normalizedCounty}%`;
      const stateUpper = state.toUpperCase();

      try {
        const pool = getPostgisPool();
        const client = await pool.connect();
        try {
          const countyResult = await client.query<{
            county_id: string | null;
            name: string;
            state: string;
            population: number | null;
            geom_geojson: string | null;
            bbox_geojson: string | null;
          }>(
            `SELECT 
              c.county_id,
              c.name,
              c.state,
              c.population,
              CASE 
                WHEN c.geom_simplified IS NOT NULL THEN ST_AsGeoJSON(c.geom_simplified)
                WHEN c.geom IS NOT NULL THEN ST_AsGeoJSON(c.geom)
                ELSE NULL
              END AS geom_geojson,
              CASE 
                WHEN c.bbox IS NOT NULL THEN ST_AsGeoJSON(c.bbox)
                ELSE NULL
              END AS bbox_geojson
            FROM geo.county c
            WHERE c.state = $2
              AND c.name ILIKE $1
            ORDER BY c.population DESC NULLS LAST, c.name
            LIMIT 1`,
            [countyNamePattern, stateUpper],
          );

          if (countyResult.rowCount) {
            const countyRow = countyResult.rows[0];
            if (countyRow.geom_geojson) {
              countyFeature = {
                type: "Feature",
                geometry: JSON.parse(countyRow.geom_geojson),
                properties: {
                  countyId: countyRow.county_id ?? null,
                  name: countyRow.name,
                  state: countyRow.state,
                  population: countyRow.population ?? null,
                },
              };
            }
          }

          const citiesResult = await client.query<{
            place_id: string;
            name: string;
            state: string;
            population: number | null;
            geom_geojson: string | null;
          }>(
            `SELECT 
              p.place_id,
              p.name,
              p.state,
              p.population,
              CASE 
                WHEN p.geom_simplified IS NOT NULL THEN ST_AsGeoJSON(p.geom_simplified)
                WHEN p.geom IS NOT NULL THEN ST_AsGeoJSON(p.geom)
                ELSE NULL
              END AS geom_geojson
            FROM geo.place p
            WHERE p.state = $1
              AND p.county_name ILIKE $2
            ORDER BY p.population DESC NULLS LAST, p.name
            LIMIT 50`,
            [stateUpper, countyNamePattern],
          );

          const cityFeatures = citiesResult.rows
            .filter((row) => row.geom_geojson)
            .map((row) => ({
              type: "Feature",
              geometry: JSON.parse(row.geom_geojson as string),
              properties: {
                placeId: row.place_id,
                name: row.name,
                state: row.state,
                population: row.population ?? null,
              },
            } as GeoJSON.Feature));

          if (cityFeatures.length) {
            countyCities = {
              type: "FeatureCollection",
              features: cityFeatures,
            };
          }
        } finally {
          client.release();
        }
      } catch (error) {
        console.warn("Failed to enrich county map data", error);
      }
    }

    const mapData: Record<string, unknown> = {
      place: mapPlace,
      includedZctas: mapCollection,
      bbox: place.bbox ?? null,
    };

    if (countyFeature) {
      mapData.county = countyFeature;
    }
    if (countyCities) {
      mapData.countyCities = countyCities;
    }

    const response = {
      searchCriteria: { city, state },
      zips: zipCodes,
      count: zipCodes.length,
      message: `Found ${zipCodes.length} ZIP code${zipCodes.length === 1 ? "" : "s"} for ${properCapitalize(place.name)}, ${place.state}`,
      map: mapData,
      coverageStats: {
        placeAreaSqm: sanitizeNumber(place.stats.totalAreaSqMeters),
        clipsAreaSqm: sanitizeNumber(place.stats.coveredAreaSqMeters),
        ratio: coverageRatio ?? 0,
        coveragePercent: coveragePercent ?? 0,
      },
      debug:
        process.env.NODE_ENV === "development"
          ? {
              repository: process.env.ENABLE_POSTGIS_GEO === "true" ? "postgis" : "legacy",
              place,
            }
          : undefined,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("ZIP search error", error);
    return NextResponse.json(
      { error: "ZIP search failed" },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
