import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Bug } from "lucide-react";

import { safeGetServerSession, authOptions } from "@/lib/auth";
import {
  extractActiveRole,
  extractUserRoles,
  getDefaultRedirectForRole,
} from "@/lib/auth/roles";
import type { AppUserRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import {
  getParasiteRiskForState,
  getRegionLabel,
  type ParasiteRiskLevel,
} from "@/data/parasite-risk";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const riskBadgeClasses = (level: ParasiteRiskLevel) => {
  if (level === "HIGH") {
    return "border-rose-500/40 bg-rose-500/10 text-rose-200";
  }
  if (level === "MODERATE") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  }
  return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
};

export default async function MobileWellnessParasiteRiskPage() {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user?.email) {
    redirect("/signin?callbackUrl=/mobile/dashboard/wellness/parasite-risk");
  }

  const roles = extractUserRoles(session);
  const activeRole = extractActiveRole(session);
  const prioritizedRole = activeRole ?? roles[0] ?? null;

  const redirectForRole = (
    role: AppUserRole | null | undefined,
    options?: { requireCustomer?: boolean },
  ) => {
    if (!role) {
      return options?.requireCustomer ? "/quote" : "/dashboard";
    }
    if (role === "TECH") {
      return "/field-tech";
    }
    if (role === "CUSTOMER" && options?.requireCustomer) {
      return "/quote";
    }
    return getDefaultRedirectForRole(role);
  };

  if (activeRole && activeRole !== "CUSTOMER") {
    redirect(redirectForRole(activeRole));
  }

  const customer = await prisma.customer.findFirst({
    where: { email: session.user.email },
    select: { id: true, state: true },
  });

  if (!customer) {
    let fallbackRole: AppUserRole | null | undefined =
      prioritizedRole ??
      ((session as any)?.userRole as AppUserRole | null | undefined) ??
      ((session?.user as any)?.role as AppUserRole | null | undefined) ??
      null;

    if (!fallbackRole) {
      const userRecord = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { role: true },
      });
      fallbackRole = (userRecord?.role as AppUserRole | undefined) ?? null;
    }

    redirect(redirectForRole(fallbackRole, { requireCustomer: true }));
  }

  const calendar = getParasiteRiskForState(customer.state);
  const regionLabel = getRegionLabel(customer.state);

  return (
    <div className="px-4 py-6 space-y-6">
      <header className="space-y-3">
        <Link
          href="/mobile/dashboard/wellness"
          className="inline-flex items-center gap-2 text-sm text-slate-400"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to wellness
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-white">Parasite risk calendar</h1>
          <p className="text-sm text-slate-400">
            Seasonal risk guidance for fleas, ticks, and heartworm.
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Region</p>
            <h2 className="text-lg font-semibold text-white">
              {regionLabel}
            </h2>
            <p className="text-sm text-slate-400">
              Based on {customer.state || "your state"} risk patterns.
            </p>
          </div>
          <div className="rounded-xl bg-slate-950/70 p-2 text-emerald-200">
            <Bug className="h-5 w-5" aria-hidden />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-4">
        <div className="grid grid-cols-3 gap-3 text-xs uppercase tracking-wide text-slate-500">
          <span>Month</span>
          <span>Fleas & ticks</span>
          <span>Heartworm</span>
        </div>
        <div className="space-y-2">
          {calendar.map((entry) => (
            <div key={entry.month} className="grid grid-cols-3 gap-3 items-center">
              <span className="text-sm text-slate-200">{MONTHS[entry.month]}</span>
              <span
                className={`inline-flex items-center justify-center rounded-full border px-2 py-1 text-xs ${riskBadgeClasses(
                  entry.fleasTicks,
                )}`}
              >
                {entry.fleasTicks.toLowerCase()}
              </span>
              <span
                className={`inline-flex items-center justify-center rounded-full border px-2 py-1 text-xs ${riskBadgeClasses(
                  entry.heartworm,
                )}`}
              >
                {entry.heartworm.toLowerCase()}
              </span>
            </div>
          ))}
        </div>
        <Link
          href="/mobile/dashboard/wellness/reminders"
          className="inline-flex items-center justify-center rounded-full border border-brand-gold/40 bg-brand-gold/15 px-3 py-2 text-xs font-semibold text-brand-gold transition hover:border-brand-gold/60 hover:bg-brand-gold/25"
        >
          Add heartworm reminder →
        </Link>
      </section>
    </div>
  );
}
