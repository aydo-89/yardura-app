import { NextRequest, NextResponse } from "next/server";

import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { getVisitDetailForUser } from "@/lib/service-visits/getVisitDetail";

type RouteParams = { params: Promise<{ visitId: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { visitId } = await params;
  const session = await safeGetServerSession(authOptions as any);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const visit = await getVisitDetailForUser({ visitId, userId });

  if (!visit) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    visit,
  });
}

export const runtime = "nodejs";
