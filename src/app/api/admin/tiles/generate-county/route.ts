import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";

import { authOptions, safeGetServerSession } from "@/lib/auth";
import { resolveBusinessId } from "@/lib/tenant";
import { generateTilesForPlace } from "@/lib/tiles/generator";
import { listTilesByStatus } from "@/lib/tiles/admin";
import { getPostgisPool } from "@/lib/geo/postgis";
import { addTileGenerationJob } from "@/lib/jobs/tileGenerationQueue";

function ensureAdmin(session: any) {
  const role = session?.userRole ?? session?.user?.role ?? null;
  if (role !== "ADMIN" && role !== "OWNER") {
    throw new Error("unauthorized");
  }
}

const generateCountySchema = z.object({
  countyName: z.string().min(1, "County name is required"),
  state: z.string().length(2, "State must be 2-letter code"),
  useAI: z.boolean().default(true),
});

interface CityTileConfig {
  placeId: string;
  cityName: string;
  suggestedTileCount: number;
  suggestedName: string;
  minScoopers: number;
  minWeeklyStops: number;
  coverageRadius: number;
  population: number;
}

async function generateAITileConfig(
  cityName: string,
  population: number,
  state: string,
): Promise<Omit<CityTileConfig, "placeId" | "cityName" | "population">> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const prompt = `You are a service territory planning expert for a pet waste removal company.

Given a city with these details:
- City: ${cityName}, ${state}
- Population: ${population.toLocaleString()}

Provide recommendations for service tile configuration:

1. **Tile Count**: How many service tiles (zones) should this city be divided into? Consider:
   - Population density
   - Geographic size
   - One scooper can handle ~15-25 weekly stops
   - Each tile should have 30-60 potential weekly stops

2. **Tile Name**: Suggest a descriptive name suffix (e.g., "Downtown", "North Lakes", "West River")
   - Use local landmarks, neighborhoods, or geographic features
   - Keep it under 25 characters
   - If city is small (pop < 10k), just use the city name

3. **Min Scoopers**: Minimum certified scoopers needed before going live (1-4)

4. **Min Weekly Stops**: Minimum weekly customer stops needed (15-60)

5. **Coverage Radius**: Service radius in meters (2000-5000)

Respond in JSON format:
{
  "tileCount": number,
  "nameSuffix": string,
  "minScoopers": number,
  "minWeeklyStops": number,
  "coverageRadius": number,
  "reasoning": string
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5-nano",
      messages: [
        {
          role: "system",
          content: "You are an expert at service territory planning and operations optimization.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const response = JSON.parse(completion.choices[0].message.content || "{}");
    
    return {
      suggestedTileCount: Math.max(1, Math.min(12, response.tileCount || 4)),
      suggestedName: response.nameSuffix || "Core",
      minScoopers: Math.max(1, Math.min(4, response.minScoopers || 2)),
      minWeeklyStops: Math.max(15, Math.min(60, response.minWeeklyStops || 30)),
      coverageRadius: Math.max(2000, Math.min(5000, response.coverageRadius || 3200)),
    };
  } catch (error) {
    console.error("AI tile config generation failed, using defaults:", error);
    // Fallback to basic logic
    const density = population / 1000; // rough estimate
    return {
      suggestedTileCount: Math.max(1, Math.ceil(population / 25000)),
      suggestedName: population > 50000 ? "Core" : "District",
      minScoopers: population > 50000 ? 3 : population > 20000 ? 2 : 1,
      minWeeklyStops: population > 50000 ? 45 : population > 20000 ? 30 : 20,
      coverageRadius: population > 50000 ? 3200 : population > 20000 ? 3500 : 4000,
    };
  }
}

export async function POST(request: NextRequest) {
  const session = await safeGetServerSession(request, authOptions as any);

  try {
    ensureAdmin(session);
  } catch (error) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 403 });
  }

  const orgId = await resolveBusinessId(request);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  const parsed = generateCountySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "validation_error", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { countyName, state, useAI } = parsed.data;

  try {
    const pool = getPostgisPool();

    // Find all cities/towns in the county
    const citiesResult = await pool.query<{
      place_id: string;
      name: string;
      population: number | null;
    }>(
      `SELECT place_id, name, population
       FROM geo.place
       WHERE LOWER(county_name) = LOWER($1)
         AND state = $2
         AND population > 0
       ORDER BY population DESC NULLS LAST`,
      [countyName, state],
    );

    if (citiesResult.rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "no_cities_found", message: `No cities found in ${countyName} County, ${state}` },
        { status: 404 },
      );
    }

    // Generate AI configs for each city
    const cityConfigs: CityTileConfig[] = [];
    for (const city of citiesResult.rows) {
      const population = city.population || 5000;
      
      let config;
      if (useAI && process.env.OPENAI_API_KEY) {
        config = await generateAITileConfig(city.name, population, state);
      } else {
        // Fallback logic
        config = {
          suggestedTileCount: Math.max(1, Math.ceil(population / 25000)),
          suggestedName: population > 50000 ? "Core" : "District",
          minScoopers: population > 50000 ? 3 : population > 20000 ? 2 : 1,
          minWeeklyStops: population > 50000 ? 45 : population > 20000 ? 30 : 20,
          coverageRadius: population > 50000 ? 3200 : 3500,
        };
      }

      cityConfigs.push({
        placeId: city.place_id,
        cityName: city.name,
        population,
        ...config,
      });
    }

    // Generate tiles for each city (as background jobs when available)
    const results: Array<{
      cityName: string;
      tilesGenerated: number;
      config: CityTileConfig;
    }> = [];
    const queuedJobs: Array<{
      cityName: string;
      jobId: string;
      placeId: string;
      tileCount: number;
    }> = [];
    const errors: Array<{ cityName: string; error: string }> = [];

    for (const config of cityConfigs) {
      try {
        const commonPayload = {
          placeId: config.placeId,
          tileCount: config.suggestedTileCount,
          orgId,
          status: "WAITLIST", // New tiles start as Waitlist
          createdBy: session?.user?.email ?? "county-generator",
          generationMode: "cluster" as const,
          city: config.cityName,
          state,
        };

        const queuedJobId = await addTileGenerationJob({
          jobId: `county-${config.placeId}-${Date.now()}`,
          ...commonPayload,
        });

        if (queuedJobId) {
          queuedJobs.push({
            cityName: config.cityName,
            jobId: queuedJobId,
            placeId: config.placeId,
            tileCount: config.suggestedTileCount,
          });
          continue;
        }

        const generation = await generateTilesForPlace(commonPayload);

        results.push({
          cityName: config.cityName,
          tilesGenerated: generation?.tiles?.length ?? 0,
          config,
        });
      } catch (error) {
        console.error(`County tile generation failed for ${config.cityName}`, error);
        errors.push({
          cityName: config.cityName,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const drafts = queuedJobs.length === 0 ? await listTilesByStatus(orgId, "DRAFT") : undefined;

    const queuedMessage =
      queuedJobs.length > 0
        ? "Tile generation jobs queued. Poll /api/admin/tiles/generate/status?jobId=... for progress."
        : undefined;

    return NextResponse.json({
      ok: true,
      data: {
        county: `${countyName}, ${state}`,
        citiesProcessed: cityConfigs.length,
        tilesGenerated: results.reduce((sum, r) => sum + r.tilesGenerated, 0),
        results,
        errors,
        queuedJobs,
        drafts,
        message: queuedMessage,
      },
    });
  } catch (error) {
    console.error("County tile generation error:", error);
    const message = error instanceof Error ? error.message : "County generation failed";
    return NextResponse.json(
      { ok: false, error: "generation_failed", message },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
