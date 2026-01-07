const formatCurrencyFromCents = (cents: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
};

interface Props {
  balanceDueCents: number;
  pendingCents: number;
}

export default function MobileBillingSummary({ balanceDueCents, pendingCents }: Props) {
  const balanceClass = balanceDueCents > 0 ? "text-amber-300" : "text-emerald-300";

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Balance
          </p>
          <p className={`text-2xl font-semibold ${balanceClass}`}>
            {formatCurrencyFromCents(balanceDueCents)}
          </p>
        </div>
        <div className="text-right text-xs text-slate-400">
          <p>Pending: {formatCurrencyFromCents(pendingCents)}</p>
        </div>
      </div>
      <p className="text-xs text-slate-400">
        Charges finalize after each visit. Skipped visits automatically post credits before billing.
      </p>
    </section>
  );
}
