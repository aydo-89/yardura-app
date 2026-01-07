import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { enqueueGeoSnapshot } from "@/lib/jobs/geoSnapshot";
import { ensureVisitGeoSnapshot } from "@/lib/dispatch/geo";
import { prisma } from "@/lib/prisma";
import { startOfDay, addDays } from "date-fns";
import { ServiceStatus } from "@prisma/client";

const schema = z.object({
  orgId: z.string().min(1),
  date: z.string().datetime().optional(),
  lookAheadDays: z.number().int().min(0).max(7).optional(),
  limit: z.number().int().min(1).max(500).optional(),
  enqueue: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = schema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json(
      { error: "validation_failed", details: payload.error.flatten() },
      { status: 422 },
    );
  }

  const { orgId, date, lookAheadDays, limit, enqueue } = payload.data;

  if (enqueue) {
    await enqueueGeoSnapshot({ orgId, date, lookAheadDays, limit });
    return NextResponse.json({ ok: true, queued: true }, { status: 202 });
  }

  const baseDate = date ? startOfDay(new Date(date)) : startOfDay(new Date());
  const to = addDays(baseDate, (lookAheadDays ?? 0) + 1);

  const visits = await prisma.serviceVisit.findMany({
    where: {
      orgId,
      status: ServiceStatus.SCHEDULED,
      scheduledDate: {
        gte: baseDate,
        lt: to,
      },
    },
    include: {
      customer: {
        select: {
          id: true,
          addressLine1: true,
          city: true,
          state: true,
          zip: true,
          latitude: true,
          longitude: true,
        },
      },
    },
    orderBy: { scheduledDate: "asc" },
    take: limit ?? 200,
  });

  let processed = 0;
  for (const visit of visits) {
    if (!visit.customer) continue;
    try {
      await ensureVisitGeoSnapshot({ orgId, customer: visit.customer, visit });
      processed += 1;
    } catch (error) {
      console.warn("[dispatch] geo cache sync failed", visit.id, error);
    }
  }

  return NextResponse.json({ ok: true, queued: false, processed });
}

export const runtime = "nodejs";
