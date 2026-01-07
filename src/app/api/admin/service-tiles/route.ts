import { NextRequest, NextResponse } from "next/server";

import { listTileReadiness, summarizeTileReadiness } from "@/lib/marketplace";
import { resolveBusinessId } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  const orgId = await resolveBusinessId(request);

  try {
    const readiness = await listTileReadiness(orgId);

    return NextResponse.json({
      orgId,
      tiles: readiness.map(summarizeTileReadiness),
    });
  } catch (error) {
    console.error("service-tiles GET error", error);
    return NextResponse.json(
      { error: "Unable to load service tiles" },
      { status: 500 },
    );
  }
}
