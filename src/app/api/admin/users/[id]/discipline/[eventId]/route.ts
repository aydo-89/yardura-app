import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DisciplineEventType } from "@prisma/client";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { extractUserRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { rebuildDisciplineMetadataFromEvents, summarizeDisciplineEvents } from "@/lib/marketplace/discipline-events";
import { startOfQuarterUTC } from "@/lib/marketplace/discipline";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const role = extractUserRole(session);
  if (!role || (role !== "ADMIN" && role !== "OWNER") || !session) {
    return { error: "Unauthorized", status: 403 } as const;
  }
  return { session } as const;
}

const updateSchema = z.object({
  type: z.nativeEnum(DisciplineEventType).optional(),
  reason: z.string().max(240).optional().nullable(),
});

type RouteParams = { params: Promise<{ id: string; eventId: string }> };

async function refreshMetadata(profileId: string, metadata: unknown) {
  const now = new Date();
  const quarterStart = startOfQuarterUTC(now);
  const events = await prisma.scooperDisciplineEvent.findMany({
    where: {
      scooperId: profileId,
      createdAt: { gte: quarterStart },
    },
    orderBy: { createdAt: "desc" },
  });

  const rebuild = rebuildDisciplineMetadataFromEvents(metadata as any, now, events);
  await prisma.scooperProfile.update({
    where: { id: profileId },
    data: { metadata: rebuild.metadata },
  });

  const summary = summarizeDisciplineEvents(
    events.map((event) => ({
      type: event.type,
      reason: event.reason,
      createdAt: event.createdAt,
    })),
    now,
  );

  return {
    summary: {
      missed: summary.strikes,
      lateRelease: summary.lateRelease,
      earlyRelease: summary.earlyRelease,
      jobRelease: summary.jobRelease,
    },
  };
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const payload = updateSchema.parse(await request.json());
  const { id: userId, eventId } = await params;

  const profile = await prisma.scooperProfile.findUnique({
    where: { userId },
    select: { id: true, metadata: true },
  });

  if (!profile) {
    return NextResponse.json({ error: "scooper_profile_missing" }, { status: 404 });
  }

  const event = await prisma.scooperDisciplineEvent.findUnique({
    where: { id: eventId },
  });

  if (!event || event.scooperId !== profile.id) {
    return NextResponse.json({ error: "event_not_found" }, { status: 404 });
  }

  await prisma.scooperDisciplineEvent.update({
    where: { id: eventId },
    data: {
      type: payload.type ?? event.type,
      reason: payload.reason ?? event.reason,
    },
  });

  const refresh = await refreshMetadata(profile.id, profile.metadata);
  return NextResponse.json({ ok: true, ...refresh });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: userId, eventId } = await params;

  const profile = await prisma.scooperProfile.findUnique({
    where: { userId },
    select: { id: true, metadata: true },
  });

  if (!profile) {
    return NextResponse.json({ error: "scooper_profile_missing" }, { status: 404 });
  }

  const event = await prisma.scooperDisciplineEvent.findUnique({
    where: { id: eventId },
  });

  if (!event || event.scooperId !== profile.id) {
    return NextResponse.json({ error: "event_not_found" }, { status: 404 });
  }

  await prisma.scooperDisciplineEvent.delete({
    where: { id: eventId },
  });

  const refresh = await refreshMetadata(profile.id, profile.metadata);
  return NextResponse.json({ ok: true, ...refresh });
}

export const runtime = "nodejs";
