import { MediaAnalysisStatus, VisitMediaType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { addMediaAnalysisJob } from "@/lib/jobs/mediaAnalysisQueue";
import { runMediaAnalysis } from "@/lib/service-visits/media-analysis-core";

export async function queueMediaAnalysis(mediaId: string, options?: { force?: boolean }) {
  const media = await prisma.serviceVisitMedia.findUnique({
    where: { id: mediaId },
    select: {
      id: true,
      serviceVisitId: true,
      assetType: true,
      analysisStatus: true,
    },
  });

  if (!media) {
    return;
  }

  if (media.assetType !== VisitMediaType.INSIGHTSCOOP) {
    return;
  }

  if (!options?.force) {
    if (
      media.analysisStatus === MediaAnalysisStatus.PENDING ||
      media.analysisStatus === MediaAnalysisStatus.IN_PROGRESS
    ) {
      return;
    }
    if (media.analysisStatus === MediaAnalysisStatus.COMPLETED) {
      return;
    }
  }

  await prisma.serviceVisitMedia.update({
    where: { id: mediaId },
    data: {
      analysisStatus: MediaAnalysisStatus.PENDING,
      analysisRequestedAt: new Date(),
      analysisError: null,
    },
  });

  const jobId = await addMediaAnalysisJob({
    mediaId,
    force: options?.force ?? false,
  });

  if (!jobId) {
    // Run inline when the queue is unavailable.
    void runMediaAnalysis(mediaId, options?.force ?? false).catch((error) => {
      console.error("serviceVisit.media.analysis.run", { mediaId, error });
    });
  }
}
