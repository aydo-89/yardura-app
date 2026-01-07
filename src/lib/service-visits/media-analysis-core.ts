import OpenAI from "openai";
import {
  MediaAnalysisStatus,
  ScooperRewardEventType,
  VisitMediaType,
} from "@prisma/client";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { createSignedUrl } from "@/lib/supabase-admin";
import {
  awardScooperPoints,
  SCOOPER_REWARD_EVENT_POINTS,
  SCOOPER_VISIT_POINTS_CAP,
} from "@/lib/field-tech/rewardEvents";
import {
  COLOR_OPTIONS,
  CONSISTENCY_OPTIONS,
  CONTENT_OPTIONS,
  MediaAnalysisResult,
} from "@/lib/service-visits/analysis-constants";

const DEFAULT_MODEL = process.env.SERVICE_VISIT_ANALYSIS_MODEL ?? "gpt-5-mini";

function resolveOpenAiKey(): string | null {
  return (
    process.env.SERVICE_VISIT_ANALYSIS_OPENAI_KEY ??
    process.env.OPENAI_API_KEY ??
    env.OPENAI_API_KEY ??
    null
  );
}

type AnalysisImage = {
  url: string;
  label: string;
};

const ANALYSIS_SCHEMA = {
  name: "VisitInsightAnalysis",
  schema: {
    type: "object",
    required: [
      "color",
      "consistency",
      "content",
      "confidence",
      "needs_review",
      "wellness_flag",
      "observations",
      "flag_reason",
    ],
    properties: {
      color: {
        type: "string",
        enum: COLOR_OPTIONS,
      },
      consistency: {
        type: "string",
        enum: CONSISTENCY_OPTIONS,
      },
      content: {
        type: "string",
        enum: CONTENT_OPTIONS,
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
      },
      observations: {
        type: "string",
        maxLength: 140,
      },
      needs_review: {
        type: "boolean",
      },
      wellness_flag: {
        type: "boolean",
      },
      flag_reason: {
        type: "string",
        maxLength: 140,
      },
    },
    additionalProperties: false,
  },
} as const;

async function runVisionAnalysis(
  images: AnalysisImage[],
): Promise<MediaAnalysisResult> {
  const openAiKey = resolveOpenAiKey();
  if (!openAiKey) {
    throw new Error(
      "OPENAI_API_KEY missing. Set SERVICE_VISIT_ANALYSIS_OPENAI_KEY or OPENAI_API_KEY.",
    );
  }

  const client = new OpenAI({ apiKey: openAiKey });

  const systemPrompt = [
    "You are an assistant helping yard technicians evaluate dog waste images.",
    "Classify the photo(s) using Yardura's 3C rubric (Color, Consistency, Content).",
    "You may receive one or two images of the same sample (surface and/or cross-section).",
    "Use all provided images together if more than one is supplied.",
    "Only use the approved category lists provided.",
    "Return JSON that matches the response schema exactly.",
    "Set needs_review to true ONLY if the image is completely unclear, corrupted, or clearly not dog waste.",
    "For normal, clear photos of dog waste, set needs_review to false even if analysis is challenging.",
    "Set wellness_flag to true when you detect concerning indicators (blood, mucus, parasites, unusual color or consistency).",
    "When wellness_flag is true, provide a short flag_reason summarizing the concern.",
    "Confidence should be a number from 0.0 to 1.0.",
  ].join(" ");

  const instructions = `Analyze this InsightScoop sample and classify the 3Cs. Use these allowed values:\n\nColor: ${COLOR_OPTIONS.join(
    ", ",
  )}\nConsistency: ${CONSISTENCY_OPTIONS.join(
    ", ",
  )}\nContent: ${CONTENT_OPTIONS.join(
    ", ",
  )}\n\nReturn concise observations (max 140 characters).`;

  const content: Array<
    | { type: "input_text"; text: string }
    | { type: "input_image"; image_url: string; detail?: string }
  > = [{ type: "input_text", text: instructions }];

  images.forEach((image) => {
    content.push({ type: "input_text", text: image.label });
    content.push({
      type: "input_image",
      image_url: image.url,
      detail: "auto",
    });
  });

  const response = await client.responses.create({
    model: DEFAULT_MODEL,
    input: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: ANALYSIS_SCHEMA.name,
        schema: ANALYSIS_SCHEMA.schema,
      },
    },
  } as any);

  const outputText = response.output_text?.trim();
  if (!outputText) {
    throw new Error("Model returned no structured output");
  }

  const firstBrace = outputText.indexOf("{");
  const lastBrace = outputText.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("Unable to parse model response as JSON");
  }

  return JSON.parse(
    outputText.slice(firstBrace, lastBrace + 1),
  ) as MediaAnalysisResult;
}

function arraysMatch(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  for (const value of b) {
    if (!setA.has(value)) return false;
  }
  return true;
}

function pickLatestByView(
  media: Array<{
    id: string;
    stoolSampleView: string | null;
    capturedAt: Date;
    storagePath: string;
  }>,
  view: "SURFACE" | "CROSS_SECTION",
) {
  return media
    .filter((item) => item.stoolSampleView === view)
    .sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime())[0];
}

async function analyzeSampleGroup(options: {
  serviceVisitId: string;
  stoolSampleId: string;
  force?: boolean;
}) {
  const { serviceVisitId, stoolSampleId, force } = options;
  const media = await prisma.serviceVisitMedia.findMany({
    where: {
      serviceVisitId,
      stoolSampleId,
      assetType: VisitMediaType.INSIGHTSCOOP,
    },
    select: {
      id: true,
      stoolSampleView: true,
      capturedAt: true,
      storagePath: true,
    },
  });

  if (media.length === 0) return;

  const surface = pickLatestByView(media, "SURFACE");
  const cross = pickLatestByView(media, "CROSS_SECTION");
  const selected = [surface, cross].filter(Boolean) as Array<{
    id: string;
    stoolSampleView: string | null;
    capturedAt: Date;
    storagePath: string;
  }>;

  if (selected.length === 0) return;

  const selectedIds = selected.map((item) => item.id);
  const existing = await prisma.serviceVisitSampleInsight.findUnique({
    where: {
      serviceVisitId_stoolSampleId: {
        serviceVisitId,
        stoolSampleId,
      },
    },
  });

  if (!force && existing) {
    if (
      existing.analysisStatus === MediaAnalysisStatus.IN_PROGRESS ||
      existing.analysisStatus === MediaAnalysisStatus.PENDING
    ) {
      return;
    }
    if (
      (existing.analysisStatus === MediaAnalysisStatus.COMPLETED ||
        existing.analysisStatus === MediaAnalysisStatus.NEEDS_REVIEW) &&
      arraysMatch(existing.sourceMediaIds ?? [], selectedIds)
    ) {
      return;
    }
  }

  const bucket = env.STORAGE_BUCKET;
  if (!bucket) {
    await prisma.serviceVisitSampleInsight.upsert({
      where: {
        serviceVisitId_stoolSampleId: {
          serviceVisitId,
          stoolSampleId,
        },
      },
      update: {
        analysisStatus: MediaAnalysisStatus.FAILED,
        analysisError: "STORAGE_BUCKET is not configured",
        analysisCompletedAt: new Date(),
        sourceMediaIds: selectedIds,
      },
      create: {
        serviceVisitId,
        stoolSampleId,
        sourceMediaIds: selectedIds,
        colorIndicator: "Normal",
        consistencyIndicator: "Firm",
        contentIndicator: "Typical",
        analysisStatus: MediaAnalysisStatus.FAILED,
        analysisError: "STORAGE_BUCKET is not configured",
        analysisCompletedAt: new Date(),
      },
    });
    return;
  }

  await prisma.serviceVisitSampleInsight.upsert({
    where: {
      serviceVisitId_stoolSampleId: {
        serviceVisitId,
        stoolSampleId,
      },
    },
    update: {
      analysisStatus: MediaAnalysisStatus.IN_PROGRESS,
      analysisRequestedAt: new Date(),
      analysisError: null,
      sourceMediaIds: selectedIds,
    },
    create: {
      serviceVisitId,
      stoolSampleId,
      sourceMediaIds: selectedIds,
      colorIndicator: "Normal",
      consistencyIndicator: "Firm",
      contentIndicator: "Typical",
      analysisStatus: MediaAnalysisStatus.IN_PROGRESS,
      analysisRequestedAt: new Date(),
    },
  });

  try {
    const signedImages: AnalysisImage[] = [];
    for (const item of selected) {
      const url = await createSignedUrl(bucket, item.storagePath, 60 * 10);
      if (!url) {
        throw new Error("Unable to generate signed URL for sample analysis");
      }
      signedImages.push({
        url,
        label:
          item.stoolSampleView === "CROSS_SECTION"
            ? "Cross-section view"
            : "Surface view",
      });
    }

    const parsed = await runVisionAnalysis(signedImages);
    const confidence = Math.min(Math.max(parsed.confidence ?? 0, 0), 1);
    const normalizedObservations = parsed.observations?.trim() || null;
    const normalizedFlagReason = parsed.flag_reason?.trim() || null;
    const finalStatus = parsed.needs_review
      ? MediaAnalysisStatus.NEEDS_REVIEW
      : MediaAnalysisStatus.COMPLETED;

    await prisma.serviceVisitSampleInsight.update({
      where: {
        serviceVisitId_stoolSampleId: {
          serviceVisitId,
          stoolSampleId,
        },
      },
      data: {
        colorIndicator: parsed.color,
        consistencyIndicator: parsed.consistency,
        contentIndicator: parsed.content,
        observations: normalizedObservations,
        wellnessFlag: parsed.wellness_flag,
        flagReason: normalizedFlagReason,
        analysisStatus: finalStatus,
        analysisModel: DEFAULT_MODEL,
        analysisCompletedAt: new Date(),
        analysisError: null,
        analysisConfidence: confidence,
        sourceMediaIds: selectedIds,
      },
    });
  } catch (error: unknown) {
    console.error("serviceVisit.sample.analysis", { serviceVisitId, stoolSampleId, error });
    await prisma.serviceVisitSampleInsight.update({
      where: {
        serviceVisitId_stoolSampleId: {
          serviceVisitId,
          stoolSampleId,
        },
      },
      data: {
        analysisStatus: MediaAnalysisStatus.FAILED,
        analysisCompletedAt: new Date(),
        analysisError:
          error instanceof Error ? error.message : "Unknown analysis failure",
      },
    });
  }
}

export async function runMediaAnalysis(mediaId: string, force = false) {
  const media = await prisma.serviceVisitMedia.findUnique({
    where: { id: mediaId },
    include: {
      serviceVisit: {
        select: { id: true, orgId: true, assignedToId: true },
      },
    },
  });

  if (!media) {
    return;
  }

  if (media.assetType !== VisitMediaType.INSIGHTSCOOP) {
    await prisma.serviceVisitMedia.update({
      where: { id: mediaId },
      data: {
        analysisStatus: MediaAnalysisStatus.NOT_REQUESTED,
        analysisError: "Analysis only runs for InsightScoop media",
      },
    });
    return;
  }

  const bucket = env.STORAGE_BUCKET;
  if (!bucket) {
    await prisma.serviceVisitMedia.update({
      where: { id: mediaId },
      data: {
        analysisStatus: MediaAnalysisStatus.FAILED,
        analysisError: "STORAGE_BUCKET is not configured",
        analysisCompletedAt: new Date(),
      },
    });
    return;
  }

  await prisma.serviceVisitMedia.update({
    where: { id: mediaId },
    data: {
      analysisStatus: MediaAnalysisStatus.IN_PROGRESS,
      analysisError: null,
    },
  });

  try {
    const signedUrl = await createSignedUrl(bucket, media.storagePath, 60 * 10);
    if (!signedUrl) {
      throw new Error("Unable to generate signed URL for media analysis");
    }

    const parsed = await runVisionAnalysis([
      { url: signedUrl, label: "Single sample image" },
    ]);

    const confidence = Math.min(Math.max(parsed.confidence ?? 0, 0), 1);
    const normalizedObservations = parsed.observations?.trim() || null;
    const normalizedFlagReason = parsed.flag_reason?.trim() || null;

    const finalStatus = parsed.needs_review
      ? MediaAnalysisStatus.NEEDS_REVIEW
      : MediaAnalysisStatus.COMPLETED;

    await prisma.serviceVisitMedia.update({
      where: { id: mediaId },
      data: {
        analysisStatus: finalStatus,
        analysisModel: DEFAULT_MODEL,
        analysisCompletedAt: new Date(),
        analysisConfidence: confidence,
        analysisError: null,
        analysisResult: parsed,
      },
    });

    if (
      parsed.wellness_flag &&
      media.serviceVisit?.orgId &&
      media.serviceVisit?.assignedToId
    ) {
      await awardScooperPoints({
        orgId: media.serviceVisit.orgId,
        scooperId: media.serviceVisit.assignedToId,
        eventType: ScooperRewardEventType.DETECTION_FLAG,
        sourceKey: `detection:${media.serviceVisitId}`,
        points: SCOOPER_REWARD_EVENT_POINTS.detectionFlag,
        serviceVisitId: media.serviceVisitId,
        metadata: normalizedFlagReason ? { flagReason: normalizedFlagReason } : undefined,
        maxPointsPerVisit: SCOOPER_VISIT_POINTS_CAP,
      });
    }

    if (media.stoolSampleId) {
      await analyzeSampleGroup({
        serviceVisitId: media.serviceVisitId,
        stoolSampleId: media.stoolSampleId,
        force,
      });
    }
  } catch (error: unknown) {
    console.error("serviceVisit.media.analysis", { mediaId, error });
    await prisma.serviceVisitMedia.update({
      where: { id: mediaId },
      data: {
        analysisStatus: MediaAnalysisStatus.FAILED,
        analysisCompletedAt: new Date(),
        analysisError:
          error instanceof Error ? error.message : "Unknown analysis failure",
      },
    });
  }
}
