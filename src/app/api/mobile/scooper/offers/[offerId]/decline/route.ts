import { NextRequest, NextResponse } from "next/server";
import { ScooperStatus, ServiceStatus, VisitOfferStatus } from "@prisma/client";
import { addMinutes } from "date-fns";

import { prisma } from "@/lib/prisma";
import { verifyMobileToken } from "@/lib/mobile-auth";
import { getBusinessConfig } from "@/lib/business-config";
import { markAutoAssignDecline } from "@/lib/marketplace/offer-auto-assign";
import { applyMarketplaceDelayMetadata, resolveDelayedSchedule } from "@/lib/marketplace/visit-delay";
import {
  resolvePreferredTimeWindowLabel,
  resolvePreferredTimeWindowShortLabel,
} from "@/lib/time-window";
import { sendVisitDelayEmail } from "@/lib/emails/visit-delay";
import { sendCustomerDelayPush } from "@/lib/notifications/push";

type RouteParams = Promise<{ offerId: string }>;

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

export async function POST(
  request: NextRequest,
  context: { params: RouteParams },
) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let payload: ReturnType<typeof verifyMobileToken>;
  try {
    payload = verifyMobileToken(token);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
  }

  const userId = payload.sub;
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "Scooper access required" },
      { status: 403 },
    );
  }

  const { offerId } = await context.params;

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
    },
  });

  if (!profile || !profile.org) {
    return NextResponse.json({ ok: false, error: "scooper_profile_missing" }, { status: 404 });
  }

  if (profile.status !== ScooperStatus.CERTIFIED) {
    return NextResponse.json({ ok: false, error: "scooper_not_certified" }, { status: 403 });
  }

  const offer = await prisma.visitOffer.findUnique({
    where: { id: offerId },
    include: {
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

  if (!offer || offer.orgId !== profile.orgId) {
    return NextResponse.json({ ok: false, error: "offer_not_found" }, { status: 404 });
  }

  if (offer.status !== VisitOfferStatus.PENDING) {
    return NextResponse.json({ ok: false, error: "offer_unavailable" }, { status: 409 });
  }

  if (!offer.offeredToId || offer.offeredToId !== userId) {
    return NextResponse.json({ ok: false, error: "offer_not_direct" }, { status: 409 });
  }

  const config = await getBusinessConfig(profile.orgId);
  const refreshMinutes =
    typeof config?.operations?.offerRefreshMinutes === "number" &&
    Number.isFinite(config.operations.offerRefreshMinutes) &&
    config.operations.offerRefreshMinutes > 0
      ? config.operations.offerRefreshMinutes
      : 30;
  const now = new Date();

  const visit = offer.serviceVisit;
  const shouldDelay =
    Boolean(offer.dispatchStrategy === "auto_assign") &&
    Boolean(visit?.scheduledDate);

  const previousWindowLabel = visit
    ? visit.preferredTimeWindow ??
      resolvePreferredTimeWindowLabel(visit.preferredTimeWindowSlug, null)
    : null;

  const delaySchedule =
    shouldDelay && visit?.scheduledDate
      ? resolveDelayedSchedule({
          scheduledDate: visit.scheduledDate,
          preferredWindowSlug: visit.preferredTimeWindowSlug,
          now,
        })
      : null;
  const customerWindowLabel = delaySchedule
    ? resolvePreferredTimeWindowShortLabel(
        delaySchedule.windowSlug,
        delaySchedule.windowLabel,
      )
    : null;
  const customerWindowText = customerWindowLabel
    ? `${customerWindowLabel} window`
    : null;

  const delayMetadata =
    shouldDelay && visit?.scheduledDate
      ? applyMarketplaceDelayMetadata({
          raw: visit.metadata,
          now,
          reason: "auto_assign_declined",
          previousScheduledAt: visit.scheduledDate,
          previousWindowSlug: visit.preferredTimeWindowSlug ?? null,
          previousWindowLabel,
        })
      : null;

  await prisma.$transaction(async (tx) => {
    if (shouldDelay && visit && delaySchedule && delayMetadata) {
      await tx.serviceVisit.updateMany({
        where: {
          id: visit.id,
          status: ServiceStatus.SCHEDULED,
          assignedToId: null,
        },
        data: {
          scheduledDate: delaySchedule.scheduledDate,
          preferredTimeWindow: delaySchedule.windowLabel ?? previousWindowLabel ?? undefined,
          preferredTimeWindowSlug:
            delaySchedule.windowSlug ?? visit.preferredTimeWindowSlug ?? undefined,
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
    }

    await tx.visitOffer.update({
      where: { id: offer.id },
      data: {
        offeredToId: null,
        dispatchStrategy: "tile_waitlist",
        expiresAt: addMinutes(now, refreshMinutes),
        respondedAt: now,
        metadata: markAutoAssignDecline(offer.metadata, { userId, now }),
      },
    });
  });

  if (shouldDelay && visit?.customer?.email && delaySchedule) {
    void sendVisitDelayEmail({
      toEmail: visit.customer.email,
      customerName: visit.customer.name ?? null,
      scheduledDate: delaySchedule.scheduledDate,
      preferredTimeWindow: delaySchedule.windowLabel,
      preferredTimeWindowSlug: delaySchedule.windowSlug,
      addressLine1: visit.customer.addressLine1,
      city: visit.customer.city,
      zip: visit.customer.zip,
    }).catch(() => {
      // Email failures should not block decline handling.
    });
  }

  if (shouldDelay && visit?.customer?.userId && delaySchedule) {
    void sendCustomerDelayPush({
      userId: visit.customer.userId,
      scheduledDate: delaySchedule.scheduledDate,
      windowLabel: customerWindowText,
    }).catch(() => {
      // Push failures should not block decline handling.
    });
  }

  return NextResponse.json({ ok: true });
}

export const runtime = "nodejs";
