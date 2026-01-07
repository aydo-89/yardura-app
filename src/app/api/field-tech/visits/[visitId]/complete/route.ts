import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  CommunicationChannel,
  CommunicationStatus,
  ScooperRewardEventType,
  RouteStopStatus,
  ServiceStatus,
  VisitMediaType,
  VisitInsightSource,
  Prisma,
} from "@prisma/client";
import { differenceInMinutes, format, startOfDay } from "date-fns";

import { getScooperAuth } from "@/lib/auth/scooper";
import { prisma } from "@/lib/prisma";
import { upsertVisitInsight } from "@/lib/service-visits/insights";
import {
  createVisitCommunication,
  updateVisitCommunicationStatus,
} from "@/lib/service-visits/communications";
import { sendSms } from "@/lib/sms";
import { env, getSiteUrl } from "@/lib/env";
import { createSignedUrl } from "@/lib/supabase-admin";
import { normalizePhone } from "@/lib/phone";
import { sendTransactionalEmail } from "@/lib/email";
import { buildVisitCompletedEmail } from "@/lib/email/templates";
import { sendCustomerVisitCompletePush } from "@/lib/notifications/push";
import { upsertVisitPayoutForVisit } from "@/lib/marketplace/payouts";
import { createVisitChargeEntry } from "@/lib/billing/ledger";
import { getPlanByJobId } from "@/lib/billing/plan";
import type { BillingPreference } from "@/lib/billing/types";
import { resolveDisposalMode } from "@/lib/service-visits/disposal";
import {
  awardScooperPoints,
  SCOOPER_REWARD_EVENT_POINTS,
  SCOOPER_VISIT_POINTS_CAP,
} from "@/lib/field-tech/rewardEvents";

const SANITATION_SHOES_NOTE = "SANITATION_SHOES";
const SANITATION_TOOLS_NOTE = "SANITATION_TOOLS";
const SANITATION_VIDEO_NOTE = "SANITATION_VIDEO";

const completionSchema = z.object({
  color: z.string().min(1),
  consistency: z.string().min(1),
  content: z.string().min(1),
  observations: z.string().max(500).optional(),
  wellnessFlag: z.boolean().optional(),
  flagReason: z.string().max(500).optional(),
  customNote: z.string().max(240).optional(),
  notificationChannel: z.enum(["SMS", "EMAIL"]).default("SMS"),
  sampleCount: z
    .number()
    .int()
    .nonnegative()
    .max(200)
    .optional(),
  flaggedSampleReasons: z
    .array(z.string().min(1).max(200))
    .max(25)
    .optional(),
  insufficientSamples: z.boolean().optional(),
  insufficientSamplesNote: z.string().max(500).optional(),
});

type RouteParams = { params: Promise<{ visitId: string }> };

const parsePlanMetadata = (value: Prisma.JsonValue | null | undefined) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const readBoolean = (
  record: Record<string, unknown> | null,
  key: string,
): boolean | null => {
  if (!record) return null;
  return typeof record[key] === "boolean" ? (record[key] as boolean) : null;
};

const readString = (
  record: Record<string, unknown> | null,
  key: string,
): string | null => {
  if (!record) return null;
  const value = record[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toStartCase = (value: string | null | undefined): string | null => {
  if (!value) return null;
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const AVERAGE_DEPOSIT_WEIGHT_GRAMS = Number.parseFloat(
  process.env.AVG_DEPOSIT_WEIGHT_GRAMS ?? "120",
);

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { visitId } = await params;
  const auth = await getScooperAuth(request);
  const userId = auth?.userId;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const parsed = completionSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const visit = await prisma.serviceVisit.findUnique({
    where: { id: visitId },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          userId: true,
          phone: true,
          email: true,
        },
      },
      job: {
          select: {
            id: true,
            frequency: true,
            orgId: true,
            customerId: true,
            perVisitRevenueCents: true,
            billingPlan: {
              select: {
                billingPreference: true,
                perVisitAmountCents: true,
                metadata: true,
              },
            },
          },
        },
      media: {
        orderBy: { capturedAt: "asc" },
      },
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      routeStop: true,
    },
  });

  if (!visit || visit.assignedToId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const visitMetadata = parsePlanMetadata(visit.metadata as Prisma.JsonValue | null);
  const planMetadataSnapshot = parsePlanMetadata(
    visit.job?.billingPlan?.metadata ?? null,
  );
  const accessPreferences =
    asRecord(visitMetadata?.accessPreferences) ??
    asRecord(planMetadataSnapshot?.accessPreferences);
  const disposalPreferences =
    asRecord(visitMetadata?.disposalPreferences) ??
    asRecord(planMetadataSnapshot?.disposalPreferences);
  const disposalMode = resolveDisposalMode(readString(disposalPreferences, "mode"));

  const gateLocation = readString(accessPreferences, "gateLocation")?.toLowerCase();

  const requiresGatePhoto = (() => {
    const visitOverride = readBoolean(visitMetadata, "requiresGatePhoto");
    if (visitOverride !== null) return visitOverride;
    const planOverride = readBoolean(planMetadataSnapshot, "requiresGatePhoto");
    if (planOverride !== null) return planOverride;
    const preferenceOverride = readBoolean(accessPreferences, "requiresGatePhoto");
    if (preferenceOverride !== null) return preferenceOverride;
    if (gateLocation) {
      return gateLocation !== "front";
    }
    return true;
  })();

  const requiresBagDropPhoto = (() => {
    if (disposalMode !== "standard") return true;
    const visitOverride = readBoolean(visitMetadata, "requiresBagDropPhoto");
    if (visitOverride !== null) return visitOverride;
    const planOverride = readBoolean(planMetadataSnapshot, "requiresBagDropPhoto");
    if (planOverride !== null) return planOverride;
    const disposalOverride = readBoolean(disposalPreferences, "requiresBinConfirmation");
    if (disposalOverride !== null) return disposalOverride;
    return false;
  })();

  const requiredTypes: VisitMediaType[] = [VisitMediaType.INSIGHTSCOOP];
  if (requiresBagDropPhoto) {
    requiredTypes.push(VisitMediaType.BAG_DROP);
  }
  if (requiresGatePhoto) {
    requiredTypes.push(VisitMediaType.GATE);
  }

  const missing = requiredTypes.filter(
    (type) => !visit.media.some((media) => media.assetType === type),
  );

  if (missing.length > 0) {
    return NextResponse.json(
      { error: "missing_media", missing },
      { status: 400 },
    );
  }

  const hasSanitationShoes = visit.media.some(
    (media) =>
      media.assetType === VisitMediaType.OTHER &&
      media.notes === SANITATION_SHOES_NOTE,
  );
  const hasSanitationTools = visit.media.some(
    (media) =>
      media.assetType === VisitMediaType.OTHER &&
      media.notes === SANITATION_TOOLS_NOTE,
  );
  const hasSanitationClip = visit.media.some(
    (media) =>
      media.assetType === VisitMediaType.OTHER &&
      media.notes === SANITATION_VIDEO_NOTE,
  );

  const sanitationCaptured = hasSanitationClip || (hasSanitationShoes && hasSanitationTools);

  if (!sanitationCaptured) {
    return NextResponse.json(
      { error: "missing_sanitation_proof" },
      { status: 400 },
    );
  }

  const bagDropMedia = visit.media.filter((media) => media.assetType === VisitMediaType.BAG_DROP);
  const gateMedia = visit.media.filter((media) => media.assetType === VisitMediaType.GATE);

  const insightSamplesCount = visit.media.filter(
    (media) => media.assetType === VisitMediaType.INSIGHTSCOOP,
  ).length;

  const insight = await upsertVisitInsight({
    serviceVisitId: visit.id,
    colorIndicator: parsed.data.color,
    consistencyIndicator: parsed.data.consistency,
    contentIndicator: parsed.data.content,
    observations: parsed.data.observations,
    wellnessFlag: parsed.data.wellnessFlag ?? false,
    flagReason: parsed.data.flagReason,
    createdById: userId,
    source: VisitInsightSource.MANUAL,
    sourceMediaId: null,
    autoConfidence: null,
    analysisModel: null,
  });

  const completionTime = new Date();
  const arrivalVerifiedAt = readString(visitMetadata, "arrivalVerifiedAt");
  const arrivalStart =
    arrivalVerifiedAt && !Number.isNaN(new Date(arrivalVerifiedAt).getTime())
      ? new Date(arrivalVerifiedAt)
      : null;
  const metadataOverride =
    parsed.data.insufficientSamples
      ? {
          analysisOverride: {
            insufficientSamples: true,
            note: parsed.data.insufficientSamplesNote ?? null,
            attestedAt: completionTime.toISOString(),
          },
        }
      : null;
  const nextMetadata =
    metadataOverride && visitMetadata
      ? { ...visitMetadata, ...metadataOverride }
      : metadataOverride ?? visitMetadata ?? null;
  await prisma.serviceVisit.update({
    where: { id: visit.id },
    data: {
      status: ServiceStatus.COMPLETED,
      completedDate: completionTime,
      actualEnd: completionTime,
      actualStart: visit.actualStart ?? arrivalStart ?? completionTime,
      metadata: nextMetadata ? (nextMetadata as Prisma.InputJsonValue) : undefined,
    },
  });

  if (visit.orgId) {
    await awardScooperPoints({
      orgId: visit.orgId,
      scooperId: userId,
      eventType: ScooperRewardEventType.VISIT_COMPLETE,
      sourceKey: `visit-complete:${visit.id}`,
      points: SCOOPER_REWARD_EVENT_POINTS.visitComplete,
      serviceVisitId: visit.id,
      maxPointsPerVisit: SCOOPER_VISIT_POINTS_CAP,
    });

    const shouldAwardDetection = Boolean(
      insight?.wellnessFlag || parsed.data.wellnessFlag,
    );
    if (shouldAwardDetection) {
      await awardScooperPoints({
        orgId: visit.orgId,
        scooperId: userId,
        eventType: ScooperRewardEventType.DETECTION_FLAG,
        sourceKey: `detection:${visit.id}`,
        points: SCOOPER_REWARD_EVENT_POINTS.detectionFlag,
        serviceVisitId: visit.id,
        metadata: parsed.data.flagReason
          ? { flagReason: parsed.data.flagReason }
          : undefined,
        maxPointsPerVisit: SCOOPER_VISIT_POINTS_CAP,
      });
    }
  }

  const sampleCount = parsed.data.sampleCount ?? insightSamplesCount;
  const normalizedColor = parsed.data.color.trim();
  const normalizedConsistency = parsed.data.consistency.trim().toLowerCase();
  const issueReasons = new Set<string>();

  if (Array.isArray(parsed.data.flaggedSampleReasons)) {
    for (const reason of parsed.data.flaggedSampleReasons) {
      if (typeof reason === "string" && reason.trim().length > 0) {
        issueReasons.add(reason.trim());
      }
    }
  }

  const contentDescriptor = parsed.data.content.trim();
  if (contentDescriptor && contentDescriptor.toLowerCase() !== "typical") {
    issueReasons.add(contentDescriptor);
  }

  const weightBasis = Number.isFinite(AVERAGE_DEPOSIT_WEIGHT_GRAMS)
    ? AVERAGE_DEPOSIT_WEIGHT_GRAMS
    : 120;
  const estimatedWeight = sampleCount && sampleCount > 0 ? sampleCount * weightBasis : null;
  const issuesJson = issueReasons.size ? JSON.stringify({ issues: Array.from(issueReasons) }) : null;

  try {
    const existingReading = await prisma.dataReading.findFirst({
      where: { serviceVisitId: visit.id },
      select: { id: true },
    });

    const baseReadingData = {
      deviceId: "field-tech-manual",
      serviceVisitId: visit.id,
      timestamp: completionTime,
      color: normalizedColor,
      consistency: normalizedConsistency,
      weight: estimatedWeight ?? null,
      volume: sampleCount && sampleCount > 0 ? sampleCount : null,
      location: issuesJson,
      userId: visit.job?.customerId ?? visit.customer?.id ?? null,
    } satisfies Prisma.DataReadingUncheckedCreateInput;

    if (existingReading) {
      await prisma.dataReading.update({
        where: { id: existingReading.id },
        data: baseReadingData,
      });
    } else {
      await prisma.dataReading.create({
        data: baseReadingData,
      });
    }
  } catch (error) {
    console.error("[visit-complete] Failed to persist wellness data reading", {
      visitId: visit.id,
      error,
    });
  }

  // Calculate mileage from route plan data
  let mileageMiles = 0;
  try {
    const visitDate = startOfDay(new Date(visit.scheduledDate));
    const scooperProfile = await prisma.scooperProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (scooperProfile) {
      // Fetch route plan for this date
      const routePlan = await prisma.scooperRoutePlan.findFirst({
        where: {
          scooperId: scooperProfile.id,
          dateKey: visitDate,
          expiresAt: { gt: new Date() }, // Only valid, non-expired plans
        },
        select: { payload: true, summary: true },
        orderBy: { createdAt: "desc" }, // Most recent plan
      });

      if (routePlan) {
        const payload = routePlan.payload as {
          visits?: Array<{ id: string; travelFromPrevious?: { distanceMeters?: number } | null }>;
        };
        const summary = routePlan.summary as {
          totalDistanceMeters?: number;
        } | null;

        // Calculate miles for THIS visit's travel segment
        if (payload?.visits) {
          const visitData = payload.visits.find((v) => v.id === visitId);
          
          if (visitData?.travelFromPrevious?.distanceMeters) {
            // This visit has a travel segment from previous visit
            // Convert meters to miles (1 mile = 1609.34 meters)
            mileageMiles = visitData.travelFromPrevious.distanceMeters / 1609.34;
          } else {
            // This might be the first visit of the day (travel from home anchor)
            // Check if this is the first visit in the ordered list
            const visitIndex = payload.visits.findIndex((v) => v.id === visitId);
            if (visitIndex === 0) {
              // First visit: calculate distance from home anchor to first visit
              // Use summary total distance and divide by number of visits as approximation
              // OR fetch from route optimization start-to-first-waypoint distance
              // For now, use a proportional calculation based on total distance
              if (summary?.totalDistanceMeters && payload.visits.length > 0) {
                // Estimate first segment as ~20% of total (home to first is usually shorter)
                const estimatedFirstSegment = summary.totalDistanceMeters / (payload.visits.length + 1);
                mileageMiles = estimatedFirstSegment / 1609.34;
              }
            }
          }
        } else if (summary?.totalDistanceMeters) {
          // Fallback: if we can't get visit-specific data, divide total by visit count
          // This is not ideal but better than zero
          const visitCount = (payload?.visits?.length ?? 1);
          const avgDistancePerVisit = summary.totalDistanceMeters / visitCount;
          mileageMiles = avgDistancePerVisit / 1609.34;
        }
      }
    }
  } catch (error) {
    console.warn("[visit-complete] Failed to calculate mileage from route plan", {
      visitId: visit.id,
      error,
    });
    // Fallback to old method if route plan lookup fails
    if (!mileageMiles && visit.routeStop?.notes?.includes("MILES=")) {
      mileageMiles =
        Number.parseFloat(visit.routeStop.notes.split("MILES=").pop() ?? "0") || 0;
    }
  }

  // Generate or refresh payout record for this visit
  let payoutCents: number | null = null;
  try {
    const payoutRecord = await upsertVisitPayoutForVisit(visit.id, {
      mileageMiles,
    });
    if (payoutRecord) {
      payoutCents = payoutRecord.totalAmountCents;
    }
  } catch (error) {
    console.error("[visit-complete] Failed to compute payout", {
      visitId: visit.id,
      error,
    });
  }

  const plan = visit.job
    ? visit.job.billingPlan || (await getPlanByJobId(visit.job.id))
    : null;

  const planMetadata = parsePlanMetadata(
    (plan as any)?.metadata ?? visit.job?.billingPlan?.metadata ?? null,
  );
  const serviceOptions =
    planMetadata &&
    typeof planMetadata.serviceOptions === "object" &&
    !Array.isArray(planMetadata.serviceOptions)
      ? (planMetadata.serviceOptions as Record<string, unknown>)
      : null;
  const weekendUpgrade = Boolean(serviceOptions?.weekendUpgrade);

  const inferredPreference: BillingPreference = plan?.billingPreference
    ? (plan.billingPreference as BillingPreference)
    : (() => {
        if (!visit.job) return "per-visit";
        if (visit.job.frequency === "ONE_TIME") return "one-time";
        return "per-visit";
      })();

  if (visit.job) {
    const existingLedger = await prisma.customerBillingLedgerEntry.findFirst({
      where: { serviceVisitId: visit.id },
    });

    if (!existingLedger) {
      const amountCents = (() => {
        if (inferredPreference === "one-time") {
          return plan?.perVisitAmountCents ?? visit.job?.perVisitRevenueCents ?? 0;
        }
        if (inferredPreference === "monthly") {
          return plan?.perVisitAmountCents ?? visit.job?.perVisitRevenueCents ?? 0;
        }
        return plan?.perVisitAmountCents ?? visit.job?.perVisitRevenueCents ?? 0;
      })();

      if (amountCents > 0 && inferredPreference !== "monthly") {
        await createVisitChargeEntry({
          orgId: visit.job.orgId ?? auth?.orgId ?? "yardura",
          jobId: visit.job.id,
          customerId: visit.job.customerId,
          serviceVisitId: visit.id,
          billingPreference: inferredPreference,
          amountCents,
          serviceFrequency: visit.job.frequency,
          weekendUpgrade,
        });
      }
    }
  }

  if (visit.routeStop) {
    await prisma.routeStop.update({
      where: { id: visit.routeStop.id },
      data: {
        status: RouteStopStatus.COMPLETED,
        actualArrival: visit.routeStop.actualArrival ?? completionTime,
        actualDeparture: completionTime,
      },
    });
  }

  const nextVisit = visit.job
    ? await prisma.serviceVisit.findFirst({
        where: {
          jobId: visit.job.id,
          scheduledDate: { gt: visit.scheduledDate },
          status: ServiceStatus.SCHEDULED,
        },
        orderBy: { scheduledDate: "asc" },
      })
    : null;

  const nextVisitText = nextVisit
    ? format(new Date(nextVisit.scheduledDate), "EEE, MMM d")
    : undefined;

  const portalBase = getSiteUrl();
  const portalLink = portalBase
    ? `${portalBase.replace(/\/$/, "")}/dashboard/visits/${visit.id}`
    : "https://yardura.com/portal";

  const summaryLine =
    `All set! Today's visit is complete — gate re-latched.` +
    ` 3Cs read: Color ${parsed.data.color}, Consistency ${parsed.data.consistency}, Content ${parsed.data.content}.`;
  const photoLine = `Photos: ${portalLink}`;
  const nextLine = nextVisitText ? `Next visit: ${nextVisitText}.` : "";
  const customLine = parsed.data.customNote?.trim() ?? "";
  const messageBody = [summaryLine, photoLine, nextLine, customLine]
    .filter(Boolean)
    .join(" ")
    .trim();

  const bucket = env.STORAGE_BUCKET;
  let smsMediaUrls: string[] = [];

  if (bucket) {
    const prioritizedMediaTypes: VisitMediaType[] = [
      VisitMediaType.BAG_DROP,
      VisitMediaType.GATE,
      VisitMediaType.PROOF,
      VisitMediaType.INSIGHTSCOOP,
    ];
    const prioritizedMedia = prioritizedMediaTypes
      .map((type) => visit.media.find((media) => media.assetType === type))
      .filter((media): media is typeof visit.media[number] => Boolean(media));

    smsMediaUrls = await Promise.all(
      prioritizedMedia.map(async (media) => {
        try {
          return await createSignedUrl(bucket, media.storagePath, 60 * 5);
        } catch (error) {
          console.error("Failed to create signed URL for media", {
            mediaId: media.id,
            error,
          });
          return null;
        }
      }),
    ).then((results) => results.filter((url): url is string => Boolean(url)));
  }
  else {
    console.warn(
      "[visit-complete] STORAGE_BUCKET not configured; skipping media attachments",
    );
  }

  const normalizedPhone = normalizePhone(visit.customer?.phone);
  const notificationChannel = parsed.data.notificationChannel;

  if (notificationChannel === "SMS") {
    const communication = await createVisitCommunication({
      serviceVisitId: visit.id,
      channel: CommunicationChannel.SMS,
      templateId: "post_visit_sms_v1",
      messageBody,
      mediaUrls: smsMediaUrls,
      sentBy: userId,
      status: CommunicationStatus.PENDING,
    });

    let smsStatus: CommunicationStatus = CommunicationStatus.PENDING;
    let statusDetail: string | null = null;
    let deliveryConfirmedAt: Date | null = null;

    if (!normalizedPhone) {
      smsStatus = CommunicationStatus.FAILED;
      statusDetail = "missing_or_invalid_phone";
    } else {
      try {
        const result = await sendSms({
          to: normalizedPhone,
          body: messageBody,
          mediaUrls: smsMediaUrls,
        });

        const mapped = mapSmsStatus(result.status);
        smsStatus = mapped.status;
        statusDetail = mapped.detail;
        if (smsStatus === CommunicationStatus.DELIVERED) {
          deliveryConfirmedAt = new Date();
        }
      } catch (error: any) {
        console.error("Failed to send visit SMS", error);
        smsStatus = CommunicationStatus.FAILED;
        statusDetail = error?.message ?? "sms_error";
      }
    }

    await updateVisitCommunicationStatus({
      id: communication.id,
      status: smsStatus,
      statusDetail,
      deliveryConfirmedAt,
      sentAt: new Date(),
    });

    if (visit.customer?.userId) {
      try {
        const pushTemplateId = "visit_complete_push_v1";
        const existingPush = await prisma.visitCommunication.findFirst({
          where: {
            serviceVisitId: visit.id,
            channel: CommunicationChannel.PUSH,
            templateId: pushTemplateId,
          },
          select: { id: true },
        });

        if (!existingPush) {
          const pushComm = await createVisitCommunication({
            serviceVisitId: visit.id,
            channel: CommunicationChannel.PUSH,
            templateId: pushTemplateId,
            messageBody: "visit complete push",
            status: CommunicationStatus.PENDING,
          });

          const pushResult = await sendCustomerVisitCompletePush({
            userId: visit.customer.userId,
            scheduledDate: visit.scheduledDate ?? null,
          });

          const pushStatus =
            pushResult.sent > 0 ? CommunicationStatus.SENT : CommunicationStatus.FAILED;
          await updateVisitCommunicationStatus({
            id: pushComm.id,
            status: pushStatus,
            statusDetail: pushStatus === CommunicationStatus.SENT ? "sent" : "push_failed",
            sentAt: new Date(),
          });
        }
      } catch (error) {
        console.warn("[visit-complete] push failed", error);
      }
    }

    return NextResponse.json({
      ok: true,
      serviceVisitId: visit.id,
      insight,
      messageBody,
      mediaUrls: smsMediaUrls,
      communicationStatus: smsStatus,
      statusDetail,
      notificationChannel,
      nextVisitAt: nextVisit?.scheduledDate ?? null,
      payoutCents,
    });
  }

  const bagDropLocationRaw =
    readString(disposalPreferences, "trashLabel") ??
    readString(disposalPreferences, "trashLocation");
  const bagDropLocationLabel = toStartCase(bagDropLocationRaw) ?? "the designated bin";
  const disposalSummary = (() => {
    switch (disposalMode) {
      case "haul-away":
        return "Waste hauled offsite for disposal.";
      case "compost":
        return "Compost routing enabled.";
      default:
        return `Waste left in ${bagDropLocationLabel}.`;
    }
  })();

  const actualStart = visit.actualStart ? new Date(visit.actualStart) : null;
  const actualEnd = visit.actualEnd ? new Date(visit.actualEnd) : null;

  const emailAddress = visit.customer?.email?.trim();
  if (!emailAddress) {
    return NextResponse.json(
      { error: "missing_or_invalid_email" },
      { status: 400 },
    );
  }

  const emailCommunication = await createVisitCommunication({
    serviceVisitId: visit.id,
    channel: CommunicationChannel.EMAIL,
    templateId: "post_visit_email_v1",
    messageBody,
    mediaUrls: smsMediaUrls,
    sentBy: userId,
    status: CommunicationStatus.PENDING,
  });

  let emailStatus: CommunicationStatus = CommunicationStatus.PENDING;
  let emailStatusDetail: string | null = null;

  try {
    const subject = `InsightScoop visit complete — ${format(new Date(visit.scheduledDate), "MMM d")}`;
    const summaryLines = [summaryLine];
    const extraLines = [nextLine, customLine].filter((line): line is string => Boolean(line));
    const baseSiteUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://www.getinsightscoop.com";
    // Link directly to the visit samples page so customers can see their health report
    const visitRecapUrl = `${baseSiteUrl}/visits/${visit.id}/samples`;

    const wellnessHighlight = parsed.data.wellnessFlag
      ? `Wellness alert: ${parsed.data.flagReason?.trim() || "Follow-up recommended."}`
      : "Wellness check: No issues detected.";
    const emailHighlights: string[] = [];
    if (visit.assignedTo?.name) {
      emailHighlights.push(`Field specialist: ${visit.assignedTo.name}`);
    }
    emailHighlights.push(
      requiresGatePhoto
        ? gateMedia.length
          ? "Gate secured: Photo captured at exit."
          : "Gate secured: Photo on file."
        : "Entry confirmed — no gate on site.",
    );
    emailHighlights.push(
      requiresBagDropPhoto
        ? bagDropMedia.length
          ? `Bag drop: Photo captured in ${bagDropLocationLabel}.`
          : `Bag drop: Confirmed in ${bagDropLocationLabel}.`
        : `Waste disposal: ${disposalSummary}`,
    );
    emailHighlights.push(
      hasSanitationClip
        ? "Sanitation: 60-second rinse video captured."
        : "Sanitation: PPE and tools documented on-site.",
    );
    emailHighlights.push(wellnessHighlight);
    if (insightSamplesCount > 0) {
      emailHighlights.push(
        `Samples analyzed: ${insightSamplesCount} photo${insightSamplesCount === 1 ? "" : "s"}.`,
      );
    }
    if (actualStart && actualEnd) {
      const durationMinutes = Math.max(1, differenceInMinutes(actualEnd, actualStart));
      emailHighlights.push(
        `Time on-site: approx. ${durationMinutes} minute${durationMinutes === 1 ? "" : "s"}.`,
      );
    } else if (actualEnd) {
      emailHighlights.push(
        `Visit completed at ${format(actualEnd, "h:mmaaa").toLowerCase()}.`,
      );
    }

    const { html, text } = buildVisitCompletedEmail({
      toName: visit.customer?.name || emailAddress,
      subject,
      summaryLines,
      dashboardUrl: visitRecapUrl,
      extraLines,
      highlights: emailHighlights,
    });

    const messageId = await sendTransactionalEmail({
      to: emailAddress,
      subject,
      html,
      text,
      from: "support@yardura.com",
    });

    emailStatus = messageId ? CommunicationStatus.SENT : CommunicationStatus.FAILED;
    emailStatusDetail = messageId ? null : "email_send_failed";
  } catch (error: any) {
    console.error("Failed to send visit email", error);
    emailStatus = CommunicationStatus.FAILED;
    emailStatusDetail = error?.message ?? "email_error";
  }

  if (visit.customer?.userId) {
    try {
      const pushTemplateId = "visit_complete_push_v1";
      const existingPush = await prisma.visitCommunication.findFirst({
        where: {
          serviceVisitId: visit.id,
          channel: CommunicationChannel.PUSH,
          templateId: pushTemplateId,
        },
        select: { id: true },
      });

      if (!existingPush) {
        const pushComm = await createVisitCommunication({
          serviceVisitId: visit.id,
          channel: CommunicationChannel.PUSH,
          templateId: pushTemplateId,
          messageBody: "visit complete push",
          status: CommunicationStatus.PENDING,
        });

        const pushResult = await sendCustomerVisitCompletePush({
          userId: visit.customer.userId,
          scheduledDate: visit.scheduledDate ?? null,
        });

        const pushStatus =
          pushResult.sent > 0 ? CommunicationStatus.SENT : CommunicationStatus.FAILED;
        await updateVisitCommunicationStatus({
          id: pushComm.id,
          status: pushStatus,
          statusDetail: pushStatus === CommunicationStatus.SENT ? "sent" : "push_failed",
          sentAt: new Date(),
        });
      }
    } catch (error) {
      console.warn("[visit-complete] push failed", error);
    }
  }

  await updateVisitCommunicationStatus({
    id: emailCommunication.id,
    status: emailStatus,
    statusDetail: emailStatusDetail,
    sentAt: new Date(),
  });

  return NextResponse.json({
    ok: true,
    serviceVisitId: visit.id,
    insight,
    messageBody,
    mediaUrls: smsMediaUrls,
    communicationStatus: emailStatus,
    statusDetail: emailStatusDetail,
    notificationChannel,
    nextVisitAt: nextVisit?.scheduledDate ?? null,
    payoutCents,
  });
}

function mapSmsStatus(status: string | undefined) {
  switch (status) {
    case "queued":
    case "sending":
    case "sent":
      return { status: CommunicationStatus.SENT, detail: status };
    case "delivered":
      return { status: CommunicationStatus.DELIVERED, detail: status };
    case "skipped":
      return { status: CommunicationStatus.FAILED, detail: "twilio_not_configured" };
    case "failed":
    case "undelivered":
    case "canceled":
      return { status: CommunicationStatus.FAILED, detail: status };
    default:
      return {
        status: CommunicationStatus.SENT,
        detail: status ?? "unknown",
      };
  }
}

export const runtime = "nodejs";
