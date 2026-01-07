"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle, Copy, Leaf, Mail, MapPin, Phone, Shield, Sparkles, Twitter, Users, WandSparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import AppStoreButtons from "@/components/wellness/AppStoreButtons";
import { track } from "@/lib/analytics";
import type { ZipEligibilityResult, DensityClassification } from "@/lib/zip-eligibility";
import { buildTileMessaging } from "@/lib/marketplace/tile-readiness";
import type { ServiceTileStatus } from "@prisma/client";
import { useTheme } from "@/components/theme/ThemeProvider";

const ritualMoments = [
  {
    title: "Gate & hazard check",
    copy: "We text when we’re en route, secure the gate, and start a figure-eight sweep while flagging anything unsafe in the yard.",
  },
  {
    title: "Scoop, flag, tidy",
    copy: "Every zone gets a tight figure-eight pattern while we double-bag, capture stool health notes, place bags neatly in your bin or haul them away, tidy paths + patios, and send a photo of the latched gate before we leave.",
  },
  {
    title: "Wellness insight",
    copy: "We log color, consistency, and content. If something looks unusual, we flag it in your recap—images are available on request (never pushed by default).",
  },
];

const testimonial = {
  quote:
    "I’m not the type to analyze my dog’s poop, so when they texted me about blood streaks I wouldn’t have seen, it was a wake up call. We booked the vet that afternoon and caught an ulcer early. That’s the kind of scoop crew I want.",
  author: "Jess & Milo · St. Louis Park",
};

const HERO_BACKGROUNDS = {
  light: {
    desktop: { src: "/hero_backgrounds/aussie_teal_left_light.jpeg", alt: "Australian shepherd enjoying a bright yard" },
    mobile: { src: "/hero_backgrounds/aussie_teal_left_light.jpeg", alt: "Australian shepherd enjoying a bright yard" },
  },
  dark: {
    desktop: { src: "/hero_backgrounds/aussie_teal_left_dark.jpeg", alt: "Australian shepherd in a calm evening yard" },
    mobile: { src: "/hero_backgrounds/aussie_teal_left_dark.jpeg", alt: "Australian shepherd in a calm evening yard" },
  },
} as const;

type CityInfo = {
  city: string;
  state: string;
};

type HeroZipResult = {
  valid: boolean;
  message: string;
  detail?: string;
  estimatedDelivery?: string | null;
  tileSlug?: string | null;
  tileStatus?: ServiceTileStatus | null;
  activationEligible?: boolean | null;
  advisories?: string[];
  cityInfo?: CityInfo | null;
  densityInfo?: DensityClassification | null;
};

const TILE_STATUS_LABELS: Record<ServiceTileStatus, string> = {
  LIVE: "Live",
  WAITLIST: "Waitlist",
  DRAFT: "In planning",
  SUSPENDED: "Temporarily paused",
};

function describeTileStatus(status?: ServiceTileStatus | null) {
  if (!status) return "";
  return TILE_STATUS_LABELS[status] ?? status;
}

export default function Hero() {
  const [zipCode, setZipCode] = useState("");
  const [isCheckingZip, setIsCheckingZip] = useState(false);
  const [zipResult, setZipResult] = useState<HeroZipResult | null>(null);
  const zipInputRef = useRef<HTMLInputElement | null>(null);
  const { theme } = useTheme();
  
  // Waitlist form state
  const [showWaitlistForm, setShowWaitlistForm] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistPhone, setWaitlistPhone] = useState("");
  const [isSubmittingWaitlist, setIsSubmittingWaitlist] = useState(false);
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const heroBackground = useMemo(() => {
    const mode = theme === "dark" ? "dark" : "light";
    return HERO_BACKGROUNDS[mode];
  }, [theme]);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const overlayStyle = useMemo(() => {
    if (theme === "dark") {
      return "linear-gradient(155deg, rgba(8,16,12,0.55) 0%, rgba(10,20,15,0.45) 50%, rgba(12,24,18,0.35) 100%)";
    }
    return "linear-gradient(155deg, rgba(7,11,8,0.24) 0%, rgba(10,16,12,0.22) 50%, rgba(12,18,14,0.2) 100%)";
  }, [theme]);
  const zipDisabled = zipCode.length !== 5 || isCheckingZip;

  const checkZipCode = useCallback(async () => {
    if (!zipCode.trim() || zipCode.length !== 5) {
      setZipResult({ valid: false, message: "Please enter a valid 5-digit ZIP" });
      return;
    }

    setIsCheckingZip(true);
    setZipResult(null);
    setShowWaitlistForm(false);
    setWaitlistSuccess(false);
    setWaitlistError(null);

    try {
      const response = await fetch(`/api/zip-eligibility?zipCode=${zipCode.trim()}`);
      const data: ZipEligibilityResult = await response.json();
      const tile = data.tile ?? null;
      const tileMessaging = buildTileMessaging(data);
      
      // Extract city info
      const cityInfo = data.cityInfo ?? null;
      const densityInfo = data.densityClassification ?? null;

      const result: HeroZipResult = {
        valid: data.eligible,
        message: tileMessaging.headline,
        detail: tileMessaging.detail,
        estimatedDelivery: data.estimatedDelivery ?? null,
        tileSlug: tile?.slug ?? null,
        tileStatus: tile?.status ?? null,
        activationEligible: tile?.activationEligible ?? null,
        advisories: tileMessaging.advisories,
        cityInfo,
        densityInfo,
      };
      
      setZipResult(result);
      
      // Show waitlist form only if not eligible (zone not serviceable)
      // If eligible, show the CTA button to get a quote regardless of tile status
      if (!data.eligible) {
        setShowWaitlistForm(true);
      }
      
      track("zip_check", {
        zipCode,
        eligible: data.eligible,
        city: cityInfo?.city ?? null,
        tileStatus: tile?.status ?? null,
      });
    } catch (error) {
      console.error("ZIP check error", error);
      setZipResult({ valid: false, message: "We couldn't check that ZIP. Try again." });
    } finally {
      setIsCheckingZip(false);
    }
  }, [zipCode]);
  
  // Waitlist submit handler
  const handleWaitlistSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistEmail.trim() || !zipResult?.cityInfo) return;
    
    setIsSubmittingWaitlist(true);
    setWaitlistError(null);
    
    try {
      const cityName = zipResult.cityInfo.city;
      const stateName = zipResult.cityInfo.state;
      const placeId = `zip-${zipCode}-${cityName.toLowerCase().replace(/\s+/g, "-")}-${stateName.toLowerCase()}`;
      
      const response = await fetch("/api/cities/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId,
          city: cityName,
          state: stateName,
          email: waitlistEmail.trim(),
          phone: waitlistPhone.trim() || undefined,
          population: zipResult.densityInfo?.population || undefined,
        }),
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to join waitlist");
      }
      
      const data = await response.json();
      setWaitlistCount(data.waitlistCount || 1);
      setWaitlistSuccess(true);
      setShowWaitlistForm(false);
      
      track("waitlist_signup", {
        source: "hero_zip_check",
        zipCode,
        city: cityName,
        tileSlug: zipResult.tileSlug ?? null,
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Something went wrong";
      setWaitlistError(errorMessage);
    } finally {
      setIsSubmittingWaitlist(false);
    }
  }, [waitlistEmail, waitlistPhone, zipCode, zipResult]);
  
  // Share URL for waitlist success
  const shareUrl = typeof window !== "undefined" && zipResult?.cityInfo
    ? `${window.location.origin}/city?search=${encodeURIComponent(zipResult.cityInfo.city)}`
    : "";
    
  const handleCopyLink = useCallback(() => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareUrl]);

  const zipCTA = useMemo(() => {
    // Show CTA if eligible (based on zone check) - allow quotes even for WAITLIST tiles
    // The tile status is informational but shouldn't block customers from getting quotes
    if (!zipResult || !zipResult.valid) return null;
    return `/quote?zipCode=${zipCode}&skipZipCheck=true&resume=0`;
  }, [zipResult, zipCode]);

  const handleHowItWorksClick = useCallback(() => {
    track("cta_hero_how_it_works");
    const section = document.getElementById("how-it-works");
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const backgroundBase = theme === "dark" ? "#050b08" : "#f8f5ee";
  const separatorColor = backgroundBase;

  return (
    <section
      id="hero"
      className="relative overflow-hidden text-white"
      style={{ backgroundColor: backgroundBase }}
    >
      <div className="absolute inset-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={(isMobile ? heroBackground.mobile.src : heroBackground.desktop.src) || "hero-bg"}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
          >
            <Image
              src={isMobile ? heroBackground.mobile.src : heroBackground.desktop.src}
              alt={isMobile ? heroBackground.mobile.alt : heroBackground.desktop.alt}
              fill
              priority
              className="object-cover"
              style={{ objectPosition: "40% center" }}
              sizes="100vw"
            />
            <div
              className="absolute inset-0"
              style={{ background: overlayStyle }}
            />
          </motion.div>
        </AnimatePresence>
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 -bottom-12 z-0 h-16"
        style={{
          background: `linear-gradient(to bottom, transparent, ${separatorColor})`,
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-[84vh] max-w-5xl flex-col items-center justify-center gap-7 px-6 pb-16 pt-24 text-center text-white drop-shadow-[0_20px_45px_rgba(0,0,0,0.65)] lg:pt-36">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/85 backdrop-blur">
          <Sparkles className="h-4 w-4 text-[#f3a433]" />
          Clean yard • Wellness insights included
        </div>

        <h1 className="max-w-4xl font-serif text-[clamp(3.1rem,6.2vw,6.1rem)] leading-[0.95] text-balance">
          Poop pickup, handled.
        </h1>

        <p className="max-w-3xl text-lg leading-relaxed text-white/88">
          Clean yard + pet wellness insights—recaps after every visit so you can spot changes early without inspecting.
        </p>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button
            asChild
            className="h-12 rounded-full bg-[#f3a433] px-8 text-base font-semibold text-black shadow-[0_20px_45px_rgba(243,164,51,0.45)] hover:bg-[#f5b249]"
          >
            <Link href="/quote" onClick={() => track("cta_hero_get_quote")}>
              Get my quote <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant="outline"
            className="h-12 rounded-full border-white/55 bg-white/90 px-6 text-base font-semibold text-[#1c1209] shadow-[0_12px_30px_rgba(0,0,0,0.2)] hover:bg-white dark:border-white dark:bg-transparent dark:text-white dark:hover:bg-white/15"
            type="button"
            onClick={handleHowItWorksClick}
          >
            How it works
          </Button>
        </div>

        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
            Prefer to start with the free app?
          </p>
          <AppStoreButtons compact className="items-center justify-center" />
          <Link
            href="/wellness"
            className="text-xs font-semibold uppercase tracking-[0.32em] text-white/75 hover:text-white"
          >
            See wellness app features
          </Link>
        </div>

        <div className="mt-1 flex flex-wrap items-center justify-center gap-6 text-xs font-semibold text-white/80">
          <div className="inline-flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Gate secured + photo proof
          </div>
          <div className="inline-flex items-center gap-2">
            <WandSparkles className="h-4 w-4" />
            Tidy sweep, every zone
          </div>
          <div className="inline-flex items-center gap-2">
            <Leaf className="h-4 w-4" />
            Deodorize / haul‑away / compost add‑ons
          </div>
        </div>

      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6 pb-16">
        <div className="rounded-[40px] border border-white/15 bg-black/35 p-8 shadow-[0_50px_110px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.1fr)_380px]">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.4em] text-white/70">What you get each visit</p>
              <h2 className="mt-2 font-serif text-[clamp(2rem,3.5vw,3.1rem)] leading-tight text-white">
                Clean yard. Gate photo. Recap link.
              </h2>
              <div className="mt-6 grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/80">
                    Arrival text + gate secured
                  </p>
                  <p className="text-sm leading-relaxed text-white/75">
                    We text on the way, secure the gate, and do a consistent sweep.
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/80">
                    Full-yard sweep + tidy finish
                  </p>
                  <p className="text-sm leading-relaxed text-white/75">
                    Double-bagged cleanup, hazards flagged, and a latched-gate photo before we leave.
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/80">
                    Pet wellness insights
                  </p>
                  <p className="text-sm leading-relaxed text-white/75">
                    Color • Consistency • Content notes delivered in your recap link.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6 min-w-0">
              <div className="relative overflow-hidden rounded-[28px] border border-white/15 bg-black/40 shadow-[0_28px_60px_rgba(0,0,0,0.35)]">
                <Image
                  src="/employee/truck_wrapped_scooper.png"
                  alt="InsightScoop scooper truck"
                  width={640}
                  height={420}
                  className="h-44 w-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                <div className="absolute bottom-4 left-4 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/85">
                  Local scoopers, routed daily
                </div>
              </div>
              <div
                id="zip-check"
                className="rounded-[28px] border border-white/15 bg-black/40 p-6 shadow-[0_30px_70px_rgba(0,0,0,0.35)]"
              >
                <p className="text-xs uppercase tracking-[0.4em] text-white/70">Check your ZIP</p>
                <p className="mt-2 text-base text-white/85">
                  Enter your ZIP to see availability and get a fast quote.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-white/15 bg-black/30 px-3 py-2 sm:flex-nowrap">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    placeholder="Enter ZIP"
                    value={zipCode}
                    ref={zipInputRef}
                    onChange={(event) => {
                      const value = event.target.value.replace(/\D/g, "");
                      setZipCode(value);
                      if (zipResult) setZipResult(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") checkZipCode();
                    }}
                    className="flex-1 min-w-[120px] bg-transparent text-base font-semibold text-white outline-none placeholder:text-white/55"
                  />
                  <Button
                    onClick={checkZipCode}
                    disabled={zipDisabled}
                    className="min-w-[110px] rounded-xl bg-white px-5 text-[#1c1209] hover:bg-white/90 disabled:cursor-not-allowed w-full sm:w-auto"
                  >
                    {isCheckingZip ? "Checking…" : "Check"}
                  </Button>
                </div>
                {/* Result Display */}
                <AnimatePresence mode="wait">
                  {zipResult && !waitlistSuccess && (
                    <motion.div
                      key="result"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={`mt-4 rounded-2xl border px-4 py-3 ${
                        zipResult.valid
                          ? "border-emerald-400/30 bg-emerald-500/20"
                          : "border-amber-400/30 bg-amber-500/20"
                      }`}
                    >
                      {/* City & Zone Info */}
                      {zipResult.cityInfo && (
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-sm font-semibold text-white">
                            <MapPin className="h-3.5 w-3.5" />
                            {zipResult.cityInfo.city}, {zipResult.cityInfo.state}
                          </span>
                          {zipResult.densityInfo?.zoneName && (
                            <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/80">
                              {zipResult.densityInfo.zoneName}
                              {zipResult.densityInfo.populationDensity && (
                                <span className="ml-1 text-white/60">
                                  • {zipResult.densityInfo.populationDensity.toLocaleString()}/sq mi
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      )}
                      
                      {/* Status Message */}
                      <div className="flex items-center gap-2">
                        {zipResult.valid ? (
                          <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <Users className="h-5 w-5 text-amber-400 flex-shrink-0" />
                        )}
                        <p className="text-sm font-semibold text-white">{zipResult.message}</p>
                      </div>
                      
                      {zipResult.detail && (
                        <p className="mt-1 text-xs text-white/70">{zipResult.detail}</p>
                      )}
                      
                      {/* CTA for eligible ZIP */}
                      {zipCTA && (
                        <div className="mt-3">
                          <Button asChild className="rounded-full bg-[#f3a433] text-black hover:bg-[#f5b249]">
                            <Link href={zipCTA}>
                              Get my quote <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      )}
                    </motion.div>
                  )}
                  
                  {/* Waitlist Form */}
                  {showWaitlistForm && zipResult && !zipResult.valid && !waitlistSuccess && (
                    <motion.form
                      key="waitlist-form"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      onSubmit={handleWaitlistSubmit}
                      className="mt-4 space-y-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4"
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <Mail className="h-4 w-4 text-amber-400" />
                        Join the waitlist — be first to know!
                      </div>
                      <p className="text-xs text-white/70">
                        Your signup helps us prioritize launching in {zipResult.cityInfo?.city || "your area"}.
                      </p>
                      
                      <div className="space-y-2">
                        <input
                          type="email"
                          required
                          placeholder="Your email"
                          value={waitlistEmail}
                          onChange={(e) => setWaitlistEmail(e.target.value)}
                          className="w-full rounded-xl border border-white/20 bg-black/30 px-4 py-2.5 text-sm text-white placeholder:text-white/50 focus:border-amber-400/50 focus:outline-none"
                        />
                        <input
                          type="tel"
                          placeholder="Phone (optional, for SMS updates)"
                          value={waitlistPhone}
                          onChange={(e) => setWaitlistPhone(e.target.value)}
                          className="w-full rounded-xl border border-white/20 bg-black/30 px-4 py-2.5 text-sm text-white placeholder:text-white/50 focus:border-amber-400/50 focus:outline-none"
                        />
                      </div>
                      
                      {waitlistError && (
                        <p className="text-xs text-red-400">{waitlistError}</p>
                      )}
                      
                      <Button
                        type="submit"
                        disabled={isSubmittingWaitlist || !waitlistEmail.trim()}
                        className="w-full rounded-xl bg-amber-400 text-slate-900 font-semibold hover:bg-amber-300 disabled:opacity-50"
                      >
                        {isSubmittingWaitlist ? "Joining..." : "Join the waitlist"}
                      </Button>
                    </motion.form>
                  )}
                  
                  {/* Waitlist Success */}
                  {waitlistSuccess && zipResult && (
                    <motion.div
                      key="waitlist-success"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/20 p-4 text-center"
                    >
                      <CheckCircle className="mx-auto h-8 w-8 text-emerald-400 mb-2" />
                      <p className="text-sm font-semibold text-white">You&apos;re on the list!</p>
                      <p className="mt-1 text-xs text-white/70">
                        {waitlistCount} {waitlistCount === 1 ? "person has" : "people have"} signed up for {zipResult.cityInfo?.city || "this area"}.
                      </p>
                      
                      {/* Share buttons */}
                      <div className="mt-3 flex flex-wrap justify-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleCopyLink}
                          className="rounded-full border-white/20 bg-white/10 text-white text-xs hover:bg-white/20"
                        >
                          {copied ? <CheckCircle className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                          {copied ? "Copied!" : "Copy link"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          asChild
                          className="rounded-full border-white/20 bg-white/10 text-white text-xs hover:bg-white/20"
                        >
                          <a
                            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`I just signed up for @InsightScoop in ${zipResult.cityInfo?.city || "my city"}! Help us launch by joining the waitlist:`)}&url=${encodeURIComponent(shareUrl)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Twitter className="h-3.5 w-3.5 mr-1" />
                            Share
                          </a>
                        </Button>
                      </div>
                      
                      {/* Scooper CTA */}
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <p className="text-xs text-white/60 mb-2">Want to help launch faster?</p>
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="rounded-full border-brand-coral/40 text-brand-coral hover:bg-brand-coral/10"
                        >
                          <Link href="/scooper">
                            Become a scooper — earn $20-30/hr*
                          </Link>
                        </Button>
                        <p className="mt-1 text-[10px] text-white/40">*Based on avg. yards/hour</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-[28px] border border-white/15 bg-black/35 p-7 shadow-[0_30px_60px_rgba(0,0,0,0.3)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <p className="text-lg font-serif leading-relaxed text-white md:text-xl">
                “{testimonial.quote}”
              </p>
              <p className="text-xs uppercase tracking-[0.35em] text-white/70 md:text-right">
                {testimonial.author}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
