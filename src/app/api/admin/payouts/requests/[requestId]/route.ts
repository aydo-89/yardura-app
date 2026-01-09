import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PayoutStatus, ScooperWithdrawalStatus } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { extractUserRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { fetchStripeConnectStatus } from "@/lib/stripe/connect";
import { releaseVisitPayout } from "@/lib/marketplace/payouts";

type RouteParams = { params: Promise<{ requestId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  const role = extractUserRole(session);

  if (!session || !role || (role !== "ADMIN" && role !== "OWNER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { requestId } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body?.action;

  if (!requestId) {
    return NextResponse.json({ error: "missing_request_id" }, { status: 400 });
  }

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "invalid_action" }, { status: 422 });
  }

  const requestItem = await prisma.scooperWithdrawalRequest.findUnique({
    where: { id: requestId },
    include: {
      scooper: { select: { id: true, stripeConnectAccountId: true } },
      payouts: {
        select: {
          id: true,
          status: true,
          stripeTransferId: true,
          totalAmountCents: true,
        },
      },
    },
  });

  if (!requestItem) {
    return NextResponse.json({ error: "request_not_found" }, { status: 404 });
  }

  if (requestItem.status === ScooperWithdrawalStatus.PAID) {
    return NextResponse.json({ error: "already_paid" }, { status: 409 });
  }

  const reviewerId = (session.user as any)?.id ?? null;

  if (action === "reject") {
    await prisma.$transaction([
      prisma.scooperWithdrawalRequest.update({
        where: { id: requestItem.id },
        data: {
          status: ScooperWithdrawalStatus.REJECTED,
          reviewedAt: new Date(),
          reviewedById: reviewerId,
        },
      }),
      prisma.visitPayout.updateMany({
        where: {
          withdrawalRequestId: requestItem.id,
          status: PayoutStatus.READY,
          stripeTransferId: null,
        },
        data: { withdrawalRequestId: null },
      }),
    ]);

    return NextResponse.json({ ok: true });
  }

  if (requestItem.status !== ScooperWithdrawalStatus.REQUESTED) {
    return NextResponse.json({ error: "invalid_status" }, { status: 409 });
  }

  const accountId = requestItem.scooper?.stripeConnectAccountId;
  if (!accountId) {
    return NextResponse.json({ error: "payout_account_missing" }, { status: 409 });
  }

  const status = await fetchStripeConnectStatus(accountId);
  if (!status.payoutsEnabled) {
    return NextResponse.json({ error: "payouts_not_enabled" }, { status: 409 });
  }

  const eligiblePayouts = requestItem.payouts.filter(
    (payout) =>
      payout.status === PayoutStatus.READY && !payout.stripeTransferId,
  );

  if (!eligiblePayouts.length) {
    return NextResponse.json({ error: "no_eligible_payouts" }, { status: 409 });
  }

  let releasedCount = 0;
  const errors: string[] = [];
  let hasInsufficientFunds = false;

  for (const payout of eligiblePayouts) {
    try {
      await releaseVisitPayout(payout.id);
      releasedCount += 1;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "unknown_error";
      errors.push(errorMessage);
      
      // Check for Stripe insufficient funds error
      if (errorMessage.toLowerCase().includes("insufficient funds")) {
        hasInsufficientFunds = true;
      }
    }
  }

  if (errors.length) {
    // Return more specific error codes for known issues
    if (hasInsufficientFunds) {
      const totalCents = eligiblePayouts.reduce((sum, p) => sum + (p.totalAmountCents || 0), 0);
      return NextResponse.json(
        { 
          error: "insufficient_funds", 
          amountCents: totalCents,
          message: `Your Stripe account has insufficient available funds to transfer $${(totalCents / 100).toFixed(2)}. Check your Stripe balance.`,
          details: errors,
        },
        { status: 402 }, // 402 Payment Required
      );
    }
    
    return NextResponse.json(
      { error: "release_failed", details: errors },
      { status: 500 },
    );
  }

  await prisma.scooperWithdrawalRequest.update({
    where: { id: requestItem.id },
    data: {
      status: ScooperWithdrawalStatus.PAID,
      reviewedAt: new Date(),
      reviewedById: reviewerId,
      paidAt: new Date(),
      metadata: {
        payoutCount: releasedCount,
      },
    },
  });

  return NextResponse.json({ ok: true });
}

export const runtime = "nodejs";
