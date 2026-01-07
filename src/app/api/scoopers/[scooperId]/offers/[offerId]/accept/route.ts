import { NextRequest, NextResponse } from "next/server";
import { VisitOfferStatus, ScooperStatus } from "@prisma/client";

import { resolveBusinessId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ scooperId: string; offerId: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { scooperId, offerId } = await params;
  const orgId = await resolveBusinessId(request);

  const profile = await prisma.scooperProfile.findUnique({
    where: { id: scooperId },
    include: { user: true },
  });

  if (!profile || profile.orgId !== orgId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (profile.status !== ScooperStatus.CERTIFIED) {
    return NextResponse.json({ error: "scooper_not_certified" }, { status: 403 });
  }

  const offer = await prisma.visitOffer.findUnique({
    where: { id: offerId },
    include: {
      serviceVisit: true,
    },
  });

  if (!offer || offer.orgId !== orgId) {
    return NextResponse.json({ error: "offer_not_found" }, { status: 404 });
  }

  if (offer.status !== VisitOfferStatus.PENDING) {
    return NextResponse.json({ error: "offer_unavailable" }, { status: 409 });
  }

  if (offer.expiresAt && offer.expiresAt <= new Date() && offer.offeredToId) {
    return NextResponse.json({ error: "offer_expired" }, { status: 409 });
  }

  if (!offer.serviceVisit) {
    return NextResponse.json({ error: "visit_missing" }, { status: 400 });
  }

  const now = new Date();

  try {
    const [updatedOffer] = await prisma.$transaction(async (tx) => {
      const updatedCount = await tx.visitOffer.updateMany({
        where: {
          id: offerId,
          status: VisitOfferStatus.PENDING,
        },
        data: {
          status: VisitOfferStatus.ACCEPTED,
          respondedAt: now,
          acceptedAt: now,
          offeredToId: profile.userId,
        },
      });

      if (updatedCount.count === 0) {
        throw new Error("Offer already claimed");
      }

      await tx.serviceVisit.update({
        where: { id: offer.serviceVisitId },
        data: {
          assignedToId: profile.userId,
          backupAssignedToId: null,
          tileId: offer.tileId ?? undefined,
          routeShiftId: offer.routeShiftId ?? undefined,
        },
      });

      return [
        await tx.visitOffer.findUnique({
          where: { id: offerId },
          include: {
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
                  select: { id: true, frequency: true },
                },
              },
            },
            tile: {
              select: { id: true, name: true, slug: true },
            },
          },
        }),
      ];
    });

    if (!updatedOffer) {
      return NextResponse.json({ error: "offer_unavailable" }, { status: 409 });
    }

    return NextResponse.json({ ok: true, offer: updatedOffer });
  } catch (error) {
    if (error instanceof Error && error.message === "Offer already claimed") {
      return NextResponse.json({ error: "offer_unavailable" }, { status: 409 });
    }
    return NextResponse.json({ error: "offer_unavailable" }, { status: 409 });
  }
}

export const runtime = "nodejs";
