"use client";

import React, { useState, useEffect } from "react";
import { motion } from "@/lib/framermotion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { MapPin, ArrowRight, Loader2, CheckCircle, AlertCircle, Mail, Sparkles, Link2 } from "lucide-react";
import Image from "next/image";

import { StepProps } from "@/types/quote";
import { track } from "@/lib/analytics";
import type { ZipEligibilityResult } from "@/lib/zip-eligibility";
import {
  withQuotePanel,
  quoteSubtleTextClass,
  quoteSurfaceClass,
  quoteMutedBadgeClass,
  quoteFieldLabelClass,
  quoteInputClass,
  quoteHeadingClass,
} from "../quoteStyles";

// Launch threshold for waitlist
const LAUNCH_THRESHOLD = 15;

interface DensityInfo {
  zoneType: "urban-core" | "suburban" | "rural";
  zoneName: string;
  baseMultiplier: number;
  populationDensity?: number;
  population?: number;
  areaSqMiles?: number;
  source: "density" | "static" | "fallback";
}

interface CityInfo {
  city: string;
  state: string;
}

interface ValidationResult {
  valid: boolean;
  message: string;
  detail?: string;
  zoneName?: string | null;
  estimatedDelivery?: string | null;
  tileSlug?: string | null;
  tileStatus?: string | null;
  tileActivationEligible?: boolean | null;
  tileAdvisories?: string[];
  densityInfo?: DensityInfo | null;
  cityInfo?: CityInfo | null;
}

const TILE_STATUS_CONFIG: Record<string, { label: string; colorClass: string; show: boolean }> = {
  DRAFT: { label: "Draft", colorClass: "", show: false }, // Don't show draft - treat as unavailable
  WAITLIST: { 
    label: "Waitlist", 
    colorClass: "border-brand-gold/60 bg-brand-gold/15 text-brand-gold dark:border-brand-gold/50 dark:bg-brand-gold/20 dark:text-brand-gold",
    show: true 
  },
  LIVE: { 
    label: "Live", 
    colorClass: "border-emerald-500/60 bg-emerald-500/15 text-emerald-700 dark:border-emerald-400/50 dark:bg-emerald-500/20 dark:text-emerald-400",
    show: true 
  },
  SUSPENDED: { 
    label: "Paused", 
    colorClass: "border-rose-400/60 bg-rose-400/15 text-rose-700 dark:border-rose-400/50 dark:bg-rose-500/20 dark:text-rose-400",
    show: true 
  },
};

function getTileStatusConfig(status?: string | null) {
  if (!status) return null;
  return TILE_STATUS_CONFIG[status] ?? null;
}

function shouldShowTileAsAvailable(status?: string | null): boolean {
  if (!status) return false;
  const config = TILE_STATUS_CONFIG[status];
  return config?.show ?? false;
}

// Compact waitlist form for ZIP check step
function ZipWaitlistForm({ 
  zipCode,
  tileSlug,
  cityInfo,
  onSuccess 
}: { 
  zipCode: string;
  tileSlug?: string | null;
  cityInfo?: CityInfo | null;
  onSuccess?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [waitlistCount, setWaitlistCount] = useState(0);

  // Derive city name from cityInfo or tile slug
  const cityName = cityInfo?.city 
    ?? (tileSlug 
        ? tileSlug.replace(/-\d+$/, "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
        : `ZIP ${zipCode}`);
  const state = cityInfo?.state ?? "MN"; // Default to MN for now

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
          placeId: cityInfo ? `city-${cityInfo.city.toLowerCase().replace(/\s+/g, "-")}-${cityInfo.state.toLowerCase()}` : `zip-${zipCode}`,
          cityName,
          state,
          source: "quote_zip_check",
          // Only include population if we have it (omit undefined/null)
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to join waitlist");
      }

      setWaitlistCount(data.waitlistCount || 1);
      setSuccess(true);
      onSuccess?.();
      
      track("waitlist_signup", {
        source: "quote_zip_check",
        zipCode,
        tileSlug: tileSlug ?? null,
      });
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== "undefined" 
    ? `${window.location.origin}/city?search=${encodeURIComponent(cityName)}`
    : "";
  
  const shareText = `I just joined the InsightScoop waitlist for ${cityName}! Help bring clean yards + pet wellness insights to our neighborhood 🐕`;

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

  if (success) {
    const progress = Math.min((waitlistCount / LAUNCH_THRESHOLD) * 100, 100);
    const remaining = Math.max(LAUNCH_THRESHOLD - waitlistCount, 0);
    const isReady = remaining === 0;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/40 dark:to-emerald-950/60 border border-emerald-300 dark:border-emerald-500/40 p-4 space-y-3"
      >
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
          <p className="font-semibold text-emerald-700 dark:text-emerald-300">
            You&apos;re on the waitlist!
          </p>
        </div>
        
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] font-medium text-slate-700 dark:text-slate-200">
            <span>Launch progress</span>
            <span className="font-bold">{waitlistCount} / {LAUNCH_THRESHOLD}</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-600/60 overflow-hidden ring-1 ring-inset ring-black/5 dark:ring-white/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6 }}
              className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400"
            />
          </div>
          <p className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
            {remaining > 0 
              ? `${remaining} more signups to help launch ${cityName}!`
              : `🎉 Launch threshold reached for ${cityName}!`}
          </p>
        </div>

        {/* Share section */}
        {!isReady && (
          <div className="border-t border-emerald-300/60 dark:border-emerald-500/30 pt-3 space-y-2">
            <p className="text-[11px] text-center font-semibold text-slate-800 dark:text-white">
              🚀 Help {cityName} go live faster—share with neighbors!
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="flex-1 h-8 rounded-lg border-slate-300 dark:border-white/25 bg-white/60 dark:bg-white/10 text-slate-700 dark:text-white text-xs hover:bg-white dark:hover:bg-white/20"
              >
                {copied ? (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1.5 text-emerald-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Link2 className="h-3 w-3 mr-1.5" />
                    Copy link
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleShareTwitter}
                className="h-8 w-8 rounded-lg border-slate-300 dark:border-white/25 bg-white/60 dark:bg-white/10 text-slate-700 dark:text-white p-0 hover:bg-white dark:hover:bg-white/20"
                title="Share on X/Twitter"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-gradient-to-br from-brand-gold/10 to-brand-coral/5 dark:from-brand-gold/15 dark:to-brand-coral/10 border border-brand-gold/30 dark:border-brand-gold/40 p-4 space-y-3"
    >
      <div className="flex items-start gap-2">
        <Mail className="h-5 w-5 mt-0.5 text-brand-gold dark:text-brand-gold" />
        <div>
          <p className="font-semibold text-slate-800 dark:text-white text-sm">
            Join the waitlist
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
            Be first to know when we launch in your area. Your signup helps us prioritize expansion.
          </p>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10 flex-1 rounded-xl border-amber-400/50 dark:border-amber-400/40 bg-white/90 dark:bg-white/15 text-sm text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-white/60 focus-visible:ring-amber-400/50"
          required
        />
        <Button
          type="submit"
          disabled={isSubmitting || !email.trim()}
          className="h-10 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold px-4 border border-amber-500 shadow-md disabled:opacity-50"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Join"
          )}
        </Button>
      </form>
      
      {error && (
        <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
      )}
    </motion.div>
  );
}

export const StepZipCheck: React.FC<StepProps> = ({
  quoteData,
  updateQuoteData,
  onNext,
  orgId,
}) => {
  const [zipCode, setZipCode] = useState(quoteData.zipCode || "");
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null);

  // Check if zip is already validated (e.g., from landing page)
  useEffect(() => {
    if (
      !validationResult &&
      quoteData.zipCode &&
      quoteData.zipValidated
    ) {
      setZipCode(quoteData.zipCode);
      setValidationResult({
        valid: true,
        message: "Service available",
        detail: "ZIP code verified! You can continue to the next step.",
        tileSlug: quoteData.tileSlug ?? null,
        tileStatus: quoteData.tileStatus ?? null,
        tileActivationEligible:
          typeof quoteData.tileActivationEligible === "boolean"
            ? quoteData.tileActivationEligible
            : null,
      });
    }
  }, [
    quoteData.zipCode,
    quoteData.zipValidated,
    quoteData.tileSlug,
    quoteData.tileStatus,
    quoteData.tileActivationEligible,
    validationResult,
  ]);

  const validateZipCode = async () => {
    if (!zipCode.trim()) {
      setValidationResult({ valid: false, message: "Please enter a ZIP code." });
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    try {
      const params = new URLSearchParams({ zipCode: zipCode.trim() });
      if (orgId) {
        params.append("orgId", orgId);
      }

      const response = await fetch(`/api/zip-eligibility?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to validate ZIP code");
      }

      const payload: ZipEligibilityResult = await response.json();
      const isEligible = payload.eligible === true;
      const tileInfo = payload.tile ?? null;

      const statusCopy = isEligible
        ? {
            message: "Service available",
            detail:
              payload.estimatedDelivery ||
              "We’re currently serving your area and can get you scheduled right away.",
          }
        : {
            message: "Service unavailable",
            detail:
              payload.message ||
              "We’re not serving this ZIP yet, but we’re expanding soon. Share your info and we’ll keep you updated.",
          };

      // Use density classification name if available, otherwise fall back to zone name
      const displayZoneName = payload.densityClassification?.zoneName || payload.zone?.name || null;

      setValidationResult({
        valid: isEligible,
        message: statusCopy.message,
        detail: statusCopy.detail,
        zoneName: displayZoneName,
        estimatedDelivery: payload.estimatedDelivery || null,
        tileSlug: tileInfo?.slug ?? null,
        tileStatus: tileInfo?.status ?? null,
        tileActivationEligible: tileInfo?.activationEligible ?? null,
        tileAdvisories: tileInfo?.advisoryReasons ?? [],
        densityInfo: payload.densityClassification ?? null,
        cityInfo: payload.cityInfo ?? null,
      });

      updateQuoteData({
        zipCode: zipCode.trim(),
        zipValidated: isEligible,
        tileSlug: tileInfo?.slug ?? undefined,
        tileStatus: tileInfo?.status ?? undefined,
        tileActivationEligible: tileInfo?.activationEligible ?? undefined,
      });

      track("zip_check", {
        zip: zipCode.trim(),
        inArea: isEligible,
        location: payload.zone?.name || "Outside Service Area",
        zone: payload.zone?.zoneId || null,
        estimatedDelivery: payload.estimatedDelivery || null,
        tileSlug: tileInfo?.slug ?? null,
        tileStatus: tileInfo?.status ?? null,
        tileActivationEligible: tileInfo?.activationEligible ?? null,
      });
    } catch (error) {
      console.error("ZIP validation error:", error);
      setValidationResult({
        valid: false,
        message: "Unable to validate ZIP code. Please try again.",
      });
      updateQuoteData({ zipValidated: false });
    } finally {
      setIsValidating(false);
    }
  };

  const handleContinue = () => {
    if (validationResult?.valid) {
      updateQuoteData({
        zipCode: zipCode.trim(),
        zipValidated: true,
        tileSlug: validationResult.tileSlug ?? undefined,
        tileStatus: validationResult.tileStatus ?? undefined,
        tileActivationEligible:
          validationResult.tileActivationEligible ?? undefined,
      });
      onNext?.();
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-24 md:pb-28">
      <Card className={withQuotePanel("w-full text-brand-ink dark:text-cream-vanilla")}
        >
        <CardHeader className="space-y-2 pb-5">
          <CardTitle className="flex items-center gap-2 font-serif text-base font-normal md:text-lg text-brand-ink dark:text-cream-vanilla">
            <span className="inline-flex size-9 items-center justify-center rounded-2xl bg-brand-coral/10 text-brand-coral dark:bg-brand-coral/20 dark:text-cream-vanilla">
              <MapPin className="size-4" />
            </span>
            Service Area Check
          </CardTitle>
          <p className={cn("text-sm leading-relaxed", quoteSubtleTextClass)}>
            Drop your ZIP  -  we’ll confirm if InsightScoop covers your block and how quickly we can dispatch a crew.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-8 lg:flex-row">
          <div className="flex-1 space-y-6">
            <div className="space-y-3">
              <Label
                htmlFor="zipCode"
                className={cn(
                  "text-xs font-semibold uppercase tracking-[0.18em]",
                  quoteFieldLabelClass,
                  "md:text-sm md:tracking-[0.32em]",
                )}
              >
                ZIP Code
              </Label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  id="zipCode"
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  value={zipCode}
                  onChange={(event) => {
                    const sanitized = event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 5);
                    setZipCode(sanitized);
                    updateQuoteData({
                      zipValidated: false,
                      tileSlug: undefined,
                      tileStatus: undefined,
                      tileActivationEligible: undefined,
                    });
                  }}
                  placeholder="55401"
                  className={cn("flex-1 text-base", quoteInputClass)}
                />
                <Button
                  onClick={validateZipCode}
                  disabled={!zipCode.trim() || isValidating}
                  className="rounded-2xl bg-brand-coral px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(243,100,91,0.35)] transition hover:bg-brand-coral-ink hover:shadow-[0_18px_36px_rgba(243,100,91,0.3)] disabled:bg-brand-coral/50 disabled:shadow-none md:rounded-full dark:bg-brand-coral/20 dark:text-cream-vanilla dark:hover:bg-brand-coral/30"
                >
                  {isValidating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Check"
                  )}
                </Button>
              </div>
              <p className={cn("text-xs", quoteSubtleTextClass)}>
                We respect your privacy - ZIP codes are used to check local coverage only.
              </p>
            </div>

            {validationResult ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  quoteSurfaceClass,
                  "space-y-3 border px-5 py-4",
                  validationResult.valid
                    ? "border-emerald-500/40 bg-emerald-50/80 text-brand-ink dark:border-emerald-500/50 dark:bg-emerald-950/50 dark:text-cream-vanilla"
                    : "border-amber-400/45 bg-amber-50/80 text-brand-ink dark:border-amber-400/55 dark:bg-[#2b1605] dark:text-amber-100",
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "inline-flex h-7 w-7 flex-none items-center justify-center rounded-full",
                      validationResult.valid
                        ? "bg-emerald-500 text-white"
                        : "bg-amber-400/70 text-amber-950",
                    )}
                  >
                    {validationResult.valid ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                  </span>
                  <div className="space-y-1">
                    <p className={cn(
                      "font-serif text-sm font-semibold md:text-base",
                      validationResult.valid ? "text-emerald-700 dark:text-emerald-400" : ""
                    )}>
                      {validationResult.message}
                    </p>
                    {validationResult.detail ? (
                      <p className={cn("text-sm leading-relaxed", quoteSubtleTextClass)}>
                        {validationResult.detail}
                      </p>
                    ) : null}
                    {(validationResult.cityInfo || validationResult.zoneName) ? (
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {/* City name - prominent styling */}
                        {validationResult.cityInfo ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-coral/40 bg-brand-coral/10 px-3 py-1 text-xs font-semibold text-brand-coral dark:border-brand-coral/50 dark:bg-brand-coral/20 dark:text-brand-coral">
                            <MapPin className="h-3 w-3" />
                            {validationResult.cityInfo.city}, {validationResult.cityInfo.state}
                          </span>
                        ) : null}
                        {/* Zone type - subtle chip */}
                        {validationResult.zoneName ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-300/60 bg-slate-100/80 px-2.5 py-1 text-[0.65rem] font-medium text-slate-600 dark:border-white/20 dark:bg-white/10 dark:text-slate-300">
                            {validationResult.zoneName}
                          </span>
                        ) : null}
                        {/* Population density - smallest chip */}
                        {validationResult.densityInfo?.populationDensity ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200/60 bg-slate-50/80 px-2 py-0.5 text-[0.6rem] text-slate-500 dark:border-white/15 dark:bg-white/5 dark:text-slate-400">
                            {validationResult.densityInfo.populationDensity.toLocaleString()}/sq mi
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    {/* Only show tile info if status is not DRAFT */}
                    {validationResult.tileStatus && shouldShowTileAsAvailable(validationResult.tileStatus) ? (
                      <div className="mt-3 space-y-1 rounded-xl border border-slate-200/60 bg-white/60 p-3 text-xs text-brand-ink dark:border-white/10 dark:bg-white/5 dark:text-cream-vanilla">
                        <div className="flex items-center gap-2">
                          <span className="font-serif font-semibold uppercase tracking-widest text-[0.6rem] md:text-xs whitespace-nowrap text-brand-muted dark:text-cream-vanilla/70">
                            Coverage Tile
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            {validationResult.tileSlug ? (
                              <span className="rounded-full border border-slate-300/60 bg-white/80 px-2 py-0.5 text-[0.65rem] font-medium text-brand-ink dark:border-white/20 dark:bg-white/10 dark:text-cream-vanilla whitespace-nowrap">
                                {validationResult.tileSlug}
                              </span>
                            ) : null}
                            {(() => {
                              const statusConfig = getTileStatusConfig(validationResult.tileStatus);
                              if (!statusConfig) return null;
                              return (
                                <span className={cn(
                                  "rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold whitespace-nowrap",
                                  statusConfig.colorClass
                                )}>
                                  {statusConfig.label}
                                </span>
                              );
                            })()}
                          </span>
                        </div>
                        {validationResult.tileActivationEligible === false ? (
                          <p className="text-[0.7rem] md:text-xs text-brand-muted dark:text-cream-vanilla/70">
                            {!!validationResult.tileAdvisories?.length
                              ? validationResult.tileAdvisories[0]
                              : "We're still building scooper density here — claim your spot so we can activate sooner."}
                          </p>
                        ) : validationResult.tileActivationEligible ? (
                          <p className="text-[0.7rem] md:text-xs text-emerald-600 dark:text-emerald-400">
                            This tile has enough certified scoopers for live coverage.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
                
                {/* Waitlist signup form for ineligible ZIPs */}
                {!validationResult.valid && (
                  <div className="mt-4 pt-4 border-t border-amber-300/40 dark:border-amber-500/30">
                    <ZipWaitlistForm 
                      zipCode={zipCode} 
                      tileSlug={validationResult.tileSlug}
                      cityInfo={validationResult.cityInfo}
                    />
                  </div>
                )}
              </motion.div>
            ) : null}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className={cn("text-xs", quoteSubtleTextClass)}>
                Continue to customize your service once coverage is confirmed.
              </p>
              <Button
                variant={validationResult?.valid ? "default" : "outline"}
                disabled={!validationResult?.valid}
                onClick={handleContinue}
                className={cn(
                  "group inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-2 text-sm font-semibold transition md:rounded-full",
                  validationResult?.valid
                    ? "bg-brand-coral text-white hover:bg-brand-coral-ink dark:bg-brand-coral/20 dark:text-cream-vanilla dark:hover:bg-brand-coral/30"
                    : "border border-brand-coral/35 text-brand-ink hover:border-emerald-400/60 dark:border-brand-coral/40 dark:text-cream-vanilla",
                )}
              >
                Continue
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>
          </div>

          <div className="relative hidden w-full max-w-xs overflow-hidden rounded-3xl border border-brand-coral/20 bg-brand-coral/8 shadow-[0_28px_60px_rgba(4,17,12,0.2)] dark:border-brand-coral/35 dark:bg-evergreen-900/80 dark:shadow-[0_28px_60px_rgba(0,0,0,0.55)] lg:flex">
            <Image
              src="/dog_images/pexels-katlovessteve-551628.jpg"
              alt="Dog waiting by the front gate"
              fill
              className="object-cover"
              sizes="(min-width: 1024px) 320px"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#04110c]/80 via-transparent" />
            <div className="absolute bottom-4 left-4 right-4 rounded-2xl bg-white/90 p-3 font-serif text-xs font-medium text-brand-ink shadow-xl dark:bg-evergreen-800/85 dark:text-cream-vanilla">
              Metro routes fill fast — lock in your spot so the crew can plan today's route.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
