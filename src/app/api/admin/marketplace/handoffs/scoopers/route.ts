import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { safeGetServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDisciplineEntry } from "@/lib/marketplace/discipline";

export async function GET(_request: NextRequest) {
  const session = await safeGetServerSession(authOptions as any);
  const role = (session as any)?.userRole ?? (session?.user as any)?.role ?? null;

  if (!session?.user || !["OWNER", "ADMIN"].includes(role)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 403 });
  }

  const now = new Date();

  const profiles = await prisma.scooperProfile.findMany({
    select: {
      id: true,
      userId: true,
      metadata: true,
      user: {
        select: {
          name: true,
        },
      },
    },
  });

  const rows = profiles.map((profile) => {
    const metadata = profile.metadata;

    const missedCount = getDisciplineEntry(metadata, now, "strikes").count;
    const lateReleaseCount = getDisciplineEntry(metadata, now, "lateRelease").count;
    const earlyReleaseCount = getDisciplineEntry(metadata, now, "earlyRelease").count;
    const jobReleaseCount = getDisciplineEntry(metadata, now, "jobRelease").count;

    return {
      scooperId: profile.id,
      scooperName: profile.user?.name ?? "",
      missedCount,
      lateReleaseCount,
      earlyReleaseCount,
      jobReleaseCount,
    };
  });

  rows.sort(
    (a, b) =>
      b.missedCount + b.lateReleaseCount + b.jobReleaseCount -
      (a.missedCount + a.lateReleaseCount + a.jobReleaseCount),
  );

  return NextResponse.json({ ok: true, data: rows });
}

export const runtime = "nodejs";
