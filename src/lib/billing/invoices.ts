import type Stripe from "stripe";

import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

import {
  attachInvoiceReference,
  createChargeEntry,
  findLedgerEntriesByInvoice,
  getPendingLedgerEntriesForJob,
  markEntriesApplied,
  resetEntriesForFailedInvoice,
} from "./ledger";
import { getPlanBySubscriptionId } from "./plan";

export async function syncInvoiceWithLedger(invoice: Stripe.Invoice) {
  const subscriptionRef = (invoice as any).subscription as
    | string
    | Stripe.Subscription
    | null
    | undefined;
  const subscriptionId =
    typeof subscriptionRef === "string"
      ? subscriptionRef
      : subscriptionRef?.id ?? null;

  if (!subscriptionId) return;

  const plan = await getPlanBySubscriptionId(subscriptionId);
  if (!plan) return;

  const pendingEntries = await getPendingLedgerEntriesForJob(plan.jobId);
  if (!pendingEntries.length) return;

  const entriesToAttach = pendingEntries.filter((entry) => {
    if (!entry.stripeInvoiceId) return true;
    return entry.stripeInvoiceId === invoice.id;
  });

  if (!entriesToAttach.length) return;

  const customerRef = invoice.customer as string | Stripe.Customer | null | undefined;
  const customerId =
    typeof customerRef === "string"
      ? customerRef
      : customerRef?.id ?? null;

  if (!customerId) return;

  const invoiceId: string = invoice.id ?? "";
  if (!invoiceId) return;

  for (const entry of entriesToAttach) {
    if (!entry.amountCents || entry.amountCents === 0) continue;

    const invoiceItem = await stripe.invoiceItems.create({
      customer: customerId,
      invoice: invoiceId,
      amount: entry.amountCents,
      currency: invoice.currency || "usd",
      description: entry.description ?? defaultDescription(entry),
      metadata: {
        ledgerEntryId: entry.id,
        jobId: entry.jobId,
        type: entry.type,
      },
    });

    await attachInvoiceReference(entry.id, invoiceId, invoiceItem.id);
  }
}

export async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const invoiceId = invoice.id ?? "";
  if (!invoiceId) return;

  const entries = await findLedgerEntriesByInvoice(invoiceId);
  if (!entries.length) return;

  await markEntriesApplied(
    entries.map((entry) => entry.id),
    invoiceId,
  );
}

export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const invoiceId = invoice.id ?? "";
  if (!invoiceId) return;
  await resetEntriesForFailedInvoice(invoiceId);
}

function defaultDescription(entry: {
  type: string;
  serviceVisitId: string | null;
}) {
  if (entry.type === "CREDIT") {
    return "Service credit";
  }
  if (entry.serviceVisitId) {
    return "Service visit charge";
  }
  return "Service charge";
}
