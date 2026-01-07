import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DisciplineEventSource, DisciplineEventType } from "@prisma/client";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { extractUserRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { recordDisciplineEvent, summarizeDisciplineEvents } from "@/lib/marketplace/discipline-events";
import { startOfQuarterUTC } from "@/lib/marketplace/discipline";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const role = extractUserRole(session);
  if (!role || (role !== "ADMIN" && role !== "OWNER") || !session) {
    return { error: "Unauthorized", status: 403 } as const;
  }
  return { session } as const;
}

const createSchema = z.object({
  type: z.nativeEnum(DisciplineEventType),
  reason: z.string().max(240).optional().nullable(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: userId } = await params;
  const profile = await prisma.scooperProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!profile) {
    return NextResponse.json({ summary: null, events: [] });
  }

  const now = new Date();
  const quarterStart = startOfQuarterUTC(now);
  const events = await prisma.scooperDisciplineEvent.findMany({
    where: {
      scooperId: profile.id,
      createdAt: { gte: quarterStart },
    },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  const summary = summarizeDisciplineEvents(
    events.map((event) => ({
      type: event.type,
      reason: event.reason,
      createdAt: event.createdAt,
    })),
    now,
  );

  return NextResponse.json({
    summary: {
      missed: summary.strikes,
      lateRelease: summary.lateRelease,
      earlyRelease: summary.earlyRelease,
      jobRelease: summary.jobRelease,
    },
    events: events.map((event) => ({
      id: event.id,
      type: event.type,
      source: event.source,
      reason: event.reason ?? null,
      createdAt: event.createdAt.toISOString(),
      serviceVisitId: event.serviceVisitId ?? null,
      jobId: event.jobId ?? null,
      createdBy: event.createdBy
        ? {
            id: event.createdBy.id,
            name: event.createdBy.name ?? null,
            email: event.createdBy.email ?? null,
          }
        : null,
    })),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const payload = createSchema.parse(await request.json());
  const { id: userId } = await params;

  const profile = await prisma.scooperProfile.findUnique({
    where: { userId },
    select: { id: true, orgId: true, metadata: true },
  });

  if (!profile) {
    return NextResponse.json({ error: "scooper_profile_missing" }, { status: 404 });
  }

  const adminUser = await prisma.user.findUnique({
    where: { email: auth.session.user.email ?? "" },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    await recordDisciplineEvent({
      tx,
      profile,
      type: payload.type,
      reason: payload.reason ?? null,
      source: DisciplineEventSource.ADMIN,
      createdById: adminUser?.id ?? null,
      enforceLimit: false,
    });
  });

  return NextResponse.json({ ok: true });
}

export const runtime = "nodejs";
