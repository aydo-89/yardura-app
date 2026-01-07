import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { resolveBusinessId } from "@/lib/tenant";
import {
  listServiceAreas,
  getServiceArea,
  addZipsToTile,
  removeZipsFromTile,
} from "@/lib/tiles/service-areas";

const manageSchema = z.object({
  tileSlug: z.string().min(1),
  addZips: z.array(z.string()).optional(),
  removeZips: z.array(z.string()).optional(),
});

export async function GET(request: NextRequest) {
  const orgId = await resolveBusinessId(request);
  const url = new URL(request.url);
  const tileSlug = url.searchParams.get("tileSlug") ?? undefined;

  try {
    const serviceAreas = await listServiceAreas(orgId, tileSlug ? { slug: tileSlug } : {});
    const statusCounts = serviceAreas.reduce<Record<string, number>>((acc, area) => {
      const key = area.tile.status;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const conflictSummary = serviceAreas.reduce(
      (acc, area) => {
        if (area.hasConflicts) {
          acc.tilesWithConflicts += 1;
          acc.conflictZipTotal += area.conflictZipCount;
          acc.conflictZips.push(...area.conflictZips);
        }
        return acc;
      },
      {
        tilesWithConflicts: 0,
        conflictZipTotal: 0,
        conflictZips: [] as string[],
      },
    );

    return NextResponse.json({
      orgId,
      serviceAreas,
      totalZips: serviceAreas.reduce((sum, area) => sum + area.zipCount, 0),
      statusCounts,
      conflictSummary: {
        ...conflictSummary,
        conflictZips: Array.from(new Set(conflictSummary.conflictZips)),
      },
    });
  } catch (error) {
    console.error("service-areas GET error", error);
    return NextResponse.json(
      { error: "Unable to load service areas" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const orgId = await resolveBusinessId(request);

  try {
    const body = await request.json();
    const result = manageSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: result.error.issues },
        { status: 400 },
      );
    }

    const { tileSlug, addZips, removeZips } = result.data;

    if (!(addZips?.length || removeZips?.length)) {
      return NextResponse.json(
        { error: "Nothing to update. Provide addZips and/or removeZips." },
        { status: 400 },
      );
    }

    let summary = null;

    let reassignedZips: { zip: string; previousTileSlug: string }[] = [];

    if (addZips?.length) {
      const result = await addZipsToTile(orgId, tileSlug, addZips);
      summary = result.summary;
      reassignedZips = result.reassignedZips;
    }

    if (removeZips?.length) {
      summary = await removeZipsFromTile(orgId, tileSlug, removeZips);
    }

    summary = summary ?? (await getServiceArea(orgId, tileSlug));

    if (!summary) {
      return NextResponse.json(
        { error: "Tile not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      orgId,
      serviceArea: summary,
      reassignedZips,
    });
  } catch (error) {
    console.error("service-areas POST error", error);
    return NextResponse.json(
      { error: "Failed to update service area" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const orgId = await resolveBusinessId(request);
  const url = new URL(request.url);
  const tileSlug = url.searchParams.get("tileSlug");
  const zip = url.searchParams.get("zip");

  if (!tileSlug) {
    return NextResponse.json(
      { error: "tileSlug is required" },
      { status: 400 },
    );
  }

  if (!zip) {
    return NextResponse.json(
      { error: "zip is required" },
      { status: 400 },
    );
  }

  try {
    const summary = await removeZipsFromTile(orgId, tileSlug, [zip]);
    if (!summary) {
      return NextResponse.json(
        { error: "Tile not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      orgId,
      serviceArea: summary,
    });
  } catch (error) {
    console.error("service-areas DELETE error", error);
    return NextResponse.json(
      { error: "Failed to remove ZIP" },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
