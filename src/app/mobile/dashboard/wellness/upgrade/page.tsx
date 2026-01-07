import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";

import { safeGetServerSession, authOptions } from "@/lib/auth";
import {
  extractActiveRole,
  extractUserRoles,
  getDefaultRedirectForRole,
} from "@/lib/auth/roles";
import type { AppUserRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { getCustomerWellnessAccess } from "@/lib/wellness/access";
import { Button } from "@/components/ui/button";

export default async function MobileWellnessUpgradePage() {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user?.email) {
    redirect("/signin?callbackUrl=/mobile/dashboard/wellness/upgrade");
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
    select: { id: true, orgId: true },
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

  const accessSummary = await getCustomerWellnessAccess({
    customerId: customer.id,
    orgId: customer.orgId,
  });

  const activePlan =
    accessSummary.tier === "PREMIUM" && accessSummary.source === "SERVICE_PROMO"
      ? "SCOOPING"
      : accessSummary.tier === "PREMIUM"
        ? "PREMIUM"
        : "FREE";

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
          <h1 className="text-2xl font-semibold text-white">Choose your wellness path</h1>
          <p className="text-sm text-slate-400">
            Compare free, premium, and pro-assisted wellness options.
          </p>
        </div>
      </header>

      <section className="grid gap-4">
        <div
          className={`rounded-2xl border p-4 text-slate-200 space-y-3 ${
            activePlan === "FREE"
              ? "border-emerald-400/50 bg-emerald-500/10"
              : "border-slate-800 bg-slate-900"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Start Free</p>
              <p className="text-xs text-slate-400">Included for every owner</p>
            </div>
            <span className="text-xs text-slate-400">Current</span>
          </div>
          <ul className="space-y-2 text-xs text-slate-300">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-emerald-300" />
              5 stool scans + hydration/firmness scores monthly
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-emerald-300" />
              12 AI chat sessions per month
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-emerald-300" />
              1 dog profile, reminders, stool library
            </li>
          </ul>
          <Link href="/mobile/dashboard/wellness/capture" className="block">
            <Button className="w-full rounded-full bg-white text-slate-900 hover:bg-slate-100">
              Start Free
            </Button>
          </Link>
        </div>

        <div
          className={`rounded-2xl border p-4 text-slate-200 space-y-3 ${
            activePlan === "PREMIUM"
              ? "border-emerald-400/50 bg-emerald-500/10"
              : "border-slate-800 bg-slate-900"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Premium Wellness</p>
              <p className="text-xs text-slate-400">$19.99/month</p>
            </div>
            <Sparkles className="h-5 w-5 text-emerald-300" aria-hidden />
          </div>
          <ul className="space-y-2 text-xs text-slate-300">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-emerald-300" />
              Unlimited scans + higher-res analysis
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-emerald-300" />
              Long-term trend analytics + early warnings
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-emerald-300" />
              Multi-dog households + family sharing
            </li>
          </ul>
          <Link href="/mobile/dashboard/billing" className="block">
            <Button className="w-full rounded-full bg-white text-slate-900 hover:bg-slate-100">
              Upgrade to Premium
            </Button>
          </Link>
        </div>

        <div
          className={`rounded-2xl border p-4 text-slate-200 space-y-3 ${
            activePlan === "SCOOPING"
              ? "border-emerald-400/50 bg-emerald-500/10"
              : "border-slate-800 bg-slate-900"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Scooping + Pro Wellness</p>
              <p className="text-xs text-slate-400">Best accuracy + consistency</p>
            </div>
            <ShieldCheck className="h-5 w-5 text-emerald-300" aria-hidden />
          </div>
          <ul className="space-y-2 text-xs text-slate-300">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-emerald-300" />
              Auto-capture by trained scoopers
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-emerald-300" />
              Pro-verified timeline and optional sample collection
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-emerald-300" />
              Reliable schedule improves frequency insights
            </li>
          </ul>
          <Link href="/quote?businessId=yardura" className="block">
            <Button className="w-full rounded-full bg-white text-slate-900 hover:bg-slate-100">
              See Scooping Plans
            </Button>
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-3">
        <h2 className="text-sm font-semibold text-white">DIY vs Pro-assisted wellness</h2>
        <div className="grid gap-3 sm:grid-cols-2 text-sm text-slate-300">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
            <p className="text-xs uppercase tracking-wide text-slate-500">DIY wellness</p>
            <ul className="space-y-1 text-xs text-slate-400">
              <li>• Owner captures when you remember</li>
              <li>• Limited context without pro handling</li>
              <li>• Great for light monitoring</li>
            </ul>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
            <p className="text-xs uppercase tracking-wide text-slate-500">Pro-assisted</p>
            <ul className="space-y-1 text-xs text-slate-400">
              <li>• Auto-captures on every visit</li>
              <li>• Consistent angles improve accuracy</li>
              <li>• Pro-verified timeline for your vet</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
