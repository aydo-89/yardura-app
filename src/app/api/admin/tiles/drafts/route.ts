import { NextRequest, NextResponse } from "next/server";

import { authOptions, safeGetServerSession } from "@/lib/auth";
import { resolveBusinessId } from "@/lib/tenant";
import { countTilesByStatus, listTilesByStatus } from "@/lib/tiles/admin";

function ensureAdmin(session: any) {
  const role = session?.userRole ?? session?.user?.role ?? null;
  if (!session?.user || !["OWNER", "ADMIN"].includes(role)) {
    throw new Error("unauthorized");
  }
}

export async function GET(request: NextRequest) {
  const session = await safeGetServerSession(request, authOptions as any);

  try {
    ensureAdmin(session);
  } catch (error) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 403 });
  }

  const orgId = await resolveBusinessId(request);

  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const pageParam = Number.parseInt(searchParams.get("page") ?? "1", 10);
    const limitParam = Number.parseInt(searchParams.get("limit") ?? "50", 10);

    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const limitRaw = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 50;
    const limit = Math.min(100, Math.max(10, limitRaw));
    const offset = (page - 1) * limit;

    const [total, drafts] = await Promise.all([
      countTilesByStatus(orgId, "DRAFT"),
      listTilesByStatus(orgId, "DRAFT", { limit, offset }),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        orgId,
        tiles: drafts,
        total,
        page,
        limit,
      },
    });
  } catch (error) {
    console.error("tiles.drafts GET", error);
    return NextResponse.json(
      { ok: false, error: "failed_to_load_tiles" },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
