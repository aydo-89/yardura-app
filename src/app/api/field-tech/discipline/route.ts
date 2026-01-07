import { NextRequest, NextResponse } from "next/server";

import { getScooperAuth } from "@/lib/auth/scooper";
import { prisma } from "@/lib/prisma";
import {
  getStrikeDetails,
  getDisciplineEntry,
  EARLY_RELEASE_LIMIT,
  JOB_RELEASE_LIMIT,
  LATE_RELEASE_LIMIT,
  STRIKE_LIMIT,
} from "@/lib/marketplace/discipline";

export async function GET(request: NextRequest) {
  const auth = await getScooperAuth(request);
  const userId = auth?.userId;

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const profile = await prisma.scooperProfile.findUnique({
    where: { userId },
    select: { metadata: true },
  });

  if (!profile) {
    return NextResponse.json({ error: "scooper_profile_missing" }, { status: 404 });
  }

  const now = new Date();
  const strike = getStrikeDetails(profile.metadata, now);
  const lateRelease = getDisciplineEntry(profile.metadata, now, "lateRelease");
  const earlyRelease = getDisciplineEntry(profile.metadata, now, "earlyRelease");
  const jobRelease = getDisciplineEntry(profile.metadata, now, "jobRelease");

  return NextResponse.json({
    strikeCount: strike.count,
    limit: STRIKE_LIMIT,
    windowStart: strike.windowStart,
    lastAt: strike.lastAt ?? null,
    lastReason: strike.lastReason ?? null,
    lateRelease: {
      count: lateRelease.count,
      limit: LATE_RELEASE_LIMIT,
      windowStart: lateRelease.windowStart,
    },
    earlyRelease: {
      count: earlyRelease.count,
      limit: EARLY_RELEASE_LIMIT,
      windowStart: earlyRelease.windowStart,
    },
    jobRelease: {
      count: jobRelease.count,
      limit: JOB_RELEASE_LIMIT,
      windowStart: jobRelease.windowStart,
    },
  });
}

export const runtime = "nodejs";
