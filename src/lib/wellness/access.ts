import { prisma } from '@/lib/prisma';
import type { WellnessPlanSource, WellnessTier } from '@prisma/client';

export const WELLNESS_PROMO_END = new Date('2026-04-30T23:59:59.999Z');

export const WELLNESS_FREE_LIMITS = {
  scansPerMonth: 5,
  chatsPerMonth: 12,
  foodScansPerMonth: 10,
  inventoryAddsPerMonth: 10,
};

export const WELLNESS_PREMIUM_LIMITS = {
  scansPerMonth: 9999,
  chatsPerMonth: 9999,
  foodScansPerMonth: 9999,
  inventoryAddsPerMonth: 9999,
};

export type WellnessUsage = {
  periodKey: string;
  scansCount: number;
  chatsCount: number;
  foodScansCount: number;
  inventoryAddsCount: number;
};

export type WellnessAccess = {
  tier: WellnessTier;
  source: WellnessPlanSource;
  planEndsAt: Date | null;
  hasActiveService: boolean;
  promoEligible: boolean;
  promoEndsAt: Date;
  usage: WellnessUsage;
  limits: typeof WELLNESS_FREE_LIMITS;
  maxDogs: number | null;
};

export function getPeriodKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export async function getCustomerWellnessAccess(options: {
  customerId: string;
  orgId: string;
  now?: Date;
}): Promise<WellnessAccess> {
  const now = options.now ?? new Date();
  const periodKey = getPeriodKey(now);

  const [plan, activeJob, usage] = await Promise.all([
    prisma.customerWellnessPlan.findFirst({
      where: {
        customerId: options.customerId,
        status: 'ACTIVE',
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      orderBy: { startedAt: 'desc' },
      select: {
        tier: true,
        source: true,
        endsAt: true,
      },
    }),
    prisma.job.findFirst({
      where: {
        customerId: options.customerId,
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
    prisma.customerWellnessUsage.findUnique({
      where: {
        customerId_periodKey: {
          customerId: options.customerId,
          periodKey,
        },
      },
      select: {
        periodKey: true,
        scansCount: true,
        chatsCount: true,
        foodScansCount: true,
        inventoryAddsCount: true,
      },
    }),
  ]);

  const hasActiveService = Boolean(activeJob);
  const activeJobCreatedAt = activeJob?.createdAt ?? null;
  const promoEligible = activeJobCreatedAt ? activeJobCreatedAt <= WELLNESS_PROMO_END : false;

  let tier: WellnessTier = plan?.tier ?? 'FREE';
  let source: WellnessPlanSource = plan?.source ?? 'DIRECT';
  let planEndsAt = plan?.endsAt ?? null;

  if (!plan && promoEligible) {
    tier = 'PREMIUM';
    source = 'SERVICE_PROMO';
    if (activeJob?.createdAt) {
      const promoEnd = new Date(activeJob.createdAt);
      promoEnd.setFullYear(promoEnd.getFullYear() + 1);
      planEndsAt = promoEnd;
    }
  }

  const limits =
    tier === 'PREMIUM' ? WELLNESS_PREMIUM_LIMITS : WELLNESS_FREE_LIMITS;
  const maxDogs = tier === 'PREMIUM' ? null : 1;

  return {
    tier,
    source,
    planEndsAt,
    hasActiveService,
    promoEligible,
    promoEndsAt: WELLNESS_PROMO_END,
    usage: {
      periodKey,
      scansCount: usage?.scansCount ?? 0,
      chatsCount: usage?.chatsCount ?? 0,
      foodScansCount: usage?.foodScansCount ?? 0,
      inventoryAddsCount: usage?.inventoryAddsCount ?? 0,
    },
    limits,
    maxDogs,
  };
}

export async function incrementWellnessUsage(options: {
  customerId: string;
  orgId: string;
  periodKey?: string;
  scansDelta?: number;
  chatsDelta?: number;
  foodScansDelta?: number;
  inventoryAddsDelta?: number;
}) {
  const periodKey = options.periodKey ?? getPeriodKey();
  const scansDelta = options.scansDelta ?? 0;
  const chatsDelta = options.chatsDelta ?? 0;
  const foodScansDelta = options.foodScansDelta ?? 0;
  const inventoryAddsDelta = options.inventoryAddsDelta ?? 0;

  return prisma.customerWellnessUsage.upsert({
    where: {
      customerId_periodKey: {
        customerId: options.customerId,
        periodKey,
      },
    },
    update: {
      scansCount: { increment: scansDelta },
      chatsCount: { increment: chatsDelta },
      foodScansCount: { increment: foodScansDelta },
      inventoryAddsCount: { increment: inventoryAddsDelta },
    },
    create: {
      orgId: options.orgId,
      customerId: options.customerId,
      periodKey,
      scansCount: Math.max(0, scansDelta),
      chatsCount: Math.max(0, chatsDelta),
      foodScansCount: Math.max(0, foodScansDelta),
      inventoryAddsCount: Math.max(0, inventoryAddsDelta),
    },
  });
}
