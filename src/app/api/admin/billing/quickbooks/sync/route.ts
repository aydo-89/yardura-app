import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authOptions, safeGetServerSession } from "@/lib/auth";
import { resolveBusinessId } from "@/lib/tenant";
import { enqueueQuickBooksSync } from "@/lib/jobs/quickbooksSync";
import { getQuickBooksSettings } from "@/lib/business-config";

const ADMIN_ROLES = new Set(["OWNER", "ADMIN", "GOD_MODE"]);

const payloadSchema = z.object({
  orgId: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(200).optional(),
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

  const body = await request.json().catch(() => ({}));
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "validation_error", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { orgId: overrideOrgId, limit } = parsed.data;
  const orgId = overrideOrgId ?? (await resolveBusinessId(request));

  const settings = await getQuickBooksSettings(orgId);
  if (!settings.enabled) {
    return NextResponse.json(
      {
        ok: false,
        error: "quickbooks_disabled",
        message: "QuickBooks integration is currently disabled for this business.",
      },
      { status: 409 },
    );
  }

  await enqueueQuickBooksSync({ orgId, limit, reason: "manual" });

  return NextResponse.json({ ok: true, queued: true });
}
