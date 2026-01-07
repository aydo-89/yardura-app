import { randomUUID } from "crypto";

import {
  BillingLedgerEntryStatus,
  Prisma,
  type CustomerBillingLedgerEntry,
} from "@prisma/client";
import type Stripe from "stripe";

import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { createChargeEntry } from "@/lib/billing/ledger";

const DAY_MS = 24 * 60 * 60 * 1000;
const TRIAL_SETTLEMENT_BUFFER_MS = 12 * 60 * 60 * 1000; // 12 hours

function toMetadataObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

async function ensureMonthlyBaseLedgerEntry(options: {
  plan: Awaited<
    ReturnType<typeof prisma.customerBillingPlan.findUnique>
  >;
  metadata: Record<string, unknown> | null;
  now: Date;
}) {
  const { plan, metadata, now } = options;

  if (!plan || plan.billingPreference !== "monthly") {
    return;
  }

  const recurringAmountCents = plan.recurringAmountCents ?? null;
  if (!recurringAmountCents || recurringAmountCents <= 0) {
    return;
  }

  const billingAutomation = toMetadataObject(metadata?.billingAutomation);

  const cadenceDays = Number(
    billingAutomation?.billingCadenceDays ?? 30,
  );
  const cadenceMs = Math.max(cadenceDays, 1) * DAY_MS;

  let lastBaseAt = (() => {
    const raw = billingAutomation?.lastBaseEntryAt;
    if (typeof raw === "string") {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    return null;
  })();

  if (!lastBaseAt) {
    const recentBase = await prisma.customerBillingLedgerEntry.findFirst({
      where: {
        jobId: plan.jobId,
        description: "Monthly plan base charge",
      },
      orderBy: { createdAt: "desc" },
    });

    if (recentBase) {
      lastBaseAt = recentBase.createdAt;
      await updatePlanMetadata(plan.id, {
        lastBaseEntryAt: recentBase.createdAt.toISOString(),
      });
    }
  }

  const firstChargeAt = (() => {
    const raw = billingAutomation?.firstChargeAt;
    if (typeof raw === "string") {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    return null;
  })();

  const trialEndsAt = plan.trialEndsAt;
  const trialBuffer = trialEndsAt
    ? new Date(trialEndsAt.getTime() + TRIAL_SETTLEMENT_BUFFER_MS)
    : null;

  const earliestCharge = firstChargeAt || trialBuffer || now;
  if (earliestCharge.getTime() > now.getTime()) {
    return;
  }

  if (
    lastBaseAt &&
    lastBaseAt.getTime() + cadenceMs > now.getTime()
  ) {
    return;
  }

  await createChargeEntry({
    orgId: plan.orgId,
    jobId: plan.jobId,
    customerId: plan.customerId,
    amountCents: recurringAmountCents,
    description: "Monthly plan base charge",
    metadata: {
      source: "monthly-base",
    },
  });

  await updatePlanMetadata(plan.id, {
    lastBaseEntryAt: now.toISOString(),
  });
}

type ProcessResult =
  | { status: "no-plan" }
  | { status: "missing-customer" }
  | { status: "nothing-to-invoice" }
  | {
      status: "deferred";
      reason: "trial-active" | "cycle-wait";
      retryAt: Date;
    }
  | {
      status: "invoiced";
      invoiceId: string;
      entryCount: number;
      totalAmountCents: number;
    };

function normalizeDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

type InvoiceLine = {
  amountCents: number;
  description: string;
  entryIds: string[];
};

function resolveEntryDescription(entry: CustomerBillingLedgerEntry) {
  if (entry.description) {
    return entry.description;
  }

  if (entry.type === "CREDIT") {
    return "Service credit";
  }

  if (entry.serviceVisitId) {
    return "Service visit charge";
  }

  return "Service charge";
}

function buildInvoiceLines(
  plan: { billingPreference: string | null },
  entries: CustomerBillingLedgerEntry[],
  billingAutomation: Record<string, unknown> | null,
): InvoiceLine[] {
  if (!entries.length) {
    return [];
  }

  if (plan.billingPreference !== "monthly") {
    if (plan.billingPreference === "weekly" || plan.billingPreference === "per-visit") {
      return buildWeeklyInvoiceLines(entries, billingAutomation);
    }

    return entries.map((entry) => ({
      amountCents: entry.amountCents,
      description: resolveEntryDescription(entry),
      entryIds: [entry.id],
    }));
  }

  const positiveEntries = entries.filter((entry) => entry.amountCents > 0);
  const negativeEntries = entries.filter((entry) => entry.amountCents < 0);

  const lines: InvoiceLine[] = [];

  if (positiveEntries.length) {
    const total = positiveEntries.reduce((sum, entry) => sum + entry.amountCents, 0);
    const baseDescription =
      positiveEntries.length === 1
        ? resolveEntryDescription(positiveEntries[0])
        : "Monthly plan charges";

    lines.push({
      amountCents: total,
      description: baseDescription,
      entryIds: positiveEntries.map((entry) => entry.id),
    });
  }

  if (negativeEntries.length) {
    const total = negativeEntries.reduce((sum, entry) => sum + entry.amountCents, 0);
    const creditDescription =
      negativeEntries.length === 1
        ? resolveEntryDescription(negativeEntries[0])
        : "Service credits";

    lines.push({
      amountCents: total,
      description: creditDescription,
      entryIds: negativeEntries.map((entry) => entry.id),
    });
  }

  return lines;
}

function parseAutomationDate(value: unknown): Date | null {
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
}

function buildWeeklyInvoiceLines(
  entries: CustomerBillingLedgerEntry[],
  billingAutomation: Record<string, unknown> | null,
): InvoiceLine[] {
  const cadenceDays = (() => {
    const raw = billingAutomation?.billingCadenceDays;
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return Math.max(1, raw);
    }
    if (typeof raw === "string" && raw.trim()) {
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? Math.max(1, parsed) : 7;
    }
    return 7;
  })();

  const cadenceMs = cadenceDays * DAY_MS;

  const positiveEntries = entries.filter((entry) => entry.amountCents > 0);
  const creditEntries = entries.filter((entry) => entry.amountCents < 0);

  const metadataAnchor =
    parseAutomationDate(billingAutomation?.trialStartsAt) ??
    parseAutomationDate(billingAutomation?.activationStartsAt) ??
    null;

  const fallbackAnchor = (() => {
    if (!positiveEntries.length) {
      return null;
    }
    return positiveEntries.reduce<Date | null>((current, entry) => {
      const createdAt = entry.createdAt ? new Date(entry.createdAt) : new Date();
      const normalized = normalizeDate(createdAt);
      if (!current || normalized.getTime() < current.getTime()) {
        return normalized;
      }
      return current;
    }, null);
  })();

  const anchor = metadataAnchor ?? fallbackAnchor;

  const cycleGroups = new Map<
    string,
    {
      start: Date;
      total: number;
      entryIds: string[];
      visitCount: number;
      weekendUpgrade: boolean;
      serviceFrequency: string | null;
    }
  >();

  for (const entry of positiveEntries) {
    const createdAt = entry.createdAt ? new Date(entry.createdAt) : new Date();
    const cycleStart = resolveCycleStart(createdAt, cadenceMs, anchor);
    const key = cycleStart.toISOString();

    const entryMetadata = toMetadataObject(entry.metadata);
    const entryWeekend = Boolean(entryMetadata?.weekendUpgrade);
    const entryFrequency = typeof entryMetadata?.serviceFrequency === "string"
      ? entryMetadata.serviceFrequency
      : null;

    const existing = cycleGroups.get(key) ?? {
      start: cycleStart,
      total: 0,
      entryIds: [],
      visitCount: 0,
      weekendUpgrade: false,
      serviceFrequency: entryFrequency ?? null,
    };

    existing.total += entry.amountCents;
    existing.entryIds.push(entry.id);
    existing.visitCount += 1;
    if (entryWeekend) {
      existing.weekendUpgrade = true;
    }
    if (!existing.serviceFrequency && entryFrequency) {
      existing.serviceFrequency = entryFrequency;
    }

    cycleGroups.set(key, existing);
  }

  const lines: InvoiceLine[] = [];

  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });

  const sortedCycles = Array.from(cycleGroups.values()).sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );

  for (const cycle of sortedCycles) {
    const cycleEnd = new Date(cycle.start.getTime() + (cadenceDays - 1) * DAY_MS);
    const startLabel = formatter.format(cycle.start);
    const endLabel = cadenceDays > 1 ? formatter.format(cycleEnd) : null;
    const visitLabel = `${cycle.visitCount} visit${cycle.visitCount === 1 ? "" : "s"}`;
    const frequencyName = cycle.serviceFrequency
      ? String(cycle.serviceFrequency).toLowerCase()
      : null;
    const isDaily = frequencyName === "daily";
    const coverageLabel = isDaily
      ? cycle.weekendUpgrade
        ? "Mon–Sun coverage"
        : "Mon–Fri coverage"
      : null;
    const descriptorSuffix = coverageLabel ? `${visitLabel}; ${coverageLabel}` : visitLabel;
    const description = endLabel
      ? `Service visits - Cycle ${startLabel} to ${endLabel} (${descriptorSuffix})`
      : `Service visits - Cycle starting ${startLabel} (${descriptorSuffix})`;

    lines.push({
      amountCents: cycle.total,
      description,
      entryIds: cycle.entryIds,
    });
  }

  if (creditEntries.length) {
    const creditTotal = creditEntries.reduce(
      (sum, entry) => sum + entry.amountCents,
      0,
    );
    const creditDescription =
      creditEntries.length === 1
        ? resolveEntryDescription(creditEntries[0])
        : "Service credits";

    lines.push({
      amountCents: creditTotal,
      description: creditDescription,
      entryIds: creditEntries.map((entry) => entry.id),
    });
  }

  return lines.length ? lines : entries.map((entry) => ({
    amountCents: entry.amountCents,
    description: resolveEntryDescription(entry),
    entryIds: [entry.id],
  }));
}

function resolveCycleStart(date: Date, cadenceMs: number, anchor: Date | null) {
  const normalizedDate = normalizeDate(date);
  const normalizedAnchor = anchor ? normalizeDate(anchor) : normalizeDate(date);

  if (cadenceMs <= 0) {
    return anchor ? normalizedAnchor : normalizedDate;
  }

  if (!anchor) {
    const cyclesFromEpoch = Math.floor(normalizedDate.getTime() / cadenceMs);
    return new Date(cyclesFromEpoch * cadenceMs);
  }

  const offsetMs = normalizedDate.getTime() - normalizedAnchor.getTime();
  const cycles = Math.floor(offsetMs / cadenceMs);
  const cycleStartMs = normalizedAnchor.getTime() + cycles * cadenceMs;
  return new Date(cycleStartMs);
}

export async function processPendingLedgerEntriesForJob(
  jobId: string,
  options?: { force?: boolean; now?: Date },
): Promise<ProcessResult> {
  const now = options?.now ?? new Date();

  const plan = await prisma.customerBillingPlan.findUnique({
    where: { jobId },
    include: {
      customer: {
        select: {
          id: true,
          user: {
            select: {
              stripeCustomerId: true,
            },
          },
        },
      },
    },
  });

  if (!plan) {
    return { status: "no-plan" };
  }

  let stripeCustomerId = plan.stripeCustomerId;

  if (!stripeCustomerId) {
    stripeCustomerId = plan.customer?.user?.stripeCustomerId ?? null;
    if (stripeCustomerId) {
      await prisma.customerBillingPlan.update({
        where: { id: plan.id },
        data: { stripeCustomerId },
      });
    }
  }

  if (!stripeCustomerId) {
    return { status: "missing-customer" };
  }

  const metadata =
    plan.metadata && typeof plan.metadata === "object" && !Array.isArray(plan.metadata)
      ? (plan.metadata as Record<string, unknown>)
      : null;
  const billingAutomation =
    metadata && typeof metadata.billingAutomation === "object"
      ? (metadata.billingAutomation as Record<string, unknown>)
      : null;

  const firstChargeAt = (() => {
    const value = billingAutomation?.firstChargeAt;
    if (typeof value === "string") {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  })();

  const lastInvoiceAt = (() => {
    const value = billingAutomation?.lastInvoiceAt;
    if (typeof value === "string") {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  })();

  const cadenceDays = (() => {
    const raw = billingAutomation?.billingCadenceDays;
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return raw;
    }
    if (typeof raw === "string" && raw.trim()) {
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  })();

  const cadenceMs = cadenceDays ? Math.max(cadenceDays, 1) * DAY_MS : null;

  if (!options?.force) {
    const gatingTimes: number[] = [];
    if (plan.trialEndsAt) {
      gatingTimes.push(plan.trialEndsAt.getTime() + TRIAL_SETTLEMENT_BUFFER_MS);
    }
    if (firstChargeAt) {
      gatingTimes.push(firstChargeAt.getTime());
    }

    if (gatingTimes.length) {
      const eligibleAt = Math.max(...gatingTimes);
      if (eligibleAt > now.getTime()) {
        const retryAt = new Date(eligibleAt);
        await updatePlanMetadata(plan.id, {
          nextInvoiceAttemptAt: retryAt.toISOString(),
        });

        return {
          status: "deferred",
          reason: "trial-active",
          retryAt,
        };
      }
    }

    if (
      (plan.billingPreference === "weekly" || plan.billingPreference === "per-visit") &&
      cadenceMs &&
      lastInvoiceAt &&
      lastInvoiceAt.getTime() + cadenceMs > now.getTime()
    ) {
      const retryAt = new Date(lastInvoiceAt.getTime() + cadenceMs);
      await updatePlanMetadata(plan.id, {
        nextInvoiceAttemptAt: retryAt.toISOString(),
      });

      return {
        status: "deferred",
        reason: "cycle-wait",
        retryAt,
      };
    }
  }

  await ensureMonthlyBaseLedgerEntry({
    plan,
    metadata,
    now,
  });

  const batchToken = `batch_${randomUUID()}`;

  const entries = await prisma.$transaction(async (tx) => {
    const pending = await tx.customerBillingLedgerEntry.findMany({
      where: {
        jobId,
        status: BillingLedgerEntryStatus.PENDING,
        stripeInvoiceId: null,
      },
      orderBy: { createdAt: "asc" },
    });

    if (!pending.length) {
      return [];
    }

    await tx.customerBillingLedgerEntry.updateMany({
      where: { id: { in: pending.map((entry) => entry.id) } },
      data: { stripeInvoiceId: batchToken },
    });

    return pending;
  });

  if (!entries.length) {
    return { status: "nothing-to-invoice" };
  }

  const invoiceLines = buildInvoiceLines(plan, entries, billingAutomation);

  const hasCharge = invoiceLines.some((line) => line.amountCents > 0);
  if (!hasCharge) {
    await prisma.customerBillingLedgerEntry.updateMany({
      where: {
        id: { in: entries.map((entry) => entry.id) },
      },
      data: {
        stripeInvoiceId: null,
        stripeInvoiceItemId: null,
      },
    });
    return { status: "nothing-to-invoice" };
  }

  let draftInvoice: Stripe.Invoice | null = null;

  try {
    draftInvoice = await stripe.invoices.create({
      customer: stripeCustomerId,
      collection_method: "charge_automatically",
      pending_invoice_items_behavior: "exclude",
      metadata: {
        jobId,
        billingPlanId: plan.id,
        billingPreference: plan.billingPreference,
      },
    });

    if (!draftInvoice) {
      throw new Error("Failed to initialize draft invoice");
    }

    const invoice: Stripe.Invoice = draftInvoice;
    const invoiceId = invoice.id as string;
    let totalAmountCents = 0;

    for (const line of invoiceLines) {
      totalAmountCents += line.amountCents;

      const invoiceItem = await stripe.invoiceItems.create({
        customer: stripeCustomerId,
        invoice: invoiceId,
        amount: line.amountCents,
        currency: invoice.currency || "usd",
        description: line.description,
        metadata: {
          ledgerEntryId: line.entryIds[0] ?? null,
          ledgerEntryIds: line.entryIds.join(","),
          jobId,
          sourceType: line.amountCents >= 0 ? "CHARGE" : "CREDIT",
        },
      });

      await prisma.customerBillingLedgerEntry.updateMany({
        where: { id: { in: line.entryIds } },
        data: {
          stripeInvoiceId: invoiceId,
          stripeInvoiceItemId: invoiceItem.id,
        },
      });
    }

    const finalized = await stripe.invoices.finalizeInvoice(invoiceId, {
      auto_advance: true,
    });

    await updatePlanMetadata(plan.id, {
      nextInvoiceAttemptAt: null,
      lastInvoiceAt: new Date().toISOString(),
    });

    const finalizedId = finalized.id as string;

    return {
      status: "invoiced",
      invoiceId: finalizedId,
      entryCount: entries.length,
      totalAmountCents,
    };
  } catch (error) {
    await prisma.customerBillingLedgerEntry.updateMany({
      where: {
        id: { in: entries.map((entry) => entry.id) },
      },
      data: {
        stripeInvoiceId: null,
        stripeInvoiceItemId: null,
      },
    });

    if (draftInvoice?.id) {
      try {
        if (draftInvoice.status === "draft") {
          await stripe.invoices.del(draftInvoice.id);
        } else if (draftInvoice.status === "open") {
          await stripe.invoices.voidInvoice(draftInvoice.id);
        }
      } catch (voidError) {
        console.error("[billing] failed to clean up draft invoice", {
          invoiceId: draftInvoice.id,
          error: voidError,
        });
      }
    }
    throw error;
  }
}

export async function ensureTrialExtendsThroughDate(options: {
  planId: string;
  currentTrialEndsAt: Date | null;
  visitDate: Date;
  bufferDays?: number;
}): Promise<Date | null> {
  const bufferDays = options.bufferDays ?? 1;
  const visitDay = normalizeDate(options.visitDate);
  const requiredEnd = new Date(
    visitDay.getTime() + (bufferDays + 1) * DAY_MS,
  );

  if (
    options.currentTrialEndsAt &&
    options.currentTrialEndsAt.getTime() >= requiredEnd.getTime()
  ) {
    return options.currentTrialEndsAt;
  }

  const updated = await prisma.customerBillingPlan.update({
    where: { id: options.planId },
    data: { trialEndsAt: requiredEnd },
    select: { trialEndsAt: true },
  });

  await updatePlanMetadata(options.planId, {
    nextInvoiceAttemptAt: requiredEnd.toISOString(),
  });

  return updated.trialEndsAt;
}

async function updatePlanMetadata(
  planId: string,
  updates: Record<string, string | null>,
) {
  const plan = await prisma.customerBillingPlan.findUnique({
    where: { id: planId },
    select: { metadata: true },
  });

  const base =
    plan?.metadata && typeof plan.metadata === "object" && !Array.isArray(plan.metadata)
      ? { ...(plan.metadata as Record<string, unknown>) }
      : {};

  const nextMetadata: Record<string, unknown> = {
    ...base,
    billingAutomation: {
      ...(typeof base.billingAutomation === "object" && base.billingAutomation
        ? (base.billingAutomation as Record<string, unknown>)
        : {}),
      ...updates,
    },
  };

  await prisma.customerBillingPlan.update({
    where: { id: planId },
    data: {
      metadata: (nextMetadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    },
  });
}
