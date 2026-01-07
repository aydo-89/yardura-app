import { NextRequest, NextResponse } from "next/server";
import { VisitMediaType } from "@prisma/client";

import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { queueMediaAnalysis } from "@/lib/service-visits/media-analysis";

type RouteParams = { params: Promise<{ visitId: string; mediaId: string }> };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { visitId, mediaId } = await params;
  const session = await safeGetServerSession(authOptions as any);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const media = await prisma.serviceVisitMedia.findFirst({
    where: {
      id: mediaId,
      serviceVisitId: visitId,
    },
    include: {
      serviceVisit: {
        select: { assignedToId: true },
      },
    },
  });

  if (!media || media.serviceVisit.assignedToId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (media.assetType !== VisitMediaType.INSIGHTSCOOP) {
    return NextResponse.json(
      { error: "analysis_not_supported" },
      { status: 400 },
    );
  }

  try {
    await queueMediaAnalysis(media.id, { force: true });
    const refreshed = await prisma.serviceVisitMedia.findUnique({
      where: { id: media.id },
    });

    return NextResponse.json({ ok: true, media: refreshed ?? media });
  } catch (error) {
    console.error("field-tech.media.reanalyze", { mediaId, visitId, error });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
