import { NextRequest, NextResponse } from "next/server";

import { authOptions, safeGetServerSession } from "@/lib/auth";
import { extractUserRoles } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";

function parseDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET(request: NextRequest) {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const roles = extractUserRoles(session);
  const isAdmin = roles.includes("ADMIN") || roles.includes("OWNER");
  if (!isAdmin) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId");
  const from = parseDate(searchParams.get("from"));
  const to = parseDate(searchParams.get("to"));
  const limitRaw = Number(searchParams.get("limit") ?? 1000);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.floor(limitRaw), 1), 5000)
    : 1000;

  const dateFilter = from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : null;
  const customerFilter = customerId ? { customerId } : {};

  const [
    dogs,
    captures,
    proMedia,
    weeklyReports,
    dailyCheckIns,
    reminders,
    foodLogs,
    chatLogs,
    dogWeightEntries,
    walks,
  ] = await Promise.all([
      prisma.dog.findMany({
        where: customerId ? { customerId } : {},
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.customerWellnessCapture.findMany({
        where: {
          ...(customerFilter as any),
          ...(dateFilter ? { capturedAt: dateFilter } : {}),
        },
        orderBy: { capturedAt: "desc" },
        take: limit,
      }),
      prisma.serviceVisitMedia.findMany({
        where: {
          assetType: "INSIGHTSCOOP",
          analysisStatus: { in: ["COMPLETED", "NEEDS_REVIEW"] },
          ...(dateFilter ? { capturedAt: dateFilter } : {}),
          ...(customerId ? { serviceVisit: { customerId } } : {}),
        },
        orderBy: { capturedAt: "desc" },
        take: limit,
      }),
      prisma.weeklyWellnessReport.findMany({
        where: {
          ...(customerFilter as any),
          ...(dateFilter ? { weekStart: dateFilter } : {}),
        },
        orderBy: { weekStart: "desc" },
        take: limit,
        include: {
          captures: { select: { captureId: true } },
          dailyCheckIns: { select: { checkInId: true } },
        },
      }),
      prisma.customerWellnessDailyCheckIn.findMany({
        where: {
          ...(customerFilter as any),
          ...(dateFilter ? { loggedAt: dateFilter } : {}),
        },
        orderBy: { loggedAt: "desc" },
        take: limit,
      }),
      prisma.customerWellnessReminder.findMany({
        where: customerFilter as any,
        orderBy: { nextDueAt: "asc" },
        take: limit,
      }),
      prisma.customerFoodLog.findMany({
        where: {
          ...(customerFilter as any),
          ...(dateFilter ? { loggedAt: dateFilter } : {}),
        },
        orderBy: { loggedAt: "desc" },
        take: limit,
      }),
      prisma.customerWellnessChatLog.findMany({
        where: {
          ...(customerFilter as any),
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.dogWeightEntry.findMany({
        where: {
          ...(customerFilter as any),
          ...(dateFilter ? { recordedAt: dateFilter } : {}),
        },
        orderBy: { recordedAt: "desc" },
        take: limit,
      }),
      prisma.customerWellnessWalk.findMany({
        where: {
          ...(customerFilter as any),
          ...(dateFilter ? { startedAt: dateFilter } : {}),
        },
        orderBy: { startedAt: "desc" },
        take: limit,
      }),
    ]);

  return NextResponse.json({
    ok: true,
    data: {
      dogs,
      captures,
      proMedia,
      weeklyReports: weeklyReports.map((report) => ({
        ...report,
        weekStart: report.weekStart.toISOString(),
        weekEnd: report.weekEnd.toISOString(),
        reportedAt: report.reportedAt.toISOString(),
        diagnosisDate: report.diagnosisDate ? report.diagnosisDate.toISOString() : null,
        captureIds: report.captures.map((capture) => capture.captureId),
        dailyCheckInIds: report.dailyCheckIns.map((entry) => entry.checkInId),
      })),
      dailyCheckIns,
      reminders,
      foodLogs,
      chatLogs,
      weightEntries: dogWeightEntries.map((entry) => ({
        ...entry,
        recordedAt: entry.recordedAt.toISOString(),
      })),
      walks: walks.map((walk) => ({
        ...walk,
        startedAt: walk.startedAt.toISOString(),
        endedAt: walk.endedAt.toISOString(),
      })),
    },
  });
}
