import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { computeRouteSuggestions } from "@/lib/dispatch/routes";

const schema = z.object({
  orgId: z.string().min(1),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export async function GET(request: NextRequest) {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { orgId, from, to } = parsed.data;

  const suggestions = await computeRouteSuggestions({
    orgId,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  });

  return NextResponse.json({ ok: true, suggestions });
}

export const runtime = "nodejs";
