"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  CheckCircle,
  AlertCircle,
  CalendarCheck,
  CalendarClock,
  Sparkles,
  Sunrise,
  Sun,
  ChevronDown,
} from "lucide-react";
import {
  format,
  addDays,
  startOfWeek,
  endOfWeek,
  isSameDay,
  startOfDay,
  parse,
} from "date-fns";

interface AvailabilityData {
  date: string;
  available: boolean;
  totalCapacity: number;
  bookedCount: number;
  reason?: string;
}

type ArrivalWindow = "morning" | "afternoon" | "flexible";

interface ScheduleSelectorProps {
  zipCode: string;
  onDateSelected: (date: string) => void;
  selectedDate?: string;
  frequency: "weekly" | "bi-weekly" | "twice-weekly" | "daily" | "monthly" | "one-time";
  selectedWindow?: ArrivalWindow;
  onWindowSelected?: (window: ArrivalWindow) => void;
  weekendUpgrade?: boolean;
  mode?: "schedule" | "reschedule";
}

const normalizeArrivalWindow = (value?: string | null): ArrivalWindow => {
  if (value === "morning" || value === "afternoon") {
    return value;
  }
  return "flexible";
};

const parseDateOnly = (value: string) => parse(value, "yyyy-MM-dd", new Date());

// Collapsible component for preferred time window selection
function PreferredWindowExpander({
  localWindow,
  onWindowSelect,
  arrivalWindowOptions,
}: {
  localWindow: ArrivalWindow;
  onWindowSelect: (window: ArrivalWindow) => void;
  arrivalWindowOptions: Array<{
    id: ArrivalWindow;
    label: string;
    window: string;
    description: string;
    icon: React.ReactNode;
  }>;
}) {
  const [expanded, setExpanded] = useState(localWindow !== "flexible");
  const hasPreferredWindow = localWindow === "morning" || localWindow === "afternoon";

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all ${
          hasPreferredWindow
            ? "border-brand-coral/30 bg-brand-coral/5 dark:bg-brand-coral/10"
            : "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/30 hover:bg-slate-100 dark:hover:bg-slate-700/50"
        }`}
      >
        <div className="flex items-center gap-2">
          {hasPreferredWindow ? (
            <>
              <CheckCircle className="w-4 h-4 text-brand-coral" />
              <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                Preferred window: <span className="text-brand-coral">{localWindow === "morning" ? "Morning" : "Afternoon"}</span>
              </span>
            </>
          ) : (
            <>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Want a specific time? Pick a preferred window
              </span>
            </>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="space-y-3 pl-2">
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            We&apos;ll do our best to schedule within your preferred window, but can&apos;t guarantee exact times due to route optimization. If we need to shift the window, we&apos;ll text you before the visit.
          </p>
          
          <div className="grid gap-3 sm:grid-cols-2">
            {arrivalWindowOptions.map((option) => {
              const isSelected = localWindow === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onWindowSelect(option.id);
                  }}
                  className={`group relative rounded-xl border px-4 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral/50 ${
                    isSelected
                      ? "border-brand-coral bg-brand-coral/10 dark:bg-brand-coral/20 shadow-md"
                      : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 hover:border-brand-coral/50"
                  }`}
                  aria-pressed={isSelected}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`inline-flex items-center justify-center rounded-lg p-2 ${
                        isSelected
                          ? "bg-brand-coral/20 text-brand-coral"
                          : "bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {option.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${isSelected ? "text-slate-900 dark:text-white" : "text-slate-800 dark:text-slate-100"}`}>
                        {option.label}
                      </p>
                      <p className={`text-xs ${isSelected ? "text-slate-600 dark:text-slate-300" : "text-slate-500 dark:text-slate-400"}`}>
                        {option.window}
                      </p>
                    </div>
                    {isSelected && (
                      <CheckCircle className="w-4 h-4 text-brand-coral flex-shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {hasPreferredWindow && (
            <button
              type="button"
              onClick={() => onWindowSelect("flexible")}
              className="w-full text-center text-xs text-slate-500 dark:text-slate-400 hover:text-brand-coral transition-colors py-2"
            >
              Switch back to flexible window
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function ScheduleSelector({
  zipCode,
  onDateSelected,
  selectedDate,
  frequency,
  selectedWindow,
  onWindowSelected,
  weekendUpgrade = false,
  mode = "schedule",
}: ScheduleSelectorProps) {
  const [availability, setAvailability] = useState<AvailabilityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [localWindow, setLocalWindow] = useState<ArrivalWindow>(
    normalizeArrivalWindow(selectedWindow),
  );

  const weekendCoverage = frequency === "daily" && weekendUpgrade;
  const isReschedule = mode === "reschedule";
  const today = new Date();
  const earliestSelectableDate = startOfDay(addDays(today, 2));
  const earliestSelectableLabel = format(earliestSelectableDate, "EEEE, MMM d");
  const earliestSelectableTime = earliestSelectableDate.getTime();
  const headerTitle = isReschedule ? "Reschedule your visit" : "Schedule your first visit";
  const headerSubtitle = isReschedule
    ? "Pick the new visit window that fits your week. These are preferences - routes are optimized and we'll alert you if timing shifts."
    : "Pick the visit window that fits your week. These are preferences - routes are optimized and we'll alert you if timing shifts.";

  useEffect(() => {
    if (zipCode) {
      loadAvailability();
    }
  }, [zipCode]);

  useEffect(() => {
    if (selectedWindow && selectedWindow !== localWindow) {
      setLocalWindow(normalizeArrivalWindow(selectedWindow));
    }
  }, [selectedWindow]);

  const loadAvailability = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/schedule/availability?zipCode=${zipCode}&days=30`);
      if (!response.ok) throw new Error("Failed to load availability");
      const data = await response.json();
      setAvailability(data.availability);
    } catch (error) {
      setError("Failed to load available dates");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getNextBillingDate = (startDate: string, frequency: string) => {
    const kickoff = parseDateOnly(startDate);
    if (Number.isNaN(kickoff.getTime())) {
      return kickoff;
    }

    const normalized = frequency.toLowerCase();

    const trialLengthDays = (() => {
      switch (normalized) {
        case "bi-weekly":
        case "biweekly":
        case "every-other-week":
          return 14;
        default:
          return 7;
      }
    })();

    const cadenceDays = (() => {
      if (normalized === "monthly") {
        return 30;
      }
      if (
        normalized === "bi-weekly" ||
        normalized === "biweekly" ||
        normalized === "every-other-week"
      ) {
        return 14;
      }
      return 7;
    })();

    const activation = addDays(kickoff, trialLengthDays);
    const firstChargeOffset = cadenceDays + 1;
    return addDays(activation, firstChargeOffset);
  };

  if (loading) {
    return (
      <Card className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-coral"></div>
            <span className="ml-2 text-slate-600 dark:text-slate-300">Loading available dates...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center text-red-600 dark:text-red-400">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const availableDates = availability
    .filter((date) => {
      if (!date.available) return false;
      const parsed = parseDateOnly(date.date);
      if (Number.isNaN(parsed.getTime())) return false;
      return parsed >= earliestSelectableDate;
    })
    .sort((a, b) => parseDateOnly(a.date).getTime() - parseDateOnly(b.date).getTime())
    .slice(0, 12);

  const handleWindowSelect = (window: ArrivalWindow) => {
    setLocalWindow(window);
    onWindowSelected?.(window);
  };

  const arrivalWindowOptions: Array<{
    id: ArrivalWindow;
    label: string;
    window: string;
    description: string;
    icon: React.ReactNode;
  }> = [
    {
      id: "morning",
      label: "Morning",
      window: weekendCoverage ? "7:30 – 11:30" : "8:00 – 12:00",
      description: weekendCoverage
        ? "Great if you like an early start — crews cover weekends, too."
        : "Great if you like an early start and a fresh yard before noon.",
      icon: <Sunrise className="w-5 h-5" aria-hidden="true" />,
    },
    {
      id: "afternoon",
      label: "Afternoon",
      window: weekendCoverage ? "11:30 – 3:30" : "12:00 – 4:00",
      description: weekendCoverage
        ? "Perfect for mid-day service with seven-day coverage."
        : "Our most popular window for balancing work and school schedules.",
      icon: <Sun className="w-5 h-5" aria-hidden="true" />,
    },
    {
      id: "flexible",
      label: "Flexible window",
      window: weekendCoverage ? "Custom ETA (Mon–Sun)" : "Custom ETA by text",
      description: weekendCoverage
        ? "Prefer a heads-up the night before? We'll text you with a weekend-inclusive ETA."
        : "Prefer a heads-up the night before? We'll text you with the crew's arrival window.",
      icon: <Sparkles className="w-5 h-5" aria-hidden="true" />,
    },
  ];

  const recommendedDate = availableDates[0];
  const remainingDates = availableDates.slice(1);

  const calendarDates = availableDates;
  const toKey = (date: Date) => format(date, "yyyy-MM-dd");
  const calendarDateMap = new Map(
    calendarDates.map((entry) => [toKey(parseDateOnly(entry.date)), entry]),
  );

  const calendarWeeks = (() => {
    if (calendarDates.length === 0) return [] as Date[][];
    const firstDate = parseDateOnly(calendarDates[0].date);
    const lastDate = parseDateOnly(calendarDates[calendarDates.length - 1].date);
    const calendarStart = startOfWeek(firstDate, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(lastDate, { weekStartsOn: 0 });
    const weeks: Date[][] = [];
    let cursor = calendarStart;

    while (cursor <= calendarEnd) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i += 1) {
        week.push(cursor);
        cursor = addDays(cursor, 1);
      }
      weeks.push(week);
    }

    return weeks;
  })();

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const recommendedLabel = isReschedule ? "Recommended new date" : "Next available start";
  const moreOptionsLabel = isReschedule ? "More date options" : "More start options";
  const moreOptionsCaption = isReschedule
    ? `${availableDates.length} upcoming dates you can move to`
    : `${availableDates.length} dates available the next few weeks`;
  const summaryBullets = isReschedule
    ? [
        "We'll text you the evening before with your technician and updated ETA.",
        "Windows are preferences. If routing changes, we'll notify you right away.",
        "Visit photos and notes land in your dashboard minutes after the scoop.",
        "Your billing cadence stays the same — we'll adjust if anything needs attention.",
      ]
    : [
        "We'll text you the evening before with your technician and ETA.",
        "Windows are preferences. If routing changes, we'll notify you right away.",
        "Visit photos and notes land in your dashboard minutes after the scoop.",
        ...(frequency !== "one-time"
          ? [
              "Recurring billing starts after this first visit — we'll remind you before every charge.",
            ]
          : []),
      ];

  if (!availableDates.length) {
    return (
      <Card className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="flex items-center gap-2 font-serif text-slate-900 dark:text-white">
            <Calendar className="w-5 h-5 text-brand-coral" />
            {headerTitle}
          </CardTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {headerSubtitle}
          </p>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
          <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 px-4 py-3">
            <p className="font-semibold text-slate-900 dark:text-white">
              Earliest available start: {earliestSelectableLabel}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              We're wrapping existing routes before taking new visits. If you need something sooner, call or text 1-877-417-YARD.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg">
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 font-serif text-slate-900 dark:text-white">
          <Calendar className="w-5 h-5 text-brand-coral" />
          {headerTitle}
        </CardTitle>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {headerSubtitle}
        </p>
      </CardHeader>
      <CardContent className="space-y-8 text-slate-700 dark:text-slate-200">
        {/* Earliest date notice */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
          Earliest arrival we can offer right now is <strong className="font-semibold text-slate-900 dark:text-white">{earliestSelectableLabel}</strong>. Need something sooner? Call or text
          <a href="tel:+18774179273" className="font-semibold text-brand-coral"> 1-877-417-YARD</a> and we'll see what we can do.
        </div>
        
        <div className="space-y-6">
          {/* Arrival Window Selection */}
          <section className="space-y-3">
            {/* Flexible Default Option */}
            <div
              className={`rounded-xl border px-5 py-4 transition-all ${
                localWindow === "flexible"
                  ? "border-brand-coral bg-brand-coral/10 dark:bg-brand-coral/20 shadow-md"
                  : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`inline-flex items-center justify-center rounded-lg p-2 ${
                      localWindow === "flexible"
                        ? "bg-brand-coral/20 text-brand-coral"
                        : "bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <p className={`text-base font-semibold ${localWindow === "flexible" ? "text-slate-900 dark:text-white" : "text-slate-800 dark:text-slate-100"}`}>
                      Flexible window
                    </p>
                    <p className={`text-sm ${localWindow === "flexible" ? "text-slate-600 dark:text-slate-300" : "text-slate-500 dark:text-slate-400"}`}>
                      We&apos;ll text you the night before with your crew&apos;s arrival window
                    </p>
                  </div>
                </div>
                {localWindow === "flexible" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-coral/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand-coral">
                    <CheckCircle className="w-3 h-3" />
                    Selected
                  </span>
                )}
              </div>
            </div>

            {/* Preferred Window Expander */}
            <PreferredWindowExpander
              localWindow={localWindow}
              onWindowSelect={handleWindowSelect}
              arrivalWindowOptions={arrivalWindowOptions.filter(opt => opt.id !== "flexible")}
            />
          </section>

          {/* Date Selection */}
          <section className="space-y-4">
            {/* Recommended Date */}
            {recommendedDate && (
              <div
                className={`rounded-2xl border p-5 transition-all shadow-md ${
                  selectedDate === recommendedDate.date
                    ? "border-brand-coral bg-brand-coral/10 dark:bg-brand-coral/20"
                    : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 hover:border-brand-coral/50"
                }`}
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-coral/20 text-brand-coral shadow-sm">
                      <CalendarCheck className="w-5 h-5" />
                    </span>
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-coral">
                        {recommendedLabel}
                      </p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {format(parseDateOnly(recommendedDate.date), "EEEE, MMM d")}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {recommendedDate.totalCapacity - recommendedDate.bookedCount} open spots • {recommendedDate.bookedCount}/{recommendedDate.totalCapacity} claimed
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant={selectedDate === recommendedDate.date ? "default" : "secondary"}
                    className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                      selectedDate === recommendedDate.date
                        ? "bg-brand-coral text-white hover:bg-brand-coral-ink"
                        : "bg-slate-100 dark:bg-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-500"
                    }`}
                    onClick={() => onDateSelected(recommendedDate.date)}
                  >
                    {selectedDate === recommendedDate.date ? "Selected" : "Choose this date"}
                  </Button>
                </div>
              </div>
            )}

            {/* More Options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {moreOptionsLabel}
                </h4>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {moreOptionsCaption}
                </span>
              </div>

              {calendarDates.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 py-10 text-center">
                  <Calendar className="mb-3 h-8 w-8 text-slate-400 dark:text-slate-500" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    We're opening up more routes near you. Tap the chat icon or email hello@insightscoop.com to reserve a spot.
                  </p>
                </div>
              ) : (
                <>
                  {/* Mobile Date List */}
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1 sm:grid sm:grid-cols-2 sm:gap-4 sm:space-y-0 md:hidden">
                    {remainingDates.map((dateData) => {
                      const date = parseDateOnly(dateData.date);
                      const isSelected = selectedDate === dateData.date;
                      const nextBillingDate = getNextBillingDate(dateData.date, frequency);
                      const slotsLeft = Math.max(0, dateData.totalCapacity - dateData.bookedCount);

                      return (
                        <button
                          key={dateData.date}
                          type="button"
                          onClick={() => onDateSelected(dateData.date)}
                          aria-pressed={isSelected}
                          className={`h-full w-full rounded-xl border px-5 py-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral/50 ${
                            isSelected
                              ? "border-brand-coral bg-brand-coral/10 dark:bg-brand-coral/20 shadow-lg"
                              : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 hover:border-brand-coral/50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className={`text-sm font-semibold ${isSelected ? "text-slate-900 dark:text-white" : "text-slate-800 dark:text-slate-100"}`}>
                                {format(date, "EEEE, MMMM d")}
                              </p>
                              <p className={`mt-1 text-xs ${isSelected ? "text-slate-600 dark:text-slate-300" : "text-slate-500 dark:text-slate-400"}`}>
                                {dateData.bookedCount}/{dateData.totalCapacity} routes already reserved • {slotsLeft} spots left
                              </p>
                              {frequency !== "one-time" && (
                                <p className={`mt-2 text-[11px] font-medium ${isSelected ? "text-slate-600 dark:text-slate-300" : "text-slate-500 dark:text-slate-400"}`}>
                                  Billing begins {format(nextBillingDate, "MMM d")}
                                </p>
                              )}
                            </div>
                            {isSelected && (
                              <CheckCircle className="w-5 h-5 flex-shrink-0 text-brand-coral" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Desktop Calendar Grid */}
                  <div className="hidden md:block">
                    <div className="overflow-x-auto">
                      <div className="min-w-[720px] space-y-3">
                        <div className="grid grid-cols-7 gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {dayLabels.map((label) => (
                            <div key={`day-label-${label}`} className="px-2 text-center">
                              {label}
                            </div>
                          ))}
                        </div>

                        <div className="space-y-2">
                          {calendarWeeks.map((week, weekIndex) => (
                            <div key={`week-${weekIndex}`} className="grid grid-cols-7 gap-2">
                              {week.map((day) => {
                                const key = toKey(day);
                                const dateData = calendarDateMap.get(key);
                                const isSelected = Boolean(dateData && selectedDate === dateData.date);
                                const isRecommended = Boolean(
                                  dateData &&
                                  recommendedDate &&
                                  isSameDay(parseDateOnly(recommendedDate.date), parseDateOnly(dateData.date))
                                );
                                const slotsLeft = dateData
                                  ? Math.max(0, dateData.totalCapacity - dateData.bookedCount)
                                  : 0;

                                if (!dateData) {
                                  return (
                                    <div
                                      key={`empty-${key}`}
                                      className="relative flex min-h-[140px] flex-col justify-between rounded-xl border border-dashed border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/30 p-3 text-left text-[11px] text-slate-400 dark:text-slate-500"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-semibold uppercase tracking-wider">
                                          {format(day, "EEE")}
                                        </span>
                                      </div>
                                      <span className="text-2xl font-semibold text-slate-300 dark:text-slate-600">
                                        {format(day, "d")}
                                      </span>
                                      <p className="text-[10px]">No routes yet</p>
                                    </div>
                                  );
                                }

                                return (
                                  <button
                                    key={`calendar-${dateData.date}`}
                                    type="button"
                                    onClick={() => onDateSelected(dateData.date)}
                                    aria-pressed={isSelected}
                                    className={`relative flex min-h-[140px] flex-col justify-between rounded-xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral/50 ${
                                      isSelected
                                        ? "border-brand-coral bg-brand-coral/10 dark:bg-brand-coral/20 shadow-lg"
                                        : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 hover:border-brand-coral/50"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider">
                                      <span className={isSelected ? "text-slate-700 dark:text-slate-200" : "text-slate-600 dark:text-slate-400"}>
                                        {format(day, "EEE")}
                                      </span>
                                      {isRecommended && (
                                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold tracking-wider ${
                                          isSelected
                                            ? "bg-white/75 dark:bg-slate-800 text-brand-coral"
                                            : "bg-brand-coral/20 text-brand-coral"
                                        }`}>
                                          Rec
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                                      {format(day, "d")}
                                    </div>
                                    <div className="space-y-1 text-[11px]">
                                      <p className={isSelected ? "text-slate-600 dark:text-slate-300" : "text-slate-500 dark:text-slate-400"}>
                                        {slotsLeft} spots left
                                      </p>
                                      <p className={isSelected ? "text-slate-500 dark:text-slate-400" : "text-slate-400 dark:text-slate-500"}>
                                        {dateData.bookedCount}/{dateData.totalCapacity} claimed
                                      </p>
                                      {frequency !== "one-time" && (
                                        <p className={isSelected ? "text-slate-500 dark:text-slate-400" : "text-slate-400 dark:text-slate-500"}>
                                          Billing {format(getNextBillingDate(dateData.date, frequency), "MMM d")}
                                        </p>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>

        {/* Summary */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <CalendarClock className="mt-0.5 h-5 w-5 text-brand-coral" />
              <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <p className="text-base font-semibold text-slate-900 dark:text-white">What happens next</p>
                <ul className="list-disc space-y-1 pl-5">
                  {summaryBullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 p-5 text-sm shadow-sm">
            <p className="mb-2 font-semibold text-slate-900 dark:text-white">Need to adjust the plan?</p>
            <p className="text-slate-600 dark:text-slate-300">
              Reply to any InsightScoop text or email, or call 1-877-417-YARD and we'll make it happen.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
