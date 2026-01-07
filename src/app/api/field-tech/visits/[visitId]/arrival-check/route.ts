import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ServiceStatus } from "@prisma/client";

import { getScooperAuth } from "@/lib/auth/scooper";
import { prisma } from "@/lib/prisma";

const requestSchema = z.object({
  latitude: z.number().finite(),
  longitude: z.number().finite(),
  accuracy: z.number().finite().optional(),
});

const DEFAULT_THRESHOLD_METERS = 150;

type RouteParams = { params: Promise<{ visitId: string }> };

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
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
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { visitId } = await params;
  const auth = await getScooperAuth(request);
  const userId = auth?.userId;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedBody = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsedBody.error.flatten() },
      { status: 422 },
    );
  }

  const visit = await prisma.serviceVisit.findUnique({
    where: { id: visitId },
    select: {
      id: true,
      status: true,
      assignedToId: true,
      actualStart: true,
      metadata: true,
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

  if (visit.status !== ServiceStatus.SCHEDULED && visit.status !== ServiceStatus.IN_PROGRESS) {
    return NextResponse.json({ error: "visit_not_active" }, { status: 400 });
  }

  const targetLat = visit.customer?.latitude;
  const targetLng = visit.customer?.longitude;

  if (typeof targetLat !== "number" || typeof targetLng !== "number") {
    return NextResponse.json(
      { error: "missing_geo", message: "Visit location is missing coordinates." },
      { status: 400 },
    );
  }

  const distanceMeters = haversineMeters(
    parsedBody.data.latitude,
    parsedBody.data.longitude,
    targetLat,
    targetLng,
  );

  const withinThreshold = distanceMeters <= DEFAULT_THRESHOLD_METERS;
  const now = new Date();
  const nowIso = now.toISOString();
  const metadata = asRecord(visit.metadata);
  const arrivalVerification = {
    verifiedAt: nowIso,
    distanceMeters,
    accuracyMeters: parsedBody.data.accuracy ?? null,
    latitude: parsedBody.data.latitude,
    longitude: parsedBody.data.longitude,
    withinThreshold,
    thresholdMeters: DEFAULT_THRESHOLD_METERS,
  };

  const updatedMetadata = {
    ...metadata,
    arrivalVerification,
    arrivalVerifiedAt: withinThreshold ? nowIso : metadata.arrivalVerifiedAt ?? null,
  };

  await prisma.serviceVisit.update({
    where: { id: visit.id },
    data: {
      metadata: updatedMetadata,
      ...(withinThreshold && !visit.actualStart
        ? {
            actualStart: now,
            ...(visit.status === ServiceStatus.SCHEDULED
              ? { status: ServiceStatus.IN_PROGRESS }
              : {}),
          }
        : {}),
    },
  });

  return NextResponse.json({
    ok: true,
    withinThreshold,
    distanceMeters,
    thresholdMeters: DEFAULT_THRESHOLD_METERS,
    verifiedAt: withinThreshold ? now : null,
  });
}

export const runtime = "nodejs";
