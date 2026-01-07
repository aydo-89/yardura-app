import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfDay, addDays } from "date-fns";

const querySchema = z.object({
  orgId: z.string().min(1),
  date: z.string().datetime().optional(),
  lookAheadDays: z.number().int().min(0).max(7).optional(),
});

export async function GET(request: NextRequest) {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const date = parsed.data.date ? startOfDay(new Date(parsed.data.date)) : undefined;
  const from = date ?? startOfDay(new Date());
  const to = addDays(from, (parsed.data.lookAheadDays ?? 0) + 1);

  const drafts = await prisma.dispatchRouteDraft.findMany({
    where: {
      orgId: parsed.data.orgId,
      scheduledDate: {
        gte: from,
        lt: to,
      },
    },
    orderBy: {
      confidence: "desc",
    },
  });

  return NextResponse.json({ ok: true, drafts });
}

export const runtime = "nodejs";
