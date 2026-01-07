"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  endOfDay,
  format,
  formatDistanceToNow,
  startOfDay,
  subDays,
} from "date-fns";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  Check,
  Eye,
  EyeOff,
  Filter,
  Loader2,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Trash,
  Unlock,
  Camera,
  ClipboardCheck,
  Users,
  Play,
  DoorOpen,
  PackageCheck,
  SprayCan,
} from "lucide-react";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ResetVisitButton } from "@/components/admin/ResetVisitButton";

import {
  ADMIN_PORTAL_ROLES,
  extractUserRole,
  getDefaultRedirectForRole,
} from "@/lib/auth/roles";
import { hasWellnessAnalysisFlag, isWellnessFlaggedMedia } from "@/lib/service-visits/flagging";
import { brandColors, withAlpha } from "@/shared/brand";

const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
  const response = await fetch(input, init);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? "Request failed");
  }
  return response.json();
};

type DailyCheckReviewStatus = "PENDING" | "APPROVED" | "NEEDS_ACTION";

type DailyCheckItem = {
  id: string;
  capturedAt: string;
  reviewStatus: DailyCheckReviewStatus;
  notes: string | null;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  photoUrl: string | null;
  gpsLat?: number | null;
  gpsLng?: number | null;
  checklist?: Record<string, unknown> | null;
  reviewedAt: string | null;
  reviewedById: string | null;
};

type AnalysisResult = {
  color?: string;
  consistency?: string;
  content?: string;
  observations?: string;
  wellness_flag?: boolean;
  flag_reason?: string;
};

type VisitMediaItem = {
  id: string;
  assetType: string;
  capturedAt: string;
  notes: string | null;
  analysisStatus: string;
  analysisConfidence: number | null;
  analysisResult: AnalysisResult | null;
  analysisModel: string | null;
  analysisCompletedAt: string | null;
  analysisError: string | null;
  reviewStatus: string;
  visibilityState: string;
  photoUrl: string | null;
  moderationNotes?: string | null;
  stoolSampleId?: string | null;
  stoolSampleView?: "SURFACE" | "CROSS_SECTION" | null;
  storagePath?: string | null;
};

// Helper to determine if media is a video based on storage path
function isVideoMedia(media: VisitMediaItem): boolean {
  if (!media.storagePath) return false;
  const ext = media.storagePath.split('.').pop()?.toLowerCase();
  return ext === 'mp4' || ext === 'webm' || ext === 'mov';
}

// Helper to get human-readable label for media notes (sanitation types)
function getSanitationLabel(notes: string | null): string {
  if (notes === "SANITATION_VIDEO") return "Sanitation Video";
  if (notes === "SANITATION_SHOES") return "Boots/Shoes";
  if (notes === "SANITATION_TOOLS") return "Tools";
  return notes ?? "";
}

// MediaCard component for consistent rendering
function MediaCard({
  media,
  viewLabel,
  sectionLabel,
  revealed,
  onToggleReveal,
  onUpdateMedia,
  onDeleteMedia,
  onModerationNote,
  deletingMediaId,
  updatingNoteId,
}: {
  media: VisitMediaItem;
  viewLabel: string | null;
  sectionLabel?: string | null;
  revealed: boolean;
  onToggleReveal: () => void;
  onUpdateMedia: (id: string, updates: { reviewStatus?: string; visibilityState?: string }) => void;
  onDeleteMedia: (id: string) => void;
  onModerationNote: (id: string, currentNote: string | null) => void;
  deletingMediaId: string | null;
  updatingNoteId: string | null;
}) {
  const [videoPlaying, setVideoPlaying] = useState(false);
  const isVideo = isVideoMedia(media);
  const analysisFlag = hasWellnessAnalysisFlag(media.analysisResult);
  const activeFlag = isWellnessFlaggedMedia(
    { analysisResult: media.analysisResult, reviewStatus: media.reviewStatus },
    { requireVisible: false },
  );
  const flagCleared = analysisFlag && media.reviewStatus === "APPROVED";
  const approvalLabel = analysisFlag
    ? media.reviewStatus === "APPROVED"
      ? "Flag cleared"
      : "Clear flag"
    : media.reviewStatus === "APPROVED"
      ? "Approved"
      : "Approve";

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="relative aspect-[4/3] w-full bg-slate-100 dark:bg-slate-900">
        {isVideo ? (
          // Video player
          <>
            {videoPlaying ? (
              <video
                src={media.photoUrl ?? ""}
                className="h-full w-full object-cover"
                controls
                autoPlay
                onEnded={() => setVideoPlaying(false)}
              />
            ) : (
              <div className="relative h-full w-full">
                {media.photoUrl ? (
                  <video
                    src={media.photoUrl}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-slate-200 dark:bg-slate-700">
                    <SprayCan className="h-12 w-12 text-slate-400" />
                  </div>
                )}
                {/* Play button overlay */}
                <button
                  onClick={() => setVideoPlaying(true)}
                  className="absolute inset-0 flex items-center justify-center bg-black/30 transition hover:bg-black/40"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-lg">
                    <Play className="h-8 w-8 text-brand-mint ml-1" fill="currentColor" />
                  </div>
                </button>
              </div>
            )}
          </>
        ) : media.photoUrl ? (
          // Image display
          <Image
            src={media.photoUrl}
            alt={media.assetType}
            fill
            className={`object-cover transition ${
              media.assetType === "INSIGHTSCOOP" && !revealed
                ? "blur-xl"
                : "blur-0"
            }`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-500 dark:text-slate-400">
            No media available
          </div>
        )}
        
        {/* View label for InsightScoop samples */}
        {viewLabel && (
          <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-brand-mint px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {viewLabel}
          </div>
        )}
        
        {/* Section label for other types */}
        {!viewLabel && sectionLabel && (
          <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur">
            {media.assetType === "GATE" && <DoorOpen className="h-3.5 w-3.5" />}
            {media.assetType === "BAG_DROP" && <PackageCheck className="h-3.5 w-3.5" />}
            {(media.notes?.startsWith("SANITATION") || isVideo) && <SprayCan className="h-3.5 w-3.5" />}
            {sectionLabel}
          </div>
        )}
        
        {/* Reveal/blur button for InsightScoop */}
        {media.assetType === "INSIGHTSCOOP" && media.photoUrl && !isVideo && (
          <button
            type="button"
            onClick={onToggleReveal}
            className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-lg transition hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {revealed ? (
              <>
                <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> Blur
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Reveal
              </>
            )}
          </button>
        )}
      </div>
      
      <div className="space-y-3 px-4 py-4 text-sm">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              {media.assetType === "OTHER" && media.notes?.startsWith("SANITATION") 
                ? getSanitationLabel(media.notes) 
                : media.assetType}
            </span>
            {isVideo && (
              <Badge className="border border-brand-coral/30 bg-brand-coral/10 text-brand-coral text-xs">
                Video
              </Badge>
            )}
          </div>
          <span className="text-slate-500 dark:text-slate-400">
            {format(new Date(media.capturedAt), "EEE, MMM d p")}
          </span>
        </div>
        
        {media.notes && !media.notes.startsWith("SANITATION") && (
          <p className="text-sm text-slate-600 dark:text-slate-300">{media.notes}</p>
        )}
        
        {/* Analysis Results for InsightScoop samples */}
        {media.assetType === "INSIGHTSCOOP" && media.analysisResult && (
          <div className="rounded-xl border border-brand-mint/20 bg-brand-mint/5 p-3 dark:border-brand-mint/30 dark:bg-brand-mint/10">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-mint">
                AI Analysis
              </span>
              {media.analysisConfidence != null && (
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  {(media.analysisConfidence * 100).toFixed(0)}% confidence
                </span>
              )}
            </div>
            
            {/* 3C Chips */}
            <div className="mb-2 flex flex-wrap gap-1.5">
              {media.analysisResult.color && (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  <span className="text-slate-400 dark:text-slate-500">Color:</span> {media.analysisResult.color}
                </span>
              )}
              {media.analysisResult.consistency && (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  <span className="text-slate-400 dark:text-slate-500">Consistency:</span> {media.analysisResult.consistency}
                </span>
              )}
              {media.analysisResult.content && (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  <span className="text-slate-400 dark:text-slate-500">Content:</span> {media.analysisResult.content}
                </span>
              )}
            </div>
            
            {/* Observations */}
            {media.analysisResult.observations && (
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {media.analysisResult.observations}
              </p>
            )}
            
            {/* Wellness Flag */}
            {activeFlag && (
              <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-brand-coral/30 bg-brand-coral/10 px-2 py-1.5 text-[10px] font-medium text-brand-coral">
                <AlertTriangle className="h-3 w-3" />
                <span>{media.analysisResult.flag_reason || "Sample flagged for review"}</span>
              </div>
            )}
            {flagCleared && (
              <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-brand-mint/30 bg-brand-mint/10 px-2 py-1.5 text-[10px] font-medium text-brand-mint">
                <ShieldCheck className="h-3 w-3" />
                <span>Flag cleared after review</span>
              </div>
            )}
          </div>
        )}
        
        {/* Analysis Status Indicator */}
        {media.assetType === "INSIGHTSCOOP" && !media.analysisResult && (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
            {media.analysisStatus === "PENDING" || media.analysisStatus === "IN_PROGRESS" ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Analysis {media.analysisStatus.toLowerCase().replace("_", " ")}...</span>
              </>
            ) : media.analysisStatus === "FAILED" ? (
              <>
                <AlertTriangle className="h-3 w-3 text-brand-coral" />
                <span className="text-brand-coral">Analysis failed{media.analysisError ? `: ${media.analysisError}` : ""}</span>
              </>
            ) : media.analysisStatus === "NOT_REQUESTED" ? (
              <span>No analysis requested</span>
            ) : (
              <span>Analysis status: {media.analysisStatus}</span>
            )}
          </div>
        )}
        
        {media.moderationNotes && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Moderator note:{" "}
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {media.moderationNotes}
            </span>
          </p>
        )}
        
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge className="border border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
            {media.reviewStatus}
          </Badge>
          <Badge className="border border-slate-300 bg-white text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {media.visibilityState}
          </Badge>
        </div>
        
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={media.reviewStatus === "APPROVED" ? "default" : "outline"}
            className={`gap-1 rounded-full ${
              media.reviewStatus === "APPROVED"
                ? "bg-brand-mint text-white hover:bg-brand-mint/90"
                : "border-slate-300 text-slate-700 hover:border-brand-mint hover:text-brand-mint dark:border-slate-600 dark:text-slate-300"
            }`}
            onClick={() => onUpdateMedia(media.id, { reviewStatus: "APPROVED" })}
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" /> {approvalLabel}
          </Button>
          <Button
            size="sm"
            variant={media.reviewStatus === "NEEDS_ACTION" ? "destructive" : "outline"}
            className={`gap-1 rounded-full ${
              media.reviewStatus === "NEEDS_ACTION"
                ? "bg-brand-coral text-white hover:bg-brand-coral/90"
                : "border-slate-300 text-slate-700 hover:border-brand-coral hover:text-brand-coral dark:border-slate-600 dark:text-slate-300"
            }`}
            onClick={() => onUpdateMedia(media.id, { reviewStatus: "NEEDS_ACTION" })}
          >
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Needs action
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1 rounded-full border-slate-300 text-slate-700 hover:border-brand-gold hover:text-brand-gold dark:border-slate-600 dark:text-slate-300"
            onClick={() =>
              onUpdateMedia(media.id, {
                visibilityState: media.visibilityState === "VISIBLE" ? "HIDDEN" : "VISIBLE",
              })
            }
          >
            {media.visibilityState === "VISIBLE" ? (
              <>
                <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> Hide
              </>
            ) : (
              <>
                <Unlock className="h-3.5 w-3.5" aria-hidden="true" /> Unhide
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1 rounded-full"
            onClick={() => onModerationNote(media.id, media.moderationNotes ?? null)}
            disabled={updatingNoteId === media.id}
          >
            {updatingNoteId === media.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Note
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="gap-1 rounded-full"
            onClick={() => onDeleteMedia(media.id)}
            disabled={deletingMediaId === media.id}
          >
            {deletingMediaId === media.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

type VisitInsight = {
  colorIndicator: string | null;
  consistencyIndicator: string | null;
  contentIndicator: string | null;
  observations: string | null;
  wellnessFlag: boolean;
  flagReason: string | null;
} | null;

type VisitReview = {
  id: string;
  status: string;
  reviewerId: string | null;
  summary: string | null;
  updatedAt: string;
} | null;

type VisitListItem = {
  id: string;
  scheduledDate: string;
  status: string;
  customer: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    addressLine1: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  } | null;
  assignedTo: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  media: VisitMediaItem[];
  insight: VisitInsight;
  review: VisitReview;
};

type VisitTimeframe = "today" | "yesterday" | "last7" | "last30" | "custom";

export default function FieldOpsQaPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) {
      router.replace("/signin?callbackUrl=/admin/field-ops");
      return;
    }
    const role = extractUserRole(session);
    if (!role || !ADMIN_PORTAL_ROLES.includes(role)) {
      router.replace(getDefaultRedirectForRole(role));
      return;
    }
  }, [session, status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
        <div className="container mx-auto px-6 pb-12 pt-24 md:pb-12 md:pt-20">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div className="max-w-2xl space-y-3">
              <div className="flex items-center gap-3 text-xs uppercase tracking-[0.28em] text-brand-coral dark:text-brand-mint">
                <ShieldCheck className="h-4 w-4" />
                <span>Field operations</span>
              </div>
              <div className="space-y-2">
                <h1 className="font-serif text-4xl font-semibold text-slate-900 dark:text-white sm:text-5xl">
                  Quality assurance
                </h1>
                <p className="text-base text-slate-600 dark:text-slate-300 sm:text-lg">
                  Review daily gear checks, access proof, and InsightScoop captures before customers ever see them.
                </p>
              </div>
            </div>
            <div className="flex flex-col items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
              <span className="rounded-full border border-brand-mint/30 bg-brand-mint/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-brand-mint dark:border-brand-mint/40 dark:bg-brand-mint/20">
                Live QA workflow
              </span>
              <p className="max-w-xs text-left text-slate-500 dark:text-slate-400">
                Decisions sync instantly to scooper devices and customer recaps. Keep the pipeline clean every morning.
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-brand-coral" />
                <p className="text-xs uppercase tracking-[0.2em] font-semibold text-slate-500 dark:text-slate-400">Gear checks</p>
              </div>
              <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                Enforce uniforms and equipment before routes roll.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-brand-gold" />
                <p className="text-xs uppercase tracking-[0.2em] font-semibold text-slate-500 dark:text-slate-400">Visit audits</p>
              </div>
              <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                Verify gate, bag drop, and sanitation proof in seconds.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand-mint" />
                <p className="text-xs uppercase tracking-[0.2em] font-semibold text-slate-500 dark:text-slate-400">Insights</p>
              </div>
              <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                Flag wellness risks and polish customer-ready recaps.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-8 px-6 pb-24 pt-12">
        <Tabs defaultValue="checkins" className="space-y-6">
          <TabsList className="inline-flex h-12 items-center gap-1 rounded-full border border-slate-200 bg-white p-1 text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <TabsTrigger
              value="checkins"
              className="h-10 rounded-full px-6 text-sm font-semibold transition hover:bg-brand-mint/10 hover:text-brand-mint dark:hover:bg-brand-mint/15 dark:hover:text-brand-mint data-[state=active]:bg-brand-coral data-[state=active]:text-white data-[state=active]:shadow-lg"
            >
              Daily check-ins
            </TabsTrigger>
            <TabsTrigger
              value="visits"
              className="h-10 rounded-full px-6 text-sm font-semibold transition hover:bg-brand-mint/10 hover:text-brand-mint dark:hover:bg-brand-mint/15 dark:hover:text-brand-mint data-[state=active]:bg-brand-coral data-[state=active]:text-white data-[state=active]:shadow-lg"
            >
              Visit QA
            </TabsTrigger>
          </TabsList>
          <TabsContent value="checkins" className="focus-visible:outline-none">
            <DailyCheckPanel />
          </TabsContent>
          <TabsContent value="visits" className="focus-visible:outline-none">
            <VisitReviewPanel />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function DailyCheckPanel() {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [cursor, setCursor] = useState<string | null>(null);
  const [items, setItems] = useState<DailyCheckItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const loadChecks = async (reset = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", "20");
      if (statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }
      if (!reset && cursor) {
        params.set("cursor", cursor);
      }
      const payload = await fetcher(`/api/admin/field-ops/checkins?${params.toString()}`);
      const next = payload.nextCursor ?? null;
      setHasMore(Boolean(next));
      setCursor(next);
      setItems((previous) =>
        reset ? (payload.items as DailyCheckItem[]) : [...previous, ...(payload.items as DailyCheckItem[])],
      );
    } catch (err: any) {
      console.error("checkins.load", err);
      setError(err?.message ?? "Failed to load check-ins");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCursor(null);
    loadChecks(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleReviewUpdate = async (
    checkId: string,
    updates: Partial<{ reviewStatus: DailyCheckReviewStatus; notes: string | null }>,
  ) => {
    try {
      const payload = await fetcher(`/api/admin/field-ops/checkins/${checkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      setItems((previous) =>
        previous.map((item) => (item.id === checkId ? { ...item, ...payload } : item)),
      );
      toast.success("Daily check updated");
    } catch (error: any) {
      console.error("checkins.update", error);
      toast.error(error?.message ?? "Unable to update check");
    }
  };

  const handleDelete = async (checkId: string) => {
    try {
      await fetcher(`/api/admin/field-ops/checkins/${checkId}`, {
        method: "DELETE",
      });
      setItems((previous) => previous.filter((item) => item.id !== checkId));
      toast.success("Daily check deleted");
    } catch (error: any) {
      console.error("checkins.delete", error);
      toast.error(error?.message ?? "Failed to delete check");
    }
  };

  return (
    <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <CardHeader className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
        <div>
          <CardTitle className="font-serif text-xl text-slate-900 dark:text-white">Daily check-ins</CardTitle>
          <CardDescription className="text-slate-500 dark:text-slate-400">
            Make sure scoopers acknowledge gear and PPE before routes start.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Filter className="h-4 w-4" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[170px] rounded-full border border-slate-300 bg-white pl-4 pr-8 text-sm font-medium text-slate-700 shadow-sm transition hover:border-brand-mint focus-visible:ring-brand-mint/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-mint">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="max-h-64 border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="PENDING">Pending review</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="NEEDS_ACTION">Needs action</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 py-6">
        {error ? (
          <div className="flex items-center justify-between rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive dark:border-destructive/40 dark:bg-destructive/20">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => loadChecks(true)} className="rounded-full">
              Retry
            </Button>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {items.map((check) => (
            <DailyCheckCard
              key={check.id}
              check={check}
              onReviewStatusChange={(status) => handleReviewUpdate(check.id, { reviewStatus: status })}
              onDelete={() => handleDelete(check.id)}
            />
          ))}
        </div>

        {loading && items.length === 0 ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[...Array(4)].map((_, index) => (
              <Skeleton key={index} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-center gap-3">
          {hasMore ? (
            <Button
              onClick={() => loadChecks(false)}
              disabled={loading}
              variant="outline"
              className="rounded-full border-brand-mint text-brand-mint hover:bg-brand-mint/10 hover:text-brand-mint dark:border-brand-mint/60 dark:text-brand-mint dark:hover:bg-brand-mint/20"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Load more
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function DailyCheckCard({
  check,
  onReviewStatusChange,
  onDelete,
}: {
  check: DailyCheckItem;
  onReviewStatusChange: (status: DailyCheckReviewStatus) => void;
  onDelete: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const statusBadge = useMemo(() => {
    switch (check.reviewStatus) {
      case "APPROVED":
        return (
          <Badge className="border border-brand-mint/30 bg-brand-mint/10 text-brand-mint dark:border-brand-mint/40 dark:bg-brand-mint/20">
            Approved
          </Badge>
        );
      case "NEEDS_ACTION":
        return (
          <Badge className="border border-brand-coral/30 bg-brand-coral/10 text-brand-coral dark:border-brand-coral/40 dark:bg-brand-coral/20">
            Needs action
          </Badge>
        );
      default:
        return (
          <Badge className="border border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
            Pending
          </Badge>
        );
    }
  }, [check.reviewStatus]);

  const capturedLabel = useMemo(() => {
    const capturedDate = new Date(check.capturedAt);
    return `${formatDistanceToNow(capturedDate, { addSuffix: true })} • ${format(capturedDate, "EEE, MMM d p")}`;
  }, [check.capturedAt]);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {check.user?.name ?? "Unknown scooper"}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{capturedLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {statusBadge}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-brand-coral dark:text-slate-500 dark:hover:text-brand-coral"
            onClick={onDelete}
          >
            <Trash className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
      <div className="relative flex flex-1 flex-col">
        <div className="relative h-48 w-full overflow-hidden">
          {check.photoUrl ? (
            <Image
              src={check.photoUrl}
              alt={check.user?.name ?? "Daily check"}
              fill
              className={`object-cover transition ${revealed ? "blur-0" : "blur-lg"}`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-100 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              No photo uploaded
            </div>
          )}
          {!revealed && check.photoUrl ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40">
              <Button
                variant="secondary"
                className="bg-white text-slate-900 shadow-lg hover:bg-slate-50 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                onClick={() => setRevealed(true)}
              >
                <Eye className="mr-2 h-4 w-4" /> Reveal photo
              </Button>
            </div>
          ) : null}
        </div>
        <div className="space-y-3 px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
          {check.notes ? <p className="text-sm text-slate-600 dark:text-slate-300">{check.notes}</p> : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={check.reviewStatus === "APPROVED" ? "default" : "outline"}
              onClick={() => onReviewStatusChange("APPROVED")}
              className={`gap-1 rounded-full ${check.reviewStatus === "APPROVED" ? "bg-brand-mint text-white hover:bg-brand-mint/90" : "border-slate-300 text-slate-700 hover:border-brand-mint hover:text-brand-mint dark:border-slate-600 dark:text-slate-300"}`}
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Approve
            </Button>
            <Button
              size="sm"
              variant={check.reviewStatus === "NEEDS_ACTION" ? "destructive" : "outline"}
              onClick={() => onReviewStatusChange("NEEDS_ACTION")}
              className={`gap-1 rounded-full ${check.reviewStatus === "NEEDS_ACTION" ? "bg-brand-coral text-white hover:bg-brand-coral/90" : "border-slate-300 text-slate-700 hover:border-brand-coral hover:text-brand-coral dark:border-slate-600 dark:text-slate-300"}`}
            >
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Needs follow-up
            </Button>
            <Button
              size="sm"
              variant={check.reviewStatus === "PENDING" ? "secondary" : "outline"}
              onClick={() => onReviewStatusChange("PENDING")}
              className={`gap-1 rounded-full ${check.reviewStatus === "PENDING" ? "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200" : "border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-300"}`}
            >
              <TimerReset className="h-3.5 w-3.5" aria-hidden="true" /> Reset
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function VisitReviewPanel() {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [reviewFilter, setReviewFilter] = useState<string>("ALL");
  const [timeframe, setTimeframe] = useState<VisitTimeframe>("today");
  const [customDate, setCustomDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [visits, setVisits] = useState<VisitListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<VisitListItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const visitRange = useMemo(() => {
    const now = new Date();
    let start = startOfDay(now);
    let end = endOfDay(now);
    let label = `Today · ${format(now, "EEE, MMM d")}`;

    if (timeframe === "yesterday") {
      const day = subDays(now, 1);
      start = startOfDay(day);
      end = endOfDay(day);
      label = `Yesterday · ${format(day, "EEE, MMM d")}`;
    } else if (timeframe === "last7") {
      start = startOfDay(subDays(now, 6));
      end = endOfDay(now);
      label = `${format(start, "MMM d")} – ${format(end, "MMM d")}`;
    } else if (timeframe === "last30") {
      start = startOfDay(subDays(now, 29));
      end = endOfDay(now);
      label = `${format(start, "MMM d")} – ${format(end, "MMM d")}`;
    } else if (timeframe === "custom" && customDate) {
      const custom = new Date(`${customDate}T00:00:00`);
      if (!Number.isNaN(custom.getTime())) {
        start = startOfDay(custom);
        end = endOfDay(custom);
        label = format(custom, "EEE, MMM d");
      }
    }

    return {
      scheduledAfter: start.toISOString(),
      scheduledBefore: end.toISOString(),
      label,
    };
  }, [timeframe, customDate]);

  useEffect(() => {
    if (timeframe === "custom" && !customDate) {
      setCustomDate(format(new Date(), "yyyy-MM-dd"));
    }
  }, [timeframe, customDate]);

  const loadVisits = async (reset = false) => {
    setLoading(true);
    setError(null);
    try {
      if (timeframe === "custom" && !customDate) {
        if (reset) {
          setVisits([]);
        }
        setHasMore(false);
        setCursor(null);
        return;
      }

      const params = new URLSearchParams();
      params.set("limit", "15");
      if (statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }
      if (reviewFilter !== "ALL") {
        params.set("reviewStatus", reviewFilter);
      }
      if (visitRange.scheduledAfter) {
        params.set("scheduledAfter", visitRange.scheduledAfter);
      }
      if (visitRange.scheduledBefore) {
        params.set("scheduledBefore", visitRange.scheduledBefore);
      }
      if (!reset && cursor) {
        params.set("cursor", cursor);
      }
      const payload = await fetcher(`/api/admin/field-ops/visits?${params.toString()}`);
      const next = payload.nextCursor ?? null;
      setHasMore(Boolean(next));
      setCursor(next);
      setVisits((previous) =>
        reset ? (payload.items as VisitListItem[]) : [...previous, ...(payload.items as VisitListItem[])],
      );
    } catch (err: any) {
      console.error("visits.load", err);
      setError(err?.message ?? "Failed to load visits");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCursor(null);
    loadVisits(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, reviewFilter, timeframe, customDate]);

  const handleOpenVisit = (visit: VisitListItem) => {
    setSelectedVisit(visit);
    setDialogOpen(true);
  };

  const updateVisitMedia = async (
    mediaId: string,
    updates: Partial<{ reviewStatus: string; visibilityState: string; notes: string | null }>,
  ) => {
    try {
      const payload = await fetcher(`/api/admin/field-ops/visit-media/${mediaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      setVisits((previous) =>
        previous.map((visit) =>
          visit.media.some((media) => media.id === mediaId)
            ? {
                ...visit,
                media: visit.media.map((media) =>
                  media.id === mediaId ? { ...media, ...payload } : media,
                ),
              }
            : visit,
        ),
      );
      setSelectedVisit((prev) =>
        prev
          ? {
              ...prev,
              media: prev.media.map((media) => (media.id === mediaId ? { ...media, ...payload } : media)),
            }
          : prev,
      );
      toast.success("Media updated");
    } catch (error: any) {
      console.error("visit-media.update", error);
      toast.error(error?.message ?? "Unable to update media");
    }
  };

  const deleteVisitMedia = async (mediaId: string) => {
    try {
      await fetcher(`/api/admin/field-ops/visit-media/${mediaId}`, {
        method: "DELETE",
      });
      setVisits((previous) =>
        previous.map((visit) =>
          visit.media.some((media) => media.id === mediaId)
            ? {
                ...visit,
                media: visit.media.filter((media) => media.id !== mediaId),
              }
            : visit,
        ),
      );
      setSelectedVisit((prev) =>
        prev
          ? {
              ...prev,
              media: prev.media.filter((media) => media.id !== mediaId),
            }
          : prev,
      );
      toast.success("Media deleted");
    } catch (error: any) {
      console.error("visit-media.delete", error);
      toast.error(error?.message ?? "Unable to delete media");
      throw error;
    }
  };

  const updateVisitReview = async (
    visitId: string,
    updates: Partial<{ status: string; summary: string | null }>,
  ) => {
    try {
      const payload = await fetcher(`/api/admin/field-ops/visit-reviews/${visitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      setVisits((previous) =>
        previous.map((visit) =>
          visit.id === visitId
            ? {
                ...visit,
                review: {
                  id: payload.id,
                  status: payload.status,
                  summary: payload.summary,
                  reviewerId: payload.reviewerId,
                  updatedAt: payload.updatedAt,
                },
              }
            : visit,
        ),
      );
      setSelectedVisit((prev) =>
        prev && prev.id === visitId
          ? {
              ...prev,
              review: {
                id: payload.id,
                status: payload.status,
                summary: payload.summary,
                reviewerId: payload.reviewerId,
                updatedAt: payload.updatedAt,
              },
            }
          : prev,
      );
      toast.success("Review updated");
    } catch (error: any) {
      console.error("visit-review.update", error);
      toast.error(error?.message ?? "Unable to update review");
    }
  };

  return (
    <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <CardHeader className="flex flex-col gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between dark:border-slate-700">
        <div>
          <CardTitle className="font-serif text-xl text-slate-900 dark:text-white">Visit QA</CardTitle>
          <CardDescription className="text-slate-500 dark:text-slate-400">
            Spot-check gate photos, bag drops, and InsightScoop samples before customers see them.
          </CardDescription>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={timeframe}
              onValueChange={(value) => setTimeframe(value as VisitTimeframe)}
            >
              <SelectTrigger className="w-[170px] rounded-full border border-slate-300 bg-white pl-4 pr-8 text-sm font-medium text-slate-700 shadow-sm transition hover:border-brand-mint focus-visible:ring-brand-mint/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-mint">
                <SelectValue placeholder="Timeframe" />
              </SelectTrigger>
              <SelectContent className="max-h-72 border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="last7">Last 7 days</SelectItem>
                <SelectItem value="last30">Last 30 days</SelectItem>
                <SelectItem value="custom">Pick a day</SelectItem>
              </SelectContent>
            </Select>
            {timeframe === "custom" ? (
              <input
                type="date"
                value={customDate}
                onChange={(event) => setCustomDate(event.target.value)}
                className="h-10 rounded-full border border-slate-300 bg-white px-4 text-sm text-slate-700 shadow-sm outline-none transition focus-visible:border-brand-mint focus-visible:ring-2 focus-visible:ring-brand-mint/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              />
            ) : null}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] rounded-full border border-slate-300 bg-white pl-4 pr-8 text-sm font-medium text-slate-700 shadow-sm transition hover:border-brand-mint focus-visible:ring-brand-mint/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-mint">
                <SelectValue placeholder="Visit status" />
              </SelectTrigger>
              <SelectContent className="max-h-64 border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                <SelectItem value="ALL">All visits</SelectItem>
                <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="SKIPPED">Skipped</SelectItem>
              </SelectContent>
            </Select>
            <Select value={reviewFilter} onValueChange={setReviewFilter}>
              <SelectTrigger className="w-[190px] rounded-full border border-slate-300 bg-white pl-4 pr-8 text-sm font-medium text-slate-700 shadow-sm transition hover:border-brand-mint focus-visible:ring-brand-mint/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-mint">
                <SelectValue placeholder="QA state" />
              </SelectTrigger>
              <SelectContent className="max-h-64 border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                <SelectItem value="ALL">All QA states</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                <SelectItem value="RESOLVED">Resolved (payout approved)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Window: {visitRange.label}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 py-6">
        {error ? (
          <div className="flex items-center justify-between rounded-2xl border border-brand-coral/30 bg-brand-coral/10 p-4 text-sm text-brand-coral dark:border-brand-coral/40 dark:bg-brand-coral/20">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => loadVisits(true)} className="rounded-full border-brand-coral text-brand-coral hover:bg-brand-coral/10">
              Retry
            </Button>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {visits.map((visit) => (
            <VisitCard key={visit.id} visit={visit} onOpen={() => handleOpenVisit(visit)} />
          ))}
        </div>

        {loading && visits.length === 0 ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[...Array(4)].map((_, index) => (
              <Skeleton key={index} className="h-48 rounded-xl bg-slate-200 dark:bg-slate-700" />
            ))}
          </div>
        ) : null}

        {hasMore ? (
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => loadVisits(false)}
              disabled={loading}
              className="rounded-full border-brand-mint text-brand-mint hover:bg-brand-mint/10 hover:text-brand-mint dark:border-brand-mint/60 dark:text-brand-mint dark:hover:bg-brand-mint/20"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Load more
            </Button>
          </div>
        ) : null}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="admin-card flex max-h-[90vh] max-w-4xl flex-col overflow-hidden border-none bg-white/90 p-0 dark:bg-slate-950/95">
          {selectedVisit ? (
            <VisitDetailDialog
              visit={selectedVisit}
              onClose={() => setDialogOpen(false)}
              onUpdateMedia={updateVisitMedia}
              onDeleteMedia={deleteVisitMedia}
              onUpdateReview={updateVisitReview}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function VisitCard({ visit, onOpen }: { visit: VisitListItem; onOpen: () => void }) {
  const scheduledDate = useMemo(() => new Date(visit.scheduledDate), [visit.scheduledDate]);
  
  // Calculate media stats
  const mediaStats = useMemo(() => {
    const insightScoop = visit.media.filter(m => m.assetType === "INSIGHTSCOOP");
    const pendingReview = visit.media.filter(m => m.reviewStatus === "PENDING").length;
    const approved = visit.media.filter(m => m.reviewStatus === "APPROVED").length;
    const needsAction = visit.media.filter(m => m.reviewStatus === "NEEDS_ACTION").length;
    
    // Count unique samples by stoolSampleId (surface + cross-section = 1 sample)
    const uniqueSampleIds = new Set<string>();
    const unpairedCount = { count: 0 };
    insightScoop.forEach(m => {
      if (m.stoolSampleId) {
        uniqueSampleIds.add(m.stoolSampleId);
      } else {
        unpairedCount.count++;
      }
    });
    const uniqueSamples = uniqueSampleIds.size + unpairedCount.count;
    
    // Count analyzed samples (at least one image in the pair is analyzed)
    const analyzedSampleIds = new Set<string>();
    const analyzedUnpaired = { count: 0 };
    insightScoop.filter(m => m.analysisStatus === "COMPLETED" || m.analysisStatus === "NEEDS_REVIEW").forEach(m => {
      if (m.stoolSampleId) {
        analyzedSampleIds.add(m.stoolSampleId);
      } else {
        analyzedUnpaired.count++;
      }
    });
    const analyzed = analyzedSampleIds.size + analyzedUnpaired.count;
    
    // Count flagged samples (at least one image in the pair is flagged)
    const flaggedSampleIds = new Set<string>();
    const flaggedUnpaired = { count: 0 };
    insightScoop
      .filter((m) =>
        isWellnessFlaggedMedia(
          { analysisResult: m.analysisResult, reviewStatus: m.reviewStatus },
          { requireVisible: false },
        ),
      )
      .forEach((m) => {
        if (m.stoolSampleId) {
          flaggedSampleIds.add(m.stoolSampleId);
        } else {
          flaggedUnpaired.count++;
        }
      });
    const flaggedSamples = flaggedSampleIds.size + flaggedUnpaired.count;
    
    return {
      total: visit.media.length,
      totalImages: insightScoop.length,
      samples: uniqueSamples,
      analyzed,
      flaggedSamples,
      pendingReview,
      approved,
      needsAction,
    };
  }, [visit.media]);
  
  // Determine card accent color based on status
  const cardAccent = useMemo(() => {
    if (mediaStats.needsAction > 0) return "coral";
    if (visit.insight?.wellnessFlag) return "amber";
    if (mediaStats.approved === mediaStats.total && mediaStats.total > 0) return "mint";
    return "default";
  }, [mediaStats, visit.insight]);

  const reviewStatusLabel = useMemo(() => {
    if (!visit.review) return null;
    const status = visit.review.status;
    if (status === "RESOLVED") return { label: "Resolved (payout approved)", color: "mint" };
    if (status === "IN_PROGRESS") return { label: "In progress", color: "gold" };
    return { label: "Open", color: "slate" };
  }, [visit.review]);

  return (
    <div 
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all hover:shadow-md dark:bg-slate-800 ${
        cardAccent === "coral" 
          ? "border-brand-coral/40 hover:border-brand-coral/60" 
          : cardAccent === "amber"
            ? "border-amber-400/40 hover:border-amber-400/60"
            : cardAccent === "mint"
              ? "border-brand-mint/40 hover:border-brand-mint/60"
              : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
      }`}
    >
      {/* Colored top accent bar */}
      <div 
        className={`h-1 w-full ${
          cardAccent === "coral" 
            ? "bg-brand-coral" 
            : cardAccent === "amber"
              ? "bg-amber-400"
              : cardAccent === "mint"
                ? "bg-brand-mint"
                : "bg-slate-200 dark:bg-slate-700"
        }`} 
      />
      
      {/* Header */}
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-base font-semibold text-slate-900 dark:text-white">
              {visit.customer?.name ?? "Customer"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {format(scheduledDate, "EEE, MMM d — h:mm a")}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge 
              className={`text-[10px] capitalize ${
                visit.status === "COMPLETED" 
                  ? "border-brand-mint/30 bg-brand-mint/10 text-brand-mint" 
                  : visit.status === "IN_PROGRESS"
                    ? "border-brand-gold/30 bg-brand-gold/10 text-brand-gold"
                    : "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
              }`}
            >
              {visit.status.toLowerCase().replace("_", " ")}
            </Badge>
            {reviewStatusLabel && (
              <Badge 
                className={`text-[10px] ${
                  reviewStatusLabel.color === "mint"
                    ? "border-brand-mint/30 bg-brand-mint/10 text-brand-mint"
                    : reviewStatusLabel.color === "gold"
                      ? "border-brand-gold/30 bg-brand-gold/10 text-brand-gold"
                      : "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400"
                }`}
              >
                QA: {reviewStatusLabel.label}
              </Badge>
            )}
          </div>
        </div>
        
        {/* Tech name */}
        <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
          Tech: {visit.assignedTo?.name ?? "Unassigned"}
        </p>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-px border-y border-slate-100 bg-slate-100 dark:border-slate-700 dark:bg-slate-700">
        <div className="flex flex-col items-center bg-white py-2 dark:bg-slate-800">
          <span className="text-lg font-bold text-slate-900 dark:text-white">{mediaStats.samples}</span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">Samples</span>
        </div>
        <div className="flex flex-col items-center bg-white py-2 dark:bg-slate-800">
          <span className={`text-lg font-bold ${mediaStats.flaggedSamples > 0 ? "text-brand-coral" : "text-brand-mint"}`}>
            {mediaStats.flaggedSamples > 0 ? mediaStats.flaggedSamples : mediaStats.analyzed}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            {mediaStats.flaggedSamples > 0 ? "Flagged" : "Analyzed"}
          </span>
        </div>
        <div className="flex flex-col items-center bg-white py-2 dark:bg-slate-800">
          <span className={`text-lg font-bold ${
            mediaStats.needsAction > 0 
              ? "text-brand-coral" 
              : mediaStats.pendingReview > 0 
                ? "text-brand-gold" 
                : "text-brand-mint"
          }`}>
            {mediaStats.needsAction > 0 ? mediaStats.needsAction : mediaStats.pendingReview > 0 ? mediaStats.pendingReview : mediaStats.approved}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            {mediaStats.needsAction > 0 ? "Needs action" : mediaStats.pendingReview > 0 ? "Pending" : "Approved"}
          </span>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex flex-1 flex-col justify-between px-4 py-3">
        {/* 3C Summary or insight status */}
        {visit.insight ? (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              {visit.insight.wellnessFlag ? (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-brand-mint" />
              )}
              <span className={`text-xs font-medium ${visit.insight.wellnessFlag ? "text-amber-600 dark:text-amber-400" : "text-brand-mint"}`}>
                {visit.insight.wellnessFlag ? "Wellness flag raised" : "Healthy assessment"}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {visit.insight.colorIndicator && (
                <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  {visit.insight.colorIndicator}
                </span>
              )}
              {visit.insight.consistencyIndicator && (
                <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  {visit.insight.consistencyIndicator}
                </span>
              )}
              {visit.insight.contentIndicator && (
                <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  {visit.insight.contentIndicator}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
            <Camera className="h-3.5 w-3.5" />
            <span>{mediaStats.total > 0 ? `${mediaStats.total} assets captured` : "No media yet"}</span>
          </div>
        )}
        
        {/* Review button */}
        <div className="mt-4">
          <Button 
            size="sm" 
            onClick={onOpen} 
            className={`w-full rounded-xl transition-colors ${
              cardAccent === "coral"
                ? "bg-brand-coral hover:bg-brand-coral/90"
                : cardAccent === "amber"
                  ? "bg-amber-500 hover:bg-amber-600"
                  : "bg-brand-mint hover:bg-brand-mint/90"
            } text-white`}
          >
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            Review visit
          </Button>
        </div>
      </div>
    </div>
  );
}

function VisitDetailDialog({
  visit,
  onClose,
  onUpdateMedia,
  onDeleteMedia,
  onUpdateReview,
}: {
  visit: VisitListItem;
  onClose: () => void;
  onUpdateMedia: (
    mediaId: string,
    updates: Partial<{ reviewStatus: string; visibilityState: string; notes: string | null }>,
  ) => Promise<void>;
  onDeleteMedia: (mediaId: string) => Promise<void>;
  onUpdateReview: (
    visitId: string,
    updates: Partial<{ status: string; summary: string | null }>,
  ) => Promise<void>;
}) {
  const [revealedMedia, setRevealedMedia] = useState<Set<string>>(new Set());
  const [reviewStatusDraft, setReviewStatusDraft] = useState<string>(visit.review?.status ?? "OPEN");
  const [summaryDraft, setSummaryDraft] = useState<string>(visit.review?.summary ?? "");
  const [savingReview, setSavingReview] = useState(false);
  const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null);
  const [updatingNoteId, setUpdatingNoteId] = useState<string | null>(null);

  const toggleReveal = (mediaId: string) => {
    setRevealedMedia((previous) => {
      const next = new Set(previous);
      if (next.has(mediaId)) {
        next.delete(mediaId);
      } else {
        next.add(mediaId);
      }
      return next;
    });
  };

  const handleSaveReview = async () => {
    setSavingReview(true);
    try {
      await onUpdateReview(visit.id, {
        status: reviewStatusDraft,
        summary: summaryDraft.trim() ? summaryDraft.trim() : null,
      });
      toast.success("Visit review saved");
    } catch (error) {
      console.error(error);
    } finally {
      setSavingReview(false);
    }
  };

  const handleModerationNote = async (
    mediaId: string,
    currentNote: string | null | undefined,
  ) => {
    try {
      setUpdatingNoteId(mediaId);
      const nextNote = window.prompt("Moderator note", currentNote ?? "");
      if (nextNote === null) {
        return;
      }
      const trimmed = nextNote.trim();
      await onUpdateMedia(mediaId, { notes: trimmed.length ? trimmed : null });
      toast.success("Moderator note updated");
    } catch (error) {
      console.error("visit-media.note", error);
      toast.error("Unable to update note");
    } finally {
      setUpdatingNoteId(null);
    }
  };

  const handleDeleteMedia = async (mediaId: string) => {
    const confirmed = window.confirm(
      "Delete this media asset? This cannot be undone and will remove it from visit history.",
    );
    if (!confirmed) return;
    try {
      setDeletingMediaId(mediaId);
      await onDeleteMedia(mediaId);
      toast.success("Media deleted");
    } catch (error) {
      console.error("visit-media.delete", error);
      toast.error("Unable to delete media");
    } finally {
      setDeletingMediaId(null);
    }
  };

  return (
    <div className="flex max-h-[85vh] flex-col">
      <DialogHeader className="shrink-0 space-y-1 border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-900">
        <div>
          <DialogTitle className="font-serif text-xl font-semibold text-slate-900 dark:text-white">
            Visit QA — {visit.customer?.name ?? "Customer"}
          </DialogTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Scheduled {format(new Date(visit.scheduledDate), "EEE, MMM d p")} • Tech: {visit.assignedTo?.name ?? "Unassigned"}
          </p>
        </div>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-6 px-6 py-6">
          {visit.insight ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">InsightScoop summary</h3>
                {visit.insight.wellnessFlag ? (
                  <Badge className="gap-1 border border-brand-coral/30 bg-brand-coral/10 text-brand-coral dark:border-brand-coral/40 dark:bg-brand-coral/20">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Flagged
                  </Badge>
                ) : (
                  <Badge className="gap-1 border border-brand-mint/30 bg-brand-mint/10 text-brand-mint dark:border-brand-mint/40 dark:bg-brand-mint/20">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Healthy
                  </Badge>
                )}
              </div>
              <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
                {visit.insight.observations ?? "No additional observations"}
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                3Cs: {visit.insight.colorIndicator ?? "–"} • {visit.insight.consistencyIndicator ?? "–"} • {visit.insight.contentIndicator ?? "–"}
              </p>
              {visit.insight.flagReason ? (
                <p className="mt-2 text-xs text-brand-coral dark:text-brand-coral">{visit.insight.flagReason}</p>
              ) : null}
            </div>
          ) : null}

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Media review ({visit.media.length} assets)</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Click reveal to remove blur on InsightScoop samples.</p>
            </div>
            
            {/* Group InsightScoop samples by stoolSampleId */}
            {(() => {
              // Separate InsightScoop samples from other media
              const insightScoopMedia = visit.media.filter(m => m.assetType === "INSIGHTSCOOP");
              const otherMedia = visit.media.filter(m => m.assetType !== "INSIGHTSCOOP");
              
              // Group InsightScoop by stoolSampleId
              const sampleGroups = new Map<string, VisitMediaItem[]>();
              const ungroupedInsights: VisitMediaItem[] = [];
              
              insightScoopMedia.forEach(media => {
                if (media.stoolSampleId) {
                  const existing = sampleGroups.get(media.stoolSampleId) || [];
                  existing.push(media);
                  sampleGroups.set(media.stoolSampleId, existing);
                } else {
                  ungroupedInsights.push(media);
                }
              });
              
              // Sort each group so SURFACE comes before CROSS_SECTION
              sampleGroups.forEach((group, key) => {
                group.sort((a, b) => {
                  if (a.stoolSampleView === "SURFACE") return -1;
                  if (b.stoolSampleView === "SURFACE") return 1;
                  return 0;
                });
              });
              
              return (
                <>
                  {/* Paired Sample Groups */}
                  {sampleGroups.size > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-mint">
                        Paired Samples ({sampleGroups.size} samples)
                      </h4>
                      <div className="grid gap-4">
                        {Array.from(sampleGroups.entries()).map(([sampleId, group]) => (
                          <div key={sampleId} className="rounded-2xl border-2 border-brand-mint/30 bg-brand-mint/5 p-4 dark:border-brand-mint/20 dark:bg-brand-mint/10">
                            <div className="mb-3 flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-brand-mint" />
                              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                Sample #{sampleId.slice(-6)}
                              </span>
                              <Badge className="border border-brand-mint/30 bg-brand-mint/10 text-brand-mint text-xs">
                                {group.length === 2 ? "Complete" : `${group.length}/2 views`}
                              </Badge>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                              {group.map((media) => {
                                const viewLabel = media.stoolSampleView === "SURFACE" 
                                  ? "Surface View" 
                                  : media.stoolSampleView === "CROSS_SECTION" 
                                    ? "Cross-Section View" 
                                    : "Unknown View";
                                return (
                                  <MediaCard
                                    key={media.id}
                                    media={media}
                                    viewLabel={viewLabel}
                                    revealed={revealedMedia.has(media.id)}
                                    onToggleReveal={() => toggleReveal(media.id)}
                                    onUpdateMedia={onUpdateMedia}
                                    onDeleteMedia={handleDeleteMedia}
                                    onModerationNote={handleModerationNote}
                                    deletingMediaId={deletingMediaId}
                                    updatingNoteId={updatingNoteId}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Ungrouped InsightScoop (no stoolSampleId) */}
                  {ungroupedInsights.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Unpaired Samples ({ungroupedInsights.length})
                      </h4>
                      <div className="grid gap-4 md:grid-cols-2">
                        {ungroupedInsights.map((media) => (
                          <MediaCard
                            key={media.id}
                            media={media}
                            viewLabel={null}
                            revealed={revealedMedia.has(media.id)}
                            onToggleReveal={() => toggleReveal(media.id)}
                            onUpdateMedia={onUpdateMedia}
                            onDeleteMedia={handleDeleteMedia}
                            onModerationNote={handleModerationNote}
                            deletingMediaId={deletingMediaId}
                            updatingNoteId={updatingNoteId}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Categorized Media Sections */}
                  {(() => {
                    // Categorize "other" media by type
                    const gateMedia = otherMedia.filter(m => m.assetType === "GATE");
                    const bagDropMedia = otherMedia.filter(m => m.assetType === "BAG_DROP");
                    const sanitationMedia = otherMedia.filter(m => 
                      m.assetType === "OTHER" && m.notes?.startsWith("SANITATION")
                    );
                    const arrivalMedia = otherMedia.filter(m => m.assetType === "ARRIVAL");
                    const proofMedia = otherMedia.filter(m => m.assetType === "PROOF");
                    const miscMedia = otherMedia.filter(m => 
                      m.assetType !== "GATE" && 
                      m.assetType !== "BAG_DROP" && 
                      m.assetType !== "ARRIVAL" &&
                      m.assetType !== "PROOF" &&
                      !(m.assetType === "OTHER" && m.notes?.startsWith("SANITATION"))
                    );
                    
                    return (
                      <>
                        {/* Gate Photos */}
                        {gateMedia.length > 0 && (
                          <div className="space-y-4">
                            <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                              <DoorOpen className="h-4 w-4" /> Gate Photos ({gateMedia.length})
                            </h4>
                            <div className="grid gap-4 md:grid-cols-2">
                              {gateMedia.map((media) => (
                                <MediaCard
                                  key={media.id}
                                  media={media}
                                  viewLabel={null}
                                  sectionLabel="Gate"
                                  revealed={true}
                                  onToggleReveal={() => {}}
                                  onUpdateMedia={onUpdateMedia}
                                  onDeleteMedia={handleDeleteMedia}
                                  onModerationNote={handleModerationNote}
                                  deletingMediaId={deletingMediaId}
                                  updatingNoteId={updatingNoteId}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Bag Drop Photos */}
                        {bagDropMedia.length > 0 && (
                          <div className="space-y-4">
                            <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                              <PackageCheck className="h-4 w-4" /> Bag Drop ({bagDropMedia.length})
                            </h4>
                            <div className="grid gap-4 md:grid-cols-2">
                              {bagDropMedia.map((media) => (
                                <MediaCard
                                  key={media.id}
                                  media={media}
                                  viewLabel={null}
                                  sectionLabel="Bag Drop"
                                  revealed={true}
                                  onToggleReveal={() => {}}
                                  onUpdateMedia={onUpdateMedia}
                                  onDeleteMedia={handleDeleteMedia}
                                  onModerationNote={handleModerationNote}
                                  deletingMediaId={deletingMediaId}
                                  updatingNoteId={updatingNoteId}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Sanitation Media (includes videos) */}
                        {sanitationMedia.length > 0 && (
                          <div className="space-y-4">
                            <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-coral">
                              <SprayCan className="h-4 w-4" /> Sanitation ({sanitationMedia.length})
                            </h4>
                            <div className="grid gap-4 md:grid-cols-2">
                              {sanitationMedia.map((media) => (
                                <MediaCard
                                  key={media.id}
                                  media={media}
                                  viewLabel={null}
                                  sectionLabel={getSanitationLabel(media.notes)}
                                  revealed={true}
                                  onToggleReveal={() => {}}
                                  onUpdateMedia={onUpdateMedia}
                                  onDeleteMedia={handleDeleteMedia}
                                  onModerationNote={handleModerationNote}
                                  deletingMediaId={deletingMediaId}
                                  updatingNoteId={updatingNoteId}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Arrival Photos */}
                        {arrivalMedia.length > 0 && (
                          <div className="space-y-4">
                            <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                              <Camera className="h-4 w-4" /> Arrival ({arrivalMedia.length})
                            </h4>
                            <div className="grid gap-4 md:grid-cols-2">
                              {arrivalMedia.map((media) => (
                                <MediaCard
                                  key={media.id}
                                  media={media}
                                  viewLabel={null}
                                  sectionLabel="Arrival"
                                  revealed={true}
                                  onToggleReveal={() => {}}
                                  onUpdateMedia={onUpdateMedia}
                                  onDeleteMedia={handleDeleteMedia}
                                  onModerationNote={handleModerationNote}
                                  deletingMediaId={deletingMediaId}
                                  updatingNoteId={updatingNoteId}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Proof of Service Photos */}
                        {proofMedia.length > 0 && (
                          <div className="space-y-4">
                            <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                              <Check className="h-4 w-4" /> Proof of Service ({proofMedia.length})
                            </h4>
                            <div className="grid gap-4 md:grid-cols-2">
                              {proofMedia.map((media) => (
                                <MediaCard
                                  key={media.id}
                                  media={media}
                                  viewLabel={null}
                                  sectionLabel="Proof"
                                  revealed={true}
                                  onToggleReveal={() => {}}
                                  onUpdateMedia={onUpdateMedia}
                                  onDeleteMedia={handleDeleteMedia}
                                  onModerationNote={handleModerationNote}
                                  deletingMediaId={deletingMediaId}
                                  updatingNoteId={updatingNoteId}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Miscellaneous/Other Media */}
                        {miscMedia.length > 0 && (
                          <div className="space-y-4">
                            <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              Other ({miscMedia.length})
                            </h4>
                            <div className="grid gap-4 md:grid-cols-2">
                              {miscMedia.map((media) => (
                                <MediaCard
                                  key={media.id}
                                  media={media}
                                  viewLabel={null}
                                  revealed={true}
                                  onToggleReveal={() => {}}
                                  onUpdateMedia={onUpdateMedia}
                                  onDeleteMedia={handleDeleteMedia}
                                  onModerationNote={handleModerationNote}
                                  deletingMediaId={deletingMediaId}
                                  updatingNoteId={updatingNoteId}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              );
            })()}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Visit review</h3>
              <Select value={reviewStatusDraft} onValueChange={setReviewStatusDraft}>
                <SelectTrigger className="w-[170px] rounded-full border border-slate-300 bg-white pl-4 pr-8 text-sm font-medium text-slate-700 shadow-sm transition hover:border-brand-mint focus-visible:ring-brand-mint/30 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:border-brand-mint">
                  <SelectValue placeholder="Review status" />
                </SelectTrigger>
                <SelectContent className="max-h-64 border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                  <SelectItem value="RESOLVED">Resolved (payout approved)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Textarea
              value={summaryDraft}
              onChange={(event) => setSummaryDraft(event.target.value)}
              placeholder="Summarize QA findings, follow-ups, or escalations for this visit."
              className="mt-3 min-h-[100px] rounded-2xl border-slate-300 bg-slate-50 text-slate-700 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500"
            />
            <div className="mt-4 flex items-center justify-between">
              {/* Reset Visit button - separated from Close/Save for safety */}
              <ResetVisitButton
                visitId={visit.id}
                onReset={() => {
                  onClose();
                  window.location.reload();
                }}
              />
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={onClose} 
                  className="rounded-full border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Close
                </Button>
                <Button 
                  onClick={handleSaveReview} 
                  disabled={savingReview} 
                  className="rounded-full bg-brand-mint text-white hover:bg-brand-mint/90"
                >
                  {savingReview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save QA notes
                </Button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
