import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ScooperWithdrawalStatus } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { extractUserRole } from "@/lib/auth/roles";
import { resolveBusinessId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

const MAX_PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = extractUserRole(session);

  if (!session || !role || (role !== "ADMIN" && role !== "OWNER")) {
    console.error("[Payouts API] Unauthorized:", {
      hasSession: !!session,
      role,
      userEmail: (session?.user as any)?.email,
      userRoles: (session as any)?.userRoles || (session?.user as any)?.roles,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const orgId = await resolveBusinessId(request);
  const { searchParams } = request.nextUrl;
  const statusParam = searchParams.get("status");
  const limitParam = Number(searchParams.get("limit") ?? "20");
  const limit = Math.min(Math.max(limitParam, 1), MAX_PAGE_SIZE);

  const where: Record<string, unknown> = { orgId };
  if (statusParam && statusParam !== "ALL") {
    where.status = statusParam as ScooperWithdrawalStatus;
  }

  let requests;
  try {
    requests = await prisma.scooperWithdrawalRequest.findMany({
      where,
      orderBy: { requestedAt: "desc" },
      take: limit,
      include: {
        scooper: { select: { id: true, name: true, email: true } },
        _count: { select: { payouts: true } },
      },
    });
  } catch (error) {
    console.error("[Payouts API] Database error:", error);
    return NextResponse.json(
      { error: "Database query failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    items: requests.map((requestItem) => ({
      id: requestItem.id,
      status: requestItem.status,
      amountCents: requestItem.amountCents,
      requestedAt: requestItem.requestedAt.toISOString(),
      reviewedAt: requestItem.reviewedAt?.toISOString() ?? null,
      paidAt: requestItem.paidAt?.toISOString() ?? null,
      payoutCount: requestItem._count.payouts,
      scooper: requestItem.scooper,
    })),
  });
}

export const runtime = "nodejs";
