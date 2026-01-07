import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authOptions, safeGetServerSession } from "@/lib/auth";
import { getTileReadinessBySlug } from "@/lib/marketplace";
import { getPostgisPool } from "@/lib/geo/postgis";
import { prisma } from "@/lib/prisma";
import { resolveBusinessId } from "@/lib/tenant";
import { ServiceTileStatus } from "@prisma/client";
import { addTilePublishJob } from "@/lib/jobs/tilePublishQueue";
import { refreshTileZipCoverage } from "@/lib/tiles/generator";

function ensureAdmin(session: any) {
  const role = session?.userRole ?? session?.user?.role ?? null;
  if (!session?.user || !["OWNER", "ADMIN"].includes(role)) {
    throw new Error("unauthorized");
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const orgId = await resolveBusinessId(request);
  const { slug } = await context.params;
  const session = await safeGetServerSession(request, authOptions as any);

  try {
    ensureAdmin(session);
  } catch (error) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  try {
    const readiness = await getTileReadinessBySlug(orgId, slug);
    if (!readiness) {
      return NextResponse.json({ error: "Tile not found" }, { status: 404 });
    }

    return NextResponse.json({ orgId, readiness });
  } catch (error) {
    console.error("service-tiles detail error", error);
    return NextResponse.json(
      { error: "Unable to load service tile" },
      { status: 500 },
    );
  }
}

const patchSchema = z
  .object({
    minCertifiedScoopers: z.number().int().min(0).max(500).optional(),
    minCustomerUnits: z.number().int().min(0).max(2000).optional(),
    coverageRadiusMeters: z
      .union([z.number().int().min(0).max(100000), z.null()])
      .optional(),
    status: z.nativeEnum(ServiceTileStatus).optional(),
    goLiveDate: z
      .union([z.string().datetime({ offset: true }), z.string().date(), z.null()])
      .optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict();

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const session = await safeGetServerSession(request, authOptions as any);

  try {
    ensureAdmin(session);
  } catch (error) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  const orgId = await resolveBusinessId(request);
  const { slug } = await context.params;

  const raw = await request.json().catch(() => null);

  if (raw === null || typeof raw !== "object") {
    return NextResponse.json(
      { error: "invalid_body", message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const payload = parsed.data;

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ ok: true, unchanged: true });
  }

  const pool = getPostgisPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const tileRes = await client.query<{ tile_id: string }>(
      `SELECT tile_id FROM geo.service_tile WHERE org_id = $1 AND slug = $2 LIMIT 1`,
      [orgId, slug],
    );

    if (tileRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "tile_not_found" }, { status: 404 });
    }

    const tileId = tileRes.rows[0].tile_id;
    const postgisAssignments: string[] = [];
    const postgisValues: Array<string | number | null> = [];

    const setValue = (column: string, value: string | number | null) => {
      postgisAssignments.push(`${column} = $${postgisValues.length + 2}`);
      postgisValues.push(value);
    };

    if (payload.minCertifiedScoopers !== undefined) {
      setValue("min_scoopers", payload.minCertifiedScoopers);
    }

    if (payload.minCustomerUnits !== undefined) {
      setValue("min_customer_units", payload.minCustomerUnits);
    }

    if (payload.coverageRadiusMeters !== undefined) {
      setValue("coverage_radius_m", payload.coverageRadiusMeters);
    }

    if (payload.status !== undefined) {
      setValue("status", payload.status);
    }

    if (payload.goLiveDate !== undefined) {
      const goLiveDate = payload.goLiveDate ? new Date(payload.goLiveDate).toISOString() : null;
      setValue("go_live_date", goLiveDate);
    }

    if (payload.notes !== undefined) {
      setValue("notes", payload.notes ?? null);
    }

    if (postgisAssignments.length > 0) {
      await client.query(
        `UPDATE geo.service_tile
         SET ${postgisAssignments.join(", ")}, updated_at = now()
         WHERE tile_id = $1`,
        [tileId, ...postgisValues],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("service-tiles PATCH error", error);
    return NextResponse.json({ error: "failed_to_update_tile" }, { status: 500 });
  } finally {
    client.release();
  }

  const prismaUpdates: Record<string, unknown> = {};

  if (payload.minCertifiedScoopers !== undefined) {
    prismaUpdates.minCertifiedScoopers = payload.minCertifiedScoopers;
  }

  if (payload.minCustomerUnits !== undefined) {
    prismaUpdates.minCustomerUnits = payload.minCustomerUnits;
  }

  if (payload.coverageRadiusMeters !== undefined) {
    prismaUpdates.coverageRadiusMeters = payload.coverageRadiusMeters;
  }

  if (payload.status !== undefined) {
    prismaUpdates.status = payload.status;
  }

  if (payload.goLiveDate !== undefined) {
    prismaUpdates.goLiveDate = payload.goLiveDate ? new Date(payload.goLiveDate) : null;
  }

  if (payload.notes !== undefined) {
    prismaUpdates.notes = payload.notes;
  }

  if (Object.keys(prismaUpdates).length > 0) {
    await prisma.serviceTile.updateMany({
      where: { orgId, slug },
      data: prismaUpdates,
    });
  }

  const updatedTile = await prisma.serviceTile.findFirst({
    where: { orgId, slug },
    select: { id: true, status: true },
  });

  if (updatedTile?.id) {
    const publishJobId = await addTilePublishJob({
      jobId: `publish-${updatedTile.id}-${Date.now()}`,
      tileId: updatedTile.id,
      slug,
      orgId,
      status: updatedTile.status,
      goLiveDate:
        payload.goLiveDate !== undefined && payload.goLiveDate !== null
          ? new Date(payload.goLiveDate).toISOString()
          : undefined,
      addedBy: session?.user?.email ?? session?.user?.name ?? "tile-publish",
      mode: "refresh",
    });

    if (publishJobId) {
      return NextResponse.json({
        ok: true,
        data: {
          jobId: publishJobId,
          status: "queued",
        },
      });
    } else {
      await refreshTileZipCoverage(updatedTile.id);
    }
  }

  const readiness = await getTileReadinessBySlug(orgId, slug);

  return NextResponse.json({ ok: true, readiness });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const session = await safeGetServerSession(request, authOptions as any);

  try {
    ensureAdmin(session);
  } catch (error) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 403 });
  }

  const orgId = await resolveBusinessId(request);
  const { slug } = await context.params;

  const pool = getPostgisPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const tileRes = await client.query<{ tile_id: string }>(
      `SELECT tile_id FROM geo.service_tile WHERE org_id = $1 AND slug = $2 LIMIT 1`,
      [orgId, slug],
    );

    if (tileRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "tile_not_found" }, { status: 404 });
    }

    const tileId = tileRes.rows[0].tile_id;

    await client.query(`DELETE FROM geo.service_tile_zip WHERE tile_id = $1`, [tileId]);
    await client.query(`DELETE FROM geo.service_tile WHERE tile_id = $1`, [tileId]);

    await client.query("COMMIT");

    return NextResponse.json({ ok: true, deleted: slug });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("service-tiles delete error", error);
    return NextResponse.json(
      { ok: false, error: "failed_to_delete_tile" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}

export const runtime = "nodejs";
