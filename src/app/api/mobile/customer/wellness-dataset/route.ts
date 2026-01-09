import { NextRequest, NextResponse } from 'next/server';
import { Prisma, WellnessReportScope } from '@prisma/client';

import { buildCustomerSetupResponse, canSetupCustomer } from '@/lib/mobile/customer-setup';
import { prisma } from '@/lib/prisma';
import { resolveStorageUrl } from '@/lib/storage';
import { verifyMobileToken } from '@/lib/mobile-auth';

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

function parseDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

type WeeklyReportWithLinks = Prisma.WeeklyWellnessReportGetPayload<{
  include: {
    captures: { select: { captureId: true } };
    dailyCheckIns: { select: { checkInId: true } };
  };
}>;

export async function GET(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let payload: ReturnType<typeof verifyMobileToken>;
  try {
    payload = verifyMobileToken(token);
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 401 });
  }

  const userId = payload.sub;
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Customer access required' }, { status: 403 });
  }
  const canSetup = canSetupCustomer(payload.roles);

  const customer = await prisma.customer.findFirst({
    where: { userId },
    select: { id: true, orgId: true, userId: true },
  });

  if (!customer) {
    return canSetup
      ? buildCustomerSetupResponse(userId)
      : NextResponse.json({ ok: false, error: 'Customer access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const dogId = searchParams.get('dogId');
  const normalizedDogId = dogId?.trim() || null;
  const from = parseDate(searchParams.get('from'));
  const to = parseDate(searchParams.get('to'));
  const limitRaw = Number(searchParams.get('limit') ?? 200);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.floor(limitRaw), 1), 1000)
    : 200;

  const dateFilter = from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : null;

  const dogWhere =
    normalizedDogId
      ? {
          OR: [
            { id: normalizedDogId, customerId: customer.id },
            ...(customer.userId ? [{ id: normalizedDogId, userId: customer.userId }] : []),
          ],
        }
      : customer.userId
        ? { OR: [{ customerId: customer.id }, { userId: customer.userId }] }
        : { customerId: customer.id };

  const dogOrHouseholdFilter = normalizedDogId
    ? { OR: [{ dogId: normalizedDogId }, { dogId: null }] }
    : {};
  const dogOrHouseholdWithSuspectsFilter = normalizedDogId
    ? {
        OR: [
          { dogId: normalizedDogId },
          { suspectedDogIds: { has: normalizedDogId } },
          { dogId: null },
        ],
      }
    : {};
  const householdScope: WellnessReportScope = WellnessReportScope.HOUSEHOLD;
  const dogOrHouseholdCaptureFilter: Prisma.CustomerWellnessCaptureWhereInput =
    normalizedDogId
      ? {
          OR: [
            { dogId: normalizedDogId },
            { suspectedDogIds: { has: normalizedDogId } },
            { scope: householdScope },
          ],
        }
      : {};
  const dogOrHouseholdWeeklyFilter: Prisma.WeeklyWellnessReportWhereInput =
    normalizedDogId
      ? {
          OR: [
            { dogId: normalizedDogId },
            { suspectedDogIds: { has: normalizedDogId } },
            { scope: householdScope },
          ],
        }
      : {};

  const weeklyReportsPromise = prisma.weeklyWellnessReport.findMany({
    where: {
      customerId: customer.id,
      ...dogOrHouseholdWeeklyFilter,
      ...(dateFilter ? { weekStart: dateFilter } : {}),
    },
    orderBy: { weekStart: 'desc' },
    take: limit,
    include: {
      captures: { select: { captureId: true } },
      dailyCheckIns: { select: { checkInId: true } },
    },
  }) as Prisma.PrismaPromise<WeeklyReportWithLinks[]>;

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
      where: dogWhere,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, breed: true, age: true, weight: true, allergies: true },
    }),
    prisma.customerWellnessCapture.findMany({
      where: {
        customerId: customer.id,
        ...dogOrHouseholdCaptureFilter,
        ...(dateFilter ? { capturedAt: dateFilter } : {}),
      },
      orderBy: { capturedAt: 'desc' },
      take: limit,
    }),
    prisma.serviceVisitMedia.findMany({
      where: {
        assetType: 'INSIGHTSCOOP',
        analysisStatus: { in: ['COMPLETED', 'NEEDS_REVIEW'] },
        visibilityState: 'VISIBLE',
        serviceVisit: { customerId: customer.id },
        ...(dateFilter ? { capturedAt: dateFilter } : {}),
      },
      orderBy: { capturedAt: 'desc' },
      take: limit,
    }),
    weeklyReportsPromise,
    prisma.customerWellnessDailyCheckIn.findMany({
      where: {
        customerId: customer.id,
        ...dogOrHouseholdWithSuspectsFilter,
        ...(dateFilter ? { loggedAt: dateFilter } : {}),
      },
      orderBy: { loggedAt: 'desc' },
      take: limit,
    }),
    prisma.customerWellnessReminder.findMany({
      where: {
        customerId: customer.id,
        ...dogOrHouseholdFilter,
      },
      orderBy: { nextDueAt: 'asc' },
    }),
    prisma.customerFoodLog.findMany({
      where: {
        customerId: customer.id,
        ...dogOrHouseholdFilter,
        ...(dateFilter ? { loggedAt: dateFilter } : {}),
      },
      orderBy: { loggedAt: 'desc' },
      take: limit,
    }),
    prisma.customerWellnessChatLog.findMany({
      where: {
        customerId: customer.id,
        ...dogOrHouseholdFilter,
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.dogWeightEntry.findMany({
      where: {
        customerId: customer.id,
        ...(normalizedDogId ? { dogId: normalizedDogId } : {}),
        ...(dateFilter ? { recordedAt: dateFilter } : {}),
      },
      orderBy: { recordedAt: 'desc' },
      take: limit,
    }),
    prisma.customerWellnessWalk.findMany({
      where: {
        customerId: customer.id,
        ...dogOrHouseholdFilter,
        ...(dateFilter ? { startedAt: dateFilter } : {}),
      },
      orderBy: { startedAt: 'desc' },
      take: limit,
    }),
  ]);

  const capturesWithUrls = await Promise.all(
    captures.map(async (capture) => ({
      id: capture.id,
      capturedAt: capture.capturedAt.toISOString(),
      dogId: capture.dogId,
      suspectedDogIds: capture.suspectedDogIds,
      scope: capture.scope,
      attribution: capture.attribution,
      symptomTags: capture.symptomTags,
      notes: capture.notes,
      gpsLat: capture.gpsLat,
      gpsLng: capture.gpsLng,
      consentToShare: capture.consentToShare,
      analysisStatus: capture.analysisStatus,
      analysisResult: capture.analysisResult,
      analysisConfidence: capture.analysisConfidence,
      analysisModel: capture.analysisModel,
      storagePath: capture.storagePath,
      imageUrl: await resolveStorageUrl(capture.storagePath),
    })),
  );

  const mediaWithUrls = await Promise.all(
    proMedia.map(async (media) => ({
      id: media.id,
      capturedAt: media.capturedAt.toISOString(),
      stoolSampleId: media.stoolSampleId,
      stoolSampleView: media.stoolSampleView,
      analysisStatus: media.analysisStatus,
      analysisResult: media.analysisResult,
      analysisConfidence: media.analysisConfidence,
      analysisModel: media.analysisModel,
      gpsLat: media.gpsLat,
      gpsLng: media.gpsLng,
      storagePath: media.storagePath,
      imageUrl: await resolveStorageUrl(media.storagePath),
    })),
  );

  return NextResponse.json({
    ok: true,
    data: {
      dogs,
      captures: capturesWithUrls,
      proMedia: mediaWithUrls,
      weeklyReports: weeklyReports.map((report) => ({
        id: report.id,
        dogId: report.dogId,
        scope: report.scope,
        attribution: report.attribution,
        suspectedDogIds: report.suspectedDogIds,
        weekStart: report.weekStart.toISOString(),
        weekEnd: report.weekEnd.toISOString(),
        noIssues: report.noIssues,
        stoolColors: report.stoolColors,
        stoolConsistency: report.stoolConsistency,
        stoolContents: report.stoolContents,
        symptomTags: report.symptomTags,
        appetite: report.appetite,
        hydration: report.hydration,
        energy: report.energy,
        stoolFrequency: report.stoolFrequency,
        vomiting: report.vomiting,
        diarrhea: report.diarrhea,
        medsGiven: report.medsGiven,
        medsNotes: report.medsNotes,
        behaviorNotes: report.behaviorNotes,
        stoolNotes: report.stoolNotes,
        diagnosisLabel: report.diagnosisLabel,
        diagnosisSource: report.diagnosisSource,
        diagnosisDate: report.diagnosisDate ? report.diagnosisDate.toISOString() : null,
        diagnosisNotes: report.diagnosisNotes,
        reportedAt: report.reportedAt.toISOString(),
        captureIds: report.captures.map((capture) => capture.captureId),
        dailyCheckInIds: report.dailyCheckIns.map((entry) => entry.checkInId),
      })),
      dailyCheckIns: dailyCheckIns.map((entry) => ({
        id: entry.id,
        dogId: entry.dogId,
        suspectedDogIds: entry.suspectedDogIds,
        loggedAt: entry.loggedAt.toISOString(),
        weekStart: new Date(
          Date.UTC(
            entry.loggedAt.getUTCFullYear(),
            entry.loggedAt.getUTCMonth(),
            entry.loggedAt.getUTCDate() - entry.loggedAt.getUTCDay() + (entry.loggedAt.getUTCDay() === 0 ? -6 : 1),
          ),
        ).toISOString(),
        appetite: entry.appetite,
        energy: entry.energy,
        waterIntake: entry.waterIntake,
        stoolFrequency: entry.stoolFrequency,
        vomiting: entry.vomiting,
        diarrhea: entry.diarrhea,
        medsGiven: entry.medsGiven,
        medsNotes: entry.medsNotes,
        notes: entry.notes,
      })),
      reminders: reminders.map((reminder) => ({
        id: reminder.id,
        dogId: reminder.dogId,
        title: reminder.title,
        category: reminder.category,
        notes: reminder.notes,
        nextDueAt: reminder.nextDueAt.toISOString(),
        frequencyDays: reminder.frequencyDays,
        active: reminder.active,
        lastCompletedAt: reminder.lastCompletedAt?.toISOString() ?? null,
      })),
      foodLogs: foodLogs.map((log) => ({
        id: log.id,
        dogId: log.dogId,
        loggedAt: log.loggedAt.toISOString(),
        type: log.type,
        productId: log.productId,
        brand: log.brand,
        productName: log.productName,
        ingredients: log.ingredients,
        portion: log.portion,
        notes: log.notes,
        allergenMatches: log.allergenMatches,
      })),
      chatLogs: chatLogs.map((log) => ({
        id: log.id,
        dogId: log.dogId,
        symptoms: log.symptoms,
        message: log.message,
        contextNotes: log.contextNotes,
        response: log.response,
        riskLevel: log.riskLevel,
        model: log.model,
        createdAt: log.createdAt.toISOString(),
      })),
      weightEntries: dogWeightEntries.map((entry) => ({
        id: entry.id,
        dogId: entry.dogId,
        weightLbs: entry.weightLbs,
        recordedAt: entry.recordedAt.toISOString(),
        source: entry.source,
        notes: entry.notes,
      })),
      walks: walks.map((walk) => ({
        id: walk.id,
        dogId: walk.dogId,
        startedAt: walk.startedAt.toISOString(),
        endedAt: walk.endedAt.toISOString(),
        durationSeconds: walk.durationSeconds,
        distanceMeters: walk.distanceMeters,
        path: walk.path,
        metadata: walk.metadata,
      })),
    },
  });
}
