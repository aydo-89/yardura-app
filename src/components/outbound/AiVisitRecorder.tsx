"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Mic,
  PauseCircle,
  RotateCcw,
  Sparkles,
  StopCircle,
  Wand2,
} from "lucide-react";

export interface AiVisitResult {
  transcript: string;
  summary: string;
  encounterTags: string[];
  dogPresence: "HAS_DOG" | "NO_DOG" | "UNKNOWN" | null;
  objectionTags: string[];
  dogCount?: number | null;
  followUp?: string | null;
}

interface AiVisitRecorderProps {
  businessId?: string | null;
  encounterOptionMap: Record<string, { label: string }>;
  dogOptionMap: Record<string, { label: string }>;
  objectionOptionMap: Record<string, { label: string }>;
  onApply: (result: AiVisitResult) => void;
  onCancel?: () => void;
}

type RecorderState = "idle" | "recording" | "processing" | "complete";

const MAX_DURATION_MS = 3 * 60 * 1000; // 3 minutes

function pickSupportedMimeType(): string | undefined {
  const preferredTypes = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/mpeg",
    "audio/ogg",
  ];

  for (const candidate of preferredTypes) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function normalizeMimeType(raw?: string | null): { mime: string; extension: string } {
  const fallbackMime = "audio/webm";
  if (!raw) {
    return { mime: fallbackMime, extension: "webm" };
  }

  const base = raw.split(";")[0] || raw;
  const subtype = base.split("/")[1] || "webm";
  const extension = subtype.replace(/[.]/g, "").toLowerCase();

  return {
    mime: base || fallbackMime,
    extension: extension || "webm",
  };
}

const TRANSCRIPTION_JOB_POLL_INTERVAL_MS = 2000;
const TRANSCRIPTION_JOB_MAX_ATTEMPTS = 90;
const MIN_RECORDING_MS = 1200;

async function pollTranscriptionJob(jobId: string): Promise<AiVisitResult> {
  const pollUrl = `/api/outbound/transcribe?jobId=${encodeURIComponent(jobId)}`;

  for (let attempt = 0; attempt < TRANSCRIPTION_JOB_MAX_ATTEMPTS; attempt++) {
    const response = await fetch(pollUrl, { credentials: "include" });
    const payload = (await response
      .json()
      .catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      message?: string;
      data?: {
        status?: string;
        result?: AiVisitResult | null;
        error?: string | null;
      };
    };

    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.error || payload?.message || "Failed to check transcription status");
    }

    const status = payload.data;
    if (!status) {
      throw new Error("Invalid transcription job status response");
    }

    if (status.status === "completed" && status.result) {
      return status.result;
    }

    if (status.status === "failed") {
      throw new Error(status.error || "Transcription failed");
    }

    await new Promise((resolve) => setTimeout(resolve, TRANSCRIPTION_JOB_POLL_INTERVAL_MS));
  }

  throw new Error("Transcription timed out. Please try again.");
}

export function AiVisitRecorder({
  businessId,
  encounterOptionMap,
  dogOptionMap,
  objectionOptionMap,
  onApply,
  onCancel,
}: AiVisitRecorderProps) {
  const [recorderState, setRecorderState] = useState<RecorderState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiVisitResult | null>(null);
  const [transcriptPreview, setTranscriptPreview] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const elapsedMsRef = useRef<number>(0);

  const resetState = useCallback(() => {
    setRecorderState("idle");
    setElapsedMs(0);
    elapsedMsRef.current = 0;
    setError(null);
    setResult(null);
    setTranscriptPreview("");
    setAudioUrl((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
    chunksRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      mediaRecorderRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [audioUrl]);

  const stopRecordingInternal = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    mediaRecorderRef.current?.stop();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaRecorderRef.current = null;
    mediaStreamRef.current = null;
  }, []);

  const handleStartRecording = useCallback(async () => {
    try {
      resetState();
      setRecorderState("recording");
      setElapsedMs(0);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickSupportedMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      mediaStreamRef.current = stream;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const firstChunkType = chunksRef.current[0]?.type || recorder.mimeType || undefined;
        const { mime, extension } = normalizeMimeType(firstChunkType);
        const blob = new Blob(chunksRef.current, { type: mime });
        chunksRef.current = [];

        if (elapsedMsRef.current < MIN_RECORDING_MS) {
          setRecorderState("idle");
          setError("Recording too short. Try speaking for a few seconds.");
          return;
        }

        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setRecorderState("processing");
        void transcribeRecording(blob, extension, mime);
      };

      recorder.start();

      timerRef.current = window.setInterval(() => {
        setElapsedMs((prev) => {
          const next = prev + 250;
          elapsedMsRef.current = next;
          if (next >= MAX_DURATION_MS) {
            stopRecordingInternal();
          }
          return next;
        });
      }, 250);
    } catch (err) {
      console.error("Unable to access microphone", err);
      setRecorderState("idle");
      setError(
        err instanceof Error
          ? err.message
          : "Microphone access was denied. Please check browser permissions.",
      );
    }
  }, [resetState, stopRecordingInternal]);

  const handleStopRecording = useCallback(() => {
    stopRecordingInternal();
  }, [stopRecordingInternal]);

  const transcribeRecording = useCallback(
    async (blob: Blob, extensionHint: string, mimeHint: string) => {
      try {
        setError(null);
        setResult(null);

        const formData = new FormData();
        const { mime: normalizedMime, extension: normalizedExtension } = normalizeMimeType(
          mimeHint || blob.type,
        );
        const safeExtension = extensionHint || normalizedExtension;
        formData.append(
          "audio",
          new File([blob], `visit-recording.${safeExtension}`, {
            type: normalizedMime,
          }),
        );
        if (businessId) {
          formData.append("businessId", businessId);
        }

        const response = await fetch("/api/outbound/transcribe", {
          method: "POST",
          body: formData,
        });

        const payload = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          data?:
            | (AiVisitResult & { jobId?: string; status?: string })
            | { jobId: string; status?: string; message?: string };
        };

        if (!response.ok || payload?.ok === false || !payload.data) {
          throw new Error(payload?.error || "Transcription failed.");
        }

        const data = payload.data as any;
        let finalResult: AiVisitResult;

        if (data && typeof data.jobId === "string" && !data.transcript) {
          finalResult = await pollTranscriptionJob(data.jobId);
        } else {
          finalResult = data as AiVisitResult;
        }

        setResult(finalResult);
        setTranscriptPreview(finalResult.transcript ?? "");
        setRecorderState("complete");
      } catch (err) {
        console.error("Transcription error", err);
        setRecorderState("idle");
        setError(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while processing the recording.",
        );
      }
    },
    [businessId],
  );

  const handleApply = useCallback(() => {
    if (!result) return;
    onApply(result);
  }, [result, onApply]);

  const handleReset = useCallback(() => {
    stopRecordingInternal();
    resetState();
  }, [resetState, stopRecordingInternal]);

  const minutes = Math.floor(elapsedMs / 60000);
  const seconds = Math.floor((elapsedMs % 60000) / 1000)
    .toString()
    .padStart(2, "0");

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-emerald-600" />
          AI-assisted visit log
        </CardTitle>
        <CardDescription className="text-xs">
          Record the conversation, let AI draft the notes and tags, then review before saving.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">We hit a snag</p>
              <p>{error}</p>
            </div>
          </div>
        ) : null}

        <div className="space-y-3 rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Mic className="h-4 w-4" />
              {recorderState === "recording" ? "Recording…" : "Recorder"}
            </div>
            <div className="text-xs font-mono text-slate-500">
              {minutes}:{seconds}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {recorderState !== "recording" ? (
              <Button
                type="button"
                onClick={handleStartRecording}
                disabled={recorderState === "processing"}
                className="gap-2"
              >
                <Mic className="h-4 w-4" />
                Start recording
              </Button>
            ) : (
              <Button
                type="button"
                variant="destructive"
                onClick={handleStopRecording}
                className="gap-2"
              >
                <StopCircle className="h-4 w-4" />
                Stop recording
              </Button>
            )}

            {recorderState === "recording" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="gap-1"
              >
                <PauseCircle className="h-3 w-3" />
                Cancel
              </Button>
            ) : null}

            {audioUrl ? (
              <audio
                src={audioUrl}
                controls
                className="mt-2 w-full"
                aria-label="Recorded audio playback"
              />
            ) : null}

            {recorderState === "processing" ? (
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" /> Transcribing and analyzing…
              </div>
            ) : null}
          </div>
        </div>

        {result ? (
          <div className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
              <Wand2 className="h-4 w-4" />
              Suggested summary & tags
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Summary
              </label>
              <Textarea
                value={result.summary}
                onChange={(event) =>
                  setResult((prev) =>
                    prev
                      ? { ...prev, summary: event.target.value }
                      : prev,
                  )
                }
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Encounter result
              </p>
              <div className="flex flex-wrap gap-2">
                {result.encounterTags.length ? (
                  result.encounterTags.map((tag) => (
                    <Badge key={tag} className="bg-white text-emerald-700">
                      {encounterOptionMap[tag]?.label ?? tag}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-emerald-800/80">
                    No outcome detected
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Objections mentioned
              </p>
              <div className="flex flex-wrap gap-2">
                {result.objectionTags.length ? (
                  result.objectionTags.map((tag) => (
                    <Badge key={tag} className="bg-white text-emerald-700">
                      {objectionOptionMap[tag]?.label ?? tag}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-emerald-800/80">
                    None detected
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Dog presence
              </p>
              <Badge className="bg-white text-emerald-700">
                {result.dogPresence
                  ? dogOptionMap[result.dogPresence]?.label ?? result.dogPresence
                  : "Not sure"}
              </Badge>
            </div>

            {result.followUp ? (
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Suggested follow-up
                </p>
                <p className="rounded-md bg-white/80 px-3 py-2 text-xs text-emerald-900">
                  {result.followUp}
                </p>
              </div>
            ) : null}

            <div className="space-y-1">
              <details className="rounded-md border border-emerald-200 bg-white/70 p-3">
                <summary className="cursor-pointer text-xs font-medium text-emerald-800">
                  Full transcript
                </summary>
                <p className="mt-2 whitespace-pre-wrap text-xs text-emerald-900">
                  {transcriptPreview}
                </p>
              </details>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button type="button" onClick={handleApply} className="gap-2">
                <CheckCircle2 className="h-4 w-4" /> Apply to quick visit log
              </Button>
              <Button type="button" variant="ghost" onClick={handleReset} className="gap-1 text-emerald-800">
                <RotateCcw className="h-4 w-4" /> Record again
              </Button>
              {onCancel ? (
                <Button type="button" variant="ghost" onClick={onCancel} className="text-emerald-800">
                  Cancel
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {recorderState === "idle" && !result ? (
          <p className="text-xs text-slate-500">
            Tip: Record a short recap right after the conversation. AI will summarize and pre-fill the visit log for you.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
