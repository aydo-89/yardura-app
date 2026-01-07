"use client";

import { useMemo } from "react";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import { format } from "date-fns";
import { ArrowDownLeft, ArrowUpRight, Loader2, PiggyBank, Wallet2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }
  return response.json();
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

type EarningsSummary = {
  pendingAmountCents: number;
  monthPaidCents: number;
};

type Payout = {
  id: string;
  status: string;
  totalAmountCents: number;
  baseAmountCents: number;
  bonusAmountCents: number;
  mileageAmountCents: number;
  ppeAmountCents: number;
  tipsAmountCents: number;
  generatedAt: string;
  clearedAt: string | null;
  releasedAt: string | null;
  serviceVisit: {
    id: string;
    scheduledDate: string | null;
    tile: {
      id: string;
      name: string;
      slug: string;
    } | null;
    customer: {
      id: string;
      name: string | null;
      addressLine1: string | null;
      city: string | null;
    } | null;
  } | null;
};

type EarningsPage = {
  payouts: Payout[];
  summary: EarningsSummary;
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
    pageSize: number;
  };
};

function formatDollar(cents: number | null | undefined) {
  if (typeof cents !== "number") return "—";
  return currency.format(cents / 100);
}

function formatDate(date: string | null) {
  if (!date) return "Scheduled";
  const when = new Date(date);
  if (Number.isNaN(when.getTime())) return "Scheduled";
  return format(when, "EEE, MMM d");
}

function statusBadge(status: string) {
  switch (status) {
    case "PAID":
    case "RELEASED":
      return {
        label: "Paid",
        className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
      };
    case "READY":
      return {
        label: "Earned",
        className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
      };
    case "APPROVED":
      return {
        label: "Queued",
        className: "bg-slate-200 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200",
      };
    case "PENDING_REVIEW":
      return {
        label: "Pending QA",
        className:
          "border border-amber-300/70 bg-amber-200/80 text-amber-900 dark:border-amber-400/60 dark:bg-amber-500/25 dark:text-amber-100",
      };
    default:
      return {
        label: status.toLowerCase(),
        className: "bg-slate-200 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200",
      };
  }
}

export default function FieldTechEarningsPage() {
  const { data: summaryData } = useSWR<EarningsPage>("/api/field-tech/earnings?limit=1", fetcher, {
    revalidateOnFocus: false,
  });

  const {
    data,
    size,
    setSize,
    isLoading,
    isValidating,
  } = useSWRInfinite<EarningsPage>((index, previous) => {
    if (previous && !previous.pagination.hasMore) {
      return null;
    }

    const cursor = previous?.pagination.nextCursor ?? null;
    return cursor
      ? `/api/field-tech/earnings?limit=20&cursor=${cursor}`
      : `/api/field-tech/earnings?limit=20`;
  }, fetcher, {
    revalidateFirstPage: true,
  });

  const payouts = useMemo(
    () => data?.flatMap((page) => page.payouts) ?? [],
    [data],
  );

  const hasMore = data?.[data.length - 1]?.pagination.hasMore ?? false;

  const summary = summaryData?.summary ?? {
    pendingAmountCents: 0,
    monthPaidCents: 0,
  };

  return (
    <div className="flex flex-1 flex-col gap-6 pb-6">
      <section className="rounded-3xl border border-slate-200/70 dark:border-slate-900 bg-white dark:bg-slate-900/90 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15">
            <Wallet2 className="h-5 w-5 text-emerald-300" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Earnings pulse</p>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Ready to cash out</h1>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-2xl border border-slate-200/60 dark:border-white/5 bg-slate-100 dark:bg-slate-950/70 p-4">
            <p className="flex items-center gap-2 text-xs uppercase text-slate-400">
              <PiggyBank className="h-4 w-4 text-emerald-300" /> Pending balance
            </p>
            <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">{formatDollar(summary.pendingAmountCents)}</p>
            <p className="text-xs text-slate-500">Auto releases each Friday</p>
          </div>
          <div className="rounded-2xl border border-slate-200/60 dark:border-white/5 bg-slate-100 dark:bg-slate-950/70 p-4">
            <p className="flex items-center gap-2 text-xs uppercase text-slate-400">
              <ArrowUpRight className="h-4 w-4 text-slate-300" /> Paid this month
            </p>
            <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">{formatDollar(summary.monthPaidCents)}</p>
            <p className="text-xs text-slate-500">Cleared into your account</p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Payout history</h2>
          <Badge variant="outline" className="rounded-full border-slate-200/70 text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {payouts.length} records
          </Badge>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, idx) => (
              <Skeleton key={idx} className="h-24 rounded-3xl bg-white/80 dark:bg-slate-900/60" />
            ))}
          </div>
        ) : null}

        <div className="flex flex-col gap-4">
          {payouts.map((payout) => {
            const badge = statusBadge(payout.status);
            const serviceDate = payout.serviceVisit?.scheduledDate
              ? formatDate(payout.serviceVisit.scheduledDate)
              : "Scheduled";
            const cleared = payout.clearedAt ? formatDate(payout.clearedAt) : null;

            return (
              <article
                key={payout.id}
                className="rounded-3xl border border-slate-200/70 dark:border-slate-900 bg-white/90 dark:bg-slate-900/80 p-5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Service date</p>
                    <p className="mt-1 text-base font-semibold text-slate-900 dark:text-white">{serviceDate}</p>
                    {payout.serviceVisit?.customer?.name ? (
                      <p className="mt-1 text-sm text-slate-400">
                        {payout.serviceVisit.customer.name}
                        {payout.serviceVisit?.customer?.addressLine1
                          ? ` · ${payout.serviceVisit.customer.addressLine1}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">{formatDollar(payout.totalAmountCents)}</p>
                    <p className="text-xs text-slate-500">
                      Base {formatDollar(payout.baseAmountCents)} · Bonuses {formatDollar(payout.bonusAmountCents + payout.mileageAmountCents + payout.ppeAmountCents + payout.tipsAmountCents)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-2">
                    <Badge className={`rounded-full ${badge.className}`}>{badge.label}</Badge>
                    {cleared ? `Cleared ${cleared}` : "Pending release"}
                  </span>
                  <span className="flex items-center gap-1">
                    <ArrowDownLeft className="h-4 w-4" /> Generated {formatDate(payout.generatedAt)}
                  </span>
                </div>
              </article>
            );
          })}
        </div>

        {hasMore ? (
          <Button
            variant="outline"
            className="mt-2 w-full rounded-full border-slate-800 bg-slate-900/70 text-slate-200 hover:bg-slate-900"
            onClick={() => setSize(size + 1)}
            disabled={isValidating}
          >
            {isValidating ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading more
              </span>
            ) : (
              "Load more"
            )}
          </Button>
        ) : null}
      </section>
    </div>
  );
}
