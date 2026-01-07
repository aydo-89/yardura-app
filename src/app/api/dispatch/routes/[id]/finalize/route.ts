import { NextRequest, NextResponse } from "next/server";

import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const route = await prisma.routeInstance.findUnique({ where: { id } });
  if (!route) {
    return NextResponse.json({ error: "Route not found" }, { status: 404 });
  }

  await prisma.routeInstance.update({
    where: { id },
    data: {
      status: "CONFIRMED",
      updatedAt: new Date(),
    },
  });

  await prisma.dispatchDecisionLog.create({
    data: {
      orgId: route.orgId,
      action: "route_finalize",
      actorId: (session.user as any)?.id ?? null,
      routeInstanceId: route.id,
      metadata: {
        previousStatus: route.status,
      },
    },
  });

  return NextResponse.json({ ok: true });
}

export const runtime = "nodejs";
