import { NextRequest, NextResponse } from "next/server";
import { PayoutStatus } from "@prisma/client";
import { startOfMonth } from "date-fns";

import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  const session = await safeGetServerSession(authOptions as any);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const cursor = url.searchParams.get("cursor");

  const limit = limitParam ? Math.min(50, Math.max(5, Number(limitParam))) : PAGE_SIZE;

  const payouts = await prisma.visitPayout.findMany({
    where: { scooperId: userId },
    orderBy: { generatedAt: "desc" },
    take: limit + 1,
    ...(cursor
      ? {
          skip: 1,
          cursor: { id: cursor },
        }
      : {}),
    include: {
      serviceVisit: {
        select: {
          id: true,
          scheduledDate: true,
          metadata: true,
          tile: {
            select: {
              id: true,
              slug: true,
              name: true,
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
              addressLine1: true,
              city: true,
            },
          },
        },
      },
    },
  });

  const hasMore = payouts.length > limit;
  if (hasMore) {
    payouts.pop();
  }

  const [pendingTotal, monthPaid] = await Promise.all([
    prisma.visitPayout.aggregate({
      _sum: { totalAmountCents: true },
      where: {
        scooperId: userId,
        status: {
          in: [PayoutStatus.PENDING_REVIEW, PayoutStatus.READY],
        },
      },
    }),
    prisma.visitPayout.aggregate({
      _sum: { totalAmountCents: true },
      where: {
        scooperId: userId,
        status: PayoutStatus.RELEASED,
        clearedAt: {
          gte: startOfMonth(new Date()),
        },
      },
    }),
  ]);

  return NextResponse.json({
    payouts,
    summary: {
      pendingAmountCents: pendingTotal._sum.totalAmountCents ?? 0,
      monthPaidCents: monthPaid._sum.totalAmountCents ?? 0,
    },
    pagination: {
      nextCursor: hasMore ? payouts[payouts.length - 1]?.id ?? null : null,
      hasMore,
      pageSize: limit,
    },
    generatedAt: new Date().toISOString(),
  });
}

export const runtime = "nodejs";
