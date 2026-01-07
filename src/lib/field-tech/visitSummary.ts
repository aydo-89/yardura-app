import OpenAI from "openai";

import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import {
  COLOR_OPTIONS,
  CONSISTENCY_OPTIONS,
  CONTENT_OPTIONS,
} from "@/lib/service-visits/analysis-constants";

const client = new OpenAI({
  apiKey: env.OPENAI_API_KEY || "",
});

export interface VisitSummaryResult {
  color: string;
  consistency: string;
  content: string;
  observations: string;
  wellnessFlag: boolean;
  flagReason: string;
  flaggedSampleIndices: number[];
  flaggedSampleReasons?: string[];
  totalSamples: number;
}

type SampleAnalysisSnapshot = {
  color: string;
  consistency: string;
  content: string;
  observations: string;
  wellnessFlag: boolean;
  flagReason: string | null;
  confidenceLabel: string;
};

export async function generateVisitSummary(
  visitId: string,
  userId: string,
): Promise<VisitSummaryResult> {
  const visit = await prisma.serviceVisit.findUnique({
    where: { id: visitId },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
        },
      },
      media: {
        where: {
          assetType: "INSIGHTSCOOP",
          analysisStatus: {
            in: ["COMPLETED", "NEEDS_REVIEW"],
          },
        },
        orderBy: { capturedAt: "asc" },
      },
    },
  });

  if (!visit || visit.assignedToId !== userId) {
    throw new Error("visit_not_found");
  }

  if (visit.media.length === 0) {
    throw new Error("no_samples");
  }

  const sampleInsights = await prisma.serviceVisitSampleInsight.findMany({
    where: {
      serviceVisitId: visitId,
      analysisStatus: { in: ["COMPLETED", "NEEDS_REVIEW"] },
    },
  });

  const insightBySampleId = new Map(
    sampleInsights.map((insight) => [insight.stoolSampleId, insight]),
  );

  const groupedMedia = new Map<string, typeof visit.media>();
  const ungroupedMedia: typeof visit.media = [];

  visit.media.forEach((media) => {
    if (media.stoolSampleId) {
      const existing = groupedMedia.get(media.stoolSampleId) ?? [];
      existing.push(media);
      groupedMedia.set(media.stoolSampleId, existing);
      return;
    }
    ungroupedMedia.push(media);
  });

  const sampleEntries: Array<{
    capturedAt: Date | null;
    viewLabel: string;
    analysis: SampleAnalysisSnapshot;
  }> = [];

  const buildAnalysisSnapshot = (result: any, confidence?: number | null) => ({
    color: result?.color ?? "N/A",
    consistency: result?.consistency ?? "N/A",
    content: result?.content ?? "N/A",
    observations: result?.observations ?? "None",
    wellnessFlag: Boolean(result?.wellness_flag),
    flagReason: result?.flag_reason ?? null,
    confidenceLabel: confidence ? `${(confidence * 100).toFixed(0)}%` : "N/A",
  });

  groupedMedia.forEach((group) => {
    const sampleId = group[0]?.stoolSampleId;
    if (!sampleId) return;
    const insight = insightBySampleId.get(sampleId);
    const surface = group.find((m) => m.stoolSampleView === "SURFACE");
    const cross = group.find((m) => m.stoolSampleView === "CROSS_SECTION");
    const representative = surface ?? cross ?? group[0];
    const viewLabel = surface && cross
      ? "Surface + cross-section"
      : surface
        ? "Surface"
        : "Cross-section";

    if (insight) {
      sampleEntries.push({
        capturedAt: representative?.capturedAt ?? null,
        viewLabel,
        analysis: {
          color: insight.colorIndicator,
          consistency: insight.consistencyIndicator,
          content: insight.contentIndicator,
          observations: insight.observations ?? "None",
          wellnessFlag: insight.wellnessFlag,
          flagReason: insight.flagReason ?? null,
          confidenceLabel: insight.analysisConfidence
            ? `${(insight.analysisConfidence * 100).toFixed(0)}%`
            : "N/A",
        },
      });
      return;
    }

    if (representative?.analysisResult) {
      sampleEntries.push({
        capturedAt: representative.capturedAt ?? null,
        viewLabel,
        analysis: buildAnalysisSnapshot(
          representative.analysisResult as any,
          representative.analysisConfidence,
        ),
      });
    }
  });

  ungroupedMedia.forEach((media) => {
    if (!media.analysisResult) return;
    sampleEntries.push({
      capturedAt: media.capturedAt ?? null,
      viewLabel: "Single image",
      analysis: buildAnalysisSnapshot(
        media.analysisResult as any,
        media.analysisConfidence,
      ),
    });
  });

  if (sampleEntries.length === 0) {
    throw new Error("no_samples");
  }

  sampleEntries.sort((a, b) => {
    const aTime = a.capturedAt?.getTime() ?? 0;
    const bTime = b.capturedAt?.getTime() ?? 0;
    return aTime - bTime;
  });

  const sampleSummaries = sampleEntries.map((entry, idx) => {
    const capturedLabel = entry.capturedAt
      ? `captured ${new Date(entry.capturedAt).toLocaleTimeString()}`
      : "captured time unknown";
    return `
Sample ${idx + 1} (${entry.viewLabel}, ${capturedLabel}):
- Color: ${entry.analysis.color}
- Consistency: ${entry.analysis.consistency}
- Content: ${entry.analysis.content}
- Observations: ${entry.analysis.observations}
- Wellness Flag: ${entry.analysis.wellnessFlag ? "YES" : "NO"}
${entry.analysis.flagReason ? `- Flag Reason: ${entry.analysis.flagReason}` : ""}
- Confidence: ${entry.analysis.confidenceLabel}
`.trim();
  });

  const allSamplesSummary = sampleSummaries.join("\n\n");
  const customerName = visit.customer?.name || "the customer";

  const systemPrompt = `You are an expert veterinary health analyst for dog waste analysis. 
You will receive multiple individual sample analyses from a single yard service visit.
Your job is to synthesize all samples into ONE overall assessment for the pet owner.

Guidelines:
- Color, Consistency, Content: Choose the most representative value across all samples. If there's variation, note it in observations.
- Observations: Create a concise, customer-friendly summary (2-3 sentences max) that mentions:
  * Overall health indicators
  * Any notable variations between samples
  * Any concerns found (reference specific samples if needed)
- Wellness Flag: Set to true ONLY if any sample shows concerning patterns
- Flag Reason: ALWAYS provide this field. If wellness flag is true, explain what needs follow-up. If false, provide an empty string.
- Flagged Sample Indices: ALWAYS provide this as an array of 0-based indices. If no samples are flagged, provide an empty array [].

Use simple, reassuring language. Avoid medical jargon.`;

  const userPrompt = `Here are ${visit.media.length} analyzed samples from ${customerName}'s yard:\n\n${allSamplesSummary}\n\nGenerate an overall summary for the customer that consolidates these findings into a single assessment.`;

  const response = await client.responses.create({
    model: "gpt-4o-2024-11-20",
    input: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "OverallVisitSummary",
        schema: {
          type: "object",
          required: [
            "color",
            "consistency",
            "content",
            "observations",
            "wellnessFlag",
            "flagReason",
            "flaggedSampleIndices",
          ],
          properties: {
            color: { type: "string", enum: COLOR_OPTIONS },
            consistency: { type: "string", enum: CONSISTENCY_OPTIONS },
            content: { type: "string", enum: CONTENT_OPTIONS },
            observations: { type: "string" },
            wellnessFlag: { type: "boolean" },
            flagReason: { type: "string" },
            flaggedSampleIndices: {
              type: "array",
              items: { type: "number" },
            },
          },
          additionalProperties: false,
        },
      },
    },
  } as any);

  const output = response.output_text;
  if (!output) {
    throw new Error("no_output");
  }

  const parsed = JSON.parse(output);

  // Build flagged sample reasons from the original media analysis
  const flaggedSampleReasons: string[] = [];
  if (Array.isArray(parsed.flaggedSampleIndices)) {
    for (const idx of parsed.flaggedSampleIndices) {
      const sample = sampleEntries[idx];
      if (sample?.analysis.flagReason) {
        flaggedSampleReasons.push(`Sample ${idx + 1}: ${sample.analysis.flagReason}`);
      }
    }
  }

  return {
    color: parsed.color ?? "",
    consistency: parsed.consistency ?? "",
    content: parsed.content ?? "",
    observations: parsed.observations ?? "",
    wellnessFlag: parsed.wellnessFlag ?? false,
    flagReason: parsed.flagReason ?? "",
    flaggedSampleIndices: parsed.flaggedSampleIndices ?? [],
    flaggedSampleReasons,
    totalSamples: sampleEntries.length,
  } satisfies VisitSummaryResult;
}
