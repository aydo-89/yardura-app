import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  CustomerRewardEventType,
  Prisma,
  ScooperRewardEventType,
  ServiceStatus,
} from '@prisma/client';
import { z } from 'zod';

import { env } from '@/lib/env';
import { buildCustomerSetupResponse, canSetupCustomer } from '@/lib/mobile/customer-setup';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { upsertVisitPayoutForVisit } from '@/lib/marketplace/payouts';
import { uploadImage } from '@/lib/supabase-admin';
import {
  awardScooperPoints,
  SCOOPER_REWARD_EVENT_POINTS,
  SCOOPER_VISIT_POINTS_CAP,
} from '@/lib/field-tech/rewardEvents';
import { awardCustomerRewardPoints } from '@/lib/rewards/customerRewardEvents';
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
} from '@/lib/wellness/reports';
import {
  calculateReportPoints,
  calculateStreak,
  WELLNESS_REWARD_RULES,
} from '@/lib/wellness/rewards';
import { isWellnessFlaggedMedia } from '@/lib/service-visits/flagging';

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

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
        message: 'weekStart or reportDate is required',
        path: ['weekStart'],
      });
    }
  });

const VET_VERIFIED_SCOOPER_BONUS_CENTS = 2000;

type VetProofMetadata = {
  status: 'SUBMITTED';
  storagePath: string;
  submittedAt: string;
  fileName?: string | null;
  contentType?: string | null;
};

function formatReport(report: any) {
  const metadata =
    report.metadata && typeof report.metadata === 'object' && !Array.isArray(report.metadata)
      ? (report.metadata as Record<string, unknown>)
      : null;
  const rewards =
    metadata && typeof metadata.wellnessRewards === 'object'
      ? (metadata.wellnessRewards as Record<string, unknown>)
      : null;

  return {
    id: report.id,
    weekStart: report.weekStart.toISOString(),
    weekEnd: report.weekEnd.toISOString(),
    noIssues: report.noIssues,
    scope: report.scope,
    attribution: report.attribution,
    suspectedDogIds: report.suspectedDogIds ?? [],
    dogId: report.dogId ?? null,
    dogName: report.dog?.name ?? null,
    stoolColors: report.stoolColors ?? [],
    stoolConsistency: report.stoolConsistency ?? [],
    stoolContents: report.stoolContents ?? [],
    symptomTags: report.symptomTags ?? [],
    appetite: report.appetite ?? null,
    hydration: report.hydration ?? null,
    energy: report.energy ?? null,
    stoolFrequency: typeof report.stoolFrequency === 'number' ? report.stoolFrequency : null,
    vomiting: report.vomiting ?? false,
    diarrhea: report.diarrhea ?? false,
    medsGiven: report.medsGiven ?? false,
    medsNotes: report.medsNotes ?? null,
    behaviorNotes: report.behaviorNotes ?? null,
    stoolNotes: report.stoolNotes ?? null,
    diagnosisLabel: report.diagnosisLabel ?? null,
    diagnosisSource: report.diagnosisSource ?? null,
    diagnosisDate: report.diagnosisDate
      ? report.diagnosisDate.toISOString()
      : null,
    diagnosisNotes: report.diagnosisNotes ?? null,
    consentToShare: report.consentToShare,
    reportedAt: report.reportedAt.toISOString(),
    mediaCount: report._count?.media ?? 0,
    captureCount: report._count?.captures ?? 0,
    dailyCheckInCount: report._count?.dailyCheckIns ?? 0,
    pointsAwarded: typeof rewards?.pointsAwarded === 'number' ? rewards.pointsAwarded : null,
    streakCount: typeof rewards?.streakCount === 'number' ? rewards.streakCount : null,
  };
}

function isFlaggedMedia(media: {
  visibilityState?: string | null;
  analysisResult?: unknown;
  reviewStatus?: string | null;
}): boolean {
  const result =
    media.analysisResult && typeof media.analysisResult === 'object'
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
}

function extractMediaFlagReasons(media: {
  analysisResult?: unknown;
}): string[] {
  if (!media.analysisResult || typeof media.analysisResult !== 'object') {
    return [];
  }
  const result = media.analysisResult as { flag_reason?: string | null };
  const reason = result.flag_reason?.trim();
  return reason ? [reason] : [];
}

function uniqueReasons(reasons: string[]): string[] {
  return Array.from(new Set(reasons.filter((reason) => reason)));
}

function parseMetadata(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function extractVetProof(metadata: unknown): VetProofMetadata | null {
  const meta = parseMetadata(metadata);
  if (!meta) return null;
  const vetProof = meta.vetProof;
  if (!vetProof || typeof vetProof !== 'object' || Array.isArray(vetProof)) {
    return null;
  }
  const proof = vetProof as Record<string, unknown>;
  const storagePath = typeof proof.storagePath === 'string' ? proof.storagePath : null;
  const submittedAt = typeof proof.submittedAt === 'string' ? proof.submittedAt : null;
  if (!storagePath || !submittedAt) return null;
  return {
    status: 'SUBMITTED',
    storagePath,
    submittedAt,
    fileName: typeof proof.fileName === 'string' ? proof.fileName : null,
    contentType: typeof proof.contentType === 'string' ? proof.contentType : null,
  };
}

type VetBonusMetadata = {
  status: 'AWARDED';
  visitId: string;
  scooperId: string;
  amountCents: number;
  awardedAt: string;
  crossSection: boolean;
};

type VetVerificationStatus = 'self_reported' | 'documented' | 'verified';

type VetVerificationMetadata = {
  status: VetVerificationStatus;
  submittedAt?: string | null;
  verifiedAt?: string | null;
  verifiedById?: string | null;
};

type VetConfirmedCandidate = {
  id: string;
  orgId: string;
  scheduledDate: Date;
  scooperId: string;
  metadata: unknown;
  hasCrossSection: boolean;
};

function extractVetBonus(metadata: Record<string, unknown> | null) {
  if (!metadata) return null;
  const entry = metadata.vetBonus;
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return null;
  }
  return entry as VetBonusMetadata;
}

function extractVetVerification(metadata: Record<string, unknown> | null) {
  if (!metadata) return null;
  const entry = metadata.vetVerification;
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return null;
  }
  return entry as VetVerificationMetadata;
}

function resolveVetVerificationStatus(options: {
  reportMetadata: Record<string, unknown> | null;
  hasVetProof: boolean;
  diagnosisSource: string | null;
}) {
  const { reportMetadata, hasVetProof, diagnosisSource } = options;
  const existing = extractVetVerification(reportMetadata);
  if (existing?.status === 'verified') return 'verified';
  if (hasVetProof) return 'documented';
  if (diagnosisSource === 'VET_CONFIRMED') return 'self_reported';
  return null;
}

async function findVetConfirmedCandidate(options: {
  customerId: string;
  weekStart: Date;
  weekEnd: Date;
}): Promise<VetConfirmedCandidate | null> {
  const { customerId, weekStart, weekEnd } = options;
  const visits = await prisma.serviceVisit.findMany({
    where: {
      customerId,
      scheduledDate: {
        gte: weekStart,
        lte: weekEnd,
      },
      status: ServiceStatus.COMPLETED,
      assignedToId: { not: null },
    },
    select: {
      id: true,
      orgId: true,
      scheduledDate: true,
      assignedToId: true,
      metadata: true,
      insights: {
        where: { wellnessFlag: true },
        select: { id: true },
      },
      media: {
        where: { assetType: 'INSIGHTSCOOP', visibilityState: 'VISIBLE' },
        select: {
          analysisResult: true,
          stoolSampleView: true,
          visibilityState: true,
          reviewStatus: true,
        },
      },
    },
  });

  const eligibleVisits = visits
    .map((visit) => {
      const insightFlag = visit.insights.length > 0;
      const flaggedMedia = visit.media.filter(isFlaggedMedia);
      if (!insightFlag && flaggedMedia.length === 0) return null;
      const hasCrossSection = visit.media.some(
        (media) => media.stoolSampleView === 'CROSS_SECTION',
      );
      return {
        id: visit.id,
        orgId: visit.orgId,
        scheduledDate: visit.scheduledDate,
        scooperId: visit.assignedToId as string,
        metadata: visit.metadata,
        hasCrossSection,
      };
    })
    .filter(Boolean) as VetConfirmedCandidate[];

  const crossSectionVisits = eligibleVisits.filter((visit) => visit.hasCrossSection);
  const candidates =
    crossSectionVisits.length > 0 ? crossSectionVisits : eligibleVisits;

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort(
    (a, b) => b.scheduledDate.getTime() - a.scheduledDate.getTime(),
  );

  return candidates[0];
}

async function awardVetVerifiedScooperBonus(options: {
  reportId: string;
  reportMetadata: Record<string, unknown> | null;
  customerId: string;
  weekStart: Date;
  weekEnd: Date;
  diagnosisSource: string | null;
  hasVetProof: boolean;
  noIssues: boolean;
  candidate?: VetConfirmedCandidate | null;
}) {
  const {
    reportId,
    reportMetadata,
    customerId,
    weekStart,
    weekEnd,
    diagnosisSource,
    hasVetProof,
    noIssues,
    candidate,
  } = options;

  const verificationStatus = resolveVetVerificationStatus({
    reportMetadata,
    hasVetProof,
    diagnosisSource,
  });

  if (
    diagnosisSource !== 'VET_CONFIRMED' ||
    noIssues ||
    (verificationStatus !== 'documented' && verificationStatus !== 'verified')
  ) {
    return null;
  }

  if (extractVetBonus(reportMetadata)) {
    return null;
  }

  const target =
    candidate ??
    (await findVetConfirmedCandidate({
      customerId,
      weekStart,
      weekEnd,
    }));

  if (!target) {
    return null;
  }
  const targetMetadata = parseMetadata(target.metadata) ?? {};

  if (targetMetadata.vetDiagnosisBonusReportId) {
    return null;
  }

  const awardedAt = new Date().toISOString();
  const nextVisitMetadata = {
    ...targetMetadata,
    vetDiagnosisBonusCents: VET_VERIFIED_SCOOPER_BONUS_CENTS,
    vetDiagnosisBonusReportId: reportId,
    vetDiagnosisBonusAwardedAt: awardedAt,
  };

  await prisma.serviceVisit.update({
    where: { id: target.id },
    data: {
      metadata: nextVisitMetadata,
    },
  });

  await upsertVisitPayoutForVisit(target.id);

  return {
    status: 'AWARDED',
    visitId: target.id,
    scooperId: target.scooperId,
    amountCents: VET_VERIFIED_SCOOPER_BONUS_CENTS,
    awardedAt,
    crossSection: target.hasCrossSection,
  } satisfies VetBonusMetadata;
}

function inferExtension(contentType?: string) {
  if (!contentType) return 'jpg';
  if (contentType.includes('video/mp4')) return 'mp4';
  if (contentType.includes('video/webm')) return 'webm';
  if (contentType.includes('video/quicktime')) return 'mov';
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('heic')) return 'heic';
  if (contentType.includes('gif')) return 'gif';
  if (contentType.includes('jpeg')) return 'jpg';
  return 'jpg';
}

export async function GET(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  let payload: ReturnType<typeof verifyMobileToken>;
  try {
    payload = verifyMobileToken(token);
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid token' },
      { status: 401 },
    );
  }

  const userId = payload.sub;
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: 'Customer access required' },
      { status: 403 },
    );
  }
  const canSetup = canSetupCustomer(payload.roles);

  const customer = await prisma.customer.findFirst({
    where: { userId },
    select: { id: true },
  });

  if (!customer) {
    return canSetup
      ? buildCustomerSetupResponse(userId)
      : NextResponse.json(
          { ok: false, error: 'Customer access required' },
          { status: 403 },
        );
  }

  const { searchParams } = new URL(request.url);
  const limitRaw = searchParams.get('limit');
  const limit = limitRaw ? Math.min(Number(limitRaw), 12) : 6;

  const reports = await prisma.weeklyWellnessReport.findMany({
    where: { customerId: customer.id },
    orderBy: { weekStart: 'desc' },
    take: Number.isFinite(limit) ? limit : 6,
    select: {
      id: true,
      weekStart: true,
      weekEnd: true,
      noIssues: true,
      scope: true,
      attribution: true,
      suspectedDogIds: true,
      dogId: true,
      dog: {
        select: {
          id: true,
          name: true,
        },
      },
      stoolColors: true,
      stoolConsistency: true,
      stoolContents: true,
      symptomTags: true,
      appetite: true,
      hydration: true,
      energy: true,
      stoolFrequency: true,
      vomiting: true,
      diarrhea: true,
      medsGiven: true,
      medsNotes: true,
      behaviorNotes: true,
      stoolNotes: true,
      diagnosisLabel: true,
      diagnosisSource: true,
      diagnosisDate: true,
      diagnosisNotes: true,
      consentToShare: true,
      reportedAt: true,
      metadata: true,
      _count: { select: { media: true, captures: true, dailyCheckIns: true } },
    },
  });

  let flaggedVisits: Array<{ scheduledDate: Date; reasons: string[] }> = [];

  if (reports.length > 0) {
    const minStart = reports.reduce(
      (acc, report) => (report.weekStart < acc ? report.weekStart : acc),
      reports[0].weekStart,
    );
    const maxEnd = reports.reduce(
      (acc, report) => (report.weekEnd > acc ? report.weekEnd : acc),
      reports[0].weekEnd,
    );

    const visits = await prisma.serviceVisit.findMany({
      where: {
        customerId: customer.id,
        scheduledDate: {
          gte: minStart,
          lte: maxEnd,
        },
      },
      select: {
        scheduledDate: true,
        insights: {
          where: { wellnessFlag: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { flagReason: true, wellnessFlag: true },
        },
        media: {
          where: { assetType: 'INSIGHTSCOOP', visibilityState: 'VISIBLE' },
          select: { visibilityState: true, analysisResult: true, reviewStatus: true },
        },
      },
    });

    flaggedVisits = visits
      .map((visit) => {
        const insight = visit.insights?.[0];
        const insightFlag = Boolean(insight?.wellnessFlag);
        const mediaFlags = visit.media?.filter(isFlaggedMedia) ?? [];
        if (!insightFlag && mediaFlags.length === 0) return null;
        const reasons = uniqueReasons([
          ...(insight?.flagReason ? [insight.flagReason] : []),
          ...mediaFlags.flatMap(extractMediaFlagReasons),
        ]);
        return {
          scheduledDate: visit.scheduledDate,
          reasons,
        };
      })
      .filter(Boolean) as Array<{ scheduledDate: Date; reasons: string[] }>;
  }

  const formattedReports = reports.map((report) => {
    const base = formatReport(report);
    if (flaggedVisits.length === 0) {
      return base;
    }
    const withinWeek = flaggedVisits.filter(
      (visit) =>
        visit.scheduledDate >= report.weekStart &&
        visit.scheduledDate <= report.weekEnd,
    );
    return {
      ...base,
      aiFlagCount: withinWeek.length,
      aiFlagReasons: uniqueReasons(
        withinWeek.flatMap((visit) => visit.reasons),
      ),
    };
  });

  return NextResponse.json({
    ok: true,
    data: {
      reports: formattedReports,
    },
  });
}

export async function POST(request: NextRequest) {

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  let payload: ReturnType<typeof verifyMobileToken>;
  try {
    payload = verifyMobileToken(token);
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid token' },
      { status: 401 },
    );
  }

  const userId = payload.sub;
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: 'Customer access required' },
      { status: 403 },
    );
  }
  const canSetup = canSetupCustomer(payload.roles);

  const customer = await prisma.customer.findFirst({
    where: { userId },
    select: { id: true, orgId: true, shareWellnessNotes: true },
  });

  if (!customer) {
    return canSetup
      ? buildCustomerSetupResponse(userId)
      : NextResponse.json(
          { ok: false, error: 'Customer access required' },
          { status: 403 },
        );
  }

  const contentType = request.headers.get('content-type') ?? '';
  let rawBody: unknown = null;
  let vetProofFile: File | null = null;

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData().catch(() => null);
    const payloadEntry = formData?.get('payload');
    if (typeof payloadEntry !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Invalid report payload' },
        { status: 422 },
      );
    }
    try {
      rawBody = JSON.parse(payloadEntry);
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Invalid report payload' },
        { status: 422 },
      );
    }
    const fileEntry = formData?.get('vetProof');
    if (fileEntry instanceof File) {
      vetProofFile = fileEntry;
    }
  } else {
    rawBody = await request.json().catch(() => null);
  }

  const parsed = reportSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid report payload', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const scope = parsed.data.scope ?? 'HOUSEHOLD';
  const reportDate = parsed.data.weekStart
    ? new Date(parsed.data.weekStart)
    : new Date(parsed.data.reportDate ?? new Date().toISOString());

  const { weekStart, weekEnd } = getWeekWindow(reportDate);

  let dogRecord: { id: string; customerId: string | null } | null = null;
  if (parsed.data.dogId) {
    dogRecord = await prisma.dog.findFirst({
      where: {
        id: parsed.data.dogId,
        OR: [{ customerId: customer.id }, { userId }],
      },
      select: { id: true, customerId: true },
    });
    if (!dogRecord) {
      return NextResponse.json(
        { ok: false, error: 'Dog not found for this customer.' },
        { status: 404 },
      );
    }
    if (!dogRecord.customerId) {
      await prisma.dog.update({
        where: { id: dogRecord.id },
        data: { customerId: customer.id },
      });
    }
  }

  if (scope === 'DOG' && !dogRecord) {
    return NextResponse.json(
      { ok: false, error: 'dogId is required when scope is DOG.' },
      { status: 422 },
    );
  }

  const suspectedDogIds = parsed.data.suspectedDogIds ?? [];
  if (scope === 'DOG' && suspectedDogIds.length > 0) {
    return NextResponse.json(
      { ok: false, error: 'suspectedDogIds is only allowed for household reports' },
      { status: 422 },
    );
  }

  let resolvedSuspectedDogIds: string[] = [];
  if (suspectedDogIds.length > 0) {
    const dogs = await prisma.dog.findMany({
      where: {
        id: { in: suspectedDogIds },
        OR: [{ customerId: customer.id }, { userId }],
      },
      select: { id: true, customerId: true },
    });
    if (dogs.length !== suspectedDogIds.length) {
      return NextResponse.json(
        { ok: false, error: 'Unknown dog in suspectedDogIds' },
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

  const attribution =
    parsed.data.attribution ??
    (scope === 'HOUSEHOLD'
      ? resolvedSuspectedDogIds.length > 0
        ? 'OWNER_GUESS'
        : 'HOUSEHOLD'
      : 'OWNER_CONFIRMED');

  const dogId = scope === 'DOG' ? dogRecord?.id ?? null : null;

  const matchWhere =
    scope === 'DOG'
      ? { customerId: customer.id, dogId, weekStart, scope }
      : { customerId: customer.id, weekStart, scope };

  const existingReport = await prisma.weeklyWellnessReport.findFirst({
    where: matchWhere,
    select: { id: true, metadata: true },
  });

  const existingVetProof = extractVetProof(existingReport?.metadata ?? null);
  const diagnosisLabel = parsed.data.diagnosisLabel?.trim() ?? '';
  const diagnosisNotes = parsed.data.diagnosisNotes?.trim() ?? '';

  let vetProofMetadata: VetProofMetadata | null = null;
  let hasVetProof = Boolean(existingVetProof);

  if (vetProofFile) {
    const bucket = env.STORAGE_BUCKET;
    if (!bucket) {
      return NextResponse.json(
        { ok: false, error: 'storage_unavailable' },
        { status: 503 },
      );
    }
    const now = new Date();
    const extension = inferExtension(vetProofFile.type);
    const key = `${now.getTime()}-${randomUUID()}.${extension}`;
    const storagePath = `wellness/vet-proof/${customer.orgId}/${customer.id}/${key}`;
    try {
      const fileBuffer = await vetProofFile.arrayBuffer();
      await uploadImage(bucket, storagePath, fileBuffer, vetProofFile.type);
    } catch (error) {
      console.error('[wellness] Failed to upload vet notes image', {
        customerId: customer.id,
        error,
      });
      return NextResponse.json({ ok: false, error: 'upload_failed' }, { status: 500 });
    }
    vetProofMetadata = {
      status: 'SUBMITTED',
      storagePath,
      submittedAt: now.toISOString(),
      fileName: vetProofFile.name ?? null,
      contentType: vetProofFile.type ?? null,
    };
    hasVetProof = true;
  }

  const requestedDiagnosisSource = parsed.data.diagnosisSource ?? null;
  const hasDiagnosisDetails = Boolean(
    diagnosisLabel ||
      diagnosisNotes ||
      parsed.data.diagnosisDate ||
      hasVetProof ||
      requestedDiagnosisSource,
  );
  const resolvedDiagnosisSource = hasDiagnosisDetails
    ? requestedDiagnosisSource ?? (hasVetProof ? 'VET_CONFIRMED' : 'OWNER_REPORTED')
    : null;

  const noIssues = parsed.data.noIssues ?? false;
  const stoolColors = noIssues ? [] : parsed.data.stoolColors ?? [];
  const stoolConsistency = noIssues ? [] : parsed.data.stoolConsistency ?? [];
  const stoolContents = noIssues ? [] : parsed.data.stoolContents ?? [];
  const symptomTags = noIssues ? [] : parsed.data.symptomTags ?? [];

  const reportData = {
    orgId: customer.orgId,
    customerId: customer.id,
    dogId,
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
    diagnosisSource: resolvedDiagnosisSource,
    diagnosisDate: parsed.data.diagnosisDate ? new Date(parsed.data.diagnosisDate) : null,
    diagnosisNotes: diagnosisNotes || null,
    consentToShare:
      parsed.data.consentToShare ?? customer.shareWellnessNotes ?? true,
    metadata: (parsed.data.metadata ?? existingReport?.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    reportedAt: new Date(),
  };

  const report = existingReport
    ? await prisma.weeklyWellnessReport.update({
        where: { id: existingReport.id },
        data: reportData,
        select: {
          id: true,
          weekStart: true,
          weekEnd: true,
          noIssues: true,
          scope: true,
          attribution: true,
          suspectedDogIds: true,
          dogId: true,
          stoolColors: true,
          stoolConsistency: true,
          stoolContents: true,
          symptomTags: true,
          appetite: true,
          hydration: true,
          energy: true,
          stoolFrequency: true,
          vomiting: true,
          diarrhea: true,
          medsGiven: true,
          medsNotes: true,
          behaviorNotes: true,
          stoolNotes: true,
          diagnosisLabel: true,
          diagnosisSource: true,
          diagnosisDate: true,
          diagnosisNotes: true,
          consentToShare: true,
          reportedAt: true,
          metadata: true,
          _count: { select: { media: true } },
        },
      })
    : await prisma.weeklyWellnessReport.create({
        data: reportData,
        select: {
          id: true,
          weekStart: true,
          weekEnd: true,
          noIssues: true,
          scope: true,
          attribution: true,
          suspectedDogIds: true,
          dogId: true,
          stoolColors: true,
          stoolConsistency: true,
          stoolContents: true,
          symptomTags: true,
          appetite: true,
          hydration: true,
          energy: true,
          stoolFrequency: true,
          vomiting: true,
          diarrhea: true,
          medsGiven: true,
          medsNotes: true,
          behaviorNotes: true,
          stoolNotes: true,
          diagnosisLabel: true,
          diagnosisSource: true,
          diagnosisDate: true,
          diagnosisNotes: true,
          consentToShare: true,
          reportedAt: true,
          metadata: true,
          _count: { select: { media: true } },
        },
      });

  const streakWhere =
    reportData.scope === 'DOG'
      ? { customerId: customer.id, dogId: reportData.dogId, scope: reportData.scope }
      : { customerId: customer.id, dogId: null, scope: reportData.scope };

  const weekStarts = await prisma.weeklyWellnessReport.findMany({
    where: streakWhere,
    select: { weekStart: true },
  });

  const streakCount = calculateStreak(
    weekStarts.map((entry) => entry.weekStart),
    weekStart,
  );

  const pointsBreakdown = calculateReportPoints(
    {
      noIssues: reportData.noIssues,
      symptomTags: reportData.symptomTags,
      behaviorNotes: reportData.behaviorNotes,
      stoolNotes: reportData.stoolNotes,
      diagnosisSource: reportData.diagnosisSource,
      diagnosisLabel: reportData.diagnosisLabel,
    },
    streakCount,
  );

  const baseMetadata = parseMetadata(report.metadata) ?? {};
  const existingVerification = extractVetVerification(baseMetadata);
  const nowIso = new Date().toISOString();

  let vetVerification: VetVerificationMetadata | null = existingVerification;
  if (resolvedDiagnosisSource === 'VET_CONFIRMED') {
    if (existingVerification?.status === 'verified') {
      vetVerification = existingVerification;
    } else if (hasVetProof) {
      vetVerification = {
        status: 'documented',
        submittedAt: vetProofMetadata?.submittedAt ?? nowIso,
      };
    } else if (!existingVerification) {
      vetVerification = {
        status: 'self_reported',
        submittedAt: nowIso,
      };
    }
  }

  const nextMetadata = {
    ...baseMetadata,
    ...(vetProofMetadata ? { vetProof: vetProofMetadata } : {}),
    ...(vetVerification ? { vetVerification } : {}),
  };

  const rewardMetadata = {
    pointsAwarded: pointsBreakdown.totalPoints,
    pointsBreakdown,
    streakCount,
    ruleVersion: 1,
    rules: WELLNESS_REWARD_RULES,
  };

  const metadataWithRewards = {
    ...nextMetadata,
    wellnessRewards: rewardMetadata,
  };

  const vetCandidate =
    resolvedDiagnosisSource === 'VET_CONFIRMED' && !reportData.noIssues
      ? await findVetConfirmedCandidate({
          customerId: customer.id,
          weekStart,
          weekEnd,
        })
      : null;

  const vetBonus = await awardVetVerifiedScooperBonus({
    reportId: report.id,
    reportMetadata: metadataWithRewards,
    customerId: customer.id,
    weekStart,
    weekEnd,
    diagnosisSource: reportData.diagnosisSource,
    hasVetProof,
    noIssues: reportData.noIssues,
    candidate: vetCandidate,
  });

  await prisma.weeklyWellnessReport.update({
    where: { id: report.id },
    data: {
      metadata: vetBonus
        ? {
            ...metadataWithRewards,
            vetBonus,
          }
        : metadataWithRewards,
    },
  });

  await awardCustomerRewardPoints({
    orgId: customer.orgId,
    customerId: customer.id,
    eventType: CustomerRewardEventType.WEEKLY_REPORT,
    sourceKey: `weekly-report:${report.id}`,
    points: pointsBreakdown.totalPoints,
    createdAt: report.reportedAt ?? new Date(),
    metadata: {
      reportId: report.id,
      dogId: report.dogId ?? null,
      weekStart: report.weekStart.toISOString(),
      weekEnd: report.weekEnd.toISOString(),
      pointsBreakdown,
    } as Prisma.InputJsonValue,
  });

  if (resolvedDiagnosisSource === 'VET_CONFIRMED' && vetCandidate?.orgId) {
    await awardScooperPoints({
      orgId: vetCandidate.orgId,
      scooperId: vetCandidate.scooperId,
      eventType: ScooperRewardEventType.VET_CONFIRMED,
      sourceKey: `vet-confirmed:${report.id}`,
      points: SCOOPER_REWARD_EVENT_POINTS.vetConfirmed,
      serviceVisitId: vetCandidate.id,
      metadata: {
        verificationStatus: resolveVetVerificationStatus({
          reportMetadata: metadataWithRewards,
          hasVetProof,
          diagnosisSource: reportData.diagnosisSource,
        }),
        crossSection: vetCandidate.hasCrossSection,
      },
      maxPointsPerVisit: SCOOPER_VISIT_POINTS_CAP,
    });
  }

  const mediaMatches = await prisma.serviceVisitMedia.findMany({
    where: {
      assetType: 'INSIGHTSCOOP',
      capturedAt: { gte: weekStart, lte: weekEnd },
      visibilityState: 'VISIBLE',
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

  if (scope === 'DOG' && reportData.dogId) {
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
      report: formatReport(report),
      linkedMediaCount: mediaMatches.length,
      linkedCaptureCount: captureMatches.length,
      linkedDailyCheckInCount: dailyMatches.length,
      reward: rewardMetadata,
    },
  });
}
