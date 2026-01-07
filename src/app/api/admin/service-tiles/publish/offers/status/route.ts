import { NextRequest, NextResponse } from "next/server";

import { authOptions, safeGetServerSession } from "@/lib/auth";
import { resolveBusinessId } from "@/lib/tenant";
import { getOfferPublishJobStatus } from "@/lib/jobs/marketplaceOfferPublisher";

function ensureAdmin(session: any) {
  const role = session?.userRole ?? session?.user?.role ?? null;
  if (!session?.user || !["OWNER", "ADMIN"].includes(role)) {
    throw new Error("unauthorized");
  }
}

export async function GET(request: NextRequest) {
  const session = await safeGetServerSession(request, authOptions as any);

  try {
    ensureAdmin(session);
  } catch (error) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 403 });
  }

  const orgId = await resolveBusinessId(request);
  const jobId = request.nextUrl.searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json(
      { ok: false, error: "missing_job_id", message: "jobId query parameter is required" },
      { status: 400 },
    );
  }

  try {
    const status = await getOfferPublishJobStatus(jobId);

    if (!status) {
      return NextResponse.json(
        { ok: false, error: "job_not_found", message: "Job not found" },
        { status: 404 },
      );
    }

    if (status.data?.orgId && status.data.orgId !== orgId) {
      return NextResponse.json(
        { ok: false, error: "job_not_found", message: "Job not found" },
        { status: 404 },
      );
    }

    const normalizedStatus = {
      jobId: status.jobId,
      status: status.status,
      progress: status.progress ?? null,
      result: status.result ?? null,
      error: status.error ?? null,
      createdAt: status.createdAt,
      processedAt: status.processedAt ?? null,
      completedAt: status.completedAt ?? null,
    };

    return NextResponse.json({ ok: true, data: normalizedStatus });
  } catch (error) {
    console.error("offer publish status error", error);
    return NextResponse.json(
      { ok: false, error: "status_check_failed", message: "Failed to load job status" },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
