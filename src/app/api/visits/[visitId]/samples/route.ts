import { NextRequest, NextResponse } from "next/server";

import { VisitMediaType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { createSignedUrl } from "@/lib/supabase-admin";
import { env } from "@/lib/env";
import { isWellnessFlaggedMedia } from "@/lib/service-visits/flagging";

type RouteParams = { params: Promise<{ visitId: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { visitId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const reveal = searchParams.get("reveal") === "1";
  const includeAll = searchParams.get("includeAll") === "1";

  try {
    const visit = await prisma.serviceVisit.findUnique({
      where: { id: visitId },
      include: {
        customer: {
          select: {
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
        insights: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!visit) {
      return NextResponse.json({ error: "Visit not found" }, { status: 404 });
    }

    const bucket = env.STORAGE_BUCKET;
    if (!bucket) {
      return NextResponse.json(
        { error: "Storage not configured" },
        { status: 500 },
      );
    }

    const gateMedia = await prisma.serviceVisitMedia.findFirst({
      where: { serviceVisitId: visitId, assetType: VisitMediaType.GATE },
      orderBy: { capturedAt: "desc" },
    });

    let gatePhoto: { url: string; capturedAt: string } | null = null;
    if (gateMedia?.storagePath) {
      try {
        const url = await createSignedUrl(
          bucket,
          gateMedia.storagePath,
          24 * 60 * 60,
        );
        gatePhoto = {
          url,
          capturedAt: gateMedia.capturedAt.toISOString(),
        };
      } catch (error) {
        console.error("[samples-view] Failed to sign gate photo URL", {
          mediaId: gateMedia.id,
          error,
        });
      }
    }

    // Get the overall insight summary
    const insight = visit.insights[0] ?? null;

    const isFlaggedMedia = (media: typeof visit.media[number]) =>
      isWellnessFlaggedMedia(
        {
          analysisResult: media.analysisResult,
          reviewStatus: media.reviewStatus,
          visibilityState: media.visibilityState,
        },
        { requireVisible: false },
      );

    const flaggedMedia = visit.media.filter(isFlaggedMedia);
    const mediaToReturn = includeAll ? visit.media : flaggedMedia;

    // Generate signed URLs only when explicitly revealed
    const samplesWithUrls = await Promise.all(
      mediaToReturn.map(async (media, index) => {
        let url = "";
        if (reveal) {
          try {
            url = await createSignedUrl(bucket, media.storagePath, 24 * 60 * 60); // 24 hours
          } catch (error) {
            console.error("[samples-view] Failed to sign URL", {
              mediaId: media.id,
              error,
            });
          }
        }

        const result = media.analysisResult as any;
        const isFlagged = isFlaggedMedia(media);

        return {
          id: media.id,
          url,
          capturedAt: media.capturedAt.toISOString(),
          analysisResult: result,
          analysisConfidence: media.analysisConfidence,
          isFlagged,
          stoolSampleId: media.stoolSampleId,
          stoolSampleView: media.stoolSampleView,
          sampleIndex: index + 1,
        };
      }),
    );

    // Calculate summary stats - count unique samples by stoolSampleId
    // (surface + cross-section of same sample = 1 sample, not 2)
    const uniqueSampleIds = new Set<string>();
    const unpairedSamples: typeof samplesWithUrls = [];
    const flaggedSampleIds = new Set<string>();
    const flaggedUnpaired: typeof samplesWithUrls = [];

    visit.media.forEach((media) => {
      const result = media.analysisResult as any;
      const isFlagged = isFlaggedMedia(media);
      const sampleItem = {
        id: media.id,
        url: "",
        capturedAt: media.capturedAt.toISOString(),
        analysisResult: result,
        analysisConfidence: media.analysisConfidence,
        isFlagged,
        stoolSampleId: media.stoolSampleId,
        stoolSampleView: media.stoolSampleView,
        sampleIndex: 0,
      } as const;
      if (sampleItem.stoolSampleId) {
        uniqueSampleIds.add(sampleItem.stoolSampleId);
        if (sampleItem.isFlagged) {
          flaggedSampleIds.add(sampleItem.stoolSampleId);
        }
      } else {
        unpairedSamples.push(sampleItem);
        if (sampleItem.isFlagged) {
          flaggedUnpaired.push(sampleItem);
        }
      }
    });
    
    const totalUniqueSamples = uniqueSampleIds.size + unpairedSamples.length;
    const flaggedCount = flaggedSampleIds.size + flaggedUnpaired.length;
    const healthyCount = totalUniqueSamples - flaggedCount;

    return NextResponse.json({
      ok: true,
      data: {
        visitId: visit.id,
        customerName: visit.customer?.name || "Customer",
        servicedAt: (visit.completedDate || visit.scheduledDate).toISOString(),
        samples: samplesWithUrls,
        gatePhoto,
        // Overall summary
        summary: insight ? {
          color: insight.colorIndicator,
          consistency: insight.consistencyIndicator,
          content: insight.contentIndicator,
          observations: insight.observations,
          wellnessFlag: insight.wellnessFlag,
          flagReason: insight.flagReason,
        } : null,
        imagesHidden: !reveal,
        stats: {
          total: totalUniqueSamples,
          totalImages: visit.media.length,
          flagged: flaggedCount,
          healthy: healthyCount,
        },
      },
    });
  } catch (error) {
    console.error("[samples-view] Error fetching samples:", error);
    if (error instanceof Error) {
      console.error("[samples-view] Error stack:", error.stack);
      console.error("[samples-view] Error message:", error.message);
    }
    return NextResponse.json(
      { error: "Failed to load samples", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
