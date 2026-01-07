"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CreditCard,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Download,
  Loader2,
  ShieldCheck,
  FileText,
  X,
  Plus,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import type { User, ServiceSummary } from "../types";
import { Button } from "@/components/ui/button";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { signOut } from "next-auth/react";
import AddCardForm from "@/components/billing/AddCardForm";

interface BillingTabProps {
  user: User;
  serviceSummary?: ServiceSummary | null;
}

interface SubscriptionSummary {
  id: string;
  status: string;
  planName: string | null;
  amountCents: number | null;
  currency: string | null;
  interval: string | null;
  intervalCount: number | null;
  nextBillingDate: string | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
}

interface PaymentMethodSummary {
  id: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  type: string;
  isDefault: boolean;
}

interface InvoiceSummary {
  id: string;
  number: string | null;
  status: string | null;
  amountDueCents: number | null;
  currency: string | null;
  invoiceDate: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
}

interface UpcomingInvoiceSummary {
  amountDueCents: number | null;
  currency: string | null;
  dueDate: string | null;
}

interface BillingOverview {
  subscriptions: SubscriptionSummary[];
  paymentMethods: PaymentMethodSummary[];
  invoices: InvoiceSummary[];
  upcomingInvoice: UpcomingInvoiceSummary | null;
}

function formatCurrency(amountCents: number | null | undefined, currency = "usd") {
  if (typeof amountCents !== "number") return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amountCents / 100);
  } catch {
    return `$${(amountCents / 100).toFixed(2)}`;
  }
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatFrequency(frequency?: string | null) {
  if (!frequency) return null;
  const normalized = frequency.toLowerCase().replace(/_/g, "-").trim();
  switch (normalized) {
    case "twice-weekly":
    case "twice weekly":
      return "Twice weekly";
    case "bi-weekly":
    case "biweekly":
      return "Every other week";
    case "weekly":
      return "Weekly";
    case "monthly":
      return "Monthly";
    default:
      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }
}

export default function BillingTab({ user, serviceSummary }: BillingTabProps) {
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelFeedback, setCancelFeedback] = useState("");
  const [cancelModalError, setCancelModalError] = useState<string | null>(null);
  const [cancellationResult, setCancellationResult] = useState<{
    success: boolean;
    message: string;
    endDate?: string;
  } | null>(null);

  const [billing, setBilling] = useState<BillingOverview | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [showAddCard, setShowAddCard] = useState(false);
  const [addingPaymentMethod, setAddingPaymentMethod] = useState(false);
  const [paymentMethodNotice, setPaymentMethodNotice] = useState<string | null>(null);
  const [paymentMethodError, setPaymentMethodError] = useState<string | null>(null);
  const [updatingPaymentMethodId, setUpdatingPaymentMethodId] = useState<string | null>(null);
  const [removingPaymentMethodId, setRemovingPaymentMethodId] = useState<string | null>(null);

  const fetchBillingOverview = useCallback(async () => {
    setBillingLoading(true);
    setBillingError(null);
    try {
      const response = await fetch("/api/billing/overview", {
        method: "GET",
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || "Unable to load billing information");
      }
      setBilling(payload.data ?? {
        subscriptions: [],
        paymentMethods: [],
        invoices: [],
        upcomingInvoice: null,
      });
    } catch (error) {
      console.error("billing.overview", error);
      setBillingError(
        error instanceof Error
          ? error.message
          : "We couldn't load billing information right now.",
      );
    } finally {
      setBillingLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBillingOverview();
  }, [fetchBillingOverview]);

  const activeSubscription = useMemo(() => {
    if (!billing?.subscriptions?.length) return null;
    return billing.subscriptions.find((sub) =>
      ["active", "trialing"].includes(sub.status),
    ) || billing.subscriptions[0];
  }, [billing?.subscriptions]);

  const nextBillingDate = useMemo(() => {
    if (!activeSubscription) return null;
    const candidates = [
      billing?.upcomingInvoice?.dueDate,
      activeSubscription.nextBillingDate,
      activeSubscription.trialEndsAt,
    ].filter(Boolean) as string[];
    if (!candidates.length) return null;
    const soonest = candidates
      .map((iso) => new Date(iso))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime())[0];
    return soonest ? soonest.toISOString() : null;
  }, [activeSubscription, billing?.upcomingInvoice]);

  const cadenceLabel = useMemo(() => formatFrequency(user.serviceFrequency), [user.serviceFrequency]);
  const rateCurrency = activeSubscription?.currency || "usd";
  const resolvedBillingPreference = useMemo(() => {
    if (serviceSummary?.billingPreference) return serviceSummary.billingPreference;
    if (activeSubscription?.interval === "week") return "weekly";
    if (activeSubscription?.interval === "month") return "monthly";
    return null;
  }, [serviceSummary?.billingPreference, activeSubscription?.interval]);
  const normalizedFrequency = useMemo(() => {
    const raw = serviceSummary?.frequency ?? user.serviceFrequency ?? "";
    return raw.toLowerCase().replace(/_/g, "-").trim();
  }, [serviceSummary?.frequency, user.serviceFrequency]);
  const visitsPerWeek = useMemo(() => {
    switch (normalizedFrequency) {
      case "weekly":
        return 1;
      case "twice-weekly":
        return 2;
      case "daily":
        return serviceSummary?.weekendUpgrade ? 7 : 5;
      case "bi-weekly":
      case "biweekly":
      case "every-other-week":
        return 0.5;
      case "monthly":
        return 0.25;
      default:
        return null;
    }
  }, [normalizedFrequency, serviceSummary?.weekendUpgrade]);
  const perVisitCents = serviceSummary?.perVisitCents ?? null;
  const monthlyCents = serviceSummary?.monthlyCents ?? null;
  const weeklyCents =
    perVisitCents && visitsPerWeek != null
      ? Math.round(perVisitCents * visitsPerWeek)
      : null;
  const cadenceRateCents = useMemo(() => {
    if (resolvedBillingPreference === "monthly") return monthlyCents;
    if (resolvedBillingPreference === "weekly") return weeklyCents;
    return null;
  }, [resolvedBillingPreference, monthlyCents, weeklyCents]);
  const cadenceRateLabel = useMemo(() => {
    if (!cadenceRateCents || !resolvedBillingPreference) return null;
    const cadenceUnit = resolvedBillingPreference === "monthly" ? "month" : "week";
    return `${formatCurrency(cadenceRateCents, rateCurrency)} / ${cadenceUnit}`;
  }, [cadenceRateCents, resolvedBillingPreference, rateCurrency]);
  const perVisitRateLabel = useMemo(() => {
    if (!perVisitCents) return null;
    return `${formatCurrency(perVisitCents, rateCurrency)} per visit`;
  }, [perVisitCents, rateCurrency]);
  const rateSummaryLabel = useMemo(() => {
    const parts = [cadenceRateLabel, perVisitRateLabel].filter(Boolean) as string[];
    return parts.length ? parts.join(" • ") : null;
  }, [cadenceRateLabel, perVisitRateLabel]);

  const planLabel = useMemo(() => {
    if (!activeSubscription) return "—";
    if (cadenceLabel) return `${cadenceLabel} Membership`;
    if (activeSubscription.planName) return activeSubscription.planName;
    return "Yardura Service";
  }, [activeSubscription, cadenceLabel]);

  const defaultPaymentMethod = useMemo(() => {
    return billing?.paymentMethods?.find((method) => method.isDefault);
  }, [billing?.paymentMethods]);

  const otherPaymentMethods = useMemo(() => {
    return billing?.paymentMethods?.filter((method) => !method.isDefault) || [];
  }, [billing?.paymentMethods]);

  const handleCancelSubscription = async () => {
    setIsCancelling(true);
    setCancelModalError(null);
    try {
      const response = await fetch("/api/stripe/cancel-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason, feedback: cancelFeedback }),
      });
      const result = await response.json();
      if (response.ok) {
        setCancellationResult({
          success: true,
          message: result.message,
          endDate: result.finalBillingDate,
        });
        setShowCancelModal(false);
        await fetchBillingOverview();
        setTimeout(() => void signOut({ callbackUrl: "/goodbye" }), 400);
      } else {
        setCancellationResult({ success: false, message: result.error || "Failed to cancel" });
        setCancelModalError(result.error || "Failed to cancel subscription");
      }
    } catch {
      setCancellationResult({ success: false, message: "An error occurred" });
      setCancelModalError("An error occurred while cancelling");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleManageBillingPortal = async () => {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const response = await fetch("/api/billing/portal/me", { method: "POST" });
      const payload = await response.json();
      if (!response.ok || !payload?.url) throw new Error(payload.error || "Unable to open portal");
      window.location.href = payload.url;
    } catch (error) {
      setPortalError(error instanceof Error ? error.message : "Couldn't open billing portal");
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div id="billing" className="space-y-8">
      {/* ====== HERO: Subscription Overview ====== */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-graphite via-graphite-soft to-graphite dark:from-graphite-soft dark:via-graphite dark:to-graphite-soft p-1">
        <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-graphite via-graphite-soft to-graphite dark:from-[#25292f] dark:via-[#1e2227] dark:to-[#25292f] p-8 md:p-10">
          {/* Decorative */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-coral/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-mint/8 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4 pointer-events-none" />
          
          <div className="relative z-10">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-sm px-4 py-1.5 mb-6">
              <CreditCard className="size-4 text-mint" />
              <span className="text-xs font-semibold tracking-wide text-white uppercase">
                Your Membership
              </span>
          </div>

          {billingLoading ? (
              <div className="flex items-center gap-3 text-white/70">
                <Loader2 className="size-5 animate-spin" />
                <span>Loading billing details...</span>
              </div>
            ) : activeSubscription ? (
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
                <div className="space-y-4">
                  <h1 className="text-3xl md:text-4xl font-heading font-bold text-white">
                    {planLabel}
                  </h1>
                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2 text-white text-sm">
                      <DollarSign className="size-4 text-mint" />
                      <span className="font-semibold">
                        {formatCurrency(activeSubscription.amountCents, activeSubscription.currency || undefined)}
                    </span>
                      <span className="text-white/60">
                        / {activeSubscription.interval || "month"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2 text-white text-sm">
                      <ShieldCheck className="size-4 text-mint" />
                      <span className="capitalize">{activeSubscription.status}</span>
                    </div>
                  </div>
                  <p className="text-white/60 text-sm">
                    Next billing: {formatDate(nextBillingDate)}
                  </p>
                  {rateSummaryLabel ? (
                    <p className="text-white/70 text-sm">
                      Standard rate: {rateSummaryLabel}
                    </p>
                  ) : null}
              </div>

                <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleManageBillingPortal}
                  disabled={portalLoading}
                    className="bg-mint hover:bg-mint/90 text-white rounded-xl h-11 px-6 font-semibold shadow-lg"
                >
                  {portalLoading ? (
                      <Loader2 className="size-4 animate-spin mr-2" />
                  ) : (
                      <ExternalLink className="size-4 mr-2" />
                  )}
                    Manage in Stripe
                  </Button>
                  <Button
                    onClick={() => setShowCancelModal(true)}
                    variant="outline"
                    className="border-white/20 bg-white/5 text-white hover:bg-white/10 rounded-xl h-11 px-6 font-semibold"
                  >
                    Cancel Plan
                </Button>
              </div>
            </div>
          ) : (
              <div className="text-center py-8">
                <p className="text-white/70">No active subscription found.</p>
                <p className="text-white/50 text-sm mt-2">
                  If you recently signed up, details may still be syncing.
                </p>
            </div>
          )}
          </div>
        </div>
        </section>

      {/* Alerts */}
      {billingError && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{billingError}</AlertDescription>
        </Alert>
      )}
      {portalError && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Portal Error</AlertTitle>
          <AlertDescription>{portalError}</AlertDescription>
        </Alert>
      )}
      {cancellationResult && (
        <Alert variant={cancellationResult.success ? "default" : "destructive"}>
          {cancellationResult.success ? <CheckCircle className="size-4 text-mint" /> : <AlertTriangle className="size-4" />}
          <AlertTitle>{cancellationResult.success ? "Cancellation Confirmed" : "Cancellation Failed"}</AlertTitle>
          <AlertDescription>{cancellationResult.message}</AlertDescription>
        </Alert>
      )}

      {/* ====== Payment Methods ====== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-heading font-bold text-graphite dark:text-white">Payment Methods</h2>
              <Button
                variant={showAddCard ? "ghost" : "outline"}
                size="sm"
                onClick={() => {
                  setPaymentMethodError(null);
                  setPaymentMethodNotice(null);
                  setShowAddCard((prev) => !prev);
                }}
                disabled={addingPaymentMethod}
            className="rounded-xl dark:border-white/20 dark:text-white dark:hover:bg-white/10"
              >
            {showAddCard ? "Cancel" : (
              <>
                <Plus className="size-4 mr-1.5" />
                Add Card
              </>
            )}
              </Button>
              </div>

        {/* Notices */}
        {paymentMethodNotice && (
          <div className="rounded-xl border border-mint/30 bg-mint/10 px-4 py-3 text-sm text-mint">
            {paymentMethodNotice}
            </div>
        )}
        {paymentMethodError && (
          <div className="rounded-xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral-ink">
            {paymentMethodError}
          </div>
        )}

        {/* Add Card Form */}
        {showAddCard && (
          <div className="rounded-2xl border border-graphite/10 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-5">
              <AddCardForm
                onSuccess={async (paymentMethodId) => {
                  setAddingPaymentMethod(true);
                  setPaymentMethodError(null);
                  try {
                    const response = await fetch("/api/billing/payment-methods", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ paymentMethodId, makeDefault: !defaultPaymentMethod }),
                    });
                    const json = await response.json();
                  if (!response.ok || !json?.ok) throw new Error(json?.error || "Failed to save card");
                  setPaymentMethodNotice("Card saved successfully!");
                    setShowAddCard(false);
                    await fetchBillingOverview();
                  } catch (err: any) {
                  setPaymentMethodError(err?.message || "Failed to save card");
                  } finally {
                    setAddingPaymentMethod(false);
                  }
                }}
              onCancel={() => !addingPaymentMethod && setShowAddCard(false)}
                disabled={addingPaymentMethod}
              />
            </div>
        )}

        {/* Cards List */}
        <div className="rounded-2xl border border-graphite/5 dark:border-white/10 bg-white dark:bg-white/5 overflow-hidden">
          {billingLoading ? (
            <div className="flex items-center gap-3 p-8 text-graphite/50 dark:text-white/50">
              <Loader2 className="size-5 animate-spin" />
              <span>Loading payment methods...</span>
            </div>
          ) : billing?.paymentMethods?.length ? (
            <div className="divide-y divide-graphite/5 dark:divide-white/10">
              {/* Default Card */}
              {defaultPaymentMethod && (
                <div className="p-5 bg-mint/5 dark:bg-mint/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex size-12 items-center justify-center rounded-xl bg-mint/10 text-mint">
                        <CreditCard className="size-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-graphite dark:text-white">
                    {defaultPaymentMethod.brand?.toUpperCase() || "Card"} •••• {defaultPaymentMethod.last4}
                  </p>
                          <span className="text-xs font-medium text-mint bg-mint/10 px-2 py-0.5 rounded-full">Default</span>
                        </div>
                        <p className="text-xs text-graphite/50 dark:text-white/50">
                    Expires {defaultPaymentMethod.expMonth}/{defaultPaymentMethod.expYear}
                  </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Other Cards */}
                    {otherPaymentMethods.map((method) => (
                <div key={method.id} className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-graphite/5 text-graphite/50 dark:bg-white/10 dark:text-white/60">
                      <CreditCard className="size-5" />
                    </div>
                        <div>
                      <p className="font-medium text-graphite dark:text-white">
                          {method.brand?.toUpperCase() || "Card"} •••• {method.last4}
                      </p>
                      <p className="text-xs text-graphite/50 dark:text-white/50">
                            Expires {method.expMonth}/{method.expYear}
                      </p>
                    </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                      className="rounded-lg text-xs dark:border-white/20 dark:text-white dark:hover:bg-white/10"
                      disabled={updatingPaymentMethodId === method.id || removingPaymentMethodId === method.id}
                            onClick={async () => {
                              setUpdatingPaymentMethodId(method.id);
                              try {
                          const res = await fetch(`/api/billing/payment-methods/${method.id}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ action: "set_default" }),
                                });
                          const json = await res.json();
                          if (!res.ok) throw new Error(json?.error);
                          setPaymentMethodNotice("Default updated");
                                await fetchBillingOverview();
                              } catch (err: any) {
                          setPaymentMethodError(err?.message || "Failed to update");
                              } finally {
                                setUpdatingPaymentMethodId(null);
                              }
                            }}
                          >
                      {updatingPaymentMethodId === method.id ? <Loader2 className="size-3 animate-spin" /> : "Make Default"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                      className="text-coral/80 hover:text-coral text-xs dark:text-coral dark:hover:text-coral dark:hover:bg-coral/10"
                      disabled={removingPaymentMethodId === method.id}
                            onClick={async () => {
                        if (!confirm("Remove this card?")) return;
                              setRemovingPaymentMethodId(method.id);
                              try {
                          const res = await fetch(`/api/billing/payment-methods/${method.id}`, { method: "DELETE" });
                          const json = await res.json();
                          if (!res.ok) throw new Error(json?.error);
                          setPaymentMethodNotice("Card removed");
                                await fetchBillingOverview();
                              } catch (err: any) {
                          setPaymentMethodError(err?.message || "Failed to remove");
                              } finally {
                                setRemovingPaymentMethodId(null);
                              }
                            }}
                          >
                      {removingPaymentMethodId === method.id ? <Loader2 className="size-3 animate-spin" /> : "Remove"}
                          </Button>
                        </div>
                      </div>
                    ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className="mx-auto size-16 rounded-2xl bg-slate-100 dark:bg-white/10 flex items-center justify-center mb-4">
                <CreditCard className="size-7 text-graphite/30 dark:text-white/30" />
              </div>
              <p className="text-graphite/50 dark:text-white/60 text-sm">No payment methods on file.</p>
              <Button
                onClick={() => setShowAddCard(true)}
                className="mt-4 bg-graphite hover:bg-graphite-soft text-white rounded-xl"
              >
                <Plus className="size-4 mr-2" />
                Add Your First Card
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* ====== Recent Invoices ====== */}
      <section className="space-y-4">
        <h2 className="text-lg font-heading font-bold text-graphite dark:text-white">Recent Invoices</h2>

        <div className="rounded-2xl border border-graphite/5 dark:border-white/10 bg-white dark:bg-white/5 overflow-hidden">
        {billingLoading ? (
            <div className="flex items-center gap-3 p-8 text-graphite/50 dark:text-white/50">
              <Loader2 className="size-5 animate-spin" />
              <span>Loading invoices...</span>
          </div>
        ) : billing?.invoices?.length ? (
            <div className="divide-y divide-graphite/5 dark:divide-white/10">
              {billing.invoices.slice(0, 5).map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-coral/10 text-coral">
                      <FileText className="size-5" />
                    </div>
                    <div>
                      <p className="font-medium text-graphite dark:text-white">{invoice.number || invoice.id}</p>
                      <p className="text-xs text-graphite/50 dark:text-white/50">{formatDate(invoice.invoiceDate)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold text-graphite dark:text-white">
                        {formatCurrency(invoice.amountDueCents, invoice.currency || undefined)}
                      </p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        invoice.status === "paid" ? "bg-mint/10 text-mint" : "bg-coral/10 text-coral"
                      }`}>
                        {invoice.status}
                      </span>
                    </div>
                    {invoice.hostedInvoiceUrl && (
                      <Button variant="ghost" size="sm" className="rounded-lg dark:text-white" asChild>
                            <a href={invoice.hostedInvoiceUrl} target="_blank" rel="noreferrer">
                          <Download className="size-4" />
                            </a>
                          </Button>
                    )}
                  </div>
                      </div>
                ))}
          </div>
        ) : (
            <div className="p-12 text-center">
              <div className="mx-auto size-16 rounded-2xl bg-slate-100 dark:bg-white/10 flex items-center justify-center mb-4">
                <FileText className="size-7 text-graphite/30 dark:text-white/30" />
              </div>
              <p className="text-graphite/50 dark:text-white/50 text-sm">No invoices yet.</p>
          </div>
        )}
        </div>
      </section>

      {/* ====== Cancel Modal ====== */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-graphite/80 p-6 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-graphite/5 px-6 py-4">
              <div>
                <h3 className="text-lg font-heading font-bold text-graphite">Cancel Subscription</h3>
                <p className="text-sm text-graphite/50">We're sorry to see you go</p>
              </div>
              <button
                onClick={() => setShowCancelModal(false)}
                className="rounded-full p-2 text-graphite/50 hover:bg-graphite/5"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-graphite mb-2">
                Why are you cancelling?
              </label>
              <select
                  className="w-full rounded-xl border border-graphite/10 px-4 py-3 text-sm focus:border-coral focus:ring-2 focus:ring-coral/20"
                value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
              >
                <option value="">Select a reason</option>
                  <option value="moving">We're moving</option>
                <option value="cost">Cost concerns</option>
                <option value="service-issues">Service issues</option>
                <option value="seasonal">Seasonal pause</option>
                <option value="other">Other</option>
              </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-graphite mb-2">
                  Feedback (optional)
              </label>
              <textarea
                  className="w-full rounded-xl border border-graphite/10 px-4 py-3 text-sm focus:border-coral focus:ring-2 focus:ring-coral/20"
                  rows={3}
                value={cancelFeedback}
                  onChange={(e) => setCancelFeedback(e.target.value)}
                  placeholder="Tell us how we could improve..."
              />
              </div>
              {cancelModalError && (
                <div className="rounded-xl bg-coral/10 border border-coral/20 px-4 py-3 text-sm text-coral-ink">
                  {cancelModalError}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-graphite/5 px-6 py-4">
              <Button
                variant="ghost"
                onClick={() => setShowCancelModal(false)}
                className="rounded-xl"
              >
                Keep Service
              </Button>
              <Button
                onClick={handleCancelSubscription}
                disabled={isCancelling}
                className="bg-coral hover:bg-coral-ink text-white rounded-xl"
              >
                {isCancelling && <Loader2 className="size-4 animate-spin mr-2" />}
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
