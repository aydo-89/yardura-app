import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import {
  createRouteInstanceWithStops,
  listRouteInstances,
} from "@/lib/dispatch/routes";
import { differenceInCalendarDays, startOfDay } from "date-fns";

const getSchema = z.object({
  orgId: z.string().min(1),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const postSchema = z.object({
  orgId: z.string().min(1),
  scheduledDate: z.string().datetime(),
  dispatcherId: z.string().optional(),
  technicianId: z.string().optional(),
  templateId: z.string().optional(),
  name: z.string().optional(),
  notes: z.string().optional(),
  visitIds: z.array(z.string()).optional(),
});

export async function GET(req: NextRequest) {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = getSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { orgId, from, to } = parsed.data;

  const anchor = from ? new Date(from) : startOfDay(new Date());
  const lookAheadDays = (() => {
    if (!to) return 21;
    const diff = differenceInCalendarDays(new Date(to), anchor);
    return Math.max(1, diff);
  })();

  const routes = await listRouteInstances({
    orgId,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  });

  return NextResponse.json({ ok: true, routes });
}

export async function POST(req: NextRequest) {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = postSchema.parse(await req.json());
    const scheduledDate = new Date(payload.scheduledDate);

    const route = await createRouteInstanceWithStops({
      orgId: payload.orgId,
      scheduledDate,
      dispatcherId: payload.dispatcherId,
      technicianId: payload.technicianId,
      templateId: payload.templateId,
      name: payload.name,
      notes: payload.notes,
      visitIds: payload.visitIds,
    });

    return NextResponse.json({ ok: true, route }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "validation_failed", details: error.flatten() },
        { status: 422 },
      );
    }
    console.error("dispatch.routes.POST", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
