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

const geometrySchema = z.object({
  type: z.string(),
  coordinates: z.any(),
});

const patchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  status: z.string().optional(),
  notes: z.string().max(2000).optional(),
  geometry: geometrySchema.optional(),
});

async function ensureTileBelongsToOrg(tileId: string, orgId: string) {
  const pool = getPostgisPool();
  const { rows } = await pool.query<{ org_id: string; status: string; slug: string }>(
    `SELECT org_id, status, slug FROM geo.service_tile WHERE tile_id = $1`,
    [tileId],
  );

  if (rows.length === 0) {
    return { ok: false as const, reason: "not_found" as const };
  }

  if (rows[0].org_id !== orgId) {
    return { ok: false as const, reason: "forbidden" as const };
  }

  return { ok: true as const, status: rows[0].status, slug: rows[0].slug };
}

export async function GET(
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

  const ownership = await ensureTileBelongsToOrg(tileId, orgId);
  if (!ownership.ok) {
    const status = ownership.reason === "not_found" ? 404 : 403;
    return NextResponse.json({ ok: false, error: ownership.reason }, { status });
  }

  const summary = await getTileSummary(tileId);
  if (!summary) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: { orgId, tile: summary } });
}

export async function PATCH(
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

  const ownership = await ensureTileBelongsToOrg(tileId, orgId);
  if (!ownership.ok) {
    const status = ownership.reason === "not_found" ? 404 : 403;
    return NextResponse.json({ ok: false, error: ownership.reason }, { status });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "invalid_json", message: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const parsed = patchSchema.safeParse(payload);
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

  if (!parsed.data || Object.keys(parsed.data).length === 0) {
    return NextResponse.json(
      { ok: false, error: "no_changes" },
      { status: 400 },
    );
  }

  const { name, status, notes, geometry } = parsed.data;

  const setFragments: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (name) {
    setFragments.push(`name = $${paramIndex}`);
    values.push(name);
    paramIndex += 1;
  }

  if (status) {
    setFragments.push(`status = $${paramIndex}`);
    values.push(status);
    paramIndex += 1;
  }

  if (notes !== undefined) {
    setFragments.push(`notes = $${paramIndex}`);
    values.push(notes);
    paramIndex += 1;
  }

  if (geometry) {
    const geomJson = JSON.stringify(geometry);
    const geomParam = paramIndex;
    setFragments.push(`geom = ST_SetSRID(ST_GeomFromGeoJSON($${geomParam}), 4326)`);
    setFragments.push(
      `geom_simplified = ST_SimplifyPreserveTopology(ST_SetSRID(ST_GeomFromGeoJSON($${geomParam}), 4326), 0.0005)`,
    );
    values.push(geomJson);
    paramIndex += 1;
  }

  setFragments.push(`updated_at = now()`);

  const pool = getPostgisPool();
  const client = await pool.connect();

  let updatedStatus = ownership.status;
  const tileSlug = ownership.slug;

  try {
    await client.query("BEGIN");

    const updateSql = `UPDATE geo.service_tile SET ${setFragments.join(", ")} WHERE tile_id = $${paramIndex} RETURNING status`;

    values.push(tileId);

    const updateRes = await client.query<{ status: string }>(updateSql, values);
    if (updateRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    updatedStatus = updateRes.rows[0].status;

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("tiles.patch", error);
    return NextResponse.json(
      { ok: false, error: "update_failed" },
      { status: 500 },
    );
  } finally {
    client.release();
  }

  if (geometry || status) {
    const mode: "sync" | "refresh" = geometry ? "sync" : "refresh";

    const publishJobId = await addTilePublishJob({
      jobId: `tile-edit-${tileId}-${Date.now()}`,
      tileId,
      slug: tileSlug,
      orgId,
      status: updatedStatus,
      addedBy: session?.user?.email ?? session?.user?.name ?? "tile-editor",
      mode,
    });

    if (!publishJobId) {
      try {
        if (mode === "sync") {
          await syncTileZips(tileId, {
            status: updatedStatus,
            addedBy: session?.user?.email ?? session?.user?.name ?? "tile-editor",
          });
        } else {
          await refreshTileZipCoverage(tileId);
        }
      } catch (error) {
        console.error("tiles.patch sync", error);
        return NextResponse.json(
          { ok: false, error: "zip_sync_failed" },
          { status: 500 },
        );
      }
    } else {
      return NextResponse.json({
        ok: true,
        data: {
          orgId,
          jobId: publishJobId,
          status: "queued" as const,
        },
      });
    }
  }

  const summary = await getTileSummary(tileId);
  return NextResponse.json({ ok: true, data: { orgId, tile: summary } });
}

export async function DELETE(
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

  const ownership = await ensureTileBelongsToOrg(tileId, orgId);
  if (!ownership.ok) {
    const status = ownership.reason === "not_found" ? 404 : 403;
    return NextResponse.json({ ok: false, error: ownership.reason }, { status });
  }

  const pool = getPostgisPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM geo.service_tile_zip WHERE tile_id = $1`, [tileId]);
    await client.query(`DELETE FROM geo.service_tile WHERE tile_id = $1`, [tileId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("tiles.delete", error);
    return NextResponse.json({ ok: false, error: "delete_failed" }, { status: 500 });
  } finally {
    client.release();
  }

  return NextResponse.json({ ok: true, data: { orgId, tileId } });
}

export const runtime = "nodejs";
