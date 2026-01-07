import { NextRequest, NextResponse } from "next/server";
import { PayoutStatus, ScooperWithdrawalStatus, UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { verifyMobileToken } from "@/lib/mobile-auth";
import { sendAdminPayoutRequestPush } from "@/lib/notifications/push";

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

async function fetchConnectStatus(accountId: string) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { error: "Stripe is not configured for payouts yet." };
  }
  try {
    const { fetchStripeConnectStatus } = await import("@/lib/stripe/connect");
    const status = await fetchStripeConnectStatus(accountId);
    return { status };
  } catch {
    return { error: "Unable to verify payout setup. Try again shortly." };
  }
}

export async function GET(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let payload: ReturnType<typeof verifyMobileToken>;
  try {
    payload = verifyMobileToken(token);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
  }

  const userId = payload.sub;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Scooper access required" }, { status: 403 });
  }

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 10), 1), 50);

  const requests = await prisma.scooperWithdrawalRequest.findMany({
    where: { scooperId: userId },
    orderBy: { requestedAt: "desc" },
    take: limit,
    include: {
      _count: { select: { payouts: true } },
    },
  });

  return NextResponse.json({
    ok: true,
    data: requests.map((requestItem) => ({
      id: requestItem.id,
      status: requestItem.status,
      amountCents: requestItem.amountCents,
      requestedAt: requestItem.requestedAt.toISOString(),
      reviewedAt: requestItem.reviewedAt?.toISOString() ?? null,
      paidAt: requestItem.paidAt?.toISOString() ?? null,
      payoutCount: requestItem._count.payouts,
    })),
  });
}

export async function POST(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let payload: ReturnType<typeof verifyMobileToken>;
  try {
    payload = verifyMobileToken(token);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
  }

  const userId = payload.sub;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Scooper access required" }, { status: 403 });
  }

  const profile = await prisma.scooperProfile.findUnique({
    where: { userId },
    select: { orgId: true },
  });

  if (!profile?.orgId) {
    return NextResponse.json({ ok: false, error: "Scooper access required" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeConnectAccountId: true, name: true },
  });

  if (!user?.stripeConnectAccountId) {
    return NextResponse.json(
      { ok: false, error: "Add a payout method before requesting withdrawal." },
      { status: 409 },
    );
  }

  const statusResult = await fetchConnectStatus(user.stripeConnectAccountId);
  if (statusResult.error) {
    return NextResponse.json({ ok: false, error: statusResult.error }, { status: 503 });
  }
  if (!statusResult.status?.payoutsEnabled) {
    return NextResponse.json(
      { ok: false, error: "Finish Stripe onboarding before requesting withdrawal." },
      { status: 409 },
    );
  }

  const existing = await prisma.scooperWithdrawalRequest.findFirst({
    where: {
      scooperId: userId,
      status: { in: [ScooperWithdrawalStatus.REQUESTED, ScooperWithdrawalStatus.APPROVED] },
    },
  });

  if (existing) {
    return NextResponse.json(
      { ok: false, error: "withdrawal_request_pending" },
      { status: 409 },
    );
  }

  const availablePayouts = await prisma.visitPayout.findMany({
    where: {
      scooperId: userId,
      status: PayoutStatus.READY,
      stripeTransferId: null,
      withdrawalRequestId: null,
    },
    orderBy: { readyAt: "asc" },
    select: { id: true, totalAmountCents: true },
  });

  const amountCents = availablePayouts.reduce(
    (total, payout) => total + payout.totalAmountCents,
    0,
  );

  if (!amountCents) {
    return NextResponse.json(
      { ok: false, error: "no_earned_payouts" },
      { status: 409 },
    );
  }

  const requestRecord = await prisma.$transaction(async (tx) => {
    const requestItem = await tx.scooperWithdrawalRequest.create({
      data: {
        orgId: profile.orgId,
        scooperId: userId,
        amountCents,
        status: ScooperWithdrawalStatus.REQUESTED,
      },
    });

    await tx.visitPayout.updateMany({
      where: { id: { in: availablePayouts.map((payout) => payout.id) } },
      data: { withdrawalRequestId: requestItem.id },
    });

    return requestItem;
  });

  const adminUsers = await prisma.user.findMany({
    where: {
      orgId: profile.orgId,
      OR: [
        { role: { in: [UserRole.ADMIN, UserRole.OWNER, UserRole.SALES_REP] } },
        { roles: { hasSome: [UserRole.ADMIN, UserRole.OWNER, UserRole.SALES_REP] } },
      ],
    },
    select: { id: true },
  });

  if (adminUsers.length) {
    void sendAdminPayoutRequestPush({
      userIds: adminUsers.map((entry) => entry.id),
      scooperName: user?.name ?? null,
      amountCents,
    }).catch(() => null);
  }

  return NextResponse.json({
    ok: true,
    data: {
      id: requestRecord.id,
      status: requestRecord.status,
      amountCents: requestRecord.amountCents,
      requestedAt: requestRecord.requestedAt.toISOString(),
      reviewedAt: requestRecord.reviewedAt?.toISOString() ?? null,
      paidAt: requestRecord.paidAt?.toISOString() ?? null,
      payoutCount: availablePayouts.length,
    },
  });
}

export const runtime = "nodejs";
