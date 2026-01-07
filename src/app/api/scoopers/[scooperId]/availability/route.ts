import { NextRequest, NextResponse } from "next/server";
import { AvailabilityWindow } from "@prisma/client";
import { z } from "zod";

import { resolveBusinessId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { replaceScooperAvailability } from "@/lib/marketplace";
import { getTileRepository } from "@/lib/tiles/repository";

const availabilitySchema = z.object({
  blocks: z
    .array(
      z.object({
        tileSlug: z.string().min(2),
        weekday: z.coerce.number().int().min(0).max(6),
        window: z.nativeEnum(AvailabilityWindow).optional(),
        maxStops: z.coerce.number().int().min(1).max(60).optional(),
      }),
    )
    .min(1),
});

type RouteContext = { params: Promise<{ scooperId: string }> };

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { scooperId } = await params;
  const orgId = await resolveBusinessId(request);
  const payload = await request.json();
  const parsed = availabilitySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const profile = await prisma.scooperProfile.findUnique({
    where: { id: scooperId },
    select: { id: true, orgId: true },
  });

  if (!profile || profile.orgId !== orgId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const uniqueSlugs = Array.from(new Set(parsed.data.blocks.map((b) => b.tileSlug)));
  const repository = getTileRepository();

  const existingTiles = uniqueSlugs.length
    ? await prisma.serviceTile.findMany({
        where: { orgId, slug: { in: uniqueSlugs } },
        select: { id: true, slug: true },
      })
    : [];

  const ensuredTiles = [...existingTiles];
  const missing: string[] = [];

  for (const slug of uniqueSlugs) {
    if (ensuredTiles.some((tile) => tile.slug === slug)) continue;

    try {
      const repoTile = await repository.getTileBySlug(orgId, slug, {
        metricsLimit: 1,
      });
      if (!repoTile) {
        missing.push(slug);
        continue;
      }

      const created = await prisma.serviceTile.upsert({
        where: { orgId_slug: { orgId, slug } },
        update: {
          name: repoTile.tile.name,
          status: repoTile.tile.status,
          minCertifiedScoopers: repoTile.tile.minCertifiedScoopers,
          minCustomerUnits: repoTile.tile.minCustomerUnits,
          coverageRadiusMeters: repoTile.tile.coverageRadiusMeters,
          goLiveDate: repoTile.tile.goLiveDate,
          notes: repoTile.tile.notes ?? null,
          territoryId: repoTile.tile.territoryId,
        },
        create: {
          orgId,
          slug,
          name: repoTile.tile.name,
          status: repoTile.tile.status,
          minCertifiedScoopers: repoTile.tile.minCertifiedScoopers,
          minCustomerUnits: repoTile.tile.minCustomerUnits,
          coverageRadiusMeters: repoTile.tile.coverageRadiusMeters,
          goLiveDate: repoTile.tile.goLiveDate,
          notes: repoTile.tile.notes ?? null,
          territoryId: repoTile.tile.territoryId,
        },
        select: { id: true, slug: true },
      });

      ensuredTiles.push(created);
    } catch (error) {
      console.error("tile lookup failed", slug, error);
      missing.push(slug);
    }
  }

  if (missing.length) {
    return NextResponse.json(
      {
        error: "unknown_tiles",
        details: `Tiles not found for org ${orgId}: ${missing.join(", ")}`,
      },
      { status: 404 },
    );
  }

  const availability = parsed.data.blocks.map((entry) => {
    const tile = ensuredTiles.find((t) => t.slug === entry.tileSlug)!;
    return {
      tileId: tile.id,
      weekday: entry.weekday,
      window: entry.window,
      maxStops: entry.maxStops,
    };
  });

  const updated = await replaceScooperAvailability(scooperId, availability);

  return NextResponse.json({ ok: true, availability: updated });
}

export const runtime = "nodejs";
