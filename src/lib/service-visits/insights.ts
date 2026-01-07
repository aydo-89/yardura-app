import { VisitInsightSource } from "@prisma/client";

import { prisma } from "@/lib/prisma";

interface UpsertVisitInsightInput {
  serviceVisitId: string;
  colorIndicator: string;
  consistencyIndicator: string;
  contentIndicator: string;
  observations?: string | null;
  wellnessFlag?: boolean;
  flagReason?: string | null;
  createdById?: string | null;
  source?: VisitInsightSource;
  sourceMediaId?: string | null;
  autoConfidence?: number | null;
  analysisModel?: string | null;
}

export function upsertVisitInsight(input: UpsertVisitInsightInput) {
  return prisma.visitInsight.upsert({
    where: { serviceVisitId: input.serviceVisitId },
    update: {
      colorIndicator: input.colorIndicator,
      consistencyIndicator: input.consistencyIndicator,
      contentIndicator: input.contentIndicator,
      observations: input.observations ?? null,
      wellnessFlag: input.wellnessFlag ?? false,
      flagReason: input.flagReason ?? null,
      createdById: input.createdById ?? null,
      ...(input.source !== undefined ? { source: input.source } : {}),
      ...(input.sourceMediaId !== undefined ? { sourceMediaId: input.sourceMediaId } : {}),
      ...(input.autoConfidence !== undefined ? { autoConfidence: input.autoConfidence } : {}),
      ...(input.analysisModel !== undefined
        ? { analysisModel: input.analysisModel ?? null }
        : {}),
    },
    create: {
      serviceVisitId: input.serviceVisitId,
      colorIndicator: input.colorIndicator,
      consistencyIndicator: input.consistencyIndicator,
      contentIndicator: input.contentIndicator,
      observations: input.observations ?? null,
      wellnessFlag: input.wellnessFlag ?? false,
      flagReason: input.flagReason ?? null,
      createdById: input.createdById ?? null,
      source: input.source ?? VisitInsightSource.MANUAL,
      sourceMediaId: input.sourceMediaId ?? null,
      autoConfidence: input.autoConfidence ?? null,
      analysisModel: input.analysisModel ?? null,
    },
  });
}
