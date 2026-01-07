import type { BillingLedgerEntryStatus, BillingLedgerEntryType } from "@prisma/client";

const formatCurrencyFromCents = (cents: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
};

interface LedgerItem {
  id: string;
  type: BillingLedgerEntryType;
  status: BillingLedgerEntryStatus;
  amountCents: number;
  description: string | null;
  createdAt: string;
  appliedAt: string | null;
}

interface Props {
  entries: LedgerItem[];
}

const statusText: Record<BillingLedgerEntryStatus, string> = {
  PENDING: "Pending",
  APPLIED: "Applied",
  VOID: "Voided",
};

export default function MobileLedgerList({ entries }: Props) {
  if (!entries.length) {
    return (
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-sm text-slate-400">
        Ledger is empty. Charges appear here once service begins.
      </section>
    );
  }

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl divide-y divide-slate-800">
      {entries.map((entry) => {
        const amountClass =
          entry.amountCents >= 0 ? "text-amber-200" : "text-emerald-300";
        return (
          <article key={entry.id} className="p-4 space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <p className={`${amountClass} font-semibold`}>
                {formatCurrencyFromCents(entry.amountCents)}
              </p>
              <span className="text-xs text-slate-500">
                {statusText[entry.status]}
              </span>
            </div>
            <p className="text-slate-200">
              {entry.description ?? (entry.amountCents >= 0 ? "Charge" : "Credit")}
            </p>
            <p className="text-xs text-slate-500">
              Posted {new Date(entry.createdAt).toLocaleDateString()}
              {entry.appliedAt ? ` • Applied ${new Date(entry.appliedAt).toLocaleDateString()}` : ""}
            </p>
          </article>
        );
      })}
    </section>
  );
}
