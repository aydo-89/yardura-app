"use client";

import { useMemo } from "react";
import { Leaf, Wind, Recycle, TreeDeciduous, Car, Home as HomeIcon } from "lucide-react";

interface MobileEcoScreenProps {
  gramsThisMonth: number;
  methaneThisMonthFt3: number;
  totalGrams: number;
  hasComposting: boolean;
}

const pounds = (grams: number) => grams * 0.00220462;

export default function MobileEcoScreen({
  gramsThisMonth,
  methaneThisMonthFt3,
  totalGrams,
  hasComposting,
}: MobileEcoScreenProps) {
  const metrics = useMemo(() => {
    const monthLbs = pounds(gramsThisMonth);
    const totalLbs = pounds(totalGrams);
    const trees = Math.max(1, Math.round(totalLbs / 48));
    const miles = Math.max(0, Math.round(totalLbs / 0.9));
    const homeDays = Math.max(0, Math.round(totalLbs / 12000));

    return {
      monthLbs,
      totalLbs,
      methane: methaneThisMonthFt3,
      trees,
      miles,
      homeDays,
    };
  }, [gramsThisMonth, methaneThisMonthFt3, totalGrams]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-500/20 p-2 text-emerald-300">
            <Leaf className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              {hasComposting ? "This month’s impact" : "This month’s pickups"}
            </p>
            <h2 className="text-xl font-semibold text-white">
              {metrics.monthLbs.toFixed(1)} lbs {hasComposting ? "diverted" : "collected"}
            </h2>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-300">
          {hasComposting
            ? "Every scoop we remove keeps waste out of landfills and methane out of the air. Thanks for doing your part for a cleaner county."
            : "Every scoop keeps your yard clean and ready for play. Add compost routing to track diverted pounds and methane savings."}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-400">
          <div className="rounded-xl bg-slate-950/70 p-3">
            <dt className="flex items-center gap-1 text-slate-400">
              <Recycle className="h-4 w-4 text-emerald-300" aria-hidden /> Waste {hasComposting ? "diverted" : "collected"}
            </dt>
            <dd className="mt-1 text-sm font-semibold text-slate-100">
              {metrics.totalLbs.toFixed(1)} lbs total
            </dd>
          </div>
          <div className="rounded-xl bg-slate-950/70 p-3">
            <dt className="flex items-center gap-1 text-slate-400">
              <Wind className="h-4 w-4 text-coral-300" aria-hidden /> {hasComposting ? "Methane avoided" : "Potential methane avoided"}
            </dt>
            <dd className="mt-1 text-sm font-semibold text-slate-100">
              {metrics.methane.toFixed(1)} ft³ this month
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200">
        <h3 className="mb-3 text-sm font-semibold text-white">
          {hasComposting ? "Real-world equivalents" : "Potential impact with compost routing"}
        </h3>
        <ul className="space-y-3 text-sm text-slate-300">
          <li className="flex items-center justify-between rounded-xl bg-slate-950/70 p-3">
            <span className="flex items-center gap-2">
              <TreeDeciduous className="h-4 w-4 text-emerald-300" aria-hidden />
              Trees absorbing the same CO₂
            </span>
            <span className="font-semibold text-white">{metrics.trees}</span>
          </li>
          <li className="flex items-center justify-between rounded-xl bg-slate-950/70 p-3">
            <span className="flex items-center gap-2">
              <Car className="h-4 w-4 text-coral-300" aria-hidden />
              Miles of car emissions offset
            </span>
            <span className="font-semibold text-white">{metrics.miles}</span>
          </li>
          <li className="flex items-center justify-between rounded-xl bg-slate-950/70 p-3">
              <span className="flex items-center gap-2">
                <HomeIcon className="h-4 w-4 text-sky-300" aria-hidden />
              Days of home energy saved
            </span>
            <span className="font-semibold text-white">{metrics.homeDays}</span>
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-300">
        <h3 className="text-sm font-semibold text-white">Keep the momentum</h3>
        <p className="mt-2 text-sm text-slate-400">
          Keep your visits on schedule to maintain these savings. If you need to skip or reschedule, tap the Visits tab anytime.
        </p>
      </section>
    </div>
  );
}
