import { NextRequest, NextResponse } from "next/server";
import { ScooperStatus } from "@prisma/client";

import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadScooperOfferFeed } from "@/lib/marketplace/offers";

export async function GET(request: NextRequest) {
  const session = await safeGetServerSession(authOptions as any);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.min(100, Math.max(1, Number(limitParam))) : 40;

  const profile = await prisma.scooperProfile.findUnique({
    where: { userId },
    include: {
      org: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      availabilities: {
        include: {
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
      certifications: {
        select: {
          type: true,
          status: true,
        },
      },
    },
  });

  if (!profile) {
    return NextResponse.json({ error: "scooper_profile_missing" }, { status: 404 });
  }

  if (!profile.org) {
    return NextResponse.json({ error: "scooper_org_missing" }, { status: 400 });
  }

  const tileIds = profile.availabilities
    .map((availability) => availability.tileId)
    .filter((id): id is string => Boolean(id));

  const homeAnchor = (() => {
    const metadata =
      profile.metadata && typeof profile.metadata === "object" && !Array.isArray(profile.metadata)
        ? (profile.metadata as Record<string, unknown>)
        : null;
    const anchor =
      metadata && typeof metadata.homeAnchor === "object" && metadata.homeAnchor !== null
        ? (metadata.homeAnchor as Record<string, unknown>)
        : null;
    const lat = anchor && typeof anchor.lat === "number" ? anchor.lat : null;
    const lng = anchor && typeof anchor.lng === "number" ? anchor.lng : null;
    if (typeof lat === "number" && typeof lng === "number") {
      return { lat, lng };
    }
    return null;
  })();

  if (profile.status !== ScooperStatus.CERTIFIED) {
    return NextResponse.json({
      org: profile.org,
      profileStatus: profile.status,
      offers: [],
      summary: {
        total: 0,
        direct: 0,
        broadcast: 0,
      },
    });
  }

  try {
    const offers = await loadScooperOfferFeed({
      orgId: profile.org.id,
      userId,
      tileIds,
      limit,
      homeAnchor,
      certifications: profile.certifications,
    });

    const directCount = offers.filter((offer) => offer.isDirectOffer).length;

    return NextResponse.json({
      org: profile.org,
      profileStatus: profile.status,
      offers,
      summary: {
        total: offers.length,
        direct: directCount,
        broadcast: offers.length - directCount,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[field-tech/offers] Error loading offers:", error);
    return NextResponse.json(
      { error: "internal_error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
