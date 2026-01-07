import {
  BillingLedgerEntryStatus,
  BillingLedgerEntryType,
  PayoutStatus,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { enqueueBillingInvoiceJob } from "@/lib/jobs/billingInvoiceQueue";
import { processPendingLedgerEntriesForJob } from "./invoice-processor";

import type { LedgerEntryInput, VisitChargeContext } from "./types";

const toJsonValue = (value?: Record<string, unknown> | null) =>
  (value ?? Prisma.JsonNull) as Prisma.InputJsonValue;

const toObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return { ...(value as Record<string, unknown>) };
};

type VoidContext =
  | string
  | {
      reason?: string | null;
      actorId?: string | null;
      actorName?: string | null;
    };

export async function createLedgerEntry(input: LedgerEntryInput) {
  const { orgId, jobId, customerId, amountCents, type, description, serviceVisitId, metadata } =
    input;

  if (!Number.isFinite(amountCents) || amountCents === 0) {
    return null;
  }

  const entry = await prisma.customerBillingLedgerEntry.create({
    data: {
      orgId,
      jobId,
      customerId,
      amountCents: Math.trunc(amountCents),
      type: type as BillingLedgerEntryType,
      description: description ?? null,
      serviceVisitId: serviceVisitId ?? null,
      metadata: toJsonValue(metadata),
    },
  });

  if (entry) {
    void triggerInvoiceEvaluation(entry.jobId, {
      source: input.type,
      entryId: entry.id,
      metadata: input.metadata ?? null,
    });
  }

  return entry;
}

export async function createChargeEntry(input: Omit<LedgerEntryInput, "type">) {
  return createLedgerEntry({ ...input, type: "CHARGE" });
}

export async function createCreditEntry(input: Omit<LedgerEntryInput, "type">) {
  return createLedgerEntry({
    ...input,
    type: "CREDIT",
    amountCents: -Math.abs(input.amountCents),
  });
}

export async function createVisitChargeEntry(context: VisitChargeContext) {
  const {
    orgId,
    jobId,
    customerId,
    serviceVisitId,
    amountCents,
    billingPreference,
    serviceFrequency,
    weekendUpgrade,
  } = context;

  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return null;
  }

  if (billingPreference === "monthly") {
    return null;
  }

  return createChargeEntry({
    orgId,
    jobId,
    customerId,
    amountCents,
    description: "Service visit charge",
    serviceVisitId,
    metadata: {
      billingPreference,
      source: "service-completion",
      serviceFrequency: serviceFrequency ?? null,
      weekendUpgrade: weekendUpgrade ?? false,
    },
  });
}

export async function getPendingLedgerEntriesForJob(jobId: string) {
  return prisma.customerBillingLedgerEntry.findMany({
    where: {
      jobId,
      status: BillingLedgerEntryStatus.PENDING,
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function attachInvoiceReference(
  entryId: string,
  invoiceId: string,
  invoiceItemId: string,
) {
  return prisma.customerBillingLedgerEntry.update({
    where: { id: entryId },
    data: {
      stripeInvoiceId: invoiceId,
      stripeInvoiceItemId: invoiceItemId,
    },
  });
}

export async function markEntriesApplied(entryIds: string[], invoiceId: string) {
  if (!entryIds.length) return;

  await prisma.customerBillingLedgerEntry.updateMany({
    where: {
      id: { in: entryIds },
    },
    data: {
      status: BillingLedgerEntryStatus.APPLIED,
      appliedAt: new Date(),
      stripeInvoiceId: invoiceId,
    },
  });

  // Customer billing no longer gates scooper payouts; QA approval does.
}

export async function resetEntriesForFailedInvoice(invoiceId: string) {
  const entries = await prisma.customerBillingLedgerEntry.findMany({
    where: {
      stripeInvoiceId: invoiceId,
      status: BillingLedgerEntryStatus.PENDING,
    },
    select: { id: true },
  });

  if (!entries.length) return;

  await prisma.customerBillingLedgerEntry.updateMany({
    where: {
      id: { in: entries.map((entry) => entry.id) },
    },
    data: {
      stripeInvoiceId: null,
      stripeInvoiceItemId: null,
    },
  });
}

export async function voidLedgerEntries(entryIds: string[], context?: VoidContext) {
  if (!entryIds.length) return;

  const reason = typeof context === "string" ? context : context?.reason ?? null;
  const actorId = typeof context === "object" ? context.actorId ?? null : null;
  const actorName = typeof context === "object" ? context.actorName ?? null : null;

  const now = new Date();

  await prisma.customerBillingLedgerEntry.updateMany({
    where: { id: { in: entryIds } },
    data: {
      status: BillingLedgerEntryStatus.VOID,
      voidedAt: now,
    },
  });

  const affectedEntries = await prisma.customerBillingLedgerEntry.findMany({
    where: { id: { in: entryIds } },
    select: {
      id: true,
      metadata: true,
      serviceVisitId: true,
    },
  });

  if (affectedEntries.length) {
    const metadataUpdates = affectedEntries.map((entry) => {
      const baseMetadata = toObject(entry.metadata ?? {});
      const existingVoid = toObject(baseMetadata["adminVoid"]);

      const adminVoid = {
        ...existingVoid,
        reason: reason ?? existingVoid.reason ?? null,
        actorId: actorId ?? existingVoid.actorId ?? null,
        actorName: actorName ?? existingVoid.actorName ?? null,
        voidedAt: now.toISOString(),
      } as Record<string, unknown>;

      const nextMetadata: Record<string, unknown> = {
        ...baseMetadata,
        adminVoid,
      };

      return prisma.customerBillingLedgerEntry.update({
        where: { id: entry.id },
        data: {
          metadata: toJsonValue(nextMetadata),
        },
      });
    });

    if (metadataUpdates.length) {
      await prisma.$transaction(metadataUpdates);
    }
  }

  const entriesWithVisits = affectedEntries.filter((entry) => entry.serviceVisitId);

  if (entriesWithVisits.length) {
    const visitIds = entriesWithVisits
      .map((entry) => entry.serviceVisitId)
      .filter((visitId): visitId is string => Boolean(visitId));

    if (visitIds.length) {
      await prisma.visitPayout.updateMany({
        where: {
          serviceVisitId: { in: visitIds },
          status: { in: [PayoutStatus.PENDING_REVIEW, PayoutStatus.READY] },
        },
        data: {
          status: PayoutStatus.VOID,
        },
      });
    }
  }
}

export async function findLedgerEntriesByInvoice(invoiceId: string) {
  return prisma.customerBillingLedgerEntry.findMany({
    where: { stripeInvoiceId: invoiceId },
  });
}

async function triggerInvoiceEvaluation(
  jobId: string,
  context: {
    source: string;
    entryId: string;
    metadata?: Record<string, unknown> | null;
  },
) {
  const metadataSource =
    context.metadata &&
    typeof context.metadata === "object" &&
    !Array.isArray(context.metadata)
      ? (context.metadata.source as string | undefined)
      : undefined;

  if (metadataSource === "monthly-recurring") {
    return;
  }

  try {
    const result = await processPendingLedgerEntriesForJob(jobId);
    if (result.status === "deferred") {
      const delay = Math.max(result.retryAt.getTime() - Date.now(), 60 * 1000);
      await enqueueBillingInvoiceJob(
        { jobId, reason: "deferred" },
        { delay },
      );
      console.info("[billing] invoice deferred", {
        jobId,
        entryId: context.entryId,
        retryAt: result.retryAt.toISOString(),
      });
    }
  } catch (error) {
    console.error("[billing] invoice evaluation failed", {
      jobId,
      entryId: context.entryId,
      source: context.source,
      error,
    });
    await enqueueBillingInvoiceJob(
      { jobId, reason: "retry" },
      { delay: 5 * 60 * 1000 },
    );
  }
}
