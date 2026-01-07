import { NextRequest, NextResponse } from "next/server";

import { getScooperAuth } from "@/lib/auth/scooper";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ visitId: string; mediaId: string }> };

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { visitId, mediaId } = await params;
  const auth = await getScooperAuth(_request);
  const userId = auth?.userId;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const visit = await prisma.serviceVisit.findUnique({
      where: { id: visitId },
      select: { assignedToId: true },
    });

    if (!visit || visit.assignedToId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Delete the media record (storage cleanup could be added here if needed)
    await prisma.serviceVisitMedia.delete({
      where: { id: mediaId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[field-tech-media-delete] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete media" },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";



