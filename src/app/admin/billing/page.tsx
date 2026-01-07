"use client";

import useSWR from "swr";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface PlanSummary {
  jobId: string;
  customerId: string;
  orgId: string;
  billingPreference: string | null;
  recurringAmountCents: number | null;
  perVisitAmountCents: number | null;
  trial: {
    trialEndsAt: string | null;
    firstChargeAt: string | null;
    status: string | null;
  };
  billingAutomation: {
    lastBaseEntryAt: string | null;
    billingCadenceDays: number | null;
  };
  weekendUpgrade: boolean;
  stripe: {
    customerId: string | null;
    subscriptionId: string | null;
    scheduleId: string | null;
  };
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string;
  } | null;
  job: {
    id: string;
    frequency: string;
    status: string;
  } | null;
}

interface LedgerEntrySummary {
  id: string;
  jobId: string;
  customerId: string;
  serviceVisitId: string | null;
  type: string;
  status: string;
  amountCents: number;
  description: string | null;
  createdAt: string;
  appliedAt: string | null;
  stripeInvoiceId: string | null;
  metadata: any;
  quickbooks: {
    status: string | null;
    lastAttempt: string | null;
    note: string | null;
  } | null;
  stripe: {
    status: string | null;
    invoiceItemId: string | null;
    description: string | null;
  } | null;
  serviceVisit: {
    id: string;
    scheduledDate: string | null;
    status: string;
  } | null;
}

interface DashboardResponse {
  orgId: string;
  plans: {
    total: number;
    skip: number;
    take: number;
    items: PlanSummary[];
  };
  ledger: {
    total: number;
    skip: number;
    take: number;
    items: LedgerEntrySummary[];
    summary: {
      pendingChargesCents: number;
      pendingCreditsCents: number;
      appliedAmountCents: number;
    };
  };
  integrations?: {
    quickbooks: QuickBooksIntegrationSummary;
  };
}

interface QuickBooksIntegrationSummary {
  enabled: boolean;
  needsReconnect: boolean;
  lastSyncAt: string | null;
  counts: {
    pending: number;
    queued: number;
    blocked: number;
  };
}

type FilterState = {
  orgId: string;
  customerId: string;
  jobId: string;
  status: string;
  startDate: string;
  endDate: string;
};

function fetcher(url: string) {
  return fetch(url, { cache: "no-store" }).then((res) => {
    if (!res.ok) {
      throw new Error(`Request failed with status ${res.status}`);
    }
    return res.json();
  });
}

function normalizeDateParam(value: string | null): string {
  if (!value) return "";
  return value.includes("T") ? value.slice(0, 10) : value;
}

function extractFilters(search: URLSearchParams | null): FilterState {
  if (!search) {
    return {
      orgId: "",
      customerId: "",
      jobId: "",
      status: "",
      startDate: "",
      endDate: "",
    };
  }

  return {
    orgId: search.get("orgId") ?? "",
    customerId: search.get("customerId") ?? "",
    jobId: search.get("jobId") ?? "",
    status: search.get("status") ?? "",
    startDate: normalizeDateParam(search.get("startDate")),
    endDate: normalizeDateParam(search.get("endDate")),
  };
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
});

function formatAmount(cents: number | null | undefined) {
  if (!Number.isFinite(cents || null)) return "—";
  const value = (cents ?? 0) / 100;
  return currencyFormatter.format(value);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "MMM d, yyyy");
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "MMM d, yyyy h:mm a");
}

function quickBooksEvents(data?: DashboardResponse) {
  if (!data) return [] as LedgerEntrySummary[];
  return [...data.ledger.items]
    .filter((entry) => Boolean(entry.quickbooks?.lastAttempt))
    .sort((a, b) => {
      const aTime = a.quickbooks?.lastAttempt ? new Date(a.quickbooks.lastAttempt).getTime() : 0;
      const bTime = b.quickbooks?.lastAttempt ? new Date(b.quickbooks.lastAttempt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 5);
}

function ManualCreditButton({
  plan,
  onResult,
}: {
  plan: PlanSummary;
  onResult: (type: "success" | "error", message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setAmount("");
    setReason("");
    setDescription("");
    setFormError(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    setFormError(null);

    const parsedAmount = Number.parseFloat(amount);
    const amountCents = Number.isFinite(parsedAmount)
      ? Math.round(parsedAmount * 100)
      : NaN;

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setFormError("Enter a positive amount (in dollars)");
      return;
    }

    if (!reason.trim()) {
      setFormError("Add a short reason for the adjustment");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/billing/ledger/apply-credit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: plan.job?.id ?? plan.jobId,
          customerId: plan.customerId,
          orgId: plan.orgId,
          amountCents,
          reason: reason.trim(),
          description: description.trim() || undefined,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          typeof payload?.error === "string"
            ? payload.error
            : "Unable to apply credit";
        setFormError(message);
        onResult("error", message);
        return;
      }

      onResult("success", "Manual credit applied to billing ledger");
      setOpen(false);
      resetState();
    } catch (error) {
      setFormError("Unexpected error applying credit");
      onResult("error", "Unexpected error applying credit");
    } finally {
      setIsSubmitting(false);
    }
  }, [amount, description, onResult, plan.customerId, plan.job?.id, plan.jobId, plan.orgId, reason, resetState]);

  return (
    <Dialog open={open} onOpenChange={(next) => {
      setOpen(next);
      if (!next) {
        resetState();
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Apply manual credit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Apply manual credit</DialogTitle>
          <DialogDescription>
            Credit will be recorded against {plan.customer?.name ?? "this customer"} and the
            job {plan.job?.id ?? plan.jobId}. Credits post as negative ledger entries.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="credit-amount">Amount (USD)</Label>
            <Input
              id="credit-amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="25.00"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="credit-reason">Reason</Label>
            <Input
              id="credit-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g., Missed visit adjustment"
              maxLength={500}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="credit-notes">Notes (optional)</Label>
            <Textarea
              id="credit-notes"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Visible to admins only"
              maxLength={200}
            />
          </div>
          {formError && (
            <p className="text-sm text-rose-600">{formError}</p>
          )}
        </div>
        <DialogFooter className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={isSubmitting}
            onClick={() => {
              setOpen(false);
              resetState();
            }}
          >
            Cancel
          </Button>
          <Button type="button" disabled={isSubmitting} onClick={handleSubmit}>
            {isSubmitting ? "Applying..." : "Apply credit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlanCard({
  plan,
  onCreditApplied,
}: {
  plan: PlanSummary;
  onCreditApplied: (type: "success" | "error", message: string) => void;
}) {
  return (
    <Card className="border-muted/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          {plan.customer?.name ?? "Unknown customer"}
          {plan.weekendUpgrade && (
            <Badge variant="outline" className="text-xs uppercase">
              Weekend Coverage
            </Badge>
          )}
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          {plan.customer?.address}
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Billing preference</span>
          <span className="font-medium uppercase">
            {plan.billingPreference ?? "—"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Recurring amount</span>
          <span className="font-medium">
            {formatAmount(plan.recurringAmountCents)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Per-visit amount</span>
          <span className="font-medium">
            {formatAmount(plan.perVisitAmountCents)}
          </span>
        </div>
        <Separator className="my-2" />
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Trial status</span>
          <span className="font-medium capitalize">
            {plan.trial.status ?? "—"}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Trial ends</span>
          <span>{formatDate(plan.trial.trialEndsAt)}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>First charge</span>
          <span>{formatDate(plan.trial.firstChargeAt)}</span>
        </div>
        <Separator className="my-2" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Stripe subscription</span>
          <span>{plan.stripe.subscriptionId ?? "—"}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Last base charge</span>
          <span>{formatDate(plan.billingAutomation.lastBaseEntryAt)}</span>
        </div>
        <Separator className="my-2" />
        <div className="flex justify-end">
          <ManualCreditButton plan={plan} onResult={onCreditApplied} />
        </div>
      </CardContent>
    </Card>
  );
}

function VoidEntryAction({
  entry,
  onResult,
}: {
  entry: LedgerEntrySummary;
  onResult: (type: "success" | "error", message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/billing/ledger/void", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId: entry.id,
          reason: reason.trim() || undefined,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          typeof payload?.error === "string"
            ? payload.error
            : "Unable to void ledger entry";
        setError(message);
        onResult("error", message);
        return;
      }

      onResult("success", "Ledger entry voided");
      setOpen(false);
      setReason("");
    } catch (error) {
      setError("Unexpected error voiding ledger entry");
      onResult("error", "Unexpected error voiding ledger entry");
    } finally {
      setIsSubmitting(false);
    }
  }, [entry.id, onResult, reason]);

  if (entry.status !== "PENDING") {
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setReason("");
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Void entry
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Void ledger entry</DialogTitle>
          <DialogDescription>
            This marks the entry as void and removes it from the next invoice cycle. Payouts tied
            to the visit are voided as well.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="text-sm text-muted-foreground">
            Amount: {formatAmount(entry.amountCents)} • Created {formatDate(entry.createdAt)}
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`void-reason-${entry.id}`}>Reason (optional)</Label>
            <Textarea
              id={`void-reason-${entry.id}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g., duplicate charge"
            />
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>
        <DialogFooter className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={isSubmitting}
            onClick={() => {
              setOpen(false);
              setReason("");
              setError(null);
            }}
          >
            Cancel
          </Button>
          <Button type="button" disabled={isSubmitting} onClick={handleSubmit}>
            {isSubmitting ? "Voiding..." : "Void entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LedgerEntryDetailButton({
  entry,
  stripeDashboardBase,
}: {
  entry: LedgerEntrySummary;
  stripeDashboardBase: string;
}) {
  const [open, setOpen] = useState(false);
  const invoiceHref = entry.stripeInvoiceId
    ? `${stripeDashboardBase}${entry.stripeInvoiceId}`
    : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Details
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ledger entry details</DialogTitle>
          <DialogDescription>
            Track Stripe invoicing and QuickBooks sync state for this ledger entry.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Entry ID</span>
              <code className="text-xs">{entry.id}</code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Type</span>
              <Badge variant="outline" className="uppercase text-xs">
                {entry.type}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge
                variant={
                  entry.status === "APPLIED"
                    ? "default"
                    : entry.status === "PENDING"
                      ? "secondary"
                      : "outline"
                }
                className="uppercase text-xs"
              >
                {entry.status}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-medium">{formatAmount(entry.amountCents)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{formatDateTime(entry.createdAt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Applied</span>
              <span>{formatDateTime(entry.appliedAt)}</span>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Stripe</h3>
            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Invoice ID</span>
                {invoiceHref ? (
                  <Button variant="link" className="h-auto p-0 text-sm" asChild>
                    <a href={invoiceHref} target="_blank" rel="noopener noreferrer">
                      {entry.stripeInvoiceId}
                    </a>
                  </Button>
                ) : (
                  <span>—</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium">
                  {entry.stripe?.status ?? (entry.stripeInvoiceId ? "linked" : "—")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Invoice item</span>
                <span>{entry.stripe?.invoiceItemId ?? "—"}</span>
              </div>
              {entry.stripe?.description && (
                <p className="text-xs text-muted-foreground">{entry.stripe.description}</p>
              )}
              {needsStripeGeneration(entry) && (
                <p className="text-xs text-amber-600">
                  This entry is pending and has not been attached to a Stripe invoice yet.
                </p>
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">QuickBooks</h3>
            {entry.quickbooks ? (
              <div className="grid gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="outline" className="uppercase text-xs">
                    {entry.quickbooks.status ?? "—"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Last attempt</span>
                  <span>{formatDateTime(entry.quickbooks.lastAttempt)}</span>
                </div>
                {entry.quickbooks.note && (
                  <p className="text-xs text-muted-foreground">{entry.quickbooks.note}</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                This entry has not been queued for QuickBooks yet.
              </p>
            )}
          </div>

          <Separator />

          <details className="rounded-md border border-muted/40 bg-muted/10 p-3">
            <summary className="cursor-pointer text-xs font-semibold uppercase text-muted-foreground">
              Raw metadata
            </summary>
            <pre className="mt-2 max-h-60 overflow-auto rounded bg-background/60 p-3 text-[11px]">
{JSON.stringify(entry.metadata ?? {}, null, 2)}
            </pre>
          </details>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function needsStripeGeneration(entry: LedgerEntrySummary) {
  return entry.status === "PENDING" && !entry.stripeInvoiceId;
}

function LedgerTable({
  entries,
  onEntryUpdated,
  stripeDashboardBase,
}: {
  entries: LedgerEntrySummary[];
  onEntryUpdated: (type: "success" | "error", message: string) => void;
  stripeDashboardBase: string;
}) {
  if (!entries.length) {
    return (
      <div className="rounded-lg border border-muted/40 p-8 text-center text-sm text-muted-foreground">
        No ledger entries found for the selected filters.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-muted/40">
      <div className="grid grid-cols-7 bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
        <div className="px-4 py-3">Date</div>
        <div className="px-4 py-3">Type</div>
        <div className="px-4 py-3 col-span-2">Description</div>
        <div className="px-4 py-3 text-right">Amount</div>
        <div className="px-4 py-3">Status</div>
        <div className="px-4 py-3">Actions</div>
      </div>
      <div className="divide-y divide-muted/30 bg-card">
        {entries.map((entry) => {
          const amountClass = entry.amountCents >= 0 ? "text-emerald-600" : "text-rose-600";
          const visitInfo = entry.serviceVisit
            ? formatDate(entry.serviceVisit.scheduledDate)
            : "—";
          const needsInvoice = entry.status === "PENDING" && !entry.stripeInvoiceId;
          const stripeStatusLabel = entry.stripe?.status ?? (entry.stripeInvoiceId ? "linked" : null);
          const invoiceHref = entry.stripeInvoiceId
            ? `${stripeDashboardBase}${entry.stripeInvoiceId}`
            : null;

          return (
            <div key={entry.id} className="grid grid-cols-7 text-sm">
              <div className="px-4 py-3 text-muted-foreground">
                {formatDate(entry.createdAt)}
              </div>
              <div className="px-4 py-3">
                <Badge variant="outline" className="text-xs uppercase">
                  {entry.type}
                </Badge>
              </div>
              <div className="px-4 py-3 col-span-2">
                <div className="font-medium">{entry.description ?? "—"}</div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>
                    Visit: {visitInfo}
                    {needsInvoice && (
                      <span className="ml-2 font-semibold text-amber-600">
                        Needs invoice sync
                      </span>
                    )}
                  </div>
                  {stripeStatusLabel && (
                    <div className="flex items-center gap-2">
                      <span>Stripe:</span>
                      <Badge variant="outline" className="uppercase text-[10px]">
                        {stripeStatusLabel}
                      </Badge>
                      {entry.stripe?.invoiceItemId && (
                        <span className="text-muted-foreground/80">Item {entry.stripe.invoiceItemId}</span>
                      )}
                    </div>
                  )}
                  {entry.stripeInvoiceId && (
                    <div>Invoice: {entry.stripeInvoiceId}</div>
                  )}
                  {entry.quickbooks && (
                    <div className="flex items-center gap-2">
                      <span>QuickBooks:</span>
                      <Badge variant="outline" className="uppercase text-[10px]">
                        {entry.quickbooks.status ?? "—"}
                      </Badge>
                      <span className="text-muted-foreground/80">
                        {formatDateTime(entry.quickbooks.lastAttempt)}
                      </span>
                    </div>
                  )}
                  {entry.quickbooks?.note && (
                    <div className="text-muted-foreground/70">{entry.quickbooks.note}</div>
                  )}
                </div>
              </div>
              <div className="px-4 py-3 text-right font-semibold">
                <span className={cn(amountClass)}>{formatAmount(entry.amountCents)}</span>
              </div>
              <div className="px-4 py-3">
                <Badge
                  variant={
                    entry.status === "APPLIED"
                      ? "default"
                      : entry.status === "PENDING"
                        ? "secondary"
                        : "outline"
                  }
                  className="text-xs uppercase"
                >
                  {entry.status}
                </Badge>
              </div>
              <div className="px-4 py-3 flex flex-wrap items-center gap-2">
                {invoiceHref && (
                  <Button variant="ghost" size="sm" asChild>
                    <a href={invoiceHref} target="_blank" rel="noopener noreferrer">
                      View invoice
                    </a>
                  </Button>
                )}
                <LedgerEntryDetailButton
                  entry={entry}
                  stripeDashboardBase={stripeDashboardBase}
                />
                <VoidEntryAction entry={entry} onResult={onEntryUpdated} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="admin-card">
      <CardContent className="p-4">
        <div className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
          {label}
        </div>
        <div className="text-2xl font-semibold text-slate-900 dark:text-white">{value}</div>
      </CardContent>
    </Card>
  );
}

function QuickBooksCard({
  summary,
  events,
  onAction,
}: {
  summary?: QuickBooksIntegrationSummary;
  events?: LedgerEntrySummary[];
  onAction?: (type: "success" | "error", message: string) => void;
}) {
  const enabled = summary?.enabled ?? false;
  const needsReconnect = summary?.needsReconnect ?? false;
  const pendingEntries = summary?.counts?.pending ?? 0;
  const queuedEntries = summary?.counts?.queued ?? 0;
  const blockedEntries = summary?.counts?.blocked ?? 0;
  const lastSyncAt = formatDateTime(summary?.lastSyncAt ?? null);
  const recentEvents = events ?? [];

  const [isSyncing, setIsSyncing] = useState(false);

  const handleManualSync = useCallback(async () => {
    if (!enabled) return;
    setIsSyncing(true);
    try {
      const response = await fetch("/api/admin/billing/quickbooks/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          typeof payload?.message === "string"
            ? payload.message
            : typeof payload?.error === "string"
              ? payload.error
              : "Unable to enqueue QuickBooks sync";
        onAction?.("error", message);
        return;
      }

      onAction?.("success", "QuickBooks sync job queued");
    } catch (error) {
      onAction?.("error", "Unexpected error queuing QuickBooks sync");
    } finally {
      setIsSyncing(false);
    }
  }, [enabled, onAction]);

  return (
    <Card className="admin-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
          QuickBooks integration
          <Badge variant={enabled ? "outline" : "secondary"} className="uppercase text-xs">
            {enabled ? "Enabled" : "Disabled"}
          </Badge>
          {needsReconnect && (
            <Badge variant="destructive" className="uppercase text-xs">
              Needs reconnect
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400">Pending ledger entries</span>
          <span className="font-semibold text-slate-900 dark:text-white">{pendingEntries}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400">Queued for sync</span>
          <span className="font-semibold text-slate-900 dark:text-white">{queuedEntries}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400">Blocked (needs credentials)</span>
          <span className="font-semibold text-slate-900 dark:text-white">{blockedEntries}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400">Last sync attempt</span>
          <span className="font-semibold text-slate-900 dark:text-white">{enabled ? lastSyncAt : "—"}</span>
        </div>
        {!enabled && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            QuickBooks sync is optional. Enable it from business integrations when credentials are
            ready; manual credits will remain queued with status <code>pending</code> until then.
          </p>
        )}
        {needsReconnect && (
          <p className="text-xs text-amber-600 dark:text-amber-300">
            We detected a reconnect requirement. Visit the integrations panel to refresh
            credentials—new manual credits are flagged as blocked until QuickBooks is reconnected.
          </p>
        )}
        {recentEvents.length > 0 && (
          <div className="space-y-2 pt-2">
            <Separator />
            <div className="text-xs uppercase text-muted-foreground">Recent sync attempts</div>
            <div className="space-y-1">
              {recentEvents.map((event) => {
                const status = event.quickbooks?.status ?? "—";
                const amount = formatAmount(event.amountCents);
                return (
                  <div
                    key={event.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/40"
                  >
                    <div className="text-xs text-muted-foreground">
                      <div className="font-medium text-foreground">
                        {formatDateTime(event.quickbooks?.lastAttempt ?? null)}
                      </div>
                      <div>
                        {amount} • {event.description ?? event.type}
                      </div>
                    </div>
                    <Badge variant="outline" className="uppercase text-[10px]">
                      {status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!enabled || isSyncing}
            onClick={handleManualSync}
            className="rounded-full"
          >
            {isSyncing ? "Syncing..." : "Run sync"}
          </Button>
          <Button asChild size="sm" variant="ghost" className="rounded-full">
            <a href="/admin/integrations">Manage integration</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}

function ErrorState({ error }: { error: Error }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Unable to load billing data</AlertTitle>
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  );
}

export default function AdminBillingPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState("plans");
  const paramsKey = params?.toString() ?? "";

  const [filters, setFilters] = useState<FilterState>(() => extractFilters(params));
  const [pageSize, setPageSize] = useState<string>(params?.get("take") ?? "25");
  const [actionMessage, setActionMessage] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);

  const stripeDashboardBase = useMemo(() => {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
    const isLive = publishableKey.startsWith("pk_live") || publishableKey.startsWith("live");
    return isLive
      ? "https://dashboard.stripe.com/invoices/"
      : "https://dashboard.stripe.com/test/invoices/";
  }, []);

  useEffect(() => {
    const nextFilters = extractFilters(params);
    setFilters((current) => {
      if (JSON.stringify(current) === JSON.stringify(nextFilters)) {
        return current;
      }
      return nextFilters;
    });

    const nextTake = params?.get("take") ?? "25";
    setPageSize((current) => (current === nextTake ? current : nextTake));
  }, [paramsKey]);

  const searchParams = useMemo(() => {
    const safeParams = params ?? new URLSearchParams();
    const entries = Array.from(safeParams.entries());
    const filtered = entries.filter(([key]) =>
      ["orgId", "customerId", "jobId", "status", "startDate", "endDate", "skip", "take"].includes(key),
    );
    const query = new URLSearchParams(filtered);
    return query.toString() ? `?${query.toString()}` : "";
  }, [params]);

  const exportUrl = useMemo(() => {
    const raw = params?.toString() ?? "";
    const query = new URLSearchParams(raw);
    if (!query.get("limit")) {
      query.set("limit", "5000");
    }
    return query.toString()
      ? `/api/admin/billing/ledger/export?${query.toString()}`
      : `/api/admin/billing/ledger/export?limit=5000`;
  }, [paramsKey]);

  const { data, error, isLoading, mutate } = useSWR<DashboardResponse>(
    `/api/admin/billing/dashboard${searchParams}`,
    fetcher,
  );

  const recentQuickBooksEvents = useMemo(() => quickBooksEvents(data), [data]);

  const handleActionResult = useCallback(
    (type: "success" | "error", message: string) => {
      setActionMessage({ type, message });
      if (type === "success") {
        void mutate();
      }
    },
    [mutate],
  );

  const handleApplyFilters = useCallback(() => {
    const query = new URLSearchParams();
    if (filters.orgId.trim()) query.set("orgId", filters.orgId.trim());
    if (filters.customerId.trim()) query.set("customerId", filters.customerId.trim());
    if (filters.jobId.trim()) query.set("jobId", filters.jobId.trim());
    if (filters.status) query.set("status", filters.status);
    if (filters.startDate) query.set("startDate", filters.startDate);
    if (filters.endDate) query.set("endDate", filters.endDate);
    if (pageSize && pageSize !== "25") query.set("take", pageSize);

    const search = query.toString();
    router.replace(search ? `?${search}` : "");
  }, [filters, pageSize, router]);

  const handleClearFilters = useCallback(() => {
    setFilters({
      orgId: "",
      customerId: "",
      jobId: "",
      status: "",
      startDate: "",
      endDate: "",
    });
    setPageSize("25");
    router.replace("");
  }, [router]);

  const handlePageChange = useCallback(
    (direction: number) => {
      if (!data) return;
      const currentSkip = data.plans.skip;
      const take = data.plans.take;
      const nextSkip = Math.max(currentSkip + direction * take, 0);

      if (nextSkip === currentSkip) return;
      if (nextSkip >= data.plans.total && direction > 0) return;

      const query = new URLSearchParams(params?.toString() ?? "");
      if (nextSkip > 0) {
        query.set("skip", String(nextSkip));
      } else {
        query.delete("skip");
      }
      const search = query.toString();
      router.replace(search ? `?${search}` : "");
    },
    [data, params, router],
  );

  const handlePageSizeChange = useCallback(
    (value: string) => {
      setPageSize(value);
      const query = new URLSearchParams(params?.toString() ?? "");
      if (value === "25") {
        query.delete("take");
      } else {
        query.set("take", value);
      }
      query.delete("skip");
      const search = query.toString();
      router.replace(search ? `?${search}` : "");
    },
    [params, router],
  );

  const handleExport = useCallback(() => {
    window.open(exportUrl, "_blank");
  }, [exportUrl]);

  if (isLoading) {
    return <LoadingState />;
  }

  if (error || !data) {
    return <ErrorState error={error ?? new Error("No data returned")} />;
  }

  const summary = data.ledger.summary;
  const totalBlocks = data.ledger.total;
  const hasPrev = data.plans.skip > 0;
  const hasNext = data.plans.skip + data.plans.take < data.plans.total;
  const pageStart = data.plans.total === 0 ? 0 : data.plans.skip + 1;
  const pageEnd = data.plans.total === 0 ? 0 : Math.min(data.plans.skip + data.plans.take, data.plans.total);

  return (
    <div className="admin-surface min-h-screen">
      <div className="container mx-auto space-y-8 px-6 pb-24 pt-24">
        <section className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="flex items-center gap-3 admin-kicker">
              <Badge variant="outline" className="rounded-full border-emerald-300/50 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-200">
                Billing
              </Badge>
              <span>Operations</span>
            </div>
            <h1 className="admin-title">Billing operations overview</h1>
            <p className="admin-subtitle">
              Track plans waiting to bill, ledger movements, and QuickBooks sync health across your org.
            </p>
          </div>
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Active filters
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
              {filters.orgId ? <Badge variant="secondary">Org: {filters.orgId}</Badge> : null}
              {filters.status ? <Badge variant="secondary">Status: {filters.status}</Badge> : null}
              {filters.startDate || filters.endDate ? (
                <Badge variant="secondary">
                  Range: {filters.startDate || "—"} → {filters.endDate || "—"}
                </Badge>
              ) : null}
              {!filters.orgId && !filters.status && !filters.startDate && !filters.endDate ? (
                <span>No filters applied</span>
              ) : null}
            </div>
            <Button variant="ghost" size="sm" onClick={handleClearFilters} className="w-fit rounded-full">
              Clear all
            </Button>
          </div>
        </section>

        {actionMessage && (
          <Alert
            variant={actionMessage.type === "error" ? "destructive" : "default"}
            className="flex items-center justify-between gap-4"
          >
            <div>
              <AlertTitle>
                {actionMessage.type === "error" ? "Action needed" : "Success"}
              </AlertTitle>
              <AlertDescription>{actionMessage.message}</AlertDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setActionMessage(null)} className="rounded-full">
              Dismiss
            </Button>
          </Alert>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Pending charges" value={formatAmount(summary.pendingChargesCents)} />
          <SummaryCard label="Pending credits" value={formatAmount(summary.pendingCreditsCents)} />
          <SummaryCard label="Applied this cycle" value={formatAmount(summary.appliedAmountCents)} />
          <SummaryCard label="Ledger blocks" value={totalBlocks.toString()} />
        </section>

        <Card className="admin-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Org
                </Label>
                <Input
                  placeholder="yardura"
                  value={filters.orgId}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, orgId: event.target.value }))
                  }
                  className="h-10 rounded-full border border-slate-200 bg-white/80 px-4 text-sm shadow-sm focus-visible:ring-emerald-200 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Customer ID
                </Label>
                <Input
                  placeholder="cust_..."
                  value={filters.customerId}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, customerId: event.target.value }))
                  }
                  className="h-10 rounded-full border border-slate-200 bg-white/80 px-4 text-sm shadow-sm focus-visible:ring-emerald-200 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Job ID
                </Label>
                <Input
                  placeholder="job_..."
                  value={filters.jobId}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, jobId: event.target.value }))
                  }
                  className="h-10 rounded-full border border-slate-200 bg-white/80 px-4 text-sm shadow-sm focus-visible:ring-emerald-200 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Ledger status
                </Label>
                <Select
                  value={filters.status || "all"}
                  onValueChange={(value) =>
                    setFilters((prev) => ({ ...prev, status: value === "all" ? "" : value }))
                  }
                >
                  <SelectTrigger className="h-10 rounded-full border border-slate-200 bg-white/80 px-4 text-sm font-medium text-slate-700 shadow-sm focus-visible:ring-emerald-200 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="APPLIED">Applied</SelectItem>
                    <SelectItem value="VOID">Void</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Start date
                </Label>
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, startDate: event.target.value }))
                  }
                  className="h-10 rounded-full border border-slate-200 bg-white/80 px-4 text-sm shadow-sm focus-visible:ring-emerald-200 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  End date
                </Label>
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, endDate: event.target.value }))
                  }
                  className="h-10 rounded-full border border-slate-200 bg-white/80 px-4 text-sm shadow-sm focus-visible:ring-emerald-200 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={handleClearFilters} className="rounded-full">
                Reset
              </Button>
              <Button size="sm" onClick={handleApplyFilters} className="rounded-full bg-emerald-500 text-slate-950 hover:bg-emerald-400">
                Apply filters
              </Button>
            </div>
          </CardContent>
        </Card>

        <QuickBooksCard
          summary={data.integrations?.quickbooks}
          events={recentQuickBooksEvents}
          onAction={handleActionResult}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase text-slate-500 dark:text-slate-400">Page size</span>
            <Select value={pageSize} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="h-9 w-[90px] rounded-full border border-slate-200 bg-white/80 px-3 text-sm font-medium text-slate-700 shadow-sm focus-visible:ring-emerald-200 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
            <span>
              Showing {pageStart}-{pageEnd} of {data.plans.total}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={!hasPrev}
                onClick={() => handlePageChange(-1)}
                className="rounded-full"
              >
                Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!hasNext}
                onClick={() => handlePageChange(1)}
                className="rounded-full"
              >
                Next
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} className="rounded-full">
              Export CSV
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="flex w-full max-w-fit rounded-full border border-slate-200 bg-white p-1 text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
            <TabsTrigger
              value="plans"
              className="rounded-full px-4 py-2 text-sm font-semibold data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-900 data-[state=active]:shadow-lg dark:data-[state=active]:bg-emerald-500 dark:data-[state=active]:text-slate-900"
            >
              Plans
            </TabsTrigger>
            <TabsTrigger
              value="ledger"
              className="rounded-full px-4 py-2 text-sm font-semibold data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-900 data-[state=active]:shadow-lg dark:data-[state=active]:bg-emerald-500 dark:data-[state=active]:text-slate-900"
            >
              Ledger
            </TabsTrigger>
          </TabsList>
          <TabsContent value="plans" className="space-y-4">
            {data.plans.items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                No billing plans match the selected filters.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {data.plans.items.map((plan) => (
                  <PlanCard
                    key={`${plan.jobId}-${plan.customerId}`}
                    plan={plan}
                    onCreditApplied={handleActionResult}
                  />
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="ledger" className="space-y-4">
            <LedgerTable
              entries={data.ledger.items}
              stripeDashboardBase={stripeDashboardBase}
              onEntryUpdated={handleActionResult}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
