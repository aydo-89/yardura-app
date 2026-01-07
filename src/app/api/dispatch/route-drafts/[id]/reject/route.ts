import { NextResponse } from "next/server";

import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureDispatchSchema } from "@/lib/dispatch/schema-guard";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureDispatchSchema();

  const { id } = await params;
  const draft = await prisma.dispatchRouteDraft.findUnique({ where: { id } });
  if (!draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  await prisma.dispatchDecisionLog.create({
    data: {
      orgId: draft.orgId,
      action: "draft_reject",
      actorId: (session.user as any)?.id ?? null,
      routeDraftId: draft.id,
      confidence: draft.confidence,
      metadata: draft.metadata ?? undefined,
    },
  });

  await prisma.dispatchRouteDraft.delete({ where: { id: draft.id } });

  return NextResponse.json({ ok: true });
}

export const runtime = "nodejs";
