import { NextRequest, NextResponse } from "next/server";

import {
  transcribeAndAnalyzeOutbound,
  encounterValues,
  objectionValues,
  dogPresenceValues,
} from "@/lib/outbound/transcription";
import {
  addOutboundTranscriptionJob,
  getOutboundTranscriptionJobStatus,
} from "@/lib/jobs/outboundTranscriptionQueue";

export const runtime = "nodejs";

type AnalysisResult = {
  summary: string;
  encounterTags: string[];
  dogPresence: (typeof dogPresenceValues)[number] | null;
  objectionTags: string[];
  dogCount?: number | null;
  followUp?: string | null;
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

function sanitizeAnalysis(result: {
  summary: string;
  encounterTags: string[];
  dogPresence: any;
  objectionTags: string[];
  dogCount?: number | null;
  followUp?: string | null;
}): AnalysisResult {
  const safeEncounter = Array.isArray(result.encounterTags)
    ? result.encounterTags.filter((tag) => encounterValues.includes(tag as any))
    : [];
  const safeObjections = Array.isArray(result.objectionTags)
    ? result.objectionTags.filter((tag) => objectionValues.includes(tag as any))
    : [];
  const safeDogPresence = dogPresenceValues.includes(result.dogPresence as any)
    ? (result.dogPresence as (typeof dogPresenceValues)[number])
    : null;
  const safeDogCount = Number.isInteger(result.dogCount)
    ? (result.dogCount as number)
    : null;

  return {
    summary: result.summary?.trim?.() ?? "",
    encounterTags: safeEncounter,
    dogPresence: safeDogPresence,
    objectionTags: safeObjections,
    dogCount: safeDogCount,
    followUp: result.followUp ?? null,
  } satisfies AnalysisResult;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audio = formData.get("audio");
    const forceSync = formData.get("forceSync") === "true";

    if (!(audio instanceof File)) {
      return jsonResponse(400, {
        ok: false,
        error: "Audio file is required.",
      });
    }

    const businessIdRaw = formData.get("businessId");
    const businessId =
      typeof businessIdRaw === "string" && businessIdRaw.trim().length
        ? businessIdRaw.trim()
        : undefined;

    const audioBuffer = Buffer.from(await audio.arrayBuffer());
    const filename = audio.name || "visit-recording.webm";

    const queuedJobId = forceSync
      ? null
      : await addOutboundTranscriptionJob({
          jobId: `outbound-${Date.now()}`,
          audioBase64: audioBuffer.toString("base64"),
          filename,
          businessId,
        });

    if (queuedJobId) {
      return NextResponse.json({
        ok: true,
        data: {
          jobId: queuedJobId,
          status: "queued",
          message: "Transcription job queued. Poll /api/outbound/transcribe?jobId=...",
        },
      });
    }

    const result = await transcribeAndAnalyzeOutbound({
      audioBuffer,
      filename,
      businessId,
    });
    const analysis = sanitizeAnalysis(result);

    return NextResponse.json({
      ok: true,
      data: {
        transcript: result.transcript,
        summary: analysis.summary,
        encounterTags: analysis.encounterTags,
        dogPresence: analysis.dogPresence,
        objectionTags: analysis.objectionTags,
        dogCount: analysis.dogCount ?? null,
        followUp: analysis.followUp ?? null,
      },
    });
  } catch (error) {
    console.error("/api/outbound/transcribe error", error);
    return jsonResponse(500, {
      ok: false,
      error: "Failed to process recording.",
    });
  }
}

export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("jobId");

  if (!jobId) {
    return jsonResponse(400, {
      ok: false,
      error: "jobId_required",
      message: "jobId query parameter is required",
    });
  }

  try {
    const status = await getOutboundTranscriptionJobStatus(jobId);
    if (!status) {
      return jsonResponse(404, {
        ok: false,
        error: "job_not_found",
      });
    }

    const resultPayload = status.result
      ? {
          transcript: status.result.transcript,
          ...sanitizeAnalysis(status.result),
        }
      : null;

    return NextResponse.json({
      ok: true,
      data: {
        jobId: status.jobId,
        status: status.status,
        progress: status.progress ?? null,
        createdAt: status.createdAt,
        completedAt: status.completedAt ?? null,
        error: status.error ?? null,
        result: resultPayload,
      },
    });
  } catch (error) {
    console.error("/api/outbound/transcribe status error", error);
    return jsonResponse(500, {
      ok: false,
      error: "status_failed",
      message: "Failed to load job status",
    });
  }
}
