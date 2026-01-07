import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { listScheduledVisits } from "@/lib/dispatch/visits";
import { extractPreferredTimeWindow } from "@/lib/time-window";

const schema = z.object({
  orgId: z.string().min(1),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  includeAssigned: z.coerce.boolean().optional(),
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

  const { orgId, from, to, includeAssigned } = parsed.data;
  const visits = await listScheduledVisits({
    orgId,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    includeAssigned,
  });

  const hydrated = visits.map((visit) => {
    const { slug, label } = extractPreferredTimeWindow(visit.metadata);
    return {
      ...visit,
      preferredTimeWindowSlug: slug,
      preferredTimeWindowLabel: label,
    };
  });

  return NextResponse.json({ ok: true, visits: hydrated });
}

export const runtime = "nodejs";
