import { NextRequest, NextResponse } from "next/server";
import { AvailabilityWindow } from "@prisma/client";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { safeGetServerSession } from "@/lib/auth";
import { resolveBusinessId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import {
  listScooperAvailability,
  updateScooperAvailability,
} from "@/lib/marketplace";
import { listServiceAreas } from "@/lib/tiles/service-areas";
import { getTileRepository } from "@/lib/tiles/repository";
import { info, warn } from "@/lib/log";

const patchSchema = z.object({
  scooperId: z.string().min(1),
  add: z
    .array(
      z.object({
        tileSlug: z.string().min(2),
        weekday: z.number().int().min(0).max(6),
        window: z.nativeEnum(AvailabilityWindow).optional(),
        maxStops: z.number().int().min(1).max(60).nullable().optional(),
      }),
    )
    .optional(),
  remove: z.array(z.string().min(1)).optional(),
});

function ensureAdmin(session: any) {
  const role = session?.userRole ?? session?.user?.role ?? null;
  if (!session?.user || !["OWNER", "ADMIN"].includes(role)) {
    throw new Error("unauthorized");
  }
}

export async function GET(request: NextRequest) {
  const session = await safeGetServerSession(authOptions as any);
  ensureAdmin(session);
  const orgId = await resolveBusinessId(request);

  const [serviceAreas, scoopers] = await Promise.all([
    listServiceAreas(orgId),
    listScooperAvailability(orgId),
  ]);

  const tiles = serviceAreas.map((area) => ({
    id: area.tile.id,
    slug: area.tile.slug,
    name: area.tile.name,
    status: area.tile.status,
    zipCount: area.zipCount,
    coveragePercent: area.coveragePercent,
    coverageRatio: area.coverageRatio,
    tileGeometry: area.tileGeometry,
  }));

  info("marketplace.availability", {
    orgId,
    tiles: tiles.length,
    scoopers: scoopers.length,
  });

  return NextResponse.json({
    ok: true,
    data: {
      tiles,
      scoopers,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const session = await safeGetServerSession(authOptions as any);
  try {
    ensureAdmin(session);
  } catch (error) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 403 });
  }

  const orgId = await resolveBusinessId(request);
  const payload = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "validation_error", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { scooperId, add = [], remove = [] } = parsed.data;

  const profile = await prisma.scooperProfile.findFirst({
    where: { id: scooperId, orgId },
    select: { id: true },
  });

  if (!profile) {
    return NextResponse.json({ ok: false, error: "scooper_not_found" }, { status: 404 });
  }

  const tileSlugs = Array.from(new Set(add.map((entry) => entry.tileSlug)));
  const tiles = tileSlugs.length
    ? await prisma.serviceTile.findMany({
        where: { orgId, slug: { in: tileSlugs } },
        select: { id: true, slug: true },
      })
    : [];

  const ensuredTiles = [...tiles];
  const tileRepository = getTileRepository();
  const unresolved: string[] = [];

  for (const slug of tileSlugs) {
    if (ensuredTiles.some((tile) => tile.slug === slug)) continue;

    const repoTile = await tileRepository.getTileBySlug(orgId, slug, {
      metricsLimit: 1,
    });
    if (!repoTile) {
      unresolved.push(slug);
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
  }

  if (unresolved.length) {
    warn("marketplace.availabilityPatch", {
      orgId,
      scooperId,
      error: "unknown_tiles",
      missing: unresolved,
    });
    return NextResponse.json(
      {
        ok: false,
        error: "unknown_tiles",
        details: unresolved,
      },
      { status: 404 },
    );
  }

  const addBlocks = add.map((entry) => {
    const tile = ensuredTiles.find((t) => t.slug === entry.tileSlug);
    return {
      tileId: tile!.id,
      weekday: entry.weekday,
      window: entry.window,
      maxStops: entry.maxStops ?? null,
    };
  });

  try {
    const updated = await updateScooperAvailability(orgId, scooperId, {
      removeIds: remove,
      add: addBlocks,
    });

    info("marketplace.availabilityPatch", {
      orgId,
      scooperId,
      added: addBlocks.length,
      removed: remove.length,
    });

    return NextResponse.json({
      ok: true,
      data: updated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (message === "scooper_not_found") {
      return NextResponse.json({ ok: false, error: message }, { status: 404 });
    }
    warn("marketplace.availabilityPatch", {
      orgId,
      scooperId,
      error: message,
    });
    return NextResponse.json({ ok: false, error: "update_failed" }, { status: 500 });
  }
}

export const runtime = "nodejs";
