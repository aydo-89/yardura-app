import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { getScooperAuth } from "@/lib/auth/scooper";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ visitId: string; mediaId: string }> };

const updateLocationSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  accuracy: z.coerce.number().min(0).max(200).nullable().optional(),
  rawLat: z.coerce.number().min(-90).max(90).nullable().optional(),
  rawLng: z.coerce.number().min(-180).max(180).nullable().optional(),
  rawAccuracy: z.coerce.number().min(0).max(200).nullable().optional(),
});

const asRecord = (value: Prisma.JsonValue | null) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const distanceMeters = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
};

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { visitId, mediaId } = await params;
  const auth = await getScooperAuth(request);
  const userId = auth?.userId;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = updateLocationSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid location payload", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const visit = await prisma.serviceVisit.findUnique({
    where: { id: visitId },
    select: { assignedToId: true },
  });

  if (!visit || visit.assignedToId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const media = await prisma.serviceVisitMedia.findFirst({
    where: { id: mediaId, serviceVisitId: visitId },
    select: { id: true, locationMetadata: true },
  });

  if (!media) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  const correctionMeters =
    typeof parsed.data.rawLat === "number" && typeof parsed.data.rawLng === "number"
      ? distanceMeters(parsed.data.rawLat, parsed.data.rawLng, parsed.data.lat, parsed.data.lng)
      : null;

  const existingMetadata = asRecord(media.locationMetadata ?? null);
  const locationCorrection = {
    rawLat: parsed.data.rawLat ?? null,
    rawLng: parsed.data.rawLng ?? null,
    rawAccuracy: parsed.data.rawAccuracy ?? null,
    correctedAt: new Date().toISOString(),
    correctionMeters: correctionMeters !== null ? Math.round(correctionMeters * 10) / 10 : null,
    source: "manual",
  };

  const updateData: Prisma.ServiceVisitMediaUpdateInput = {
    gpsLat: parsed.data.lat,
    gpsLng: parsed.data.lng,
    locationMetadata: {
      ...(existingMetadata as Prisma.JsonObject),
      locationCorrection,
    },
  };

  if (Object.prototype.hasOwnProperty.call(parsed.data, "accuracy")) {
    updateData.gpsAccuracy =
      parsed.data.accuracy === null ? null : parsed.data.accuracy;
  }

  const updated = await prisma.serviceVisitMedia.update({
    where: { id: media.id },
    data: updateData,
  });

  return NextResponse.json({ ok: true, media: updated });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { visitId, mediaId } = await params;
  const auth = await getScooperAuth(_request);
  const userId = auth?.userId;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const visit = await prisma.serviceVisit.findUnique({
      where: { id: visitId },
      select: { assignedToId: true },
    });

    if (!visit || visit.assignedToId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Delete the media record (storage cleanup could be added here if needed)
    await prisma.serviceVisitMedia.delete({
      where: { id: mediaId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[field-tech-media-delete] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete media" },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";


