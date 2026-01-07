"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, PieChart, TrendingUp, Users } from "lucide-react";

const allowedRoles = [
  "ADMIN",
  "OWNER",
  "SALES_MANAGER",
  "FRANCHISE_OWNER",
];

type DurationRow = {
  label: string;
  averageMinutes: number;
  sampleCount: number;
};

type CombinedRow = {
  city: string;
  tile: string;
  scooper: string;
  averageMinutes: number;
  sampleCount: number;
};

type DurationResponse = {
  rangeStart: string;
  rangeEnd: string;
  overall: {
    averageMinutes: number;
    sampleCount: number;
  };
  byCity: DurationRow[];
  byTile: DurationRow[];
  byScooper: DurationRow[];
  byCityTileScooper: CombinedRow[];
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const formatMinutes = (value?: number | null) => {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)} min`;
};

export default function AdminAnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { data, error, isLoading } = useSWR<DurationResponse>(
    "/api/admin/analytics/visit-durations?rangeDays=90&limit=50",
    fetcher,
  );

  const rangeLabel = useMemo(() => {
    if (!data?.rangeStart || !data?.rangeEnd) return "Last 90 days";
    const start = new Date(data.rangeStart);
    const end = new Date(data.rangeEnd);
    return `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`;
  }, [data?.rangeEnd, data?.rangeStart]);

  useEffect(() => {
    if (status === "loading") return;
    const userRole = (session as any)?.userRole;
    if (!session || !allowedRoles.includes(userRole)) {
      router.push("/dashboard");
    }
  }, [session, status, router]);

  if (status === "loading") {
    return (
      <div className="admin-surface min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="admin-surface min-h-screen">
      <header className="border-b border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
        <div className="container mx-auto px-6 pb-12 pt-24 md:pb-12 md:pt-16">
          <div className="max-w-2xl space-y-3">
            <div className="flex items-center gap-3 admin-kicker">
              <TrendingUp className="h-4 w-4" />
              <span>Analytics</span>
            </div>
            <div className="space-y-2">
              <h1 className="admin-title">Analytics</h1>
              <p className="admin-subtitle">
                Visit duration analytics now track time on-site across tiles, cities, and scoopers. More dashboards roll out soon.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-8 px-6 pb-24 pt-12">
        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="admin-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-300">
                Avg visit duration
              </CardTitle>
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                {isLoading ? "Loading..." : formatMinutes(data?.overall.averageMinutes)}
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {data?.overall.sampleCount ?? 0} completed visits · {rangeLabel}
              </p>
            </CardContent>
          </Card>
          <Card className="admin-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-300">
                Cities tracked
              </CardTitle>
              <PieChart className="h-5 w-5 text-violet-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                {data?.byCity?.length ?? 0}
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Top cities by completed visits in the selected window.
              </p>
            </CardContent>
          </Card>
          <Card className="admin-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-300">
                Scoopers measured
              </CardTitle>
              <Users className="h-5 w-5 text-sky-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                {data?.byScooper?.length ?? 0}
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Completed routes with verified arrival + completion timestamps.
              </p>
            </CardContent>
          </Card>
        </section>

        {error ? (
          <Card className="admin-card border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100">
            <CardContent className="py-4 text-sm">
              Unable to load visit duration analytics right now.
            </CardContent>
          </Card>
        ) : null}

        <Card className="admin-card">
          <CardHeader>
            <CardTitle>Average duration by city</CardTitle>
            <CardDescription>Ranked by completed visit count.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>City</TableHead>
                  <TableHead>Avg duration</TableHead>
                  <TableHead className="text-right">Visits</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.byCity ?? []).map((row) => (
                  <TableRow key={row.label}>
                    <TableCell className="text-sm text-slate-700 dark:text-slate-200">
                      {row.label}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                      {formatMinutes(row.averageMinutes)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-slate-600 dark:text-slate-300">
                      {row.sampleCount}
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && (data?.byCity?.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                      No completed visits in this range.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="admin-card">
          <CardHeader>
            <CardTitle>Average duration by service tile</CardTitle>
            <CardDescription>Top tiles by visit volume.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tile</TableHead>
                  <TableHead>Avg duration</TableHead>
                  <TableHead className="text-right">Visits</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.byTile ?? []).map((row) => (
                  <TableRow key={row.label}>
                    <TableCell className="text-sm text-slate-700 dark:text-slate-200">
                      {row.label}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                      {formatMinutes(row.averageMinutes)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-slate-600 dark:text-slate-300">
                      {row.sampleCount}
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && (data?.byTile?.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                      No tile data yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="admin-card">
          <CardHeader>
            <CardTitle>Average duration by scooper</CardTitle>
            <CardDescription>All completed visits in the selected range.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scooper</TableHead>
                  <TableHead>Avg duration</TableHead>
                  <TableHead className="text-right">Visits</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.byScooper ?? []).map((row) => (
                  <TableRow key={row.label}>
                    <TableCell className="text-sm text-slate-700 dark:text-slate-200">
                      {row.label}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                      {formatMinutes(row.averageMinutes)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-slate-600 dark:text-slate-300">
                      {row.sampleCount}
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && (data?.byScooper?.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                      No scooper data yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="admin-card">
          <CardHeader>
            <CardTitle>City / Tile / Scooper breakdown</CardTitle>
            <CardDescription>Most common combinations by volume.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>City</TableHead>
                  <TableHead>Tile</TableHead>
                  <TableHead>Scooper</TableHead>
                  <TableHead>Avg duration</TableHead>
                  <TableHead className="text-right">Visits</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.byCityTileScooper ?? []).map((row, idx) => (
                  <TableRow key={`${row.city}-${row.tile}-${row.scooper}-${idx}`}>
                    <TableCell className="text-sm text-slate-700 dark:text-slate-200">{row.city}</TableCell>
                    <TableCell className="text-sm text-slate-600 dark:text-slate-300">{row.tile}</TableCell>
                    <TableCell className="text-sm text-slate-600 dark:text-slate-300">{row.scooper}</TableCell>
                    <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                      {formatMinutes(row.averageMinutes)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-slate-600 dark:text-slate-300">
                      {row.sampleCount}
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && (data?.byCityTileScooper?.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                      No combined data yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="admin-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-300">
                Pipeline health
              </CardTitle>
              <PieChart className="h-5 w-5 text-violet-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-slate-900 dark:text-white">Coming soon</div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Territory conversion, lead velocity, and canvass coverage will appear here.
              </p>
            </CardContent>
          </Card>

          <Card className="admin-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-300">
                Revenue & retention
              </CardTitle>
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-slate-900 dark:text-white">Coming soon</div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                MRR trends, churn risk signals, and upsell reporting integrate here next.
              </p>
            </CardContent>
          </Card>

          <Card className="admin-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-300">
                Team performance
              </CardTitle>
              <Users className="h-5 w-5 text-sky-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-slate-900 dark:text-white">Coming soon</div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Door knock output, cadence execution, and trip efficiency will surface here.
              </p>
            </CardContent>
          </Card>
        </section>

        <Card className="admin-card">
          <CardHeader>
            <CardTitle>What’s on deck</CardTitle>
            <CardDescription>
              We’re wiring the analytics service after cadence automation. Expect live dashboards once outbound parity milestones hit “Team Radar, Cadence Planner”.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <p>
              • Territory heatmaps and revenue KPIs fed by the new reporting service.<br />
              • Activity funnel (door knocks → appointments → wins) segmented by cadence.<br />
              • Exportable insights for franchise, finance, and field operations.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
