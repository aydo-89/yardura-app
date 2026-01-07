"use client";

import { useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Check, Loader2, RefreshCcw, X } from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PayoutRequestStatus = "REQUESTED" | "APPROVED" | "PAID" | "REJECTED" | "CANCELLED";

type PayoutRequest = {
  id: string;
  status: PayoutRequestStatus;
  amountCents: number;
  requestedAt: string;
  reviewedAt: string | null;
  paidAt: string | null;
  payoutCount: number;
  scooper: {
    id: string;
    name: string | null;
    email: string | null;
  };
};

type PayoutResponse = {
  items: PayoutRequest[];
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? "Request failed");
  }
  return response.json();
};

const statusMessages: Record<string, string> = {
  payout_account_missing: "Scooper has no payout account on file.",
  payouts_not_enabled: "Scooper payout account is not enabled.",
  no_eligible_payouts: "No eligible payouts available to release.",
  already_paid: "This request is already marked as paid.",
  invalid_status: "This request is not in a payable state.",
  release_failed: "Release failed. Please retry or check server logs.",
};

function formatMoney(cents: number) {
  return currency.format(cents / 100);
}

function formatTimestamp(iso: string | null) {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";
  return format(parsed, "MMM d, h:mm a");
}

function statusBadge(status: PayoutRequestStatus) {
  switch (status) {
    case "REQUESTED":
      return { label: "Requested", className: "border-amber-300 bg-amber-100 text-amber-700" };
    case "PAID":
      return { label: "Paid", className: "border-emerald-300 bg-emerald-100 text-emerald-700" };
    case "REJECTED":
      return { label: "Rejected", className: "border-rose-300 bg-rose-100 text-rose-700" };
    case "CANCELLED":
      return { label: "Cancelled", className: "border-slate-200 bg-slate-100 text-slate-600" };
    case "APPROVED":
      return { label: "Approved", className: "border-sky-300 bg-sky-100 text-sky-700" };
    default:
      return { label: "Unknown", className: "border-slate-200 bg-slate-100 text-slate-600" };
  }
}

export default function AdminPayoutRequestsPage() {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [actionId, setActionId] = useState<string | null>(null);

  const { data, error, isLoading, mutate } = useSWR<PayoutResponse>(
    `/api/admin/payouts/requests?status=${statusFilter}`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const items = data?.items ?? [];

  const summary = useMemo(() => {
    const totals = {
      requestedCount: 0,
      requestedAmount: 0,
      paidCount: 0,
      paidAmount: 0,
      rejectedCount: 0,
    };

    for (const request of items) {
      if (request.status === "REQUESTED") {
        totals.requestedCount += 1;
        totals.requestedAmount += request.amountCents;
      }
      if (request.status === "PAID") {
        totals.paidCount += 1;
        totals.paidAmount += request.amountCents;
      }
      if (request.status === "REJECTED") {
        totals.rejectedCount += 1;
      }
    }

    return totals;
  }, [items]);

  const handleAction = async (requestId: string, action: "approve" | "reject") => {
    setActionId(requestId);
    try {
      const response = await fetch(`/api/admin/payouts/requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = payload?.error ? statusMessages[payload.error] ?? payload.error : "Request failed";
        toast.error(message);
        return;
      }

      toast.success(action === "approve" ? "Payout released" : "Request rejected");
      mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Request failed");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="admin-surface min-h-screen">
      <div className="container mx-auto space-y-8 px-6 pb-20 pt-16">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
              Field ops
            </div>
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
              Payout approvals
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-300">
              Review scooper withdrawal requests and release earned payouts.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[190px] rounded-full border border-slate-300 bg-white pl-4 pr-8 text-sm font-medium text-slate-700 shadow-sm transition hover:border-brand-mint focus-visible:ring-brand-mint/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-mint">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                <SelectItem value="ALL">All requests</SelectItem>
                <SelectItem value="REQUESTED">Requested</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="rounded-full border-slate-200 text-slate-600 hover:border-brand-mint/40 hover:text-brand-mint dark:border-slate-700 dark:text-slate-300"
              onClick={() => mutate()}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-2xl bg-slate-200/70 dark:bg-slate-800/60" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="admin-card rounded-2xl">
              <CardHeader className="pb-2 text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Requested
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                  {summary.requestedCount}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-300">
                  {formatMoney(summary.requestedAmount)} pending
                </p>
              </CardContent>
            </Card>
            <Card className="admin-card rounded-2xl">
              <CardHeader className="pb-2 text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Paid
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                  {summary.paidCount}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-300">
                  {formatMoney(summary.paidAmount)} released
                </p>
              </CardContent>
            </Card>
            <Card className="admin-card rounded-2xl">
              <CardHeader className="pb-2 text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Rejected
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                  {summary.rejectedCount}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-300">
                  Requests declined
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="admin-card overflow-hidden rounded-2xl">
          <Table>
            <TableHeader>
              <TableRow className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                <TableHead>Scooper</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Payouts</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {error ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-rose-600 dark:text-rose-300">
                    {error.message}
                  </TableCell>
                </TableRow>
              ) : null}
              {!error && !items.length && !isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    No payout requests found for this filter.
                  </TableCell>
                </TableRow>
              ) : null}
              {items.map((request) => {
                const badge = statusBadge(request.status);
                const scooperLabel = request.scooper?.name ?? request.scooper?.email ?? "Scooper";
                const requestedDate = new Date(request.requestedAt);
                const relative = Number.isNaN(requestedDate.getTime())
                  ? "—"
                  : `${formatDistanceToNow(requestedDate, { addSuffix: true })}`;

                return (
                  <TableRow key={request.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/60">
                    <TableCell className="text-sm font-medium text-slate-900 dark:text-white">
                      <div>{scooperLabel}</div>
                      {request.scooper?.email ? (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {request.scooper.email}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                      <div>{formatTimestamp(request.requestedAt)}</div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">{relative}</div>
                    </TableCell>
                    <TableCell className="text-sm font-semibold text-slate-900 dark:text-white">
                      {formatMoney(request.amountCents)}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                      {request.payoutCount} visits
                    </TableCell>
                    <TableCell>
                      <Badge className={`border ${badge.className}`}>{badge.label}</Badge>
                      {request.status === "PAID" ? (
                        <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                          Paid {formatTimestamp(request.paidAt)}
                        </div>
                      ) : null}
                      {request.status === "REJECTED" && request.reviewedAt ? (
                        <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                          Reviewed {formatTimestamp(request.reviewedAt)}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      {request.status === "REQUESTED" ? (
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            size="sm"
                            className="rounded-full bg-emerald-500 text-white hover:bg-emerald-500/90"
                            onClick={() => handleAction(request.id, "approve")}
                            disabled={actionId === request.id}
                          >
                            {actionId === request.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="mr-2 h-4 w-4" />
                            )}
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full border-rose-200 text-rose-600 hover:border-rose-300 hover:text-rose-700 dark:border-rose-400/40 dark:text-rose-200"
                            onClick={() => handleAction(request.id, "reject")}
                            disabled={actionId === request.id}
                          >
                            <X className="mr-2 h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {isLoading
                ? Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={`skeleton-${index}`}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-10 w-full rounded-xl bg-slate-200/70 dark:bg-slate-800/60" />
                      </TableCell>
                    </TableRow>
                  ))
                : null}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
