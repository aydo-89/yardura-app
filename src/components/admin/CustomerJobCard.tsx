"use client";

import { useState, startTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface CustomerJobCardProps {
  job: {
    id: string;
    frequencyLabel: string;
    nextVisitAt: string | null;
    status: string;
    stripeSubscriptionId: string | null;
    preferredTimeWindowLabel: string | null;
  };
}

export function CustomerJobCard({ job }: CustomerJobCardProps) {
  const router = useRouter();
  const [isCancelling, setIsCancelling] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [subscriptionDetails, setSubscriptionDetails] = useState<
    | {
        id: string;
        status: string;
        cancelAtPeriodEnd: boolean;
        currentPeriodStart: string | null;
        currentPeriodEnd: string | null;
        collectionMethod: string | null;
        latestInvoiceStatus: string | null;
        defaultPaymentMethod: string | null;
        metadata: Record<string, string>;
        items: Array<{
          id: string;
          quantity: number | null;
          amount: number | null;
          currency: string | null;
          interval: string | null;
          intervalCount: number | null;
          nickname: string | null;
          productId: string | null;
        }>;
      }
    | null
  >(null);

  const handleCancel = async () => {
    if (!job.stripeSubscriptionId) {
      toast.error("No subscription to cancel for this job");
      return;
    }

    const confirmed = confirm(
      "Cancel this subscription? This will stop future billing and mark the job as cancelled.",
    );
    if (!confirmed) return;

    setIsCancelling(true);
    try {
      const response = await fetch(`/api/admin/jobs/${job.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ immediate: true }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Failed to cancel subscription");
      }

      toast.success("Subscription cancelled");
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Unable to cancel subscription",
      );
    } finally {
      setIsCancelling(false);
    }
  };

  const formatAmount = (amount: number | null, currency: string | null) => {
    if (amount == null || currency == null) return " - ";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const loadDetails = async () => {
    if (!job.stripeSubscriptionId) return;
    if (subscriptionDetails) return;
    setLoadingDetails(true);
    try {
      const response = await fetch(`/api/admin/subscriptions/${job.stripeSubscriptionId}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Failed to load subscription");
      }
      const payload = await response.json();
      setSubscriptionDetails(payload.subscription);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Unable to fetch subscription",
      );
    } finally {
      setLoadingDetails(false);
    }
  };

  return (
    <div className="admin-card rounded-xl p-4">
      <p className="font-medium text-slate-900 dark:text-white">{job.frequencyLabel}</p>
      {job.preferredTimeWindowLabel ? (
        <p className="text-xs text-brand-mint">
          Preferred window: {job.preferredTimeWindowLabel}
        </p>
      ) : null}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Next visit: {job.nextVisitAt ? new Date(job.nextVisitAt).toLocaleDateString() : "TBD"}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="font-mono text-slate-600 dark:text-slate-300">{job.id}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {job.status.toLowerCase()}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Subscription: {job.stripeSubscriptionId || " - "}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" asChild className="h-8">
          <Link href={`/admin/jobs/${job.id}`}>View job details</Link>
        </Button>
        {job.stripeSubscriptionId ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDetailsOpen(true);
                void loadDetails();
              }}
              className="h-8"
            >
              View subscription details
            </Button>
            {job.status !== "CANCELED" ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCancel}
                disabled={isCancelling}
                className="h-8"
              >
                {isCancelling ? "Cancelling…" : "Cancel subscription"}
              </Button>
            ) : null}
          </>
        ) : null}
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="admin-card max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">Subscription details</DialogTitle>
            <DialogDescription>
              Stripe subscription for job {job.id}
            </DialogDescription>
          </DialogHeader>
          {loadingDetails ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
          ) : subscriptionDetails ? (
            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
              <div>
                <p className="font-medium text-slate-900 dark:text-white">Status</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {subscriptionDetails.status}
                  {subscriptionDetails.cancelAtPeriodEnd
                    ? " • Cancels at period end"
                    : ""}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="font-medium text-slate-700 dark:text-slate-200">Current period</p>
                  <p>
                    {subscriptionDetails.currentPeriodStart
                      ? new Date(subscriptionDetails.currentPeriodStart).toLocaleDateString()
                      : " - "}
                    {" → "}
                    {subscriptionDetails.currentPeriodEnd
                      ? new Date(subscriptionDetails.currentPeriodEnd).toLocaleDateString()
                      : " - "}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-700 dark:text-slate-200">Collection method</p>
                  <p>{subscriptionDetails.collectionMethod ?? " - "}</p>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <p className="font-medium text-slate-900 dark:text-white">Line items</p>
                {subscriptionDetails.items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-md border border-slate-200 p-3 text-xs dark:border-slate-700"
                  >
                    <p className="font-medium text-slate-700 dark:text-slate-200">
                      {item.nickname || item.productId || item.id}
                    </p>
                    <p className="text-slate-500 dark:text-slate-400">
                      {formatAmount(item.amount, item.currency)} • {item.interval}
                      {item.intervalCount && item.intervalCount > 1
                        ? ` x${item.intervalCount}`
                        : ""}
                      {item.quantity ? ` • Qty ${item.quantity}` : ""}
                    </p>
                  </div>
                ))}
              </div>
              {subscriptionDetails.metadata &&
              Object.keys(subscriptionDetails.metadata).length ? (
                <div>
                  <Separator className="my-2" />
                  <p className="font-medium text-slate-900 dark:text-white">Metadata</p>
                  <div className="mt-2 grid gap-1">
                    {Object.entries(subscriptionDetails.metadata).map(
                      ([key, value]) => (
                        <div key={key} className="text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-medium text-slate-700 dark:text-slate-200">{key}:</span> {value}
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Subscription details unavailable. Try again later.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
