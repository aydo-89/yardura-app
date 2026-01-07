"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, CircleAlert, Clock4, Headphones, Home, Sparkles, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }
  return response.json();
};

type Availability = {
  id: string;
  weekday: number;
  window: string;
  tile: {
    id: string;
    name: string;
    slug: string;
    status: string;
  } | null;
};

type Compliance = {
  complianceIssues: string[];
  canClaimEcoDiversion: boolean;
  canClaimHaulAway: boolean;
};

type MeResponse = {
  user: {
    name: string | null;
    email: string | null;
    phone: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
  };
  profile: {
    status: string;
    rating: number | null;
    totalStops: number | null;
  };
  compliance: Compliance | null;
  availability: Availability[];
  routing?: {
    homeAnchor?: {
      lat: number;
      lng: number;
      address?: string;
    } | null;
    routeCredits: number;
    homeAddressInput?: {
      address?: string;
      city?: string;
      state?: string;
      zip?: string;
    } | null;
    homeAnchorValidation?: {
      validatedAt?: string | null;
      verdict?: Record<string, unknown> | null;
      suggestions?: Array<{
        name?: string;
        componentType?: string;
        confirmationLevel?: string;
        replaced?: string;
        spellCorrected?: boolean;
      }> | null;
    } | null;
  };
};

const WEEKDAY_LABEL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function AvailabilitySkeleton() {
  return <Skeleton className="h-16 w-full rounded-2xl bg-white/80 dark:bg-slate-900/60" />;
}

export default function FieldTechProfilePage() {
  const { data, isLoading, mutate } = useSWR<MeResponse>("/api/field-tech/me", fetcher, {
    refreshInterval: 5 * 60 * 1000,
  });

  const compliance = data?.compliance;
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);

  useEffect(() => {
    if (!data) return;
    const homeInputs = data.routing?.homeAddressInput;
    setAddress(homeInputs?.address ?? data.user.address ?? "");
    setCity(homeInputs?.city ?? data.user.city ?? "");
    setState(homeInputs?.state ?? "");
    setZip(homeInputs?.zip ?? data.user.zipCode ?? "");
  }, [data]);

  const handleHomeAnchorSave = async () => {
    if (!address || !city || !state || !zip) {
      toast.error("Fill out every field before saving your home base.");
      return;
    }
    setSavingAddress(true);
    try {
      const response = await fetch("/api/field-tech/home-anchor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, city, state, zip }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload?.message ?? payload?.error ?? "Unable to save home base";
        const suggestions = Array.isArray(payload?.suggestions) ? payload.suggestions : [];
        if (suggestions.length) {
          const hint = suggestions
            .map((suggestion: any) => suggestion?.replaced || suggestion?.name)
            .filter(Boolean)
            .join(", ");
          toast.error(message, {
            description: hint ? `Suggested edits: ${hint}` : undefined,
          });
        } else {
          toast.error(message);
        }
        return;
      }
      toast.success("Home base updated. Routes will use this starting point now.");
      await mutate();
    } catch (error: any) {
      toast.error(error?.message ?? "Unable to save home base");
    } finally {
      setSavingAddress(false);
    }
  };

  const routeCredits = data?.routing?.routeCredits ?? 0;
  const homeAnchorAddress = data?.routing?.homeAnchor?.address;
  const homeAnchorValidation = data?.routing?.homeAnchorValidation;
  const validationSuggestions = Array.isArray(homeAnchorValidation?.suggestions)
    ? homeAnchorValidation?.suggestions ?? []
    : [];
  const verdictFlags = (homeAnchorValidation?.verdict ?? {}) as Record<string, any>;
  const needsAddressReview = Boolean(
    !homeAnchorValidation?.validatedAt ||
      verdictFlags?.hasUnverifiedComponents ||
      verdictFlags?.hasInferredComponents ||
      verdictFlags?.hasReplacedComponents ||
      verdictFlags?.hasUnconfirmedComponents,
  );
  const validationTimestamp = homeAnchorValidation?.validatedAt
    ? formatDistanceToNow(new Date(homeAnchorValidation.validatedAt), { addSuffix: true })
    : null;

  return (
    <div className="flex flex-1 flex-col gap-6 pb-6">
      <section className="rounded-3xl border border-slate-200/70 dark:border-slate-900 bg-white dark:bg-slate-900/80 p-6">
        {isLoading ? (
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-full bg-slate-200 dark:bg-slate-800" />
            <div className="flex-1">
              <Skeleton className="mb-2 h-5 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-xl font-semibold text-emerald-300">
              {data?.user?.name?.[0]?.toUpperCase() ?? "S"}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
                {data?.user?.name ?? "Scooper"}
              </h1>
              <p className="text-sm text-slate-400">{data?.user?.email ?? "—"}</p>
              {data?.profile?.rating ? (
                <p className="mt-1 text-xs text-emerald-300">
                  ⭐ {data.profile.rating.toFixed(2)} customer rating
                </p>
              ) : null}
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center gap-3 text-xs text-slate-400">
          <Badge variant="outline" className="rounded-full border-emerald-400/60 text-emerald-600 dark:text-emerald-200">
            {data?.profile?.status ?? "Pending"}
          </Badge>
          {data?.profile?.totalStops ? (
            <span>{data.profile.totalStops.toLocaleString()} lifetime stops</span>
          ) : null}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/70 dark:border-slate-900 bg-white dark:bg-slate-900/80 p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-300" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Compliance</h2>
        </div>

        {isLoading ? (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : null}

        {!isLoading && compliance ? (
          <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-300" />
              <span>
                Haul-away eligible: {compliance.canClaimHaulAway ? "Yes" : "No"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-300" />
              <span>
                Eco diversion eligible: {compliance.canClaimEcoDiversion ? "Yes" : "No"}
              </span>
            </div>
            {compliance.complianceIssues.length ? (
              <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CircleAlert className="h-4 w-4" /> Attention needed
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-600 dark:text-amber-200">
                  {compliance.complianceIssues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4" /> All systems go
                </div>
                <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-200">
                  You’re cleared to scoop every service tier you’re certified for.
                </p>
              </div>
            )}
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200/70 dark:border-slate-900 bg-white dark:bg-slate-900/80 p-6">
        <div className="flex items-center gap-2">
          <Clock4 className="h-5 w-5 text-emerald-300" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Availability</h2>
        </div>

        {isLoading ? (
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <AvailabilitySkeleton key={idx} />
            ))}
          </div>
        ) : null}

        {!isLoading && (data?.availability?.length ?? 0) === 0 ? (
          <p className="mt-4 text-sm text-slate-400">
            Add availability from the admin console to start receiving offers in new tiles.
          </p>
        ) : null}

        <div className="mt-4 space-y-3">
          {data?.availability?.map((slot) => (
            <div
              key={slot.id}
              className="flex items-center justify-between rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/60 px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {WEEKDAY_LABEL[slot.weekday]}
                </p>
                <p className="text-xs text-slate-400">{slot.window.replaceAll("_", " ")}</p>
              </div>
              <Badge variant="outline" className="rounded-full border-slate-200/70 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                {slot.tile?.name ?? "Any tile"}
              </Badge>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/70 dark:border-slate-900 bg-white dark:bg-slate-900/80 p-6 text-sm text-slate-600 dark:text-slate-300">
        <div className="flex items-center gap-2 text-slate-900 dark:text-white">
          <Headphones className="h-5 w-5 text-emerald-500 dark:text-emerald-300" />
          <h2 className="text-lg font-semibold">Support</h2>
        </div>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          Need help with equipment, pay, or a route? Tap below to text the Ops line.
        </p>
        <Button className="mt-4 w-full rounded-full bg-emerald-500 text-slate-900 hover:bg-emerald-400">
          Text Field Ops
        </Button>
      </section>

      <section className="rounded-3xl border border-slate-200/70 dark:border-slate-900 bg-white dark:bg-slate-900/80 p-6">
        <div className="flex items-center gap-2">
          <Home className="h-5 w-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Home base</h2>
        </div>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
          We optimize every route from your saved home address. Update it anytime if you move or want pickups near a new depot.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
              Street address
            </label>
            <Input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="123 Main St" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
              City
            </label>
            <Input value={city} onChange={(event) => setCity(event.target.value)} placeholder="City" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
              State / Province
            </label>
            <Input value={state} onChange={(event) => setState(event.target.value)} placeholder="State" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
              Postal code
            </label>
            <Input value={zip} onChange={(event) => setZip(event.target.value)} placeholder="ZIP" />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Button onClick={handleHomeAnchorSave} disabled={savingAddress}>
            {savingAddress ? "Saving…" : "Save home base"}
          </Button>
          {homeAnchorAddress ? (
            <p className="text-xs text-slate-500 dark:text-slate-300">
              Current home anchor: <span className="font-semibold text-slate-700 dark:text-white">{homeAnchorAddress}</span>
            </p>
          ) : (
            <p className="text-xs text-amber-600">Add your home address to unlock optimized routes.</p>
          )}
        </div>
        <div className="mt-6 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
          <div className="flex items-center gap-2 font-semibold">
            <Sparkles className="h-4 w-4 text-emerald-400" /> Route credits
          </div>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{routeCredits}</p>
          <p className="text-xs text-slate-500 dark:text-slate-300">
            Custom start / end requests use 1 credit. Contact dispatch if you need more.
          </p>
        </div>
        <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200">
          <div className="flex items-center gap-2 font-semibold">
            {needsAddressReview ? (
              <CircleAlert className="h-4 w-4 text-amber-500" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            )}
            <span>
              {validationTimestamp
                ? `Validated ${validationTimestamp}`
                : "Address validation pending"}
            </span>
          </div>
          {needsAddressReview ? (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
              Google flagged parts of this address. Please confirm the spelling or update the fields above, then save again.
            </p>
          ) : (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">
              We’ll start every route from this validated home base.
            </p>
          )}
          {validationSuggestions.length ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-500 dark:text-slate-300">
              {validationSuggestions.map((suggestion, index) => (
                <li key={`${suggestion?.name ?? "s"}-${index}`}>
                  {suggestion?.replaced
                    ? `Replaced ${suggestion.replaced}`
                    : suggestion?.name ?? "Component"}
                  {suggestion?.spellCorrected ? " (auto-corrected)" : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>
    </div>
  );
}
