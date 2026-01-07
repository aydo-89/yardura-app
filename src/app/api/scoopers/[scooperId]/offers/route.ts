import { NextRequest, NextResponse } from "next/server";
import { VisitOfferStatus, ScooperStatus } from "@prisma/client";

import { resolveBusinessId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ scooperId: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { scooperId } = await params;
  const orgId = await resolveBusinessId(request);

  const profile = await prisma.scooperProfile.findUnique({
    where: { id: scooperId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      availabilities: true,
      certifications: true,
    },
  });

  if (!profile || profile.orgId !== orgId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (profile.status !== ScooperStatus.CERTIFIED) {
    return NextResponse.json({ orgId, offers: [] });
  }

  const availableTileIds = profile.availabilities
    .map((a) => a.tileId)
    .filter((id): id is string => typeof id === "string");
  const now = new Date();

  const offers = await prisma.visitOffer.findMany({
    where: {
      orgId,
      status: VisitOfferStatus.PENDING,
      AND: [
        {
          OR: [
            { offeredToId: profile.userId },
            {
              offeredToId: null,
              tileId: { in: availableTileIds.length ? availableTileIds : undefined },
            },
          ],
        },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      ],
    },
    include: {
      tile: { select: { id: true, slug: true, name: true, status: true } },
      serviceVisit: {
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              addressLine1: true,
              city: true,
              zip: true,
            },
          },
          job: {
            select: {
              id: true,
              frequency: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    orgId,
    scooper: {
      id: profile.id,
      user: profile.user,
      tiles: availableTileIds,
    },
    offers,
  });
}

export const runtime = "nodejs";
