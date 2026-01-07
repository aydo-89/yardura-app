import { NextRequest, NextResponse } from "next/server";

import { authOptions, safeGetServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createServiceVisitRating } from "@/lib/ratings/service-visit-rating";
import { createChargeEntry } from "@/lib/billing/ledger";
import { upsertVisitPayoutForVisit } from "@/lib/marketplace/payouts";
import { PayoutStatus } from "@prisma/client";

const errorStatus: Record<string, number> = {
  invalid_score: 400,
  visit_not_found: 404,
  visit_not_completed: 409,
  visit_already_rated: 409,
  visit_unassigned: 409,
  scooper_not_found: 404,
  payout_released: 409,
  invalid_tip: 400,
  job_missing: 409,
};

const MAX_TIP_CENTS = 5000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ visitId: string }> },
) {
  const { visitId } = await params;
  const session = (await safeGetServerSession(authOptions as any)) as
    | { user?: { email?: string | null } }
    | null;

  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const customer = await prisma.customer.findFirst({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!customer) {
    return NextResponse.json({ ok: false, error: "Customer not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const score = Number(body?.score);
  const comment = typeof body?.comment === "string" ? body.comment : null;
  const tipRaw = body?.tipCents;
  const tipCents = Number.isFinite(Number(tipRaw)) ? Math.trunc(Number(tipRaw)) : 0;

  if (!Number.isFinite(score)) {
    return NextResponse.json({ ok: false, error: "invalid_score" }, { status: 400 });
  }
  if (tipCents < 0 || tipCents > MAX_TIP_CENTS) {
    return NextResponse.json({ ok: false, error: "invalid_tip" }, { status: 400 });
  }

  const visitContext =
    tipCents > 0
      ? await prisma.serviceVisit.findFirst({
          where: { id: visitId, customerId: customer.id },
          select: {
            id: true,
            status: true,
            orgId: true,
            jobId: true,
            job: { select: { orgId: true } },
            visitPayout: { select: { status: true } },
          },
        })
      : null;

  if (tipCents > 0 && !visitContext) {
    return NextResponse.json({ ok: false, error: "visit_not_found" }, { status: 404 });
  }

  if (visitContext?.visitPayout?.status === PayoutStatus.RELEASED) {
    return NextResponse.json({ ok: false, error: "payout_released" }, { status: 409 });
  }

  try {
    const rating = await createServiceVisitRating({
      visitId,
      customerId: customer.id,
      score,
      comment,
      source: "customer-dashboard",
      tipCents,
    });

    if (tipCents > 0 && visitContext) {
      if (!visitContext.jobId) {
        return NextResponse.json({ ok: false, error: "job_missing" }, { status: 409 });
      }
      const orgId = visitContext.orgId ?? visitContext.job?.orgId ?? "yardura";
      await createChargeEntry({
        orgId,
        jobId: visitContext.jobId,
        customerId: customer.id,
        amountCents: tipCents,
        description: "Scooper tip",
        serviceVisitId: visitId,
        metadata: {
          source: "visit-rating",
          tipCents,
        },
      });
      await upsertVisitPayoutForVisit(visitId, { tipsAmountCents: tipCents });
    }

    return NextResponse.json({
      ok: true,
      rating: {
        id: rating.id,
        score: rating.score,
        comment: rating.comment,
        createdAt: rating.createdAt.toISOString(),
        creditApplied: rating.creditApplied,
        tipCents: tipCents > 0 ? tipCents : 0,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unable_to_rate_visit";
    const status = errorStatus[message] ?? 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}



