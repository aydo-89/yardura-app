import type { ServiceSummary } from "@/components/dashboard/types";
import { CalendarClock, PawPrint, Wallet2 } from "lucide-react";
import { splitInstructions } from "@/lib/instructions";

interface Props {
  summary: ServiceSummary | null;
}

export default function MobileServiceSummary({ summary }: Props) {
  if (!summary) return null;
  const mobileInstructions = splitInstructions(summary.specialInstructions);
  const billingLabel = (() => {
    if (summary.billingPreference === "monthly") {
      return "Monthly membership";
    }
    if (summary.billingPreference === "one-time") {
      return "One-time service";
    }
    return "Pay per visit";
  })();

  return (
    <section className="bg-slate-900 rounded-2xl p-4 space-y-4 border border-slate-800">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Service plan
          </p>
          <h2 className="text-lg font-semibold text-white">
            {summary.planName ?? "Current plan"}
          </h2>
        </div>
        {summary.weekendUpgrade && (
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-600/20 text-emerald-300">
            Mon–Sun
          </span>
        )}
      </header>

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div className="flex items-center gap-3">
          <PawPrint className="h-5 w-5 text-slate-400" aria-hidden />
          <div>
            <dt className="text-slate-400 text-xs uppercase tracking-wide">
              Frequency
            </dt>
            <dd className="text-white font-medium">
              {summary.frequency ?? "–"}
            </dd>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Wallet2 className="h-5 w-5 text-slate-400" aria-hidden />
          <div>
            <dt className="text-slate-400 text-xs uppercase tracking-wide">
              Billing cadence
            </dt>
            <dd className="text-white font-medium">
              {billingLabel}
            </dd>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <CalendarClock className="h-5 w-5 text-slate-400" aria-hidden />
          <div>
            <dt className="text-slate-400 text-xs uppercase tracking-wide">
              Next visit
            </dt>
            <dd className="text-white font-medium">
              {summary.nextVisitDate
                ? new Date(summary.nextVisitDate).toLocaleDateString()
                : "Scheduling"}
            </dd>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <CalendarClock className="h-5 w-5 text-slate-400" aria-hidden />
          <div>
            <dt className="text-slate-400 text-xs uppercase tracking-wide">
              Next billing
            </dt>
            <dd className="text-white font-medium">
              {summary.nextBillingDate
                ? new Date(summary.nextBillingDate).toLocaleDateString()
                : "Pending"}
            </dd>
          </div>
        </div>
      </dl>

      {mobileInstructions.length ? (
        <div className="text-xs text-slate-300 bg-slate-900/60 border border-slate-800 rounded-xl p-3">
          <p className="font-semibold text-slate-200 mb-2">Notes for the crew</p>
          <ul className="space-y-1">
            {mobileInstructions.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="text-slate-500">•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
