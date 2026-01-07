import { NextRequest, NextResponse } from "next/server";
import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ServiceStatus } from "@prisma/client";
import { createCreditEntry } from "@/lib/billing/ledger";
import { getPlanByJobId } from "@/lib/billing/plan";
import type { BillingPreference } from "@/lib/billing/types";
import { processPendingLedgerEntriesForJob } from "@/lib/billing/invoice-processor";

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
    const { visitId, jobId, action, newDate, reason } = await request.json();

    if (!visitId || !action) {
      return NextResponse.json(
        { error: "Visit ID and action are required" },
        { status: 400 },
      );
    }

    const visit = visitId
      ? await prisma.serviceVisit.findUnique({
          where: { id: visitId },
          include: {
            job: {
              select: {
                id: true,
                orgId: true,
                customerId: true,
                perVisitRevenueCents: true,
                frequency: true,
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
        })
      : null;

    if (visitId && !visit) {
      return NextResponse.json(
        { error: "Service visit not found" },
        { status: 404 },
      );
    }

    if (visit && visit.status === ServiceStatus.COMPLETED) {
      return NextResponse.json(
        { error: "Cannot modify a completed service visit" },
        { status: 400 },
      );
    }

    if (!visit && jobId) {
      if (action === "reschedule") {
        if (!newDate) {
          return NextResponse.json(
            { error: "New date is required for rescheduling" },
            { status: 400 },
          );
        }
        await prisma.job.update({
          where: { id: jobId },
          data: { nextVisitAt: new Date(newDate) },
        });
      } else if (action === "cancel") {
        await prisma.job.update({
          where: { id: jobId },
          data: { nextVisitAt: null },
        });
      }

      return NextResponse.json({ success: true, message: "Job schedule updated" });
    }

    if (action === "cancel") {
      if (!visit) {
        return NextResponse.json(
          { error: "visit_required" },
          { status: 400 },
        );
      }

      const updated = await prisma.serviceVisit.update({
        where: { id: visit.id },
        data: {
          status: ServiceStatus.CANCELLED,
          notes: reason ?? undefined,
          completedDate: null,
        },
      });

      if (visit.job) {
        const plan = visit.job.billingPlan || (await getPlanByJobId(visit.job.id));
        const billingPreference: BillingPreference = plan?.billingPreference
          ? (plan.billingPreference as BillingPreference)
          : "per-visit";

        if (billingPreference !== "one-time") {
          const existingEntries = await prisma.customerBillingLedgerEntry.findMany({
            where: { serviceVisitId: visit.id },
            select: { amountCents: true },
          });
          const hasCharge = existingEntries.some((entry) => entry.amountCents > 0);
          const hasCredit = existingEntries.some((entry) => entry.amountCents < 0);
          const shouldCredit = billingPreference === "monthly" || hasCharge;

          if (!hasCredit && shouldCredit) {
            const amountCents = plan?.perVisitAmountCents ?? visit.job.perVisitRevenueCents ?? 0;
            if (amountCents > 0) {
              await createCreditEntry({
                orgId: visit.job.orgId ?? "yardura",
                jobId: visit.job.id,
                customerId: visit.job.customerId,
                amountCents,
                description: "Cancelled visit credit",
                serviceVisitId: visit.id,
                metadata: {
                  source: "admin-cancel",
                },
              });
            }
          }

          if (plan?.id) {
            await processPendingLedgerEntriesForJob(visit.job.id);
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: "Service visit cancelled successfully",
        visitId: visit.id,
        visit,
      });
    } else if (action === "reschedule") {
      if (!newDate) {
        return NextResponse.json(
          { error: "New date is required for rescheduling" },
          { status: 400 },
        );
      }

      const newServiceDate = new Date(newDate);

      // Validate the new date is in the future
      if (newServiceDate <= new Date()) {
        return NextResponse.json(
          { error: "New service date must be in the future" },
          { status: 400 },
        );
      }

      if (visit) {
        const updated = await prisma.serviceVisit.update({
          where: { id: visit.id },
          data: {
            status: ServiceStatus.SCHEDULED,
            scheduledDate: newServiceDate,
            completedDate: null,
            notes: reason ?? undefined,
          },
        });

        if (visit.jobId) {
          await prisma.job.update({
            where: { id: visit.jobId },
            data: { nextVisitAt: newServiceDate },
          });
        }

        return NextResponse.json({
          success: true,
          message: "Service visit rescheduled successfully",
          visitId: visit.id,
          newDate: newServiceDate,
          visit: updated,
        });
      }

    } else {
      return NextResponse.json(
        { error: 'Invalid action. Must be "cancel" or "reschedule"' },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("Cancel/reschedule error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 },
    );
  }
}
