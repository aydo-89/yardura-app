import { prisma } from "@/lib/prisma";
import { getBusinessConfig } from "@/lib/business-config";
import {
  extractCareCreditsAwarded,
  resolveRatingCareCredits,
} from "@/lib/rewards/care-credits";
import { CustomerRewardEventType } from "@prisma/client";
import { awardCustomerRewardPoints } from "@/lib/rewards/customerRewardEvents";

type CreateServiceVisitRatingInput = {
  visitId: string;
  customerId: string;
  score: number;
  comment?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown>;
  tipCents?: number;
};

type ServiceVisitRatingResult = {
  id: string;
  score: number;
  comment: string | null;
  createdAt: Date;
  creditApplied: boolean;
};

const normalizeMetadata = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return { ...(value as Record<string, unknown>) };
};

export async function createServiceVisitRating(
  input: CreateServiceVisitRatingInput,
): Promise<ServiceVisitRatingResult> {
  const score = Math.round(input.score);
  if (!Number.isFinite(score) || score < 1 || score > 5) {
    throw new Error("invalid_score");
  }

  const result = await prisma.$transaction(async (tx) => {
    const visit = await tx.serviceVisit.findFirst({
      where: {
        id: input.visitId,
        customerId: input.customerId,
      },
      include: {
        rating: true,
        job: {
          select: {
            id: true,
            orgId: true,
          },
        },
      },
    });

    if (!visit) {
      throw new Error("visit_not_found");
    }
    if (visit.status !== "COMPLETED") {
      throw new Error("visit_not_completed");
    }
    if (visit.rating) {
      throw new Error("visit_already_rated");
    }
    if (!visit.assignedToId) {
      throw new Error("visit_unassigned");
    }

    const scooperProfile = await tx.scooperProfile.findFirst({
      where: { userId: visit.assignedToId },
      select: { id: true, metadata: true },
    });

    if (!scooperProfile) {
      throw new Error("scooper_not_found");
    }

    const orgId = visit.orgId ?? visit.job?.orgId ?? "yardura";
    const baseMetadata = normalizeMetadata(input.metadata);
    const tipCents =
      typeof input.tipCents === "number" && Number.isFinite(input.tipCents)
        ? Math.trunc(input.tipCents)
        : 0;
    const rating = await tx.serviceVisitRating.create({
      data: {
        orgId,
        serviceVisitId: visit.id,
        customerId: input.customerId,
        scooperId: scooperProfile.id,
        score,
        comment: input.comment ?? null,
        metadata: {
          ...baseMetadata,
          source: input.source ?? "customer-dashboard",
          ...(tipCents > 0 ? { tipCents } : {}),
        },
      },
    });

    const metadata = normalizeMetadata(scooperProfile.metadata);
    const previousCount =
      typeof metadata.ratingCount === "number" && Number.isFinite(metadata.ratingCount)
        ? metadata.ratingCount
        : 0;
    const previousAvg =
      typeof metadata.avgRating === "number" && Number.isFinite(metadata.avgRating)
        ? metadata.avgRating
        : 0;
    const nextCount = previousCount + 1;
    const nextAvg = (previousAvg * previousCount + score) / nextCount;

    await tx.scooperProfile.update({
      where: { id: scooperProfile.id },
      data: {
        metadata: {
          ...metadata,
          avgRating: Number(nextAvg.toFixed(2)),
          ratingCount: nextCount,
          lastRatingAt: new Date().toISOString(),
        },
      },
    });

    return {
      rating,
      jobId: visit.job?.id ?? null,
      orgId,
    };
  });

  let creditApplied = false;
  const config = await getBusinessConfig(result.orgId);
  const careCredits = resolveRatingCareCredits(config);
  if (careCredits > 0) {
    const metadata = normalizeMetadata(result.rating.metadata);
    const existingCredits = extractCareCreditsAwarded(metadata);
    if (existingCredits <= 0) {
      await prisma.serviceVisitRating.update({
        where: { id: result.rating.id },
        data: {
          metadata: {
            ...metadata,
            careCreditsAwarded: careCredits,
            careCreditsSource: "visit-rating",
            careCreditsAppliedAt: new Date().toISOString(),
          },
        },
      });
    }
    await awardCustomerRewardPoints({
      orgId: result.orgId,
      customerId: input.customerId,
      eventType: CustomerRewardEventType.VISIT_RATING,
      sourceKey: `visit-rating:${result.rating.id}`,
      points: careCredits,
      createdAt: result.rating.createdAt,
      metadata: {
        ratingId: result.rating.id,
        visitId: input.visitId,
        score,
      },
    });
    creditApplied = true;
  }

  return {
    id: result.rating.id,
    score: result.rating.score,
    comment: result.rating.comment,
    createdAt: result.rating.createdAt,
    creditApplied,
  };
}
