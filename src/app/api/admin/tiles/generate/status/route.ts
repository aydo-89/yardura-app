import { NextRequest, NextResponse } from "next/server";
import { getTileGenerationJobStatus } from "@/lib/jobs/tileGenerationQueue";
import { authOptions, safeGetServerSession } from "@/lib/auth";

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

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json(
      { ok: false, error: "missing_job_id", message: "jobId query parameter is required" },
      { status: 400 },
    );
  }

  try {
    const jobStatus = await getTileGenerationJobStatus(jobId);

    if (!jobStatus) {
      return NextResponse.json(
        { ok: false, error: "job_not_found", message: `Job ${jobId} not found` },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: jobStatus,
    });
  } catch (error) {
    console.error("tiles.generate.status GET", error);
    const message = error instanceof Error ? error.message : "Failed to get job status";
    return NextResponse.json(
      { ok: false, error: "status_check_failed", message },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";

