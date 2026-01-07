"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  Calendar,
  CheckCircle,
  Clock,
  MapPin,
  PawPrint,
  Sparkles,
  TrendingUp,
  Leaf,
  ShieldCheck,
  Share2,
  Copy,
  Heart,
  Trophy,
  Zap,
  Dog as DogIcon,
  ChevronRight,
  Phone,
  ArrowRight,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScheduleSelector } from "@/components/onboarding/ScheduleSelector";
import { useRouter } from "next/navigation";
import type {
  User,
  Dog,
  DashboardServiceVisit,
  DashboardDataReading,
  ServiceSummary,
} from "../types";
import {
  normalizePreferredTimeWindowSlug,
  resolvePreferredTimeWindowShortLabel,
  SERVICE_TIME_ZONE,
} from "@/lib/time-window";
import { splitInstructions } from "@/lib/instructions";
import type { DashboardTabValue } from "../Dashboard";

type RescheduleWindow = "morning" | "afternoon" | "flexible";

interface OverviewTabProps {
  user: User;
  dogs: Dog[];
  dataReadings: DashboardDataReading[];
  serviceVisits: DashboardServiceVisit[];
  profilePercent: number;
  profileFields: Array<[string, boolean]>;
  lastReadingAt: Date | null;
  nextServiceAt: Date | null;
  daysUntilNext: number | null;
  serviceStreak: number;
  last7DaysCount: number;
  last30DaysCount: number;
  avgWeight30G: number | null;
  gramsThisMonth: number;
  totalGrams: number;
  methaneThisMonthLbsEq: number;
  recentInsightsLevel: "WATCH" | "NORMAL";
  referralUrl: string;
  serviceSummary: ServiceSummary | null;
  onCopyReferral: () => Promise<void>;
  onShareReferral: () => Promise<void>;
  onNavigateTab: (tab: DashboardTabValue) => void;
}

const formatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: SERVICE_TIME_ZONE,
});

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  timeZone: SERVICE_TIME_ZONE,
});

const shortDayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: SERVICE_TIME_ZONE,
});

function toTitle(value?: string | null) {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split(/[_-]|\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatLbsFromGrams(totalGrams: number): string {
  const lbs = totalGrams * 0.00220462;
  return lbs.toFixed(1);
}

export default function OverviewTab(props: OverviewTabProps) {
  const {
    user,
    dogs,
    dataReadings,
    serviceVisits,
    profilePercent,
    profileFields,
    nextServiceAt,
    daysUntilNext,
    serviceStreak,
    last7DaysCount,
    gramsThisMonth,
    totalGrams,
    recentInsightsLevel,
    referralUrl,
    serviceSummary,
    onCopyReferral,
    onShareReferral,
    onNavigateTab,
  } = props;

  const [copied, setCopied] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<string | undefined>(undefined);
  const [rescheduleWindow, setRescheduleWindow] = useState<RescheduleWindow>("morning");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const router = useRouter();

  // Find the upcoming scheduled visit for rescheduling
  const upcomingScheduledVisit = useMemo(() => {
    const now = Date.now();
    const scheduled = serviceVisits
      .filter((v) => v.status === "SCHEDULED" && new Date(v.scheduledDate).getTime() >= now)
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
    return scheduled[0] ?? null;
  }, [serviceVisits]);

  const canReschedule = !!upcomingScheduledVisit;

  // Initialize reschedule date when modal opens
  useEffect(() => {
    if (rescheduleOpen && upcomingScheduledVisit) {
      setRescheduleDate(upcomingScheduledVisit.scheduledDate);
      const windowSlug = normalizePreferredTimeWindowSlug(
        upcomingScheduledVisit.preferredTimeWindowSlug ??
          serviceSummary?.preferredTimeWindowSlug ??
          user.preferredTimeWindowSlug ??
          null
      );
      setRescheduleWindow((windowSlug as RescheduleWindow) || "morning");
    }
  }, [rescheduleOpen, upcomingScheduledVisit, serviceSummary, user]);

  const handleReschedule = async () => {
    if (!upcomingScheduledVisit?.id || !rescheduleDate) {
      setActionError("Select a new visit date before confirming.");
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      const response = await fetch("/api/schedule/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitId: upcomingScheduledVisit.id,
          action: "reschedule",
          nextVisitAt: rescheduleDate,
          preferredWindow: rescheduleWindow,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Unable to reschedule right now.");
      }
      setRescheduleOpen(false);
      router.refresh();
    } catch (error: any) {
      setActionError(error?.message ?? "Unable to reschedule right now.");
    } finally {
      setActionLoading(false);
    }
  };

  const derivedDogsCount = Math.max(dogs.length, user.dogsCount ?? 0);
  const nextVisitIso = serviceSummary?.nextVisitDate ?? serviceSummary?.firstVisitDate ?? null;
  const summaryNextService = useMemo(() => {
    if (nextServiceAt) return nextServiceAt;
    if (!nextVisitIso) return null;
    const parsed = new Date(nextVisitIso);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [nextServiceAt, nextVisitIso]);

  const serviceAddress = [user.address, user.city, user.zipCode]
    .filter(Boolean)
    .join(", ");

  const frequencyLabel = toTitle(serviceSummary?.frequency ?? user.serviceFrequency ?? undefined);
  const yardLabel = toTitle(serviceSummary?.yardSize ?? user.yardSize ?? undefined);
  const preferredTimeWindowSlug = normalizePreferredTimeWindowSlug(
    serviceSummary?.preferredTimeWindowSlug ??
      user.preferredTimeWindowSlug ??
      null,
  );
  const preferredTimeWindowShortLabel = resolvePreferredTimeWindowShortLabel(
    preferredTimeWindowSlug,
    serviceSummary?.preferredTimeWindow ?? user.preferredTime ?? null,
  );
  const preferredTimeWindowLabel = preferredTimeWindowShortLabel
    ? `${preferredTimeWindowShortLabel} window`
    : null;

  const overviewInstructions = useMemo(
    () => splitInstructions(serviceSummary?.specialInstructions),
    [serviceSummary?.specialInstructions],
  );

  const missingFields = profileFields.filter(([, ok]) => !ok).map(([label]) => label);
  const missingFieldLabels = missingFields.map((field) =>
    field === "At least 1 dog profile" ? "Add a pup profile" : field,
  );
  const showProfileReminder = missingFields.length > 0 && profilePercent < 100;

  const completedVisits = useMemo(
    () => serviceVisits.filter((visit) => visit.status === "COMPLETED").length,
    [serviceVisits],
  );

  const upcomingVisits = useMemo(() => {
    const now = Date.now();
    return serviceVisits
      .filter((visit) =>
        ["SCHEDULED", "IN_PROGRESS"].includes(visit.status) &&
        new Date(visit.scheduledDate).getTime() >= now,
      )
      .sort(
        (a, b) =>
          new Date(a.scheduledDate).getTime() -
          new Date(b.scheduledDate).getTime(),
      )
      .slice(0, 4);
  }, [serviceVisits]);

  const handleCopyReferral = async () => {
    await onCopyReferral();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const firstName = (user.name || "")?.split(" ")[0] || "there";
  const lbsDivertedAllTime = formatLbsFromGrams(totalGrams);
  const normalizedDivertMode = serviceSummary?.divertMode?.toLowerCase() ?? null;
  const hasComposting =
    normalizedDivertMode != null &&
    !["none", "takeaway"].includes(normalizedDivertMode);

  // Generate countdown display
  const countdownDisplay = useMemo(() => {
    if (daysUntilNext == null) return { number: "—", label: "scheduling" };
    if (daysUntilNext <= 0) return { number: "Today", label: "We're coming!" };
    if (daysUntilNext === 1) return { number: "1", label: "day away" };
    return { number: String(daysUntilNext), label: "days away" };
  }, [daysUntilNext]);

  const quickStats = [
    {
      icon: Trophy,
      label: "Service Streak",
      value: `${serviceStreak} visits`,
      color: "coral",
      tab: "services" as const,
    },
    {
      icon: TrendingUp,
      label: "This Week",
      value: `${last7DaysCount} pickups`,
      color: "mint",
      tab: "services" as const,
    },
    hasComposting
      ? {
          icon: Leaf,
          label: "Total Diverted",
          value: `${lbsDivertedAllTime} lbs`,
          color: "evergreen",
          tab: "eco" as const,
        }
      : {
          icon: CheckCircle,
          label: "Total Pickups",
          value: `${completedVisits} visits`,
          color: "evergreen",
          tab: "services" as const,
        },
    {
      icon: PawPrint,
      label: "Household",
      value: `${derivedDogsCount} ${derivedDogsCount === 1 ? "dog" : "dogs"}`,
      color: "coral",
      tab: "profile" as const,
    },
  ];

  return (
    <div className="space-y-8">
      {/* ====== HERO: Next Visit Card ====== */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-graphite via-graphite-soft to-graphite dark:from-graphite-soft dark:via-graphite dark:to-graphite-soft p-1">
        <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-graphite via-graphite-soft to-graphite dark:from-[#25292f] dark:via-[#1e2227] dark:to-[#25292f] p-8 md:p-10">
          {/* Ambient glow effects */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-coral/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-mint/8 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />
          
          <div className="relative z-10">
            {/* Top badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-sm px-4 py-1.5 mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mint opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-mint"></span>
              </span>
              <span className="text-xs font-semibold tracking-wide text-white/80 uppercase">
                Next scheduled visit
              </span>
                </div>

            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
              {/* Left: Date & Countdown */}
              <div className="space-y-6 max-w-2xl">
                {/* THE BIG DATE */}
                <div>
                  <h1 className="text-5xl md:text-6xl lg:text-7xl font-heading font-bold text-white tracking-tight leading-none">
                    {summaryNextService ? dayFormatter.format(summaryNextService) : "Coming Soon"}
                  </h1>
                  <p className="mt-3 text-xl md:text-2xl text-white/60 font-medium">
                    {summaryNextService ? formatter.format(summaryNextService) : "Your first service is being scheduled"}
                  </p>
                </div>

                {/* Arrival Window */}
                <div className="flex flex-wrap items-center gap-4 text-white/70">
                  {preferredTimeWindowLabel && (
                    <div className="flex items-center gap-2 bg-white/5 rounded-xl px-4 py-2.5">
                      <Clock className="size-5 text-mint" />
                      <span className="font-medium">{preferredTimeWindowLabel}</span>
                  </div>
                  )}
                  {serviceAddress && (
                    <div className="flex items-center gap-2 bg-white/5 rounded-xl px-4 py-2.5">
                      <MapPin className="size-5 text-coral" />
                      <span className="font-medium truncate max-w-[200px] md:max-w-none">{serviceAddress}</span>
                    </div>
                  )}
              </div>

                {/* Quick Actions */}
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button
                    onClick={() => onNavigateTab("services")}
                    className="bg-coral hover:bg-coral-ink text-white rounded-xl px-6 h-12 text-base font-semibold shadow-lg shadow-coral/25 transition-all hover:shadow-xl hover:shadow-coral/30 hover:-translate-y-0.5"
                  >
                    <span className="flex items-center gap-2">
                      View Schedule
                      <ArrowRight className="size-4" />
                    </span>
                  </Button>
                  <Button
                    onClick={() => {
                      if (canReschedule) {
                        setActionError(null);
                        setRescheduleOpen(true);
                      } else {
                        // Fallback to call if no scheduled visit
                        window.location.href = "tel:+18774179273";
                      }
                    }}
                    variant="outline"
                    className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:border-white/40 hover:text-white rounded-xl px-6 h-12 text-base font-semibold backdrop-blur-sm transition-all"
                  >
                    <CalendarDays className="size-4 mr-2" />
                    {canReschedule ? "Reschedule" : "Call to Schedule"}
                  </Button>
                </div>
              </div>

              {/* Right: Countdown Circle */}
              <div className="flex-shrink-0">
                <div className="relative w-44 h-44 md:w-52 md:h-52">
                  {/* Outer ring */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-coral/20 to-mint/20 p-1">
                    <div className="w-full h-full rounded-full bg-[#1a1d22] flex flex-col items-center justify-center">
                      <span className="text-5xl md:text-6xl font-heading font-bold text-white">
                        {countdownDisplay.number}
                      </span>
                      <span className="text-sm md:text-base text-white/50 font-medium mt-1">
                        {countdownDisplay.label}
                      </span>
              </div>
            </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====== QUICK STATS BAR ====== */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickStats.map((stat) => {
          const colorClasses = {
            coral: "bg-coral/10 text-coral",
            mint: "bg-mint/10 text-mint",
            evergreen: "bg-evergreen/10 text-evergreen-500 dark:text-mint",
          }[stat.color];

          return (
            <button
              key={stat.label}
              type="button"
              onClick={() => onNavigateTab(stat.tab)}
              className="group relative overflow-hidden rounded-2xl bg-white dark:bg-white/5 border border-graphite/5 dark:border-white/10 p-5 text-left hover:shadow-lg hover:shadow-graphite/5 dark:hover:shadow-black/20 transition-all duration-300 hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-widest text-graphite/50 dark:text-white/50 font-semibold">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-heading font-bold text-graphite dark:text-white">
                    {stat.value}
                  </p>
                </div>
                <div className={`flex size-11 items-center justify-center rounded-xl ${colorClasses}`}>
                  <stat.icon className="size-5" />
                </div>
              </div>
            </button>
          );
        })}
      </section>

      {/* ====== PROFILE COMPLETION NUDGE ====== */}
      {showProfileReminder && (
        <section className="relative overflow-hidden rounded-2xl border border-coral/20 dark:border-coral/30 bg-gradient-to-r from-coral/5 via-white to-mint/5 dark:from-coral/10 dark:via-white/5 dark:to-mint/10 p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-xl">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-coral/10">
                  <Sparkles className="size-4 text-coral" />
                </div>
                <span className="text-sm font-semibold text-coral">Almost there!</span>
              </div>
              <h3 className="text-xl font-heading font-bold text-graphite dark:text-white">
                Complete your profile to unlock wellness insights
              </h3>
              <p className="text-sm text-graphite/60 dark:text-white/60">
                Here is what is still needed to finish your profile:
              </p>
              <div className="flex flex-wrap gap-2">
                {missingFieldLabels.map((field) => (
                  <span
                    key={field}
                    className="inline-flex items-center rounded-full border border-graphite/10 dark:border-white/15 bg-white/80 dark:bg-white/5 px-3 py-1 text-xs font-semibold text-graphite/80 dark:text-white/80"
                  >
                    {field}
                  </span>
                ))}
              </div>
              <p className="text-xs text-graphite/50 dark:text-white/50">
                You can add pups in your profile. For address or contact updates, use Account settings.
              </p>
            </div>
            <div className="flex flex-col gap-3 min-w-[200px]">
              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-graphite/50 dark:text-white/50 font-medium">Progress</span>
                  <span className="font-bold text-graphite dark:text-white">{profilePercent}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-graphite/5 dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-coral to-mint transition-all duration-700"
                    style={{ width: `${Math.min(profilePercent, 100)}%` }}
                  />
                </div>
              </div>
              <Button
                onClick={() => onNavigateTab("profile")}
                className="bg-graphite hover:bg-graphite-soft dark:bg-white dark:text-graphite dark:hover:bg-white/90 text-white rounded-xl h-11 font-semibold"
              >
                <span className="flex items-center justify-center gap-2">
                  Review Checklist
                  <ChevronRight className="size-4" />
                </span>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* ====== TWO-COLUMN: Service Details + Wellness ====== */}
      <section className="grid gap-6 lg:grid-cols-5">
        {/* Service Summary - Takes 3 columns */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-heading font-bold text-graphite dark:text-white">Your Service Plan</h2>
            <button
              onClick={() => onNavigateTab("billing")}
              className="text-sm text-coral hover:text-coral-ink font-medium flex items-center gap-1 transition-colors"
            >
              Plan details
              <ChevronRight className="size-4" />
            </button>
          </div>
          
          <div className="rounded-2xl border border-graphite/5 dark:border-white/10 bg-white dark:bg-white/5 p-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-4">
                <div className="flex size-12 items-center justify-center rounded-xl bg-coral/10 text-coral">
                  <Calendar className="size-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-graphite/45 dark:text-white/50 font-semibold">Frequency</p>
                  <p className="text-base font-semibold text-graphite dark:text-white">{frequencyLabel || "Weekly"}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex size-12 items-center justify-center rounded-xl bg-mint/10 text-mint">
                  <PawPrint className="size-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-graphite/45 dark:text-white/50 font-semibold">Coverage</p>
                  <p className="text-base font-semibold text-graphite dark:text-white">
                    {derivedDogsCount} {derivedDogsCount === 1 ? "dog" : "dogs"} · {yardLabel || "Standard yard"}
                    </p>
                </div>
              </div>
            </div>

            {overviewInstructions.length > 0 && (
              <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-graphite/5 dark:border-white/10 p-4">
                <p className="text-xs uppercase tracking-widest text-graphite/45 dark:text-white/50 font-semibold mb-2">Notes for crew</p>
                <ul className="space-y-1">
                  {overviewInstructions.slice(0, 2).map((line) => (
                    <li key={line} className="text-sm text-graphite/70 dark:text-white/70 flex items-start gap-2">
                      <span className="text-coral mt-1">•</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Wellness Snapshot - Takes 2 columns */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-heading font-bold text-graphite dark:text-white">Wellness Status</h2>
            <button
              onClick={() => onNavigateTab("wellness")}
              className="text-sm text-coral hover:text-coral-ink font-medium flex items-center gap-1 transition-colors"
            >
              Details
              <ChevronRight className="size-4" />
            </button>
      </div>

          <div className="rounded-2xl border border-graphite/5 dark:border-white/10 bg-white dark:bg-white/5 p-6 h-[calc(100%-40px)] flex flex-col justify-between">
            <div className="space-y-4">
              {/* Status badge */}
              <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 ${
                recentInsightsLevel === "WATCH"
                  ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                  : "bg-mint/10 text-mint"
              }`}>
                {recentInsightsLevel === "WATCH" ? (
                  <Heart className="size-4" />
                ) : (
                  <ShieldCheck className="size-4" />
                )}
                <span className="text-sm font-semibold">
                  {recentInsightsLevel === "WATCH" ? "Monitoring trends" : "All Clear"}
                </span>
              </div>

              <p className="text-graphite/60 dark:text-white/60 text-sm">
                {recentInsightsLevel === "WATCH"
                  ? "We noticed something worth watching. Check the wellness tab for details."
                  : "Your pup's metrics look great. Keep up the good work!"}
              </p>
            </div>

            <div className="pt-4 border-t border-graphite/5 dark:border-white/10 mt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-graphite/50 dark:text-white/50">Service streak</span>
                <span className="font-semibold text-graphite dark:text-white">{serviceStreak} consecutive visits</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====== UPCOMING VISITS ====== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-heading font-bold text-graphite dark:text-white">Upcoming Visits</h2>
          <button
            onClick={() => onNavigateTab("services")}
            className="text-sm text-coral hover:text-coral-ink font-medium flex items-center gap-1 transition-colors"
          >
            View full schedule
            <ChevronRight className="size-4" />
          </button>
      </div>

        <div className="rounded-2xl border border-graphite/5 dark:border-white/10 bg-white dark:bg-white/5 divide-y divide-graphite/5 dark:divide-white/10">
          {upcomingVisits.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto size-16 rounded-2xl bg-slate-100 dark:bg-white/10 flex items-center justify-center mb-4">
                <Calendar className="size-7 text-graphite/30 dark:text-white/30" />
              </div>
              <p className="text-graphite/50 dark:text-white/50 text-sm">
                Your next visits will appear here as soon as they are scheduled.
              </p>
              </div>
            ) : (
              upcomingVisits.map((visit) => {
                const visitDate = new Date(visit.scheduledDate);
                const status = visit.status.toLowerCase();
                const statusLabel = toTitle(visit.status);

                return (
                <div key={visit.id} className="flex items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`flex size-11 items-center justify-center rounded-xl ${
                      status === "completed"
                        ? "bg-mint/10 text-mint"
                        : status === "in_progress"
                          ? "bg-amber-100/70 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                          : "bg-coral/10 text-coral"
                    }`}>
                      {status === "completed" ? <CheckCircle className="size-5" /> : <Calendar className="size-5" />}
                      </div>
                      <div>
                      <p className="font-semibold text-graphite dark:text-white">
                        {shortDayFormatter.format(visitDate)}
                        </p>
                      <p className="text-xs text-graphite/50 dark:text-white/50">{toTitle(visit.serviceType)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                      status === "completed"
                        ? "bg-mint/10 text-mint"
                        : status === "scheduled"
                          ? "bg-coral/10 text-coral"
                          : status === "in_progress"
                            ? "bg-amber-100/70 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                            : "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                    }`}>
                      <span className="size-1.5 rounded-full bg-current" />
                      {status === "scheduled" ? "Upcoming" : statusLabel}
                    </span>
                  </div>
                  </div>
                );
              })
            )}
        </div>
      </section>

      {/* ====== QUICK ACTIONS GRID ====== */}
      <section className="grid gap-4 md:grid-cols-2">
        {/* Referral Card */}
        <button
          onClick={handleCopyReferral}
          className="group text-left rounded-2xl border border-coral/15 dark:border-coral/30 bg-gradient-to-br from-coral/5 to-transparent dark:from-coral/10 dark:to-transparent p-6 hover:shadow-lg hover:shadow-coral/5 dark:hover:shadow-coral/10 transition-all duration-300 hover:-translate-y-0.5"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-coral/10 text-coral group-hover:scale-110 transition-transform">
              {copied ? <CheckCircle className="size-5" /> : <Copy className="size-5" />}
            </div>
            <ChevronRight className="size-5 text-coral/50 group-hover:text-coral group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="text-base font-heading font-bold text-graphite dark:text-white mb-1">
            {copied ? "Link Copied!" : "Share with Neighbors"}
          </h3>
          <p className="text-sm text-graphite/60 dark:text-white/60">
            Earn free cleanups when friends sign up using your referral link.
          </p>
        </button>

        {/* Eco Impact Card */}
        <button
          onClick={() => onNavigateTab("eco")}
          className="group text-left rounded-2xl border border-evergreen/15 dark:border-mint/30 bg-gradient-to-br from-evergreen/5 to-transparent dark:from-mint/10 dark:to-transparent p-6 hover:shadow-lg hover:shadow-evergreen/5 dark:hover:shadow-mint/10 transition-all duration-300 hover:-translate-y-0.5"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-evergreen/10 dark:bg-mint/10 text-evergreen-500 dark:text-mint group-hover:scale-110 transition-transform">
              <Leaf className="size-5" />
            </div>
            <ChevronRight className="size-5 text-evergreen/50 dark:text-mint/50 group-hover:text-evergreen-500 dark:group-hover:text-mint group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="text-base font-heading font-bold text-graphite dark:text-white mb-1">
            {hasComposting ? "Your Eco Impact" : "Unlock Compost Impact"}
          </h3>
          <p className="text-sm text-graphite/60 dark:text-white/60">
            {hasComposting
              ? `${lbsDivertedAllTime} lbs diverted from landfills. See your full environmental impact.`
              : "Add compost routing to track diversion and see your environmental impact."}
          </p>
        </button>
      </section>

      {/* Reschedule Dialog */}
      <Dialog
        open={rescheduleOpen}
        onOpenChange={(value) => {
          if (!actionLoading) {
            setActionError(null);
            setRescheduleOpen(value);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white text-graphite dark:bg-slate-900 dark:text-slate-50 sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-heading font-bold text-graphite dark:text-white">
              Reschedule Your Visit
            </DialogTitle>
          </DialogHeader>
          <ScheduleSelector
            zipCode={user.zipCode ?? ""}
            frequency={
              (serviceSummary?.frequency ?? user.serviceFrequency ?? "weekly") as any
            }
            weekendUpgrade={Boolean(serviceSummary?.weekendUpgrade)}
            selectedDate={rescheduleDate}
            onDateSelected={setRescheduleDate}
            selectedWindow={rescheduleWindow}
            onWindowSelected={(window) => setRescheduleWindow(window)}
            mode="reschedule"
          />
          {actionError && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/30 dark:text-red-400 rounded-lg px-4 py-2">{actionError}</p>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setRescheduleOpen(false)}
              disabled={actionLoading}
              className="rounded-xl dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReschedule}
              disabled={actionLoading}
              className="bg-mint hover:bg-mint/90 text-white rounded-xl"
            >
              {actionLoading ? "Saving..." : "Confirm Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
