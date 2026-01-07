import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { extractUserRole } from "@/lib/auth/roles";
import { Prisma, VisitReviewStatus, PayoutStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const ALLOWED_REVIEW_STATUS = new Set<VisitReviewStatus>([
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
]);

type RouteParams = { params: Promise<{ visitId: string }> };

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams,
) {
  const session = await getServerSession(authOptions);
  const role = extractUserRole(session);

  if (!session || !role || (role !== "ADMIN" && role !== "OWNER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { visitId } = await params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const { status, summary, issues } = body as {
    status?: string;
    summary?: string | null;
    issues?: unknown;
  };

  if (!status && typeof summary === "undefined" && typeof issues === "undefined") {
    return NextResponse.json({ error: "no_changes" }, { status: 400 });
  }

  let normalizedStatus: VisitReviewStatus | null = null;
  if (status) {
    normalizedStatus = status as VisitReviewStatus;
    if (!ALLOWED_REVIEW_STATUS.has(normalizedStatus)) {
      return NextResponse.json({ error: "invalid_status" }, { status: 400 });
    }
  }

  const visit = await prisma.serviceVisit.findUnique({
    where: { id: visitId },
    select: { id: true, orgId: true },
  });

  if (!visit || !visit.orgId) {
    return NextResponse.json({ error: "visit_not_found" }, { status: 404 });
  }

  const payload: Record<string, unknown> = {};
  if (normalizedStatus) payload.status = normalizedStatus;
  if (typeof summary !== "undefined") payload.summary = summary ?? null;
  if (typeof issues !== "undefined") {
    payload.issues =
      issues === null ? Prisma.JsonNull : (issues as Prisma.InputJsonValue);
  }
  const reviewerId = (session.user as any)?.id ?? null;
  payload.reviewerId = reviewerId;

  const review = await prisma.serviceVisitReview.upsert({
    where: { serviceVisitId: visit.id },
    update: payload,
    create: {
      serviceVisitId: visit.id,
      orgId: visit.orgId,
      status: normalizedStatus ?? "OPEN",
      reviewerId,
      ...(typeof summary !== "undefined" ? { summary: summary ?? null } : {}),
      ...(typeof issues !== "undefined"
        ? {
            issues:
              issues === null
                ? Prisma.JsonNull
                : (issues as Prisma.InputJsonValue),
          }
        : {}),
    },
    select: {
      id: true,
      status: true,
      summary: true,
      issues: true,
      reviewerId: true,
      updatedAt: true,
      createdAt: true,
    },
  });

  if (normalizedStatus) {
    const now = new Date();
    if (normalizedStatus === "RESOLVED") {
      await prisma.visitPayout.updateMany({
        where: {
          serviceVisitId: visit.id,
          status: { in: [PayoutStatus.PENDING_REVIEW, PayoutStatus.READY] },
          stripeTransferId: null,
          withdrawalRequestId: null,
        },
        data: {
          status: PayoutStatus.READY,
          readyAt: now,
        },
      });
    } else {
      await prisma.visitPayout.updateMany({
        where: {
          serviceVisitId: visit.id,
          status: PayoutStatus.READY,
          stripeTransferId: null,
          withdrawalRequestId: null,
        },
        data: {
          status: PayoutStatus.PENDING_REVIEW,
          readyAt: null,
        },
      });
    }
  }

  return NextResponse.json({
    ...review,
    updatedAt: review.updatedAt.toISOString(),
    createdAt: review.createdAt.toISOString(),
  });
}
