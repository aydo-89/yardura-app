import { NextRequest, NextResponse } from "next/server";
import { AvailabilityWindow } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { replaceScooperAvailability } from "@/lib/marketplace";
import { getTileRepository } from "@/lib/tiles/repository";
import { verifyMobileToken } from "@/lib/mobile-auth";

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

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

export async function GET(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  let payload: ReturnType<typeof verifyMobileToken>;
  try {
    payload = verifyMobileToken(token);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid token" },
      { status: 401 },
    );
  }

  const userId = payload.sub;
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "Scooper access required" },
      { status: 403 },
    );
  }

  const profile = await prisma.scooperProfile.findFirst({
    where: { userId },
    select: {
      id: true,
      orgId: true,
      availabilities: {
        select: {
          id: true,
          weekday: true,
          window: true,
          maxStops: true,
          tile: {
            select: {
              id: true,
              slug: true,
              name: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "Scooper access required" },
      { status: 403 },
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      orgId: profile.orgId,
      availability: profile.availabilities.map((entry) => ({
        id: entry.id,
        weekday: entry.weekday,
        window: entry.window,
        maxStops: entry.maxStops,
        tile: entry.tile,
      })),
    },
  });
}

export async function PUT(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  let payload: ReturnType<typeof verifyMobileToken>;
  try {
    payload = verifyMobileToken(token);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid token" },
      { status: 401 },
    );
  }

  const userId = payload.sub;
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "Scooper access required" },
      { status: 403 },
    );
  }

  const parsed = availabilitySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "validation_error", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const profile = await prisma.scooperProfile.findFirst({
    where: { userId },
    select: { id: true, orgId: true },
  });

  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "Scooper access required" },
      { status: 403 },
    );
  }

  const orgId = profile.orgId;
  const uniqueSlugs = Array.from(
    new Set(parsed.data.blocks.map((block) => block.tileSlug)),
  );
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
        ok: false,
        error: "unknown_tiles",
        details: `Tiles not found for org ${orgId}: ${missing.join(", ")}`,
      },
      { status: 404 },
    );
  }

  const availability = parsed.data.blocks.map((entry) => {
    const tile = ensuredTiles.find((item) => item.slug === entry.tileSlug)!;
    return {
      tileId: tile.id,
      weekday: entry.weekday,
      window: entry.window,
      maxStops: entry.maxStops,
    };
  });

  const updated = await replaceScooperAvailability(profile.id, availability);

  return NextResponse.json({ ok: true, availability: updated });
}

export const runtime = "nodejs";
