"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brandColors, withAlpha } from "@/shared/brand";
import { 
  MapPin, ArrowRight, Clock, CheckCircle2, Search, X, Users, Mail, 
  Loader2, Sparkles, Link2, DollarSign, Globe 
} from "lucide-react";
import Link from "next/link";
import type { CityStatus } from "@/lib/cityData";
import { motion, AnimatePresence } from "framer-motion";

// Pre-loaded city data from parent (Twin Cities)
interface PreloadedCityData {
  name: string;
  displayName: string;
  state: string;
  liveStatus: CityStatus;
  tileCount: number;
  zipCount: number;
  population: number;
  activeScoopers: number;
  hasLiveTiles: boolean;
  waitlistSignups: number;
  zipCodes?: string[]; // For ZIP code search
}

// Search result from API
interface SearchCityResult {
  placeId: string;
  name: string;
  state: string;
  population: number;
  hasService: boolean;
  status: "LIVE" | "WAITLIST" | "DRAFT" | "NONE";
  tileCount: number;
  zipCount: number;
  waitlistCount: number;
  hasDetailPage: boolean;
  slug: string;
}

interface CitySearchProps {
  cities: PreloadedCityData[];
  highlightedCity?: string | null;
  initialZipSearch?: string | null;
}

// Status badge styling helper - high contrast for both light and dark modes
const getStatusConfig = (status: CityStatus | "NONE" | string = "LIVE") => {
  switch (status) {
    case "LIVE":
      return {
        label: "Live",
        bgClass: "bg-emerald-100 dark:bg-emerald-500/25",
        textClass: "text-emerald-800 dark:text-emerald-300",
        borderClass: "border-emerald-300 dark:border-emerald-500/40",
        icon: CheckCircle2,
        dotColor: "bg-emerald-500",
      };
    case "WAITLIST":
    case "COMING_SOON":
    default:
      return {
        label: "Not yet live",
        bgClass: "bg-amber-100 dark:bg-brand-gold/25",
        textClass: "text-amber-800 dark:text-brand-gold",
        borderClass: "border-amber-300 dark:border-brand-gold/40",
        icon: Clock,
        dotColor: "bg-amber-500 dark:bg-brand-gold",
      };
  }
};

type FilterStatus = "all" | "LIVE" | "HAS_INTEREST";

// Convert API result to display format
function mapApiResultToStatus(status: SearchCityResult["status"]): CityStatus {
  if (status === "LIVE") return "LIVE";
  if (status === "WAITLIST") return "WAITLIST";
  return "COMING_SOON";
}

// Launch threshold - signups needed to consider launching a city
const LAUNCH_THRESHOLD = 15;

// Inline waitlist signup form
function WaitlistForm({ 
  city, 
  onSuccess 
}: { 
  city: { placeId: string; name: string; state: string; population: number; waitlistCount?: number }; 
  onSuccess: (count: number) => void;
}) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [finalCount, setFinalCount] = useState(city.waitlistCount ?? 0);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/cities/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          placeId: city.placeId,
          cityName: city.name,
          state: city.state,
          population: city.population,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to join waitlist");
      }

      const newCount = data.waitlistCount || (city.waitlistCount ?? 0) + 1;
      setFinalCount(newCount);
      setSuccess(true);
      onSuccess(newCount);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const shareUrl = typeof window !== "undefined" 
    ? `${window.location.origin}/city?search=${encodeURIComponent(city.name)}`
    : "";
  
  const shareText = `I just joined the InsightScoop waitlist for ${city.name}, ${city.state}! Help bring clean yards + pet wellness insights to our neighborhood 🐕`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleShareTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, "_blank", "width=550,height=420");
  };

  const handleShareFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank", "width=550,height=420");
  };

  if (success) {
    const progress = Math.min((finalCount / LAUNCH_THRESHOLD) * 100, 100);
    const remaining = Math.max(LAUNCH_THRESHOLD - finalCount, 0);
    const isClose = remaining <= 5 && remaining > 0;
    const isReady = remaining === 0;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-xl bg-gradient-to-br from-emerald-50 to-amber-50/50 dark:from-emerald-900/40 dark:to-emerald-950/60 border border-emerald-200 dark:border-emerald-500/40 p-4 space-y-4"
      >
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 dark:text-emerald-400" />
          <p className="mt-2 font-semibold text-emerald-700 dark:text-emerald-300">
            You&apos;re on the list!
          </p>
        </div>

        {/* Progress toward launch */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-200">Progress to launch</span>
            <span className="font-bold text-slate-900 dark:text-white">
              {finalCount} / {LAUNCH_THRESHOLD}
            </span>
          </div>
          <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-600/60 overflow-hidden ring-1 ring-inset ring-black/5 dark:ring-white/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={`h-full rounded-full shadow-sm ${
                isReady 
                  ? "bg-emerald-500 dark:bg-emerald-400" 
                  : isClose 
                    ? "bg-amber-500 dark:bg-amber-400" 
                    : "bg-brand-coral dark:bg-brand-coral"
              }`}
            />
          </div>
          <p className="text-xs text-center text-slate-700 dark:text-slate-200">
            {isReady ? (
              <span className="text-emerald-600 dark:text-emerald-300 font-semibold">
                🎉 Launch threshold reached! We&apos;re reviewing {city.name}.
              </span>
            ) : isClose ? (
              <span className="text-amber-600 dark:text-amber-300 font-semibold">
                Almost there! Only {remaining} more needed.
              </span>
            ) : (
              <span className="font-medium">
                {remaining} more signups needed to launch {city.name}
              </span>
            )}
          </p>
        </div>

        {/* Share section */}
        {!isReady && (
          <div className="border-t border-emerald-300/60 dark:border-emerald-500/30 pt-4 space-y-3">
            <p className="text-xs text-center font-semibold text-slate-800 dark:text-white">
              🚀 Help {city.name} go live faster—share with neighbors!
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="flex-1 h-9 rounded-lg border-slate-300 dark:border-white/25 bg-white/60 dark:bg-white/10 text-slate-700 dark:text-white text-xs hover:bg-white dark:hover:bg-white/20"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Link2 className="h-3.5 w-3.5 mr-1.5" />
                    Copy link
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleShareTwitter}
                className="h-9 w-9 rounded-lg border-slate-300 dark:border-white/25 bg-white/60 dark:bg-white/10 text-slate-700 dark:text-white p-0 hover:bg-white dark:hover:bg-white/20"
                title="Share on X/Twitter"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleShareFacebook}
                className="h-9 w-9 rounded-lg border-slate-300 dark:border-white/25 bg-white/60 dark:bg-white/10 text-slate-700 dark:text-white p-0 hover:bg-white dark:hover:bg-white/20"
                title="Share on Facebook"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </Button>
            </div>
          </div>
        )}

        {/* Become a scooper CTA */}
        <div className="border-t border-emerald-300/60 dark:border-emerald-500/30 pt-4">
          <Link 
            href={`/scooper?city=${encodeURIComponent(city.name)}`}
            className="flex items-center justify-center gap-2 rounded-xl bg-brand-gold/15 hover:bg-brand-gold/25 border border-brand-gold/30 px-4 py-2.5 text-xs font-semibold text-brand-gold transition-colors"
          >
            <DollarSign className="h-3.5 w-3.5" />
            Earn $20-30/hr scooping in {city.name}
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <Input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11 flex-1 rounded-xl border-slate-200 dark:border-white/15 bg-white dark:bg-white/5 text-sm focus-visible:ring-brand-coral/30"
          required
        />
        <Button
          type="submit"
          disabled={isSubmitting || !email.trim()}
          variant="outline"
          className="h-11 rounded-xl border-2 border-brand-coral text-brand-coral hover:bg-brand-coral/10 px-4 disabled:opacity-50"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Join"
          )}
        </Button>
      </div>
      {error && (
        <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
      )}
    </form>
  );
}

// Unified city card component
function CityCard({ 
  city,
  accent,
  isFromSearch = false,
  onWaitlistSuccess,
}: { 
  city: PreloadedCityData | SearchCityResult;
  accent: string;
  isFromSearch?: boolean;
  onWaitlistSuccess?: (placeId: string, count: number) => void;
}) {
  // Normalize the city data
  const isPreloaded = 'displayName' in city;
  const displayName = isPreloaded ? city.displayName : city.name;
  const name = isPreloaded ? city.name : city.name;
  const state = city.state;
  const population = city.population;
  const zipCount = isPreloaded ? city.zipCount : city.zipCount;
  const tileCount = isPreloaded ? city.tileCount : city.tileCount;
  const activeScoopers = isPreloaded ? city.activeScoopers : 0;
  const waitlistCount = isPreloaded ? city.waitlistSignups : (city as SearchCityResult).waitlistCount;
  const hasDetailPage = isPreloaded ? true : (city as SearchCityResult).hasDetailPage;
  const slug = isPreloaded ? city.name : (city as SearchCityResult).slug;
  const placeId = isPreloaded ? `preloaded-${city.name}` : (city as SearchCityResult).placeId;
  
  // Determine status
  const status: CityStatus = isPreloaded 
    ? city.liveStatus 
    : mapApiResultToStatus((city as SearchCityResult).status);
  
  const statusConfig = getStatusConfig(status);
  const StatusIcon = statusConfig.icon;
  const isLive = status === "LIVE";

  const [localWaitlistCount, setLocalWaitlistCount] = useState(waitlistCount);

  const handleWaitlistSuccess = (count: number) => {
    setLocalWaitlistCount(count);
    onWaitlistSuccess?.(placeId, count);
  };

  // Use consistent colors based on status, not rotating accents
  const statusColor = isLive ? "#10b981" : "#f59e0b"; // emerald-500 for live, amber-500 for not live

  return (
    <Card className="group relative overflow-hidden rounded-[28px] border border-slate-200/60 dark:border-white/10 shadow-sm dark:shadow-[0_24px_48px_rgba(3,7,6,0.4)] transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
      {/* Colored accent stripe at top - based on status */}
      <div 
        className="absolute top-0 left-0 right-0 h-1" 
        style={{ backgroundColor: statusColor, opacity: 0.8 }} 
      />

      {/* Gradient background - clean white/gray tones */}
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(135deg, ${withAlpha(statusColor, 0.04)} 0%, transparent 40%)` }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-white via-slate-50/95 to-white dark:from-[rgba(12,22,18,0.95)] dark:via-[rgba(10,20,16,0.9)] dark:to-[rgba(8,18,14,0.85)]" />

      <CardContent className="relative z-10 p-6 pt-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${statusConfig.bgClass} ${statusConfig.textClass} ${statusConfig.borderClass}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dotColor} ${isLive ? "animate-pulse" : ""}`} />
              {statusConfig.label}
            </div>
            <h2 className="mt-2 truncate text-2xl font-serif font-semibold text-slate-900 dark:text-white">
              {displayName}
            </h2>
            <div className="mt-2 flex items-center gap-2 text-sm text-slate-600 dark:text-white/75">
              <MapPin className="size-4" />
              <span>{state}</span>
            </div>
          </div>
          {/* Icon uses consistent status-based color */}
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-transform duration-300 group-hover:scale-105 ${
              isLive 
                ? "bg-emerald-100 dark:bg-emerald-500/20 border-emerald-300 dark:border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-100 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/40 text-amber-600 dark:text-amber-400"
            }`}
          >
            <StatusIcon className="size-4" />
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {zipCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg bg-slate-200 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-slate-700 dark:text-slate-300">
              <MapPin className="size-3" />
              <span>{zipCount} ZIP{zipCount !== 1 ? "s" : ""}</span>
            </div>
          )}
          {population > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg bg-slate-200 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-slate-700 dark:text-slate-300">
              <Users className="size-3" />
              <span>{(population / 1000).toFixed(0)}k</span>
            </div>
          )}
          {isLive && activeScoopers > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-500/25 border border-emerald-300 dark:border-emerald-500/40 px-2.5 py-1.5 text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="size-3" />
              <span>{activeScoopers} scooper{activeScoopers !== 1 ? "s" : ""}</span>
            </div>
          )}
          {localWaitlistCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg bg-amber-100 dark:bg-brand-gold/25 border border-amber-300 dark:border-brand-gold/40 px-2.5 py-1.5 text-amber-800 dark:text-brand-gold font-medium">
              <Sparkles className="size-3" />
              <span>{localWaitlistCount} waiting</span>
            </div>
          )}
          {tileCount > 1 && (
            <div className="flex items-center gap-1.5 rounded-lg bg-slate-200 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-slate-700 dark:text-slate-300">
              <span>{tileCount} zones</span>
            </div>
          )}
        </div>

        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-white/80">
          {isLive
            ? "Service is live! Get a clean yard plus wellness notes."
            : status === "WAITLIST"
              ? "Building demand! Join the waitlist to help launch."
              : "Not available yet. Be first to know when we launch!"}
        </p>

        <div className="mt-5 space-y-3">
          {isLive ? (
            <>
              {hasDetailPage && (
                <Button
                  asChild
                  variant="outline"
                  className="w-full rounded-xl border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-white px-5 py-4 text-base font-semibold bg-transparent hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                >
                  <Link href={`/city/${slug}`}>
                    View {displayName}
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
              )}
              <Button
                asChild
                className="w-full rounded-xl px-5 py-4 text-base font-semibold bg-brand-coral text-white hover:bg-brand-coral-ink shadow-md transition-colors"
              >
                <Link href="/quote">Get my quote</Link>
              </Button>
            </>
          ) : (
            <WaitlistForm 
              city={{ placeId, name, state, population, waitlistCount: localWaitlistCount }} 
              onSuccess={handleWaitlistSuccess} 
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function CitySearch({ cities }: CitySearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [searchResults, setSearchResults] = useState<SearchCityResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);

  // Read search query from URL on initial load
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlSearch = params.get("search");
      if (urlSearch) {
        setSearchQuery(urlSearch);
        // Focus the input after setting the query
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }
  }, []);

  // Count cities by status (Live vs Has Interest/waitlist signups)
  const statusCounts = useMemo(() => {
    const counts = { LIVE: 0, HAS_INTEREST: 0 };
    cities.forEach((city) => {
      if (city.liveStatus === "LIVE") {
        counts.LIVE++;
      }
      if (city.waitlistSignups > 0) {
        counts.HAS_INTEREST++;
      }
    });
    return counts;
  }, [cities]);

  // Check if user is actively searching
  const isSearching = searchQuery.trim().length >= 2;

  // Filter pre-loaded cities
  // By default (no search), only show LIVE cities
  // When searching, show matching cities regardless of status
  const filteredPreloadedCities = useMemo(() => {
    let result = cities;

    if (isSearching) {
      // When searching, show ALL matching cities (including non-live for waitlist signup)
      const query = searchQuery.toLowerCase().trim();
      const isZipSearch = /^\d{5}$/.test(query) || /^\d{3,4}$/.test(query); // Partial or full ZIP
      
      result = result.filter((city) => {
        // Match by city name or state
        const nameMatch = 
          city.displayName.toLowerCase().includes(query) ||
          city.state.toLowerCase().includes(query) ||
          city.name.toLowerCase().includes(query);
        
        // Match by ZIP code
        const zipMatch = city.zipCodes?.some((zip) => zip.startsWith(query)) ?? false;
        
        return nameMatch || zipMatch;
      });
    } else {
      // By default, only show LIVE cities
      result = result.filter((city) => city.liveStatus === "LIVE");
    }

    // Apply additional filter if set
    if (filterStatus === "LIVE") {
      result = result.filter((city) => city.liveStatus === "LIVE");
    } else if (filterStatus === "HAS_INTEREST") {
      result = result.filter((city) => city.waitlistSignups > 0);
    }

    const statusOrder: Record<CityStatus, number> = { LIVE: 0, WAITLIST: 1, COMING_SOON: 2 };
    return result.sort((a, b) => {
      const statusDiff = statusOrder[a.liveStatus] - statusOrder[b.liveStatus];
      if (statusDiff !== 0) return statusDiff;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [cities, searchQuery, filterStatus, isSearching]);

  // Filter nationwide results to exclude cities already in preloaded list
  const filteredSearchResults = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];
    
    const preloadedNames = new Set(cities.map(c => c.name.toLowerCase()));
    return searchResults.filter(
      (city) => !preloadedNames.has(city.name.toLowerCase())
    );
  }, [searchResults, cities, searchQuery]);

  // Nationwide search effect
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    setIsLoading(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/cities/search?q=${encodeURIComponent(searchQuery)}&limit=30`);
        const data = await res.json();
        setSearchResults(data.cities || []);
      } catch (error) {
        console.error("Search error:", error);
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Update URL when search query changes (for shareable links)
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const url = new URL(window.location.href);
    if (searchQuery.trim()) {
      url.searchParams.set("search", searchQuery.trim());
    } else {
      url.searchParams.delete("search");
    }
    
    // Use replaceState to avoid polluting browser history
    window.history.replaceState({}, "", url.toString());
  }, [searchQuery]);

  const clearSearch = () => {
    setSearchQuery("");
    setFilterStatus("all");
    setSearchResults([]);
  };

  const handleWaitlistSuccess = (placeId: string, count: number) => {
    setSearchResults((prev) =>
      prev.map((c) => (c.placeId === placeId ? { ...c, waitlistCount: count } : c))
    );
  };

  // Combined results
  const hasPreloadedResults = filteredPreloadedCities.length > 0;
  const hasSearchResults = filteredSearchResults.length > 0;
  const hasAnyResults = hasPreloadedResults || hasSearchResults;
  const totalResults = filteredPreloadedCities.length + filteredSearchResults.length;

  return (
    <div className="space-y-6">
      {/* Search and Filter Bar */}
      <div className="sticky top-20 z-20 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-[#060e0a]/95 backdrop-blur-md p-4 shadow-sm">
        {/* Prominent search prompt */}
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-500/15 dark:to-amber-600/10 border border-amber-200 dark:border-amber-500/30 px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400 text-slate-900">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-white text-sm">
              Search any city in the US
            </p>
            <p className="text-xs text-slate-600 dark:text-white/70">
              Not in our service area yet? Sign up for the waitlist and help bring us to your neighborhood!
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-white/50" />
            <Input
              ref={inputRef}
              type="text"
              placeholder="Search any US city or ZIP code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-12 rounded-xl border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-white/5 pl-12 pr-10 text-base text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/50 focus-visible:ring-brand-coral/40"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-white/50 dark:hover:text-white/80"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Status Filter Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => setFilterStatus("all")}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                filterStatus === "all"
                  ? "bg-brand-coral/90 text-white shadow-sm"
                  : "bg-white dark:bg-white/10 text-slate-600 dark:text-white/70 hover:bg-slate-50 dark:hover:bg-white/15 border border-slate-200 dark:border-transparent"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus("LIVE")}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all border ${
                filterStatus === "LIVE"
                  ? "bg-emerald-600 text-white shadow-sm border-emerald-600"
                  : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40 hover:bg-emerald-200 dark:hover:bg-emerald-500/30"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${filterStatus === "LIVE" ? "bg-white" : "bg-emerald-500"} ${filterStatus !== "LIVE" ? "animate-pulse" : ""}`} />
                Live ({statusCounts.LIVE})
              </span>
            </button>
            {statusCounts.HAS_INTEREST > 0 && (
              <button
                onClick={() => setFilterStatus("HAS_INTEREST")}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all border ${
                  filterStatus === "HAS_INTEREST"
                    ? "bg-amber-500 text-white shadow-sm border-amber-500"
                    : "bg-amber-100 dark:bg-brand-gold/20 text-amber-800 dark:text-brand-gold border-amber-300 dark:border-brand-gold/40 hover:bg-amber-200 dark:hover:bg-brand-gold/30"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Sparkles className={`h-3.5 w-3.5 ${filterStatus === "HAS_INTEREST" ? "text-white" : ""}`} />
                  Has interest ({statusCounts.HAS_INTEREST})
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Search status indicator */}
        {(searchQuery || filterStatus !== "all") && (
          <div className="mt-3 flex items-center justify-between border-t border-slate-200 dark:border-white/10 pt-3">
            <p className="text-sm text-slate-600 dark:text-white/70">
              {isSearching ? (
                <>
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Searching...
                    </span>
                  ) : (
                    <>
                      Found <span className="font-semibold text-slate-900 dark:text-white">{totalResults}</span> cities
                      {hasSearchResults && (
                        <span className="text-brand-coral"> • Including nationwide results</span>
                      )}
                    </>
                  )}
                </>
              ) : (
                <>
                  Showing <span className="font-semibold text-slate-900 dark:text-white">{filteredPreloadedCities.length}</span> of {cities.length} cities
                </>
              )}
            </p>
            <button
              onClick={clearSearch}
              className="text-sm font-semibold text-brand-coral hover:text-brand-coral-ink transition"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      {!hasAnyResults && !isLoading ? (
        <div className="rounded-3xl border border-slate-200 dark:border-white/15 bg-white dark:bg-white/5 p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-white/10">
            <Search className="h-8 w-8 text-slate-400 dark:text-white/50" />
          </div>
          <h3 className="text-xl font-serif font-semibold text-slate-900 dark:text-white">
            {isSearching ? `No cities found for "${searchQuery}"` : "No cities found"}
          </h3>
          <p className="mt-2 text-slate-600 dark:text-white/70">
            {isSearching 
              ? "Try a different search term or check the spelling" 
              : "Try adjusting your filters"}
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button onClick={clearSearch} variant="outline" className="rounded-xl border-brand-coral/30 dark:border-white/20 text-brand-coral hover:bg-brand-coral/10">
              Clear filters
            </Button>
            <Button asChild variant="outline" className="rounded-xl border-2 border-brand-coral text-brand-coral hover:bg-brand-coral/10">
              <Link href="/quote">Get a quote anyway</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Preloaded Twin Cities results */}
          {hasPreloadedResults && (
            <div>
              {isSearching && hasSearchResults && (
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-white/60">
                  Twin Cities Metro
                </h3>
              )}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredPreloadedCities.map((city, index) => {
                  const accents = [brandColors.mint, brandColors.gold, brandColors.coral, brandColors.sunset];
                  const accent = accents[index % accents.length] ?? brandColors.mint;
                  return (
                    <CityCard
                      key={`preloaded-${city.name}`}
                      city={city}
                      accent={accent}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Nationwide search results */}
          {hasSearchResults && (
            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-white/60">
                {hasPreloadedResults ? "Other US Cities" : "Search Results"}
              </h3>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredSearchResults.map((city, index) => {
                  const accents = [brandColors.mint, brandColors.gold, brandColors.coral, brandColors.sunset];
                  const accent = accents[(index + filteredPreloadedCities.length) % accents.length] ?? brandColors.mint;
                  return (
                    <CityCard
                      key={`search-${city.placeId}`}
                      city={city}
                      accent={accent}
                      isFromSearch
                      onWaitlistSuccess={handleWaitlistSuccess}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
