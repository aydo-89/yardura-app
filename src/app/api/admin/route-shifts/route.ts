import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { resolveBusinessId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { createRouteShift, listRouteShiftsForOrg } from "@/lib/marketplace";
import { AvailabilityWindow } from "@prisma/client";

const createSchema = z.object({
  tileSlug: z.string().min(2),
  serviceDate: z.coerce.date(),
  window: z.nativeEnum(AvailabilityWindow),
  visitIds: z.array(z.string().min(5)).min(1),
  primary: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const orgId = await resolveBusinessId(request);
  const dateParam = request.nextUrl.searchParams.get("date");
  const statusParam = request.nextUrl.searchParams.get("status");

  const date = dateParam ? new Date(dateParam) : undefined;
  const shifts = await listRouteShiftsForOrg({
    orgId,
    date: date && !Number.isNaN(date.getTime()) ? date : undefined,
    status: statusParam as any,
  });

  return NextResponse.json({ orgId, shifts });
}

export async function POST(request: NextRequest) {
  const orgId = await resolveBusinessId(request);
  const payload = await request.json();
  const parsed = createSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const tile = await prisma.serviceTile.findFirst({
    where: { orgId, slug: parsed.data.tileSlug },
    select: { id: true },
  });

  if (!tile) {
    return NextResponse.json({ error: "tile_not_found" }, { status: 404 });
  }

  const shift = await createRouteShift({
    orgId,
    tileId: tile.id,
    serviceDate: parsed.data.serviceDate,
    window: parsed.data.window,
    visitIds: parsed.data.visitIds,
    createdById: null,
    primary: parsed.data.primary,
  });

  return NextResponse.json({ ok: true, shift });
}

export const runtime = "nodejs";
