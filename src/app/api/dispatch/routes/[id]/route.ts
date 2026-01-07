import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { safeGetServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureDispatchSchema } from "@/lib/dispatch/schema-guard";
import { assignTechnicianToRoute } from "@/lib/dispatch/routes";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Route id required" }, { status: 400 });
  }

  await ensureDispatchSchema();

  try {
    const route = await prisma.routeInstance.findUnique({
      where: { id },
      select: {
        id: true,
        orgId: true,
        scheduledDate: true,
        stops: {
          select: {
            serviceVisitId: true,
          },
        },
      },
    });

    if (!route) {
      return NextResponse.json({ error: "Route not found" }, { status: 404 });
    }

    const sessionOrgId = (session.user as any)?.orgId ?? null;
    if (sessionOrgId && route.orgId && sessionOrgId !== route.orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.routeStop.deleteMany({ where: { routeInstanceId: id } });
      await tx.routeInstance.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("dispatch.routes.delete", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

const patchSchema = z.object({
  technicianId: z.string().min(1).nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Route id required" }, { status: 400 });
  }

  await ensureDispatchSchema();

  try {
    const payload = patchSchema.parse(await request.json());

    const route = await prisma.routeInstance.findUnique({
      where: { id },
      select: {
        id: true,
        orgId: true,
      },
    });

    if (!route) {
      return NextResponse.json({ error: "Route not found" }, { status: 404 });
    }

    const sessionOrgId = (session.user as any)?.orgId ?? null;
    if (sessionOrgId && route.orgId && sessionOrgId !== route.orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updatedRoute = await assignTechnicianToRoute(id, payload.technicianId ?? null);

    return NextResponse.json({ ok: true, route: updatedRoute });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "validation_failed", details: error.flatten() },
        { status: 422 },
      );
    }
    console.error("dispatch.routes.patch", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
