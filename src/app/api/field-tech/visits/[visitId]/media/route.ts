import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  Prisma,
  ScooperRewardEventType,
  ServiceStatus,
  VisitMediaType,
} from "@prisma/client";

import { getScooperAuth } from "@/lib/auth/scooper";
import { prisma } from "@/lib/prisma";
import {
  ServiceVisitMediaUnavailableError,
  createServiceVisitMedia,
} from "@/lib/service-visits/media";
import { queueMediaAnalysis } from "@/lib/service-visits/media-analysis";
import { getWeekWindow } from "@/lib/wellness/reports";
import { fetchWeatherSnapshot } from "@/lib/weather/snapshot";
import {
  awardScooperPoints,
  SCOOPER_REWARD_EVENT_POINTS,
  SCOOPER_VISIT_POINTS_CAP,
} from "@/lib/field-tech/rewardEvents";
import { snapToParcel, type SnapResult } from "@/lib/geo/parcelSnap";

const mediaSchema = z
  .object({
    assetType: z.nativeEnum(VisitMediaType),
    capturedAt: z.string().datetime().optional(),
    gpsLat: z.coerce.number().optional(),
    gpsLng: z.coerce.number().optional(),
    gpsAccuracy: z.coerce.number().optional(),
    notes: z.string().max(500).optional(),
    stoolSampleId: z.string().uuid().optional(),
    stoolSampleView: z.enum(["SURFACE", "CROSS_SECTION"]).optional(),
    analysisMode: z.enum(["log_only", "analyze"]).optional(),
  })
  .transform((value) => ({
    ...value,
    analysisMode: value.analysisMode ?? "analyze",
  }));

type RouteParams = { params: Promise<{ visitId: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { visitId } = await params;
  const auth = await getScooperAuth(request);
  const userId = auth?.userId;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json(
      { error: "file_required" },
      { status: 400 },
    );
  }

  const parsed = mediaSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const visit = await prisma.serviceVisit.findUnique({
    where: { id: visitId },
    select: {
      assignedToId: true,
      orgId: true,
      status: true,
      customerId: true,
      scheduledDate: true,
      customer: {
        select: {
          latitude: true,
          longitude: true,
        },
      },
    },
  });

  if (!visit || visit.assignedToId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // For stool samples (INSIGHTSCOOP), validate and snap GPS to parcel boundary
  // Scoopers are ALWAYS on the property, so any point outside is GPS error
  let snapResult: SnapResult | null = null;
  let finalGpsLat = parsed.data.gpsLat;
  let finalGpsLng = parsed.data.gpsLng;

  const isInsightScoop = parsed.data.assetType === VisitMediaType.INSIGHTSCOOP;
  const hasGps = parsed.data.gpsLat !== undefined && parsed.data.gpsLng !== undefined;
  const hasHomeCoords =
    typeof visit.customer?.latitude === "number" &&
    typeof visit.customer?.longitude === "number";

  if (isInsightScoop && hasGps && hasHomeCoords) {
    try {
      snapResult = await snapToParcel(
        parsed.data.gpsLat!,
        parsed.data.gpsLng!,
        visit.customer!.latitude!,
        visit.customer!.longitude!,
      );

      // Use snapped coordinates if snapping was applied
      if (snapResult.snapped) {
        finalGpsLat = snapResult.lat;
        finalGpsLng = snapResult.lng;
        console.log(
          `[field-tech/media] GPS snapped to parcel: ${snapResult.rawLat},${snapResult.rawLng} → ${snapResult.lat},${snapResult.lng} (${snapResult.correctionMeters}m)`,
        );
      } else if (snapResult.status === "too_far") {
        // Point is too far from parcel - log warning but still save raw coordinates
        console.warn(
          `[field-tech/media] GPS too far from parcel (${snapResult.correctionMeters}m): ${parsed.data.gpsLat},${parsed.data.gpsLng}`,
        );
      }
    } catch (error) {
      console.warn("[field-tech/media] Parcel snap failed:", error);
    }
  }

  let stoolSampleId = parsed.data.stoolSampleId;
  if (isInsightScoop && !stoolSampleId) {
    if (parsed.data.stoolSampleView === "CROSS_SECTION") {
      const latestSurface = await prisma.serviceVisitMedia.findFirst({
        where: {
          serviceVisitId: visitId,
          assetType: VisitMediaType.INSIGHTSCOOP,
          stoolSampleView: "SURFACE",
        },
        orderBy: { capturedAt: "desc" },
        select: { id: true, stoolSampleId: true },
      });
      if (latestSurface) {
        stoolSampleId = latestSurface.stoolSampleId ?? randomUUID();
        if (!latestSurface.stoolSampleId) {
          await prisma.serviceVisitMedia.update({
            where: { id: latestSurface.id },
            data: { stoolSampleId },
          });
        }
      } else {
        stoolSampleId = randomUUID();
      }
    } else {
      stoolSampleId = randomUUID();
    }
  }

  const buffer = await file.arrayBuffer();

  try {
    const record = await createServiceVisitMedia({
      serviceVisitId: visitId,
      technicianId: userId,
      assetType: parsed.data.assetType,
      file: buffer,
      contentType: file.type,
      capturedAt: parsed.data.capturedAt
        ? new Date(parsed.data.capturedAt)
        : undefined,
      gpsLat: finalGpsLat,
      gpsLng: finalGpsLng,
      gpsAccuracy: parsed.data.gpsAccuracy,
      notes: parsed.data.notes,
      stoolSampleId,
      stoolSampleView: parsed.data.stoolSampleView,
    });

    // Store snapping metadata if GPS was corrected
    if (snapResult && (snapResult.snapped || snapResult.status === "too_far")) {
      try {
        await prisma.serviceVisitMedia.update({
          where: { id: record.id },
          data: {
            locationMetadata: {
              rawLat: snapResult.rawLat,
              rawLng: snapResult.rawLng,
              rawAccuracy: parsed.data.gpsAccuracy ?? null,
              snapped: snapResult.snapped,
              wasInside: snapResult.wasInside,
              correctionMeters: snapResult.correctionMeters,
              snapStatus: snapResult.status,
              parcelId: snapResult.parcel?.parcelId ?? null,
              parcelSource: snapResult.parcel?.source ?? null,
              correctedAt: new Date().toISOString(),
            },
          },
        });
      } catch (error) {
        console.warn("[field-tech/media] Failed to save snap metadata:", error);
      }
    }

    if (record.gpsLat !== null && record.gpsLng !== null) {
      try {
        const weatherSnapshot = await fetchWeatherSnapshot({
          lat: record.gpsLat,
          lng: record.gpsLng,
          capturedAt: record.capturedAt ?? new Date(),
          locationSource: "capture_gps",
        });
        if (weatherSnapshot) {
          // Merge weather with existing locationMetadata (snap info)
          const current = await prisma.serviceVisitMedia.findUnique({
            where: { id: record.id },
            select: { locationMetadata: true },
          });
          const existingMeta =
            current?.locationMetadata && typeof current.locationMetadata === "object"
              ? (current.locationMetadata as Record<string, unknown>)
              : {};
          await prisma.serviceVisitMedia.update({
            where: { id: record.id },
            data: {
              locationMetadata: {
                ...existingMeta,
                weather: weatherSnapshot,
              },
            },
          });
        }
      } catch (error) {
        console.warn("field-tech.media.weather.failed", { mediaId: record.id, error });
      }
    }

    if (visit.status === ServiceStatus.SCHEDULED) {
      await prisma.serviceVisit.update({
        where: { id: visitId },
        data: {
          status: "IN_PROGRESS",
          actualStart: new Date(),
        },
      });
    }

    if (record.assetType === "INSIGHTSCOOP" && visit.customerId) {
      const capturedAt = record.capturedAt ?? visit.scheduledDate ?? new Date();
      const { weekStart } = getWeekWindow(capturedAt);
      const reports = await prisma.weeklyWellnessReport.findMany({
        where: {
          customerId: visit.customerId,
          weekStart,
          OR: [
            { scope: "HOUSEHOLD" },
            { scope: "DOG", attribution: { in: ["OWNER_CONFIRMED", "DEVICE_CONFIRMED"] } },
          ],
        },
        select: { id: true },
      });

      if (reports.length > 0) {
        await prisma.weeklyWellnessReportMedia.createMany({
          data: reports.map((report) => ({
            reportId: report.id,
            mediaId: record.id,
          })),
          skipDuplicates: true,
        });
      }
    }

    if (record.assetType === VisitMediaType.INSIGHTSCOOP && visit.orgId) {
      const isCrossSection = record.stoolSampleView === "CROSS_SECTION";
      await awardScooperPoints({
        orgId: visit.orgId,
        scooperId: userId,
        eventType: isCrossSection
          ? ScooperRewardEventType.SAMPLE_CROSS
          : ScooperRewardEventType.SAMPLE_SURFACE,
        sourceKey: `media:${record.id}`,
        points: isCrossSection
          ? SCOOPER_REWARD_EVENT_POINTS.sampleCross
          : SCOOPER_REWARD_EVENT_POINTS.sampleSurface,
        serviceVisitId: visitId,
        metadata: record.stoolSampleView
          ? { stoolSampleView: record.stoolSampleView }
          : undefined,
        maxPointsPerVisit: SCOOPER_VISIT_POINTS_CAP,
      });
    }

    if (parsed.data.analysisMode !== "log_only") {
      try {
        await queueMediaAnalysis(record.id);
      } catch (error) {
        console.error("field-tech.media.analysis.queue", { mediaId: record.id, error });
      }
    }

    const refreshed = await prisma.serviceVisitMedia.findUnique({ where: { id: record.id } });

    // Include location snap info in response for client feedback
    const locationSnap = snapResult
      ? {
          snapped: snapResult.snapped,
          wasInside: snapResult.wasInside,
          correctionMeters: snapResult.correctionMeters,
          status: snapResult.status,
        }
      : null;

    return NextResponse.json({
      ok: true,
      media: refreshed ?? record,
      locationSnap,
    });
  } catch (error) {
    if (error instanceof ServiceVisitMediaUnavailableError) {
      console.warn("Media storage unavailable", { visitId, userId, error });
      return NextResponse.json(
        {
          error: "media_unavailable",
          message: "Media storage is not configured for this environment.",
        },
        { status: 503 },
      );
    }
    console.error("field-tech.media.upload", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
