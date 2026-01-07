import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authOptions, safeGetServerSession } from "@/lib/auth";
import { resolveBusinessId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { createCreditEntry } from "@/lib/billing/ledger";
import { isQuickBooksEnabled } from "@/lib/business-config";
import { info, warn } from "@/lib/log";

const ADMIN_ROLES = new Set(["OWNER", "ADMIN", "GOD_MODE"]);

const payloadSchema = z.object({
  jobId: z.string().min(1, "jobId is required"),
  customerId: z.string().min(1).optional(),
  orgId: z.string().min(1).optional(),
  amountCents: z
    .union([z.number(), z.string()])
    .transform((value) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return Math.trunc(value);
      }
      if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return Math.trunc(parsed);
        }
      }
      return NaN;
    })
    .refine((value) => Number.isFinite(value) && value > 0, {
      message: "amountCents must be a positive integer",
    }),
  reason: z.string().min(1).max(500),
  description: z.string().max(200).optional(),
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

  const payload = parsed.data;
  const orgId = payload.orgId ?? (await resolveBusinessId(request));

  const job = await prisma.job.findFirst({
    where: { id: payload.jobId, orgId },
    select: {
      id: true,
      orgId: true,
      customerId: true,
    },
  });

  if (!job) {
    warn("admin.billing.applyCredit", {
      orgId,
      jobId: payload.jobId,
      error: "job_not_found",
    });
    return NextResponse.json({ ok: false, error: "job_not_found" }, { status: 404 });
  }

  const customerId = payload.customerId ?? job.customerId;

  if (!customerId) {
    warn("admin.billing.applyCredit", {
      orgId,
      jobId: payload.jobId,
      error: "missing_customer",
    });
    return NextResponse.json(
      { ok: false, error: "missing_customer" },
      { status: 422 },
    );
  }

  const plan = await prisma.customerBillingPlan.findFirst({
    where: {
      orgId,
      jobId: payload.jobId,
      customerId,
    },
    select: { id: true },
  });

  if (!plan) {
    warn("admin.billing.applyCredit", {
      orgId,
      jobId: payload.jobId,
      customerId,
      error: "plan_not_found",
    });
    return NextResponse.json(
      { ok: false, error: "plan_not_found" },
      { status: 404 },
    );
  }

  const quickBooksEnabled = await isQuickBooksEnabled(orgId);
  const nowIso = new Date().toISOString();

  const entry = await createCreditEntry({
    orgId,
    jobId: payload.jobId,
    customerId,
    amountCents: payload.amountCents,
    description: payload.description ?? payload.reason,
    metadata: {
      source: "admin-adjustment",
      adminAdjustment: {
        reason: payload.reason,
        actorId: (session?.user as { id?: string } | undefined)?.id ?? null,
        actorName: (session?.user as { name?: string } | undefined)?.name ?? null,
        createdAt: nowIso,
      },
      quickbooks: quickBooksEnabled
        ? { status: "pending", lastAttempt: null }
        : { status: "disabled" },
    },
  });

  info("admin.billing.applyCredit", {
    orgId,
    jobId: payload.jobId,
    customerId,
    ledgerEntryId: entry?.id ?? null,
    quickBooksEnabled,
  });

  if (!entry) {
    return NextResponse.json(
      { ok: false, error: "entry_not_created" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      entry: {
        id: entry.id,
        jobId: entry.jobId,
        customerId: entry.customerId,
        serviceVisitId: entry.serviceVisitId,
        type: entry.type,
        status: entry.status,
        amountCents: entry.amountCents,
        description: entry.description,
        createdAt: entry.createdAt.toISOString(),
        appliedAt: entry.appliedAt ? entry.appliedAt.toISOString() : null,
        stripeInvoiceId: entry.stripeInvoiceId,
        metadata: entry.metadata ?? null,
      },
    },
  });
}
