import { addDays, addMinutes } from "date-fns";
import {
  CertificationStatus,
  Frequency,
  Prisma,
  ServiceStatus,
  ServiceType,
  VisitOfferStatus,
  VisitCompSchedule,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { info } from "@/lib/log";
import {
  DEFAULT_MILEAGE_RATE_CENTS,
  DEFAULT_PPE_STIPEND_CENTS,
  estimateVisitPayoutPreview,
} from "./payouts";
import { sendScooperOfferPush } from "@/lib/notifications/push";
import { getBusinessConfig } from "@/lib/business-config";
import { applyMarketplaceDelayMetadata, resolveDelayedSchedule } from "@/lib/marketplace/visit-delay";
import { sendVisitDelayEmail } from "@/lib/emails/visit-delay";
import { sendCustomerDelayPush } from "@/lib/notifications/push";
import {
  extractPreferredTimeWindow,
  normalizePreferredTimeWindowSlug,
  resolvePreferredTimeWindowLabel,
  resolvePreferredTimeWindowShortLabel,
  resolvePreferredTimeWindowRange,
} from "@/lib/time-window";

const DEFAULT_OFFER_REFRESH_MINUTES = 30;

async function resolveOfferRefreshMinutes(orgId: string): Promise<number> {
  const config = await getBusinessConfig(orgId);
  const minutes = config?.operations?.offerRefreshMinutes;
  if (typeof minutes === "number" && Number.isFinite(minutes) && minutes > 0) {
    return minutes;
  }
  return DEFAULT_OFFER_REFRESH_MINUTES;
}

function haversineMiles(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const radius = 3958.8;
  const dLat = toRadians(end.lat - start.lat);
  const dLng = toRadians(end.lng - start.lng);
  const lat1 = toRadians(start.lat);
  const lat2 = toRadians(end.lat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return radius * c;
}

function toCertificationSet(
  certifications: Array<{ type: string; status: CertificationStatus }>,
) {
  return new Set(
    certifications
      .filter((cert) => cert.status === CertificationStatus.ACTIVE)
      .map((cert) => cert.type),
  );
}

function extractRequiredCertifications(value: unknown): string[] {
  if (!value || !Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

type OfferInclude = Prisma.VisitOfferGetPayload<{
  include: {
    tile: {
      select: {
        id: true;
        slug: true;
        name: true;
        status: true;
      };
    };
    serviceVisit: {
      include: {
        customer: {
          select: {
            id: true;
            name: true;
            addressLine1: true;
            city: true;
            zip: true;
            latitude: true;
            longitude: true;
            dogs: {
              select: {
                id: true;
                name: true;
                breed: true;
              };
            };
          };
        };
        job: {
          select: {
            id: true;
            frequency: true;
            primaryScooperId: true;
          };
        };
      };
    };
  };
}>;

export interface OfferGenerationOptions {
  orgId: string;
  tileId: string;
  lookaheadDays?: number;
  limit?: number;
}

export async function createVisitOffersForTile(
  options: OfferGenerationOptions,
) {
  const { orgId, tileId, lookaheadDays = 7, limit = 25 } = options;
  const now = new Date();
  const horizon = addDays(now, lookaheadDays);
  const refreshMinutes = await resolveOfferRefreshMinutes(orgId);

  const visits = await prisma.serviceVisit.findMany({
    where: {
      orgId,
      tileId,
      status: ServiceStatus.SCHEDULED,
      assignedToId: null,
      backupAssignedToId: null,
      scheduledDate: {
        gte: now,
        lte: horizon,
      },
    },
    orderBy: { scheduledDate: "asc" },
    take: limit,
    select: {
      id: true,
      scheduledDate: true,
      metadata: true,
    },
  });

  const offers = [];
  const createdOffers = [];
  for (const visit of visits) {
    const existingOffer = await prisma.visitOffer.findFirst({
      where: {
        serviceVisitId: visit.id,
        status: {
          in: ["PENDING", "ACCEPTED"],
        },
      },
    });

    if (existingOffer) {
      offers.push(existingOffer);
      continue;
    }

    const created = await prisma.visitOffer.create({
      data: {
        orgId,
        serviceVisitId: visit.id,
        tileId,
        status: "PENDING",
        priority: 0,
        dispatchStrategy: "tile_waitlist",
        expiresAt: addMinutes(now, refreshMinutes),
        metadata: visit.metadata ?? {},
      },
    });

    offers.push(created);
    createdOffers.push(created);
  }

  if (createdOffers.length) {
    void sendScooperOfferPush({
      orgId,
      tileId,
      offerCount: createdOffers.length,
    }).catch(() => {
      // Push failures should not block offer creation.
    });
  }

  return offers;
}

export async function createVisitOffersForVisits(options: {
  orgId: string;
  visitIds: string[];
  now?: Date;
}) {
  const { orgId, visitIds, now = new Date() } = options;
  if (!visitIds.length) {
    return { offers: [], createdOffers: [], tileIds: [] as string[] };
  }

  const refreshMinutes = await resolveOfferRefreshMinutes(orgId);
  const visits = await prisma.serviceVisit.findMany({
    where: {
      id: { in: visitIds },
      orgId,
      status: ServiceStatus.SCHEDULED,
      assignedToId: null,
      backupAssignedToId: null,
      scheduledDate: { gte: now },
    },
    select: {
      id: true,
      metadata: true,
      tileId: true,
      job: {
        select: {
          tileId: true,
        },
      },
    },
  });

  const offers = [];
  const createdOffers = [];

  for (const visit of visits) {
    const existingOffer = await prisma.visitOffer.findFirst({
      where: {
        serviceVisitId: visit.id,
        status: {
          in: [VisitOfferStatus.PENDING, VisitOfferStatus.ACCEPTED],
        },
      },
    });

    if (existingOffer) {
      offers.push(existingOffer);
      continue;
    }

    const tileId = visit.tileId ?? visit.job?.tileId ?? null;
    if (!tileId) {
      continue;
    }

    const created = await prisma.visitOffer.create({
      data: {
        orgId,
        serviceVisitId: visit.id,
        tileId,
        status: VisitOfferStatus.PENDING,
        priority: 0,
        dispatchStrategy: "tile_waitlist",
        expiresAt: addMinutes(now, refreshMinutes),
        metadata: visit.metadata ?? {},
      },
    });

    offers.push(created);
    createdOffers.push(created);
  }

  if (createdOffers.length) {
    const grouped = createdOffers.reduce<Record<string, number>>((acc, offer) => {
      if (!offer.tileId) return acc;
      acc[offer.tileId] = (acc[offer.tileId] ?? 0) + 1;
      return acc;
    }, {});

    await Promise.all(
      Object.entries(grouped).map(([tileId, count]) =>
        sendScooperOfferPush({ orgId, tileId, offerCount: count }).catch(() => {
          // Push failures should not block offer creation.
        }),
      ),
    );
  }

  const tileIds = Array.from(
    new Set(createdOffers.map((offer) => offer.tileId).filter((id): id is string => Boolean(id))),
  );

  return { offers, createdOffers, tileIds };
}

export async function expireStaleVisitOffers(options: {
  orgId: string;
  now?: Date;
}) {
  const { orgId, now = new Date() } = options;
  const refreshMinutes = await resolveOfferRefreshMinutes(orgId);

  const staleOffers = await prisma.visitOffer.findMany({
    where: {
      orgId,
      status: VisitOfferStatus.PENDING,
      expiresAt: {
        not: null,
        lte: now,
      },
    },
    select: {
      id: true,
      tileId: true,
      serviceVisitId: true,
      offeredToId: true,
      dispatchStrategy: true,
      metadata: true,
      serviceVisit: {
        select: {
          id: true,
          scheduledDate: true,
          status: true,
          assignedToId: true,
          preferredTimeWindow: true,
          preferredTimeWindowSlug: true,
          metadata: true,
          jobId: true,
          job: {
            select: {
              id: true,
              nextVisitAt: true,
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              userId: true,
              addressLine1: true,
              city: true,
              zip: true,
            },
          },
        },
      },
    },
  });

  if (!staleOffers.length) {
    return { expiredCount: 0, tileIds: [] as string[], serviceVisitIds: [] as string[] };
  }

  const refreshedAt = addMinutes(now, refreshMinutes);
  const staleIds = staleOffers.map((offer) => offer.id);
  const directIds = staleOffers
    .filter((offer) => Boolean(offer.offeredToId))
    .map((offer) => offer.id);

  const notifications: Array<{
    email?: {
      toEmail: string;
      customerName: string | null;
      scheduledDate: Date;
      windowLabel: string | null;
      windowSlug: string | null;
      addressLine1: string | null;
      city: string | null;
      zip: string | null;
    };
    push?: {
      userId: string;
      scheduledDate: Date;
      windowLabel: string | null;
    };
  }> = [];

  await prisma.$transaction(async (tx) => {
    for (const offer of staleOffers) {
      if (!offer.offeredToId || offer.dispatchStrategy !== "auto_assign") {
        continue;
      }

      const visit = offer.serviceVisit;
      if (!visit?.scheduledDate || visit.status !== ServiceStatus.SCHEDULED || visit.assignedToId) {
        continue;
      }

      const previousWindowLabel =
        visit.preferredTimeWindow ??
        resolvePreferredTimeWindowLabel(visit.preferredTimeWindowSlug, null);

      const delaySchedule = resolveDelayedSchedule({
        scheduledDate: visit.scheduledDate,
        preferredWindowSlug: visit.preferredTimeWindowSlug,
        now,
      });
      const customerWindowShortLabel = resolvePreferredTimeWindowShortLabel(
        delaySchedule.windowSlug,
        delaySchedule.windowLabel,
      );
      const customerWindowLabel = customerWindowShortLabel
        ? `${customerWindowShortLabel} window`
        : null;

      const delayMetadata = applyMarketplaceDelayMetadata({
        raw: visit.metadata,
        now,
        reason: "auto_assign_expired",
        previousScheduledAt: visit.scheduledDate,
        previousWindowSlug: visit.preferredTimeWindowSlug ?? null,
        previousWindowLabel,
      });

      await tx.serviceVisit.update({
        where: { id: visit.id },
        data: {
          scheduledDate: delaySchedule.scheduledDate,
          preferredTimeWindow: delaySchedule.windowLabel ?? previousWindowLabel ?? undefined,
          preferredTimeWindowSlug: delaySchedule.windowSlug ?? visit.preferredTimeWindowSlug ?? undefined,
          metadata: delayMetadata,
        },
      });

      if (visit.jobId && visit.job?.nextVisitAt) {
        const nextVisitAt = new Date(visit.job.nextVisitAt);
        if (nextVisitAt.getTime() <= visit.scheduledDate.getTime()) {
          await tx.job.update({
            where: { id: visit.jobId },
            data: { nextVisitAt: delaySchedule.scheduledDate },
          });
        }
      }

      if (visit.customer?.email) {
        notifications.push({
          email: {
            toEmail: visit.customer.email,
            customerName: visit.customer.name ?? null,
            scheduledDate: delaySchedule.scheduledDate,
            windowLabel: customerWindowLabel,
            windowSlug: delaySchedule.windowSlug ?? null,
            addressLine1: visit.customer.addressLine1 ?? null,
            city: visit.customer.city ?? null,
            zip: visit.customer.zip ?? null,
          },
          push: visit.customer.userId
            ? {
                userId: visit.customer.userId,
                scheduledDate: delaySchedule.scheduledDate,
                windowLabel: customerWindowLabel,
              }
            : undefined,
        });
      }
    }

    await tx.visitOffer.updateMany({
      where: {
        id: { in: staleIds },
      },
      data: {
        expiresAt: refreshedAt,
      },
    });

    if (directIds.length) {
      await tx.visitOffer.updateMany({
        where: {
          id: { in: directIds },
        },
        data: {
          offeredToId: null,
          dispatchStrategy: "tile_waitlist",
        },
      });
    }
  });

  if (notifications.length) {
    notifications.forEach((notice) => {
      if (notice.email) {
        void sendVisitDelayEmail({
          toEmail: notice.email.toEmail,
          customerName: notice.email.customerName,
          scheduledDate: notice.email.scheduledDate,
          preferredTimeWindow: notice.email.windowLabel,
          preferredTimeWindowSlug: notice.email.windowSlug,
          addressLine1: notice.email.addressLine1,
          city: notice.email.city,
          zip: notice.email.zip,
        }).catch(() => {
          // Ignore delivery failures for sweep notifications.
        });
      }
      if (notice.push) {
        void sendCustomerDelayPush({
          userId: notice.push.userId,
          scheduledDate: notice.push.scheduledDate,
          windowLabel: notice.push.windowLabel,
        }).catch(() => {
          // Ignore delivery failures for sweep notifications.
        });
      }
    });
  }

  const tileIds = Array.from(
    new Set(staleOffers.map((offer) => offer.tileId).filter((id): id is string => Boolean(id))),
  );
  const serviceVisitIds = staleOffers
    .map((offer) => offer.serviceVisitId)
    .filter((id): id is string => Boolean(id));

  info("marketplace.offers", {
    orgId,
    expiredCount: staleOffers.length,
    tileIds,
    serviceVisitIds,
  });

  return {
    expiredCount: staleOffers.length,
    tileIds,
    serviceVisitIds,
  };
}

type HandoffKind = "visit" | "job" | null;

function normalizeHandoffType(value: Prisma.JsonValue | null | undefined): HandoffKind {
  if (!value || typeof value !== "object") {
    return null;
  }

  const metadata = value as Record<string, unknown>;
  const raw = metadata.handoff;

  if (!raw || typeof raw !== "object") {
    return null;
  }

  const type = (raw as Record<string, unknown>).type;
  if (typeof type !== "string") {
    return null;
  }

  const normalized = type.toLowerCase();

  if (normalized.includes("job")) {
    return "job";
  }

  if (normalized.includes("visit")) {
    return "visit";
  }

  return null;
}

function isRecurringFrequency(frequency: Frequency): boolean {
  return frequency !== Frequency.ONE_TIME;
}

export interface ScooperOfferPreview {
  id: string;
  orgId: string;
  serviceVisitId: string;
  tileId: string | null;
  scheduledDate: Date | null;
  expiresAt: Date | null;
  jobId: string | null;
  frequency: Frequency;
  serviceType: ServiceType | null;
  status: VisitOfferStatus;
  priority: number;
  dispatchStrategy: string | null;
  isDirectOffer: boolean;
  isRecurring: boolean;
  handoffType: HandoffKind;
  preferredTimeWindowLabel: string | null;
  preferredTimeWindowSlug: string | null;
  preferredTimeWindowRange: string | null;
  distanceMiles: number | null;
  tile: {
    id: string;
    slug: string;
    name: string;
    status: string;
  } | null;
  customer: {
    id: string | null;
    name: string | null;
    addressLine1: string | null;
    city: string | null;
    zip: string | null;
    dogs?: Array<{
      id: string;
      name: string;
      breed: string | null;
    }>;
  } | null;
  revenueCents: number | null;
  estimatedPayout:
    | ({
        baseAmountCents: number;
        bonusAmountCents: number;
        mileageAmountCents: number;
        ppeAmountCents: number;
        tipsAmountCents: number;
        totalAmountCents: number;
        sharePercent: number;
        baseShareCents: number;
      } & Record<string, number | undefined>)
    | null;
  metadata: Prisma.JsonValue | null;
  visitMetadata: Prisma.JsonValue | null;
  requiredCertifications: Prisma.JsonValue | null;
}

async function resolveSchedule(
  orgId: string,
  frequency: Frequency,
  cache: Map<Frequency, VisitCompSchedule | null>,
) {
  if (cache.has(frequency)) {
    return cache.get(frequency) ?? null;
  }

  const schedule = await prisma.visitCompSchedule.findFirst({
    where: {
      orgId,
      frequency,
      effectiveFrom: { lte: new Date() },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });

  cache.set(frequency, schedule ?? null);
  return schedule ?? null;
}

export async function loadScooperOfferFeed(options: {
  orgId: string;
  userId: string;
  tileIds?: string[];
  limit?: number;
  now?: Date;
  homeAnchor?: { lat: number; lng: number } | null;
  certifications?: Array<{ type: string; status: CertificationStatus }>;
}): Promise<ScooperOfferPreview[]> {
  const { orgId, userId } = options;
  const tileIds = options.tileIds ?? [];
  const limit = options.limit ?? 40;
  const now = options.now ?? new Date();
  const homeAnchor = options.homeAnchor ?? null;
  const activeCerts = options.certifications ? toCertificationSet(options.certifications) : null;

  const offers = await prisma.visitOffer.findMany({
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
          serviceVisit: {
            status: ServiceStatus.SCHEDULED,
            assignedToId: null,
            backupAssignedToId: null,
            scheduledDate: { gte: now },
          },
        },
      ],
    },
    include: {
      tile: {
        select: {
          id: true,
          slug: true,
          name: true,
          status: true,
        },
      },
      serviceVisit: {
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              addressLine1: true,
              city: true,
              zip: true,
              latitude: true,
              longitude: true,
              dogs: {
                select: {
                  id: true,
                  name: true,
                  breed: true,
                },
              },
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
    orderBy: [
      { serviceVisit: { scheduledDate: "asc" } },
      { createdAt: "asc" },
    ],
    take: limit,
  });

  const scheduleCache = new Map<Frequency, VisitCompSchedule | null>();

  const previews: ScooperOfferPreview[] = [];

  for (const offer of offers as OfferInclude[]) {
    const visit = offer.serviceVisit;
    const frequency = visit?.job?.frequency ?? Frequency.WEEKLY;
    const requiredCerts = extractRequiredCertifications(visit?.requiredCertifications);
    if (activeCerts && requiredCerts.length) {
      const missing = requiredCerts.filter((cert) => !activeCerts.has(cert));
      if (missing.length) {
        continue;
      }
    }
    const fallbackSlug = normalizePreferredTimeWindowSlug(
      visit?.preferredTimeWindowSlug ?? undefined,
    );
    const extractedWindow = extractPreferredTimeWindow(
      visit?.metadata ?? null,
      visit?.preferredTimeWindow ?? null,
    );
    const preferredTimeWindowSlug = extractedWindow.slug ?? fallbackSlug;
    const preferredTimeWindowLabel = resolvePreferredTimeWindowLabel(
      preferredTimeWindowSlug,
      extractedWindow.label ?? visit?.preferredTimeWindow ?? null,
    );
    const preferredTimeWindowRange = resolvePreferredTimeWindowRange(
      preferredTimeWindowSlug,
      preferredTimeWindowLabel,
    );
    const distanceMiles =
      homeAnchor &&
      typeof visit?.customer?.latitude === "number" &&
      typeof visit?.customer?.longitude === "number"
        ? haversineMiles(
            { lat: homeAnchor.lat, lng: homeAnchor.lng },
            { lat: visit.customer.latitude, lng: visit.customer.longitude },
          )
        : null;
    const schedule = await resolveSchedule(orgId, frequency, scheduleCache);
    const handoffType = normalizeHandoffType(visit?.metadata);
    const jobOwnerId = visit?.job?.primaryScooperId ?? null;
    const isRecurring =
      isRecurringFrequency(frequency) &&
      handoffType !== "visit" &&
      (!jobOwnerId || jobOwnerId === userId);

    let estimatedPayout: ScooperOfferPreview["estimatedPayout"] = null;

    if (schedule) {
      const preview = estimateVisitPayoutPreview({
        schedule,
        revenueCents: visit?.revenueCents ?? null,
        metadata: visit?.metadata ?? null,
        deodorize: visit?.deodorize ?? false,
        mileageMiles: distanceMiles ?? 0,
        mileageRateCents: DEFAULT_MILEAGE_RATE_CENTS,
        ppeStipendCents: DEFAULT_PPE_STIPEND_CENTS,
      });

      estimatedPayout = {
        baseAmountCents: preview.baseAmountCents,
        bonusAmountCents: preview.bonusAmountCents,
        mileageAmountCents: preview.mileageAmountCents,
        ppeAmountCents: preview.ppeAmountCents,
        tipsAmountCents: preview.tipsAmountCents,
        totalAmountCents: preview.totalAmountCents,
        sharePercent: preview.sharePercent,
        baseShareCents: preview.baseShareCents,
      } as ScooperOfferPreview["estimatedPayout"];
    }

    previews.push({
      id: offer.id,
      orgId,
      serviceVisitId: offer.serviceVisitId,
      tileId: offer.tileId,
      scheduledDate: visit?.scheduledDate ?? null,
      expiresAt: offer.expiresAt,
      jobId: visit?.job?.id ?? null,
      frequency,
      serviceType: visit?.serviceType ?? null,
      status: offer.status,
      priority: offer.priority,
      dispatchStrategy: offer.dispatchStrategy,
      isDirectOffer: offer.offeredToId === userId,
      isRecurring,
      handoffType,
      preferredTimeWindowLabel,
      preferredTimeWindowSlug,
      preferredTimeWindowRange,
      distanceMiles,
      tile: offer.tile
        ? {
            id: offer.tile.id,
            slug: offer.tile.slug,
            name: offer.tile.name,
            status: offer.tile.status,
          }
        : null,
      customer: visit?.customer
        ? {
            id: visit.customer.id,
            name: visit.customer.name,
            addressLine1: visit.customer.addressLine1,
            city: visit.customer.city,
            zip: visit.customer.zip,
            dogs: visit.customer.dogs ?? [],
          }
        : null,
      revenueCents: visit?.revenueCents ?? null,
      estimatedPayout,
      metadata: offer.metadata,
      visitMetadata: visit?.metadata ?? null,
      requiredCertifications: visit?.requiredCertifications ?? null,
    });
  }

  return previews;
}
