import { NextRequest, NextResponse } from "next/server";

import { resolveBusinessId } from "@/lib/tenant";
import { getTileRepository } from "@/lib/tiles/repository";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const orgId = await resolveBusinessId(request);
  const { slug } = await params;

  const repository = getTileRepository();
  const tileContext = await repository.getTileBySlug(orgId, slug, {
    metricsLimit: 1,
  });

  if (!tileContext) {
    return NextResponse.json({ error: "tile_not_found" }, { status: 404 });
  }

  const snapshots = await repository.listTileMetrics(tileContext.tile.id, 12);
  const response = {
    tile: {
      id: tileContext.tile.id,
      name: tileContext.tile.name,
    },
    snapshots: snapshots.map((snapshot) => ({
      id: snapshot.id,
      tileId: snapshot.tileId,
      weekOf: snapshot.weekOf,
      activeScoopers: snapshot.activeScoopers,
      scheduledStops: snapshot.scheduledStops,
      completedStops: snapshot.completedStops,
    })),
  };

  return NextResponse.json(response);
}

export const runtime = "nodejs";
