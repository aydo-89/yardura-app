export interface LedgerCsvRow {
  createdAt: string;
  type: string;
  status: string;
  amountCents: number;
  amount: string;
  description: string;
  customerId: string;
  jobId: string;
  serviceVisitId: string | null;
  stripeInvoiceId: string | null;
  quickBooksStatus: string | null;
  quickBooksNote: string | null;
  quickBooksLastAttempt: string | null;
}

const CSV_HEADERS = [
  "created_at",
  "type",
  "status",
  "amount_cents",
  "amount",
  "description",
  "customer_id",
  "job_id",
  "service_visit_id",
  "stripe_invoice_id",
  "quickbooks_status",
  "quickbooks_note",
  "quickbooks_last_attempt",
];

function escapeCsv(value: string | number | null | undefined): string {
  if (value == null) return "";
  const stringValue = String(value);
  if (stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  if (/[\n,]/.test(stringValue)) {
    return `"${stringValue}"`;
  }
  return stringValue;
}

export function ledgerEntriesToCsv(rows: LedgerCsvRow[]): string {
  const headerLine = CSV_HEADERS.join(",");
  const lines = rows.map((row) => {
    return [
      row.createdAt,
      row.type,
      row.status,
      row.amountCents,
      row.amount,
      row.description,
      row.customerId,
      row.jobId,
      row.serviceVisitId ?? "",
      row.stripeInvoiceId ?? "",
      row.quickBooksStatus ?? "",
      row.quickBooksNote ?? "",
      row.quickBooksLastAttempt ?? "",
    ]
      .map((value) => escapeCsv(value))
      .join(",");
  });

  return [headerLine, ...lines].join("\n");
}
