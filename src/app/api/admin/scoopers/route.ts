import { NextRequest, NextResponse } from "next/server";
import { ScooperStatus } from "@prisma/client";

import { resolveBusinessId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const orgId = await resolveBusinessId(request);
  const statusFilter = request.nextUrl.searchParams.get("status") as
    | ScooperStatus
    | undefined;

  const profiles = await prisma.scooperProfile.findMany({
    where: {
      orgId,
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      certifications: true,
      availabilities: {
        include: {
          tile: {
            select: { id: true, slug: true, name: true, status: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ orgId, profiles });
}

export const runtime = "nodejs";
