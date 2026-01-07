import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { extractUserRole } from "@/lib/auth/roles";
import { Prisma, RouteStopStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ visitId: string }> };

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

/**
 * Reset a visit - clears all progress and returns it to SCHEDULED state
 * Useful for testing and debugging
 */
export async function POST(
  _request: NextRequest,
  { params }: RouteParams,
) {
  const session = await getServerSession(authOptions);
  const role = extractUserRole(session);

  if (!session || !role || (role !== "ADMIN" && role !== "OWNER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { visitId } = await params;

  // Verify the visit belongs to the admin's org
  const visit = await prisma.serviceVisit.findUnique({
    where: { id: visitId },
    select: { orgId: true, metadata: true },
  });

  if (!visit) {
    return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  }

  // Get admin's orgId
  const adminUser = await prisma.user.findUnique({
    where: { email: session.user?.email ?? undefined },
    select: { orgId: true },
  });

  if (!adminUser?.orgId || adminUser.orgId !== visit.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const metadata = asRecord(visit.metadata);
  delete metadata.arrivalVerification;
  delete metadata.arrivalVerifiedAt;

  try {
    await prisma.$transaction([
      // Clear visit-linked data
      prisma.serviceVisitMedia.deleteMany({
        where: { serviceVisitId: visitId },
      }),
      prisma.visitInsight.deleteMany({
        where: { serviceVisitId: visitId },
      }),
      prisma.visitCommunication.deleteMany({
        where: { serviceVisitId: visitId },
      }),
      prisma.serviceVisitReview.deleteMany({
        where: { serviceVisitId: visitId },
      }),
      prisma.scooperQaAudit.deleteMany({
        where: { serviceVisitId: visitId },
      }),
      prisma.dataReading.deleteMany({
        where: { serviceVisitId: visitId },
      }),
      prisma.scooperRewardEvent.deleteMany({
        where: { serviceVisitId: visitId },
      }),
      prisma.scooperLedgerEntry.deleteMany({
        where: {
          OR: [{ sourceVisitId: visitId }, { payout: { serviceVisitId: visitId } }],
        },
      }),
      prisma.visitPayout.deleteMany({
        where: { serviceVisitId: visitId },
      }),
      prisma.customerBillingLedgerEntry.deleteMany({
        where: { serviceVisitId: visitId },
      }),
      prisma.routeStop.updateMany({
        where: { serviceVisitId: visitId },
        data: {
          status: RouteStopStatus.PENDING,
          actualArrival: null,
          actualDeparture: null,
        },
      }),
      // Reset visit progress and arrival verification metadata
      prisma.serviceVisit.update({
        where: { id: visitId },
        data: {
          actualStart: null,
          actualEnd: null,
          completedDate: null,
          skipReasonId: null,
          notes: null,
          status: "SCHEDULED",
          metadata: metadata as Prisma.InputJsonValue,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Visit reset successfully",
    });
  } catch (error) {
    console.error("[admin-visit-reset] Failed to reset visit", {
      visitId,
      error,
    });
    return NextResponse.json(
      { error: "Failed to reset visit" },
      { status: 500 },
    );
  }
}
