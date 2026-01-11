import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ServiceStatus } from "@prisma/client";
import { z } from "zod";
import { createCreditEntry } from "@/lib/billing/ledger";
import { getPlanByJobId } from "@/lib/billing/plan";
import { ensureTrialExtendsThroughDate } from "@/lib/billing/invoice-processor";
import type { BillingPreference } from "@/lib/billing/types";
import { processPendingLedgerEntriesForJob } from "@/lib/billing/invoice-processor";
import { sendScooperVisitUpdatePush } from "@/lib/notifications/push";
import {
  normalizePreferredTimeWindowSlug,
  resolvePreferredTimeWindowLabel,
  getPreferredTimeWindowStart,
} from "@/lib/time-window";
import { constructZonedDate, SERVICE_TIME_ZONE, getZonedWeekday } from "@/lib/timezone";

const BILLING_PREFERENCE_VALUES: BillingPreference[] = [
  "monthly",
  "weekly",
  "per-visit",
  "one-time",
];

const schema = z
  .object({
    visitId: z.string().optional(),
    jobId: z.string().optional(),
    action: z.enum(["reschedule", "skip"]),
    nextVisitAt: z.string().optional(),
    preferredWindow: z.string().optional(),
    applyToFuture: z.boolean().optional(),
  })
  .refine((value) => value.visitId || value.jobId, {
    message: "visitId or jobId is required",
    path: ["visitId"],
  });

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asIsoString(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toBillingPreference(value: unknown): BillingPreference | null {
  if (typeof value !== "string") {
    return null;
  }

  return BILLING_PREFERENCE_VALUES.includes(value as BillingPreference)
    ? (value as BillingPreference)
    : null;
}

/**
 * Get the week boundaries (Sunday to Saturday) for a given date.
 * Used to enforce reschedule limits within the same billing week.
 */
function getWeekBoundaries(date: Date): { weekStart: Date; weekEnd: Date } {
  const dayOfWeek = getZonedWeekday(date, SERVICE_TIME_ZONE);

  // Calculate Sunday of this week
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);

  // Calculate Saturday of this week
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
}

/**
 * Check if two dates are in the same week (Sunday to Saturday).
 */
function isSameWeek(date1: Date, date2: Date): boolean {
  const week1 = getWeekBoundaries(date1);
  const week2 = getWeekBoundaries(date2);
  return week1.weekStart.getTime() === week2.weekStart.getTime();
}

/**
 * Format a date as YYYY-MM-DD for API responses.
 */
function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseRequestedDate(value: unknown): { date: Date; isDateOnly: boolean } | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { date: value, isDateOnly: false };
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, yearStr, monthStr, dayStr] = dateOnlyMatch;
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    if (
      Number.isFinite(year) &&
      Number.isFinite(month) &&
      Number.isFinite(day)
    ) {
      return {
        date: constructZonedDate(year, month, day, 0, 0, 0, 0),
        isDateOnly: true,
      };
    }
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return { date: parsed, isDateOnly: false };
}

async function loadPlanContext(planId: string) {
  let plan: {
    id: string;
    billingPreference: string | null;
    trialEndsAt: Date | null;
    metadata: unknown;
  } | null = null;

  try {
    plan = await prisma.customerBillingPlan.findUnique({
      where: { id: planId },
      select: {
        id: true,
        billingPreference: true,
        trialEndsAt: true,
        metadata: true,
      },
    });
  } catch (error: any) {
    if (error?.code === "P2021") {
      return null;
    }
    throw error;
  }

  if (!plan) {
    return null;
  }

  const metadata = asObject(plan.metadata);
  const billingAutomation = metadata ? asObject(metadata["billingAutomation"]) : null;
  const serviceOptions = metadata ? asObject(metadata["serviceOptions"]) : null;

  const trialBounds = {
    startsAt: asIsoString(billingAutomation?.["trialStartsAt"]),
    activationStartsAt: asIsoString(billingAutomation?.["activationStartsAt"]),
    endsAt:
      asIsoString(billingAutomation?.["trialEndsAt"]) ??
      (plan.trialEndsAt ? plan.trialEndsAt.toISOString() : null),
    firstChargeAt: asIsoString(billingAutomation?.["firstChargeAt"]),
  };

  return {
    id: plan.id,
    billingPreference: toBillingPreference(plan.billingPreference),
    weekendUpgrade: Boolean(serviceOptions?.weekendUpgrade),
    cadenceDays: asNumber(billingAutomation?.["billingCadenceDays"]),
    trial: trialBounds,
    nextInvoiceAttemptAt: asIsoString(billingAutomation?.["nextInvoiceAttemptAt"]),
  };
}

export async function POST(req: NextRequest) {
  try {
    const data = schema.parse(await req.json());

    if (data.visitId) {
      const visit = await prisma.serviceVisit.findUnique({
        where: { id: data.visitId },
        include: {
          job: {
            select: {
              id: true,
              orgId: true,
              customerId: true,
              perVisitRevenueCents: true,
            },
          },
        },
      });

      if (!visit) {
        return NextResponse.json(
          { error: "visit_not_found" },
          { status: 404 },
        );
      }

      if (data.action === "reschedule") {
        if (!data.nextVisitAt) {
          return NextResponse.json(
            { error: "nextVisitAt required" },
            { status: 400 },
          );
        }
        const parsedDate = parseRequestedDate(data.nextVisitAt);
        if (!parsedDate) {
          return NextResponse.json(
            { error: "invalid_date" },
            { status: 400 },
          );
        }

        // Enforce week boundary restriction for reschedules
        const originalDate = visit.scheduledDate;
        const newDate = parsedDate.date;

        if (!isSameWeek(originalDate, newDate)) {
          const { weekStart, weekEnd } = getWeekBoundaries(originalDate);
          return NextResponse.json(
            {
              error: "reschedule_outside_week",
              message:
                "Reschedules must be within the same week as the original visit. Please skip this visit instead if you need a different week.",
              weekBoundary: {
                start: formatDateKey(weekStart),
                end: formatDateKey(weekEnd),
                originalDate: formatDateKey(originalDate),
                requestedDate: formatDateKey(newDate),
              },
            },
            { status: 400 },
          );
        }

        const normalizedWindowSlug = normalizePreferredTimeWindowSlug(
          data.preferredWindow ?? visit.preferredTimeWindowSlug ?? null,
        );
        const preferredWindowLabel = resolvePreferredTimeWindowLabel(
          normalizedWindowSlug,
          data.preferredWindow ?? visit.preferredTimeWindow ?? null,
        );

        if (parsedDate.isDateOnly) {
          if (normalizedWindowSlug) {
            const windowStart = getPreferredTimeWindowStart(normalizedWindowSlug);
            if (windowStart) {
              parsedDate.date.setHours(windowStart.hour, windowStart.minute, 0, 0);
            }
          } else {
            parsedDate.date.setHours(9, 0, 0, 0);
          }
        }
        const scheduledDate = parsedDate.date;
        const updated = await prisma.serviceVisit.update({
          where: { id: visit.id },
          data: {
            scheduledDate,
            status: ServiceStatus.SCHEDULED,
            completedDate: null,
            skipReasonId: null,
            preferredTimeWindow: preferredWindowLabel ?? visit.preferredTimeWindow ?? null,
            preferredTimeWindowSlug: normalizedWindowSlug ?? visit.preferredTimeWindowSlug ?? null,
          },
        });

        let planRecord = null as Awaited<ReturnType<typeof getPlanByJobId>> | null;
        if (visit.jobId) {
          await prisma.job.update({
            where: { id: visit.jobId },
            data: {
              nextVisitAt: scheduledDate,
              preferredTimeWindow: preferredWindowLabel ?? visit.preferredTimeWindow ?? null,
              preferredTimeWindowSlug: normalizedWindowSlug ?? visit.preferredTimeWindowSlug ?? null,
            },
          });

          // If applyToFuture is true, update all future visits to the same day of the week
          if (data.applyToFuture) {
            const newDayOfWeek = getZonedWeekday(scheduledDate, SERVICE_TIME_ZONE);

            // Find all future scheduled visits for this job (excluding the current visit)
            const futureVisits = await prisma.serviceVisit.findMany({
              where: {
                jobId: visit.jobId,
                id: { not: visit.id },
                status: ServiceStatus.SCHEDULED,
                scheduledDate: { gt: scheduledDate },
              },
              orderBy: { scheduledDate: "asc" },
            });

            // Update each future visit to the same day of the week
            for (const futureVisit of futureVisits) {
              const visitDate = futureVisit.scheduledDate;
              const currentDayOfWeek = getZonedWeekday(visitDate, SERVICE_TIME_ZONE);
              const dayDiff = newDayOfWeek - currentDayOfWeek;

              // Calculate new date by moving to the target day of week
              const newDate = new Date(visitDate);
              newDate.setDate(visitDate.getDate() + dayDiff);

              // Preserve the original time or use window start time
              if (normalizedWindowSlug) {
                const windowStart = getPreferredTimeWindowStart(normalizedWindowSlug);
                if (windowStart) {
                  newDate.setHours(windowStart.hour, windowStart.minute, 0, 0);
                }
              }

              await prisma.serviceVisit.update({
                where: { id: futureVisit.id },
                data: {
                  scheduledDate: newDate,
                  preferredTimeWindow: preferredWindowLabel ?? futureVisit.preferredTimeWindow ?? null,
                  preferredTimeWindowSlug: normalizedWindowSlug ?? futureVisit.preferredTimeWindowSlug ?? null,
                },
              });
            }
          }

          const refreshedPlan = await getPlanByJobId(visit.jobId);
          planRecord = refreshedPlan ?? null;

          if (refreshedPlan?.id) {
            await ensureTrialExtendsThroughDate({
              planId: refreshedPlan.id,
              currentTrialEndsAt: refreshedPlan.trialEndsAt ?? null,
              visitDate: scheduledDate,
            });
          }

        }

        const planContext = planRecord?.id ? await loadPlanContext(planRecord.id) : null;

        if (visit.assignedToId) {
          void sendScooperVisitUpdatePush({
            userId: visit.assignedToId,
            scheduledDate,
            action: "rescheduled",
          }).catch(() => null);
        }

        return NextResponse.json({ ok: true, visit: updated, plan: planContext });
      }

      const skipped = await prisma.serviceVisit.update({
        where: { id: visit.id },
        data: {
          status: ServiceStatus.SKIPPED,
          completedDate: null,
        },
      });

      let planContext: Awaited<ReturnType<typeof loadPlanContext>> | null = null;
      if (visit.job) {
        const nextScheduled = await prisma.serviceVisit.findFirst({
          where: {
            jobId: visit.job.id,
            status: ServiceStatus.SCHEDULED,
            scheduledDate: { gt: new Date() },
          },
          orderBy: { scheduledDate: "asc" },
          select: { scheduledDate: true },
        });

        await prisma.job.update({
          where: { id: visit.job.id },
          data: { nextVisitAt: nextScheduled?.scheduledDate ?? null },
        });

        const plan = visit.job.id ? await getPlanByJobId(visit.job.id) : null;
        const billingPreference = toBillingPreference(plan?.billingPreference) ?? "per-visit";

        if (billingPreference !== "one-time") {
          let ledgerEntries: { amountCents: number }[] = [];
          try {
            ledgerEntries = await prisma.customerBillingLedgerEntry.findMany({
              where: { serviceVisitId: visit.id },
              select: { amountCents: true },
            });
          } catch (error: any) {
            if (error?.code !== "P2021") {
              throw error;
            }
          }

          const hasCharge = ledgerEntries.some((entry) => entry.amountCents > 0);
          const hasCredit = ledgerEntries.some((entry) => entry.amountCents < 0);
          const shouldCredit = billingPreference === "monthly" || hasCharge;

          if (!hasCredit && shouldCredit) {
            const amountCents = plan?.perVisitAmountCents ?? visit.job.perVisitRevenueCents ?? 0;
            if (amountCents > 0) {
              try {
                await createCreditEntry({
                  orgId: visit.job.orgId ?? "yardura",
                  jobId: visit.job.id,
                  customerId: visit.job.customerId,
                  amountCents,
                  description: "Skipped visit credit",
                  serviceVisitId: visit.id,
                  metadata: {
                    source: "customer-skip",
                  },
                });
                await processPendingLedgerEntriesForJob(visit.job.id);
              } catch (error: any) {
                if (error?.code !== "P2021") {
                  throw error;
                }
              }
            }
          }

          if (plan?.id) {
            planContext = await loadPlanContext(plan.id);
          }
        }
      }

      if (visit.assignedToId) {
        void sendScooperVisitUpdatePush({
          userId: visit.assignedToId,
          scheduledDate: visit.scheduledDate,
          action: "skipped",
        }).catch(() => null);
      }

      return NextResponse.json({ ok: true, visit: skipped, plan: planContext });
    }

    // Legacy job-based behaviour fallback
    if (data.action === "reschedule") {
      if (!data.nextVisitAt) {
        return NextResponse.json(
          { error: "nextVisitAt required" },
          { status: 400 },
        );
      }
      const nextVisitAt = new Date(data.nextVisitAt);
      await prisma.job.update({
        where: { id: data.jobId! },
        data: { nextVisitAt },
      });

      let planContext: Awaited<ReturnType<typeof loadPlanContext>> | null = null;
      try {
        const jobPlan = await prisma.customerBillingPlan.findFirst({
          where: { jobId: data.jobId! },
          select: {
            id: true,
            trialEndsAt: true,
          },
        });

        if (jobPlan?.id) {
          await ensureTrialExtendsThroughDate({
            planId: jobPlan.id,
            currentTrialEndsAt: jobPlan.trialEndsAt,
            visitDate: nextVisitAt,
          });
          planContext = await loadPlanContext(jobPlan.id);
        }
      } catch (error: any) {
        if (error?.code !== "P2021") {
          throw error;
        }
      }

      return NextResponse.json({ ok: true, plan: planContext });
    }

    if (data.action === "skip") {
      await prisma.job.update({
        where: { id: data.jobId! },
        data: { nextVisitAt: null },
      });
      let planContext: Awaited<ReturnType<typeof loadPlanContext>> | null = null;
      try {
        const jobPlan = await prisma.customerBillingPlan.findFirst({
          where: { jobId: data.jobId! },
          select: { id: true },
        });
        planContext = jobPlan ? await loadPlanContext(jobPlan.id) : null;
      } catch (error: any) {
        if (error?.code !== "P2021") {
          throw error;
        }
      }

      return NextResponse.json({ ok: true, plan: planContext });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "validation_failed", details: error.flatten() },
        { status: 422 },
      );
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}

export const runtime = "nodejs";
