import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { safeGetServerSession } from "@/lib/auth";
import { cancelJobSubscriptionByAdmin } from "@/lib/admin/customers";

const GOD_MODE_EMAIL = "ayden@yardura.com";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user || session.user.email !== GOD_MODE_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { immediate } = await request.json().catch(() => ({ immediate: false }));
  const { jobId } = await params;

  try {
    await cancelJobSubscriptionByAdmin(jobId, { immediate: Boolean(immediate) });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("admin.job.cancel", error);
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Unable to cancel subscription" }, { status: 500 });
  }
}

export const runtime = "nodejs";
