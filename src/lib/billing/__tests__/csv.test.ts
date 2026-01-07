import { describe, expect, it } from "vitest";

import { ledgerEntriesToCsv, type LedgerCsvRow } from "@/lib/billing/csv";

describe("ledgerEntriesToCsv", () => {
  it("serializes ledger rows with proper escaping", () => {
    const rows: LedgerCsvRow[] = [
      {
        createdAt: "2025-04-01T15:30:00Z",
        type: "CHARGE",
        status: "PENDING",
        amountCents: 1700,
        amount: "$17.00",
        description: "Service visit charge",
        customerId: "cust_1",
        jobId: "job_1",
        serviceVisitId: "visit_1",
        stripeInvoiceId: null,
        quickBooksStatus: "pending",
        quickBooksNote: "Waiting on credentials",
        quickBooksLastAttempt: "2025-04-01T16:00:00Z",
      },
      {
        createdAt: "2025-04-02T12:00:00Z",
        type: "CREDIT",
        status: "VOID",
        amountCents: -500,
        amount: "-$5.00",
        description: "Manual credit, missed visit",
        customerId: "cust_2",
        jobId: "job_2",
        serviceVisitId: null,
        stripeInvoiceId: "in_123",
        quickBooksStatus: "queued",
        quickBooksNote: "Queued for sync",
        quickBooksLastAttempt: "2025-04-02T13:00:00Z",
      },
    ];

    const csv = ledgerEntriesToCsv(rows).split("\n");

    expect(csv[0]).toBe(
      "created_at,type,status,amount_cents,amount,description,customer_id,job_id,service_visit_id,stripe_invoice_id,quickbooks_status,quickbooks_note,quickbooks_last_attempt",
    );
    expect(csv[1]).toBe(
      "2025-04-01T15:30:00Z,CHARGE,PENDING,1700,$17.00,Service visit charge,cust_1,job_1,visit_1,,pending,Waiting on credentials,2025-04-01T16:00:00Z",
    );
    expect(csv[2]).toBe(
      "2025-04-02T12:00:00Z,CREDIT,VOID,-500,-$5.00,\"Manual credit, missed visit\",cust_2,job_2,,in_123,queued,Queued for sync,2025-04-02T13:00:00Z",
    );
  });
});

