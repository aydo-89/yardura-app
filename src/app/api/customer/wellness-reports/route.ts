import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { authOptions, safeGetServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isWellnessFlaggedMedia } from "@/lib/service-visits/flagging";
import {
  WELLNESS_APPETITE,
  WELLNESS_ATTRIBUTION,
  WELLNESS_DIAGNOSIS_SOURCE,
  WELLNESS_ENERGY,
  WELLNESS_HYDRATION,
  WELLNESS_REPORT_SCOPE,
  WELLNESS_STOOL_COLORS,
  WELLNESS_STOOL_CONSISTENCY,
  WELLNESS_STOOL_CONTENT,
  WELLNESS_SYMPTOMS,
  getWeekWindow,
} from "@/lib/wellness/reports";

const reportSchema = z
  .object({
    dogId: z.string().min(1).optional(),
    scope: z.enum(WELLNESS_REPORT_SCOPE).optional(),
    attribution: z.enum(WELLNESS_ATTRIBUTION).optional(),
    suspectedDogIds: z.array(z.string().min(1)).max(10).optional(),
    weekStart: z.string().datetime().optional(),
    reportDate: z.string().datetime().optional(),
    noIssues: z.boolean().optional(),
    stoolColors: z.array(z.enum(WELLNESS_STOOL_COLORS)).optional(),
    stoolConsistency: z.array(z.enum(WELLNESS_STOOL_CONSISTENCY)).optional(),
    stoolContents: z.array(z.enum(WELLNESS_STOOL_CONTENT)).optional(),
    symptomTags: z.array(z.enum(WELLNESS_SYMPTOMS)).optional(),
    appetite: z.enum(WELLNESS_APPETITE).optional(),
    energy: z.enum(WELLNESS_ENERGY).optional(),
    hydration: z.enum(WELLNESS_HYDRATION).optional(),
    stoolFrequency: z.number().int().min(0).max(10).optional(),
    vomiting: z.boolean().optional(),
    diarrhea: z.boolean().optional(),
    medsGiven: z.boolean().optional(),
    medsNotes: z.string().max(400).optional(),
    behaviorNotes: z.string().max(2000).optional(),
    stoolNotes: z.string().max(2000).optional(),
    diagnosisLabel: z.string().max(200).optional(),
    diagnosisSource: z.enum(WELLNESS_DIAGNOSIS_SOURCE).optional(),
    diagnosisDate: z.string().datetime().optional(),
    diagnosisNotes: z.string().max(4000).optional(),
    consentToShare: z.boolean().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.weekStart && !data.reportDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "weekStart or reportDate is required",
        path: ["weekStart"],
      });
    }
  });

const formatReport = (
  report: any,
  includeMedia: boolean,
  includeFlagSummary: boolean,
  includeDaily: boolean,
) => {
  const hasMediaData = Array.isArray(report.media);
  const mediaItems = hasMediaData ? report.media.map((entry: any) => entry.media) : [];
  const captureCount =
    report._count && typeof report._count.captures === "number"
      ? report._count.captures
      : null;
  const dailyCheckInCount =
    report._count && typeof report._count.dailyCheckIns === "number"
      ? report._count.dailyCheckIns
      : null;
  const flaggedMedia = mediaItems.filter((media: any) => {
    const result =
      media.analysisResult && typeof media.analysisResult === "object"
        ? (media.analysisResult as Record<string, unknown>)
        : null;
    if (result?.customer_flag_cleared || result?.customer_cleared) return false;
    return isWellnessFlaggedMedia(
      {
        analysisResult: media.analysisResult,
        visibilityState: media.visibilityState,
        reviewStatus: media.reviewStatus,
      },
      { requireVisible: true },
    );
  });
  return {
    id: report.id,
    orgId: report.orgId,
    customerId: report.customerId,
    scope: report.scope,
    attribution: report.attribution,
    suspectedDogIds: report.suspectedDogIds ?? [],
    dog: report.dog
      ? {
          id: report.dog.id,
          name: report.dog.name,
        }
      : null,
    weekStart: report.weekStart.toISOString(),
    weekEnd: report.weekEnd.toISOString(),
    reportedAt: report.reportedAt.toISOString(),
    noIssues: report.noIssues,
    stoolColors: report.stoolColors,
    stoolConsistency: report.stoolConsistency,
    stoolContents: report.stoolContents,
    symptomTags: report.symptomTags,
    appetite: report.appetite ?? null,
    hydration: report.hydration ?? null,
    energy: report.energy ?? null,
    stoolFrequency: typeof report.stoolFrequency === "number" ? report.stoolFrequency : null,
    vomiting: report.vomiting ?? false,
    diarrhea: report.diarrhea ?? false,
    medsGiven: report.medsGiven ?? false,
    medsNotes: report.medsNotes ?? null,
    behaviorNotes: report.behaviorNotes ?? null,
    stoolNotes: report.stoolNotes ?? null,
    diagnosisLabel: report.diagnosisLabel ?? null,
    diagnosisSource: report.diagnosisSource ?? null,
    diagnosisDate: report.diagnosisDate ? report.diagnosisDate.toISOString() : null,
    diagnosisNotes: report.diagnosisNotes ?? null,
    consentToShare: report.consentToShare,
    metadata: report.metadata ?? null,
    totalMediaCount: includeFlagSummary && hasMediaData ? mediaItems.length : null,
    flaggedMediaCount: includeFlagSummary && hasMediaData ? flaggedMedia.length : null,
    captureCount,
    dailyCheckInCount,
    dailyCheckIns: includeDaily
      ? report.dailyCheckIns?.map((entry: any) => ({
          id: entry.checkIn.id,
          dogId: entry.checkIn.dogId,
          suspectedDogIds: entry.checkIn.suspectedDogIds,
          loggedAt: entry.checkIn.loggedAt.toISOString(),
          appetite: entry.checkIn.appetite,
          energy: entry.checkIn.energy,
          waterIntake: entry.checkIn.waterIntake,
          stoolFrequency: entry.checkIn.stoolFrequency,
          vomiting: entry.checkIn.vomiting,
          diarrhea: entry.checkIn.diarrhea,
          medsGiven: entry.checkIn.medsGiven,
          medsNotes: entry.checkIn.medsNotes,
          notes: entry.checkIn.notes,
        }))
      : undefined,
    media: includeMedia
      ? flaggedMedia.map((media: any) => ({
          id: media.id,
          serviceVisitId: media.serviceVisitId,
          assetType: media.assetType,
          storagePath: media.storagePath,
          thumbnailPath: media.thumbnailPath ?? null,
          capturedAt: media.capturedAt.toISOString(),
          stoolSampleId: media.stoolSampleId ?? null,
          stoolSampleView: media.stoolSampleView ?? null,
          analysisStatus: media.analysisStatus,
          analysisResult: media.analysisResult ?? null,
          analysisConfidence: media.analysisConfidence ?? null,
          reviewStatus: media.reviewStatus,
          visibilityState: media.visibilityState,
        }))
      : undefined,
  };
};

export async function GET(request: NextRequest) {
  const session = (await safeGetServerSession(authOptions as any)) as
    | { user?: { email?: string | null } }
    | null;

  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const customer = await prisma.customer.findFirst({
    where: { email: session.user.email },
    select: { id: true, userId: true },
  });

  if (!customer) {
    return NextResponse.json({ ok: false, error: "Customer not found" }, { status: 404 });
  }

  const searchParams = request.nextUrl.searchParams;
  const dogId = searchParams.get("dogId");
  const scope = searchParams.get("scope");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const includeMedia = searchParams.get("includeMedia") === "1";
  const includeFlagSummary =
    searchParams.get("includeFlagSummary") === "1" || includeMedia;
  const includeDaily = searchParams.get("includeDaily") === "1";

  const where: Record<string, any> = { customerId: customer.id };
  if (dogId) where.dogId = dogId;
  if (scope) {
    if (!WELLNESS_REPORT_SCOPE.includes(scope as any)) {
      return NextResponse.json(
        { ok: false, error: "Invalid scope" },
        { status: 422 },
      );
    }
    where.scope = scope;
  }
  if (from || to) {
    where.weekStart = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const includeMediaData = includeMedia || includeFlagSummary;

  const reports = await prisma.weeklyWellnessReport.findMany({
    where,
    orderBy: { weekStart: "desc" },
    include: {
      dog: { select: { id: true, name: true } },
      _count: { select: { captures: true, dailyCheckIns: true } },
      media: includeMediaData
        ? {
            include: {
              media: {
                select: {
                  id: true,
                  serviceVisitId: true,
                  assetType: true,
                  storagePath: true,
                  thumbnailPath: true,
                  capturedAt: true,
                  stoolSampleId: true,
                  stoolSampleView: true,
                  analysisStatus: true,
                  analysisResult: true,
                  analysisConfidence: true,
                  reviewStatus: true,
                  visibilityState: true,
                },
              },
            },
          }
        : false,
      dailyCheckIns: includeDaily
        ? {
            include: {
              checkIn: true,
            },
          }
        : false,
    },
  });

  return NextResponse.json({
    ok: true,
    data: {
      reports: reports.map((report) =>
        formatReport(report, includeMedia, includeFlagSummary, includeDaily),
      ),
    },
  });
}

export async function POST(request: NextRequest) {
  const session = (await safeGetServerSession(authOptions as any)) as
    | { user?: { email?: string | null } }
    | null;

  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const customer = await prisma.customer.findFirst({
    where: { email: session.user.email },
    select: { id: true, orgId: true, userId: true, shareWellnessNotes: true },
  });

  if (!customer) {
    return NextResponse.json({ ok: false, error: "Customer not found" }, { status: 404 });
  }

  const payload = await request.json();
  const parsed = reportSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "validation_error", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const reportDate = parsed.data.weekStart
    ? new Date(parsed.data.weekStart)
    : parsed.data.reportDate
      ? new Date(parsed.data.reportDate)
      : new Date();

  const { weekStart, weekEnd } = getWeekWindow(reportDate);

  const explicitScope = parsed.data.scope;
  let scope = parsed.data.scope ?? (parsed.data.dogId ? "DOG" : "HOUSEHOLD");
  let resolvedDogId = parsed.data.dogId ?? null;
  let autoAttribution: string | null = null;

  if (!explicitScope && !resolvedDogId) {
    const dogs = await prisma.dog.findMany({
      where: customer.userId
        ? { OR: [{ customerId: customer.id }, { userId: customer.userId }] }
        : { customerId: customer.id },
      select: { id: true },
      take: 2,
    });

    if (dogs.length === 1) {
      scope = "DOG";
      resolvedDogId = dogs[0].id;
      autoAttribution = "OWNER_CONFIRMED";
    }
  }

  if (scope === "DOG" && !resolvedDogId) {
    return NextResponse.json(
      { ok: false, error: "Dog is required when scope is DOG" },
      { status: 422 },
    );
  }

  const dogRecord = resolvedDogId
    ? await prisma.dog.findFirst({
        where: {
          id: resolvedDogId,
          ...(customer.userId
            ? { OR: [{ customerId: customer.id }, { userId: customer.userId }] }
            : { customerId: customer.id }),
        },
        select: { id: true, customerId: true },
      })
    : null;

  if (resolvedDogId && !dogRecord) {
    return NextResponse.json({ ok: false, error: "Dog not found" }, { status: 404 });
  }
  if (dogRecord && !dogRecord.customerId) {
    await prisma.dog.update({
      where: { id: dogRecord.id },
      data: { customerId: customer.id },
    });
  }

  const suspectedDogIds = parsed.data.suspectedDogIds ?? [];
  if (scope === "DOG" && suspectedDogIds.length > 0) {
    return NextResponse.json(
      { ok: false, error: "suspectedDogIds is only allowed for household reports" },
      { status: 422 },
    );
  }
  let resolvedSuspectedDogIds: string[] = [];
  if (suspectedDogIds.length > 0) {
    const dogs = await prisma.dog.findMany({
      where: {
        id: { in: suspectedDogIds },
        ...(customer.userId
          ? { OR: [{ customerId: customer.id }, { userId: customer.userId }] }
          : { customerId: customer.id }),
      },
      select: { id: true, customerId: true },
    });
    if (dogs.length !== suspectedDogIds.length) {
      return NextResponse.json(
        { ok: false, error: "Unknown dog in suspectedDogIds" },
        { status: 422 },
      );
    }
    const unlinked = dogs.filter((dog) => !dog.customerId).map((dog) => dog.id);
    if (unlinked.length) {
      await prisma.dog.updateMany({
        where: { id: { in: unlinked } },
        data: { customerId: customer.id },
      });
    }
    resolvedSuspectedDogIds = dogs.map((dog) => dog.id);
  }

  const attributionRaw =
    scope === "HOUSEHOLD"
      ? "HOUSEHOLD"
      : autoAttribution ?? parsed.data.attribution ?? "OWNER_CONFIRMED";
  const attribution = attributionRaw as "HOUSEHOLD" | "OWNER_GUESS" | "OWNER_CONFIRMED" | "DEVICE_CONFIRMED";

  const diagnosisLabel = parsed.data.diagnosisLabel?.trim() ?? "";
  const diagnosisNotes = parsed.data.diagnosisNotes?.trim() ?? "";

  const noIssues = parsed.data.noIssues ?? false;
  const stoolColors = noIssues ? [] : parsed.data.stoolColors ?? [];
  const stoolConsistency = noIssues ? [] : parsed.data.stoolConsistency ?? [];
  const stoolContents = noIssues ? [] : parsed.data.stoolContents ?? [];
  const symptomTags = noIssues ? [] : parsed.data.symptomTags ?? [];

  const reportData = {
    orgId: customer.orgId,
    customerId: customer.id,
    dogId: scope === "DOG" ? dogRecord?.id ?? null : null,
    scope,
    attribution,
    suspectedDogIds: resolvedSuspectedDogIds,
    weekStart,
    weekEnd,
    noIssues,
    stoolColors,
    stoolConsistency,
    stoolContents,
    symptomTags,
    appetite: parsed.data.appetite ?? null,
    hydration: parsed.data.hydration ?? null,
    energy: parsed.data.energy ?? null,
    stoolFrequency: parsed.data.stoolFrequency ?? null,
    vomiting: parsed.data.vomiting ?? false,
    diarrhea: parsed.data.diarrhea ?? false,
    medsGiven: parsed.data.medsGiven ?? false,
    medsNotes: parsed.data.medsNotes?.trim() || null,
    behaviorNotes: parsed.data.behaviorNotes ?? null,
    stoolNotes: parsed.data.stoolNotes ?? null,
    diagnosisLabel: diagnosisLabel || null,
    diagnosisSource:
      parsed.data.diagnosisSource ??
      (diagnosisLabel || diagnosisNotes ? "OWNER_REPORTED" : null),
    diagnosisDate: parsed.data.diagnosisDate ? new Date(parsed.data.diagnosisDate) : null,
    diagnosisNotes: diagnosisNotes || null,
    consentToShare:
      parsed.data.consentToShare ?? customer.shareWellnessNotes ?? true,
    metadata: (parsed.data.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    reportedAt: new Date(),
  };

  const matchWhere =
    scope === "DOG"
      ? { customerId: customer.id, dogId: reportData.dogId, weekStart, scope }
      : { customerId: customer.id, weekStart, scope };

  const existingReport = await prisma.weeklyWellnessReport.findFirst({
    where: matchWhere,
    select: { id: true },
  });

  const report = existingReport
    ? await prisma.weeklyWellnessReport.update({
        where: { id: existingReport.id },
        data: reportData,
        include: { dog: { select: { id: true, name: true } } },
      })
    : await prisma.weeklyWellnessReport.create({
        data: reportData,
        include: { dog: { select: { id: true, name: true } } },
      });

  const mediaMatches = await prisma.serviceVisitMedia.findMany({
    where: {
      assetType: "INSIGHTSCOOP",
      capturedAt: { gte: weekStart, lte: weekEnd },
      visibilityState: "VISIBLE",
      serviceVisit: { customerId: customer.id },
    },
    select: { id: true },
  });

  if (mediaMatches.length > 0) {
    await prisma.weeklyWellnessReportMedia.createMany({
      data: mediaMatches.map((media) => ({
        reportId: report.id,
        mediaId: media.id,
      })),
      skipDuplicates: true,
    });
  }

  const captureMatches = await prisma.customerWellnessCapture.findMany({
    where: {
      customerId: customer.id,
      capturedAt: { gte: weekStart, lte: weekEnd },
    },
    select: { id: true },
  });

  if (captureMatches.length > 0) {
    await prisma.weeklyWellnessReportCapture.createMany({
      data: captureMatches.map((capture) => ({
        reportId: report.id,
        captureId: capture.id,
      })),
      skipDuplicates: true,
    });
  }

  const dailyMatchWhere: Record<string, unknown> = {
    customerId: customer.id,
    loggedAt: { gte: weekStart, lte: weekEnd },
  };

  if (scope === "DOG" && reportData.dogId) {
    dailyMatchWhere.OR = [
      { dogId: reportData.dogId },
      { suspectedDogIds: { has: reportData.dogId } },
    ];
  }

  const dailyMatches = await prisma.customerWellnessDailyCheckIn.findMany({
    where: dailyMatchWhere,
    select: { id: true },
  });

  if (dailyMatches.length > 0) {
    await prisma.weeklyWellnessReportDailyCheckIn.createMany({
      data: dailyMatches.map((entry) => ({
        reportId: report.id,
        checkInId: entry.id,
      })),
      skipDuplicates: true,
    });
  }

  return NextResponse.json({
    ok: true,
    data: {
      report: formatReport(report, false, false, false),
      linkedMediaCount: mediaMatches.length,
      linkedCaptureCount: captureMatches.length,
      linkedDailyCheckInCount: dailyMatches.length,
    },
  });
}
