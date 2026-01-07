import { NextRequest, NextResponse } from "next/server";
import {
  PayoutStatus,
  ServiceStatus,
  VisitOfferStatus,
} from "@prisma/client";
import {
  addDays,
} from "date-fns";

import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getScooperComplianceSummary } from "@/lib/marketplace/scooper";
import {
  constructZonedDate,
  convertUtcToZonedParts,
  isValidTimeZone,
  SERVICE_TIME_ZONE,
} from "@/lib/timezone";

function coerceMetadataRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }
  return value as Record<string, unknown>;
}

export async function GET(_request: NextRequest) {
  const session = await safeGetServerSession(authOptions as any);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [user, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        image: true,
        address: true,
        city: true,
        zipCode: true,
      },
    }),
    prisma.scooperProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        orgId: true,
        status: true,
        backgroundCheckStatus: true,
        vehicleVerified: true,
        insuranceProofUrl: true,
        trainingCompletedAt: true,
        metadata: true,
        org: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        availabilities: {
          orderBy: {
            weekday: "asc",
          },
          include: {
            tile: {
              select: {
                id: true,
                name: true,
                slug: true,
                status: true,
              },
            },
          },
        },
      },
    }),
  ]);

  if (!user || !profile) {
    return NextResponse.json({ error: "scooper_profile_missing" }, { status: 404 });
  }

  const timeZoneHeader = _request.headers.get("x-time-zone");
  const timeZone = isValidTimeZone(timeZoneHeader)
    ? timeZoneHeader
    : SERVICE_TIME_ZONE;
  const now = new Date();
  const nowParts = convertUtcToZonedParts(now, timeZone);
  const today = constructZonedDate(
    nowParts.year,
    nowParts.month,
    nowParts.day,
    0,
    0,
    0,
    0,
    timeZone,
  );
  const tomorrow = addDays(today, 1);
  const weekday = new Date(
    Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day),
  ).getUTCDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  const weekAnchor = new Date(
    Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day + diff),
  );
  const weekStart = constructZonedDate(
    weekAnchor.getUTCFullYear(),
    weekAnchor.getUTCMonth() + 1,
    weekAnchor.getUTCDate(),
    0,
    0,
    0,
    0,
    timeZone,
  );
  const monthStart = constructZonedDate(
    nowParts.year,
    nowParts.month,
    1,
    0,
    0,
    0,
    0,
    timeZone,
  );

  const orgId = profile.orgId;
  const compliance = await getScooperComplianceSummary(userId);
  const metadata = coerceMetadataRecord(profile.metadata);

  const availabilityTiles = new Map<string, {
    id: string;
    name: string;
    slug: string;
    status: string;
  }>();

  profile.availabilities.forEach((availability) => {
    if (availability.tile) {
      availabilityTiles.set(availability.tile.id, {
        id: availability.tile.id,
        name: availability.tile.name,
        slug: availability.tile.slug,
        status: availability.tile.status,
      });
    }
  });

  const tileIds = Array.from(availabilityTiles.keys());
  const currentTime = new Date();

  const [
    todaysAssigned,
    completedToday,
    upcomingAssigned,
    pendingOffers,
    weekToDate,
    monthToDate,
    pendingPayouts,
    lifetimeEarnings,
    nextVisit,
  ] = await Promise.all([
    prisma.serviceVisit.count({
      where: {
        assignedToId: userId,
        scheduledDate: {
          gte: today,
          lt: tomorrow,
        },
        status: {
          in: [
            ServiceStatus.SCHEDULED,
            ServiceStatus.IN_PROGRESS,
            ServiceStatus.COMPLETED,
          ],
        },
      },
    }),
    prisma.serviceVisit.count({
      where: {
        assignedToId: userId,
        status: ServiceStatus.COMPLETED,
        completedDate: {
          gte: today,
          lt: tomorrow,
        },
      },
    }),
    prisma.serviceVisit.count({
      where: {
        assignedToId: userId,
        scheduledDate: {
          gte: tomorrow,
        },
        status: {
          in: [ServiceStatus.SCHEDULED, ServiceStatus.IN_PROGRESS],
        },
      },
    }),
    prisma.visitOffer.count({
      where: {
        orgId,
        status: VisitOfferStatus.PENDING,
        AND: [
          {
            OR: [
              { offeredToId: userId },
              {
                offeredToId: null,
                tileId: tileIds.length ? { in: tileIds } : undefined,
              },
            ],
          },
          {
            OR: [{ expiresAt: null }, { expiresAt: { gt: currentTime } }],
          },
        ],
      },
    }),
    prisma.visitPayout.aggregate({
      _sum: { totalAmountCents: true },
      where: {
        scooperId: userId,
        status: {
          in: [
            PayoutStatus.RELEASED,
            PayoutStatus.READY,
            PayoutStatus.PENDING_REVIEW,
          ],
        },
        generatedAt: { gte: weekStart },
      },
    }),
    prisma.visitPayout.aggregate({
      _sum: { totalAmountCents: true },
      where: {
        scooperId: userId,
        status: {
          in: [
            PayoutStatus.RELEASED,
            PayoutStatus.READY,
            PayoutStatus.PENDING_REVIEW,
          ],
        },
        generatedAt: { gte: monthStart },
      },
    }),
    prisma.visitPayout.count({
      where: {
        scooperId: userId,
        status: {
          in: [PayoutStatus.PENDING_REVIEW, PayoutStatus.READY],
        },
      },
    }),
    prisma.visitPayout.aggregate({
      _sum: { totalAmountCents: true },
      where: {
        scooperId: userId,
        status: {
          in: [
            PayoutStatus.RELEASED,
            PayoutStatus.READY,
            PayoutStatus.PENDING_REVIEW,
          ],
        },
      },
    }),
    prisma.serviceVisit.findFirst({
      where: {
        assignedToId: userId,
        status: {
          in: [ServiceStatus.SCHEDULED, ServiceStatus.IN_PROGRESS],
        },
        scheduledDate: { gte: now },
      },
      orderBy: { scheduledDate: "asc" },
      select: {
        id: true,
        scheduledDate: true,
        status: true,
        revenueCents: true,
        tile: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            addressLine1: true,
            city: true,
            zip: true,
          },
        },
      },
    }),
  ]);

  const rating = metadata.avgRating;
  const totalStops = metadata.lifetimeStops ?? metadata.totalStops;
  const homeAnchor = metadata.homeAnchor ?? null;
  const routeCredits = typeof metadata.routeCredits === "number" ? metadata.routeCredits : 0;
  const homeAddressInput = metadata.homeAddressInput ?? null;
  const homeAnchorValidation = {
    validatedAt:
      typeof metadata.homeAnchorValidatedAt === "string"
        ? metadata.homeAnchorValidatedAt
        : null,
    verdict: metadata.homeAnchorVerdict ?? null,
    suggestions: Array.isArray(metadata.homeAnchorSuggestions)
      ? (metadata.homeAnchorSuggestions as unknown[])
      : [],
  };

  return NextResponse.json({
    user,
    profile: {
      id: profile.id,
      status: profile.status,
      backgroundCheckStatus: profile.backgroundCheckStatus,
      vehicleVerified: profile.vehicleVerified,
      insuranceOnFile: Boolean(profile.insuranceProofUrl),
      trainingCompletedAt: profile.trainingCompletedAt,
      org: profile.org,
      rating: typeof rating === "number" ? rating : null,
      totalStops: typeof totalStops === "number" ? totalStops : null,
    },
    compliance,
    availability: profile.availabilities.map((availability) => ({
      id: availability.id,
      weekday: availability.weekday,
      window: availability.window,
      tile: availability.tile
        ? {
            id: availability.tile.id,
            name: availability.tile.name,
            slug: availability.tile.slug,
            status: availability.tile.status,
          }
        : null,
    })),
    tiles: Array.from(availabilityTiles.values()),
    metrics: {
      today: {
        totalStops: todaysAssigned,
        completedStops: completedToday,
      },
      upcomingStops: upcomingAssigned,
      pendingOffers,
    },
    earnings: {
      weekToDateCents: weekToDate._sum.totalAmountCents ?? 0,
      monthToDateCents: monthToDate._sum.totalAmountCents ?? 0,
      pendingPayouts,
      lifetimeCents: lifetimeEarnings._sum.totalAmountCents ?? 0,
    },
    nextVisit,
    routing: {
      homeAnchor,
      routeCredits,
      homeAddressInput,
      homeAnchorValidation,
    },
    generatedAt: new Date().toISOString(),
  });
}

export const runtime = "nodejs";
