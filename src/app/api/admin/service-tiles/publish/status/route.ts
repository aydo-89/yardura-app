import { NextRequest, NextResponse } from "next/server";

import { authOptions, safeGetServerSession } from "@/lib/auth";
import { resolveBusinessId } from "@/lib/tenant";
import { getTilePublishJobStatus } from "@/lib/jobs/tilePublishQueue";

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
    const status = await getTilePublishJobStatus(jobId);

    if (!status) {
      return NextResponse.json(
        { ok: false, error: "job_not_found", message: "Job not found" },
        { status: 404 },
      );
    }

    if (status.orgId && status.orgId !== orgId) {
      return NextResponse.json(
        { ok: false, error: "job_not_found", message: "Job not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, data: status });
  } catch (error) {
    console.error("tile publish status error", error);
    return NextResponse.json(
      { ok: false, error: "status_check_failed", message: "Failed to load job status" },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
