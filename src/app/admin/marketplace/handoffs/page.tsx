"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface HandoffSummary {
  ok: true;
  data: {
    missed: {
      countThisQuarter: number;
      limit: number | null;
    };
    lateRelease: {
      countThisQuarter: number;
      limit: number | null;
    };
    earlyRelease: {
      countThisQuarter: number;
      limit: number | null;
    };
    jobRelease: {
      countThisQuarter: number;
      limit: number | null;
    };
  };
}

interface HandoffRow {
  scooperId: string;
  scooperName: string;
  missedCount: number;
  lateReleaseCount: number;
  earlyReleaseCount: number;
  jobReleaseCount: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function useHandoffActivity() {
  const { data, error, isLoading, mutate } = useSWR<HandoffSummary>(
    "/api/admin/marketplace/handoffs",
    fetcher,
    {
      revalidateOnFocus: false,
    },
  );

  return {
    data,
    error,
    isLoading,
    mutate,
  };
}

function useScooperBreakdown() {
  const { data, error, isLoading, mutate } = useSWR<
    { ok: true; data: HandoffRow[] } | { ok: false; error: string }
  >("/api/admin/marketplace/handoffs/scoopers", fetcher, {
    revalidateOnFocus: false,
  });

  const rows = useMemo(() => (data && data.ok ? data.data : []), [data]);

  return {
    rows,
    error,
    isLoading,
    mutate,
  };
}

function StatCard({
  title,
  description,
  value,
  limit,
}: {
  title: string;
  description: string;
  value: number;
  limit: number | null;
}) {
  const atLimit = typeof limit === "number" && value >= limit;
  const nearLimit =
    typeof limit === "number" && value >= Math.max(1, Math.floor(limit * 0.7));

  return (
    <div className="admin-card rounded-2xl p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
        {title}
      </p>
      <p
        className={cn(
          "mt-2 text-3xl font-semibold",
          atLimit && "text-rose-600 dark:text-rose-300",
          !atLimit && nearLimit && "text-amber-500 dark:text-amber-300",
          !atLimit && !nearLimit && "text-slate-900 dark:text-white",
        )}
      >
        {value}
        {typeof limit === "number" ? (
          <span className="ml-2 text-base font-medium text-slate-400 dark:text-slate-500">
            / {limit}
          </span>
        ) : null}
      </p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-32 rounded-xl bg-slate-200/70 dark:bg-slate-800/60" />
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 5 }).map((_, rowIndex) => (
        <Skeleton key={rowIndex} className="h-12 rounded-lg bg-slate-200/60 dark:bg-slate-800/50" />
      ))}
    </div>
  );
}

function ScooperTable({ rows }: { rows: HandoffRow[] }) {
  if (!rows.length) {
    return (
      <div className="admin-card rounded-2xl p-6 text-sm text-slate-600 dark:text-slate-300">
        No handoffs recorded this quarter.
      </div>
    );
  }

  return (
    <div className="admin-card overflow-hidden rounded-2xl">
      <Table>
        <TableHeader>
          <TableRow className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            <TableHead className="w-[28%]">Scooper</TableHead>
            <TableHead>Missed visits</TableHead>
            <TableHead>Late releases (&lt;48h)</TableHead>
            <TableHead>Early releases (48h+)</TableHead>
            <TableHead className="text-right">Recurring job releases</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const total =
              row.missedCount +
              row.lateReleaseCount +
              row.earlyReleaseCount +
              row.jobReleaseCount;

            return (
              <TableRow key={row.scooperId} className="hover:bg-slate-50 dark:hover:bg-slate-900/60">
                <TableCell className="font-medium text-slate-900 dark:text-white">
                  {row.scooperName || "Unassigned"}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      row.missedCount >= 3 && "text-rose-500 dark:text-rose-300",
                      row.missedCount > 0 && row.missedCount < 3 && "text-amber-500 dark:text-amber-300",
                      row.missedCount === 0 && "text-emerald-600 dark:text-emerald-300",
                    )}
                  >
                    {row.missedCount}
                  </span>
                </TableCell>
                <TableCell className="text-slate-600 dark:text-slate-300">
                  {row.lateReleaseCount}
                </TableCell>
                <TableCell className="text-slate-600 dark:text-slate-300">
                  {row.earlyReleaseCount}
                </TableCell>
                <TableCell className="text-right text-slate-600 dark:text-slate-300">
                  {row.jobReleaseCount}
                  <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">
                    ({total} total)
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export default function MarketplaceHandoffsPage() {
  const { data: summary, isLoading: summaryLoading } = useHandoffActivity();
  const { rows, isLoading: tableLoading } = useScooperBreakdown();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <OverviewSkeleton />;
  }

  return (
    <div className="admin-surface min-h-screen">
      <header className="border-b border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
        <div className="container mx-auto px-6 pb-12 pt-24 md:pb-12 md:pt-16">
          <div className="max-w-3xl space-y-3">
            <div className="admin-kicker">Scooper discipline</div>
            <h1 className="admin-title">Visit release oversight</h1>
            <p className="admin-subtitle">
              Track missed visits, late releases, and recurring job drops so you can keep coverage
              dependable and coach early.
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 md:px-8">
        {summaryLoading || !summary ? (
          <OverviewSkeleton />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Missed visits"
              description="Most serious. Three missed visits removes access."
              value={summary.data.missed.countThisQuarter}
              limit={summary.data.missed.limit}
            />
            <StatCard
              title="Late releases"
              description="Releases within 48 hours of the visit."
              value={summary.data.lateRelease.countThisQuarter}
              limit={summary.data.lateRelease.limit}
            />
            <StatCard
              title="Early releases"
              description="Releases 48+ hours before the visit."
              value={summary.data.earlyRelease.countThisQuarter}
              limit={summary.data.earlyRelease.limit}
            />
            <StatCard
              title="Recurring job releases"
              description="Full recurring jobs released this quarter."
              value={summary.data.jobRelease.countThisQuarter}
              limit={summary.data.jobRelease.limit}
            />
          </div>
        )}

        <section>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Scooper accountability
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Counts reset each quarter. Late releases allow 5 per quarter. Recurring job releases
              are capped to protect route stability.
            </p>
          </div>
          {tableLoading ? <TableSkeleton /> : <ScooperTable rows={rows} />}
        </section>
      </main>
    </div>
  );
}
