import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { extractUserRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";

type DurationRow = {
  label: string;
  averageMinutes: number;
  sampleCount: number;
};

type CombinedRow = {
  city: string | null;
  tile: string | null;
  scooper: string | null;
  averageMinutes: number;
  sampleCount: number;
};

const ALLOWED_ROLES = new Set([
  "ADMIN",
  "OWNER",
  "SALES_MANAGER",
  "FRANCHISE_OWNER",
]);

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = extractUserRole(session);
  if (!session || !role || !ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const orgId = (session.user as any)?.orgId ?? "yardura";
  const { searchParams } = new URL(request.url);
  const rangeDays = Number.parseInt(searchParams.get("rangeDays") ?? "90", 10);
  const limit = Number.parseInt(searchParams.get("limit") ?? "50", 10);
  const safeRangeDays = Number.isFinite(rangeDays) && rangeDays > 0 ? rangeDays : 90;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 200) : 50;
  const rangeStart = new Date(Date.now() - safeRangeDays * 24 * 60 * 60 * 1000);

  const whereClauses = [
    Prisma.sql`sv."orgId" = ${orgId}`,
    Prisma.sql`sv."actualStart" IS NOT NULL`,
    Prisma.sql`sv."actualEnd" IS NOT NULL`,
    Prisma.sql`sv."actualEnd" >= sv."actualStart"`,
    Prisma.sql`sv."status" = 'COMPLETED'`,
    Prisma.sql`sv."completedDate" >= ${rangeStart}`,
  ];
  const whereSql = Prisma.sql`WHERE ${Prisma.join(whereClauses, " AND ")}`;

  const overall = await prisma.$queryRaw<
    { average_minutes: number | null; sample_count: bigint }[]
  >(Prisma.sql`
    SELECT
      AVG(EXTRACT(EPOCH FROM (sv."actualEnd" - sv."actualStart")) / 60.0) AS average_minutes,
      COUNT(*) AS sample_count
    FROM "ServiceVisit" sv
    ${whereSql}
  `);

  const byCity = await prisma.$queryRaw<
    { city: string | null; average_minutes: number | null; sample_count: bigint }[]
  >(Prisma.sql`
    SELECT
      c."city" AS city,
      AVG(EXTRACT(EPOCH FROM (sv."actualEnd" - sv."actualStart")) / 60.0) AS average_minutes,
      COUNT(*) AS sample_count
    FROM "ServiceVisit" sv
    LEFT JOIN "Customer" c ON c.id = sv."customerId"
    ${whereSql}
    GROUP BY c."city"
    ORDER BY sample_count DESC
    LIMIT ${safeLimit}
  `);

  const byTile = await prisma.$queryRaw<
    { tile: string | null; average_minutes: number | null; sample_count: bigint }[]
  >(Prisma.sql`
    SELECT
      st."name" AS tile,
      AVG(EXTRACT(EPOCH FROM (sv."actualEnd" - sv."actualStart")) / 60.0) AS average_minutes,
      COUNT(*) AS sample_count
    FROM "ServiceVisit" sv
    LEFT JOIN "ServiceTile" st ON st.id = sv."tileId"
    ${whereSql}
    GROUP BY st."name"
    ORDER BY sample_count DESC
    LIMIT ${safeLimit}
  `);

  const byScooper = await prisma.$queryRaw<
    { scooper: string | null; average_minutes: number | null; sample_count: bigint }[]
  >(Prisma.sql`
    SELECT
      u."name" AS scooper,
      AVG(EXTRACT(EPOCH FROM (sv."actualEnd" - sv."actualStart")) / 60.0) AS average_minutes,
      COUNT(*) AS sample_count
    FROM "ServiceVisit" sv
    LEFT JOIN "User" u ON u.id = sv."assignedToId"
    ${whereSql}
    GROUP BY u."name"
    ORDER BY sample_count DESC
    LIMIT ${safeLimit}
  `);

  const byCityTileScooper = await prisma.$queryRaw<
    { city: string | null; tile: string | null; scooper: string | null; average_minutes: number | null; sample_count: bigint }[]
  >(Prisma.sql`
    SELECT
      c."city" AS city,
      st."name" AS tile,
      u."name" AS scooper,
      AVG(EXTRACT(EPOCH FROM (sv."actualEnd" - sv."actualStart")) / 60.0) AS average_minutes,
      COUNT(*) AS sample_count
    FROM "ServiceVisit" sv
    LEFT JOIN "Customer" c ON c.id = sv."customerId"
    LEFT JOIN "ServiceTile" st ON st.id = sv."tileId"
    LEFT JOIN "User" u ON u.id = sv."assignedToId"
    ${whereSql}
    GROUP BY c."city", st."name", u."name"
    ORDER BY sample_count DESC
    LIMIT ${safeLimit}
  `);

  const normalizeRows = (rows: DurationRow[]) =>
    rows.map((row) => ({
      ...row,
      averageMinutes: Number(row.averageMinutes),
      sampleCount: Number(row.sampleCount),
    }));

  const overallRow = overall[0] ?? { average_minutes: null, sample_count: BigInt(0) };

  return NextResponse.json({
    rangeStart: rangeStart.toISOString(),
    rangeEnd: new Date().toISOString(),
    overall: {
      averageMinutes: overallRow.average_minutes ?? 0,
      sampleCount: Number(overallRow.sample_count),
    },
    byCity: normalizeRows(
    byCity.map((row) => ({
      label: row.city ?? "Unknown",
      averageMinutes: row.average_minutes ?? 0,
      sampleCount: Number(row.sample_count),
    })),
  ),
    byTile: normalizeRows(
    byTile.map((row) => ({
      label: row.tile ?? "Unassigned",
      averageMinutes: row.average_minutes ?? 0,
      sampleCount: Number(row.sample_count),
    })),
  ),
    byScooper: normalizeRows(
    byScooper.map((row) => ({
      label: row.scooper ?? "Unassigned",
      averageMinutes: row.average_minutes ?? 0,
      sampleCount: Number(row.sample_count),
    })),
  ),
    byCityTileScooper: byCityTileScooper.map((row) => ({
      city: row.city ?? "Unknown",
      tile: row.tile ?? "Unassigned",
      scooper: row.scooper ?? "Unassigned",
      averageMinutes: Number(row.average_minutes ?? 0),
      sampleCount: Number(row.sample_count),
    })) satisfies CombinedRow[],
  });
}

export const runtime = "nodejs";
