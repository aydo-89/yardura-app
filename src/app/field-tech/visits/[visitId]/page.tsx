"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { useRouter } from "next/navigation";
import { endOfDay, format, isAfter, isSameDay } from "date-fns";
import {
  AlertTriangle,
  CalendarDays,
  Camera,
  CheckCircle,
  Check,
  ChevronDown,
  ChevronUp,
  CircleStop,
  DoorClosed,
  Droplet,
  Dog,
  Info,
  KeyRound,
  Loader2,
  MapPin,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme/ThemeProvider";
import { AnimatePresence, motion } from "@/lib/framermotion";

const OPTIONAL_TYPES: VisitMediaType[] = ["ISSUE", "OTHER"];

const SANITATION_SHOES_NOTE = "SANITATION_SHOES" as const;
const SANITATION_TOOLS_NOTE = "SANITATION_TOOLS" as const;
const SANITATION_VIDEO_NOTE = "SANITATION_VIDEO" as const;

const ARRIVAL_CHECK_KEY_PREFIX = "insightscoop-arrival-" as const;
const ARRIVAL_DISTANCE_THRESHOLD_METERS = 150;

const SUPPRESSED_NOTE_PREFIXES = [
  "gate access",
  "community gate",
  "backyard gate",
  "house gate",
  "trash bins",
  "doggy door",
  "dogs outside",
  "okay to work with dogs",
  "work with dogs",
  "access notes",
];

type FrameAlignmentState = "searching" | "aligning" | "locked";

const FRAME_SAMPLE_INTERVAL = 320;
const FRAME_CENTER_RATIO = 0.56;
const FRAME_ALIGN_THRESHOLD = 0.45;
const FRAME_LOCK_THRESHOLD = 0.68;

function clamp(value: number, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

function haversineDistanceMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const R = 6371000; // Earth radius in meters

  const dLat = toRadians(bLat - aLat);
  const dLng = toRadians(bLng - aLng);
  const lat1 = toRadians(aLat);
  const lat2 = toRadians(bLat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);

  const a = sinLat * sinLat + sinLng * sinLng * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function localDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseCheckDate(value: string) {
  if (/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map((part) => Number(part));
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }
  return new Date(value);
}

function isTodayValue(value: string | null | undefined): boolean {
  if (!value) return false;
  const date = parseCheckDate(value);
  if (Number.isNaN(date.getTime())) return false;
  return localDayKey(date) === localDayKey(new Date());
}

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const coerceString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toYesNo = (value: unknown): "yes" | "no" | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized === "yes" || normalized === "no" ? normalized : null;
};

function extractAccessPreferences(source: unknown): AccessPreferences | null {
  if (!isRecord(source)) return null;

  const homeGateRaw = isRecord(source.homeGate) ? source.homeGate : null;
  const communityGateRaw = isRecord(source.communityGate)
    ? source.communityGate
    : null;

  const preferences: AccessPreferences = {
    gateLocation: coerceString(source.gateLocation),
    gateLabel: coerceString(source.gateLabel),
    trashLocation: coerceString(source.trashLocation),
    trashLabel: coerceString(source.trashLabel),
    notes: coerceString(source.notes),
  };

  if (homeGateRaw) {
    preferences.homeGate = {
      hasLock:
        typeof homeGateRaw.hasLock === "boolean"
          ? homeGateRaw.hasLock
          : homeGateRaw.required === true,
      code: coerceString(homeGateRaw.code),
    };
  }

  if (communityGateRaw) {
    preferences.communityGate = {
      required: communityGateRaw.required === true,
      code: coerceString(communityGateRaw.code),
    };
  }

  if (typeof source.requiresGatePhoto === "boolean") {
    preferences.requiresGatePhoto = source.requiresGatePhoto;
  }

  return preferences;
}

function extractDogPreferences(source: unknown): DogPreferences | null {
  if (!isRecord(source)) return null;

  const preferences: DogPreferences = {};
  const dogDoor = toYesNo(source.dogDoor);
  if (dogDoor !== null) {
    preferences.dogDoor = dogDoor;
  }
  const dogsOutside = toYesNo(source.dogsOutside);
  if (dogsOutside !== null) {
    preferences.dogsOutside = dogsOutside;
  }
  const cleanWithDogs = toYesNo(source.cleanWithDogs);
  if (cleanWithDogs !== null) {
    preferences.cleanWithDogs = cleanWithDogs;
  }

  return preferences;
}

function extractDisposalPreferences(
  source: unknown,
): DisposalPreferences | null {
  if (!isRecord(source)) return null;

  const preferences: DisposalPreferences = {
    mode: coerceString(source.mode),
    trashLocation: coerceString(source.trashLocation),
    trashLabel: coerceString(source.trashLabel),
  };

  if (typeof source.requiresBinConfirmation === "boolean") {
    preferences.requiresBinConfirmation = source.requiresBinConfirmation;
  }

  return preferences;
}

function useFrameAlignment(
  videoRef: RefObject<HTMLVideoElement>,
  active: boolean,
) {
  const [status, setStatus] = useState<FrameAlignmentState>("searching");
  const [confidence, setConfidence] = useState(0);
  const samplerRef = useRef<{
    canvas: HTMLCanvasElement | null;
    smoothed: number;
    handle: number | null;
  }>({
    canvas: null,
    smoothed: 0,
    handle: null,
  });
  const lastStatusRef = useRef<FrameAlignmentState>("searching");

  useEffect(() => {
    if (!active) {
      setStatus("searching");
      setConfidence(0);
    }
  }, [active]);

  useEffect(() => {
    if (!active) {
      const sampler = samplerRef.current;
      if (sampler.handle) {
        window.clearInterval(sampler.handle);
        sampler.handle = null;
      }
      return;
    }

    let cancelled = false;
    const sampler = samplerRef.current;
    sampler.smoothed = 0;

    if (!sampler.canvas) {
      sampler.canvas = document.createElement("canvas");
    }

    const canvas = sampler.canvas;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return;
    }

    const sampleFrame = () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (!video || !video.videoWidth || !video.videoHeight) {
        return;
      }

      const width = 224;
      const height =
        Math.floor((video.videoHeight / video.videoWidth) * width) || 224;
      canvas.width = width;
      canvas.height = height;
      context.drawImage(video, 0, 0, width, height);
      const image = context.getImageData(0, 0, width, height);
      const data = image.data;

      const centerMarginX = Math.floor(width * (1 - FRAME_CENTER_RATIO) * 0.5);
      const centerMarginY = Math.floor(height * (1 - FRAME_CENTER_RATIO) * 0.5);
      const centerBounds = {
        xStart: centerMarginX,
        xEnd: width - centerMarginX,
        yStart: centerMarginY,
        yEnd: height - centerMarginY,
      };

      let totalMean = 0;
      let totalCount = 0;
      let centerMean = 0;
      let centerCount = 0;
      let centerVariance = 0;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

          totalMean += luminance;
          totalCount += 1;

          const isCenter =
            x >= centerBounds.xStart &&
            x < centerBounds.xEnd &&
            y >= centerBounds.yStart &&
            y < centerBounds.yEnd;

          if (isCenter) {
            const delta = luminance - centerMean;
            centerMean += delta / (centerCount + 1);
            centerVariance += delta * (luminance - centerMean);
            centerCount += 1;
          }
        }
      }

      if (!totalCount || !centerCount) {
        return;
      }

      const avgLuminance = totalMean / totalCount;
      const outerMean =
        (totalMean - centerMean * centerCount) /
        Math.max(totalCount - centerCount, 1);
      const centerStdDev = Math.sqrt(
        Math.max(centerVariance / Math.max(centerCount - 1, 1), 0),
      );

      const contrast = Math.abs(centerMean - outerMean) / 255;
      const texture = centerStdDev / 128;
      const lightPenalty = avgLuminance < 30 ? (30 - avgLuminance) / 60 : 0;

      const rawScore = clamp(
        contrast * 0.65 + texture * 0.45 - lightPenalty * 0.4,
      );
      sampler.smoothed = clamp(sampler.smoothed * 0.75 + rawScore * 0.25);

      const nextStatus: FrameAlignmentState =
        sampler.smoothed > FRAME_LOCK_THRESHOLD
          ? "locked"
          : sampler.smoothed > FRAME_ALIGN_THRESHOLD
            ? "aligning"
            : "searching";

      if (nextStatus !== lastStatusRef.current) {
        lastStatusRef.current = nextStatus;
        setStatus(nextStatus);
      }

      setConfidence((prev) =>
        Math.abs(prev - sampler.smoothed) < 0.03 ? prev : sampler.smoothed,
      );
    };

    sampler.handle = window.setInterval(sampleFrame, FRAME_SAMPLE_INTERVAL);

    return () => {
      cancelled = true;
      if (sampler.handle) {
        window.clearInterval(sampler.handle);
        sampler.handle = null;
      }
    };
  }, [active, videoRef]);

  return { status, confidence };
}

const COLOR_CHOICES = ["Normal", "Dark", "Light", "Mixed", "Other"];
const CONSISTENCY_CHOICES = ["Firm", "Soft", "Loose", "Watery", "Other"];
const CONTENT_CHOICES = [
  "Typical",
  "Mucus",
  "Blood",
  "Foreign material",
  "Other",
];

type VisitStatus =
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "SKIPPED";

type VisitMediaType =
  | "ARRIVAL"
  | "INSIGHTSCOOP"
  | "PROOF"
  | "GATE"
  | "BAG_DROP"
  | "ISSUE"
  | "OTHER";

type AccessPreferences = {
  gateLocation?: string | null;
  gateLabel?: string | null;
  homeGate?: {
    hasLock?: boolean;
    code?: string | null;
  } | null;
  communityGate?: {
    required?: boolean;
    code?: string | null;
  } | null;
  trashLocation?: string | null;
  trashLabel?: string | null;
  notes?: string | null;
  requiresGatePhoto?: boolean;
};

type DogPreferences = {
  dogDoor?: "yes" | "no" | null;
  dogsOutside?: "yes" | "no" | null;
  cleanWithDogs?: "yes" | "no" | null;
};

type DisposalPreferences = {
  mode?: string | null;
  trashLocation?: string | null;
  trashLabel?: string | null;
  requiresBinConfirmation?: boolean;
};

type HighlightItem = {
  key: string;
  icon: ReactNode;
  label: string;
  description: string;
};

type MediaAnalysisStatus =
  | "NOT_REQUESTED"
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "NEEDS_REVIEW";

type AnalysisResultPayload = {
  color?: string;
  consistency?: string;
  content?: string;
  confidence?: number;
  observations?: string | null;
  needs_review?: boolean;
  wellness_flag?: boolean;
  flag_reason?: string | null;
};

const ANALYSIS_STATUS_META: Record<
  MediaAnalysisStatus,
  { label: string; tone: "default" | "success" | "warning" | "danger" }
> = {
  NOT_REQUESTED: { label: "Analysis not requested", tone: "default" },
  PENDING: { label: "Queued for analysis", tone: "default" },
  IN_PROGRESS: { label: "Analyzing…", tone: "default" },
  COMPLETED: { label: "Auto-classified", tone: "success" },
  FAILED: { label: "Analysis failed", tone: "danger" },
  NEEDS_REVIEW: { label: "Needs review", tone: "warning" },
};

const STATUS_TONE_CLASS: Record<
  "default" | "success" | "warning" | "danger",
  string
> = {
  default: "text-slate-600 dark:text-white/70",
  success: "text-emerald-300",
  warning: "text-amber-300",
  danger: "text-red-300",
};

type VisitMedia = {
  id: string;
  assetType: VisitMediaType;
  capturedAt: string;
  notes: string | null;
  analysisStatus: MediaAnalysisStatus;
  analysisModel: string | null;
  analysisConfidence: number | null;
  analysisRequestedAt?: string | null;
  analysisCompletedAt?: string | null;
  analysisError?: string | null;
  analysisResult?: AnalysisResultPayload | null;
  url?: string | null;
  stoolSampleId?: string | null;
  stoolSampleView?: "SURFACE" | "CROSS_SECTION" | null;
};

type VisitStep =
  | "arrival"
  | "gear"
  | "setup"
  | "capture"
  | "confirm"
  | "bag_drop"
  | "gate"
  | "sanitation"
  | "review"
  | "notify";

type VisitDetail = {
  id: string;
  scheduledDate: string;
  status: VisitStatus;
  customer: {
    name: string | null;
    email: string | null;
    phone: string | null;
    addressLine1: string | null;
    city: string | null;
    state?: string | null;
    zip?: string | null;
    notes?: string | null;
  } | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  job?: {
    id: string;
    frequency: string;
    billingPlan?: {
      metadata: Record<string, unknown> | null;
    } | null;
  } | null;
  media: VisitMedia[];
  insights: Array<{
    colorIndicator: string;
    consistencyIndicator: string;
    contentIndicator: string;
    observations: string | null;
    wellnessFlag: boolean;
    flagReason: string | null;
    source: "MANUAL" | "AUTOMATED";
    sourceMediaId: string | null;
    autoConfidence: number | null;
    analysisModel: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  geo?: {
    latitude: number;
    longitude: number;
    source: string;
  } | null;
  routeStop?: {
    actualArrival: string | null;
  } | null;
};

type StoolSampleViewTypeState = "SURFACE" | "CROSS_SECTION";

type InsightsCaptureStationProps = {
  capturedCount: number;
  uploading: boolean;
  onUpload: (
    file: File,
    options?: {
      analysisMode?: "log_only" | "analyze";
      stoolSampleId?: string;
      stoolSampleView?: StoolSampleViewTypeState;
    },
  ) => Promise<void>;
  autoLaunch?: boolean;
  onOverlayClosed?: () => void;
};

type SummarySnapshot = {
  color?: string;
  consistency?: string;
  content?: string;
  observations?: string;
  totalSamples?: number;
  flaggedSampleIndices?: number[];
  flaggedSampleReasons?: string[];
  wellnessFlag?: boolean;
  flagReason?: string | null;
};

const VISIT_SUMMARY_POLL_INTERVAL_MS = 2000;
const VISIT_SUMMARY_MAX_ATTEMPTS = 60;

async function pollVisitSummaryJob(visitId: string, jobId: string) {
  const pollUrl = `/api/field-tech/visits/${visitId}/generate-summary?jobId=${encodeURIComponent(jobId)}`;

  for (let attempt = 0; attempt < VISIT_SUMMARY_MAX_ATTEMPTS; attempt++) {
    const response = await fetch(pollUrl, {
      credentials: "include",
    });

    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      message?: string;
      data?: {
        status?: string;
        result?: any;
        error?: string | null;
      };
    };

    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.error || payload?.message || "Failed to check summary status");
    }

    const status = payload.data;
    if (!status) {
      throw new Error("Invalid summary job status response");
    }

    if (status.status === "completed" && status.result) {
      return status.result;
    }

    if (status.status === "failed") {
      throw new Error(status.error || "Summary generation failed");
    }

    await new Promise((resolve) => setTimeout(resolve, VISIT_SUMMARY_POLL_INTERVAL_MS));
  }

  throw new Error("Summary generation timed out. Please try again.");
}

function SinglePhotoCamera({
  onCapture,
  label,
  capturedImageUrl,
  uploading,
  defaultFacing = "environment",
}: {
  onCapture: (file: File) => Promise<void>;
  label: string;
  capturedImageUrl?: string | null;
  uploading: boolean;
  defaultFacing?: "environment" | "user";
}) {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [showOverlayHints, setShowOverlayHints] = useState(false);
  const [preferredFacing, setPreferredFacing] = useState<
    "environment" | "user"
  >(defaultFacing);
  const [zoom, setZoom] = useState(defaultFacing === "user" ? 1.18 : 1.04);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const { status: alignmentStatus, confidence: alignmentConfidence } =
    useFrameAlignment(
      videoRef,
      isCameraActive && videoReady && !showOverlayHints,
    );

  const stopCamera = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
    setVideoReady(false);
    setIsCameraActive(false);
    setInitializing(false);
    setShowOverlayHints(false);
  }, []);

  const startCamera = useCallback(
    async (facing: "environment" | "user" = preferredFacing) => {
      if (initializing) return;
      setInitializing(true);
      setVideoReady(false);

      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        toast.error("Camera not supported on this device");
        setInitializing(false);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
          },
          audio: false,
        });
        streamRef.current = stream;
        setPreferredFacing(facing);
        setZoom(facing === "user" ? 1.18 : 1.04);
        setIsCameraActive(true);
        setShowOverlayHints(true);
      } catch (err) {
        console.error("Camera error", err);
        toast.error("Unable to access camera. Check permissions.");
        stopCamera();
      } finally {
        setInitializing(false);
      }
    },
    [initializing, preferredFacing, stopCamera],
  );

  useEffect(() => stopCamera, [stopCamera]);

  useEffect(() => {
    if (!isCameraActive || !videoRef.current || !streamRef.current) {
      return;
    }

    const video = videoRef.current;
    const stream = streamRef.current;
    video.srcObject = stream;
    video.setAttribute("playsinline", "true");
    video.muted = true;

    let cancelled = false;
    const ensureReady = () => {
      if (cancelled) return;
      if (video.videoWidth && video.videoHeight) {
        setVideoReady(true);
      } else {
        requestAnimationFrame(ensureReady);
      }
    };

    const playPromise = video.play();
    if (playPromise) {
      playPromise.catch((err) => {
        console.warn("Camera playback blocked", err);
      });
    }

    ensureReady();

    return () => {
      cancelled = true;
    };
  }, [isCameraActive]);

  const captureAndClose = useCallback(async () => {
    if (!videoRef.current || !videoReady) {
      toast.error("Camera not ready");
      return;
    }

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      toast.error("Unable to capture photo");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((result) => resolve(result), "image/jpeg", 0.92),
    );

    if (!blob) {
      toast.error("Capture failed. Try again.");
      return;
    }

    const file = new File([blob], `photo-${Date.now()}.jpg`, {
      type: blob.type || "image/jpeg",
    });

    stopCamera();
    await onCapture(file);
  }, [onCapture, stopCamera, videoReady]);

  const handleFlipCamera = useCallback(() => {
    const next = preferredFacing === "environment" ? "user" : "environment";
    stopCamera();
    void startCamera(next);
  }, [preferredFacing, startCamera, stopCamera]);

  const handleZoomChange = (nextValue: number) => {
    setZoom((prev) => {
      const target = Number.isFinite(nextValue) ? nextValue : prev;
      return clamp(target, 0.9, 2.4);
    });
  };

  const alignmentMessage =
    alignmentStatus === "locked"
      ? "Framing locked"
      : alignmentStatus === "aligning"
        ? "Adjust within the border"
        : "Center within the guide";

  const overlayColor =
    alignmentStatus === "locked"
      ? "border-emerald-400"
      : alignmentStatus === "aligning"
        ? "border-amber-300"
        : "border-white/30";

  const normalizedLabel = label.toLowerCase();
  const captureTips = (() => {
    if (normalizedLabel.includes("gear")) {
      return [
        "Step back so your full uniform is visible.",
        "Keep the InsightScoop badge readable.",
        "Smile — this shows professionalism to the customer.",
      ];
    }
    if (normalizedLabel.includes("proof")) {
      return [
        "Frame yourself, the filled bag, and disposal bin.",
        "Keep the bag seal visible for a clean hand-off.",
        "Avoid harsh backlighting to keep the proof crisp.",
      ];
    }
    if (normalizedLabel.includes("gate")) {
      return [
        "Stand square to the gate and fill the frame.",
        "Show the latch fully closed and any locks secured.",
        "Include a glimpse of the yard beyond the gate.",
      ];
    }
    return [
      "Keep the subject centered inside the border.",
      "Fill the guide — edge-to-edge coverage looks best.",
      "Hold steady for a sharp capture.",
      "After AI runs, break open the sample and capture the cross-section view.",
    ];
  })();

  if (isCameraActive) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white">
        <header className="flex items-center justify-between px-4 pb-2 pt-3 text-xs uppercase tracking-wide text-white/70">
          <Button
            variant="ghost"
            size="sm"
            className="text-white/70 hover:text-white"
            onClick={stopCamera}
          >
            Cancel
          </Button>
          <span className="text-[11px] font-semibold text-white">{label}</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-white/80 hover:text-white"
            onClick={handleFlipCamera}
          >
            Flip
          </Button>
        </header>
        <div className="relative flex-1 overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover transition-transform duration-200"
            style={{ transform: `scale(${zoom})` }}
          />
          {!showOverlayHints && (
            <div
              className={`pointer-events-none absolute inset-[6%] rounded-3xl border-4 ${overlayColor} transition-colors duration-200`}
            >
              <div className="absolute inset-4 rounded-2xl border border-white/25" />
              <div className="absolute left-1/2 bottom-4 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-4 py-1 text-[11px] font-semibold uppercase tracking-wide">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${alignmentStatus === "locked" ? "bg-emerald-400" : alignmentStatus === "aligning" ? "bg-amber-300" : "bg-white/60"}`}
                />
                <span>{alignmentMessage}</span>
                <span className="text-white/50">
                  {Math.round(alignmentConfidence * 100)}%
                </span>
              </div>
            </div>
          )}
          {showOverlayHints ? (
            <div className="absolute inset-0 bg-slate-950/85 px-6 py-8 backdrop-blur-sm">
              <div className="mx-auto flex h-full max-w-sm flex-col justify-center gap-5">
                <h2 className="text-lg font-semibold text-white">
                  Frame it like a pro
                </h2>
                <ul className="space-y-3 text-sm text-emerald-100">
                  {captureTips.map((tip) => (
                    <li
                      key={tip}
                      className="flex items-start gap-2 rounded-2xl bg-emerald-500/10 px-3 py-2"
                    >
                      <Sparkles className="mt-0.5 h-4 w-4 text-emerald-300" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant="secondary"
                  className="self-start rounded-full bg-emerald-500 px-5 text-slate-950 shadow-lg hover:bg-emerald-400"
                  onClick={() => setShowOverlayHints(false)}
                >
                  I’m lined up
                </Button>
              </div>
            </div>
          ) : null}
          {!videoReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/70">
              <Loader2 className="h-10 w-10 animate-spin text-white" />
              <span className="text-xs text-white/70">Starting camera…</span>
            </div>
          )}
        </div>
        <div className="space-y-3 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
          {!showOverlayHints ? (
            <div className="flex items-center gap-3 rounded-full bg-white/10 px-4 py-3">
              <span className="text-[11px] uppercase tracking-wide text-white/60">
                Zoom
              </span>
              <input
                type="range"
                min={0.9}
                max={2.4}
                step={0.05}
                value={zoom}
                onChange={(event) =>
                  handleZoomChange(Number(event.target.value))
                }
                className="flex-1 accent-emerald-400"
              />
              <span className="text-xs font-semibold text-white/70">
                {zoom.toFixed(1)}x
              </span>
            </div>
          ) : null}
          <div className="grid grid-cols-5 gap-2">
            <Button
              onClick={stopCamera}
              variant="outline"
              className="col-span-2 h-14 rounded-2xl border border-white/20 bg-white/10 text-white transition hover:border-emerald-400/60 hover:bg-emerald-500/20 hover:text-emerald-100"
            >
              Exit
            </Button>
            <Button
              onClick={captureAndClose}
              className="col-span-3 h-14 bg-emerald-500 text-slate-950 hover:bg-emerald-400"
              disabled={!videoReady}
            >
              <Camera className="mr-2 h-5 w-5" />
              Save capture
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (capturedImageUrl) {
    return (
      <div className="flex flex-col gap-3">
        <div className="relative w-full overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-slate-900/60">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={capturedImageUrl}
            alt={label}
            className="h-full w-full object-cover"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-slate-300 bg-white text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:border-emerald-400/60 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-100"
          onClick={() => void startCamera(preferredFacing)}
          disabled={uploading || initializing}
        >
          {initializing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting camera…
            </>
          ) : (
            "Retake"
          )}
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={() => void startCamera(preferredFacing)}
      className="h-32 w-full rounded-3xl border border-slate-300 bg-slate-100 text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:border-emerald-400/60 dark:hover:bg-emerald-500/15 dark:hover:text-emerald-100"
      variant="ghost"
      disabled={uploading || initializing}
    >
      {uploading ? (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Uploading…
        </>
      ) : initializing ? (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Starting camera…
        </>
      ) : (
        <>
          <Camera className="mr-2 h-5 w-5" /> Capture {label}
        </>
      )}
    </Button>
  );
}

function InsightsCaptureStation({
  capturedCount,
  uploading,
  onUpload,
  autoLaunch = false,
  onOverlayClosed,
}: InsightsCaptureStationProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isOverlayOpen, setOverlayOpen] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [pendingModes, setPendingModes] = useState<
    Array<"log_only" | "analyze">
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [showCaptureTips, setShowCaptureTips] = useState(false);
  const [lastCaptureMode, setLastCaptureMode] = useState<
    "log_only" | "analyze" | null
  >(null);
  const [lastCaptureTime, setLastCaptureTime] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1.08);
  const autoLaunchRef = useRef(false);
  const shutterTimeoutRef = useRef<number | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [testCaptureCount, setTestCaptureCount] = useState(0);
  const [pendingCrossSection, setPendingCrossSection] = useState<
    { sampleId: string } | null
  >(null);

  const generateSampleId = useCallback(() => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    return Math.random().toString(36).slice(2);
  }, []);

  const { status: alignmentStatus, confidence: alignmentConfidence } =
    useFrameAlignment(
      videoRef,
      isCameraActive && videoReady && !showCaptureTips,
    );

  const overlayColor =
    alignmentStatus === "locked"
      ? "border-emerald-400"
      : alignmentStatus === "aligning"
        ? "border-amber-300"
        : "border-white/30";

  const alignmentMessage =
    alignmentStatus === "locked"
      ? "Frame locked"
      : alignmentStatus === "aligning"
        ? "Almost there"
        : "Fill the guide";

  const stopCamera = useCallback(() => {
    if (shutterTimeoutRef.current) {
      window.clearTimeout(shutterTimeoutRef.current);
      shutterTimeoutRef.current = null;
    }

    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    const video = videoRef.current;
    if (video) {
      try {
        video.pause();
      } catch (pauseError) {
        console.warn("Insights camera pause warning", pauseError);
      }
      video.srcObject = null;
    }
    setMediaStream(null);
    setVideoReady(false);
    setIsCameraActive(false);
    setInitializing(false);
    setZoom(1.08);
  }, []);

  const queueUpload = useCallback(
    async (
      file: File,
      context: {
        mode: "log_only" | "analyze";
        sampleId?: string;
        view?: StoolSampleViewTypeState;
      },
    ) => {
      setPendingModes((prev) => [...prev, context.mode]);
      setLastCaptureMode(context.mode);
      setLastCaptureTime(Date.now());
      try {
        await onUpload(file, {
          analysisMode: context.mode,
          stoolSampleId: context.sampleId,
          stoolSampleView: context.view,
        });
      } finally {
        setPendingModes((prev) => {
          const next = [...prev];
          const idx = next.indexOf(context.mode);
          if (idx > -1) {
            next.splice(idx, 1);
          } else {
            next.shift();
          }
          return next;
        });
      }
    },
    [onUpload],
  );

  const captureFrame = useCallback(
    async (
      mode: "log_only" | "analyze" = "analyze",
      options?: {
        sampleId?: string;
        view?: StoolSampleViewTypeState;
        skipPairing?: boolean;
      },
    ) => {
      if (!isCameraActive || !videoRef.current) {
        toast.error("Start the insights camera before capturing.");
        return;
      }
      if (!videoReady) {
        toast.error("Camera feed is still loading.");
        return;
      }

      if (pendingCrossSection && mode === "analyze" && !options?.sampleId) {
        toast.error("Finish the pending cross-section before logging a new sample.");
        return;
      }

      if (testMode) {
        setTestCaptureCount((prev) => prev + 1);
        toast.success(
          mode === "analyze"
            ? `✅ Test capture ${testCaptureCount + 1} (with AI analysis)`
            : `✅ Test capture ${testCaptureCount + 1} (log only)`,
          { duration: 2000 },
        );
        return;
      }

      const video = videoRef.current;
      if (!video.videoWidth || !video.videoHeight) {
        toast.error("Camera feed is still loading.");
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        toast.error("Unable to capture photo.");
        return;
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((result) => resolve(result), "image/jpeg", 0.92),
      );
      if (!blob) {
        toast.error("Capture failed. Try again.");
        return;
      }
      const file = new File([blob], `insight-${Date.now()}.jpg`, {
        type: blob.type || "image/jpeg",
      });

      const sampleId = options?.sampleId ?? (mode === "analyze" ? generateSampleId() : undefined);
      const view: StoolSampleViewTypeState = options?.view ?? "SURFACE";

      await queueUpload(file, {
        mode,
        sampleId,
        view,
      });

      if (mode === "analyze" && sampleId && !options?.skipPairing) {
        setPendingCrossSection({ sampleId });
        toast.info("Break open the sample and capture the cross-section next.");
      }
    },
    [
      generateSampleId,
      isCameraActive,
      pendingCrossSection,
      queueUpload,
      testCaptureCount,
      testMode,
      videoReady,
    ],
  );

  const startCamera = useCallback(async () => {
    if (initializing || isCameraActive) {
      return;
    }
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setError("Camera not supported on this device.");
      toast.error("Camera not supported on this device.");
      return;
    }
    try {
      setInitializing(true);
      setError(null);
      setVideoReady(false);
      setZoom(1.08);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setMediaStream(stream);
      setIsCameraActive(true);
    } catch (err) {
      console.error("Failed to start insights camera", err);
      setError("Unable to access camera. Check browser permissions.");
      toast.error("Unable to access camera. Check permissions.");
      stopCamera();
      setOverlayOpen(false);
    } finally {
      setInitializing(false);
    }
  }, [initializing, isCameraActive, stopCamera]);

  const handleOpenOverlay = useCallback(() => {
    setOverlayOpen(true);
    setShowCaptureTips(true);
    void startCamera();
  }, [startCamera]);

  const handleCloseOverlay = useCallback(() => {
    if (pendingCrossSection) {
      toast.error("Capture the cross-section before closing the camera.");
      return;
    }
    setOverlayOpen(false);
    setShowCaptureTips(false);
    stopCamera();
    onOverlayClosed?.();
  }, [onOverlayClosed, pendingCrossSection, stopCamera]);

  const captureCrossSection = useCallback(async () => {
    if (!pendingCrossSection) {
      return;
    }
    try {
      await captureFrame("log_only", {
        sampleId: pendingCrossSection.sampleId,
        view: "CROSS_SECTION",
        skipPairing: true,
      });
      setPendingCrossSection(null);
      toast.success("Cross-section saved");
    } catch (error) {
      console.error("cross-section.capture", error);
    }
  }, [captureFrame, pendingCrossSection]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    if (!isOverlayOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleCloseOverlay();
      } else if (event.key === "Enter") {
        event.preventDefault();
        if (pendingCrossSection) {
          void captureCrossSection();
        } else {
          void captureFrame("analyze");
        }
      } else if (event.key === " ") {
        event.preventDefault();
        if (pendingCrossSection) {
          void captureCrossSection();
        } else {
          void captureFrame("log_only");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [captureCrossSection, captureFrame, handleCloseOverlay, isOverlayOpen, pendingCrossSection]);

  const handleShutterTrigger = useCallback(() => {
    if (pendingCrossSection) {
      void captureCrossSection();
      return;
    }
    if (shutterTimeoutRef.current) {
      window.clearTimeout(shutterTimeoutRef.current);
      shutterTimeoutRef.current = null;
      void captureFrame("analyze");
      return;
    }

    shutterTimeoutRef.current = window.setTimeout(() => {
      shutterTimeoutRef.current = null;
      void captureFrame("log_only");
    }, 325);
  }, [captureCrossSection, captureFrame, pendingCrossSection]);

  useEffect(() => {
    if (!isCameraActive) {
      return;
    }
    window.addEventListener("native-shutter", handleShutterTrigger);
    return () =>
      window.removeEventListener("native-shutter", handleShutterTrigger);
  }, [handleShutterTrigger, isCameraActive]);

  useEffect(() => {
    const video = videoRef.current;
    if (!isCameraActive || !mediaStream || !video) {
      return;
    }
    video.srcObject = mediaStream;
    video.setAttribute("playsinline", "true");
    video.muted = true;

    let cancelled = false;
    const ensureReady = () => {
      if (cancelled) return;
      if (video.videoWidth && video.videoHeight) {
        setVideoReady(true);
      } else {
        requestAnimationFrame(ensureReady);
      }
    };

    const playPromise = video.play();
    if (playPromise) {
      playPromise.catch((err) => {
        console.warn("Insights camera playback blocked", err);
      });
    }

    ensureReady();

    return () => {
      cancelled = true;
    };
  }, [isCameraActive, mediaStream]);

  useEffect(() => {
    if (autoLaunch && !autoLaunchRef.current) {
      autoLaunchRef.current = true;
      handleOpenOverlay();
    }
    if (!autoLaunch) {
      autoLaunchRef.current = false;
    }
  }, [autoLaunch, handleOpenOverlay]);

  const totalCaptured = capturedCount + pendingModes.length;
  const analyzingPending = pendingModes.filter(
    (mode) => mode === "analyze",
  ).length;
  const loggingPending = pendingModes.length - analyzingPending;
  const lastCaptureLabel = lastCaptureMode
    ? lastCaptureMode === "analyze"
      ? "Logged + analyzing"
      : "Logged without analysis"
    : null;

  const handleSwitchToLive = useCallback(() => {
    setTestMode(false);
    setTestCaptureCount(0);
    toast.success("Switched to live capture mode");
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              Deposits captured
            </span>
            <span className="text-xs text-slate-500 dark:text-white/60">
              Single press logs; double press runs AI and then prompts for a cross-section capture.
            </span>
          </div>
          <Badge
            variant={totalCaptured > 0 ? "default" : "secondary"}
            className="bg-white/10 text-slate-600 dark:text-white/70"
          >
            {totalCaptured} saved
          </Badge>
        </div>
        {lastCaptureLabel ? (
          <span className="text-xs text-emerald-300">
            Last capture: {lastCaptureLabel}
            {lastCaptureTime ? " — moments ago" : ""}
          </span>
        ) : null}
        {pendingCrossSection ? (
          <div className="rounded-2xl border border-amber-400/40 bg-amber-500/15 p-3 text-xs text-amber-100">
            <p className="font-semibold text-amber-200">
              Cross-section needed
            </p>
            <p>
              Break open the logged deposit and capture the inside view next. Use any shutter control when ready.
            </p>
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          <Button onClick={handleOpenOverlay} disabled={initializing}>
            {initializing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing
                camera…
              </>
            ) : (
              <>
                <Camera className="mr-2 h-4 w-4" /> Launch Insights camera
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="border border-amber-200 bg-amber-50 text-amber-800 transition hover:border-amber-300 hover:bg-amber-100 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:border-amber-400/50 dark:hover:bg-amber-500/20"
            onClick={() => {
              setTestMode(true);
              setTestCaptureCount(0);
              handleOpenOverlay();
            }}
          >
            <Sparkles className="mr-2 h-4 w-4" /> Test camera setup
          </Button>
        </div>
        <div className="space-y-1 text-[11px] leading-relaxed text-slate-600 dark:text-white/60">
          <p className="font-semibold text-slate-700 dark:text-white/80">
            Pre-flight checklist
          </p>
          <p>
            1. Tap <span className="font-semibold">Test camera setup</span> and fire
            both shutter modes: single press (log only) and double press
            (log + analyze).
          </p>
          <p>
            2. Make sure the Bluetooth remote triggers each mode so you are ready
            for hands-free captures.
          </p>
          <p>
            3. After test mode looks good, switch back to live captures and keep
            the bucket centered as you glide corner-to-corner.
          </p>
        </div>
      </div>

      {isOverlayOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white">
          <header className="flex items-center justify-between px-4 pb-2 pt-3 text-xs uppercase tracking-wide text-white/70">
            <div className="flex flex-col gap-1">
              {testMode ? (
                <>
                  <span className="text-[11px] font-semibold text-amber-300">
                    🧪 Test Mode Active
                  </span>
                  <span className="text-[10px] text-amber-400/70">
                    {testCaptureCount} test captures · Not saved
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[11px] font-semibold text-white/80">
                    Insights capture
                  </span>
                  <span className="text-[10px] text-white/50">
                    Single press logs · Double press logs & analyzes
                  </span>
                </>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full border border-white/15 bg-white/10 px-3 text-white/80 transition hover:border-emerald-400/60 hover:bg-emerald-500/25 hover:text-emerald-100"
              onClick={handleCloseOverlay}
            >
              Close
            </Button>
          </header>
          <div className="relative flex-1 overflow-hidden">
            <video
              ref={videoRef}
              className="h-full w-full object-cover transition-transform duration-200"
              playsInline
              muted
              style={{ transform: `scale(${zoom})` }}
            />
            {!showCaptureTips && (
              <div
                className={`pointer-events-none absolute inset-[5%] rounded-3xl border-4 ${overlayColor} transition-colors duration-200`}
              >
                <div className="absolute inset-4 rounded-2xl border border-white/25" />
                <div className="absolute left-1/2 bottom-4 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-4 py-1 text-[11px] font-semibold uppercase tracking-wide">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      alignmentStatus === "locked"
                        ? "bg-emerald-400"
                        : alignmentStatus === "aligning"
                          ? "bg-amber-300"
                          : "bg-white/60"
                    }`}
                  />
                  <span>{alignmentMessage}</span>
                  <span className="text-white/50">
                    {Math.round(alignmentConfidence * 100)}%
                  </span>
                </div>
              </div>
            )}
            {showCaptureTips ? (
              <div className="absolute inset-0 flex flex-col justify-center gap-5 bg-slate-950/92 px-6 py-8 backdrop-blur-sm">
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-white">
                    Frame the scooper perfectly
                  </h2>
                  <ul className="space-y-3 text-sm text-white/90">
                    <li className="flex items-start gap-3 rounded-2xl bg-emerald-500/10 border border-emerald-400/20 px-4 py-3">
                      <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-300" />
                      <span className="leading-relaxed">Seat the phone in the mount and fill the border with the bucket.</span>
                    </li>
                    <li className="flex items-start gap-3 rounded-2xl bg-emerald-500/10 border border-emerald-400/20 px-4 py-3">
                      <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-300" />
                      <span className="leading-relaxed">Log freshest deposits first so the AI sees the clearest material.</span>
                    </li>
                    <li className="flex items-start gap-3 rounded-2xl bg-emerald-500/10 border border-emerald-400/20 px-4 py-3">
                      <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-300" />
                      <span className="leading-relaxed">Single press Bluetooth to log; double press to log + run AI instantly.</span>
                    </li>
                    <li className="flex items-start gap-3 rounded-2xl bg-emerald-500/10 border border-emerald-400/20 px-4 py-3">
                      <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-300" />
                      <span className="leading-relaxed">Reset the scooper between captures so each sample is isolated.</span>
                    </li>
                  </ul>
                </div>
                <Button
                  variant="secondary"
                  className="w-full rounded-full bg-emerald-500 py-6 text-base font-semibold text-slate-950 shadow-lg hover:bg-emerald-400"
                  onClick={() => setShowCaptureTips(false)}
                >
                  I'm ready — Start capturing
                </Button>
              </div>
            ) : null}
            {(!videoReady || initializing) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/75">
                <Loader2 className="h-9 w-9 animate-spin" />
                <span className="text-xs text-slate-600 dark:text-white/70">Preparing camera…</span>
              </div>
            )}
            {error ? (
              <div className="absolute inset-x-0 bottom-6 mx-6 rounded-xl border border-red-400/40 bg-red-500/15 p-3 text-center text-[11px] text-red-200">
                {error}
              </div>
            ) : null}
          </div>
          <div className="space-y-4 bg-slate-950/95 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
            {!showCaptureTips ? (
              <div className="flex items-center gap-3 rounded-full bg-white/10 px-4 py-3">
                <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-white/60">
                  Zoom
                </span>
                <input
                  type="range"
                  min={0.9}
                  max={2.2}
                  step={0.05}
                  value={zoom}
                  onChange={(event) =>
                    setZoom(clamp(Number(event.target.value), 0.9, 2.4))
                  }
                  className="flex-1 accent-emerald-400"
                />
                <span className="text-xs font-semibold text-slate-600 dark:text-white/70">
                  {zoom.toFixed(1)}x
                </span>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-white/70">
              <span className="font-semibold uppercase tracking-wide">
                Captured: {capturedCount}
              </span>
              {pendingModes.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  {analyzingPending > 0 ? (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-400/15 px-3 py-1 font-semibold text-emerald-200">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      AI analyzing ({analyzingPending})
                    </span>
                  ) : null}
                  {loggingPending > 0 ? (
                    <span className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 font-semibold text-slate-600 dark:text-white/70">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading ({loggingPending})
                    </span>
                  ) : null}
                </div>
              ) : uploading ? (
                <span>Saving images…</span>
              ) : (
                <span className="text-white/40">Standing by</span>
              )}
            </div>
        <div className="grid grid-cols-2 gap-3">
          {pendingCrossSection ? (
            <Button
              onClick={() => void captureCrossSection()}
              disabled={!videoReady || initializing || showCaptureTips}
              className="col-span-2 h-14 rounded-2xl bg-amber-400 text-amber-950 hover:bg-amber-300"
            >
              <CircleStop className="mr-2 h-5 w-5" /> Capture cross-section
            </Button>
          ) : (
            <>
              <Button
                onClick={() => void captureFrame("log_only")}
                disabled={!videoReady || initializing || showCaptureTips}
                className="h-14 rounded-2xl border border-white/20 bg-white/10 text-white transition hover:border-emerald-400/60 hover:bg-emerald-500/25 hover:text-emerald-100"
              >
                <CircleStop className="mr-2 h-5 w-5" /> Log pickup
              </Button>
              <Button
                onClick={() => void captureFrame("analyze")}
                disabled={!videoReady || initializing || showCaptureTips}
                className="h-14 rounded-2xl bg-emerald-500 text-slate-950 hover:bg-emerald-400"
              >
                <Sparkles className="mr-2 h-5 w-5" /> Log + Analyze
              </Button>
            </>
          )}
        </div>
            {testMode && testCaptureCount > 0 ? (
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
                <p className="text-sm font-semibold text-emerald-200 mb-2">
                  ✅ Setup verified! {testCaptureCount} test capture{testCaptureCount > 1 ? "s" : ""} completed.
                </p>
                <p className="text-xs text-emerald-300/70 mb-3">
                  Your camera, mount, and Bluetooth remote are working perfectly. Ready to start logging real deposits?
                </p>
                <Button
                  onClick={handleSwitchToLive}
                  className="w-full rounded-full bg-emerald-500 py-3 text-slate-950 font-semibold hover:bg-emerald-400"
                >
                  <Check className="mr-2 h-5 w-5" /> Switch to Live Capture
                </Button>
              </div>
            ) : null}
            <Button
              onClick={handleCloseOverlay}
              className="h-12 rounded-2xl bg-red-500 text-white hover:bg-red-600"
            >
              End camera session
            </Button>
            <p className="text-[11px] text-center text-white/55">
              Tip: single press Bluetooth logs only. Double press within 0.3s
              logs & analyzes automatically.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SanitationVideoRecorder({
  existingUrl,
  uploading,
  onUpload,
  onVideoRecorded,
}: {
  existingUrl?: string | null;
  uploading: boolean;
  onUpload: (file: File) => Promise<void>;
  onVideoRecorded?: () => void;
}) {
  const [isOverlayOpen, setOverlayOpen] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [showOverlayHints, setShowOverlayHints] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [processingUpload, setProcessingUpload] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    existingUrl ?? null,
  );
  const [zoom, setZoom] = useState(1.05);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const { status: alignmentStatus, confidence: alignmentConfidence } =
    useFrameAlignment(
      videoRef,
      isCameraActive && videoReady && !showOverlayHints,
    );

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (existingUrl) {
      setPreviewUrl(existingUrl);
    }
  }, [existingUrl]);

  const cleanupTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    const videoElement = videoRef.current;
    if (videoElement) {
      videoElement.pause();
      videoElement.srcObject = null;
    }
    setVideoReady(false);
    setIsCameraActive(false);
    setInitializing(false);
    setShowOverlayHints(false);
    setZoom(1.05);
    cleanupTimer();
  }, [cleanupTimer]);

  const pickMimeType = () => {
    if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
      return "";
    }
    const supported = [
      "video/mp4;codecs=h264",
      "video/mp4",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ];
    return (
      supported.find((type) =>
        MediaRecorder.isTypeSupported
          ? MediaRecorder.isTypeSupported(type)
          : false,
      ) || ""
    );
  };

  const handleUpload = useCallback(
    async (file: File, blobUrl?: string) => {
      console.log("[sanitation] Starting upload:", file.name, file.size, "bytes");
      setProcessingUpload(true);
      
      // Set preview URL immediately so user sees the video
      setPreviewUrl((current) => {
        if (current && current.startsWith("blob:")) {
          URL.revokeObjectURL(current);
        }
        return blobUrl ?? current ?? null;
      });
      
      // Mark video as recorded immediately
      onVideoRecorded?.();
      
      // Show initial toast
      toast.success("Video recorded! Uploading in background...", { duration: 2000 });
      
      // Upload in background - don't block the UI
      onUpload(file)
        .then(() => {
          console.log("[sanitation] Upload completed successfully");
          toast.success("Sanitation clip uploaded successfully", { duration: 3000 });
        })
        .catch((error) => {
          console.error("[sanitation] Upload failed:", error);
          toast.error("Sanitation upload failed. Please try again.");
          // Clear preview on failure
          setPreviewUrl((current) => {
            if (current && current.startsWith("blob:")) {
              URL.revokeObjectURL(current);
            }
            return null;
          });
        })
        .finally(() => {
          setProcessingUpload(false);
        });
    },
    [onUpload, onVideoRecorded],
  );

  const stopRecording = useCallback(() => {
    cleanupTimer();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }, [cleanupTimer]);

  const startCamera = useCallback(async () => {
    if (initializing) return;
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      toast.error("Camera not supported on this device");
      return;
    }
    try {
      setInitializing(true);
      setVideoReady(false);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setIsCameraActive(true);
      setShowOverlayHints(true);
    } catch (error) {
      console.error("sanitation.camera", error);
      toast.error("Unable to access camera. Check permissions.");
      stopCamera();
      setOverlayOpen(false);
    } finally {
      setInitializing(false);
    }
  }, [initializing, stopCamera]);

  useEffect(() => {
    if (!isCameraActive || !videoRef.current || !streamRef.current) {
      return;
    }
    const videoElement = videoRef.current;
    videoElement.srcObject = streamRef.current;
    videoElement.setAttribute("playsinline", "true");
    videoElement.muted = true;

    let cancelled = false;
    const waitForReady = () => {
      if (cancelled) return;
      if (videoElement.videoWidth && videoElement.videoHeight) {
        setVideoReady(true);
      } else {
        requestAnimationFrame(waitForReady);
      }
    };

    const playPromise = videoElement.play();
    if (playPromise) {
      playPromise.catch((error) => {
        console.warn("Sanitation video playback blocked", error);
      });
    }

    waitForReady();
    return () => {
      cancelled = true;
    };
  }, [isCameraActive]);

  const handleRecorderStop = useCallback(
    async (recordedChunks: Blob[]) => {
      console.log("[sanitation] Recorded chunks:", recordedChunks.length, "Total size:", recordedChunks.reduce((sum, chunk) => sum + chunk.size, 0), "bytes");
      
      const mimeType = recorderRef.current?.mimeType || "video/webm";
      const blob = new Blob(recordedChunks, { type: mimeType });
      
      console.log("[sanitation] Created blob:", blob.size, "bytes, type:", blob.type);
      
      if (blob.size === 0) {
        toast.error("Recording failed - no data captured. Try again.");
        setIsRecording(false);
        setCountdown(60);
        return;
      }

      if (blob.size < 1000) {
        toast.error("Recording too short or corrupted. Try again.");
        setIsRecording(false);
        setCountdown(60);
        return;
      }

      const extension = mimeType.includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `sanitation-${Date.now()}.${extension}`, {
        type: mimeType,
      });
      const blobUrl = URL.createObjectURL(blob);
      
      console.log("[sanitation] Created file:", file.name, file.size, "bytes, blob URL:", blobUrl);
      
      // Close overlay and stop camera immediately - don't wait for upload
      stopCamera();
      setOverlayOpen(false);
      setIsRecording(false);
      setCountdown(60);
      
      // Start upload in background - don't await it
      handleUpload(file, blobUrl);
    },
    [handleUpload, stopCamera],
  );

  const startRecording = useCallback(() => {
    if (!streamRef.current) {
      toast.error("Start the camera before recording");
      return;
    }
    if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
      toast.error("Recording not supported in this browser");
      return;
    }

    try {
      recordedChunksRef.current = [];
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(
        streamRef.current,
        mimeType ? { mimeType } : undefined,
      );
      recorderRef.current = recorder;
      setIsRecording(true);
      setShowOverlayHints(false);
      setCountdown(60);
      cleanupTimer();
      timerRef.current = window.setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            stopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        cleanupTimer();
        const chunks = recordedChunksRef.current;
        recorderRef.current = null;
        recordedChunksRef.current = [];
        setIsRecording(false);
        await handleRecorderStop(chunks);
      };

      recorder.start();
    } catch (error) {
      console.error("sanitation.recorder", error);
      toast.error("Unable to start recording");
      setIsRecording(false);
      cleanupTimer();
    }
  }, [cleanupTimer, handleRecorderStop, stopRecording]);

  const handleCloseOverlay = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      stopCamera();
      setOverlayOpen(false);
    }
    setShowOverlayHints(false);
    setCountdown(60);
  }, [isRecording, stopCamera, stopRecording]);

  const handleOpenOverlay = () => {
    setOverlayOpen(true);
    setShowOverlayHints(true);
    setCountdown(60);
    void startCamera();
  };

  const overlayColor =
    alignmentStatus === "locked"
      ? "border-emerald-400"
      : alignmentStatus === "aligning"
        ? "border-amber-300"
        : "border-white/30";

  const alignmentMessage =
    alignmentStatus === "locked"
      ? "Everything in frame"
      : alignmentStatus === "aligning"
        ? "Adjust within guide"
        : "Fill the border";

  const disabledControls = uploading || processingUpload || initializing;

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-4 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Sanitation walkthrough
          </h3>
          <p className="text-xs text-slate-500 dark:text-white/60">
            Record up to 60 seconds sanitizing boots and tools in one continuous
            clip.
          </p>
        </div>
        <Badge variant="secondary" className="bg-white/10 text-slate-600 dark:text-white/70">
          60s max
        </Badge>
      </div>

      {previewUrl ? (
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60">
          <video
            key={previewUrl}
            src={previewUrl}
            className="h-48 w-full object-cover"
            controls
            playsInline
            onLoadedMetadata={(e) => {
              const video = e.currentTarget;
              console.log("[sanitation] Video loaded - duration:", video.duration, "seconds, size:", video.videoWidth, "x", video.videoHeight);
            }}
            onError={(e) => {
              console.error("[sanitation] Video failed to load:", e.currentTarget.error);
              toast.error("Video preview failed to load");
            }}
          />
        </div>
      ) : (
        <div className="flex h-44 items-center justify-center rounded-2xl border border-dashed border-white/15 bg-slate-900/40 text-white/50">
          No sanitation clip yet
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          className="h-12 flex-1 rounded-2xl bg-emerald-500 text-slate-950 hover:bg-emerald-400"
          onClick={handleOpenOverlay}
          disabled={disabledControls}
        >
          {processingUpload ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
            </>
          ) : (
            <>Record sanitation clip</>
          )}
        </Button>
      </div>

      {processingUpload ? (
        <p className="text-[11px] text-amber-200">
          Uploading sanitation proof…
        </p>
      ) : null}

      {isOverlayOpen ? (
        <div className="fixed inset-0 z-[60] flex flex-col bg-slate-950 text-white">
          <header className="flex items-center justify-between px-4 pb-2 pt-3 text-xs uppercase tracking-wide text-slate-600 dark:text-white/70">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-white/80">
                Sanitation capture
              </span>
              <span className="text-[10px] text-white/50">
                Document the full sanitation pass
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full border border-white/15 bg-white/10 px-3 text-white/80 transition hover:border-emerald-400/60 hover:bg-emerald-500/25 hover:text-emerald-100"
              onClick={handleCloseOverlay}
            >
              Close
            </Button>
          </header>
          <div className="relative flex-1 overflow-hidden">
            <video
              ref={videoRef}
              className="h-full w-full object-cover transition-transform duration-200"
              muted
              playsInline
              style={{ transform: `scale(${zoom})` }}
            />
            {!showOverlayHints && (
              <div
                className={`pointer-events-none absolute inset-[5%] rounded-3xl border-4 ${overlayColor} transition-colors duration-200`}
              >
                <div className="absolute inset-4 rounded-2xl border border-white/20" />
                <div className="absolute left-1/2 bottom-4 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-4 py-1 text-[11px] font-semibold uppercase tracking-wide">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      alignmentStatus === "locked"
                        ? "bg-emerald-400"
                        : alignmentStatus === "aligning"
                          ? "bg-amber-300"
                          : "bg-white/60"
                    }`}
                  />
                  <span>{alignmentMessage}</span>
                  <span className="text-white/50">
                    {Math.round(alignmentConfidence * 100)}%
                  </span>
                </div>
              </div>
            )}
            {showOverlayHints ? (
              <div className="absolute inset-0 flex flex-col justify-center gap-5 bg-slate-950/85 px-6 py-8 backdrop-blur-sm">
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold text-white">
                    Keep the sanitation flow in frame
                  </h2>
                  <ul className="space-y-3 text-sm text-emerald-100">
                    {[
                      "Start with boots, then sweep across tools without breaking the shot.",
                      "Keep the sanitizer bottle and spray pattern inside the green border.",
                      "Move slowly so QA can confirm thorough coverage.",
                    ].map((tip) => (
                      <li
                        key={tip}
                        className="flex items-start gap-2 rounded-2xl bg-emerald-500/10 px-3 py-2"
                      >
                        <Sparkles className="mt-0.5 h-4 w-4 text-emerald-300" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Button
                  variant="secondary"
                  className="self-start rounded-full bg-emerald-500 px-5 text-slate-950 shadow-lg hover:bg-emerald-400"
                  onClick={() => setShowOverlayHints(false)}
                >
                  Got it
                </Button>
              </div>
            ) : null}
            {(!videoReady || initializing) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/75">
                <Loader2 className="h-10 w-10 animate-spin" />
                <span className="text-xs text-slate-600 dark:text-white/70">Preparing camera…</span>
              </div>
            )}
          </div>
          <div className="space-y-4 bg-slate-950/95 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
            {!showOverlayHints ? (
              <div className="flex items-center gap-3 rounded-full bg-white/10 px-4 py-3">
                <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-white/60">
                  Zoom
                </span>
                <input
                  type="range"
                  min={0.9}
                  max={2.2}
                  step={0.05}
                  value={zoom}
                  onChange={(event) =>
                    setZoom(clamp(Number(event.target.value), 0.9, 2.4))
                  }
                  className="flex-1 accent-emerald-400"
                />
                <span className="text-xs font-semibold text-slate-600 dark:text-white/70">
                  {zoom.toFixed(1)}x
                </span>
              </div>
            ) : null}
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-white/70">
              <span className="uppercase tracking-wide">Countdown</span>
              <span className="text-lg font-semibold text-white">
                {isRecording ? `${countdown}s` : "60s max"}
              </span>
            </div>
            {!isRecording ? (
              <Button
                className="h-14 rounded-2xl bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                disabled={!videoReady || initializing}
                onClick={startRecording}
              >
                Record sanitation clip
              </Button>
            ) : (
              <Button
                className="h-14 rounded-2xl bg-red-500 text-white hover:bg-red-600"
                onClick={stopRecording}
              >
                <CircleStop className="mr-2 h-5 w-5" /> Stop recording
              </Button>
            )}
            <p className="text-[11px] text-center text-white/55">
              The clip stops automatically at 60 seconds. Make sure both boots
              and equipment are sanitized in one take.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function FieldTechVisitPage({
  params,
}: {
  params: Promise<{ visitId: string }>;
}) {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const pageSurfaceClass = isDark
    ? "bg-slate-950 text-slate-50"
    : "bg-slate-50 text-slate-900";
  const centeredSurfaceClass = isDark
    ? "bg-slate-950 text-white/80"
    : "bg-slate-50 text-slate-700";
  const loadingSkeletonClass = isDark ? "bg-white/10" : "bg-slate-200/70";
  const gradientOverlayClass = isDark
    ? "bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_60%),_radial-gradient(circle_at_bottom,_rgba(14,165,233,0.12),_transparent_55%)]"
    : "bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.08),_transparent_60%),_radial-gradient(circle_at_bottom,_rgba(16,185,129,0.08),_transparent_55%)]";
  const [visitIdValue, setVisitIdValue] = useState<string | null>(null);
  const [visit, setVisit] = useState<VisitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sanitationVideoRecorded, setSanitationVideoRecorded] = useState(false);
  const [reanalyzingMediaId, setReanalyzingMediaId] = useState<string | null>(
    null,
  );
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [showOptionalExtras, setShowOptionalExtras] = useState(false);

  const [color, setColor] = useState<string>("");
  const [consistency, setConsistency] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [observations, setObservations] = useState<string>("");
  const [customNote, setCustomNote] = useState<string>("");
  const [wellnessFlag, setWellnessFlag] = useState(false);
  const [flagReason, setFlagReason] = useState<string>("");
  const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<VisitStep>("arrival");
  const [confirmAllDeposits, setConfirmAllDeposits] = useState(false);
  const [confirmAnalyzedFresh, setConfirmAnalyzedFresh] = useState(false);
  const [confirmFinalSweep, setConfirmFinalSweep] = useState(false);
  const [notificationChannel, setNotificationChannel] = useState<
    "SMS" | "EMAIL"
  >("SMS");
  const [notificationInitialized, setNotificationInitialized] = useState(false);
  const [hasReviewedSummary, setHasReviewedSummary] = useState(false);
  const [safetyExpanded, setSafetyExpanded] = useState(false);
  const [showPayoutCelebration, setShowPayoutCelebration] = useState(false);
  const [earnedPayoutCents, setEarnedPayoutCents] = useState<number | null>(null);
  const [hasGeneratedSummary, setHasGeneratedSummary] = useState(false);
  const [lastSummary, setLastSummary] = useState<SummarySnapshot | null>(null);
  const [showAllSamples, setShowAllSamples] = useState(false);
  const [arrivalVerified, setArrivalVerified] = useState(false);
  const [arrivalCheckInProgress, setArrivalCheckInProgress] = useState(false);
  const [arrivalError, setArrivalError] = useState<string | null>(null);


  const verifyArrivalLocation = useCallback(async () => {
    if (!visit?.geo) {
      toast.error("No location data available for this visit");
      setArrivalVerified(true);
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      const message = "Enable location services to confirm arrival.";
      toast.error(message);
      setArrivalError(message);
      return;
    }

    setArrivalCheckInProgress(true);
    setArrivalError(null);

    const getPosition = () =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          (error) => {
            // Handle specific permission errors
            if (error.code === error.PERMISSION_DENIED) {
              reject(new Error("Location permission denied. Please enable location services in your device settings and reload the app."));
            } else if (error.code === error.POSITION_UNAVAILABLE) {
              reject(new Error("Location unavailable. Make sure GPS is enabled."));
            } else if (error.code === error.TIMEOUT) {
              reject(new Error("Location request timed out. Please try again."));
            } else {
              reject(error);
            }
          },
          {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 15000,
          }
        );
      });

    try {
      const position = await getPosition();
      const { latitude, longitude, accuracy } = position.coords;
      const distance = haversineDistanceMeters(
        latitude,
        longitude,
        visit.geo.latitude,
        visit.geo.longitude,
      );

      const tolerance = Math.max(
        accuracy ?? 0,
        ARRIVAL_DISTANCE_THRESHOLD_METERS,
      );

      if (distance > tolerance) {
        const miles = distance / 1609.344;
        let readable: string;
        if (miles >= 1) {
          readable = `${miles.toFixed(1)} mi`;
        } else if (miles >= 0.1) {
          readable = `${miles.toFixed(2)} mi`;
        } else {
          const feet = Math.max(1, Math.round(distance * 3.28084));
          readable = `${feet} ft`;
        }
        const message = `You appear to be ${readable} away from the service address. Move closer and try again.`;
        toast.error(message);
        setArrivalError(message);
        return;
      }

      setArrivalVerified(true);
      if (typeof window !== "undefined" && visit.id) {
        window.localStorage.setItem(
          `${ARRIVAL_CHECK_KEY_PREFIX}${visit.id}`,
          new Date().toISOString(),
        );
      }
      toast.success("Arrival confirmed. You're good to start!");
    } catch (error: any) {
      const message = error?.message ?? "Unable to determine your location";
      console.error("arrival.verification", error);
      toast.error(message);
      setArrivalError(message);
    } finally {
      setArrivalCheckInProgress(false);
    }
  }, [visit?.geo, visit?.id]);

  useEffect(() => {
  }, []);

  useEffect(() => {
    if (arrivalVerified && currentStep === "arrival") {
      setCurrentStep("setup");
    }
  }, [arrivalVerified, currentStep]);

  // Check if we have analyzed InsightScoop samples
  const analyzedSampleCount = useMemo(() => {
    return (
      (visit?.media || [])
        .filter(
          (m) =>
            m.assetType === "INSIGHTSCOOP" &&
            m.stoolSampleView !== "CROSS_SECTION" &&
            (m.analysisStatus === "COMPLETED" ||
              m.analysisStatus === "NEEDS_REVIEW"),
        ).length ?? 0
    );
  }, [visit?.media]);

  const hasAnalyzedSamples = analyzedSampleCount > 0;

  const visitMetadataRecord = useMemo(() => {
    if (!visit?.metadata || !isRecord(visit.metadata)) {
      return null;
    }
    return visit.metadata as Record<string, any>;
  }, [visit?.metadata]);

  const planMetadataRecord = useMemo(() => {
    const raw = visit?.job?.billingPlan?.metadata;
    if (!raw || !isRecord(raw)) {
      return null;
    }
    return raw as Record<string, any>;
  }, [visit?.job?.billingPlan?.metadata]);

  const accessPreferences = useMemo(
    () =>
      extractAccessPreferences(
        visitMetadataRecord?.accessPreferences ??
          planMetadataRecord?.accessPreferences,
      ),
    [planMetadataRecord, visitMetadataRecord],
  );

  const dogPreferences = useMemo(
    () =>
      extractDogPreferences(
        visitMetadataRecord?.dogPreferences ??
          planMetadataRecord?.dogPreferences,
      ),
    [planMetadataRecord, visitMetadataRecord],
  );

  const disposalPreferences = useMemo(
    () =>
      extractDisposalPreferences(
        visitMetadataRecord?.disposalPreferences ??
          planMetadataRecord?.disposalPreferences,
      ),
    [planMetadataRecord, visitMetadataRecord],
  );

  const requiresGatePhoto = useMemo(() => {
    if (typeof visitMetadataRecord?.requiresGatePhoto === "boolean") {
      return visitMetadataRecord.requiresGatePhoto;
    }
    if (typeof planMetadataRecord?.requiresGatePhoto === "boolean") {
      return planMetadataRecord.requiresGatePhoto;
    }
    if (typeof accessPreferences?.requiresGatePhoto === "boolean") {
      return accessPreferences.requiresGatePhoto;
    }
    if (accessPreferences?.gateLocation) {
      return accessPreferences.gateLocation !== "front";
    }
    return true;
  }, [
    accessPreferences?.gateLocation,
    accessPreferences?.requiresGatePhoto,
    planMetadataRecord?.requiresGatePhoto,
    visitMetadataRecord?.requiresGatePhoto,
  ]);

  const requiresBagDropPhoto = useMemo(() => {
    if (typeof visitMetadataRecord?.requiresBagDropPhoto === "boolean") {
      return visitMetadataRecord.requiresBagDropPhoto;
    }
    if (typeof planMetadataRecord?.requiresBagDropPhoto === "boolean") {
      return planMetadataRecord.requiresBagDropPhoto;
    }
    if (
      typeof disposalPreferences?.requiresBinConfirmation === "boolean"
    ) {
      return disposalPreferences.requiresBinConfirmation;
    }
    return false;
  }, [
    disposalPreferences?.requiresBinConfirmation,
    planMetadataRecord?.requiresBagDropPhoto,
    visitMetadataRecord?.requiresBagDropPhoto,
  ]);

  const bagDropLabel = disposalPreferences?.trashLabel ?? "the designated bin";

  const disposalModeLabel = useMemo(() => {
    const mode = disposalPreferences?.mode?.toLowerCase();
    if (mode === "takeaway" || mode === "haul-away" || mode === "haulaway") {
      return "Haul-away (remove waste offsite)";
    }
    const isLegacyPercent = typeof mode === "string" && /^\d{1,3}%?$/.test(mode);
    const isEcoPercent = typeof mode === "string" && mode.startsWith("eco") && /\d/.test(mode);
    if (mode === "compost" || isLegacyPercent || isEcoPercent) {
      return "Compost routing";
    }
    return requiresBagDropPhoto
      ? "Leave sealed bag in client bin"
      : "Standard onsite disposal";
  }, [disposalPreferences?.mode, requiresBagDropPhoto]);

  const accessHighlights = useMemo<HighlightItem[]>(() => {
    const items: HighlightItem[] = [];

    if (accessPreferences?.gateLabel) {
      items.push({
        key: "gate-entry",
        icon: <DoorClosed className="h-4 w-4" aria-hidden="true" />,
        label: "Entry point",
        description: accessPreferences.gateLabel,
      });
    }

    if (accessPreferences?.communityGate?.required) {
      const code = accessPreferences.communityGate.code;
      items.push({
        key: "community-gate",
        icon: <KeyRound className="h-4 w-4" aria-hidden="true" />,
        label: "Community gate",
        description: code ? `Code ${code}` : "Code or instructions provided separately",
      });
    }

    if (accessPreferences?.homeGate) {
      const hasLock = accessPreferences.homeGate.hasLock === true;
      const code = accessPreferences.homeGate.code;
      items.push({
        key: "home-gate",
        icon: <KeyRound className="h-4 w-4" aria-hidden="true" />,
        label: hasLock ? "Back gate lock" : "Back gate",
        description: hasLock
          ? code
            ? `Code ${code}`
            : "Unlock instructions provided on-site"
          : "No lock required",
      });
    }

    if (requiresBagDropPhoto) {
      items.push({
        key: "bag-drop",
        icon: <Camera className="h-4 w-4" aria-hidden="true" />,
        label: "Bag drop proof",
        description: `Capture a photo in ${bagDropLabel}. Enable flash if lighting is low.`,
      });
    }

    if (disposalModeLabel) {
      items.push({
        key: "disposal-mode",
        icon: <Trash2 className="h-4 w-4" aria-hidden="true" />,
        label: "Disposal",
        description: disposalModeLabel,
      });
    }

    if (!requiresGatePhoto) {
      items.push({
        key: "gate-optional",
        icon: <ShieldCheck className="h-4 w-4" aria-hidden="true" />,
        label: "Gate photo",
        description: "No gate on-site—step auto-completes after confirmation.",
      });
    }

    return items;
  }, [
    accessPreferences,
    bagDropLabel,
    disposalModeLabel,
    requiresBagDropPhoto,
    requiresGatePhoto,
  ]);

  const dogHighlights = useMemo<HighlightItem[]>(() => {
    const items: HighlightItem[] = [];
    if (dogPreferences?.dogDoor) {
      items.push({
        key: "dog-door",
        icon: <Dog className="h-4 w-4" aria-hidden="true" />,
        label: "Doggy door",
        description:
          dogPreferences.dogDoor === "yes"
            ? "Dogs can access the yard via dog door."
            : "Dogs need to be let outside manually.",
      });
    }
    if (dogPreferences?.dogsOutside) {
      items.push({
        key: "dogs-outside",
        icon: <Dog className="h-4 w-4" aria-hidden="true" />,
        label: "Dogs outside unsupervised",
        description:
          dogPreferences.dogsOutside === "yes"
            ? "Dogs may be roaming the yard unsupervised."
            : "Dogs stay inside unless someone is home.",
      });
    }
    if (dogPreferences?.cleanWithDogs) {
      items.push({
        key: "clean-with-dogs",
        icon: <Dog className="h-4 w-4" aria-hidden="true" />,
        label: "Work with dogs present",
        description:
          dogPreferences.cleanWithDogs === "yes"
            ? "Okay to scoop while dogs hang out."
            : "Coordinate before entering when dogs are outside.",
      });
    }
    return items;
  }, [dogPreferences]);

  const additionalNotes = useMemo(() => {
    const noteSet = new Set<string>();
    if (accessPreferences?.notes) {
      noteSet.add(accessPreferences.notes);
    }
    const candidateNotes = [visit?.notes, visit?.customer?.notes];
    candidateNotes.forEach((value) => {
      if (!value) return;
      value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((line) => {
          const lower = line.toLowerCase();
          if (
            !SUPPRESSED_NOTE_PREFIXES.some((prefix) =>
              lower.startsWith(prefix),
            )
          ) {
            noteSet.add(line);
          }
        });
    });
    return Array.from(noteSet);
  }, [accessPreferences?.notes, visit?.customer?.notes, visit?.notes]);

  const totalSafetyItems = accessHighlights.length + dogHighlights.length + additionalNotes.length;

  const SafetySection = useMemo(() => {
    if (totalSafetyItems === 0) {
      return null;
    }

    return (
      <section
        className={cn(
          "rounded-2xl border",
          isDark
            ? "border-white/10 bg-white/5"
            : "border-slate-200 bg-slate-50",
        )}
      >
        {/* Collapsible header */}
        <button
          type="button"
          onClick={() => setSafetyExpanded((prev) => !prev)}
          className={cn(
            "flex w-full items-center justify-between px-4 py-3 text-left transition",
            safetyExpanded ? "" : "rounded-2xl",
            isDark
              ? "text-white hover:bg-white/5"
              : "text-slate-900 hover:bg-slate-100",
          )}
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className={cn("h-4 w-4", isDark ? "text-emerald-300" : "text-emerald-500")} />
            <span className="text-xs font-semibold">Access &amp; safety</span>
            <span className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
              isDark ? "bg-white/10 text-white/70" : "bg-slate-200 text-slate-600"
            )}>
              {totalSafetyItems} {totalSafetyItems === 1 ? "note" : "notes"}
            </span>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              safetyExpanded ? "rotate-180" : "",
              isDark ? "text-white/60" : "text-slate-500",
            )}
          />
        </button>

        {/* Collapsible content */}
        {safetyExpanded && (
          <div className="space-y-3 px-4 pb-4">
            {accessHighlights.length > 0 && (
              <div className="space-y-2">
                {accessHighlights.map((item) => (
                  <div
                    key={item.key}
                    className={cn(
                      "flex items-start gap-2 rounded-xl border px-2.5 py-2 text-xs",
                      isDark
                        ? "border-white/10 bg-white/5"
                        : "border-slate-200 bg-white",
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-lg",
                        isDark
                          ? "bg-white/10 text-emerald-300"
                          : "bg-emerald-50 text-emerald-600",
                      )}
                    >
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <p className={cn("font-semibold", isDark ? "text-white" : "text-slate-900")}>
                        {item.label}
                      </p>
                      <p className="text-slate-500 dark:text-white/60">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {dogHighlights.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-white/50">
                  Dog safety
                </p>
                {dogHighlights.map((item) => (
                  <div
                    key={item.key}
                    className={cn(
                      "flex items-start gap-2 rounded-xl border px-2.5 py-2 text-xs",
                      isDark
                        ? "border-white/10 bg-white/5"
                        : "border-slate-200 bg-white",
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-lg",
                        isDark
                          ? "bg-white/10 text-emerald-300"
                          : "bg-emerald-50 text-emerald-600",
                      )}
                    >
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <p className={cn("font-semibold", isDark ? "text-white" : "text-slate-900")}>
                        {item.label}
                      </p>
                      <p className="text-slate-500 dark:text-white/60">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {additionalNotes.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-white/50">
                  Notes
                </p>
                <ul className="space-y-1 text-xs text-slate-600 dark:text-white/70">
                  {additionalNotes.map((note) => (
                    <li key={note} className="flex items-start gap-1.5">
                      <Info
                        className={cn(
                          "mt-0.5 h-3 w-3 flex-none",
                          isDark ? "text-emerald-300" : "text-emerald-500",
                        )}
                      />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    );
  }, [accessHighlights, additionalNotes, dogHighlights, isDark, safetyExpanded, totalSafetyItems]);

  const loadVisit = useCallback(
    async (
      targetVisitId: string,
      options: { withLoading?: boolean; syncForm?: boolean } = {},
    ) => {
      const { withLoading = false, syncForm = false } = options;
      if (withLoading) {
        setLoading(true);
        setError(null);
      }
      try {
        const response = await fetch(
          `/api/field-tech/visits/${targetVisitId}`,
          {
            cache: "no-store",
          },
        );
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.visit) {
          throw new Error(payload?.error ?? "Unable to load visit");
        }
        const visitData = payload.visit as VisitDetail;
        setVisit(visitData);
        if (withLoading) {
          // Don't hardcode step - let the steps useEffect determine the first step
          // based on arrival/gear status
          setConfirmAllDeposits(false);
          setConfirmAnalyzedFresh(false);
          setConfirmFinalSweep(false);
          setHasReviewedSummary(false);
          setNotificationInitialized(false);
          setHasGeneratedSummary(false);
          setLastSummary(null);
        }
        if (syncForm) {
          const previousInsight = visitData.insights?.[0];
          if (previousInsight) {
            setColor(previousInsight.colorIndicator ?? "");
            setConsistency(previousInsight.consistencyIndicator ?? "");
            setContent(previousInsight.contentIndicator ?? "");
            setObservations(previousInsight.observations ?? "");
            setWellnessFlag(Boolean(previousInsight.wellnessFlag));
            setFlagReason(previousInsight.flagReason ?? "");
          } else {
            setColor("");
            setConsistency("");
            setContent("");
            setObservations("");
            setWellnessFlag(false);
            setFlagReason("");
          }
        }
        if (withLoading) {
          setError(null);
        }
      } catch (err) {
        console.error("visit.load.failed", err);
        if (withLoading) {
          setError(err instanceof Error ? err.message : "Unable to load visit");
        }
      } finally {
        if (withLoading) {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const { visitId } = await params;
      if (cancelled) return;
      setVisitIdValue(visitId);
      await loadVisit(visitId, { withLoading: true, syncForm: true });
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [params, loadVisit]);

  // Poll for analysis updates when media is pending or in progress
  useEffect(() => {
    if (!visitIdValue || !visit) return;

    const hasPendingAnalysis = visit.media.some(
      (media) =>
        media.analysisStatus === "PENDING" ||
        media.analysisStatus === "IN_PROGRESS",
    );

    if (!hasPendingAnalysis) return;

    const intervalId = setInterval(() => {
      void loadVisit(visitIdValue, { withLoading: false, syncForm: false });
    }, 3000); // Poll every 3 seconds

    return () => {
      clearInterval(intervalId);
    };
  }, [visitIdValue, visit, loadVisit]);

  useEffect(() => {
    if (!visit?.customer || notificationInitialized) {
      return;
    }

    if (visit.customer.phone) {
      setNotificationChannel("SMS");
      setNotificationInitialized(true);
      return;
    }

    if (!visit.customer.phone && visit.customer.email) {
      setNotificationChannel("EMAIL");
      setNotificationInitialized(true);
      return;
    }

    setNotificationInitialized(true);
  }, [visit?.customer, notificationInitialized]);

  const mediaByType = useMemo(() => {
    const map: Record<string, VisitMedia[]> = {};
    visit?.media.forEach((item) => {
      map[item.assetType] = map[item.assetType] || [];
      map[item.assetType].push(item);
    });
    return map;
  }, [visit?.media]);

  useEffect(() => {
    if (!visit?.id) {
      setArrivalVerified(false);
      return;
    }

    if (!visit.geo) {
      setArrivalVerified(true);
      return;
    }

    if (visit.routeStop?.actualArrival) {
      setArrivalVerified(true);
      return;
    }

    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(
        `${ARRIVAL_CHECK_KEY_PREFIX}${visit.id}`,
      );
      if (stored) {
        const parsed = new Date(stored);
        if (!Number.isNaN(parsed.getTime()) && isSameDay(parsed, new Date())) {
          setArrivalVerified(true);
          return;
        }
      }
    }

    setArrivalVerified(false);
  }, [visit?.id, visit?.routeStop?.actualArrival, visit?.geo]);

  const arrivalMedia = mediaByType["ARRIVAL"] ?? [];
  const allInsightMedia = mediaByType["INSIGHTSCOOP"] ?? [];
  const crossSectionMap = useMemo(() => {
    const mapping = new Map<string, VisitMedia>();
    allInsightMedia.forEach((media) => {
      if (media.stoolSampleView === "CROSS_SECTION" && media.stoolSampleId) {
        mapping.set(media.stoolSampleId, media);
      }
    });
    return mapping;
  }, [allInsightMedia]);

  const insightMedia = useMemo(
    () =>
      allInsightMedia.filter((media) => media.stoolSampleView !== "CROSS_SECTION"),
    [allInsightMedia],
  );

  const insightsCaptured = insightMedia.length;

  const gateMedia = mediaByType["GATE"] ?? [];
  const bagDropMedia = mediaByType["BAG_DROP"] ?? [];
  const sanitationShoesMedia = useMemo(
    () =>
      (mediaByType["OTHER"] ?? []).filter(
        (media) => media.notes === SANITATION_SHOES_NOTE,
      ),
    [mediaByType],
  );
  const sanitationToolsMedia = useMemo(
    () =>
      (mediaByType["OTHER"] ?? []).filter(
        (media) => media.notes === SANITATION_TOOLS_NOTE,
      ),
    [mediaByType],
  );
  const sanitationVideoMedia = useMemo(
    () =>
      (mediaByType["OTHER"] ?? []).filter(
        (media) => media.notes === SANITATION_VIDEO_NOTE,
      ),
    [mediaByType],
  );
  const hasSanitationClip = sanitationVideoMedia.length > 0;
  const sanitationCaptured =
    hasSanitationClip ||
    sanitationVideoRecorded ||
    (sanitationShoesMedia.length > 0 && sanitationToolsMedia.length > 0);
  const otherMiscMedia = useMemo(
    () =>
      (mediaByType["OTHER"] ?? []).filter(
        (media) =>
          media.notes !== SANITATION_SHOES_NOTE &&
          media.notes !== SANITATION_TOOLS_NOTE &&
          media.notes !== SANITATION_VIDEO_NOTE,
      ),
    [mediaByType],
  );
  const flaggedSampleIndices = lastSummary?.flaggedSampleIndices ?? [];
  const flaggedInsightSamples = flaggedSampleIndices
    .map((index) => insightMedia[index])
    .filter((media): media is VisitMedia => Boolean(media));
  const unflaggedInsightSamples = insightMedia.filter(
    (_, index) => !flaggedSampleIndices.includes(index),
  );

  const analysisGoal =
    insightsCaptured >= 5 ? 5 : insightsCaptured >= 3 ? 3 : insightsCaptured;
  const hasMetAnalysisMinimum =
    analysisGoal === 0 ? false : analyzedSampleCount >= analysisGoal;
  const confirmationsReady =
    confirmAllDeposits && confirmAnalyzedFresh && confirmFinalSweep;
  const summaryReady = hasAnalyzedSamples
    ? hasGeneratedSummary &&
      hasReviewedSummary &&
      observations.trim().length > 0
    : color !== "" && consistency !== "" && content !== "";
  const channelAvailable =
    notificationChannel === "SMS"
      ? Boolean(visit?.customer?.phone)
      : Boolean(visit?.customer?.email);

  const arrivalRequired = Boolean(visit?.geo);
  const arrivalUnlocked = !arrivalRequired || arrivalVerified;

  useEffect(() => {
    if (arrivalRequired && !arrivalVerified && currentStep !== "arrival") {
      setCurrentStep("arrival");
    }
  }, [arrivalRequired, arrivalVerified, currentStep]);

  const gateReady = requiresGatePhoto ? gateMedia.length > 0 : true;
  const bagDropReady = requiresBagDropPhoto ? bagDropMedia.length > 0 : true;

  const hasRequiredMedia =
    arrivalUnlocked &&
    insightsCaptured > 0 &&
    hasMetAnalysisMinimum &&
    gateReady &&
    bagDropReady &&
    sanitationCaptured;

  // Validation: AI mode doesn't require manual 3Cs but DOES require review, manual mode requires 3Cs
  const canComplete =
    Boolean(visit) &&
    hasRequiredMedia &&
    summaryReady &&
    confirmationsReady &&
    channelAvailable &&
    !submitting;

  useEffect(() => {
    if (insightsCaptured > 0 && !confirmAllDeposits) {
      setConfirmAllDeposits(true);
    }
  }, [insightsCaptured, confirmAllDeposits]);

  useEffect(() => {
    if (hasMetAnalysisMinimum && !confirmAnalyzedFresh) {
      setConfirmAnalyzedFresh(true);
    }
  }, [hasMetAnalysisMinimum, confirmAnalyzedFresh]);

  useEffect(() => {
    if (!requiresGatePhoto) {
      return;
    }
    if (gateMedia.length > 0 && !confirmFinalSweep) {
      setConfirmFinalSweep(true);
    }
  }, [gateMedia.length, confirmFinalSweep, requiresGatePhoto]);

  useEffect(() => {
    if (hasGeneratedSummary && !hasReviewedSummary) {
      setHasReviewedSummary(true);
    }
  }, [hasGeneratedSummary, hasReviewedSummary]);

  useEffect(() => {
    if (!hasAnalyzedSamples && summaryReady && !hasReviewedSummary) {
      setHasReviewedSummary(true);
    }
  }, [hasAnalyzedSamples, summaryReady, hasReviewedSummary]);

  const visitDate = visit ? new Date(visit.scheduledDate) : null;
  const isVisitDateValid = visitDate && !Number.isNaN(visitDate.getTime());
  const isFutureVisit = Boolean(
    isVisitDateValid && visitDate && isAfter(visitDate, endOfDay(new Date())),
  );

  const steps = useMemo(() => {
    const sequence: Array<{
      id: VisitStep;
      label: string;
      description: string;
    }> = [];

    if (arrivalRequired) {
      sequence.push({
        id: "arrival" as VisitStep,
        label: "Confirm arrival",
        description:
          "Verify your location at the property before logging anything.",
      });
    }

    sequence.push(
      {
        id: "setup" as VisitStep,
        label: "Mount & prep",
        description:
          "Seat the phone in the scooper mount and frame the bucket edge-to-edge.",
      },
      {
        id: "capture" as VisitStep,
        label: "Capture deposits",
        description:
          "Log each pickup from the mount. Double press to auto-run AI.",
      },
      {
        id: "confirm" as VisitStep,
        label: "Confirm yard is clear",
        description:
          "Walk the yard, confirm analysis goals, and mark the final sweep.",
      },
    );

    if (requiresBagDropPhoto) {
      sequence.push({
        id: "bag_drop" as VisitStep,
        label: "Bag drop proof",
        description: `Leave the sealed bag in ${bagDropLabel}, then snap a quick photo.`,
      });
    }

    if (requiresGatePhoto) {
      sequence.push({
        id: "gate" as VisitStep,
        label: "Secure the gate",
        description: "Capture the closed latch and any locks before you exit.",
      });
    }

    sequence.push(
      {
        id: "sanitation" as VisitStep,
        label: "Sanitation",
        description:
          "Record the 60s clip sanitizing boots and tools after the visit.",
      },
      {
        id: "review" as VisitStep,
        label: "Review & summarize",
        description:
          "Lock in colors, consistency, and observations for the family.",
      },
      {
        id: "notify" as VisitStep,
        label: "Notify & complete",
        description: "Send the wrap-up and mark the stop complete to get paid.",
      },
    );

    return sequence;
  }, [
    arrivalRequired,
    arrivalVerified,
    bagDropLabel,
    requiresBagDropPhoto,
    requiresGatePhoto,
  ]);

  useEffect(() => {
    if (steps.length === 0) return;
    if (!steps.some((step) => step.id === currentStep)) {
      setCurrentStep(steps[0].id);
    }
  }, [steps, currentStep]);

  // Auto-generate summary when entering review step
  useEffect(() => {
    if (currentStep === "review" && hasAnalyzedSamples && !hasGeneratedSummary && !generatingSummary) {
      console.log("[visit] Auto-generating summary on review step entry");
      handleGenerateSummary();
    }
  }, [currentStep, hasAnalyzedSamples, hasGeneratedSummary, generatingSummary]);

  if (isFutureVisit && visit) {
    const scheduledLabel = visitDate
      ? format(visitDate, "EEEE, MMM d • h:mm a")
      : "Scheduled soon";
    return (
      <main className={cn("relative flex min-h-screen w-full flex-col transition-colors", pageSurfaceClass)}>
        <div className={cn("pointer-events-none absolute inset-0 -z-10", gradientOverlayClass)} />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pb-24 pt-6">
          <header className="flex flex-col gap-2">
            <Button
              variant="ghost"
              className={cn(
                "w-fit rounded-full border px-3 py-1 text-sm transition",
                isDark
                  ? "border-white/15 bg-white/10 text-white/80 hover:border-emerald-400/60 hover:bg-emerald-500/25 hover:text-emerald-100"
                  : "border-slate-200 bg-white text-slate-900 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700",
              )}
              onClick={() => router.push("/field-tech")}
            >
              &larr; Back to route
            </Button>
            <div>
              <h1 className={cn("text-2xl font-semibold", isDark ? "text-white" : "text-slate-900")}>
                {visit.customer?.name ?? "Client"}
              </h1>
              <p className="text-sm text-slate-600 dark:text-white/70">
                {visit.customer?.addressLine1}
                {visit.customer?.city ? `, ${visit.customer.city}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-white/60">
              <Badge className={cn(isDark ? "bg-white/10 text-white/80" : "bg-slate-100 text-slate-800")}>
                {visit.status.replace("_", " ")}
              </Badge>
              <span>{scheduledLabel}</span>
            </div>
          </header>

          <section
            className={cn(
              "rounded-3xl border p-5",
              isDark
                ? "border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 text-white"
                : "border-slate-200 bg-white text-slate-900",
            )}
          >
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <CalendarDays className={cn("h-5 w-5", isDark ? "text-emerald-200" : "text-emerald-500")} />
              Visit scheduled
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-white/70">
              This visit opens on {scheduledLabel}. Capture steps, summaries,
              and notifications unlock the day of the visit.
            </p>
          </section>

          <section
            className={cn(
              "rounded-3xl border p-5",
              isDark
                ? "border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 text-white"
                : "border-slate-200 bg-white text-slate-900",
            )}
          >
            <h3 className="text-sm font-semibold">Prep checklist</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-white/60">
              You&apos;ll work through these steps once you&apos;re onsite.
            </p>
            <ul className="mt-4 space-y-3">
              {steps.map((step) => (
                <li
                  key={step.id}
                  className={cn(
                    "flex items-start gap-3 rounded-2xl border px-3 py-2 text-sm",
                    isDark
                      ? "border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 text-white/80"
                      : "border-slate-200 bg-slate-50 text-slate-800",
                  )}
                >
                  <Sparkles className={cn("mt-0.5 h-4 w-4", isDark ? "text-emerald-300" : "text-emerald-500")} />
                  <div>
                    <p className={cn("font-semibold", isDark ? "text-white" : "text-slate-900")}>{step.label}</p>
                    <p className="text-xs text-slate-500 dark:text-white/60">{step.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section
            className={cn(
              "rounded-3xl border p-5",
              isDark
                ? "border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 text-white"
                : "border-slate-200 bg-white text-slate-900",
            )}
          >
            <h3 className="text-sm font-semibold">Visit location</h3>
            <div className="mt-3 flex items-start gap-3 text-sm text-slate-600 dark:text-white/70">
              <MapPin className={cn("mt-0.5 h-5 w-5 flex-none", isDark ? "text-emerald-300" : "text-emerald-500")} />
              <div>
                <p className={cn("font-medium", isDark ? "text-white" : "text-slate-900")}>
                  {visit.customer?.name ?? "Customer"}
                </p>
                <p>{visit.customer?.addressLine1 ?? "Address on file"}</p>
                {visit.customer?.city ? (
                  <p className="text-xs text-slate-500 dark:text-white/60">{visit.customer.city}</p>
                ) : null}
              </div>
            </div>
          </section>

          {SafetySection}

          <Button
            variant="ghost"
            className={cn(
              "w-fit rounded-full border px-3 py-1 text-sm transition",
              isDark
                ? "border-white/15 bg-white/10 text-white/80 hover:border-emerald-400/60 hover:bg-emerald-500/25 hover:text-emerald-100"
                : "border-slate-200 bg-white text-slate-900 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700",
            )}
            onClick={() => router.push("/field-tech")}
          >
            &larr; Back to route
          </Button>
        </div>
      </main>
    );
  }

  const deleteMediaRecords = useCallback(
    async (mediaIds: string[], { silent }: { silent?: boolean } = {}) => {
      if (!visit || mediaIds.length === 0) return;
      try {
        await Promise.all(
          mediaIds.map((mediaId) =>
            fetch(`/api/field-tech/visits/${visit.id}/media/${mediaId}`, {
              method: "DELETE",
            }),
          ),
        );
        setVisit((prev) =>
          prev
            ? {
                ...prev,
                media: prev.media.filter(
                  (media) => !mediaIds.includes(media.id),
                ),
              }
            : prev,
        );
        if (!silent) {
          toast.success(
            mediaIds.length > 1 ? "Photos deleted" : "Photo deleted",
          );
        }
      } catch (error) {
        console.error("media.delete", error);
        if (!silent) {
          toast.error("Unable to delete photo");
        }
        throw error;
      }
    },
    [visit],
  );

  const handleUpload = useCallback(
    async (
      type: VisitMediaType,
      file?: File | null,
      options: {
        analysisMode?: "log_only" | "analyze";
        notes?: string;
        stoolSampleId?: string;
        stoolSampleView?: "SURFACE" | "CROSS_SECTION";
      } = {},
    ) => {
      if (!visit || !file) return;
      const uploadKey =
        options.stoolSampleId
          ? `${type}-${options.stoolSampleId}-${options.stoolSampleView ?? "SURFACE"}`
          : options.notes ?? type;
      setUploadingType(uploadKey);
      try {
        const shouldReplace =
          type === "PROOF" ||
          type === "GATE" ||
          type === "BAG_DROP" ||
          (type === "OTHER" &&
            (options.notes === SANITATION_SHOES_NOTE ||
              options.notes === SANITATION_TOOLS_NOTE ||
              options.notes === SANITATION_VIDEO_NOTE));
        const replaceableIds = shouldReplace
          ? (visit.media ?? [])
              .filter((media) =>
                media.assetType === type
                  ? type !== "OTHER" || media.notes === options.notes
                  : false,
              )
              .map((media) => media.id)
          : [];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("assetType", type);
        if (options.analysisMode) {
          formData.append("analysisMode", options.analysisMode);
        }
        if (options.notes) {
          formData.append("notes", options.notes);
        }
        if (options.stoolSampleId) {
          formData.append("stoolSampleId", options.stoolSampleId);
        }
        if (options.stoolSampleView) {
          formData.append("stoolSampleView", options.stoolSampleView);
        }
        const response = await fetch(
          `/api/field-tech/visits/${visit.id}/media`,
          {
            method: "POST",
            body: formData,
          },
        );
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error ?? "Upload failed");
        }
        const payload = await response.json();
        if (shouldReplace && replaceableIds.length) {
          await deleteMediaRecords(replaceableIds, { silent: true });
        }
        setVisit((prev) =>
          prev
            ? {
                ...prev,
                media: [...prev.media, payload.media],
                status:
                  prev.status === "SCHEDULED" ? "IN_PROGRESS" : prev.status,
              }
            : prev,
        );
        const label = typeLabel(type, options.notes);
        toast.success(`${label} saved`);
        const targetVisitId = visitIdValue ?? visit.id;
        if (targetVisitId) {
          void loadVisit(targetVisitId);
        }
      } catch (err: any) {
        console.error("Media upload failed", err);
        toast.error(err?.message ?? "Media upload failed");
      } finally {
        setUploadingType(null);
      }
    },
    [deleteMediaRecords, loadVisit, visit, visitIdValue],
  );

  const handleInsightsUpload = useCallback(
    (file: File, options?: { analysisMode?: "log_only" | "analyze" }) =>
      handleUpload("INSIGHTSCOOP", file, options),
    [handleUpload],
  );

  const currentStepIndex = steps.findIndex((step) => step.id === currentStep);
  const safeStepIndex = currentStepIndex === -1 ? 0 : currentStepIndex;
  const activeStep = steps[safeStepIndex];
  const progressPercent = ((safeStepIndex + 1) / steps.length) * 100;
  const nextStepLabel = steps[safeStepIndex + 1]?.label ?? null;

  const goToPreviousStep = useCallback(() => {
    if (safeStepIndex === 0) {
      return;
    }
    setCurrentStep(steps[safeStepIndex - 1].id);
  }, [safeStepIndex, steps]);

  const goToNextStep = useCallback(() => {
    if (safeStepIndex >= steps.length - 1) {
      return;
    }
    setCurrentStep(steps[safeStepIndex + 1].id);
  }, [safeStepIndex, steps]);

  const statusTiles = useMemo<
    Array<{ label: string; ready: boolean; detail: string }>
  >(() => {
    const tiles: Array<{ label: string; ready: boolean; detail: string }> = [
      {
        label: "Arrival confirmed",
        ready: arrivalUnlocked,
        detail: !arrivalRequired
          ? "Not required"
          : arrivalVerified
            ? "GPS verified"
            : "Pending",
      },
      {
        label: "Insights",
        ready: insightsCaptured > 0,
        detail: `${insightsCaptured} saved`,
      },
      {
        label: "Analyzed",
        ready: hasMetAnalysisMinimum,
        detail: `${analyzedSampleCount} AI-reviewed`,
      },
    ];

    if (requiresBagDropPhoto) {
      tiles.push({
        label: "Bag drop proof",
        ready: bagDropMedia.length > 0,
        detail: bagDropMedia.length > 0 ? "Captured" : "Pending",
      });
    }

    tiles.push({
      label: "Gate photo",
      ready: requiresGatePhoto ? gateMedia.length > 0 : true,
      detail: requiresGatePhoto
        ? gateMedia.length > 0
          ? "Captured"
          : "Pending"
        : "Not required",
    });

    tiles.push({
      label: "Sanitation",
      ready: sanitationCaptured,
      detail: hasSanitationClip
        ? "60s clip saved"
        : sanitationCaptured
          ? "Legacy photos"
          : "Pending",
    });

    tiles.push({
      label: "Summary",
      ready: summaryReady,
      detail: hasAnalyzedSamples
        ? hasGeneratedSummary
          ? hasReviewedSummary
            ? "Reviewed"
            : "Needs review"
          : "Generate summary"
        : "Manual 3Cs",
    });

    tiles.push({
      label: "Notification",
      ready: channelAvailable && summaryReady && notificationInitialized,
      detail: channelAvailable
        ? notificationInitialized
          ? "Ready to send"
          : summaryReady
            ? "Draft prepared"
            : "Waiting on summary"
        : "Missing contact",
    });

    return tiles;
  }, [
    analyzedSampleCount,
    arrivalRequired,
    arrivalUnlocked,
    arrivalVerified,
    bagDropMedia.length,
    channelAvailable,
    gateMedia.length,
    hasAnalyzedSamples,
    hasGeneratedSummary,
    hasMetAnalysisMinimum,
    hasReviewedSummary,
    hasSanitationClip,
    insightsCaptured,
    notificationInitialized,
    requiresBagDropPhoto,
    requiresGatePhoto,
    sanitationCaptured,
    summaryReady,
  ]);

  const renderStepContent = () => {
    if (!visit) {
      return null;
    }

    switch (activeStep.id) {
      case "arrival":
        return (
          <div className="flex flex-col gap-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white">
              <h2 className="text-lg font-semibold">
                Confirm you&apos;re onsite
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-white/70">
                We use a quick location check to verify you&apos;re at the
                customer&apos;s address before logging deposits.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-500 dark:text-white/60">
                <li>• Stand near the main entry point or gate.</li>
                <li>• Ensure location services are enabled on your device.</li>
                <li>
                  • If GPS struggles indoors, step outside briefly and try
                  again.
                </li>
              </ul>
              {arrivalError ? (
                <div className="mt-4 rounded-2xl border border-amber-400 bg-amber-100/90 p-3 text-xs font-semibold text-amber-900 dark:border-amber-400/40 dark:bg-amber-500/15 dark:text-amber-50">
                  {arrivalError}
                </div>
              ) : null}
            </div>
            <Button
              size="lg"
              className="h-12 rounded-2xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:cursor-progress"
              onClick={verifyArrivalLocation}
              disabled={arrivalCheckInProgress}
            >
              {arrivalCheckInProgress ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Checking location…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Confirm I&apos;m at the property
                </span>
              )}
            </Button>
            <Button
              variant="secondary"
              className={cn(
                "h-12 rounded-2xl border px-4 text-sm transition",
                isDark
                  ? "border-white/15 bg-white/10 text-white/80 hover:border-emerald-400/60 hover:bg-emerald-500/20 hover:text-emerald-100"
                  : "border-slate-200 bg-white text-slate-900 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700",
              )}
              onClick={goToNextStep}
              disabled={!arrivalUnlocked}
            >
                Next: Check-in
            </Button>
          </div>
        );

      case "setup":
        return (
          <div className="flex flex-col gap-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white">
              <h2 className="text-lg font-semibold">Lock in the mount</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-white/70">
                Seat the phone in the scooper mount so every capture stays
                centered.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-500 dark:text-white/60">
                <li>
                  • Push the mount clip tight and tilt until the bucket fills
                  the guide.
                </li>
                <li>• Tug gently to confirm there’s no wobble or slipping.</li>
                <li>
                  • Test the Bluetooth shutter or volume-up trigger for quick
                  logging.
                </li>
              </ul>
            </div>
            <Button
              size="lg"
              className="h-12 rounded-2xl bg-emerald-500 text-slate-950 hover:bg-emerald-400"
              onClick={goToNextStep}
            >
              Mount locked — let’s capture
            </Button>
          </div>
        );

      case "capture":
        return (
          <div className="flex flex-col gap-5">
            <InsightsCaptureStation
              capturedCount={insightsCaptured}
              uploading={uploadingType === "INSIGHTSCOOP"}
              onUpload={handleInsightsUpload}
              autoLaunch
            />
            <div className="rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white">
              <div className="flex items-center justify-between text-sm text-slate-600 dark:text-white/70">
                <span>Captured: {insightsCaptured}</span>
                <span>Analyzed: {analyzedSampleCount}</span>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-white/60">
                Aim for at least {Math.max(1, analysisGoal)} AI-reviewed
                samples. Single press logs, double press to log + analyze,
                then follow the prompt to capture the cross-section.
              </p>
            </div>
            <Button
              size="lg"
              className="h-12 rounded-2xl bg-emerald-500 text-slate-950 hover:bg-emerald-400"
              onClick={() => {
                if (insightsCaptured === 0) {
                  toast.error("Capture at least one deposit before moving on.");
                  return;
                }
                goToNextStep();
              }}
              disabled={insightsCaptured === 0}
            >
              Next: Confirm yard is clear
            </Button>
          </div>
        );

      case "confirm":
        return (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Every deposit removed
                  </p>
                  <p className="text-xs text-slate-500 dark:text-white/60">
                    Walk the full yard, including corners and flower beds.
                  </p>
                </div>
                <Switch
                  checked={confirmAllDeposits}
                  onCheckedChange={setConfirmAllDeposits}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Analyzed freshest samples
                  </p>
                  <p className="text-xs text-slate-500 dark:text-white/60">
                    Minimum target: {Math.max(1, analysisGoal)} analyzed.
                    Completed: {analyzedSampleCount}.
                  </p>
                </div>
                <Switch
                  checked={confirmAnalyzedFresh}
                  onCheckedChange={setConfirmAnalyzedFresh}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Final yard sweep complete
                  </p>
                  <p className="text-xs text-slate-500 dark:text-white/60">
                    Finish with a full pass to confirm nothing was missed.
                  </p>
                </div>
                <Switch
                  checked={confirmFinalSweep}
                  onCheckedChange={setConfirmFinalSweep}
                />
              </div>
            </div>
            {!hasMetAnalysisMinimum ? (
              <div className="flex items-start gap-3 rounded-3xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-200">
                <AlertTriangle className="h-5 w-5 text-amber-200" />
                <span className="text-xs md:text-sm">
                  Analyze at least {Math.max(1, analysisGoal)} of the freshest
                  samples so we can surface trends for the family.
                </span>
              </div>
            ) : null}
            <Button
              size="lg"
              className="h-12 rounded-2xl bg-emerald-500 text-slate-950 hover:bg-emerald-400"
              onClick={goToNextStep}
              disabled={!confirmationsReady || !hasMetAnalysisMinimum}
            >
              {nextStepLabel ? `Next: ${nextStepLabel}` : "Next"}
            </Button>
          </div>
        );

      case "bag_drop":
        return (
          <div className="flex flex-col gap-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white">
              <h2 className="text-lg font-semibold">Bag drop proof</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-white/70">
                Leave the sealed bag in {bagDropLabel}. Snap a quick photo before
                you exit. Enable your phone flash if the bin area is dim.
              </p>
              <SinglePhotoCamera
                onCapture={(file) => handleUpload("BAG_DROP", file)}
                label="Bag drop photo"
                capturedImageUrl={bagDropMedia[0]?.url}
                uploading={uploadingType === "BAG_DROP"}
              />
            </div>
            <Button
              size="lg"
              className="h-12 rounded-2xl bg-emerald-500 text-slate-950 hover:bg-emerald-400"
              onClick={goToNextStep}
              disabled={bagDropMedia.length === 0}
            >
              {nextStepLabel ? `Next: ${nextStepLabel}` : "Next"}
            </Button>
          </div>
        );

      case "gate":
        return (
          <div className="flex flex-col gap-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white">
              <h2 className="text-lg font-semibold">Gate secured</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-white/70">
                Capture the closed latch and a glimpse of the yard so families
                know everything is locked up.
              </p>
              <SinglePhotoCamera
                onCapture={(file) => handleUpload("GATE", file)}
                label="Gate photo"
                capturedImageUrl={gateMedia[0]?.url}
                uploading={uploadingType === "GATE"}
              />
            </div>
            <Button
              size="lg"
              className="h-12 rounded-2xl bg-emerald-500 text-slate-950 hover:bg-emerald-400"
              onClick={goToNextStep}
              disabled={requiresGatePhoto && gateMedia.length === 0}
            >
              {nextStepLabel ? `Next: ${nextStepLabel}` : "Next"}
            </Button>
          </div>
        );

      case "sanitation":
        return (
          <div className="flex flex-col gap-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white">
              <h2 className="text-lg font-semibold">Post-visit sanitation</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-white/70">
                Record a single clip sanitizing boots and equipment so QA can
                confirm the full process.
              </p>
            </div>
            <SanitationVideoRecorder
              existingUrl={sanitationVideoMedia[0]?.url}
              uploading={uploadingType === SANITATION_VIDEO_NOTE}
              onUpload={(file) =>
                handleUpload("OTHER", file, {
                  notes: SANITATION_VIDEO_NOTE,
                  analysisMode: "log_only",
                })
              }
              onVideoRecorded={() => setSanitationVideoRecorded(true)}
            />

            {!hasSanitationClip &&
            (sanitationShoesMedia.length > 0 ||
              sanitationToolsMedia.length > 0) ? (
              <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white">
                <p className="text-sm font-semibold">
                  Legacy sanitation photos
                </p>
                <p className="text-xs text-slate-500 dark:text-white/60">
                  These backups from earlier visits remain attached, but you
                  still need a 60s sanitation clip going forward.
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {sanitationShoesMedia[0]?.url ? (
                    <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={sanitationShoesMedia[0].url ?? ""}
                        alt="Sanitized shoes"
                        className="h-40 w-full object-cover"
                      />
                    </div>
                  ) : null}
                  {sanitationToolsMedia[0]?.url ? (
                    <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={sanitationToolsMedia[0].url ?? ""}
                        alt="Sanitized equipment"
                        className="h-40 w-full object-cover"
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <Button
              size="lg"
              className="h-12 rounded-2xl bg-emerald-500 text-slate-950 hover:bg-emerald-400"
              onClick={goToNextStep}
              disabled={!sanitationCaptured}
            >
              {nextStepLabel ? `Next: ${nextStepLabel}` : "Next"}
            </Button>
          </div>
        );

      case "review": {
        const flaggedCount = lastSummary?.flaggedSampleIndices?.length ?? 0;
        const serviceMedia = (visit?.media ?? []).filter(
          (item) => item.assetType !== "INSIGHTSCOOP",
        );

        // Full-screen loading overlay when generating summary
        if (generatingSummary) {
          return (
            <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
              <div className="relative">
                {/* Pulsing background circles */}
                <div className="absolute inset-0 animate-ping rounded-full bg-emerald-500/20" style={{ animationDuration: "2s" }} />
                <div className="absolute inset-0 animate-ping rounded-full bg-emerald-500/15" style={{ animationDuration: "2.5s", animationDelay: "0.3s" }} />
                {/* Main icon container */}
                <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/20 backdrop-blur">
                  <Sparkles className="h-10 w-10 animate-pulse text-emerald-400" />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  Analyzing samples...
                </h2>
                <p className="max-w-xs text-sm text-slate-600 dark:text-white/70">
                  Our AI is reviewing all captured samples to generate the 3C summary and wellness insights.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>This may take a moment</span>
              </div>
            </div>
          );
        }

        return (
          <div className="flex flex-col gap-4">
            {hasAnalyzedSamples ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">AI summary</h2>
                      <p className="text-sm text-slate-600 dark:text-white/70">
                        Generate the visit summary before continuing. Regenerate
                        if you make additional changes.
                      </p>
                    </div>
                    <Button
                      onClick={handleGenerateSummary}
                      disabled={generatingSummary}
                      variant="ghost"
                      className={cn(
                        "sm:w-auto rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 transition dark:border-white/15 dark:bg-white/10 dark:text-white",
                        generatingSummary
                          ? "cursor-progress border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-white/60"
                          : "hover:border-emerald-400 hover:bg-emerald-100 hover:text-emerald-800 dark:hover:border-emerald-400/60 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-100",
                      )}
                    >
                      {generatingSummary ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Analyzing…
                        </span>
                      ) : hasGeneratedSummary ? (
                        <span className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          Regenerate summary
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          Generate summary
                        </span>
                      )}
                    </Button>
                  </div>

                  {hasGeneratedSummary ? (
                    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm dark:border-emerald-400/40 dark:bg-emerald-500/10">
                          <p className="font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
                            Color
                          </p>
                          <p className="mt-1 text-emerald-800 dark:text-emerald-100/80">
                            {color || "—"}
                          </p>
                        </div>
                        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm dark:border-emerald-400/40 dark:bg-emerald-500/10">
                          <p className="font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
                            Consistency
                          </p>
                          <p className="mt-1 text-emerald-800 dark:text-emerald-100/80">
                            {consistency || "—"}
                          </p>
                        </div>
                        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm dark:border-emerald-400/40 dark:bg-emerald-500/10">
                          <p className="font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
                            Content
                          </p>
                          <p className="mt-1 text-emerald-800 dark:text-emerald-100/80">
                            {content || "—"}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm dark:border-emerald-400/40 dark:bg-emerald-500/10">
                        <p className="font-semibold text-emerald-700 dark:text-emerald-200">
                          Observations
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-emerald-800 dark:text-emerald-100/80">
                          {observations ||
                            "No additional observations captured."}
                        </p>
                      </div>

                      {flaggedCount > 0 ? (
                        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/15 dark:text-amber-200">
                          {`AI flagged ${flaggedCount} sample${flaggedCount === 1 ? "" : "s"}. Support automatically reviews these — no extra action required on-site.`}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 dark:text-white/60">
                          No wellness flags detected in the analyzed samples.
                        </p>
                      )}

                      <Button
                        variant={hasReviewedSummary ? "default" : "secondary"}
                        className="sm:w-auto"
                        onClick={() => setHasReviewedSummary(true)}
                      >
                        {hasReviewedSummary
                          ? "Summary reviewed"
                          : "Mark summary reviewed"}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-white/60">
                      Generate the summary to auto-fill the 3Cs and unlock the
                      next step.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white">
                <h2 className="text-lg font-semibold">Record manual 3Cs</h2>
                <p className="text-sm text-slate-600 dark:text-white/70">
                  AI analysis isn’t available yet. Record today’s color,
                  consistency, and content before continuing.
                </p>
                <VisualPicker
                  label="Color"
                  value={color}
                  onValueChange={setColor}
                  items={COLOR_CHOICES}
                  colorMap={{
                    Normal: {
                      bg: "bg-emerald-100",
                      border: "border-emerald-500",
                      text: "text-emerald-800",
                      icon: (
                        <div className="h-3 w-3 rounded-full bg-emerald-600" />
                      ),
                    },
                    Dark: {
                      bg: "bg-amber-100",
                      border: "border-amber-500",
                      text: "text-amber-800",
                      icon: (
                        <div className="h-3 w-3 rounded-full bg-amber-700" />
                      ),
                    },
                    Light: {
                      bg: "bg-yellow-100",
                      border: "border-yellow-500",
                      text: "text-yellow-800",
                      icon: (
                        <div className="h-3 w-3 rounded-full bg-yellow-500" />
                      ),
                    },
                    Mixed: {
                      bg: "bg-purple-100",
                      border: "border-purple-500",
                      text: "text-purple-800",
                      icon: (
                        <div className="h-3 w-3 rounded-full bg-gradient-to-r from-yellow-500 to-emerald-600" />
                      ),
                    },
                    Other: {
                      bg: "bg-slate-100",
                      border: "border-slate-400",
                      text: "text-slate-700",
                      icon: (
                        <div className="h-3 w-3 rounded-full bg-slate-500" />
                      ),
                    },
                  }}
                />
                <VisualPicker
                  label="Consistency"
                  value={consistency}
                  onValueChange={setConsistency}
                  items={CONSISTENCY_CHOICES}
                  colorMap={{
                    Firm: {
                      bg: "bg-emerald-100",
                      border: "border-emerald-500",
                      text: "text-emerald-800",
                      icon: (
                        <div className="h-3 w-3 rounded-sm bg-emerald-600" />
                      ),
                    },
                    Soft: {
                      bg: "bg-amber-100",
                      border: "border-amber-500",
                      text: "text-amber-800",
                      icon: (
                        <div className="h-3 w-3 rounded-full bg-amber-600" />
                      ),
                    },
                    Loose: {
                      bg: "bg-orange-100",
                      border: "border-orange-500",
                      text: "text-orange-800",
                      icon: (
                        <div className="h-3 w-3 rounded-lg bg-orange-600 opacity-70" />
                      ),
                    },
                    Watery: {
                      bg: "bg-red-100",
                      border: "border-red-500",
                      text: "text-red-800",
                      icon: <Droplet className="h-3 w-3" />,
                    },
                    Other: {
                      bg: "bg-slate-100",
                      border: "border-slate-400",
                      text: "text-slate-700",
                      icon: (
                        <div className="h-3 w-3 rounded-full bg-slate-500" />
                      ),
                    },
                  }}
                />
                <VisualPicker
                  label="Content"
                  value={content}
                  onValueChange={setContent}
                  items={CONTENT_CHOICES}
                  colorMap={{
                    Typical: {
                      bg: "bg-emerald-100",
                      border: "border-emerald-500",
                      text: "text-emerald-800",
                      icon: <CheckCircle className="h-3 w-3" />,
                    },
                    Mucus: {
                      bg: "bg-amber-100",
                      border: "border-amber-500",
                      text: "text-amber-800",
                      icon: <AlertTriangle className="h-3 w-3" />,
                    },
                    Blood: {
                      bg: "bg-red-100",
                      border: "border-red-500",
                      text: "text-red-800",
                      icon: <AlertTriangle className="h-3 w-3" />,
                    },
                    "Foreign material": {
                      bg: "bg-orange-100",
                      border: "border-orange-500",
                      text: "text-orange-800",
                      icon: <AlertTriangle className="h-3 w-3" />,
                    },
                    Other: {
                      bg: "bg-slate-100",
                      border: "border-slate-400",
                      text: "text-slate-700",
                      icon: (
                        <div className="h-3 w-3 rounded-full bg-slate-500" />
                      ),
                    },
                  }}
                />
              </div>
            )}

            <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white">
              <div className="flex flex-col gap-2">
                <Label htmlFor="observations">Observations</Label>
                <Textarea
                  id="observations"
                  value={observations}
                  onChange={(event) => setObservations(event.target.value)}
                  placeholder="Surface any notes the client should know — e.g., debris, obstructions, or wellness concerns."
                  rows={3}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="custom-note">
                  Custom client note (optional)
                </Label>
                <Textarea
                  id="custom-note"
                  value={customNote}
                  onChange={(event) => setCustomNote(event.target.value)}
                  placeholder="Adds one line to the outgoing message."
                  rows={2}
                />
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-white/15 bg-white/5 p-4">
                <Switch
                  id="wellness-flag"
                  checked={wellnessFlag}
                  onCheckedChange={(checked) => {
                    setWellnessFlag(checked);
                    if (!checked) setFlagReason("");
                  }}
                />
                <div className="flex-1">
                  <Label
                    htmlFor="wellness-flag"
                    className="text-sm font-medium"
                  >
                    Flag for follow-up
                  </Label>
                  <p className="text-xs text-slate-500 dark:text-white/60">
                    Sends this visit to support with your context.
                  </p>
                  {wellnessFlag ? (
                    <Textarea
                      className="mt-2"
                      value={flagReason}
                      onChange={(event) => setFlagReason(event.target.value)}
                      placeholder="Describe what needs follow-up."
                      rows={2}
                    />
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white">
              <button
                onClick={() => setShowOptionalExtras(!showOptionalExtras)}
                className="flex w-full items-center justify-between text-left"
              >
                <div>
                  <h3 className="text-sm font-semibold">Optional extras</h3>
                  <p className="text-xs text-slate-500 dark:text-white/60">
                    Document issues or other context to flag during the visit recap.
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 text-slate-600 dark:text-white/70 transition-transform",
                    showOptionalExtras && "rotate-180"
                  )}
                />
              </button>
              {showOptionalExtras && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {OPTIONAL_TYPES.map((type) => {
                    const capturedMedia =
                      type === "OTHER"
                        ? otherMiscMedia[0]
                        : (mediaByType[type] ?? [])[0];
                    return (
                      <SinglePhotoCamera
                        key={type}
                        onCapture={(file) => handleUpload(type, file)}
                        label={typeLabel(type, capturedMedia?.notes)}
                        capturedImageUrl={capturedMedia?.url}
                        uploading={uploadingType === type}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Insight camera samples
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-white/60">
                    Flagged samples appear automatically. Expand to review or
                    delete other captures.
                  </p>
                </div>
                {unflaggedInsightSamples.length > 0 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-600 dark:text-white/70 hover:text-emerald-300"
                    onClick={() => setShowAllSamples((prev) => !prev)}
                  >
                    {showAllSamples ? (
                      <>
                        <ChevronUp className="mr-1 h-4 w-4" /> Hide non-flagged
                      </>
                    ) : (
                      <>
                        <ChevronDown className="mr-1 h-4 w-4" /> Review other
                        samples
                      </>
                    )}
                  </Button>
                ) : null}
              </div>
              {flaggedInsightSamples.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500 dark:text-white/60">
                  No AI flags for this visit.
                </p>
              ) : (
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {flaggedInsightSamples.map((sample) => {
                    const sampleNumber =
                      insightMedia.findIndex(
                        (media) => media.id === sample.id,
                      ) + 1;
                    const companion = sample.stoolSampleId
                      ? crossSectionMap.get(sample.stoolSampleId)
                      : null;
                    return (
                      <div
                        key={sample.id}
                        className="flex flex-col gap-2 rounded-2xl border border-amber-400/40 bg-amber-500/15 p-3 text-amber-100"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold">
                            Flagged sample #{sampleNumber || "—"}
                          </span>
                          <Badge
                            variant="destructive"
                            className="bg-amber-400 text-amber-900"
                          >
                            Needs review
                          </Badge>
                        </div>
                        {sample.url ? (
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <div className="overflow-hidden rounded-xl border border-amber-300/40">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={sample.url}
                                alt={`Sample ${sampleNumber}`}
                                className="h-32 w-full object-cover"
                              />
                            </div>
                            {companion?.url ? (
                              <div className="overflow-hidden rounded-xl border border-amber-300/30">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={companion.url}
                                  alt={`Sample ${sampleNumber} cross-section`}
                                  className="h-32 w-full object-cover"
                                />
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="flex gap-2 text-xs">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 border-white/20 bg-white/10 text-white hover:border-emerald-400/60 hover:bg-emerald-500/20 hover:text-emerald-100"
                            onClick={() => handleReanalyze(sample.id)}
                            disabled={reanalyzingMediaId === sample.id}
                          >
                            {reanalyzingMediaId === sample.id ? (
                              <>
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />{" "}
                                Re-running…
                              </>
                            ) : (
                              <>
                                <Sparkles className="mr-1 h-3 w-3" /> Re-run AI
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 border-white/20 bg-white/10 text-white hover:border-emerald-400/60 hover:bg-emerald-500/20 hover:text-emerald-100"
                            onClick={() => handleDeleteMedia(sample.id)}
                            disabled={deletingMediaId === sample.id}
                          >
                            {deletingMediaId === sample.id ? (
                              <>
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />{" "}
                                Removing…
                              </>
                            ) : (
                              <>
                                <Trash2 className="mr-1 h-3 w-3" /> Delete photo
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {showAllSamples && unflaggedInsightSamples.length > 0 ? (
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {unflaggedInsightSamples.map((sample) => {
                    const sampleNumber =
                      insightMedia.findIndex(
                        (media) => media.id === sample.id,
                      ) + 1;
                    const companion = sample.stoolSampleId
                      ? crossSectionMap.get(sample.stoolSampleId)
                      : null;
                    return (
                      <div
                        key={sample.id}
                        className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
                      >
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-white/60">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            Sample #{sampleNumber || "—"}
                          </span>
                          <Badge
                            variant="secondary"
                            className="bg-white/10 text-slate-600 dark:text-white/70"
                          >
                            {sample.analysisStatus.toLowerCase()}
                          </Badge>
                        </div>
                        {sample.url ? (
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <div className="overflow-hidden rounded-xl border border-white/10">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={sample.url}
                                alt={`Sample ${sampleNumber}`}
                                className="h-32 w-full object-cover"
                              />
                            </div>
                            {companion?.url ? (
                              <div className="overflow-hidden rounded-xl border border-white/10">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={companion.url}
                                  alt={`Sample ${sampleNumber} cross-section`}
                                  className="h-32 w-full object-cover"
                                />
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="flex gap-2 text-xs">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 border-white/20 bg-white/10 text-white hover:border-emerald-400/60 hover:bg-emerald-500/20 hover:text-emerald-100"
                            onClick={() => handleReanalyze(sample.id)}
                            disabled={reanalyzingMediaId === sample.id}
                          >
                            {reanalyzingMediaId === sample.id ? (
                              <>
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />{" "}
                                Re-running…
                              </>
                            ) : (
                              <>
                                <Sparkles className="mr-1 h-3 w-3" /> Re-run AI
                              </>
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-500 dark:text-white/60 hover:text-red-400"
                            onClick={() => handleDeleteMedia(sample.id)}
                            disabled={deletingMediaId === sample.id}
                          >
                            {deletingMediaId === sample.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white">
              <h3 className="text-sm font-semibold">Service photos</h3>
              <p className="text-xs text-slate-500 dark:text-white/60">
                Proof, gate, and sanitation media captured this visit.
              </p>
              {serviceMedia.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500 dark:text-white/60">
                  No service photos uploaded yet.
                </p>
              ) : (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {serviceMedia.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-white/60">
                        <span className="font-medium text-slate-900 dark:text-white">
                          {typeLabel(item.assetType, item.notes)}
                        </span>
                        <div className="flex items-center gap-1">
                          <span>
                            {format(new Date(item.capturedAt), "h:mmaaa")}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-500 dark:text-white/60 hover:text-red-400"
                            onClick={() => handleDeleteMedia(item.id)}
                            disabled={deletingMediaId === item.id}
                          >
                            {deletingMediaId === item.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                      {item.url ? (
                        <div className="overflow-hidden rounded-xl border border-white/10">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.url}
                            alt={typeLabel(item.assetType, item.notes)}
                            className="h-32 w-full object-cover"
                          />
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button
              size="lg"
              className="h-12 rounded-2xl bg-emerald-500 text-slate-950 hover:bg-emerald-400"
              onClick={goToNextStep}
              disabled={!summaryReady}
            >
              Next: Notify client
            </Button>
          </div>
        );
      }
      case "notify": {
        const hasSms = Boolean(visit?.customer?.phone);
        const hasEmail = Boolean(visit?.customer?.email);
        const channelNotes =
          notificationChannel === "SMS"
            ? hasSms
              ? `We’ll text ${visit?.customer?.phone} with the recap and media.`
              : "Client phone missing — add a number to enable SMS."
            : hasEmail
              ? `We’ll email ${visit?.customer?.email} with the summary and attachments.`
              : "Client email missing — add an address or switch to SMS.";
        return (
          <div className="flex flex-col gap-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white">
              <h2 className="text-lg font-semibold">Send the wrap-up</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-white/70">
                Choose how the family receives their recap and supporting media.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  className={cn(
                    "h-12 rounded-2xl border border-slate-300 bg-slate-100 text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:border-emerald-400/60 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-100",
                    notificationChannel === "SMS" &&
                      "border-emerald-400 bg-emerald-500 text-white hover:bg-emerald-400 dark:text-slate-950",
                    !hasSms && "cursor-not-allowed opacity-40",
                  )}
                  onClick={() => {
                    if (hasSms) setNotificationChannel("SMS");
                  }}
                  disabled={!hasSms}
                >
                  Text message
                </Button>
                <Button
                  type="button"
                  className={cn(
                    "h-12 rounded-2xl border border-slate-300 bg-slate-100 text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:border-emerald-400/60 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-100",
                    notificationChannel === "EMAIL" &&
                      "border-emerald-400 bg-emerald-500 text-white hover:bg-emerald-400 dark:text-slate-950",
                    !hasEmail && "cursor-not-allowed opacity-40",
                  )}
                  onClick={() => {
                    if (hasEmail) setNotificationChannel("EMAIL");
                  }}
                  disabled={!hasEmail}
                >
                  Email
                </Button>
              </div>
              <div className="mt-4 space-y-2 text-xs text-slate-500 dark:text-white/60">
                <p>Client phone: {visit?.customer?.phone ?? "—"}</p>
                <p>Client email: {visit?.customer?.email ?? "—"}</p>
              </div>
              {!channelAvailable ? (
                <div className="mt-3 flex items-start gap-2 rounded-2xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">
                  <AlertTriangle className="h-4 w-4" />
                  <span>
                    Add the missing contact or choose the available channel to
                    continue.
                  </span>
                </div>
              ) : null}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white">
              <h3 className="text-sm font-semibold">Delivery preview</h3>
              <p className="mt-2 text-xs text-slate-500 dark:text-white/60">{channelNotes}</p>
              <ul className="mt-3 space-y-2 text-xs text-slate-500 dark:text-white/60">
                <li>• Visit summary with today’s 3Cs</li>
                <li>• Proof, gate, and sanitation media links</li>
                <li>• AI insights and any flagged observations</li>
              </ul>
            </div>

            <Button
              size="lg"
              className="h-12 rounded-2xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed"
              onClick={handleComplete}
              disabled={!canComplete}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending…
                </span>
              ) : notificationChannel === "SMS" ? (
                "Send text & complete"
              ) : (
                "Send email & complete"
              )}
            </Button>
          </div>
        );
      }

      default:
        return null;
    }
  };

  const handleReanalyze = useCallback(
    async (mediaId: string) => {
      if (!visit) return;
      setReanalyzingMediaId(mediaId);
      try {
        const response = await fetch(
          `/api/field-tech/visits/${visit.id}/media/${mediaId}/reanalyze`,
          { method: "POST" },
        );
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error ?? "Unable to re-run analysis");
        }
        if (payload?.media) {
          setVisit((prev) =>
            prev
              ? {
                  ...prev,
                  media: prev.media.map((item) =>
                    item.id === mediaId ? { ...item, ...payload.media } : item,
                  ),
                }
              : prev,
          );
        }
        toast.success("Analysis re-queued");
        const targetVisitId = visitIdValue ?? visit.id;
        if (targetVisitId) {
          void loadVisit(targetVisitId);
        }
      } catch (err: any) {
        console.error("Media reanalysis failed", err);
        toast.error(err?.message ?? "Unable to re-run analysis");
      } finally {
        setReanalyzingMediaId(null);
      }
    },
    [loadVisit, visit, visitIdValue],
  );

  const handleDeleteMedia = useCallback(
    async (mediaId: string) => {
      if (!visit) return;
      if (!confirm("Delete this photo? This cannot be undone.")) return;

      setDeletingMediaId(mediaId);
      try {
        await deleteMediaRecords([mediaId], { silent: true });
        toast.success("Photo deleted");
      } catch (error: any) {
        console.error("Delete failed", error);
        toast.error(error?.message ?? "Unable to delete photo");
      } finally {
        setDeletingMediaId(null);
      }
    },
    [deleteMediaRecords, visit],
  );

  const handleGenerateSummary = async () => {
    if (!visit) return;
    setGeneratingSummary(true);

    const applySummary = (summary: any) => {
      setColor(summary.color || "");
      setConsistency(summary.consistency || "");
      setContent(summary.content || "");

      let obs = summary.observations || "";
      if (summary.totalSamples > 0) {
        const viewLink = `${window.location.origin}/visits/${visit.id}/samples`;
        obs += `\n\nView all ${summary.totalSamples} analyzed samples: ${viewLink}`;
      }

      if (summary.flaggedSampleIndices?.length > 0) {
        const flaggedNums = summary.flaggedSampleIndices.map((i: number) => i + 1);
        obs += `\n\nSamples needing attention: ${flaggedNums.join(", ")}`;
      }

      setObservations(obs);
      setWellnessFlag(summary.wellnessFlag || false);
      setFlagReason(summary.flagReason || "");
      setLastSummary(summary as SummarySnapshot);
      setHasGeneratedSummary(true);
      setHasReviewedSummary(false);
    };

    try {
      const response = await fetch(
        `/api/field-tech/visits/${visit.id}/generate-summary`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(payload?.error ?? "Unable to generate summary");
        return;
      }

      let summaryData = payload?.summary ?? null;

      if (!summaryData) {
        const queuedJobId =
          (payload?.data && typeof payload.data.jobId === "string" && payload.data.jobId) ||
          (typeof payload?.jobId === "string" ? payload.jobId : null);

        if (queuedJobId) {
          summaryData = await pollVisitSummaryJob(visit.id, queuedJobId);
        }
      }

      if (summaryData) {
        applySummary(summaryData);
        toast.success("Summary generated from all analyzed samples!");
      } else {
        toast.error("No summary data returned");
      }
    } catch (err: any) {
      console.error("Summary generation failed", err);
      toast.error(err?.message ?? "Unable to generate summary");
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleComplete = async () => {
    if (!visit) return;
    setSubmitting(true);
    try {
      const totalSamples = lastSummary?.totalSamples ?? insightsCaptured;
      const flaggedSampleReasons = Array.isArray(
        lastSummary?.flaggedSampleReasons,
      )
        ? lastSummary!.flaggedSampleReasons.filter(
            (reason) => typeof reason === "string" && reason.trim().length > 0,
          )
        : [];

      const response = await fetch(
        `/api/field-tech/visits/${visit.id}/complete`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            color,
            consistency,
            content,
            observations: observations || undefined,
            wellnessFlag,
            flagReason: wellnessFlag ? flagReason || undefined : undefined,
            customNote: customNote || undefined,
            notificationChannel,
            sampleCount: totalSamples > 0 ? totalSamples : undefined,
            flaggedSampleReasons,
          }),
        },
      );

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        if (payload?.missing?.length) {
          toast.error(
            `Missing required photos: ${payload.missing
              .map((type: string) => typeLabel(type as VisitMediaType))
              .join(", ")}`,
          );
        } else if (payload?.error === "missing_sanitation_proof") {
          toast.error("Upload sanitation proof before completing the visit.");
          setCurrentStep("sanitation");
        } else if (payload?.error === "missing_or_invalid_phone") {
          toast.error(
            "Client phone missing — visit logged but SMS could not be sent.",
          );
        } else if (payload?.error === "missing_or_invalid_email") {
          toast.error(
            "Client email missing — add an email or choose text message instead.",
          );
        } else if (payload?.error === "validation_error") {
          toast.error(
            "Summary details are incomplete. Double-check the review step.",
          );
        } else {
          toast.error(payload?.error ?? "Unable to complete visit");
        }
        return;
      }

      // Show celebration with payout amount
      const payoutAmount = typeof payload?.payoutCents === "number" ? payload.payoutCents : null;
      setEarnedPayoutCents(payoutAmount);
      setShowPayoutCelebration(true);
      
      // Auto-redirect after celebration
      setTimeout(() => {
        router.push("/field-tech");
      }, 3500);
    } catch (err: any) {
      console.error("Visit completion failed", err);
      toast.error(err?.message ?? "Unable to complete visit");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className={cn("flex min-h-screen items-center justify-center px-4", centeredSurfaceClass)}>
        <div className="w-full max-w-md space-y-4">
          <Skeleton className={cn("h-12 w-2/3 rounded-xl", loadingSkeletonClass)} />
          <div className="mt-6 flex flex-col gap-4">
            <Skeleton className={cn("h-40 w-full rounded-3xl", loadingSkeletonClass)} />
            <Skeleton className={cn("h-64 w-full rounded-3xl", loadingSkeletonClass)} />
          </div>
        </div>
      </main>
    );
  }

  if (error || !visit) {
    return (
      <main className={cn("flex min-h-screen items-center justify-center px-4 text-center", centeredSurfaceClass)}>
        <div className="flex w-full max-w-sm flex-col items-center gap-4">
          <p>{error ?? "Visit not found"}</p>
          <Button
            variant="ghost"
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm transition",
              isDark
                ? "border-white/15 bg-white/10 text-white/80 hover:border-emerald-400/60 hover:bg-emerald-500/25 hover:text-emerald-100"
                : "border-slate-200 bg-white text-slate-900 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700",
            )}
            onClick={() => router.push("/field-tech")}
          >
            &larr; Back to route
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className={cn("relative flex min-h-screen w-full flex-col transition-colors", pageSurfaceClass)}>
      <div className={cn("pointer-events-none absolute inset-0 -z-10", gradientOverlayClass)} />
      
      {/* Payout Celebration Overlay */}
      <AnimatePresence>
        {showPayoutCelebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ 
                type: "spring", 
                damping: 20, 
                stiffness: 300,
                delay: 0.1 
              }}
              className="flex flex-col items-center gap-6 px-8 text-center"
            >
              {/* Animated checkmark */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ 
                  type: "spring", 
                  damping: 15, 
                  stiffness: 200,
                  delay: 0.2 
                }}
                className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500 shadow-[0_0_60px_rgba(16,185,129,0.5)]"
              >
                <motion.svg
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.4, delay: 0.4 }}
                  className="h-12 w-12 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <motion.path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </motion.svg>
              </motion.div>

              {/* Success text */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="space-y-2"
              >
                <h2 className="text-2xl font-bold text-white">Visit Complete!</h2>
                <p className="text-white/70">Great work on this stop</p>
              </motion.div>

              {/* Payout amount */}
              {earnedPayoutCents !== null && earnedPayoutCents > 0 && (
                <motion.div
                  initial={{ y: 20, opacity: 0, scale: 0.9 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  transition={{ 
                    type: "spring",
                    damping: 15,
                    stiffness: 200,
                    delay: 0.7 
                  }}
                  className="rounded-2xl border border-emerald-500/30 bg-emerald-500/20 px-8 py-4 backdrop-blur"
                >
                  <p className="text-sm font-medium text-emerald-300">You earned</p>
                  <motion.p
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ 
                      type: "spring", 
                      damping: 10, 
                      stiffness: 200,
                      delay: 0.9 
                    }}
                    className="text-4xl font-black text-emerald-400"
                  >
                    ${(earnedPayoutCents / 100).toFixed(2)}
                  </motion.p>
                </motion.div>
              )}

              {/* Loading indicator */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
                className="flex items-center gap-2 text-sm text-white/50"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Returning to route...</span>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pb-24 pt-6">
        <header className="flex flex-col gap-2">
          <Button
            variant="ghost"
            className={cn(
              "w-fit rounded-full border px-3 py-1 text-sm transition",
              isDark
                ? "border-white/15 bg-white/10 text-white/80 hover:border-emerald-400/70 hover:bg-emerald-500/25 hover:text-emerald-100"
                : "border-slate-200 bg-white text-slate-900 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700",
            )}
            onClick={() => router.push("/field-tech")}
          >
            &larr; Back to route
          </Button>
          <div>
            <h1 className={cn("text-2xl font-semibold", isDark ? "text-white" : "text-slate-900")}>
              {visit.customer?.name ?? "Client"}
            </h1>
            <p className="text-sm text-slate-600 dark:text-white/70">
              {visit.customer?.addressLine1}
              {visit.customer?.city ? `, ${visit.customer.city}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-white/60">
            <Badge className={cn(isDark ? "bg-white/10 text-white/80" : "bg-slate-100 text-slate-800")}>
              {visit.status.replace("_", " ")}
            </Badge>
            <span>
              {format(new Date(visit.scheduledDate), "eee MMM d • h:mmaaa")}
            </span>
          </div>
        </header>

        <section className="rounded-3xl border border-slate-200/60 bg-white p-5 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-white/60">
            <span>
              Step {safeStepIndex + 1} of {steps.length}
            </span>
            <span>{activeStep.label}</span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-slate-600 dark:text-white/70">{activeStep.description}</p>
        </section>

        {SafetySection}

        {renderStepContent()}

        <section className="rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white">
          <h2 className="text-sm font-semibold">
            Visit steps
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {steps.map((step, idx) => {
              const isCurrent = idx === safeStepIndex;
              const isCompleted = idx < safeStepIndex;
              const isClickable = isCompleted || isCurrent;

              return (
                <button
                  key={step.id}
                  type="button"
                  disabled={!isClickable}
                  onClick={() => isClickable && setCurrentStep(step.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition",
                    isCurrent
                      ? "bg-emerald-500 text-white shadow-md"
                      : isCompleted
                        ? isDark
                          ? "border border-emerald-500/50 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                          : "border border-emerald-400 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : isDark
                          ? "border border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                          : "border border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed",
                  )}
                >
                  <span className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold",
                    isCurrent
                      ? "bg-white/25 text-white"
                      : isCompleted
                        ? isDark
                          ? "bg-emerald-500/40 text-emerald-200"
                          : "bg-emerald-200 text-emerald-700"
                        : isDark
                          ? "bg-white/10 text-white/40"
                          : "bg-slate-200 text-slate-400"
                  )}>
                    {isCompleted ? "✓" : idx + 1}
                  </span>
                  {step.label}
                </button>
              );
            })}
          </div>
        </section>

        {safeStepIndex > 0 ? (
          <Button
            variant="ghost"
            className={cn(
              "self-start rounded-full border px-3 py-1 text-sm transition",
              isDark
                ? "border-white/15 bg-white/10 text-white/80 hover:border-emerald-400/60 hover:bg-emerald-500/25 hover:text-emerald-100"
                : "border-slate-200 bg-white text-slate-900 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700",
            )}
            onClick={goToPreviousStep}
          >
            &larr; Back to {steps[safeStepIndex - 1].label.toLowerCase()}
          </Button>
        ) : null}
      </div>
    </main>
  );
}

function VisualPicker({
  label,
  value,
  onValueChange,
  items,
  colorMap,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  items: string[];
  colorMap: Record<
    string,
    { bg: string; border: string; text: string; icon?: React.ReactNode }
  >;
}) {
  const hasSelection = value && value.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <Label className="text-sm font-medium">
        {label}
        {!hasSelection && (
          <span className="ml-2 text-xs text-red-500 font-normal">
            (Please select one)
          </span>
        )}
      </Label>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const isSelected = value === item;
          const colors = colorMap[item] || {
            bg: "bg-slate-100",
            border: "border-slate-300",
            text: "text-slate-700",
          };
          return (
            <button
              key={item}
              type="button"
              onClick={() => onValueChange(item)}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm
                transition-all duration-200 border-2
                ${colors.bg} ${colors.border} ${colors.text}
                ${isSelected ? "ring-2 ring-offset-2 ring-blue-500 scale-105 opacity-100" : "opacity-70 hover:opacity-100 hover:scale-[1.02]"}
              `}
            >
              {colors.icon}
              {item}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Picker({
  label,
  placeholder,
  value,
  onValueChange,
  items,
}: {
  label: string;
  placeholder: string;
  value: string;
  onValueChange: (value: string) => void;
  items: string[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem value={item} key={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function typeLabel(type: VisitMediaType, note?: string | null): string {
  switch (type) {
    case "INSIGHTSCOOP":
      return "Insight detail";
    case "PROOF":
      return "Proof shot";
    case "GATE":
      return "Gate closed";
    case "BAG_DROP":
      return "Bag drop proof";
    case "ARRIVAL":
      return "Arrival";
    case "ISSUE":
      return "Issue";
    case "OTHER":
      if (note === SANITATION_SHOES_NOTE) return "Sanitation – Shoes";
      if (note === SANITATION_TOOLS_NOTE) return "Sanitation – Equipment";
      if (note === SANITATION_VIDEO_NOTE) return "Sanitation clip";
      return "Other";
    default:
      return "Other";
  }
}
