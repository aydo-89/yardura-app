import { NextRequest, NextResponse } from "next/server";
import { ScooperStatus } from "@prisma/client";

import { authOptions, safeGetServerSession } from "@/lib/auth";
import { resolveBusinessId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

function ensureAdmin(session: any) {
  const role = session?.userRole ?? session?.user?.role ?? null;
  if (!session?.user || !["OWNER", "ADMIN"].includes(role)) {
    throw new Error("unauthorized");
  }
}

function parseStatuses(request: NextRequest): ScooperStatus[] {
  const raw = request.nextUrl.searchParams.get("status");
  if (!raw) return [ScooperStatus.APPLICANT, ScooperStatus.PENDING_REVIEW];
  const values = raw
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  const statuses = values.filter((value) => value in ScooperStatus) as ScooperStatus[];
  return statuses.length ? statuses : [ScooperStatus.APPLICANT, ScooperStatus.PENDING_REVIEW];
}

export async function GET(request: NextRequest) {
  const session = await safeGetServerSession(authOptions as any);
  try {
    ensureAdmin(session);
  } catch {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 403 });
  }

  const orgId = await resolveBusinessId(request);
  const statuses = parseStatuses(request);

  const profiles = await prisma.scooperProfile.findMany({
    where: {
      orgId,
      status: { in: statuses },
    },
    select: {
      id: true,
      status: true,
      backgroundCheckStatus: true,
      vehicleDetail: true,
      insuranceProofUrl: true,
      notes: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      availabilities: {
        select: {
          weekday: true,
          window: true,
          maxStops: true,
          tile: {
            select: {
              slug: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ ok: true, data: profiles });
}

export const runtime = "nodejs";
