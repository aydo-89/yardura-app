"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Search, CheckCircle2, Clock, MapPin, ArrowRight, Loader2, Sparkles, X,
  Users, Link2, Share2
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

interface ZipCheckResult {
  eligible: boolean;
  message: string;
  cityInfo?: {
    city: string;
    state: string;
  } | null;
  densityClassification?: {
    zoneType: string;
    zoneName: string;
    population?: number;
  } | null;
  tile?: {
    slug: string;
    status: "LIVE" | "WAITLIST" | "DRAFT" | "SUSPENDED";
  } | null;
}

interface ZipCheckerProps {
  onZipFound?: (zip: string, cityName: string | null) => void;
}

// Launch threshold for MVD
const LAUNCH_THRESHOLD = 15;

export default function ZipChecker({ onZipFound }: ZipCheckerProps) {
  const [zipCode, setZipCode] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<ZipCheckResult | null>(null);
  const [showWaitlistForm, setShowWaitlistForm] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const checkZip = useCallback(async () => {
    if (zipCode.length !== 5) return;
    
    setIsChecking(true);
    setResult(null);
    setShowWaitlistForm(false);
    setWaitlistSuccess(false);
    
    try {
      const response = await fetch(`/api/zip-eligibility?zip=${zipCode}`);
      const data = await response.json();
      setResult(data);
      
      // Notify parent of the city found
      if (onZipFound) {
        onZipFound(zipCode, data.cityInfo?.city ?? null);
      }
    } catch (error) {
      console.error("ZIP check error:", error);
      setResult({
        eligible: false,
        message: "Unable to check coverage. Please try again.",
      });
    } finally {
      setIsChecking(false);
    }
  }, [zipCode, onZipFound]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    checkZip();
  };

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !result?.cityInfo) return;

    setWaitlistError(null);
    
    try {
      // Generate a placeId from city+state if not provided
      const placeId = `zip-${zipCode}-${result.cityInfo.city.toLowerCase().replace(/\s+/g, "-")}-${result.cityInfo.state.toLowerCase()}`;
      
      const response = await fetch("/api/cities/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          phone: phone || undefined,
          placeId,
          cityName: result.cityInfo.city,
          state: result.cityInfo.state,
          population: result.densityClassification?.population,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || "Failed to join waitlist");
      }

      setWaitlistCount(data.waitlistCount || 1);
      setWaitlistSuccess(true);
      setShowWaitlistForm(false);
    } catch (error: any) {
      setWaitlistError(error.message || "Failed to join waitlist. Please try again.");
    }
  };

  const shareUrl = typeof window !== "undefined" && result?.cityInfo 
    ? `${window.location.origin}/city?search=${encodeURIComponent(result.cityInfo.city)}`
    : "";
  
  const shareText = result?.cityInfo 
    ? `I just joined the InsightScoop waitlist for ${result.cityInfo.city}! Help bring clean yards + pet wellness insights to our neighborhood 🐕`
    : "";

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

  const clearResult = () => {
    setResult(null);
    setZipCode("");
    setShowWaitlistForm(false);
    setWaitlistSuccess(false);
    if (onZipFound) {
      onZipFound("", null);
    }
  };

  // isLive if API says eligible OR if tile is explicitly LIVE
  const isLive = result?.eligible || result?.tile?.status === "LIVE";
  const isWaitlist = !isLive;

  return (
    <div className="mx-auto max-w-xl">
      {/* ZIP Input Form - with frosted glass effect for better visibility */}
      <div className="rounded-2xl bg-slate-900/70 backdrop-blur-xl border border-white/15 p-5 shadow-2xl">
        <form onSubmit={handleSubmit} className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/60" />
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={5}
                placeholder="Enter your ZIP code"
                value={zipCode}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 5);
                  setZipCode(val);
                  if (val.length < 5) {
                    setResult(null);
                  }
                }}
                className="h-14 rounded-xl border-white/25 bg-white/15 backdrop-blur-sm pl-12 pr-4 text-lg text-white placeholder:text-white/60 focus-visible:ring-brand-coral/50 focus-visible:border-brand-coral/50"
              />
            </div>
            <Button
              type="submit"
              disabled={zipCode.length !== 5 || isChecking}
              className="h-14 px-6 rounded-xl bg-brand-coral hover:bg-brand-coral-ink text-white font-semibold shadow-lg shadow-brand-coral/30 disabled:opacity-50"
            >
              {isChecking ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Search className="h-5 w-5 mr-2" />
                  Check
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Result Display */}
        <AnimatePresence mode="wait">
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4"
            >
              {isLive ? (
                /* Service Available */
                <div className="rounded-xl border border-emerald-400/40 bg-emerald-900/50 p-4 text-left">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/30 ring-2 ring-emerald-400/30">
                        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-emerald-300 text-lg">Service available!</p>
                        {result.cityInfo && (
                          <p className="text-sm text-white/90">
                            {result.cityInfo.city}, {result.cityInfo.state}
                            {result.densityClassification && (
                              <span className="ml-2 text-white/70">• {result.densityClassification.zoneName}</span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                    <button onClick={clearResult} className="text-white/60 hover:text-white">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="mt-4 flex flex-col sm:flex-row gap-3">
                    <Button asChild className="flex-1 h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold shadow-lg">
                      <Link href="/quote">
                        Get my quote
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="flex-1 h-11 rounded-xl border-white/30 bg-white/10 text-white hover:bg-white/20">
                      <Link href={`/city/${result.cityInfo?.city?.toLowerCase().replace(/\s+/g, "-")}`}>
                        View city details
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                /* Not Yet Live - Waitlist - PROMINENT CTA */
                <div className="rounded-xl border border-brand-gold/50 bg-gradient-to-br from-brand-gold/20 to-amber-900/40 p-4 text-left">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-gold/30 ring-2 ring-brand-gold/40">
                        <Clock className="h-5 w-5 text-brand-gold" />
                      </div>
                      <div>
                        <p className="font-semibold text-brand-gold text-lg">Not yet live</p>
                        {result.cityInfo && (
                          <p className="text-sm text-white/90">
                            {result.cityInfo.city}, {result.cityInfo.state}
                            {result.densityClassification && (
                              <span className="ml-2 text-white/70">• {result.densityClassification.zoneName}</span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                    <button onClick={clearResult} className="text-white/60 hover:text-white">
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {waitlistSuccess ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mt-4 space-y-4"
                    >
                      {/* Success message */}
                      <div className="rounded-lg bg-emerald-900/50 border border-emerald-400/40 p-4">
                        <div className="flex items-center gap-2 text-emerald-300">
                          <Sparkles className="h-5 w-5" />
                          <span className="font-bold text-lg">You&apos;re on the waitlist!</span>
                        </div>
                        <p className="mt-2 text-sm text-white/80">
                          We&apos;ll notify you when service launches in {result.cityInfo?.city}.
                        </p>
                        
                        {/* Progress toward launch */}
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-white/80">Progress to launch</span>
                            <span className="font-bold text-white">{waitlistCount} / {LAUNCH_THRESHOLD}</span>
                          </div>
                          <div className="h-2.5 rounded-full bg-slate-700/60 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min((waitlistCount / LAUNCH_THRESHOLD) * 100, 100)}%` }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                              className="h-full rounded-full bg-emerald-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Share section */}
                      <div className="rounded-lg bg-white/10 border border-white/15 p-4 space-y-3">
                        <p className="text-sm text-center font-semibold text-white">
                          🚀 Help {result.cityInfo?.city} go live faster—share with neighbors!
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleCopyLink}
                            className="flex-1 h-10 rounded-lg border-white/30 bg-white/10 text-white text-xs hover:bg-white/20"
                          >
                            {copied ? (
                              <>
                                <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-400" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Link2 className="h-4 w-4 mr-1.5" />
                                Copy link
                              </>
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleShareTwitter}
                            className="h-10 w-10 rounded-lg border-white/30 bg-white/10 text-white p-0 hover:bg-white/20"
                            title="Share on X/Twitter"
                          >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                          </Button>
                        </div>
                      </div>

                      {/* Scooper CTA */}
                      <div className="text-center pt-2">
                        <p className="text-xs text-white/70 mb-2">Want to earn while we grow?</p>
                        <Button asChild variant="outline" className="h-10 rounded-xl border-brand-mint/50 text-brand-mint hover:bg-brand-mint/10">
                          <Link href="/scooper">
                            <Users className="mr-2 h-4 w-4" />
                            Become a scooper — $20-30/hr*
                          </Link>
                        </Button>
                        <p className="text-[10px] text-white/50 mt-1">*Pay per yard completed</p>
                      </div>
                    </motion.div>
                  ) : showWaitlistForm ? (
                    <form onSubmit={handleWaitlistSubmit} className="mt-4 space-y-3">
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="h-11 rounded-xl border-white/30 bg-white/20 text-white placeholder:text-white/70 focus-visible:ring-brand-gold/50"
                      />
                      <Input
                        type="tel"
                        placeholder="Phone (optional, for SMS launch alert)"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="h-11 rounded-xl border-white/30 bg-white/20 text-white placeholder:text-white/70 focus-visible:ring-brand-gold/50"
                      />
                      {waitlistError && (
                        <p className="text-sm text-red-300 bg-red-900/40 px-3 py-2 rounded-lg">{waitlistError}</p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          type="submit"
                          className="flex-1 h-11 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold shadow-lg shadow-amber-500/40 border border-amber-500"
                        >
                          <Sparkles className="mr-2 h-4 w-4" />
                          Join waitlist
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowWaitlistForm(false)}
                          className="h-11 rounded-xl border-white/50 bg-white/20 text-white font-semibold hover:bg-white/30"
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="mt-4 space-y-4">
                      <div className="rounded-lg bg-white/15 border border-white/25 p-3">
                        <p className="text-sm text-white text-center font-medium">
                          🎯 Your signup matters! We prioritize activating cities with the most interest.
                        </p>
                      </div>
                      <Button
                        onClick={() => setShowWaitlistForm(true)}
                        className="w-full h-12 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-base shadow-lg shadow-amber-500/40 border border-amber-500"
                      >
                        <Sparkles className="mr-2 h-5 w-5" />
                        Join the waitlist — be first!
                      </Button>
                      <p className="text-xs text-center text-white/70">
                        Your signup directly influences where we expand next.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

