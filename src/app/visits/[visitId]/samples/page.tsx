"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import {
  Eye,
  EyeOff,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  CheckCircle2,
  Heart,
  Shield,
  Dog,
  Share2,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { brandColors, brandGradients, withAlpha } from "@/shared/brand";

type SampleMedia = {
  id: string;
  url: string;
  capturedAt: string;
  analysisResult: {
    color?: string;
    consistency?: string;
    content?: string;
    observations?: string;
    wellness_flag?: boolean;
    flag_reason?: string;
  } | null;
  analysisConfidence: number | null;
  isFlagged: boolean;
  stoolSampleId: string | null;
  stoolSampleView: "SURFACE" | "CROSS_SECTION" | null;
  sampleIndex: number;
};

type VisitSummary = {
  color: string | null;
  consistency: string | null;
  content: string | null;
  observations: string | null;
  wellnessFlag: boolean;
  flagReason: string | null;
};

type VisitStats = {
  total: number;
  totalImages: number;
  flagged: number;
  healthy: number;
};

type GatePhoto = {
  url: string;
  capturedAt: string;
};

type VisitSamples = {
  visitId: string;
  customerName: string;
  servicedAt: string;
  samples: SampleMedia[];
  gatePhoto?: GatePhoto | null;
  summary: VisitSummary | null;
  imagesHidden?: boolean;
  stats: VisitStats;
};

// Single image with blur controls
function SampleImage({
  sample,
  isBlurred,
  onToggleBlur,
}: {
  sample: SampleMedia;
  isBlurred: boolean;
  onToggleBlur: () => void;
}) {
  const viewLabel = sample.stoolSampleView === "SURFACE" 
    ? "Surface" 
    : sample.stoolSampleView === "CROSS_SECTION" 
      ? "Cross-Section" 
      : null;

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm dark:border-slate-700/60 dark:bg-slate-900">
      {viewLabel && (
        <div className="absolute left-2 top-2 z-10 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
          {viewLabel}
        </div>
      )}
      {sample.url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={sample.url}
            alt={`Sample ${sample.sampleIndex}`}
            className={`h-full w-full object-cover transition-all duration-300 ${
              isBlurred ? "scale-110 blur-xl" : "scale-100 blur-none"
            }`}
          />
          <button
            onClick={onToggleBlur}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/25 transition-colors hover:bg-black/35"
            aria-label={isBlurred ? "Show image" : "Hide image"}
          >
            {isBlurred ? (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg">
                  <Eye className="h-6 w-6 text-slate-700" />
                </div>
                <span className="rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
                  Tap to reveal
                </span>
              </>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50">
                <EyeOff className="h-5 w-5 text-white/80" />
              </div>
            )}
          </button>
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
          Image unavailable
        </div>
      )}
    </div>
  );
}

// Sample group card - handles 1 or 2 images (surface + cross-section)
function SampleGroupCard({
  samples,
  groupIndex,
  isFlagged,
  defaultExpanded,
  showImages,
}: {
  samples: SampleMedia[];
  groupIndex: number;
  isFlagged: boolean;
  defaultExpanded: boolean;
  showImages: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [blurredImages, setBlurredImages] = useState<Set<string>>(new Set(samples.map(s => s.id)));
  
  // Use the first sample's analysis result for the main display (usually surface view)
  const primarySample = samples[0];
  const result = primarySample?.analysisResult;
  const isPaired = samples.length === 2;

  useEffect(() => {
    if (!showImages) {
      setBlurredImages(new Set(samples.map((sample) => sample.id)));
    }
  }, [showImages, samples]);

  const toggleBlur = (sampleId: string) => {
    setBlurredImages(prev => {
      const next = new Set(prev);
      if (next.has(sampleId)) {
        next.delete(sampleId);
      } else {
        next.add(sampleId);
      }
      return next;
    });
  };

  const toggleAllBlur = () => {
    const allBlurred = samples.every(s => blurredImages.has(s.id));
    if (allBlurred) {
      setBlurredImages(new Set());
    } else {
      setBlurredImages(new Set(samples.map(s => s.id)));
    }
  };

  return (
    <div
      className="overflow-hidden rounded-3xl border bg-white/90 shadow-[0_18px_40px_rgba(15,23,42,0.08)] transition-all dark:border-slate-700/60 dark:bg-slate-900/70"
      style={isFlagged ? { borderColor: withAlpha(brandColors.gold, 0.55) } : undefined}
    >
      {/* Header - always visible */}
      <button
        onClick={() => {
          setIsExpanded(!isExpanded);
          if (!isExpanded) {
            // Reset blur when expanding
            setBlurredImages(new Set(samples.map(s => s.id)));
          }
        }}
        className="flex w-full items-center justify-between bg-white/80 px-5 py-4 text-left transition hover:bg-white/95 dark:bg-slate-900/50 dark:hover:bg-slate-900"
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl"
            style={{
              backgroundColor: isFlagged
                ? withAlpha(brandColors.gold, 0.18)
                : withAlpha(brandColors.mint, 0.2),
              color: isFlagged ? brandColors.coral : brandColors.mint,
            }}
          >
            {isFlagged ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <CheckCircle2 className="h-5 w-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900 dark:text-white">
                Sample {groupIndex}
              </span>
              {isFlagged && (
                <Badge className="border-amber-300/70 bg-amber-100/80 text-amber-700 dark:border-amber-700/60 dark:bg-amber-900/40 dark:text-amber-300">
                  Monitor
                </Badge>
              )}
              {isPaired && (
                <Badge variant="secondary" className="text-[10px]">
                  2 views
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {format(new Date(primarySample.capturedAt), "h:mm a")}
              {isPaired && " • Surface + Cross-Section"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {primarySample.analysisConfidence != null && (
            <span className="hidden text-xs text-slate-400 sm:block">
              {(primarySample.analysisConfidence * 100).toFixed(0)}% confidence
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-slate-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-slate-200/60 px-5 pb-5 pt-4 dark:border-slate-700/60">
          {/* 3C Chips */}
          {result && (
            <div className="mb-4 flex flex-wrap gap-2">
              {[
                { label: "Color", value: result.color, tone: brandColors.coral },
                { label: "Consistency", value: result.consistency, tone: brandColors.mint },
                { label: "Content", value: result.content, tone: brandColors.gold },
              ].filter((chip) => chip.value).map((chip) => (
                <span
                  key={chip.label}
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200"
                  style={{
                    borderColor: withAlpha(chip.tone, 0.35),
                    backgroundColor: withAlpha(chip.tone, 0.12),
                  }}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: chip.tone }}
                  />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    {chip.label}
                  </span>
                  <span className="capitalize">{String(chip.value).replace(/-/g, " ")}</span>
                </span>
              ))}
            </div>
          )}

          {/* Observations */}
          {result?.observations && (
            <p className="mb-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {result.observations}
            </p>
          )}

          {/* Wellness flag alert */}
          {isFlagged && result?.flag_reason && (
            <div className="mb-4 rounded-2xl border border-amber-200/70 bg-amber-50/80 p-3 dark:border-amber-700/60 dark:bg-amber-900/30">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    Health Note
                  </p>
                  <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                    {result.flag_reason}
                  </p>
                </div>
              </div>
            </div>
          )}

          {showImages && (
            <>
              {/* Images - side by side if paired */}
              <div className={`grid gap-3 ${isPaired ? "grid-cols-2" : "grid-cols-1"}`}>
                {samples.map((sample) => (
                  <SampleImage
                    key={sample.id}
                    sample={sample}
                    isBlurred={blurredImages.has(sample.id)}
                    onToggleBlur={() => toggleBlur(sample.id)}
                  />
                ))}
              </div>

              {/* Reveal all / blur all button for paired samples */}
              {isPaired && (
                <button
                  onClick={toggleAllBlur}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700/60 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  {samples.every(s => blurredImages.has(s.id)) ? (
                    <>
                      <Eye className="h-4 w-4" /> Reveal all images
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-4 w-4" /> Blur all images
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function VisitSamplesPage() {
  const params = useParams();
  const visitId = params?.visitId as string;
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VisitSamples | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [hasRevealedImages, setHasRevealedImages] = useState(false);

  useEffect(() => {
    if (!visitId) return;

    const fetchSamples = async (reveal = false) => {
      try {
        const url = new URL(`/api/visits/${visitId}/samples`, window.location.origin);
        if (reveal) {
          url.searchParams.set("reveal", "1");
        }
        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error("Failed to load samples");
        }
        const json = await response.json();
        setData(json.data);
        setHasRevealedImages(reveal);
      } catch (err) {
        console.error("Failed to fetch samples:", err);
        setError(err instanceof Error ? err.message : "Failed to load samples");
      } finally {
        setLoading(false);
      }
    };

    void fetchSamples(false);
  }, [visitId]);

  // Group samples by stoolSampleId (surface + cross-section = 1 sample group)
  // MUST be called before any early returns to avoid hooks violation
  const sampleGroups = useMemo(() => {
    if (!data?.samples) return [];
    
    const groups = new Map<string, SampleMedia[]>();
    const ungrouped: SampleMedia[] = [];
    
    data.samples.forEach(sample => {
      if (sample.stoolSampleId) {
        const existing = groups.get(sample.stoolSampleId) || [];
        existing.push(sample);
        groups.set(sample.stoolSampleId, existing);
      } else {
        ungrouped.push(sample);
      }
    });
    
    // Sort each group so SURFACE comes first
    groups.forEach((group) => {
      group.sort((a, b) => {
        if (a.stoolSampleView === "SURFACE") return -1;
        if (b.stoolSampleView === "SURFACE") return 1;
        return 0;
      });
    });
    
    // Convert to array of groups, with ungrouped samples as single-item groups
    const allGroups: { id: string; samples: SampleMedia[]; isFlagged: boolean }[] = [];
    
    let groupIndex = 1;
    groups.forEach((samples, id) => {
      const isFlagged = samples.some(s => s.isFlagged);
      allGroups.push({ id, samples, isFlagged });
      groupIndex++;
    });
    
    ungrouped.forEach((sample, idx) => {
      allGroups.push({ 
        id: `ungrouped-${idx}`, 
        samples: [sample], 
        isFlagged: sample.isFlagged 
      });
    });
    
    return allGroups;
  }, [data?.samples]);

  const handleRevealImages = async () => {
    if (!visitId) return;
    const confirmed = window.confirm(
      "These images may be graphic. View flagged samples now?",
    );
    if (!confirmed) return;
    setRevealing(true);
    try {
      const url = new URL(`/api/visits/${visitId}/samples`, window.location.origin);
      url.searchParams.set("reveal", "1");
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error("Failed to load flagged images");
      }
      const json = await response.json();
      setData(json.data);
      setHasRevealedImages(true);
    } catch (err) {
      console.error("Failed to reveal samples:", err);
      setError(err instanceof Error ? err.message : "Failed to load samples");
    } finally {
      setRevealing(false);
    }
  };

  const handleHideImages = async () => {
    if (!visitId) return;
    setRevealing(true);
    try {
      const url = new URL(`/api/visits/${visitId}/samples`, window.location.origin);
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error("Failed to hide images");
      }
      const json = await response.json();
      setData(json.data);
      setHasRevealedImages(false);
    } catch (err) {
      console.error("Failed to hide samples:", err);
      setError(err instanceof Error ? err.message : "Failed to load samples");
    } finally {
      setRevealing(false);
    }
  };

  const handleShare = async () => {
    if (typeof window === "undefined" || !visitId) return;
    
    const shareUrl = `${window.location.origin}/visits/${visitId}/samples`;
    
    // Try native share API first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${data?.customerName || "Visit"} - InsightScoop Report`,
          text: `View the InsightScoop wellness report from ${data?.customerName || "this visit"}.`,
          url: shareUrl,
        });
        return;
      } catch (err) {
        // User cancelled or share failed, fall through to clipboard
      }
    }
    
    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert("Link copied to clipboard! Share it with anyone.");
    } catch (err) {
      // Fallback: select text
      const input = document.createElement("input");
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      alert("Link copied to clipboard! Share it with anyone.");
    }
  };

  if (loading) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#f8f5ee] text-graphite dark:bg-slate-950 dark:text-slate-50">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0" style={{ background: brandGradients.heroBackdrop }} />
          <div
            className="absolute inset-0 hidden dark:block"
            style={{
              background:
                "linear-gradient(135deg, rgba(6,10,8,0.95) 0%, rgba(12,22,17,0.9) 55%, rgba(18,32,24,0.85) 100%)",
            }}
          />
        </div>
        <div className="container relative z-10 mx-auto max-w-4xl space-y-6 p-4 pt-24">
          <Skeleton className="h-48 w-full rounded-3xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#f8f5ee] text-graphite dark:bg-slate-950 dark:text-slate-50">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0" style={{ background: brandGradients.heroBackdrop }} />
          <div
            className="absolute inset-0 hidden dark:block"
            style={{
              background:
                "linear-gradient(135deg, rgba(6,10,8,0.95) 0%, rgba(12,22,17,0.9) 55%, rgba(18,32,24,0.85) 100%)",
            }}
          />
        </div>
        <div className="container relative z-10 mx-auto max-w-4xl pt-24">
          <Card className="rounded-3xl border-2 border-red-200 bg-red-50/90 dark:border-red-800 dark:bg-red-900/30">
            <CardHeader>
              <CardTitle className="text-red-700 dark:text-red-400">
                Unable to load visit
              </CardTitle>
              <CardDescription className="text-red-600 dark:text-red-300">
                {error || "Something went wrong. Please try again later."}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  const sampleImagesHidden = data.imagesHidden ?? !hasRevealedImages;
  
  const flaggedGroups = sampleGroups.filter(g => g.isFlagged);
  const normalGroups = sampleGroups.filter(g => !g.isFlagged);
  const hasWellnessFlag = data.summary?.wellnessFlag || flaggedGroups.length > 0;
  const canShowImages = !sampleImagesHidden;

  const heroGradient = hasWellnessFlag
    ? `linear-gradient(135deg, ${withAlpha(brandColors.coral, 0.95)} 0%, ${withAlpha(brandColors.gold, 0.9)} 100%)`
    : `linear-gradient(135deg, ${withAlpha(brandColors.mint, 0.92)} 0%, ${withAlpha(brandColors.evergreen, 0.92)} 100%)`;
  const statusLabel = hasWellnessFlag ? "Monitor this visit" : "All clear";
  const statusCopy = hasWellnessFlag
    ? "We noted something to watch in this recap."
    : "No wellness flags in this recap.";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f8f5ee] text-graphite dark:bg-slate-950 dark:text-slate-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0" style={{ background: brandGradients.heroBackdrop }} />
        <div
          className="absolute inset-0 hidden dark:block"
          style={{
            background:
              "linear-gradient(135deg, rgba(6,10,8,0.95) 0%, rgba(12,22,17,0.9) 55%, rgba(18,32,24,0.85) 100%)",
          }}
        />
        <div
          className="absolute -top-24 right-0 h-64 w-64 rounded-full blur-3xl"
          style={{ background: withAlpha(brandColors.coral, 0.18) }}
        />
        <div
          className="absolute bottom-24 left-10 h-72 w-72 rounded-full blur-3xl"
          style={{ background: withAlpha(brandColors.mint, 0.18) }}
        />
      </div>
      <div className="container relative z-10 mx-auto max-w-4xl space-y-6 p-4 pb-24 pt-24">
        {/* Hero Header */}
        <div className="rounded-[36px] border border-white/50 bg-white/85 p-6 shadow-[0_30px_70px_rgba(15,23,42,0.12)] backdrop-blur dark:border-white/10 dark:bg-slate-900/70">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Image
                    src="/brand/insightscoop-logo-horizontal.png"
                    alt="InsightScoop"
                    width={160}
                    height={40}
                    className="h-7 w-auto object-contain"
                    priority
                  />
                  <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-600 dark:border-white/15 dark:bg-white/10 dark:text-white/70">
                    Visit recap
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Dog className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                  <span className="text-sm font-semibold">InsightScoop Report</span>
                </div>
                <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
                  {data.customerName}&apos;s Yard
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {format(new Date(data.servicedAt), "EEEE, MMMM d, yyyy")}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="rounded-full border border-slate-200/70 bg-white/80 px-3 py-1 dark:border-white/10 dark:bg-white/5">
                    Shareable link
                  </span>
                  <span className="rounded-full border border-slate-200/70 bg-white/80 px-3 py-1 dark:border-white/10 dark:bg-white/5">
                    Not a diagnosis
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  onClick={handleShare}
                  variant="secondary"
                  size="sm"
                  className="rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                >
                  <Share2 className="mr-1.5 h-4 w-4" />
                  Share recap
                </Button>
                <div
                  className="min-w-[180px] rounded-2xl px-4 py-3 text-white shadow-lg"
                  style={{ background: heroGradient }}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    {hasWellnessFlag ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : (
                      <Heart className="h-4 w-4" />
                    )}
                    {statusLabel}
                  </div>
                  <p className="mt-1 text-xs text-white/80">{statusCopy}</p>
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-center shadow-sm dark:border-white/10 dark:bg-slate-900/60">
                <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                  Samples
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
                  {data.stats.total}
                </p>
              </div>
              <div className="rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-center shadow-sm dark:border-white/10 dark:bg-slate-900/60">
                <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                  Healthy
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
                  {data.stats.healthy}
                </p>
              </div>
              <div className="rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-center shadow-sm dark:border-white/10 dark:bg-slate-900/60">
                <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                  Flagged
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
                  {data.stats.flagged}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Overall Summary Card */}
        {data.summary && (
          <div className="rounded-[28px] border border-white/60 bg-white/90 p-6 shadow-[0_22px_50px_rgba(15,23,42,0.1)] dark:border-white/10 dark:bg-slate-900/70">
            <div className="mb-4 flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-2xl"
                style={{
                  backgroundColor: withAlpha(hasWellnessFlag ? brandColors.gold : brandColors.mint, 0.18),
                  color: hasWellnessFlag ? brandColors.coral : brandColors.mint,
                }}
              >
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                  Visit summary
                </p>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Overall assessment
                </h2>
              </div>
            </div>

            {/* 3C Summary Chips */}
            <div className="mb-4 flex flex-wrap gap-2">
              {[
                { label: "Color", value: data.summary.color, tone: brandColors.coral },
                { label: "Consistency", value: data.summary.consistency, tone: brandColors.mint },
                { label: "Content", value: data.summary.content, tone: brandColors.gold },
              ].filter((chip) => chip.value).map((chip) => (
                <span
                  key={chip.label}
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200"
                  style={{
                    borderColor: withAlpha(chip.tone, 0.35),
                    backgroundColor: withAlpha(chip.tone, 0.12),
                  }}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: chip.tone }}
                  />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    {chip.label}
                  </span>
                  <span className="capitalize">{String(chip.value).replace(/-/g, " ")}</span>
                </span>
              ))}
            </div>

            {/* Observations */}
            {data.summary.observations && (
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {data.summary.observations}
              </p>
            )}

            {/* Wellness flag alert */}
            {data.summary.wellnessFlag && data.summary.flagReason && (
              <div className="mt-4 rounded-2xl border border-amber-200/70 bg-amber-50/80 p-4 dark:border-amber-700/60 dark:bg-amber-900/30">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-300">
                      Wellness note
                    </p>
                    <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                      {data.summary.flagReason}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Gate latch photo */}
        {data.gatePhoto && (
          <div className="rounded-[28px] border border-white/60 bg-white/90 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-slate-900/70">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-500" />
                <h2 className="font-semibold text-slate-900 dark:text-white">
                  Gate latch photo
                </h2>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {format(new Date(data.gatePhoto.capturedAt), "h:mm a")}
              </span>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm dark:border-slate-700/60 dark:bg-slate-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.gatePhoto.url}
                alt="Gate latch photo"
                className="aspect-[4/3] w-full object-cover"
              />
            </div>
          </div>
        )}

        {/* Image visibility controls */}
        {sampleImagesHidden ? (
          <div className="rounded-[28px] border border-white/60 bg-white/90 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-slate-900/70">
            <div className="flex items-start gap-3">
              <Shield className="mt-1 h-5 w-5 text-emerald-600 dark:text-emerald-300" />
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Sample images are hidden by default
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Gate latch photos stay visible.{" "}
                  {data.stats.flagged > 0
                    ? `${data.stats.flagged} flagged sample${
                        data.stats.flagged === 1 ? "" : "s"
                      } may need attention.`
                    : "No flagged samples this visit."}
                </p>
              </div>
            </div>
            {data.stats.flagged > 0 && (
              <Button
                onClick={handleRevealImages}
                disabled={revealing}
                className="mt-4 w-full rounded-full"
              >
                {revealing ? "Loading images..." : "Reveal flagged images"}
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-[28px] border border-white/60 bg-white/90 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-slate-900/70">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <EyeOff className="mt-1 h-5 w-5 text-slate-500 dark:text-slate-300" />
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Sample images are visible
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Tap any sample image to blur or reveal when you need it.
                  </p>
                </div>
              </div>
              <Button
                onClick={handleHideImages}
                disabled={revealing}
                variant="outline"
                size="sm"
                className="rounded-full"
              >
                Hide images
              </Button>
            </div>
          </div>
        )}

        {/* Flagged Samples - Expanded by default */}
        {flaggedGroups.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <h2 className="font-semibold text-slate-900 dark:text-white">
                Samples to monitor
              </h2>
              <Badge className="border-amber-300/70 bg-amber-100/80 text-amber-700 dark:border-amber-700/60 dark:bg-amber-900/50 dark:text-amber-300">
                {flaggedGroups.length}
              </Badge>
            </div>
            <div className="space-y-3">
              {flaggedGroups.map((group, idx) => (
                <SampleGroupCard
                  key={group.id}
                  samples={group.samples}
                  groupIndex={idx + 1}
                  isFlagged={true}
                  defaultExpanded={true}
                  showImages={canShowImages}
                />
              ))}
            </div>
          </div>
        )}

        {/* Normal Samples - Collapsed by default */}
        {normalGroups.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <h2 className="font-semibold text-slate-900 dark:text-white">
                {flaggedGroups.length > 0 ? "Healthy Samples" : "All Samples"}
              </h2>
              <Badge className="border-emerald-300/70 bg-emerald-100/80 text-emerald-700 dark:border-emerald-700/60 dark:bg-emerald-900/50 dark:text-emerald-300">
                {normalGroups.length}
              </Badge>
            </div>
            <p className="px-1 text-sm text-slate-500 dark:text-slate-400">
              These samples look healthy. Tap to expand and view details.
            </p>
            <div className="space-y-3">
              {normalGroups.map((group, idx) => (
                <SampleGroupCard
                  key={group.id}
                  samples={group.samples}
                  groupIndex={flaggedGroups.length + idx + 1}
                  isFlagged={false}
                  defaultExpanded={false}
                  showImages={canShowImages}
                />
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="rounded-[28px] border border-white/60 bg-white/90 p-6 text-center shadow-[0_16px_36px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-slate-900/70">
          <Shield className="mx-auto mb-3 h-8 w-8 text-emerald-500" />
          <h3 className="font-semibold text-slate-900 dark:text-white">
            Questions about your recap?
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Contact us at{" "}
            <a
              href="mailto:support@yardura.com"
              className="font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
            >
              support@yardura.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
