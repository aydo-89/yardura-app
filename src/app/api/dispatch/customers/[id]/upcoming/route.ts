import { NextRequest, NextResponse } from "next/server";
import { addDays, startOfDay } from "date-fns";
import { z } from "zod";

import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractPreferredTimeWindow } from "@/lib/time-window";

const schema = z.object({
  id: z.string().min(1),
  rangeDays: z.coerce.number().min(1).max(90).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = schema.safeParse({ id, rangeDays: request.nextUrl.searchParams.get("rangeDays") });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const rangeDays = parsed.data.rangeDays ?? 30;
  const orgId = (session.user as any)?.orgId as string | undefined;
  if (!orgId) {
    return NextResponse.json({ error: "Missing org" }, { status: 400 });
  }

  const today = startOfDay(new Date());
  const end = addDays(today, rangeDays);

  const visits = await prisma.serviceVisit.findMany({
    where: {
      orgId,
      customerId: parsed.data.id,
      scheduledDate: {
        gte: today,
        lt: end,
      },
    },
    orderBy: [{ scheduledDate: "asc" }],
    include: {
      job: {
        select: {
          id: true,
          frequency: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          name: true,
        },
      },
      routeStop: {
        include: {
          routeInstance: {
            select: {
              id: true,
              status: true,
              technician: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const payload = visits.map((visit) => {
    const { slug, label } = extractPreferredTimeWindow(visit.metadata);
    return {
      id: visit.id,
      scheduledDate: visit.scheduledDate,
      status: visit.status,
      frequency: visit.job?.frequency ?? null,
      jobId: visit.job?.id ?? null,
      assignedTo: visit.assignedTo,
      windowSlug: slug,
      windowLabel: label,
      route: visit.routeStop?.routeInstance
        ? {
            id: visit.routeStop.routeInstance.id,
            status: visit.routeStop.routeInstance.status,
            technician: visit.routeStop.routeInstance.technician,
          }
        : null,
    };
  });

  return NextResponse.json({ ok: true, visits: payload });
}

export const runtime = "nodejs";
