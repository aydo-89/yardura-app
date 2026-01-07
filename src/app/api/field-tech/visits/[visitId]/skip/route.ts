import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getScooperAuth } from "@/lib/auth/scooper";
import { prisma } from "@/lib/prisma";
import { ServiceStatus } from "@prisma/client";
import { createCreditEntry } from "@/lib/billing/ledger";
import { getPlanByJobId } from "@/lib/billing/plan";
import type { BillingPreference } from "@/lib/billing/types";
import { processPendingLedgerEntriesForJob } from "@/lib/billing/invoice-processor";
import { DisciplineEventType } from "@prisma/client";
import { recordDisciplineEvent } from "@/lib/marketplace/discipline-events";

type RouteParams = { params: Promise<{ visitId: string }> };

const schema = z.object({
  reasonId: z.string(),
  note: z.string().max(280).optional(),
});

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { visitId } = await params;
  const auth = await getScooperAuth(request);

  if (!auth?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = schema.parse(await request.json());

    const visit = await prisma.serviceVisit.findUnique({
      where: { id: visitId },
      select: {
        id: true,
        assignedToId: true,
        orgId: true,
        job: {
          select: {
            id: true,
            orgId: true,
            customerId: true,
            perVisitRevenueCents: true,
            billingPlan: {
              select: {
                id: true,
                billingPreference: true,
                perVisitAmountCents: true,
              },
            },
          },
        },
      },
    });

    if (!visit || visit.assignedToId !== auth.userId) {
      return NextResponse.json({ error: "Visit not found" }, { status: 404 });
    }

    const profile = await prisma.scooperProfile.findUnique({
      where: { userId: auth.userId },
      select: {
        id: true,
        orgId: true,
        metadata: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "scooper_profile_missing" }, { status: 404 });
    }

    const reason = await prisma.skipReason.findUnique({
      where: { id: payload.reasonId },
      select: { id: true, orgId: true, label: true },
    });

    if (!reason || reason.orgId !== visit.orgId) {
      return NextResponse.json({ error: "Invalid skip reason" }, { status: 400 });
    }

    const now = new Date();
    const reasonLabel = reason.label ?? "Skip";
    const eventReason = payload.note
      ? `${reasonLabel} — ${payload.note}`
      : reasonLabel;

    await prisma.$transaction(async (tx) => {
      await tx.serviceVisit.update({
        where: { id: visitId },
        data: {
          status: ServiceStatus.SKIPPED,
          skipReasonId: payload.reasonId,
          notes: payload.note ?? undefined,
          completedDate: now,
        },
      });

      await recordDisciplineEvent({
        tx,
        profile,
        type: DisciplineEventType.MISSED_VISIT,
        reason: eventReason,
        serviceVisitId: visit.id,
        jobId: visit.job?.id ?? null,
        enforceLimit: false,
        now,
      });
    });

    if (visit.job) {
      const plan = visit.job.billingPlan || (await getPlanByJobId(visit.job.id));
      const preference: BillingPreference = plan?.billingPreference
        ? (plan.billingPreference as BillingPreference)
        : "per-visit";

      if (preference !== "one-time") {
        const existingLedger = await prisma.customerBillingLedgerEntry.findMany({
          where: {
            serviceVisitId: visit.id,
          },
        });

        const hasCharge = existingLedger.some((entry) => entry.amountCents > 0);
        const hasCredit = existingLedger.some((entry) => entry.amountCents < 0);
        const shouldCredit = preference === "monthly" || hasCharge;

        if (!hasCredit && shouldCredit) {
          const amountCents = plan?.perVisitAmountCents ?? visit.job.perVisitRevenueCents ?? 0;

          if (amountCents > 0) {
            await createCreditEntry({
              orgId: visit.job.orgId ?? visit.orgId ?? auth.orgId ?? "yardura",
              jobId: visit.job.id,
              customerId: visit.job.customerId,
              amountCents,
              description: "Skipped visit credit",
              serviceVisitId: visit.id,
              metadata: {
                source: "visit-skip",
              },
            });
          }
        }
      }

      if (plan?.id) {
        await processPendingLedgerEntriesForJob(visit.job.id);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "validation_failed", details: error.flatten() },
        { status: 422 },
      );
    }
    console.error("field-tech.skip-visit", error);
    return NextResponse.json({ error: "Failed to skip visit" }, { status: 500 });
  }
}

export const runtime = "nodejs";
