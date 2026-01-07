import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { attachVisitToRoute, createRouteInstanceWithStops } from "@/lib/dispatch/routes";
import { ensureDispatchSchema } from "@/lib/dispatch/schema-guard";

const requestSchema = z.object({
  technicianId: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureDispatchSchema();

  const { id } = await params;
  const payload = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json(
      { error: "validation_failed", details: payload.error.flatten() },
      { status: 422 },
    );
  }

  const draft = await prisma.dispatchRouteDraft.findUnique({
    where: { id },
  });

  if (!draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  const suggestion = (draft.metadata ?? null) as
    | {
        type: "existing" | "new";
        routeId?: string;
        visitIds: string[];
        scheduledDate?: string;
        windowSlug?: string | null;
        routeName?: string | null;
      }
    | null;

  if (!suggestion || !Array.isArray(suggestion.visitIds) || !suggestion.visitIds.length) {
    return NextResponse.json({ error: "Draft metadata missing visit list" }, { status: 400 });
  }

  let routeId: string | null = null;

  if (suggestion.type === "existing") {
    if (!suggestion.routeId) {
      return NextResponse.json({ error: "Draft missing route reference" }, { status: 400 });
    }

    let position: number | undefined = undefined;
    for (const visitId of suggestion.visitIds) {
      const stop = await attachVisitToRoute(suggestion.routeId, visitId, position);
      position = (stop.position ?? 0) + 1;
    }
    routeId = suggestion.routeId;
  } else {
    const scheduledDate = suggestion.scheduledDate
      ? new Date(suggestion.scheduledDate)
      : new Date(draft.scheduledDate);

    const technicianId = payload.data.technicianId ?? draft.technicianId ?? undefined;

    const route = await createRouteInstanceWithStops({
      orgId: draft.orgId,
      scheduledDate,
      technicianId: technicianId ?? undefined,
      visitIds: suggestion.visitIds,
      name: suggestion.routeName ?? undefined,
      notes: `Auto-generated from draft ${draft.id}`,
    });
    routeId = route?.id ?? null;
  }

  await prisma.dispatchDecisionLog.create({
    data: {
      orgId: draft.orgId,
      action: "draft_accept",
      actorId: (session.user as any)?.id ?? null,
      routeDraftId: draft.id,
      routeInstanceId: routeId,
      confidence: draft.confidence,
      metadata: draft.metadata ?? undefined,
    },
  });

  await prisma.dispatchRouteDraft.delete({ where: { id: draft.id } });

  return NextResponse.json({ ok: true, routeInstanceId: routeId });
}

export const runtime = "nodejs";
