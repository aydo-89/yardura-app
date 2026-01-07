import { NextRequest, NextResponse } from "next/server";

import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { optimizeRouteInstance } from "@/lib/dispatch/routes";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const route = await optimizeRouteInstance(id);
    return NextResponse.json({ ok: true, route });
  } catch (error) {
    console.error("dispatch.routes.optimize", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
