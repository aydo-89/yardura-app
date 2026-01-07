import { NextRequest, NextResponse } from "next/server";

import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { claimRouteShift } from "@/lib/marketplace";

type RouteContext = { params: Promise<{ shiftId: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { shiftId } = await params;
  const session = await safeGetServerSession(authOptions as any);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await claimRouteShift({ shiftId, userId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export const runtime = "nodejs";
