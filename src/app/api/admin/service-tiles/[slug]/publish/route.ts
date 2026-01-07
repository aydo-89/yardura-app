import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { resolveBusinessId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { createVisitOffersForTile } from "@/lib/marketplace";
import { enqueueOfferPublishing } from "@/lib/jobs/marketplaceOfferPublisher";

const bodySchema = z.object({
  lookaheadDays: z.coerce.number().min(1).max(30).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
});

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const orgId = await resolveBusinessId(request);
  const { slug } = await params;
  const payload = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const tile = await prisma.serviceTile.findFirst({
    where: { orgId, slug },
    select: { id: true },
  });

  if (!tile) {
    return NextResponse.json({ error: "tile_not_found" }, { status: 404 });
  }

  const jobId = await enqueueOfferPublishing({
    orgId,
    tileSlugs: [slug],
    lookaheadDays: parsed.data.lookaheadDays,
    limitPerTile: parsed.data.limit,
  });

  if (jobId) {
    return NextResponse.json({
      ok: true,
      data: {
        jobId,
        status: "queued",
      },
    });
  }

  const offers = await createVisitOffersForTile({
    orgId,
    tileId: tile.id,
    lookaheadDays: parsed.data.lookaheadDays,
    limit: parsed.data.limit,
  });

  return NextResponse.json({ ok: true, created: offers.length, offers, queued: false });
}

export const runtime = "nodejs";
