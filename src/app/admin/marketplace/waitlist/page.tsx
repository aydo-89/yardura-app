"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { format, formatDistanceToNow } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Users,
  Mail,
  MapPin,
  TrendingUp,
  Clock,
  Calendar,
  Search,
  ChevronRight,
  Sparkles,
  ArrowUpRight,
  Building2,
} from "lucide-react";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface WaitlistSignup {
  id: string;
  email: string;
  phone: string | null;
  placeId: string;
  cityName: string;
  state: string;
  population: number | null;
  source: string;
  createdAt: string;
  notifiedAt: string | null;
}

interface CityAggregate {
  cityName: string;
  state: string;
  placeId: string;
  count: number;
}

interface StateAggregate {
  state: string;
  count: number;
}

interface WaitlistResponse {
  signups: WaitlistSignup[];
  total: number;
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  summary: {
    totalSignups: number;
    todaySignups: number;
    last7DaysSignups: number;
    uniqueCities: number;
    uniqueStates: number;
  };
  byCity: CityAggregate[];
  byState: StateAggregate[];
}

// Launch threshold - same as on city page
const LAUNCH_THRESHOLD = 15;

export default function WaitlistMonitoringPage() {
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");

  const queryParams = new URLSearchParams();
  if (stateFilter) queryParams.set("state", stateFilter);
  if (search) queryParams.set("city", search);

  const { data, error, isLoading } = useSWR<WaitlistResponse>(
    `/api/admin/waitlist?${queryParams.toString()}`,
    fetcher,
    { refreshInterval: 30000 } // Refresh every 30 seconds
  );

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-950/30">
          <CardContent className="py-8 text-center">
            <p className="text-rose-700 dark:text-rose-300">
              Failed to load waitlist data. Please try again.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="admin-surface min-h-screen">
      <div className="container mx-auto max-w-7xl space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-3xl font-semibold text-slate-900 dark:text-white">
              Waitlist Monitoring
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-white/70">
              Track demand signals for service expansion
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              asChild
              variant="outline"
              className="rounded-xl border-brand-coral/30 dark:border-white/20 text-brand-coral hover:bg-brand-coral/10"
            >
              <Link href="/admin/marketplace/tiles">
                View Tiles
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[120px] rounded-2xl" />
            ))
          ) : (
            <>
              <Card className="admin-card">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    <Users className="h-4 w-4" />
                    Total Signups
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    {data?.summary.totalSignups ?? 0}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    All-time waitlist entries
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/30">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
                    <TrendingUp className="h-4 w-4" />
                    Today
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
                    +{data?.summary.todaySignups ?? 0}
                  </p>
                  <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-500">
                    New signups today
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-brand-gold/30 dark:border-brand-gold/20 bg-amber-50/50 dark:bg-amber-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-brand-gold">
                    <Clock className="h-4 w-4" />
                    Last 7 Days
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-amber-700 dark:text-brand-gold">
                    {data?.summary.last7DaysSignups ?? 0}
                  </p>
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
                    Recent momentum
                  </p>
                </CardContent>
              </Card>

              <Card className="admin-card">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    <Building2 className="h-4 w-4" />
                    Cities
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    {data?.summary.uniqueCities ?? 0}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Unique cities with interest
                  </p>
                </CardContent>
              </Card>

              <Card className="admin-card">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    <MapPin className="h-4 w-4" />
                    States
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    {data?.summary.uniqueStates ?? 0}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Geographic spread
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* Main Content - Cities by demand */}
          <div className="space-y-4">
            <Card className="admin-card">
              <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="font-serif text-lg text-slate-900 dark:text-white">
                      Cities by Demand
                    </CardTitle>
                    <CardDescription className="text-slate-600 dark:text-white/70">
                      Sorted by waitlist count. Cities need {LAUNCH_THRESHOLD}+ signups to trigger launch review.
                    </CardDescription>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Search cities..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-10 w-full rounded-xl border-slate-200 dark:border-white/15 bg-white dark:bg-slate-900/60 pl-10 text-sm sm:w-64"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 rounded-xl" />
                    ))}
                  </div>
                ) : data?.byCity.length ? (
                  <div className="space-y-3">
                    {data.byCity.map((city) => {
                      const progress = Math.min((city.count / LAUNCH_THRESHOLD) * 100, 100);
                      const isReadyForReview = city.count >= LAUNCH_THRESHOLD;
                      const isClose = city.count >= LAUNCH_THRESHOLD - 5 && !isReadyForReview;

                      return (
                        <div
                          key={city.placeId}
                          className={cn(
                            "rounded-2xl border p-4 transition",
                            isReadyForReview
                              ? "border-emerald-300 bg-emerald-50/80 dark:border-emerald-500/40 dark:bg-emerald-950/30"
                              : isClose
                                ? "border-amber-300 bg-amber-50/50 dark:border-brand-gold/30 dark:bg-amber-950/20"
                                : "border-slate-200 bg-white/80 dark:border-white/10 dark:bg-slate-900/50"
                          )}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-serif font-semibold text-slate-900 dark:text-white">
                                  {city.cityName}
                                </h3>
                                {isReadyForReview && (
                                  <Badge className="rounded-full bg-emerald-500 text-white text-[10px]">
                                    <Sparkles className="mr-1 h-3 w-3" />
                                    Ready
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-slate-600 dark:text-white/70">
                                {city.state}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {city.count}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                signups
                              </p>
                            </div>
                          </div>
                          
                          {/* Progress bar */}
                          <div className="mt-3 space-y-1">
                            <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
                              <span>Launch progress</span>
                              <span>{city.count} / {LAUNCH_THRESHOLD}</span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  isReadyForReview
                                    ? "bg-emerald-500"
                                    : isClose
                                      ? "bg-amber-500"
                                      : "bg-brand-coral"
                                )}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center dark:border-slate-700 dark:bg-slate-900/40">
                    <Users className="mx-auto h-10 w-10 text-slate-400" />
                    <p className="mt-3 text-sm text-slate-600 dark:text-white/70">
                      {search ? `No cities match "${search}"` : "No waitlist signups yet"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Signups */}
            <Card className="admin-card">
              <CardHeader>
                <CardTitle className="font-serif text-lg text-slate-900 dark:text-white">
                  Recent Signups
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-white/70">
                  Latest waitlist entries across all cities
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 rounded-xl" />
                    ))}
                  </div>
                ) : data?.signups.length ? (
                  <div className="divide-y divide-slate-200 dark:divide-white/10">
                    {data.signups.slice(0, 20).map((signup) => (
                      <div
                        key={signup.id}
                        className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-slate-400" />
                            <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                              {signup.email}
                            </p>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {signup.cityName}, {signup.state}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-600 dark:text-white/70">
                            {formatDistanceToNow(new Date(signup.createdAt), { addSuffix: true })}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {signup.source}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    No signups yet
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - States breakdown */}
          <div className="space-y-4">
            <Card className="admin-card">
              <CardHeader>
                <CardTitle className="font-serif text-lg text-slate-900 dark:text-white">
                  By State
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-white/70">
                  Geographic distribution of demand
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 rounded-lg" />
                    ))}
                  </div>
                ) : data?.byState.length ? (
                  <div className="space-y-2">
                    {data.byState.map((state, index) => {
                      const maxCount = data.byState[0]?.count ?? 1;
                      const width = (state.count / maxCount) * 100;

                      return (
                        <button
                          key={state.state}
                          onClick={() => setStateFilter(stateFilter === state.state ? "" : state.state)}
                          className={cn(
                            "w-full rounded-xl p-3 text-left transition",
                            stateFilter === state.state
                              ? "bg-brand-coral/10 ring-2 ring-brand-coral/40"
                              : "bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-slate-900 dark:text-white">
                              {state.state}
                            </span>
                            <span className="text-sm font-semibold text-slate-600 dark:text-white/80">
                              {state.count}
                            </span>
                          </div>
                          <div className="mt-2 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-brand-coral"
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    No data yet
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="rounded-2xl border-brand-coral/15 dark:border-white/10 bg-gradient-to-br from-brand-coral/5 to-brand-gold/5 dark:from-brand-coral/10 dark:to-brand-gold/10">
              <CardHeader>
                <CardTitle className="font-serif text-lg text-slate-900 dark:text-white">
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  asChild
                  variant="outline"
                  className="w-full justify-start rounded-xl border-brand-coral/30 text-brand-coral hover:bg-brand-coral/10"
                >
                  <Link href="/city">
                    <ArrowUpRight className="mr-2 h-4 w-4" />
                    View Public City Page
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="w-full justify-start rounded-xl border-slate-300 dark:border-white/20 text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  <Link href="/admin/marketplace/tiles">
                    <MapPin className="mr-2 h-4 w-4" />
                    Manage Tiles
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}





