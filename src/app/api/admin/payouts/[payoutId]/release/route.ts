import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractUserRole } from "@/lib/auth/roles";
import { releaseVisitPayout } from "@/lib/marketplace/payouts";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const role = extractUserRole(session);
  if (!session || !role || (role !== "ADMIN" && role !== "OWNER")) {
    return { error: "Unauthorized", status: 403 } as const;
  }
  return { session } as const;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ payoutId: string }> },
) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { payoutId } = await params;
  if (!payoutId) {
    return NextResponse.json({ error: "missing_payout_id" }, { status: 400 });
  }

  const adminUser = await prisma.user.findUnique({
    where: { id: auth.session.user.id },
    select: { orgId: true },
  });

  if (!adminUser?.orgId) {
    return NextResponse.json({ error: "admin_org_missing" }, { status: 400 });
  }

  const payout = await prisma.visitPayout.findUnique({
    where: { id: payoutId },
    select: { id: true, orgId: true },
  });

  if (!payout) {
    return NextResponse.json({ error: "payout_not_found" }, { status: 404 });
  }

  if (payout.orgId !== adminUser.orgId) {
    return NextResponse.json({ error: "payout_forbidden" }, { status: 403 });
  }

  try {
    const released = await releaseVisitPayout(payoutId);
    return NextResponse.json({ payout: released });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status =
      message === "payout_not_ready"
        ? 409
        : message === "payout_amount_invalid"
          ? 422
          : message === "payout_account_missing"
            ? 409
            : message === "payouts_not_enabled"
              ? 409
              : message === "payout_not_found"
                ? 404
                : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export const runtime = "nodejs";
