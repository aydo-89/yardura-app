import { NextRequest, NextResponse } from "next/server";
import { Prisma, ServiceStatus } from "@prisma/client";

import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createVisitChargeEntry } from "@/lib/billing/ledger";

import type { BillingPreference } from "@/lib/billing/types";

export async function POST(request: NextRequest) {
  try {
    const session = (await safeGetServerSession(authOptions as any)) as {
      user?: { email?: string };
    } | null;
    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (
      !session ||
      !session.user ||
      !session.user.email ||
      !adminEmails.includes(session.user.email.toLowerCase())
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { visitId, notes } = await request.json();

    if (!visitId) {
      return NextResponse.json(
        { error: "Visit ID is required" },
        { status: 400 },
      );
    }

    const visit = await prisma.serviceVisit.findUnique({
      where: { id: visitId },
      include: {
        job: {
          select: {
            id: true,
            orgId: true,
            customerId: true,
            perVisitRevenueCents: true,
            billingPlan: {
              select: {
                billingPreference: true,
                perVisitAmountCents: true,
                metadata: true,
              },
            },
            frequency: true,
          },
        },
      },
    });
    if (!visit) {
      return NextResponse.json(
        { error: "Service visit not found" },
        { status: 404 },
      );
    }

    if (visit.status === ServiceStatus.COMPLETED) {
      return NextResponse.json(
        { error: "Service visit already completed and charged" },
        { status: 400 },
      );
    }

    const customerId = visit.customerId ?? visit.job?.customerId;
    const orgId = visit.orgId ?? visit.job?.orgId;
    const jobId = visit.job?.id ?? null;

    if (!customerId || !orgId || !jobId) {
      return NextResponse.json(
        { error: "Visit is not linked to an active job" },
        { status: 422 },
      );
    }

    const amountCents = (() => {
      if (typeof visit.revenueCents === "number" && visit.revenueCents > 0) {
        return visit.revenueCents;
      }
      const planAmount = visit.job?.billingPlan?.perVisitAmountCents ?? null;
      if (planAmount && planAmount > 0) {
        return planAmount;
      }
      const jobAmount = visit.job?.perVisitRevenueCents ?? null;
      if (jobAmount && jobAmount > 0) {
        return jobAmount;
      }
      return null;
    })();

    if (!amountCents) {
      return NextResponse.json(
        { error: "Unable to determine visit revenue" },
        { status: 422 },
      );
    }

    const preference: BillingPreference = (() => {
      const raw = visit.job?.billingPlan?.billingPreference;
      if (!raw) return "per-visit";
      return raw as BillingPreference;
    })();

    const completionTimestamp = new Date();
    const appendedNotes = notes
      ? [visit.notes?.trim(), `Admin completion: ${notes}`]
          .filter(Boolean)
          .join("\n\n")
      : visit.notes ?? null;

    await prisma.serviceVisit.update({
      where: { id: visit.id },
      data: {
        status: ServiceStatus.COMPLETED,
        completedDate: completionTimestamp,
        actualEnd: completionTimestamp,
        actualStart: visit.actualStart ?? completionTimestamp,
        notes: appendedNotes,
      },
    });

    const planMetadata = (() => {
      const raw = visit.job?.billingPlan?.metadata ?? null;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return null;
      }
      return raw as Record<string, unknown>;
    })();

    const weekendUpgrade = Boolean(
      planMetadata &&
        typeof planMetadata.serviceOptions === "object" &&
        !Array.isArray(planMetadata.serviceOptions) &&
        (planMetadata.serviceOptions as Record<string, unknown>).weekendUpgrade,
    );

    await createVisitChargeEntry({
      orgId,
      jobId,
      customerId,
      serviceVisitId: visit.id,
      amountCents,
      billingPreference: preference,
      serviceFrequency: visit.job?.frequency ?? null,
      weekendUpgrade,
    });

    return NextResponse.json({
      success: true,
      visitId: visit.id,
      amountCents,
      billingPreference: preference,
      completedAt: completionTimestamp.toISOString(),
    });
  } catch (error: any) {
    console.error("Service charge error:", error);

    return NextResponse.json(
      { error: "Failed to process service charge" },
      { status: 500 },
    );
  }
}
