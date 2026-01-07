import { NextRequest, NextResponse } from "next/server";

import { getScooperAuth } from "@/lib/auth/scooper";
import {
  generateVisitSummary,
  VisitSummaryResult,
} from "@/lib/field-tech/visitSummary";
import {
  addVisitSummaryJob,
  getVisitSummaryJobStatus,
} from "@/lib/jobs/visitSummaryQueue";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ visitId: string }> };

function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { visitId } = await params;
  const auth = await getScooperAuth(_request);
  const userId = auth?.userId;

  if (!userId) {
    return errorResponse(401, "Unauthorized");
  }

  try {
    const jobId = await addVisitSummaryJob({
      jobId: `visit-summary-${visitId}-${Date.now()}`,
      visitId,
      userId,
    });

    if (jobId) {
      return NextResponse.json({
        ok: true,
        data: {
          jobId,
          status: "queued",
        },
      });
    }

    const summary = await generateVisitSummary(visitId, userId);

    return NextResponse.json({
      ok: true,
      summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message === "visit_not_found") {
      return errorResponse(404, "Not found");
    }

    if (message === "no_samples") {
      return errorResponse(400, "No analyzed samples found. Capture and analyze samples first.");
    }

    console.error("visit summary error", error);
    return errorResponse(500, "Failed to generate summary");
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { visitId } = await params;
  const auth = await getScooperAuth(request);
  const userId = auth?.userId;

  if (!userId) {
    return errorResponse(401, "Unauthorized");
  }

  const jobId = request.nextUrl.searchParams.get("jobId");

  if (!jobId) {
    return errorResponse(400, "jobId is required");
  }

  try {
    const status = await getVisitSummaryJobStatus(jobId);

    if (!status) {
      return errorResponse(404, "Job not found");
    }

    if (status.requestedBy && status.requestedBy !== userId) {
      return errorResponse(403, "Forbidden");
    }

    if (status.visitId && status.visitId !== visitId) {
      return errorResponse(404, "Job not found for visit");
    }

    return NextResponse.json({
      ok: true,
      data: status,
    });
  } catch (error) {
    console.error("visit summary status error", error);
    return errorResponse(500, "Failed to load job status");
  }
}
