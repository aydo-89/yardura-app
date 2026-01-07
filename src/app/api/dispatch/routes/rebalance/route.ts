import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";

const schema = z.object({
  orgId: z.string().min(1),
  date: z.string().datetime(),
});

export async function POST(req: NextRequest) {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = schema.parse(await req.json());
    console.warn("dispatch.rebalance.disabled", {
      orgId: payload.orgId,
      date: payload.date,
    });
    return NextResponse.json({ ok: true, disabled: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "validation_failed", details: error.flatten() },
        { status: 422 },
      );
    }
    console.error("dispatch.rebalance", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
