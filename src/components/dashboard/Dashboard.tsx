// Refactor: extracted from legacy DashboardClientNew; removed mock wellness code and duplicates.
"use client";

import { useMemo, useState, useCallback, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronDown, Moon, Sun, User, PhoneCall } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { track } from "@/lib/analytics";
import { buildWellnessReadingsFromMedia } from "@/lib/wellness/readings";
import { useTheme } from "@/components/theme/ThemeProvider";
import {
  ROLE_DISPLAY_NAME,
  extractActiveRole,
  extractUserRoles,
  getDefaultRedirectForRole,
  type AppUserRole,
} from "@/lib/auth/roles";
import type { DashboardClientProps } from "./types";
import {
  OverviewTab,
  WellnessTab,
  ServicesTab,
  EcoTab,
  BillingTab,
  ProfileTab,
} from "./tabs";

export type DashboardTabValue = "overview" | "services" | "eco" | "wellness" | "billing" | "profile";

export default function Dashboard(props: DashboardClientProps) {
  const { user, dogs, serviceVisits, dataReadings, serviceSummary } = props;
  const [activeTab, setActiveTab] = useState<DashboardTabValue>("overview");
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const router = useRouter();
  const { data: session, update } = useSession();
  const availableRoles = useMemo(() => extractUserRoles(session), [session]);
  const activeRole = useMemo(() => extractActiveRole(session), [session]);
  const [switchingRole, setSwitchingRole] = useState<AppUserRole | null>(null);
  const [roleSwitchError, setRoleSwitchError] = useState<string | null>(null);

  const handleRoleChange = useCallback(
    async (event: ChangeEvent<HTMLSelectElement>) => {
      const nextRole = event.target.value as AppUserRole;
      if (!nextRole || nextRole === activeRole) {
        return;
      }
      try {
        setRoleSwitchError(null);
        setSwitchingRole(nextRole);
        await update?.({ activeRole: nextRole });
        router.replace(getDefaultRedirectForRole(nextRole));
      } catch (error) {
        console.error("[Dashboard] Failed to switch roles", error);
        setRoleSwitchError("Unable to switch roles right now.");
      } finally {
        setSwitchingRole(null);
      }
    },
    [activeRole, router, update],
  );

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value as DashboardTabValue);
    track("dashboard_tab_change", { tab: value });
  }, []);

  const derivedDogsCount = Math.max(dogs.length, user.dogsCount ?? 0);
  const hasDogProfile = dogs.length > 0;
  const summaryNextVisitIso =
    serviceSummary?.nextVisitDate ?? serviceSummary?.firstVisitDate ?? null;

  // Shared computed metrics
  const profilePercent = useMemo(() => {
    const fields: Array<[string, boolean]> = [
      ["Name", Boolean(user.name && user.name.trim().length > 0)],
      ["Phone", Boolean(user.phone && user.phone.trim().length > 0)],
      ["Address", Boolean(user.address && user.address.trim().length > 0)],
      ["City", Boolean(user.city && user.city.trim().length > 0)],
      ["ZIP code", Boolean(user.zipCode && user.zipCode.trim().length > 0)],
      ["At least 1 dog profile", hasDogProfile],
    ];
    const completed = fields.filter(([, ok]) => ok).length;
    return Math.round((completed / fields.length) * 100);
  }, [user, hasDogProfile]);

  const profileFields = useMemo(() => {
    return [
      ["Name", Boolean(user.name && user.name.trim().length > 0)],
      ["Phone", Boolean(user.phone && user.phone.trim().length > 0)],
      ["Address", Boolean(user.address && user.address.trim().length > 0)],
      ["City", Boolean(user.city && user.city.trim().length > 0)],
      ["ZIP code", Boolean(user.zipCode && user.zipCode.trim().length > 0)],
      ["At least 1 dog profile", hasDogProfile],
    ] as Array<[string, boolean]>;
  }, [user, hasDogProfile]);

  const totalGrams = useMemo(
    () => dataReadings.reduce((sum, r) => sum + (r.weight || 0), 0),
    [dataReadings],
  );

  const last30DaysCount = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return serviceVisits.filter(
      (visit) =>
        visit.status === "COMPLETED" &&
        new Date(visit.scheduledDate).getTime() >= cutoff,
    ).length;
  }, [serviceVisits]);

  const last7DaysCount = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return serviceVisits.filter(
      (visit) =>
        visit.status === "COMPLETED" &&
        new Date(visit.scheduledDate).getTime() >= cutoff,
    ).length;
  }, [serviceVisits]);

  const avgWeight30G = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const weights = dataReadings
      .filter(
        (r) => r.weight != null && new Date(r.timestamp).getTime() >= cutoff,
      )
      .map((r) => r.weight as number);
    if (weights.length === 0) return null;
    const sum = weights.reduce((a, b) => a + b, 0);
    return sum / weights.length;
  }, [dataReadings]);

  const fallbackWellnessReadings = useMemo(
    () =>
      dataReadings.map((reading) => ({
        id: reading.id,
        timestamp: reading.timestamp,
        colors: { normal: 0, yellow: 0, red: 0, black: 0, total: 0 },
        consistency: { normal: 0, soft: 0, dry: 0, total: 0 },
        issues: Array.isArray(reading.issues)
          ? reading.issues.filter(
              (issue): issue is string =>
                typeof issue === "string" && issue.trim().length > 0,
            )
          : [],
        color: reading.color || undefined,
        weight: typeof reading.weight === "number" ? reading.weight : undefined,
        volume: typeof reading.volume === "number" ? reading.volume : undefined,
        consistencyLabel:
          typeof reading.consistencyLabel === "string"
            ? reading.consistencyLabel
            : undefined,
      })),
    [dataReadings],
  );

  const wellnessReadings = useMemo(() => {
    const mediaReadings = buildWellnessReadingsFromMedia(
      serviceVisits.flatMap((visit) =>
        (visit.media ?? []).map((media) => ({
          id: media.id,
          capturedAt: new Date(media.capturedAt),
          analysisResult: media.analysisResult ?? null,
          stoolSampleId: media.stoolSampleId ?? null,
          stoolSampleView: media.stoolSampleView ?? null,
          assetType: media.assetType,
          reviewStatus: media.reviewStatus ?? null,
        })),
      ),
    );

    return mediaReadings.length > 0 ? mediaReadings : fallbackWellnessReadings;
  }, [serviceVisits, fallbackWellnessReadings]);

  const lastReadingAt = useMemo(() => {
    if (dataReadings.length === 0) return null;
    const ts = Math.max(
      ...dataReadings.map((r) => new Date(r.timestamp).getTime()),
    );
    return new Date(ts);
  }, [dataReadings]);

  const baseNextServiceAt = useMemo(() => {
    const nowTs = Date.now();
    const futureScheduled = serviceVisits
      .filter((v) => v.status === "SCHEDULED")
      .map((v) => new Date(v.scheduledDate))
      .filter((d) => d.getTime() >= nowTs)
      .sort((a, b) => a.getTime() - b.getTime());

    const isWeekly = serviceVisits.some((v) =>
      (v.serviceType || "").includes("WEEKLY"),
    );
    let cadenceNext: Date | null = null;
    if (isWeekly) {
      const mostRecentCompleted =
        serviceVisits
          .filter((v) => v.status === "COMPLETED")
          .map((v) => new Date(v.scheduledDate))
          .sort((a, b) => b.getTime() - a.getTime())[0] || null;
      if (mostRecentCompleted) {
        const n = new Date(mostRecentCompleted);
        do {
          n.setDate(n.getDate() + 7);
        } while (n.getTime() < nowTs);
        cadenceNext = n;
      }
    }

    const candidates = [futureScheduled[0], cadenceNext].filter(
      Boolean,
    ) as Date[];
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.getTime() - b.getTime());
    return candidates[0];
  }, [serviceVisits]);

  const resolvedNextServiceAt = useMemo(() => {
    if (baseNextServiceAt) return baseNextServiceAt;
    if (!summaryNextVisitIso) return null;
    const parsed = new Date(summaryNextVisitIso);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [baseNextServiceAt, summaryNextVisitIso]);

  const lastCompletedAt = useMemo(() => {
    const completed = serviceVisits
      .filter((v) => v.status === "COMPLETED")
      .map((v) => new Date(v.scheduledDate))
      .sort((a, b) => b.getTime() - a.getTime());
    return completed[0] || null;
  }, [serviceVisits]);

  const daysUntilNext = useMemo(() => {
    if (!baseNextServiceAt) return null;
    const ms = baseNextServiceAt.getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }, [baseNextServiceAt]);

  const resolvedDaysUntilNext = useMemo(() => {
    if (resolvedNextServiceAt) {
      const ms = resolvedNextServiceAt.getTime() - Date.now();
      return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
    }
    return daysUntilNext;
  }, [resolvedNextServiceAt, daysUntilNext]);

  const serviceStreak = useMemo(() => {
    const sorted = [...serviceVisits].sort(
      (a, b) =>
        new Date(b.scheduledDate).getTime() -
        new Date(a.scheduledDate).getTime(),
    );
    let count = 0;
    for (const v of sorted) {
      if (v.status === "COMPLETED") count += 1;
      else break;
    }
    return count;
  }, [serviceVisits]);

  const gramsThisMonth = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return dataReadings.reduce((sum, r) => {
      const t = new Date(r.timestamp);
      return t >= monthStart && t < monthEnd ? sum + (r.weight || 0) : sum;
    }, 0);
  }, [dataReadings]);

  const methaneThisMonthLbsEq = useMemo(() => {
    return gramsThisMonth * 0.002 * 0.67;
  }, [gramsThisMonth]);

  const recentInsightsLevel = useMemo(() => {
    const concerning = dataReadings.some((r) => {
      const c = (r.color || "").toLowerCase();
      return (
        c.includes("black") ||
        c.includes("tarry") ||
        c.includes("melena") ||
        c.includes("red")
      );
    });
    return concerning ? "WATCH" : "NORMAL";
  }, [dataReadings]);

  const referralUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/?ref=${user.id}`
      : `https://www.getinsightscoop.com/?ref=${user.id}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      track("referral_copy");
    } catch {
      // ignore
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Yardura Referral",
          text: "Get a clean yard + optional wellness signals. Use my link to join!",
          url: referralUrl,
        });
        track("referral_native_share");
      } else {
        await handleCopy();
      }
    } catch {
      // user cancelled
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Minimal Header Bar */}
      <header className="flex flex-col gap-4 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
            <img
              src="/brand/insightscoop-logo-horizontal.png"
            alt="InsightScoop"
            className="h-8 w-auto object-contain dark:brightness-0 dark:invert"
            />
          <div className="hidden sm:block h-6 w-px bg-graphite/10 dark:bg-white/20" />
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-graphite dark:text-white">
              Hey {user.name?.split(" ")[0] || "there"} 👋
            </p>
            <p className="text-xs text-graphite/50 dark:text-white/50">
              {derivedDogsCount} {derivedDogsCount === 1 ? "pup" : "pups"} · {user.city || "Your dashboard"}
            </p>
          </div>
              </div>
        <div className="flex flex-wrap items-center gap-2">
          {availableRoles.length > 1 ? (
            <div className="relative">
              <label className="sr-only" htmlFor="dashboard-role-switcher">
                Switch role
              </label>
              <select
                id="dashboard-role-switcher"
                value={activeRole ?? ""}
                onChange={handleRoleChange}
                disabled={switchingRole !== null || !activeRole}
                className="h-11 min-w-[170px] appearance-none rounded-xl border border-graphite/10 dark:border-white/15 bg-white/80 dark:bg-slate-900 px-4 pr-9 text-sm font-semibold text-graphite dark:text-white transition-all hover:border-graphite/20 dark:hover:bg-slate-800 disabled:opacity-60"
              >
                {availableRoles.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_DISPLAY_NAME[role]}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite/50 dark:text-white/60" />
            </div>
          ) : null}
            <a
              href="tel:+18774179273"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-graphite dark:bg-white text-white dark:text-graphite hover:bg-graphite-soft dark:hover:bg-white/90 transition-all text-sm font-semibold shadow-sm hover:shadow-md"
          >
            <PhoneCall className="size-4" />
            <span>Support</span>
          </a>
          <Link
            href="/account"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-graphite/10 dark:border-white/15 bg-white/80 dark:bg-slate-900 text-graphite dark:text-white hover:bg-white hover:border-graphite/20 dark:hover:bg-slate-800 transition-all text-sm font-semibold"
          >
            <User className="size-4" />
            <span>Account</span>
          </Link>
          <button
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label="Toggle color theme"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-graphite/10 dark:border-white/15 bg-white/80 dark:bg-slate-900 text-graphite/70 dark:text-white/80 hover:text-graphite hover:border-graphite/20 dark:hover:bg-slate-800 transition-all"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
        {roleSwitchError ? (
          <p className="text-xs text-red-500 dark:text-red-400">{roleSwitchError}</p>
        ) : null}
      </header>

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="space-y-6 md:space-y-8"
      >
        {/* Modern Tab Navigation */}
        <TabsList className="flex w-full items-center gap-1 overflow-x-auto pb-1 border-b border-graphite/5 dark:border-white/10 bg-transparent p-0 h-auto">
          {[
            { value: "overview", label: "Overview", icon: "🏠" },
            { value: "services", label: "Services", icon: "📅" },
            { value: "eco", label: "Eco Impact", icon: "🌱" },
            { value: "wellness", label: "Wellness", icon: "💚" },
            { value: "billing", label: "Billing", icon: "💳" },
            { value: "profile", label: "Profile", icon: "👤" },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="relative flex-shrink-0 px-4 py-3 text-sm font-medium text-graphite/50 dark:text-white/50 transition-all duration-200 rounded-none border-b-2 border-transparent data-[state=active]:border-coral data-[state=active]:text-graphite dark:data-[state=active]:text-white data-[state=active]:bg-transparent hover:text-graphite/80 dark:hover:text-white/80 bg-transparent shadow-none"
            >
              <span className="mr-1.5 hidden sm:inline">{tab.icon}</span>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <OverviewTab
            user={user}
            dogs={dogs}
            dataReadings={dataReadings}
            serviceVisits={serviceVisits}
            profilePercent={profilePercent}
            profileFields={profileFields}
            lastReadingAt={lastReadingAt}
            nextServiceAt={resolvedNextServiceAt}
            daysUntilNext={resolvedDaysUntilNext}
            serviceStreak={serviceStreak}
            last7DaysCount={last7DaysCount}
            last30DaysCount={last30DaysCount}
            avgWeight30G={avgWeight30G}
            gramsThisMonth={gramsThisMonth}
            totalGrams={totalGrams}
            methaneThisMonthLbsEq={methaneThisMonthLbsEq}
            recentInsightsLevel={recentInsightsLevel}
            referralUrl={referralUrl}
            serviceSummary={serviceSummary}
            onCopyReferral={handleCopy}
            onShareReferral={handleShare}
            onNavigateTab={handleTabChange}
          />
        </TabsContent>

        <TabsContent value="services" className="space-y-6">
          <ServicesTab
            serviceVisits={serviceVisits}
            nextServiceAt={resolvedNextServiceAt}
            daysUntilNext={resolvedDaysUntilNext}
            lastCompletedAt={lastCompletedAt}
            serviceStreak={serviceStreak}
            user={user}
            serviceSummary={serviceSummary}
            onNavigateTab={handleTabChange}
          />
        </TabsContent>

        <TabsContent value="eco" className="space-y-6">
          <EcoTab
            serviceVisits={serviceVisits}
            dataReadings={dataReadings}
            dogsCount={derivedDogsCount}
            frequency={serviceSummary?.frequency ?? user.serviceFrequency ?? "weekly"}
            divertMode={serviceSummary?.divertMode ?? null}
            serviceSummary={serviceSummary}
          />
        </TabsContent>

        <TabsContent value="wellness" className="space-y-6">
          <WellnessTab
            dataReadings={wellnessReadings}
            serviceVisits={serviceVisits.map((visit) => ({
              id: visit.id,
              date: visit.scheduledDate,
              type:
                visit.serviceType === "commercial"
                  ? "commercial"
                  : "residential",
              areas: [visit.yardSize],
              notes: undefined,
            }))}
          />
        </TabsContent>

        <TabsContent value="billing" className="space-y-6">
          <BillingTab user={user} serviceSummary={serviceSummary} />
        </TabsContent>

        <TabsContent value="profile" className="space-y-6">
          <ProfileTab
            user={user}
            dogs={dogs}
            serviceSummary={serviceSummary}
            profileFields={profileFields}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
