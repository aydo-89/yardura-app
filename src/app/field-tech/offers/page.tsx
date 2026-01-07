"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { differenceInSeconds, format, formatDistanceToNow } from "date-fns";
import {
  RefreshCw,
  Clock3,
  MapPin,
  PawPrint,
  ShieldCheck,
  Sparkles,
  UserRound,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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

type Offer = {
  id: string;
  serviceVisitId: string;
  scheduledDate: string | null;
  expiresAt: string | null;
  jobId: string | null;
  frequency: string;
  serviceType: string | null;
  dispatchStrategy: string | null;
  isRecurring: boolean;
  handoffType: "visit" | "job" | null;
  preferredTimeWindowLabel?: string | null;
  preferredTimeWindowSlug?: string | null;
  preferredTimeWindowRange?: string | null;
  distanceMiles?: number | null;
  tile: {
    id: string;
    name: string;
    slug: string;
    status: string;
  } | null;
  customer: {
    name: string | null;
    addressLine1: string | null;
    city: string | null;
    zip: string | null;
    dogs?: Array<{
      id: string;
      name: string;
      breed?: string | null;
    }>;
  } | null;
  revenueCents: number | null;
  estimatedPayout: {
    totalAmountCents: number;
    baseAmountCents: number;
    bonusAmountCents: number;
    mileageAmountCents: number;
    ppeAmountCents: number;
    tipsAmountCents: number;
    sharePercent: number;
  } | null;
  isDirectOffer: boolean;
  requiredCertifications: unknown;
};

type OfferPayload = {
  offers: Offer[];
  summary?: {
    total: number;
  };
};

type MeResponse = {
  profile: {
    id: string;
    status: string;
    rating: number | null;
  };
  metrics: {
    today: {
      totalStops: number;
      completedStops: number;
    };
    pendingOffers: number;
    upcomingStops: number;
  };
  earnings: {
    weekToDateCents: number;
    lifetimeCents: number;
  };
  tiles: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
};

function formatDollar(cents: number | null | undefined) {
  if (typeof cents !== "number") return "—";
  return currency.format(cents / 100);
}

function formatRelative(date: string | null) {
  if (!date) return "Anytime";
  const when = new Date(date);
  if (Number.isNaN(when.getTime())) return "Anytime";
  return formatDistanceToNow(when, { addSuffix: true });
}

function formatDateLabel(date: string | null) {
  if (!date) return "Unscheduled";
  const when = new Date(date);
  if (Number.isNaN(when.getTime())) return "Unscheduled";
  return format(when, "EEE • MMM d");
}

function formatFrequencyLabel(frequency: string) {
  return frequency.toLowerCase().replaceAll("_", " ");
}

function formatCadenceShort(frequency: string) {
  switch (frequency) {
    case "TWICE_WEEKLY":
      return "2x weekly";
    case "DAILY":
      return "Daily";
    case "WEEKLY":
      return "Weekly";
    case "BI_WEEKLY":
      return "Every other week";
    case "MONTHLY":
      return "Monthly";
    case "ONE_TIME":
      return "One-time";
    default:
      return formatFrequencyLabel(frequency);
  }
}

const VISITS_PER_MONTH: Record<string, number> = {
  DAILY: 21.67,
  TWICE_WEEKLY: 8.67,
  WEEKLY: 4.33,
  BI_WEEKLY: 2.17,
  MONTHLY: 1,
  ONE_TIME: 1,
};

function formatRecurringPayout(cents: number, frequency: string) {
  const visitsPerMonth = VISITS_PER_MONTH[frequency] ?? 0;
  if (!visitsPerMonth) return null;
  const visitsPerWeek = visitsPerMonth / 4.33;
  const weekly = formatDollar(cents * visitsPerWeek);
  const monthly = formatDollar(cents * visitsPerMonth);
  if (visitsPerMonth <= 1.1) {
    return `Est. ${monthly}/mo`;
  }
  return `Est. ${weekly}/wk • ${monthly}/mo`;
}

function formatDogSummary(
  dogs?: Array<{ name: string; breed?: string | null }>,
): string | null {
  if (!dogs?.length) return null;
  const label = dogs.length === 1 ? "Dog" : "Dogs";
  const names = dogs
    .map((dog) => {
      if (!dog.name) return null;
      return dog.breed ? `${dog.name} (${dog.breed})` : dog.name;
    })
    .filter((value): value is string => Boolean(value));
  if (!names.length) return `${label}: ${dogs.length}`;
  const preview = names.slice(0, 2).join(", ");
  const remaining = names.length - 2;
  const suffix = remaining > 0 ? ` +${remaining} more` : "";
  return `${label}: ${dogs.length} • ${preview}${suffix}`;
}

type OfferNature = {
  label: string;
  description: string;
  commitment: string;
};

function buildOfferNature(
  offer: Pick<Offer, "handoffType" | "isRecurring" | "frequency">,
): OfferNature {
  const frequencyLabel = formatFrequencyLabel(offer.frequency);

  if (offer.handoffType === "job") {
    return {
      label: "Recurring job handoff",
      description: `Released from a recurring job (${frequencyLabel}).`,
      commitment:
        "Accepting locks in this visit only. Future visits may be offered separately.",
    };
  }

  if (offer.handoffType === "visit") {
    return {
      label: "Coverage visit handoff",
      description: "Single-visit handoff from another scooper.",
      commitment: "Accepting locks in this visit only.",
    };
  }

  if (offer.isRecurring) {
    return {
      label: "Recurring visit",
      description: `Part of a ${frequencyLabel} schedule.`,
      commitment:
        "Accepting locks in this visit only. Future visits may be offered separately.",
    };
  }

  return {
    label: "One-time visit",
    description: "Single visit request.",
    commitment: "Accepting locks in this visit only.",
  };
}

function resolveWindowLabel(
  offer: Pick<
    Offer,
    "preferredTimeWindowLabel" | "preferredTimeWindowRange" | "preferredTimeWindowSlug"
  >,
) {
  const range = offer.preferredTimeWindowRange;
  if (offer.preferredTimeWindowLabel) {
    if (range && !offer.preferredTimeWindowLabel.includes(range)) {
      return `${offer.preferredTimeWindowLabel} (${range})`;
    }
    return offer.preferredTimeWindowLabel;
  }
  const slug = offer.preferredTimeWindowSlug?.toLowerCase() ?? "";
  if (slug.includes("morning")) return "Morning";
  if (slug.includes("afternoon")) return "Afternoon";
  if (slug.includes("evening")) return "Evening";
  if (slug.includes("flex")) return "Flexible";
  if (slug.includes("custom") || range) {
    return range ? `Custom (${range})` : "Custom window";
  }
  return null;
}

function resolveScheduleSummary(
  offer: Pick<
    Offer,
    "scheduledDate" | "preferredTimeWindowLabel" | "preferredTimeWindowRange" | "preferredTimeWindowSlug"
  >,
) {
  const dateLabel = formatDateLabel(offer.scheduledDate);
  const windowLabel = resolveWindowLabel(offer);
  return windowLabel ? `${dateLabel} • ${windowLabel}` : dateLabel;
}

function resolveCountdown(expiresAt: string | null, now: Date) {
  if (!expiresAt) return null;
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return null;
  const diff = differenceInSeconds(expiry, now);
  if (diff <= 0) return "Expiring now";
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;
  if (hours > 0) return `Expires in ${hours}h ${minutes}m`;
  if (minutes > 0) return `Expires in ${minutes}m ${seconds}s`;
  return `Expires in ${seconds}s`;
}

function formatDistanceMiles(distanceMiles?: number | null) {
  if (typeof distanceMiles !== "number" || Number.isNaN(distanceMiles)) return null;
  return `${distanceMiles.toFixed(1)} mi from home`;
}

function sortOffersByDate(list: Offer[]) {
  return [...list].sort((a, b) => {
    const aTime = a.scheduledDate ? new Date(a.scheduledDate).getTime() : Number.POSITIVE_INFINITY;
    const bTime = b.scheduledDate ? new Date(b.scheduledDate).getTime() : Number.POSITIVE_INFINITY;
    return aTime - bTime;
  });
}


function OfferSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/60">
      <Skeleton className="mb-4 h-5 w-28" />
      <Skeleton className="mb-2 h-6 w-3/4" />
      <Skeleton className="mb-6 h-4 w-1/3" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

export default function FieldTechOffersPage() {
  const { data: meData, isLoading: loadingMe, mutate: mutateMe } = useSWR<MeResponse>(
    "/api/field-tech/me",
    fetcher,
    {
      refreshInterval: 2 * 60 * 1000,
    },
  );

  const {
    data: offersData,
    isLoading: loadingOffers,
    mutate: mutateOffers,
  } = useSWR<OfferPayload>("/api/field-tech/offers?limit=40", fetcher, {
    refreshInterval: 30 * 1000,
  });

  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [confirmOffer, setConfirmOffer] = useState<Offer | null>(null);
  const [confirmingRecurring, setConfirmingRecurring] = useState(false);
  const [confirmChecks, setConfirmChecks] = useState({
    availability: false,
    commitment: false,
    policy: false,
  });
  const [now, setNow] = useState(() => new Date());

  const handleRefresh = useCallback(() => {
    mutateOffers();
    mutateMe();
  }, [mutateMe, mutateOffers]);

  const handleAccept = useCallback(
    async (offerId: string, scope: "visit" | "job") => {
      try {
        setClaimingId(offerId);
        const response = await fetch(`/api/field-tech/offers/${offerId}/accept`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ scope }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          const errorCode = payload?.error ?? "offer_unavailable";
          const errorMessage =
            errorCode === "offer_claimed"
              ? "Too late—someone else grabbed that one."
              : errorCode === "scooper_strike_limit"
                ? payload?.message ?? "You’ve reached the missed visit limit this quarter."
                : payload?.message ?? errorCode;
          toast.error(errorMessage);
          return false;
        }

        toast.success("Offer locked in. It’s now on your route.");
        mutateOffers();
        mutateMe();
        return true;
      } catch (error) {
        console.error(error);
        toast.error("We couldn’t secure that offer. Try again in a moment.");
        return false;
      } finally {
        setClaimingId(null);
      }
    },
    [mutateMe, mutateOffers],
  );

  const handleDecline = useCallback(
    async (offerId: string) => {
      try {
        setDecliningId(offerId);
        const response = await fetch(`/api/field-tech/offers/${offerId}/decline`, {
          method: "POST",
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          const errorMessage =
            payload?.message ?? payload?.error ?? "Unable to decline offer.";
          toast.error(errorMessage);
          return false;
        }

        toast.success("Offer released back to the board.");
        mutateOffers();
        mutateMe();
        return true;
      } catch (error) {
        console.error(error);
        toast.error("We couldn’t decline that offer. Try again in a moment.");
        return false;
      } finally {
        setDecliningId(null);
      }
    },
    [mutateMe, mutateOffers],
  );

  const openConfirm = useCallback((offer: Offer) => {
    setConfirmOffer(offer);
    setConfirmingRecurring(false);
    setConfirmChecks({
      availability: false,
      commitment: false,
      policy: false,
    });
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmOffer(null);
    setConfirmingRecurring(false);
    setConfirmChecks({
      availability: false,
      commitment: false,
      policy: false,
    });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleConfirmAccept = useCallback(async () => {
    if (!confirmOffer) return;
    const success = await handleAccept(confirmOffer.id, "visit");
    if (success) {
      closeConfirm();
    }
  }, [confirmOffer, handleAccept, closeConfirm]);

  const handleConfirmAcceptRecurring = useCallback(async () => {
    if (!confirmOffer) return;
    const success = await handleAccept(confirmOffer.id, "job");
    if (success) {
      closeConfirm();
    }
  }, [confirmOffer, handleAccept, closeConfirm]);

  const handleConfirmDecline = useCallback(async () => {
    if (!confirmOffer) return;
    const success = await handleDecline(confirmOffer.id);
    if (success) {
      closeConfirm();
    }
  }, [confirmOffer, handleDecline, closeConfirm]);

  const offers = offersData?.offers ?? [];
  const sortedOffers = useMemo(() => sortOffersByDate(offers), [offers]);
  const directCount = useMemo(
    () => offers.filter((offer) => offer.isDirectOffer).length,
    [offers],
  );
  const activeOffer = confirmOffer;
  const heroTileName = meData?.tiles?.[0]?.name ?? "Your Zone";
  const confirmNature = activeOffer ? buildOfferNature(activeOffer) : null;
  const canConfirm =
    confirmChecks.availability && confirmChecks.commitment && confirmChecks.policy;
  const selectedVisitSummary = activeOffer
    ? resolveScheduleSummary(activeOffer)
    : "Select a visit";
  const isClaimingSelected = Boolean(claimingId && activeOffer?.id === claimingId);
  const relatedRecurringOffers = useMemo(() => {
    if (!activeOffer?.jobId || !activeOffer.isRecurring) return [];
    return offers.filter((offer) => offer.jobId === activeOffer.jobId);
  }, [activeOffer, offers]);
  const confirmCadenceLabel = activeOffer ? formatCadenceShort(activeOffer.frequency) : null;
  const confirmPayoutCents =
    activeOffer?.estimatedPayout?.totalAmountCents ?? activeOffer?.revenueCents ?? null;
  const confirmRecurringPayout =
    activeOffer?.isRecurring && confirmPayoutCents
      ? formatRecurringPayout(confirmPayoutCents, activeOffer.frequency)
      : null;
  const recurringPreview = useMemo(() => {
    if (!relatedRecurringOffers.length) return null;
    const preview = sortOffersByDate(relatedRecurringOffers)
      .slice(0, 3)
      .map((offer) => resolveScheduleSummary(offer))
      .join(", ");
    const remaining = relatedRecurringOffers.length - 3;
    return remaining > 0 ? `${preview} +${remaining} more` : preview;
  }, [relatedRecurringOffers]);

  const heroStats = useMemo(() => {
    if (!meData) {
      return {
        today: "—",
        pending: "—",
        earnings: "—",
      };
    }

    return {
      today: `${meData.metrics.today.completedStops}/${meData.metrics.today.totalStops}`,
      pending: offersData?.summary?.total ?? sortedOffers.length ?? meData.metrics.pendingOffers ?? 0,
      earnings: formatDollar(meData.earnings.weekToDateCents ?? 0),
    };
  }, [meData, offersData, sortedOffers.length]);

  return (
    <div className="flex flex-1 flex-col gap-6 pb-6 text-slate-900 dark:text-white">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-mint-200 via-white to-emerald-50 p-[1px] dark:from-emerald-500 dark:via-emerald-600/60 dark:to-slate-900">
        <div className="relative rounded-3xl border border-transparent bg-white/95 p-6 shadow-soft dark:border-white/10 dark:bg-slate-950/85">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300">
                <Sparkles className="h-4 w-4" />
                <span>InsightScoop Live</span>
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                {heroTileName}
              </h1>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="rounded-full border border-emerald-500/20 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
              onClick={handleRefresh}
            >
              <RefreshCw className="h-5 w-5" />
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-2xl border border-emerald-500/20 bg-white/70 p-3 text-center shadow-sm dark:border-white/10 dark:bg-white/5">
              <p className="text-xs uppercase text-slate-500 dark:text-slate-300">Today</p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                {heroStats.today}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-white/70 p-3 text-center shadow-sm dark:border-white/10 dark:bg-white/5">
              <p className="text-xs uppercase text-slate-500 dark:text-slate-300">Open offers</p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                {heroStats.pending}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-white/70 p-3 text-center shadow-sm dark:border-white/10 dark:bg-white/5">
              <p className="text-xs uppercase text-slate-500 dark:text-slate-300">Week to date</p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                {heroStats.earnings}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Available visits</h2>
          <Badge
            variant="outline"
            className="rounded-full border-emerald-400/60 text-emerald-600 dark:border-emerald-400 dark:text-emerald-300"
          >
            {sortedOffers.length} open
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
          <Badge
            variant="outline"
            className="rounded-full border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
          >
            Direct to you: {directCount}
          </Badge>
          <Badge
            variant="outline"
            className="rounded-full border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
          >
            Open board: {Math.max(sortedOffers.length - directCount, 0)}
          </Badge>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Direct offers are held for you. Open board offers are visible to all scoopers in your tiles.
          </span>
        </div>
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-4 text-sm text-amber-900 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5" />
            <div>
              <p className="font-semibold">Accept only what you can fulfill.</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-800/80 dark:text-amber-100/80">
                Missed visits are most serious (3 in a quarter pauses new offers). Late releases within
                48 hours are limited to 5 per quarter. Recurring job releases are capped to protect route stability.
              </p>
            </div>
          </div>
        </div>

        {loadingOffers || loadingMe ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <OfferSkeleton key={index} />
            ))}
          </div>
        ) : null}

        {!loadingOffers && sortedOffers.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Routes are covered</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              We’ll ping you the moment a new yard opens in your tiles. Keep your notifications on and check back soon.
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-4">
          {sortedOffers.map((offer) => {
            const scheduleSummary = resolveScheduleSummary(offer);
            const cadenceLabel = formatCadenceShort(offer.frequency);
            const payoutCents =
              offer.estimatedPayout?.totalAmountCents ?? offer.revenueCents ?? 0;
            const recurringPayout =
              offer.isRecurring && payoutCents
                ? formatRecurringPayout(payoutCents, offer.frequency)
                : null;
            const countdown = resolveCountdown(offer.expiresAt, now);
            const windowLabel = resolveWindowLabel(offer);
            const distanceLabel = formatDistanceMiles(offer.distanceMiles ?? null);
            const dogSummary = formatDogSummary(offer.customer?.dogs);
            const requires = Array.isArray(offer.requiredCertifications)
              ? (offer.requiredCertifications as string[])
              : [];
            const isClaimingOffer = Boolean(claimingId && offer.id === claimingId);

            return (
              <article
                key={offer.id}
                className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-soft transition dark:border-slate-900 dark:bg-slate-900/80 dark:shadow-[0_20px_60px_-35px_rgba(15,118,110,0.45)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full px-3 py-1",
                          offer.isDirectOffer
                            ? "border-emerald-400/60 bg-emerald-50 text-emerald-700 dark:border-emerald-400/50 dark:bg-emerald-500/10 dark:text-emerald-200"
                            : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300",
                        )}
                      >
                        {offer.isDirectOffer ? "Direct to you" : "Open board"}
                      </Badge>
                      <span className="rounded-full border border-slate-200 px-3 py-1 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        {offer.isRecurring ? `Ongoing ${cadenceLabel}` : "Single visit"}
                      </span>
                      {requires.length ? (
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-200">
                          <ShieldCheck className="h-4 w-4" />
                          Cert required
                        </span>
                      ) : null}
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      {scheduleSummary}
                    </h3>
                    {offer.isRecurring ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Part of a {cadenceLabel} ongoing cadence.
                      </p>
                    ) : null}
                    {windowLabel ? (
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                        Window: {windowLabel}
                      </p>
                    ) : null}
                  </div>
                  {countdown ? (
                    <span className="flex items-center gap-2 text-xs font-semibold text-rose-500 dark:text-rose-300">
                      <Clock3 className="h-4 w-4" />
                      {countdown}
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <span className="font-medium text-slate-900 dark:text-white">
                      {offer.customer?.name ?? "Customer"}
                    </span>
                    {offer.customer?.city ? (
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        • {offer.customer.city}
                      </span>
                    ) : null}
                  </div>
                  {dogSummary ? (
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <PawPrint className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                      <span>{dogSummary}</span>
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                    <MapPin className="h-4 w-4" />
                    <span>{offer.tile?.name ?? "Service tile"}</span>
                    {distanceLabel ? <span>• {distanceLabel}</span> : null}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                      {formatDollar(payoutCents)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Per visit</p>
                    {recurringPayout ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {recurringPayout}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    className={cn(
                      "h-11 rounded-full px-6 text-base font-semibold shadow-lg shadow-emerald-300/30 transition hover:shadow-xl dark:shadow-emerald-500/40",
                      isClaimingOffer
                        ? "bg-emerald-400 text-slate-900"
                        : "bg-emerald-500 text-slate-900 hover:bg-emerald-400",
                    )}
                    onClick={() => openConfirm(offer)}
                    disabled={isClaimingOffer}
                  >
                    {isClaimingOffer ? "Securing…" : "Review & accept"}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <Dialog
        open={Boolean(confirmOffer)}
        onOpenChange={(open) => {
          if (!open) {
            closeConfirm();
          }
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {confirmNature ? `Review ${confirmNature.label}` : "Review offer"}
            </DialogTitle>
            <DialogDescription>
              Confirm you can fulfill the visit. You can accept the visit now or take the ongoing
              route.
            </DialogDescription>
          </DialogHeader>
          {activeOffer ? (
            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Visit details
                </p>
                <p className="mt-2 text-base font-semibold text-slate-900 dark:text-white">
                  {selectedVisitSummary}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {formatRelative(activeOffer.scheduledDate)}
                </p>
                {resolveWindowLabel(activeOffer) ? (
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                    Window: {resolveWindowLabel(activeOffer)}
                  </p>
                ) : null}
                <div className="mt-3 space-y-1 text-sm">
                  <p className="font-medium text-slate-900 dark:text-white">
                    {activeOffer.customer?.name ?? "Customer"}
                  </p>
                  <p>{activeOffer.customer?.addressLine1 ?? "Address on file"}</p>
                  {formatDistanceMiles(activeOffer.distanceMiles ?? null) ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDistanceMiles(activeOffer.distanceMiles ?? null)}
                    </p>
                  ) : null}
                  {formatDogSummary(activeOffer.customer?.dogs) ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDogSummary(activeOffer.customer?.dogs)}
                    </p>
                  ) : null}
                  {activeOffer.customer?.city ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {activeOffer.customer.city} {activeOffer.customer.zip ?? ""}
                    </p>
                  ) : null}
                  {confirmCadenceLabel ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Cadence: {confirmCadenceLabel}
                    </p>
                  ) : null}
                </div>
              </div>

              {activeOffer.isRecurring ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900/60">
                  <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Ongoing cadence
                  </p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    Part of a {confirmCadenceLabel ?? "recurring"} ongoing route.
                  </p>
                  {recurringPreview ? (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Upcoming: {recurringPreview}
                    </p>
                  ) : null}
                  {confirmRecurringPayout ? (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {confirmRecurringPayout} based on per-visit payout.
                    </p>
                  ) : null}
                  <div className="mt-3">
                    {!confirmingRecurring ? (
                      <Button
                        className="w-full bg-brand-coral text-white hover:bg-brand-coral-ink"
                        onClick={() => setConfirmingRecurring(true)}
                        disabled={!canConfirm || isClaimingSelected}
                      >
                        Accept ongoing route
                      </Button>
                    ) : (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                        <p className="font-semibold">Confirm ongoing route</p>
                        <p className="mt-1">
                          This assigns future visits for this customer to you until you release
                          the route.
                        </p>
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                          <Button variant="outline" onClick={() => setConfirmingRecurring(false)}>
                            Not yet
                          </Button>
                          <Button
                            className="bg-brand-coral text-white hover:bg-brand-coral-ink"
                            onClick={handleConfirmAcceptRecurring}
                            disabled={!canConfirm || isClaimingSelected}
                          >
                            Yes, accept ongoing
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                <p className="font-semibold">Accountability reminder</p>
                <p className="mt-1 leading-relaxed">
                  Do not accept offers you cannot fulfill. Missed visits pause offers after three in a
                  quarter. Late releases within 48 hours are limited to five per quarter, and recurring
                  job releases are capped.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="confirm-availability"
                    checked={confirmChecks.availability}
                    onCheckedChange={(value) =>
                      setConfirmChecks((prev) => ({
                        ...prev,
                        availability: value === true,
                      }))
                    }
                  />
                  <Label
                    htmlFor="confirm-availability"
                    className="text-sm text-slate-600 dark:text-slate-300"
                  >
                    I can complete this visit within the scheduled window.
                  </Label>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="confirm-commitment"
                    checked={confirmChecks.commitment}
                    onCheckedChange={(value) =>
                      setConfirmChecks((prev) => ({
                        ...prev,
                        commitment: value === true,
                      }))
                    }
                  />
                  <Label
                    htmlFor="confirm-commitment"
                    className="text-sm text-slate-600 dark:text-slate-300"
                  >
                    I understand I'm committing to what I accept today (visit or ongoing route).
                  </Label>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="confirm-policy"
                    checked={confirmChecks.policy}
                    onCheckedChange={(value) =>
                      setConfirmChecks((prev) => ({
                        ...prev,
                        policy: value === true,
                      }))
                    }
                  />
                  <Label
                    htmlFor="confirm-policy"
                    className="text-sm text-slate-600 dark:text-slate-300"
                  >
                    I understand missed visits and late releases are tracked and can pause offers or remove me from routes.
                  </Label>
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            {activeOffer?.isDirectOffer ? (
              <Button
                variant="outline"
                onClick={handleConfirmDecline}
                disabled={decliningId === activeOffer?.id}
              >
                {decliningId === activeOffer?.id ? "Declining..." : "Decline offer"}
              </Button>
            ) : (
              <Button variant="outline" onClick={closeConfirm}>
                Cancel
              </Button>
            )}
            <Button
              onClick={handleConfirmAccept}
              disabled={!activeOffer || !canConfirm || isClaimingSelected}
            >
              {isClaimingSelected ? "Securing..." : "Accept this visit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
