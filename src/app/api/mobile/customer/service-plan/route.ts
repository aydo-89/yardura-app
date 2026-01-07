import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma, Frequency } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { buildCustomerSetupResponse, canSetupCustomer } from '@/lib/mobile/customer-setup';
import { calculatePrice } from '@/lib/priceEstimator';
import { getZoneMultiplierForZip } from '@/lib/business-config';

const areasSchema = z.object({
  frontYard: z.boolean().optional(),
  backYard: z.boolean().optional(),
  sideYard: z.boolean().optional(),
  dogRun: z.boolean().optional(),
  fencedArea: z.boolean().optional(),
  other: z.string().optional(),
});

const updateSchema = z.object({
  dogs: z.number().int().min(1).max(12).optional(),
  yardSize: z.enum(['small', 'medium', 'large', 'xl', 'xlarge']).optional(),
  frequency: z.enum(['weekly', 'biweekly', 'twice-weekly', 'monthly', 'daily']).optional(),
  deodorize: z.boolean().optional(),
  deodorizeMode: z.enum(['none', 'first-visit', 'each-visit']).optional(),
  divertMode: z.enum(['none', 'takeaway', 'compost']).optional(),
  areasToClean: areasSchema.optional(),
  weekendUpgrade: z.boolean().optional(),
});

const parseAreasToClean = (
  value: unknown,
): z.infer<typeof areasSchema> | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as z.infer<typeof areasSchema>;
      }
    } catch {
      return undefined;
    }
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as z.infer<typeof areasSchema>;
  }
  return undefined;
};

const computeExtraAreas = (areas?: z.infer<typeof areasSchema>) => {
  if (!areas) return 0;
  const selected = Object.entries(areas).filter(([key, value]) => {
    if (key === 'other') {
      return typeof value === 'string' && value.trim().length > 0;
    }
    return Boolean(value);
  }).length;
  return Math.max(0, selected - 1);
};

const normalizeYardSize = (value?: string | null) => {
  const normalized = value?.toLowerCase() ?? 'medium';
  if (normalized === 'xlarge') return 'xl';
  if (['small', 'medium', 'large', 'xl'].includes(normalized)) {
    return normalized as 'small' | 'medium' | 'large' | 'xl';
  }
  return 'medium';
};

const normalizeFrequency = (value?: string | null) => {
  const normalized = value?.toLowerCase().replace(/_/g, '-') ?? 'weekly';
  if (normalized === 'bi-weekly') return 'biweekly';
  if (normalized === 'twice-weekly') return 'twice-weekly';
  if (normalized === 'one-time' || normalized === 'onetime') return 'onetime';
  if (normalized === 'monthly') return 'monthly';
  if (normalized === 'daily') return 'daily';
  return 'weekly';
};

const mapJobFrequency = (value?: string | null) => {
  switch ((value ?? '').toUpperCase()) {
    case 'BI_WEEKLY':
      return 'biweekly';
    case 'TWICE_WEEKLY':
      return 'twice-weekly';
    case 'MONTHLY':
      return 'monthly';
    case 'DAILY':
      return 'daily';
    case 'ONE_TIME':
      return 'onetime';
    default:
      return 'weekly';
  }
};

const mapJobFrequencyEnum = (value: string): Frequency => {
  switch (value) {
    case 'biweekly':
      return Frequency.BI_WEEKLY;
    case 'twice-weekly':
      return Frequency.TWICE_WEEKLY;
    case 'monthly':
      return Frequency.MONTHLY;
    case 'daily':
      return Frequency.DAILY;
    case 'onetime':
      return Frequency.ONE_TIME;
    default:
      return Frequency.WEEKLY;
  }
};

const mapDeodorizeModeToJob = (value: string | null | undefined) => {
  if (value === 'first-visit') return 'FIRST_VISIT';
  if (value === 'each-visit') return 'EACH_VISIT';
  return 'NONE';
};

const mapJobDeodorizeMode = (value?: string | null) => {
  const normalized = value?.toUpperCase();
  if (normalized === 'FIRST_VISIT') return 'first-visit';
  if (normalized === 'EACH_VISIT') return 'each-visit';
  return 'none';
};

const normalizeDivertMode = (value?: string | null) => {
  const normalized = value?.toLowerCase().trim() ?? 'none';
  if (!normalized) return 'none';
  if (normalized === 'compost') return 'compost';
  if (normalized === 'haul-away' || normalized === 'haulaway') return 'takeaway';
  if (normalized === 'takeaway') return 'takeaway';
  if (normalized === 'none') return 'none';
  if (/^\d{1,3}%?$/.test(normalized)) return 'compost';
  if (normalized.startsWith('eco') && /\d/.test(normalized)) return 'compost';
  return 'none';
};

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

async function buildPlanPayload(options: {
  customerId: string;
  orgId: string;
  jobId: string;
  jobFrequency: string | null;
  dogCount: number;
  yardSize: string;
  deodorizeMode: string;
  divertMode: string;
  areasToClean?: z.infer<typeof areasSchema>;
  extraAreas: number;
  billingPreference: string | null;
  perVisitAmountCents?: number | null;
  recurringAmountCents?: number | null;
  pricing: Record<string, unknown>;
}) {
  const {
    customerId,
    orgId,
    jobId,
    jobFrequency,
    dogCount,
    yardSize,
    deodorizeMode,
    divertMode,
    areasToClean,
    extraAreas,
    billingPreference,
    perVisitAmountCents,
    recurringAmountCents,
    pricing,
  } = options;

  return {
    hasActiveService: true,
    customerId,
    orgId,
    jobId,
    dogCount,
    yardSize,
    frequency: jobFrequency,
    deodorizeMode,
    divertMode,
    areasToClean: areasToClean ?? null,
    extraAreas,
    billingPreference,
    perVisitAmountCents: perVisitAmountCents ?? null,
    recurringAmountCents: recurringAmountCents ?? null,
    pricing,
  };
}

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
    select: { id: true, orgId: true, zip: true },
  });

  if (!customer) {
    return canSetup
      ? buildCustomerSetupResponse(userId)
      : NextResponse.json({ ok: false, error: 'Customer access required' }, { status: 403 });
  }

  const job = await prisma.job.findFirst({
    where: { customerId: customer.id, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
    include: { billingPlan: true },
  });

  if (!job) {
    return NextResponse.json({ ok: true, data: { hasActiveService: false } });
  }

  const lead = await prisma.lead.findFirst({
    where: { convertedToCustomerId: customer.id },
    orderBy: [{ convertedAt: 'desc' }, { submittedAt: 'desc' }],
  });

  const areasToClean = parseAreasToClean(lead?.areasToClean);
  const extraAreas = typeof job.extraAreas === 'number' ? job.extraAreas : computeExtraAreas(areasToClean);
  const dogCount = job.dogCount ?? lead?.dogs ?? 1;
  const yardSize = normalizeYardSize(lead?.yardSize ?? null);
  const frequency = normalizeFrequency(lead?.frequency ?? mapJobFrequency(job.frequency));
  const deodorizeMode = mapJobDeodorizeMode(job.deodorizeMode);
  const divertMode = normalizeDivertMode(
    lead?.divertMode ??
      (job.billingPlan?.metadata &&
      typeof job.billingPlan.metadata === 'object' &&
      !Array.isArray(job.billingPlan.metadata)
        ? ((job.billingPlan.metadata as Record<string, any>)?.disposalPreferences?.mode as string | undefined)
        : undefined),
  );

  let zoneMultiplier = 1;
  const zip = lead?.zipCode ?? customer.zip ?? null;
  if (zip) {
    try {
      zoneMultiplier = await getZoneMultiplierForZip(zip, customer.orgId);
    } catch {
      zoneMultiplier = 1;
    }
  }

  const pricing = (await calculatePrice({
    dogs: dogCount,
    yardSize,
    frequency,
    addons: {
      deodorize: deodorizeMode !== 'none',
      deodorizeMode: deodorizeMode === 'none' ? undefined : deodorizeMode,
      divertMode,
    },
    areasToClean,
    zoneMultiplier,
    businessId: customer.orgId,
    weekendUpgrade:
      job.billingPlan?.metadata &&
      typeof job.billingPlan.metadata === 'object' &&
      !Array.isArray(job.billingPlan.metadata)
        ? Boolean((job.billingPlan.metadata as Record<string, any>)?.serviceOptions?.weekendUpgrade)
        : false,
  })) as Record<string, unknown>;

  return NextResponse.json({
    ok: true,
    data: await buildPlanPayload({
      customerId: customer.id,
      orgId: customer.orgId,
      jobId: job.id,
      jobFrequency: frequency,
      dogCount,
      yardSize,
      deodorizeMode,
      divertMode,
      areasToClean,
      extraAreas,
      billingPreference: job.billingPlan?.billingPreference ?? null,
      perVisitAmountCents: job.billingPlan?.perVisitAmountCents ?? null,
      recurringAmountCents: job.billingPlan?.recurringAmountCents ?? null,
      pricing,
    }),
  });
}

export async function PATCH(request: NextRequest) {
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

  const customer = await prisma.customer.findFirst({
    where: { userId },
    select: { id: true, orgId: true, zip: true },
  });

  if (!customer) {
    return NextResponse.json({ ok: false, error: 'Customer access required' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid payload', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const job = await prisma.job.findFirst({
    where: { customerId: customer.id, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
    include: { billingPlan: true },
  });

  if (!job) {
    return NextResponse.json({ ok: false, error: 'No active service plan.' }, { status: 404 });
  }

  const lead = await prisma.lead.findFirst({
    where: { convertedToCustomerId: customer.id },
    orderBy: [{ convertedAt: 'desc' }, { submittedAt: 'desc' }],
  });

  const currentAreas = parseAreasToClean(lead?.areasToClean);
  const nextAreas = parsed.data.areasToClean ?? currentAreas;
  const nextExtraAreas = computeExtraAreas(nextAreas);

  const nextDogCount = parsed.data.dogs ?? job.dogCount ?? lead?.dogs ?? 1;
  const nextYardSize = normalizeYardSize(parsed.data.yardSize ?? lead?.yardSize ?? null);
  const nextFrequency = normalizeFrequency(parsed.data.frequency ?? lead?.frequency ?? mapJobFrequency(job.frequency));
  const existingDeodorizeMode = mapJobDeodorizeMode(job.deodorizeMode);
  const nextDeodorizeMode = (() => {
    if (parsed.data.deodorizeMode) return parsed.data.deodorizeMode;
    if (parsed.data.deodorize !== undefined) return parsed.data.deodorize ? 'each-visit' : 'none';
    return existingDeodorizeMode;
  })();
  const nextDivertMode = normalizeDivertMode(
    parsed.data.divertMode ?? lead?.divertMode ?? 'none',
  );

  const planMetadata =
    job.billingPlan?.metadata &&
    typeof job.billingPlan.metadata === 'object' &&
    !Array.isArray(job.billingPlan.metadata)
      ? (job.billingPlan.metadata as Record<string, unknown>)
      : {};
  const serviceOptions =
    planMetadata.serviceOptions &&
    typeof planMetadata.serviceOptions === 'object' &&
    !Array.isArray(planMetadata.serviceOptions)
      ? (planMetadata.serviceOptions as Record<string, unknown>)
      : {};
  const disposalPreferences =
    planMetadata.disposalPreferences &&
    typeof planMetadata.disposalPreferences === 'object' &&
    !Array.isArray(planMetadata.disposalPreferences)
      ? (planMetadata.disposalPreferences as Record<string, unknown>)
      : {};

  const weekendUpgrade =
    parsed.data.weekendUpgrade ??
    (typeof serviceOptions.weekendUpgrade === 'boolean' ? serviceOptions.weekendUpgrade : false);

  let zoneMultiplier = 1;
  const zip = lead?.zipCode ?? customer.zip ?? null;
  if (zip) {
    try {
      zoneMultiplier = await getZoneMultiplierForZip(zip, customer.orgId);
    } catch {
      zoneMultiplier = 1;
    }
  }

  const pricing = (await calculatePrice({
    dogs: nextDogCount,
    yardSize: nextYardSize,
    frequency: nextFrequency,
    addons: {
      deodorize: nextDeodorizeMode !== 'none',
      deodorizeMode: nextDeodorizeMode === 'none' ? undefined : nextDeodorizeMode,
      divertMode: nextDivertMode,
    },
    areasToClean: nextAreas,
    zoneMultiplier,
    businessId: customer.orgId,
    weekendUpgrade,
  })) as Record<string, unknown>;

  const perVisitCents = Math.max(0, Math.round(Number(pricing.perVisit ?? 0)));
  const monthlyCents = Math.max(0, Math.round(Number(pricing.monthly ?? 0)));

  const nextMetadata: Record<string, unknown> = {
    ...planMetadata,
    serviceOptions: {
      ...serviceOptions,
      weekendUpgrade,
      dogCount: nextDogCount,
      extraAreas: nextExtraAreas,
      yardSize: nextYardSize,
      frequency: nextFrequency,
    },
    disposalPreferences: {
      ...disposalPreferences,
      mode: nextDivertMode,
      requiresBinConfirmation: nextDivertMode === 'none',
    },
  };

  const leadUpdate: Prisma.LeadUpdateInput = {
    dogs: nextDogCount,
    yardSize: nextYardSize,
    frequency: nextFrequency,
    deodorize: nextDeodorizeMode !== 'none',
    deodorizeMode: nextDeodorizeMode === 'none' ? null : nextDeodorizeMode,
    divertMode: nextDivertMode,
    areasToClean: nextAreas ?? Prisma.DbNull,
    pricingBreakdown: pricing as Prisma.InputJsonValue,
  };

  const jobUpdate: Prisma.JobUpdateInput = {
    frequency: mapJobFrequencyEnum(nextFrequency),
    dogCount: nextDogCount,
    deodorizeMode: mapDeodorizeModeToJob(nextDeodorizeMode) as any,
    extraAreas: nextExtraAreas,
    perVisitRevenueCents: perVisitCents,
  };

  const planUpdate: Prisma.CustomerBillingPlanUpdateInput = {
    perVisitAmountCents: perVisitCents,
    recurringAmountCents:
      job.billingPlan?.billingPreference === 'monthly' ? monthlyCents : job.billingPlan?.recurringAmountCents ?? null,
    pricingSnapshot: pricing as Prisma.InputJsonValue,
    metadata: nextMetadata as Prisma.InputJsonValue,
  };

  await prisma.$transaction(async (tx) => {
    if (lead) {
      await tx.lead.update({ where: { id: lead.id }, data: leadUpdate });
    }
    await tx.job.update({ where: { id: job.id }, data: jobUpdate });
    if (job.billingPlan) {
      await tx.customerBillingPlan.update({ where: { id: job.billingPlan.id }, data: planUpdate });
    }
  });

  return NextResponse.json({
    ok: true,
    data: await buildPlanPayload({
      customerId: customer.id,
      orgId: customer.orgId,
      jobId: job.id,
      jobFrequency: nextFrequency,
      dogCount: nextDogCount,
      yardSize: nextYardSize,
      deodorizeMode: nextDeodorizeMode,
      divertMode: nextDivertMode,
      areasToClean: nextAreas,
      extraAreas: nextExtraAreas,
      billingPreference: job.billingPlan?.billingPreference ?? null,
      perVisitAmountCents: perVisitCents,
      recurringAmountCents:
        job.billingPlan?.billingPreference === 'monthly' ? monthlyCents : job.billingPlan?.recurringAmountCents ?? null,
      pricing,
    }),
  });
}

export const runtime = 'nodejs';
