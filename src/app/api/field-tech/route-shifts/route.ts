import { NextRequest, NextResponse } from "next/server";
import { RouteShiftStatus } from "@prisma/client";

import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await safeGetServerSession(authOptions as any);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = request.nextUrl.searchParams.get("status") as RouteShiftStatus | null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { orgId: true },
  });

  if (!user?.orgId) {
    return NextResponse.json({ error: "no_org" }, { status: 403 });
  }

  const shifts = await prisma.routeShift.findMany({
    where: {
      orgId: user.orgId,
      OR: [{ scooperId: userId }, { scooperId: null }],
      status: status ?? undefined,
    },
    include: {
      tile: { select: { id: true, name: true, slug: true } },
      serviceVisits: {
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              addressLine1: true,
              city: true,
              zip: true,
            },
          },
        },
      },
    },
    orderBy: [{ serviceDate: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ shifts });
}

export const runtime = "nodejs";
