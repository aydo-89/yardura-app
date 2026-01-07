import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authOptions, safeGetServerSession } from "@/lib/auth";
import { resolveBusinessId } from "@/lib/tenant";
import { getPostgisPool } from "@/lib/geo/postgis";

function ensureAdmin(session: any) {
  const role = session?.userRole ?? session?.user?.role ?? null;
  if (role !== "ADMIN" && role !== "OWNER") {
    throw new Error("unauthorized");
  }
}

const updateNameSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name too long"),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ tileId: string }> },
) {
  const session = await safeGetServerSession(request, authOptions as any);

  try {
    ensureAdmin(session);
  } catch (error) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 403 });
  }

  const orgId = await resolveBusinessId(request);
  const { tileId } = await context.params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  const parsed = updateNameSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "validation_error", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const pool = getPostgisPool();
    const result = await pool.query(
      `UPDATE geo.service_tile
       SET name = $1, updated_at = now()
       WHERE tile_id = $2 AND org_id = $3
       RETURNING tile_id, name, slug, status`,
      [parsed.data.name, tileId, orgId],
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { ok: false, error: "tile_not_found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      tile: result.rows[0],
    });
  } catch (error) {
    console.error("tile name update error", error);
    return NextResponse.json(
      { ok: false, error: "update_failed" },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";









