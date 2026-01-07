import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";

import { authOptions, safeGetServerSession } from "@/lib/auth";
import { resolveBusinessId } from "@/lib/tenant";
import { generateTilesForPlace } from "@/lib/tiles/generator";
import { listTilesByStatus } from "@/lib/tiles/admin";
import { addTileGenerationJob } from "@/lib/jobs/tileGenerationQueue";

function ensureAdmin(session: any) {
  const role = session?.userRole ?? session?.user?.role ?? null;
  if (!session?.user || !["OWNER", "ADMIN"].includes(role)) {
    throw new Error("unauthorized");
  }
}

const generateSchema = z.object({
  placeId: z.string().min(1, "placeId is required"),
  city: z.string().optional(),
  state: z.string().optional(),
  tileCount: z.number().int().positive().max(50).default(4),
  strategy: z.literal("kmeans").optional(),
  status: z.string().optional(),
  generationMode: z.enum(["cluster", "perZip"]).default("cluster"),
});

export async function POST(request: NextRequest) {
  const session = await safeGetServerSession(request, authOptions as any);

  try {
    ensureAdmin(session);
  } catch (error) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 403 });
  }

  const orgId = await resolveBusinessId(request);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "invalid_json", message: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const parsed = generateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "validation_error",
        details: parsed.error.flatten(),
      },
      { status: 422 },
    );
  }

  const createdBy = session?.user?.email ?? session?.user?.name ?? "tile-generator";
  const jobId = `tgen_${nanoid(12)}`;

  try {
    // Try to queue the job first
    const queuedJobId = await addTileGenerationJob({
      jobId,
      ...parsed.data,
      orgId,
      createdBy,
    });

    // If queue is available, return job ID for status polling
    if (queuedJobId) {
      console.log(`[TileGen] Job ${queuedJobId} queued for ${parsed.data.city || 'unknown city'}, ${parsed.data.state || 'unknown state'}`);
      return NextResponse.json({
        ok: true,
        data: {
          jobId: queuedJobId,
          status: "queued",
          message: "Tile generation job queued. Poll /api/admin/tiles/generate/status for progress.",
        },
      });
    }

    // Fallback to synchronous processing if queue is not available
    console.warn("[TileGen] Queue not available, processing synchronously");
    const generation = await generateTilesForPlace({
      ...parsed.data,
      orgId,
      createdBy,
    });

    const drafts = await listTilesByStatus(orgId, "DRAFT");

    return NextResponse.json({
      ok: true,
      data: {
        orgId,
        generation,
        drafts,
        synchronous: true,
      },
    });
  } catch (error) {
    console.error("tiles.generate POST", error);
    const message = error instanceof Error ? error.message : "Tile generation failed";
    return NextResponse.json(
      { ok: false, error: "generation_failed", message },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
