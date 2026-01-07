import { NextRequest, NextResponse } from "next/server";
import { BillingLedgerEntryStatus } from "@prisma/client";
import { z } from "zod";

import { authOptions, safeGetServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { voidLedgerEntries } from "@/lib/billing/ledger";
import { info } from "@/lib/log";

const ADMIN_ROLES = new Set(["OWNER", "ADMIN", "GOD_MODE"]);

const payloadSchema = z.object({
  entryId: z.string().min(1, "entryId is required"),
  reason: z.string().max(500).optional(),
});

function ensureAdmin(session: any) {
  const role = session?.userRole ?? session?.user?.role ?? null;
  if (!session?.user || !role || !ADMIN_ROLES.has(role)) {
    throw new Error("unauthorized");
  }
}

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await safeGetServerSession(authOptions as any);
  try {
    ensureAdmin(session);
  } catch (error) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => ({}));
  const parsed = payloadSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "validation_error", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { entryId, reason } = parsed.data;

  const entry = await prisma.customerBillingLedgerEntry.findUnique({
    where: { id: entryId },
    select: {
      id: true,
      jobId: true,
      customerId: true,
      status: true,
      amountCents: true,
    },
  });

  if (!entry) {
    return NextResponse.json({ ok: false, error: "entry_not_found" }, { status: 404 });
  }

  if (entry.status === BillingLedgerEntryStatus.APPLIED) {
    return NextResponse.json(
      { ok: false, error: "entry_already_applied" },
      { status: 409 },
    );
  }

  await voidLedgerEntries([entryId], {
    reason: reason ?? null,
    actorId: (session?.user as { id?: string } | undefined)?.id ?? null,
    actorName: (session?.user as { name?: string } | undefined)?.name ?? null,
  });

  info("admin.billing.voidEntry", {
    entryId,
    jobId: entry.jobId,
    customerId: entry.customerId,
    amountCents: entry.amountCents,
  });

  return NextResponse.json({ ok: true });
}
