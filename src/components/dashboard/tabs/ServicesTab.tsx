import React, { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  MapPin,
  ShieldCheck,
  PawPrint,
  Wand2,
  ChevronRight,
  Phone,
  CalendarDays,
  ArrowRight,
} from "lucide-react";
import type {
  DashboardServiceVisit,
  ServiceSummary,
  User,
} from "../types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScheduleSelector } from "@/components/onboarding/ScheduleSelector";
import { useRouter } from "next/navigation";
import {
  normalizePreferredTimeWindowSlug,
  resolvePreferredTimeWindowShortLabel,
} from "@/lib/time-window";
import { splitInstructions } from "@/lib/instructions";
import type { DashboardTabValue } from "../Dashboard";

interface ServicesTabProps {
  id?: string;
  serviceVisits: DashboardServiceVisit[];
  nextServiceAt: Date | null;
  daysUntilNext: number | null;
  lastCompletedAt: Date | null;
  serviceStreak: number;
  user: User;
  serviceSummary: ServiceSummary | null;
  onNavigateTab: (tab: DashboardTabValue) => void;
}

type RescheduleWindow = "morning" | "afternoon" | "flexible";

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
});

const fullDateFormatter = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

function titleCase(input?: string | null) {
  if (!input) return "—";
  return input
    .toLowerCase()
    .split(/[_-]|\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function ServicesTab({
  serviceVisits,
  nextServiceAt,
  daysUntilNext,
  lastCompletedAt,
  serviceStreak,
  user,
  serviceSummary,
  onNavigateTab,
}: ServicesTabProps) {
  const completedServices = serviceVisits.filter(
    (v) => v.status === "COMPLETED",
  );
  const scheduledServices = serviceVisits.filter(
    (v) => v.status === "SCHEDULED" || v.status === "IN_PROGRESS",
  );
  const sortedScheduledVisits = useMemo(
    () =>
      scheduledServices
        .slice()
        .sort(
          (a, b) =>
            new Date(a.scheduledDate).getTime() -
            new Date(b.scheduledDate).getTime(),
        ),
    [scheduledServices],
  );
  const upcomingScheduledVisit = sortedScheduledVisits[0] ?? null;
  const upcomingVisits = useMemo(() => {
    const now = Date.now();
    return sortedScheduledVisits.filter(
      (visit) => new Date(visit.scheduledDate).getTime() >= now,
    );
  }, [sortedScheduledVisits]);

  const fallbackNextVisit = serviceSummary?.nextVisitDate
    ? new Date(serviceSummary.nextVisitDate)
    : serviceSummary?.firstVisitDate
      ? new Date(serviceSummary.firstVisitDate)
      : null;

  const upcomingVisit = nextServiceAt ?? fallbackNextVisit;
  const address = [user.address, user.city, user.zipCode]
    .filter(Boolean)
    .join(", ");

  const frequencyLabel = titleCase(serviceSummary?.frequency ?? user.serviceFrequency);
  const dogsLabel = serviceSummary?.dogsCount ?? user.dogsCount ?? 0;
  const yardLabel = titleCase(serviceSummary?.yardSize ?? user.yardSize);
  const deodorizeLabel = titleCase(serviceSummary?.deodorizeMode);
  const hasDeodorizer =
    deodorizeLabel &&
    deodorizeLabel !== "—" &&
    deodorizeLabel.toLowerCase() !== "none";
  const normalizedDivertMode = serviceSummary?.divertMode?.toLowerCase() ?? null;
  const hasComposting =
    normalizedDivertMode != null &&
    !["none", "takeaway"].includes(normalizedDivertMode);
  const wasteHandlingLabel = (() => {
    if (normalizedDivertMode === "takeaway") return "Haul away";
    if (hasComposting) {
      return "Compost routing";
    }
    return "Leave in bin";
  })();

  const crewNotes = useMemo(
    () => splitInstructions(serviceSummary?.specialInstructions),
    [serviceSummary?.specialInstructions],
  );
  const upcomingWindowSlug = normalizePreferredTimeWindowSlug(
    upcomingScheduledVisit?.preferredTimeWindowSlug
      ?? serviceSummary?.preferredTimeWindowSlug
      ?? user.preferredTimeWindowSlug
      ?? null,
  );
  const upcomingWindowShortLabel = resolvePreferredTimeWindowShortLabel(
    upcomingWindowSlug,
    upcomingScheduledVisit?.preferredTimeWindow
      ?? serviceSummary?.preferredTimeWindow
      ?? null,
  );
  const upcomingWindowLabel = upcomingWindowShortLabel
    ? `${upcomingWindowShortLabel} window`
    : null;

  const [skipOpen, setSkipOpen] = useState(false);
  const [skipTarget, setSkipTarget] = useState<DashboardServiceVisit | null>(null);
  const [skipLoading, setSkipLoading] = useState(false);
  const [skipError, setSkipError] = useState<string | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<DashboardServiceVisit | null>(null);

  const activeRescheduleVisit = rescheduleTarget ?? upcomingScheduledVisit;
  const rescheduleWindowSlug = normalizePreferredTimeWindowSlug(
    activeRescheduleVisit?.preferredTimeWindowSlug
      ?? serviceSummary?.preferredTimeWindowSlug
      ?? user.preferredTimeWindowSlug
      ?? null,
  );
  const initialRescheduleWindow: RescheduleWindow = (rescheduleWindowSlug as RescheduleWindow)
    || "morning";

  const skipWindowLabel = useMemo(() => {
    if (!skipTarget) return null;
    const windowSlug = normalizePreferredTimeWindowSlug(
      skipTarget.preferredTimeWindowSlug
        ?? serviceSummary?.preferredTimeWindowSlug
        ?? user.preferredTimeWindowSlug
        ?? null,
    );
    const windowShortLabel = resolvePreferredTimeWindowShortLabel(
      windowSlug,
      skipTarget.preferredTimeWindow
        ?? serviceSummary?.preferredTimeWindow
        ?? null,
    );
    return windowShortLabel ? `${windowShortLabel} window` : "Window TBD";
  }, [
    skipTarget,
    serviceSummary?.preferredTimeWindow,
    serviceSummary?.preferredTimeWindowSlug,
    user.preferredTimeWindowSlug,
  ]);

  const history = completedServices
    .slice()
    .sort(
      (a, b) =>
        new Date(b.scheduledDate).getTime() -
        new Date(a.scheduledDate).getTime(),
    )
    .slice(0, 8);

  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<string | undefined>(undefined);
  const [rescheduleWindow, setRescheduleWindow] = useState<RescheduleWindow>(
    initialRescheduleWindow,
  );
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    setRescheduleWindow(initialRescheduleWindow);
  }, [initialRescheduleWindow]);

  useEffect(() => {
    setRescheduleDate(activeRescheduleVisit?.scheduledDate ?? undefined);
  }, [activeRescheduleVisit?.scheduledDate]);

  const disableReschedule = !activeRescheduleVisit;
  const openReschedule = (visit: DashboardServiceVisit | null) => {
    if (!visit) return;
    setActionError(null);
    setRescheduleTarget(visit);
    setRescheduleOpen(true);
  };

  const handleReschedule = async () => {
    if (!activeRescheduleVisit?.id || !rescheduleDate) {
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
          visitId: activeRescheduleVisit.id,
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
      setRescheduleTarget(null);
      router.refresh();
    } catch (error: any) {
      setActionError(error?.message ?? "Unable to reschedule right now.");
    } finally {
      setActionLoading(false);
    }
  };

  const openSkip = (visit: DashboardServiceVisit) => {
    setSkipTarget(visit);
    setSkipError(null);
    setSkipOpen(true);
  };

  const handleSkipVisit = async () => {
    if (!skipTarget?.id) {
      setSkipError("Select a visit to skip.");
      return;
    }
    setSkipLoading(true);
    setSkipError(null);
    try {
      const response = await fetch("/api/schedule/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitId: skipTarget.id,
          action: "skip",
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Unable to skip this visit right now.");
      }
      setSkipOpen(false);
      setSkipTarget(null);
      router.refresh();
    } catch (error: any) {
      setSkipError(error?.message ?? "Unable to skip this visit right now.");
    } finally {
      setSkipLoading(false);
    }
  };

  // Countdown display
  const countdownLabel = useMemo(() => {
    if (daysUntilNext == null) return "Scheduling...";
    if (daysUntilNext <= 0) return "Today";
    if (daysUntilNext === 1) return "Tomorrow";
    return `In ${daysUntilNext} days`;
  }, [daysUntilNext]);

  return (
    <div id="services" className="space-y-8">
      {/* ====== HERO: Next Visit ====== */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-evergreen-500 via-evergreen-600 to-evergreen-500 dark:from-evergreen-600 dark:via-evergreen-700 dark:to-evergreen-600 p-1">
        <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-evergreen-500 via-evergreen-600 to-evergreen-500 dark:from-evergreen-600 dark:via-evergreen-700 dark:to-evergreen-600 p-8 md:p-10">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-mint-400/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4 pointer-events-none" />
          
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="space-y-5 max-w-xl">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-sm px-4 py-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                <span className="text-xs font-semibold tracking-wide text-white uppercase">
                  {countdownLabel}
                </span>
              </div>

              {/* Big Date */}
              <div>
                <h1 className="text-4xl md:text-5xl font-heading font-bold text-white tracking-tight drop-shadow-sm">
                  {upcomingVisit ? dayFormatter.format(upcomingVisit) : "Coming Soon"}
                </h1>
                <p className="mt-2 text-lg text-white/90 font-medium">
                  {upcomingVisit ? fullDateFormatter.format(upcomingVisit) : "Your service is being scheduled"}
                </p>
              </div>

              {/* Details Pills */}
              <div className="flex flex-wrap items-center gap-3">
                {upcomingWindowLabel && (
                  <div className="flex items-center gap-2 bg-white/25 backdrop-blur-sm rounded-xl px-4 py-2.5 text-white text-sm shadow-sm">
                    <Clock className="size-4" />
                    <span className="font-semibold">{upcomingWindowLabel}</span>
                  </div>
                )}
                {address && (
                  <div className="flex items-center gap-2 bg-white/25 backdrop-blur-sm rounded-xl px-4 py-2.5 text-white text-sm shadow-sm">
                    <MapPin className="size-4" />
                    <span className="font-semibold truncate max-w-[250px] md:max-w-[350px]">{address}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3 pt-2">
              <Button
                onClick={() => {
                  setActionError(null);
                    if (!disableReschedule) openReschedule(upcomingScheduledVisit);
                  }}
                  disabled={disableReschedule}
                  className="bg-white text-evergreen-500 hover:bg-slate-100 rounded-xl h-11 px-6 font-semibold shadow-lg hover:shadow-xl transition-all"
                >
                  <CalendarDays className="size-4 mr-2" />
                  Reschedule
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-white/40 bg-white/15 text-white hover:bg-white/25 hover:border-white/50 rounded-xl h-11 px-6 font-semibold backdrop-blur-sm"
                >
                  <a href="tel:+18774179273">
                    <Phone className="size-4 mr-2" />
                    Call Support
                  </a>
              </Button>
              </div>
            </div>

            {/* Right side: Quick stats */}
            <div className="grid grid-cols-2 gap-3 lg:gap-4">
              {[
                { label: "Completed", value: completedServices.length, icon: CheckCircle },
                { label: "Scheduled", value: scheduledServices.length, icon: Calendar },
                { label: "Streak", value: serviceStreak, icon: ShieldCheck },
                { label: "Dogs", value: dogsLabel, icon: PawPrint },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 text-center shadow-sm"
                >
                  <stat.icon className="size-5 text-white/80 mx-auto mb-2" />
                  <p className="text-2xl font-heading font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-white/70 font-medium">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ====== Service Plan Details ====== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-heading font-bold text-graphite dark:text-white">Your Service Plan</h2>
          <button
            type="button"
            onClick={() => onNavigateTab("billing")}
            className="text-sm text-coral hover:text-coral-ink font-medium flex items-center gap-1 transition-colors"
          >
            Plan details
            <ChevronRight className="size-4" />
          </button>
        </div>
        
        <div className="grid gap-4 md:grid-cols-3">
          {/* Frequency */}
          <div className="rounded-2xl border border-graphite/5 dark:border-white/10 bg-white dark:bg-white/5 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-xl bg-coral/10 text-coral">
                <Calendar className="size-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-graphite/45 dark:text-white/50 font-semibold">Frequency</p>
                <p className="text-lg font-bold text-graphite dark:text-white">{frequencyLabel || "Weekly"}</p>
              </div>
            </div>
          </div>

          {/* Coverage */}
          <div className="rounded-2xl border border-graphite/5 dark:border-white/10 bg-white dark:bg-white/5 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-xl bg-mint/10 text-mint">
                <PawPrint className="size-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-graphite/45 dark:text-white/50 font-semibold">Coverage</p>
                <p className="text-lg font-bold text-graphite dark:text-white">
                  {dogsLabel} {dogsLabel === 1 ? "dog" : "dogs"} · {yardLabel || "Standard"}
                </p>
              </div>
            </div>
          </div>

          {/* Add-ons */}
          <div className="rounded-2xl border border-graphite/5 dark:border-white/10 bg-white dark:bg-white/5 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-xl bg-evergreen/10 dark:bg-evergreen/20 text-evergreen-500 dark:text-mint">
                <Wand2 className="size-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-graphite/45 dark:text-white/50 font-semibold">Add-ons</p>
                <p className="text-base font-bold text-graphite dark:text-white">
                  {hasDeodorizer ? `${deodorizeLabel} deodorizer` : "No deodorizer"}
                </p>
                <p className="text-xs text-graphite/60 dark:text-white/60">
                  Waste handling: {wasteHandlingLabel}
                </p>
              </div>
            </div>
            </div>
      </div>

        {/* Crew Notes */}
        {crewNotes.length > 0 && (
          <div className="rounded-2xl border border-graphite/5 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-coral/10 text-coral">
                <MapPin className="size-4" />
            </div>
              <h3 className="font-semibold text-graphite dark:text-white">Notes for Crew</h3>
            </div>
            <ul className="space-y-2">
              {crewNotes.map((note) => (
                <li key={note} className="flex items-start gap-2 text-sm text-graphite/70 dark:text-white/70">
                  <span className="text-coral mt-0.5">•</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
            </div>
        )}
      </section>

      {/* ====== Upcoming Visits ====== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-heading font-bold text-graphite dark:text-white">Upcoming Visits</h2>
          <span className="text-sm text-graphite/50 dark:text-white/50">
            {upcomingVisits.length} scheduled
          </span>
        </div>

        <div className="rounded-2xl border border-graphite/5 dark:border-white/10 bg-white dark:bg-white/5 overflow-hidden">
          {upcomingVisits.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto size-16 rounded-2xl bg-slate-100 dark:bg-white/10 flex items-center justify-center mb-4">
                <CalendarDays className="size-7 text-graphite/30 dark:text-white/30" />
              </div>
              <p className="text-graphite/50 dark:text-white/50 text-sm">
                Your upcoming visits will appear here as soon as they are scheduled.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-graphite/5 dark:divide-white/10">
              {upcomingVisits.map((visit) => {
                const visitDate = new Date(visit.scheduledDate);
                const status = visit.status.toLowerCase();
                const windowSlug = normalizePreferredTimeWindowSlug(
                  visit.preferredTimeWindowSlug
                    ?? serviceSummary?.preferredTimeWindowSlug
                    ?? user.preferredTimeWindowSlug
                    ?? null,
                );
                const windowShortLabel = resolvePreferredTimeWindowShortLabel(
                  windowSlug,
                  visit.preferredTimeWindow
                    ?? serviceSummary?.preferredTimeWindow
                    ?? null,
                );
                const windowLabel = windowShortLabel
                  ? `${windowShortLabel} window`
                  : "Window TBD";

                return (
                  <div
                    key={visit.id}
                    className="flex flex-wrap items-center justify-between gap-4 p-4 md:p-5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`flex size-11 items-center justify-center rounded-xl ${
                        status === "in_progress"
                          ? "bg-amber-100/70 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                          : "bg-coral/10 text-coral"
                      }`}>
                        <Calendar className="size-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-graphite dark:text-white">
                          {shortDateFormatter.format(visitDate)}
                        </p>
                        <p className="text-xs text-graphite/50 dark:text-white/50">
                          {windowLabel}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                        status === "in_progress"
                          ? "bg-amber-100/70 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                          : "bg-coral/10 text-coral"
                      }`}>
                        <span className="size-1.5 rounded-full bg-current" />
                        {titleCase(visit.status)}
                      </span>
                      {visit.status === "SCHEDULED" && (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openReschedule(visit)}
                            className="rounded-full border-graphite/15 text-graphite/70 hover:border-evergreen/40 hover:text-evergreen-600 dark:border-white/20 dark:text-white/70 dark:hover:border-mint/60 dark:hover:text-mint"
                          >
                            Reschedule
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openSkip(visit)}
                            className="rounded-full border-graphite/15 text-graphite/70 hover:border-coral/40 hover:text-coral dark:border-white/20 dark:text-white/70 dark:hover:border-coral/60 dark:hover:text-coral"
                          >
                            Skip
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ====== Service History ====== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-heading font-bold text-graphite dark:text-white">Service History</h2>
          <span className="text-sm text-graphite/50 dark:text-white/50">{completedServices.length} total visits</span>
      </div>

        <div className="rounded-2xl border border-graphite/5 dark:border-white/10 bg-white dark:bg-white/5 overflow-hidden">
          {history.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto size-16 rounded-2xl bg-slate-100 dark:bg-white/10 flex items-center justify-center mb-4">
                <Calendar className="size-7 text-graphite/30 dark:text-white/30" />
              </div>
              <p className="text-graphite/50 dark:text-white/50 text-sm">
                Your service history will appear here after your first visit.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-graphite/5 dark:divide-white/10">
              {history.map((visit) => {
              const visitDate = new Date(visit.scheduledDate);
              const status = visit.status.toLowerCase();

              return (
                  <div
                    key={visit.id}
                    className="flex items-center justify-between p-4 md:p-5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`flex size-11 items-center justify-center rounded-xl ${
                        status === "completed" ? "bg-mint/10 text-mint" : "bg-coral/10 text-coral"
                      }`}>
                        {status === "completed" ? <CheckCircle className="size-5" /> : <Calendar className="size-5" />}
                    </div>
                    <div>
                        <p className="font-semibold text-graphite dark:text-white">
                          {shortDateFormatter.format(visitDate)}
                      </p>
                        <p className="text-xs text-graphite/50 dark:text-white/50">{titleCase(visit.serviceType)}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                      status === "completed"
                        ? "bg-mint/10 text-mint"
                        : status === "scheduled"
                          ? "bg-coral/10 text-coral"
                          : "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                    }`}>
                      <span className="size-1.5 rounded-full bg-current" />
                      {status === "completed" ? "Done" : status === "scheduled" ? "Upcoming" : status}
                    </span>
                  </div>
                );
              })}
                </div>
          )}
        </div>
      </section>

      {/* ====== Help Section ====== */}
      <section className="rounded-2xl border border-graphite/5 dark:border-white/10 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900/60 dark:to-slate-950/60 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-coral/10 text-coral">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <h3 className="font-semibold text-graphite dark:text-white">Need to pause or reschedule?</h3>
              <p className="text-sm text-graphite/60 dark:text-white/60">
                Text or call before 6pm the day prior to adjust your visit.
          </p>
            </div>
          </div>
          <Button
            asChild
            variant="outline"
            className="border-graphite/10 dark:border-white/20 hover:bg-graphite/5 dark:hover:bg-white/10 rounded-xl h-11 dark:text-white"
          >
            <a href="tel:+18774179273" className="flex items-center gap-2">
              <Phone className="size-4" />
              1-877-417-YARD
            </a>
          </Button>
        </div>
      </section>

      {/* Reschedule Dialog */}
      <Dialog
        open={rescheduleOpen}
        onOpenChange={(value) => {
          if (!actionLoading) {
            setActionError(null);
            setRescheduleOpen(value);
            if (!value) {
              setRescheduleTarget(null);
            }
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

      {/* Skip Dialog */}
      <Dialog
        open={skipOpen}
        onOpenChange={(value) => {
          if (!skipLoading) {
            setSkipError(null);
            setSkipOpen(value);
            if (!value) {
              setSkipTarget(null);
            }
          }
        }}
      >
        <DialogContent className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white text-graphite dark:bg-slate-900 dark:text-slate-50">
          <DialogHeader>
            <DialogTitle className="text-xl font-heading font-bold text-graphite dark:text-white">
              Skip this visit?
            </DialogTitle>
          </DialogHeader>
          {skipTarget ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-graphite/5 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4">
                <p className="text-sm font-semibold text-graphite dark:text-white">
                  {shortDateFormatter.format(new Date(skipTarget.scheduledDate))}
                </p>
                <p className="text-xs text-graphite/50 dark:text-white/60">
                  {skipWindowLabel}
                </p>
              </div>
              <p className="text-sm text-graphite/60 dark:text-white/70">
                We&apos;ll remove this visit from your schedule and you won&apos;t be charged for it.
              </p>
            </div>
          ) : null}
          {skipError && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/30 dark:text-red-400 rounded-lg px-4 py-2">{skipError}</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setSkipOpen(false)}
              disabled={skipLoading}
              className="rounded-xl dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
            >
              Keep visit
            </Button>
            <Button
              onClick={handleSkipVisit}
              disabled={skipLoading}
              className="bg-coral hover:bg-coral-ink text-white rounded-xl"
            >
              {skipLoading ? "Skipping..." : "Skip visit"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
