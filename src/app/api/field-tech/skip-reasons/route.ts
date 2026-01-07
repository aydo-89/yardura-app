import { NextRequest, NextResponse } from "next/server";

import { getScooperAuth } from "@/lib/auth/scooper";
import { listSkipReasons } from "@/lib/dispatch/skip-reasons";

export async function GET(request: NextRequest) {
  const auth = await getScooperAuth(request);

  if (!auth?.userId || !auth.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const skipReasons = await listSkipReasons(auth.orgId);
    return NextResponse.json({ ok: true, skipReasons });
  } catch (error) {
    console.error("field-tech.skip-reasons", error);
    return NextResponse.json({ error: "Failed to load skip reasons" }, { status: 500 });
  }
}

export const runtime = "nodejs";
