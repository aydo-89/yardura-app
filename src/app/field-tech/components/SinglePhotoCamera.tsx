"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Camera,
  CameraOff,
  CircleStop,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";

type FrameAlignmentState = "searching" | "aligning" | "locked";

const FRAME_SAMPLE_INTERVAL = 320;
const FRAME_CENTER_RATIO = 0.56;
const FRAME_ALIGN_THRESHOLD = 0.45;
const FRAME_LOCK_THRESHOLD = 0.68;

export function clamp(value: number, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

function computeTextureScore(data: Uint8ClampedArray, width: number, height: number) {
  let total = 0;
  let count = 0;

  for (let y = 2; y < height - 2; y += 2) {
    for (let x = 2; x < width - 2; x += 2) {
      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const brightness = (r + g + b) / 765;

      let neighborVariance = 0;
      const neighbors = [
        index - 8,
        index + 8,
        index - width * 4,
        index + width * 4,
      ];

      neighbors.forEach((neighborIndex) => {
        const nr = data[neighborIndex];
        const ng = data[neighborIndex + 1];
        const nb = data[neighborIndex + 2];
        const neighborBrightness = (nr + ng + nb) / 765;
        neighborVariance += Math.abs(neighborBrightness - brightness);
      });

      total += neighborVariance / neighbors.length;
      count++;
    }
  }

  return count ? clamp(total / count, 0, 1) : 0;
}

export function useFrameAlignment(
  videoRef: React.RefObject<HTMLVideoElement>,
  active: boolean,
) {
  const [status, setStatus] = useState<FrameAlignmentState>("searching");
  const [confidence, setConfidence] = useState(0);
  const samplerRef = useRef<{ canvas: HTMLCanvasElement | null; smoothed: number; handle: number | null }>(
    {
      canvas: null,
      smoothed: 0,
      handle: null,
    },
  );
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
      const height = Math.floor((video.videoHeight / video.videoWidth) * width) || 224;
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

      for (let y = 0; y < height; y += 2) {
        for (let x = 0; x < width; x += 2) {
          const index = (y * width + x) * 4;
          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];
          const lightness = (Math.max(r, g, b) + Math.min(r, g, b)) / 510;
          totalMean += lightness;
          totalCount++;

          if (
            x >= centerBounds.xStart &&
            x <= centerBounds.xEnd &&
            y >= centerBounds.yStart &&
            y <= centerBounds.yEnd
          ) {
            centerMean += lightness;
            centerCount++;
          }
        }
      }

      const avgBrightness = totalCount ? totalMean / totalCount : 0;
      const centerBrightness = centerCount ? centerMean / centerCount : 0;
      const contrast = Math.abs(centerBrightness - avgBrightness);

      const texture = computeTextureScore(data, width, height);
      const lightPenalty = avgBrightness > 0.8 || avgBrightness < 0.2 ? 0.25 : 0;

      const rawScore = clamp(contrast * 0.65 + texture * 0.45 - lightPenalty * 0.4);
      sampler.smoothed = clamp(sampler.smoothed * 0.75 + rawScore * 0.25);

      setConfidence(sampler.smoothed);

      let nextStatus: FrameAlignmentState = "searching";
      if (sampler.smoothed >= FRAME_LOCK_THRESHOLD) {
        nextStatus = "locked";
      } else if (sampler.smoothed >= FRAME_ALIGN_THRESHOLD) {
        nextStatus = "aligning";
      }

      if (nextStatus !== lastStatusRef.current) {
        lastStatusRef.current = nextStatus;
        setStatus(nextStatus);
      }
    };

    const handle = window.setInterval(sampleFrame, FRAME_SAMPLE_INTERVAL);
    sampler.handle = handle;

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

export function SinglePhotoCamera({
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
  const [preferredFacing, setPreferredFacing] = useState<"environment" | "user">(defaultFacing);
  const [zoom, setZoom] = useState(defaultFacing === "user" ? 1.18 : 1.04);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const { status: alignmentStatus, confidence: alignmentConfidence } = useFrameAlignment(
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

      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
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
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setVideoReady(true);
        }
      } catch (error) {
        console.error("camera.start", error);
        toast.error("Unable to access camera");
      } finally {
        setInitializing(false);
      }
    },
    [initializing, preferredFacing],
  );

  useEffect(() => {
    if (!isCameraActive) return;
    const video = videoRef.current;
    if (!video) return;

    const handleLoaded = () => setVideoReady(true);
    const handleError = () => {
      toast.error("Camera feed interrupted");
      stopCamera();
    };

    video.addEventListener("loadedmetadata", handleLoaded);
    video.addEventListener("error", handleError);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoaded);
      video.removeEventListener("error", handleError);
    };
  }, [isCameraActive, stopCamera]);

  const capturePhoto = useCallback(async () => {
    if (!isCameraActive || !videoRef.current) {
      toast.error("Start the camera before capturing");
      return;
    }
    if (!videoReady) {
      toast.error("Camera feed is still loading");
      return;
    }

    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight) {
      toast.error("Camera feed is still loading");
      return;
    }

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
      canvas.toBlob((result) => resolve(result), "image/jpeg", 0.94),
    );

    if (!blob) {
      toast.error("Capture failed. Try again.");
      return;
    }

    const file = new File([blob], `capture-${Date.now()}.jpg`, {
      type: blob.type || "image/jpeg",
    });

    await onCapture(file);
    stopCamera();
  }, [isCameraActive, onCapture, stopCamera, videoReady]);

  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between text-sm text-white/80">
        <span className="font-medium">{label}</span>
        <div className="flex items-center gap-2 text-xs text-white/50">
          {isCameraActive ? (
            <>
                  <button
                    type="button"
                    className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white/70 transition hover:border-emerald-400/60 hover:bg-emerald-500/25 hover:text-emerald-100"
                    onClick={() => startCamera(preferredFacing === "user" ? "environment" : "user")}
                  >
                    <RefreshCw className="mr-1 inline h-3.5 w-3.5" /> Flip
                  </button>
              <button
                type="button"
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white/70 transition hover:border-rose-400/60 hover:bg-rose-500/20 hover:text-rose-100"
                onClick={stopCamera}
              >
                <CameraOff className="mr-1 inline h-3.5 w-3.5" /> Close
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className={`relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/60 ${showOverlayHints ? "min-h-[520px]" : "min-h-[360px]"}`}>
        <video
          ref={videoRef}
          playsInline
          className={`${showOverlayHints ? "h-[520px]" : "h-[360px]"} w-full object-cover ${isCameraActive ? "block" : "hidden"}`}
          style={{ transform: `scale(${zoom})` }}
        />
        {!isCameraActive && capturedImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={capturedImageUrl} alt="Captured" className="h-full w-full object-cover" />
        ) : null}
        {!isCameraActive && !capturedImageUrl ? (
          <div className="flex h-[280px] items-center justify-center bg-slate-950/70">
            <Sparkles className="mr-2 h-6 w-6 text-emerald-300" />
            <span className="text-sm text-white/70">Launch the camera to capture your gear check.</span>
          </div>
        ) : null}

        {isCameraActive && !showOverlayHints ? (
          <div
            className={`pointer-events-none absolute inset-[5%] rounded-3xl border-4 ${
              alignmentStatus === "locked"
                ? "border-emerald-400"
                : alignmentStatus === "aligning"
                  ? "border-amber-300"
                  : "border-white/30"
            } transition-colors duration-200`}
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
              <span>{
                alignmentStatus === "locked"
                  ? "Frame locked"
                  : alignmentStatus === "aligning"
                    ? "Almost there"
                    : "Fill the guide"
              }</span>
              <span className="text-white/50">{Math.round(alignmentConfidence * 100)}%</span>
            </div>
          </div>
        ) : null}

        {isCameraActive && showOverlayHints ? (
          <div className="absolute inset-0 flex flex-col justify-center gap-5 bg-slate-950/90 px-6 py-8 backdrop-blur-sm overflow-y-auto">
            <div className="space-y-4 flex-1 flex flex-col justify-center">
              <h2 className="text-xl font-bold text-white">Keep your uniform centered</h2>
              <ul className="space-y-3 text-sm text-white/90">
                {[
                  "Show badge, hat, and PPE in the guide.",
                  "Hold still so QA can verify the uniform.",
                  "Use good lighting so details stay clear.",
                ].map((tip) => (
                  <li key={tip} className="flex items-start gap-3 rounded-2xl bg-emerald-500/10 border border-emerald-400/20 px-4 py-3">
                    <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-300" />
                    <span className="leading-relaxed">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Button
              variant="secondary"
              className="w-full rounded-full bg-emerald-500 py-6 text-base font-semibold text-slate-950 shadow-lg hover:bg-emerald-400"
              onClick={() => setShowOverlayHints(false)}
            >
              Got it — Start camera
            </Button>
          </div>
        ) : null}

        {isCameraActive && (!videoReady || initializing) ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/75">
            <Loader2 className="h-10 w-10 animate-spin" />
            <span className="text-xs text-white/70">Preparing camera…</span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 rounded-full bg-white/10 px-4 py-3">
          <span className="text-[11px] uppercase tracking-wide text-white/60">Zoom</span>
          <input
            type="range"
            min={0.9}
            max={2.2}
            step={0.05}
            value={zoom}
            onChange={(event) => setZoom(clamp(Number(event.target.value), 0.9, 2.4))}
            disabled={!isCameraActive}
            className="flex-1 accent-emerald-400"
          />
          <span className="text-xs font-semibold text-white/70">{zoom.toFixed(1)}x</span>
        </div>

        <div className="flex gap-2">
          {!isCameraActive ? (
            <Button
              className="flex-1 rounded-2xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed"
              disabled={uploading}
              onClick={() => startCamera("user")}
            >
              {initializing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Starting camera…
                </>
              ) : (
                <>
                  <Camera className="mr-2 h-5 w-5" /> Launch camera
                </>
              )}
            </Button>
          ) : (
            <Button
              className="flex-1 rounded-2xl bg-emerald-500 text-slate-950 hover:bg-emerald-400"
              onClick={capturePhoto}
            >
              <CircleStop className="mr-2 h-5 w-5" /> Capture
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default SinglePhotoCamera;
