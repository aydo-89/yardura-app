"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Bell,
  BookOpen,
  Bug,
  Camera,
  ClipboardList,
  Dog,
  FileDown,
  HeartPulse,
  ListChecks,
  MapPin,
  MessageCircle,
  SunSnow,
  Thermometer,
  Utensils,
} from "lucide-react";

import { useWellnessData } from "@/components/dashboard/tabs/WellnessTab/hooks/useWellnessData";
import { StatusPill } from "@/components/dashboard/tabs/WellnessTab/components/StatusPill";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  DataReading,
  ServiceVisit,
} from "@/shared/wellness";

interface MobileWellnessScreenProps {
  dataReadings: DataReading[];
  serviceVisits: ServiceVisit[];
  access: {
    tier: string;
    source?: string | null;
    planEndsAt?: string | null;
  };
}

export default function MobileWellnessScreen({
  dataReadings,
  serviceVisits,
  access,
}: MobileWellnessScreenProps) {
  const wellness = useWellnessData(dataReadings, serviceVisits);
  const activePlan =
    access.tier === "PREMIUM" && access.source === "SERVICE_PROMO"
      ? "SCOOPING"
      : access.tier === "PREMIUM"
        ? "PREMIUM"
        : "FREE";
  const showRiskScore = access.tier === "PREMIUM";
  const riskScore = useMemo(() => {
    const base =
      wellness.latestStatus === "good"
        ? 88
        : wellness.latestStatus === "monitor"
          ? 62
          : 38;
    const penalty = wellness.latestCopy.advice.length > 2 ? 6 : 0;
    return Math.max(20, Math.min(95, base - penalty));
  }, [wellness.latestStatus, wellness.latestCopy.advice.length]);
  const riskNudge =
    riskScore < 50
      ? "Lean on hydration goals and share notes for the next few days."
      : riskScore < 70
        ? "Keep logging daily check-ins to spot subtle shifts early."
        : "Great momentum—keep your routine steady this week.";

  const planCards = (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
      <header className="flex items-center gap-2 text-slate-300 text-sm">
        <ClipboardList className="h-4 w-4" aria-hidden />
        Wellness plans
      </header>
      <div className="grid gap-3">
        <div
          className={cn(
            "rounded-2xl border bg-slate-950/70 p-3 text-sm text-slate-200",
            activePlan === "FREE"
              ? "border-emerald-400/50"
              : "border-slate-800",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-white">Start Free</p>
            <span className="text-xs text-slate-400">Included</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            5 stool scans + 12 chats per month, 1 dog, stool library, food log.
          </p>
          <Link href="/mobile/dashboard/wellness/capture" className="mt-3 inline-flex text-xs text-emerald-300">
            Start free →
          </Link>
        </div>
        <div
          className={cn(
            "rounded-2xl border bg-slate-950/70 p-3 text-sm text-slate-200",
            activePlan === "PREMIUM"
              ? "border-emerald-400/50"
              : "border-slate-800",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-white">Premium Wellness</p>
            <span className="text-xs text-slate-400">$19.99/mo</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Unlimited scans + chat, multi-dog households, trend analytics, risk score.
          </p>
          <Link href="/mobile/dashboard/wellness/upgrade" className="mt-3 inline-flex text-xs text-emerald-300">
            Upgrade →
          </Link>
        </div>
        <div
          className={cn(
            "rounded-2xl border bg-slate-950/70 p-3 text-sm text-slate-200",
            activePlan === "SCOOPING"
              ? "border-emerald-400/50"
              : "border-slate-800",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-white">Scooping + Pro Wellness</p>
            <span className="text-xs text-slate-400">Best data</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Auto-capture by pros, verified timeline, consistent schedule.
          </p>
          <Link href="/quote?businessId=yardura" className="mt-3 inline-flex text-xs text-emerald-300">
            Compare →
          </Link>
        </div>
        {access.planEndsAt && (
          <p className="text-[11px] text-slate-500">
            Access through{" "}
            {new Date(access.planEndsAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        )}
      </div>
    </section>
  );

  const ownerTools = (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
      <header className="flex items-center gap-2 text-slate-300 text-sm">
        <HeartPulse className="h-4 w-4" aria-hidden />
        Owner tools
      </header>
      <div className="grid gap-3">
        <Link
          href="/mobile/dashboard/wellness/capture"
          className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 transition hover:border-emerald-400/50"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-200">
              <Camera className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Stool scan</p>
              <p className="text-xs text-slate-400">
                1-tap capture with hydration + firmness scores.
              </p>
            </div>
          </div>
        </Link>
        <Link
          href="/mobile/dashboard/wellness/dogs"
          className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 transition hover:border-emerald-400/50"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-slate-800/60 p-2 text-slate-200">
              <Dog className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Dog profiles</p>
              <p className="text-xs text-slate-400">
                Track weight trends, allergies, meds, and vet contacts.
              </p>
            </div>
          </div>
        </Link>
        <Link
          href="/mobile/dashboard/wellness/daily"
          className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 transition hover:border-emerald-400/50"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-slate-800/60 p-2 text-slate-200">
              <ListChecks className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Daily check-in</p>
              <p className="text-xs text-slate-400">
                10-second taps for appetite, energy, and symptoms.
              </p>
            </div>
          </div>
        </Link>
        <Link
          href="/mobile/dashboard/wellness/chat"
          className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 transition hover:border-emerald-400/50"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-slate-800/60 p-2 text-slate-200">
              <MessageCircle className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Ask the AI</p>
              <p className="text-xs text-slate-400">
                Guided Q&amp;A with red-flag alerts.
              </p>
            </div>
          </div>
        </Link>
        <Link
          href="/mobile/dashboard/wellness/reminders"
          className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 transition hover:border-emerald-400/50"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-slate-800/60 p-2 text-slate-200">
              <Bell className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Reminders</p>
              <p className="text-xs text-slate-400">
                Meds, vaccines, flea, and vet visit nudges.
              </p>
            </div>
          </div>
        </Link>
        <Link
          href="/mobile/dashboard/wellness/food-log"
          className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 transition hover:border-emerald-400/50"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-slate-800/60 p-2 text-slate-200">
              <Utensils className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Food log</p>
              <p className="text-xs text-slate-400">
                Scan ingredients for common allergens.
              </p>
            </div>
          </div>
        </Link>
        <Link
          href="/mobile/dashboard/wellness/poop-map"
          className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 transition hover:border-emerald-400/50"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-slate-800/60 p-2 text-slate-200">
              <MapPin className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Yard map</p>
              <p className="text-xs text-slate-400">
                Visualize capture spots and schedule coaching.
              </p>
            </div>
          </div>
        </Link>
        <Link
          href="/mobile/dashboard/wellness/weather"
          className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 transition hover:border-emerald-400/50"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-slate-800/60 p-2 text-slate-200">
              <SunSnow className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Weather safety</p>
              <p className="text-xs text-slate-400">
                Heat and cold alerts for your yard.
              </p>
            </div>
          </div>
        </Link>
        <Link
          href="/mobile/dashboard/wellness/parasite-risk"
          className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 transition hover:border-emerald-400/50"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-slate-800/60 p-2 text-slate-200">
              <Bug className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Parasite risk</p>
              <p className="text-xs text-slate-400">
                Seasonal flea, tick, and heartworm calendar.
              </p>
            </div>
          </div>
        </Link>
        <Link
          href="/mobile/dashboard/wellness/stool-library"
          className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 transition hover:border-emerald-400/50"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-slate-800/60 p-2 text-slate-200">
              <BookOpen className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Stool library</p>
              <p className="text-xs text-slate-400">
                Quick visual comparisons for common scenarios.
              </p>
            </div>
          </div>
        </Link>
        <Link
          href="/mobile/dashboard/wellness/review"
          className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 transition hover:border-emerald-400/50"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-slate-800/60 p-2 text-slate-200">
              <FileDown className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Review & export</p>
              <p className="text-xs text-slate-400">
                Download a vet-ready PDF or full dataset.
              </p>
            </div>
          </div>
        </Link>
      </div>
    </section>
  );

  if (dataReadings.length === 0) {
    return (
      <div className="space-y-5">
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Wellness status
              </p>
              <h2 className="text-lg font-semibold text-white">
                No samples yet
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                We&apos;ll start reporting after your first InsightScoop visit
                with analyzed samples.
              </p>
            </div>
          </div>
          <Link href="/mobile/dashboard/visits" className="block">
            <Button className="w-full rounded-full bg-white text-slate-900 hover:bg-slate-100">
              View upcoming visits
            </Button>
          </Link>
        </section>
        {planCards}
        {ownerTools}
      </div>
    );
  }

  const recentWeeks = useMemo(() => wellness.weekly.slice(0, 4), [wellness.weekly]);

  return (
    <div className="space-y-5">
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Wellness status
            </p>
            <h2 className="text-lg font-semibold text-white">
              {wellness.latestCopy.title}
            </h2>
          </div>
          <StatusPill status={wellness.latestStatus} size="md" />
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">
          {wellness.latestCopy.subtitle}
        </p>
        {wellness.latestCopy.advice.length > 0 && (
          <ul className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-1 text-xs text-slate-400">
            {wellness.latestCopy.advice.map((tip, index) => (
              <li key={index}>{tip}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <header className="flex items-center gap-2 text-slate-300 text-sm">
          <HeartPulse className="h-4 w-4" aria-hidden />
          Weekly pulse
        </header>
        <ul className="space-y-3">
          {recentWeeks.map((week, index) => (
            <li key={week.startISO} className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-200 font-medium">
                  {new Date(week.startISO).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                  {" "}– {week.deposits} samples
                </p>
                {week.issues.length > 0 ? (
                  <p className="text-xs text-amber-300">
                    {week.issues.join(", ")}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">All readings looked normal</p>
                )}
              </div>
              <StatusPill status={week.status} size="sm" />
            </li>
          ))}
        </ul>
      </section>

      {ownerTools}
      {planCards}

      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Weekly check-in
            </p>
            <h2 className="text-lg font-semibold text-white">
              Share symptoms or vet notes
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Optional, but it helps pair owner insights with this week's samples.
            </p>
          </div>
          <div className="rounded-xl bg-slate-950/70 p-2 text-slate-200">
            <ClipboardList className="h-5 w-5" aria-hidden />
          </div>
        </div>
        <Link href="/mobile/dashboard/wellness/check-in" className="block">
          <Button className="w-full rounded-full bg-white text-slate-900 hover:bg-slate-100">
            Start weekly check-in
          </Button>
        </Link>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <header className="flex items-center gap-2 text-slate-300 text-sm">
          <Thermometer className="h-4 w-4" aria-hidden />
          Trend snapshot
        </header>
        <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
            <p className="uppercase tracking-wide text-[10px] text-slate-500 mb-1">
              Color trend
            </p>
            <p className="text-slate-200 font-semibold">
              {wellness.trends.colorTrend === "improving"
                ? "Improving"
                : wellness.trends.colorTrend === "declining"
                  ? "Needs attention"
                  : "Stable"}
            </p>
          </div>
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
            <p className="uppercase tracking-wide text-[10px] text-slate-500 mb-1">
              Consistency trend
            </p>
            <p className="text-slate-200 font-semibold">
              {wellness.trends.consistencyTrend === "improving"
                ? "Improving"
                : wellness.trends.consistencyTrend === "declining"
                  ? "Needs attention"
                  : "Stable"}
            </p>
          </div>
        </div>
      </section>

      {showRiskScore && (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <header className="flex items-center justify-between text-slate-300 text-sm">
            <span>Wellness Risk Score</span>
            <span className="text-xs text-slate-500">Premium</span>
          </header>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-semibold text-white">{riskScore}</p>
              <p className="text-xs text-slate-500">out of 100</p>
            </div>
            <StatusPill status={wellness.latestStatus} size="sm" />
          </div>
          <div className="h-2 rounded-full bg-slate-800">
            <div
              className="h-2 rounded-full bg-emerald-400"
              style={{ width: `${riskScore}%` }}
            />
          </div>
          <p className="text-xs text-slate-400">{riskNudge}</p>
        </section>
      )}
    </div>
  );
}
