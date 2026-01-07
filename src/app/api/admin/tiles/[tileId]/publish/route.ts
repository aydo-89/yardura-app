import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authOptions, safeGetServerSession } from "@/lib/auth";
import { resolveBusinessId } from "@/lib/tenant";
import { getPostgisPool } from "@/lib/geo/postgis";
import { getTileSummary } from "@/lib/tiles/admin";
import { refreshTileZipCoverage, syncTileZips } from "@/lib/tiles/generator";
import { addTilePublishJob } from "@/lib/jobs/tilePublishQueue";

function ensureAdmin(session: any) {
  const role = session?.userRole ?? session?.user?.role ?? null;
  if (!session?.user || !["OWNER", "ADMIN"].includes(role)) {
    throw new Error("unauthorized");
  }
}

const publishSchema = z.object({
  status: z.string().default("AVAILABLE"),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tileId: string }> },
) {
  const { tileId } = await context.params;
  const session = await safeGetServerSession(request, authOptions as any);

  try {
    ensureAdmin(session);
  } catch (error) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 403 });
  }

  const orgId = await resolveBusinessId(request);

  let body: unknown;
  try {
    body = await request.json().catch(() => ({}));
  } catch (error) {
    body = {};
  }

  const parsed = publishSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "validation_error", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const pool = getPostgisPool();
  const client = await pool.connect();
  let updated = false;
  let hadAssignedZips = false;
  let tileSlug: string | null = null;

  try {
    await client.query("BEGIN");

    const res = await client.query<{ org_id: string; slug: string }>(
      `SELECT org_id, slug FROM geo.service_tile WHERE tile_id = $1`,
      [tileId],
    );
    if (res.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    if (res.rows[0].org_id !== orgId) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    tileSlug = res.rows[0].slug;

    const zipCountRes = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM geo.service_tile_zip WHERE tile_id = $1`,
      [tileId],
    );
    hadAssignedZips = Number(zipCountRes.rows[0]?.count ?? "0") > 0;

    await client.query(
      `UPDATE geo.service_tile
       SET status = $2, updated_at = now()
       WHERE tile_id = $1`,
      [tileId, parsed.data.status],
    );

    await client.query("COMMIT");
    updated = true;
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("tile.publish", error);
    return NextResponse.json({ ok: false, error: "publish_failed" }, { status: 500 });
  } finally {
    client.release();
  }

  if (updated) {
    const publishJobId = await addTilePublishJob({
      jobId: `publish-${tileId}-${Date.now()}`,
      tileId,
      slug: tileSlug ?? tileId,
      orgId,
      status: parsed.data.status,
      addedBy: session?.user?.email ?? session?.user?.name ?? "tile-publish",
      mode: hadAssignedZips ? "refresh" : "sync",
    });

    if (publishJobId) {
      return NextResponse.json({
        ok: true,
        data: {
          jobId: publishJobId,
          status: "queued",
        },
      });
    }

    try {
      if (hadAssignedZips) {
        await refreshTileZipCoverage(tileId);
      } else {
        await syncTileZips(tileId, {
          status: parsed.data.status,
          addedBy: session?.user?.email ?? session?.user?.name ?? "tile-publish",
        });
      }
    } catch (error) {
      console.error("tile.publish sync", error);
      return NextResponse.json({ ok: false, error: "zip_sync_failed" }, { status: 500 });
    }
  }

  const summary = await getTileSummary(tileId);
  return NextResponse.json({ ok: true, data: { orgId, tile: summary } });
}

export const runtime = "nodejs";
