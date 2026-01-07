import { NextRequest, NextResponse } from "next/server";

import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_RESULTS = 12;

function buildSearchConditions(query: string) {
  const like = `%${query}%`;
  return {
    OR: [
      { name: { contains: query, mode: "insensitive" as const } },
      { email: { contains: query, mode: "insensitive" as const } },
      { phone: { contains: query, mode: "insensitive" as const } },
      { addressLine1: { contains: query, mode: "insensitive" as const } },
      { zip: { contains: query, mode: "insensitive" as const } },
    ],
  };
}

export async function GET(request: NextRequest) {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = request.nextUrl.searchParams.get("orgId");
  const query = request.nextUrl.searchParams.get("query")?.trim();

  if (!orgId || !query) {
    return NextResponse.json({ error: "orgId and query required" }, { status: 400 });
  }

  const sessionOrgId = (session.user as any)?.orgId;
  if (!sessionOrgId || sessionOrgId !== orgId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const customers = await prisma.customer.findMany({
    where: {
      orgId,
      ...buildSearchConditions(query),
    },
    orderBy: [{ createdAt: "desc" }],
    take: MAX_RESULTS,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      addressLine1: true,
      city: true,
      zip: true,
      latitude: true,
      longitude: true,
      jobs: {
        select: {
          id: true,
          frequency: true,
          nextVisitAt: true,
        },
        take: 3,
      },
    },
  });

  return NextResponse.json({ ok: true, customers });
}

export const runtime = "nodejs";
