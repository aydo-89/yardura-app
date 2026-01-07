import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { extractUserRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { createSignedUrl } from "@/lib/supabase-admin";

const MAX_PAGE_SIZE = 100;

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = extractUserRole(session);

  if (!session || !role || (role !== "ADMIN" && role !== "OWNER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Get the admin user's orgId from the database
  const adminUser = await prisma.user.findUnique({
    where: { email: session.user?.email ?? undefined },
    select: { orgId: true },
  });

  if (!adminUser?.orgId) {
    return NextResponse.json({ error: "Organization not found" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status");
  const userId = searchParams.get("userId");
  const after = searchParams.get("after");
  const before = searchParams.get("before");
  const cursor = searchParams.get("cursor");
  const pageSizeParam = searchParams.get("limit") ?? "50";
  const limit = Math.min(Math.max(Number.parseInt(pageSizeParam, 10) || 50, 1), MAX_PAGE_SIZE);

  // IMPORTANT: Always filter by the admin's orgId for data isolation
  const where: Record<string, unknown> = {
    orgId: adminUser.orgId,
  };
  
  if (status) {
    where.reviewStatus = status;
  }
  if (userId) {
    where.userId = userId;
  }
  if (after || before) {
    where.capturedAt = {
      ...(after ? { gte: new Date(after) } : {}),
      ...(before ? { lte: new Date(before) } : {}),
    };
  }

  const bucket = env.STORAGE_BUCKET;

  const checks = await prisma.scooperDailyCheck.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: [{ capturedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor
      ? {
          skip: 1,
          cursor: {
            id: cursor,
          },
        }
      : {}),
  });

  const hasNext = checks.length > limit;
  if (hasNext) {
    checks.pop();
  }

  const items = await Promise.all(
    checks.map(async (check) => {
      let photoUrl: string | null = null;
      if (bucket && check.storagePath) {
        try {
          photoUrl = await createSignedUrl(bucket, check.storagePath, 60 * 60);
        } catch (error) {
          console.error("[admin-checkins] failed to sign url", {
            checkId: check.id,
            error,
          });
        }
      }

      return {
        id: check.id,
        capturedAt: check.capturedAt.toISOString(),
        reviewStatus: check.reviewStatus,
        notes: check.notes,
        user: check.user,
        photoUrl,
        gpsLat: check.gpsLat,
        gpsLng: check.gpsLng,
        checklist: check.checklist,
        reviewedAt: check.reviewedAt?.toISOString() ?? null,
        reviewedById: check.reviewedById,
      };
    }),
  );

  const nextCursor = hasNext ? items[items.length - 1]?.id : null;

  return NextResponse.json({
    items,
    nextCursor,
  });
}
