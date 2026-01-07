import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { safeGetServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  EARLY_RELEASE_LIMIT,
  JOB_RELEASE_LIMIT,
  LATE_RELEASE_LIMIT,
  MISSED_VISIT_LIMIT,
  getDisciplineEntry,
} from "@/lib/marketplace/discipline";

type SummaryResponse = {
  ok: true;
  data: {
    missed: {
      countThisQuarter: number;
      limit: number | null;
    };
    lateRelease: {
      countThisQuarter: number;
      limit: number | null;
    };
    earlyRelease: {
      countThisQuarter: number;
      limit: number | null;
    };
    jobRelease: {
      countThisQuarter: number;
      limit: number | null;
    };
  };
};

type ErrorResponse = {
  ok: false;
  error: string;
};

export async function GET(_request: NextRequest) {
  const session = await safeGetServerSession(authOptions as any);
  const role = (session as any)?.userRole ?? (session?.user as any)?.role ?? null;

  if (!session?.user || !["OWNER", "ADMIN"].includes(role)) {
    return NextResponse.json<ErrorResponse>({ ok: false, error: "unauthorized" }, { status: 403 });
  }

  const now = new Date();

  const profiles = await prisma.scooperProfile.findMany({
    select: {
      metadata: true,
    },
  });

  let missedVisits = 0;
  let lateReleases = 0;
  let earlyReleases = 0;
  let jobReleases = 0;

  for (const profile of profiles) {
    const metadata = profile.metadata;

    missedVisits += getDisciplineEntry(metadata, now, "strikes").count;
    lateReleases += getDisciplineEntry(metadata, now, "lateRelease").count;
    earlyReleases += getDisciplineEntry(metadata, now, "earlyRelease").count;
    jobReleases += getDisciplineEntry(metadata, now, "jobRelease").count;
  }

  const response: SummaryResponse = {
    ok: true,
    data: {
      missed: {
        countThisQuarter: missedVisits,
        limit: MISSED_VISIT_LIMIT,
      },
      lateRelease: {
        countThisQuarter: lateReleases,
        limit: LATE_RELEASE_LIMIT,
      },
      earlyRelease: {
        countThisQuarter: earlyReleases,
        limit: EARLY_RELEASE_LIMIT,
      },
      jobRelease: {
        countThisQuarter: jobReleases,
        limit: JOB_RELEASE_LIMIT,
      },
    },
  };

  return NextResponse.json(response);
}

export const runtime = "nodejs";
