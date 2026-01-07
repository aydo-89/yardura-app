import { NextRequest, NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getTileRepository } from "@/lib/tiles/repository";
import type { ServiceTileStatus } from "@prisma/client";

const allowedRoles = [
  "ADMIN",
  "OWNER",
  "SALES_MANAGER",
  "FRANCHISE_OWNER",
  "SALES_REP",
];

function forbidden(message = "Unauthorized") {
  return NextResponse.json({ ok: false, error: message }, { status: 403 });
}

interface ParsedLocation {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
}

function parseLocation(value: unknown): ParsedLocation | null {
  if (!value || typeof value !== "object") return null;

  const loc = value as Record<string, unknown>;

  if (typeof loc.latitude === "number" && typeof loc.longitude === "number") {
    return {
      latitude: loc.latitude,
      longitude: loc.longitude,
      accuracy: typeof loc.accuracy === "number" ? loc.accuracy : null,
    };
  }

  if (
    loc.type === "Point" &&
    Array.isArray(loc.coordinates) &&
    loc.coordinates.length >= 2
  ) {
    const [lng, lat] = loc.coordinates as number[];
    if (typeof lat === "number" && typeof lng === "number") {
      return {
        latitude: lat,
        longitude: lng,
        accuracy:
          typeof loc.accuracy === "number" ? (loc.accuracy as number) : null,
      };
    }
  }

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await resolveApiAuth(req);
    if (!auth?.userId) {
      return forbidden();
    }

    const hasAccess =
      (auth.role && allowedRoles.includes(auth.role)) ||
      auth.roles.some((role) => allowedRoles.includes(role));
    if (!hasAccess) {
      return forbidden();
    }

    const orgId = auth.orgId;
    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: "Organization not set" },
        { status: 400 },
      );
    }

    const usePostgisTiles = process.env.ENABLE_POSTGIS_TILES === "true";
    const tileRepository = usePostgisTiles ? getTileRepository() : null;
    const tileCache = new Map<string, { slug: string; status: ServiceTileStatus } | null>();

    const activities = await prisma.leadActivity.findMany({
      where: {
        orgId,
        // Accept any non-null JSON for location; Prisma JSON filter uses JsonNullValueFilter
        location: { not: Prisma.JsonNull },
        userId: { not: null },
      },
      orderBy: { occurredAt: "desc" },
      take: 200,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    const seen = new Set<string>();
    const team: Array<{
      userId: string;
      name?: string | null;
      email?: string | null;
      latitude: number;
      longitude: number;
      accuracy?: number | null;
      occurredAt: Date;
      serviceArea?: { slug: string; status: ServiceTileStatus } | null;
    }> = [];

    for (const activity of activities) {
      if (!activity.userId || seen.has(activity.userId)) continue;
      const parsed = parseLocation(activity.location);
      if (!parsed) continue;

      let serviceArea: { slug: string; status: ServiceTileStatus } | null = null;

      const metadataRaw = (activity as any).metadata;
      if (tileRepository && metadataRaw && typeof metadataRaw === "object") {
        const metadata = metadataRaw as Record<string, unknown>;
        const zip = typeof metadata.zip === "string" ? metadata.zip : undefined;
        if (zip) {
          if (tileCache.has(zip)) {
            serviceArea = tileCache.get(zip)!;
          } else {
            try {
              const tile = await tileRepository.findTileByZip(orgId, zip, {
                metricsLimit: 1,
              });
              const value = tile
                ? { slug: tile.tile.slug, status: tile.tile.status }
                : null;
              tileCache.set(zip, value);
              serviceArea = value;
            } catch (error) {
              console.error("team tile lookup failed", error);
              tileCache.set(zip, null);
            }
          }
        }
      }

      seen.add(activity.userId);
      team.push({
        userId: activity.userId,
        name: activity.user?.name,
        email: activity.user?.email,
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        accuracy: parsed.accuracy,
        occurredAt: activity.occurredAt,
        serviceArea,
      });
    }

    return NextResponse.json({ ok: true, data: team });
  } catch (error) {
    console.error("GET /api/leads/outbound/team error", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
