import { prisma } from "@/lib/prisma";
import {
  createStripePayoutTransfer,
  fetchStripeConnectStatus,
} from "@/lib/stripe/connect";
import { sendScooperPayoutReleasedPush } from "@/lib/notifications/push";
import {
  Frequency,
  LedgerEntryType,
  PayoutStatus,
  Prisma,
  VisitCompSchedule,
} from "@prisma/client";

import type {
  VisitAddonSelection,
  VisitPayoutBreakdown,
  VisitPayoutComputationInput,
} from "./types";

function parseAddonRates(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, number>;
}

function parseBonusCents(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

function resolveVetDiagnosisBonusCents(
  metadata: Record<string, unknown> | null | undefined,
) {
  if (!metadata) return 0;
  return parseBonusCents(metadata.vetDiagnosisBonusCents);
}

function computeAddonBonuses(
  schedule: VisitCompSchedule,
  selection: VisitAddonSelection | undefined,
) {
  if (!selection) {
    return {
      haulAway: false,
      ecoTier: undefined,
      addonBreakdown: {} as Record<string, number>,
      bonusCents: 0,
    };
  }

  const addonBreakdown: Record<string, number> = {};
  let bonusCents = 0;

  if (selection.haulAway) {
    bonusCents += schedule.haulAwayBonusCents;
    addonBreakdown.haulAway = schedule.haulAwayBonusCents;
  }

  if (selection.ecoDiversionTier && selection.ecoDiversionTier > 0) {
    bonusCents += schedule.ecoDiversionBonusCents;
    addonBreakdown.ecoDiversion = schedule.ecoDiversionBonusCents;
  }

  const configuredAddons = parseAddonRates(schedule.addonRates);
  if (selection.deodorize && configuredAddons.deodorize) {
    bonusCents += configuredAddons.deodorize;
    addonBreakdown.deodorize = configuredAddons.deodorize;
  }

  if (selection.extraAreasCount && configuredAddons.extraArea) {
    const extra =
      selection.extraAreasCount * Math.max(0, configuredAddons.extraArea);
    bonusCents += extra;
    addonBreakdown.extraAreas = extra;
  }

  if (selection.customAddons) {
    for (const [key, amount] of Object.entries(selection.customAddons)) {
      if (!amount) continue;
      bonusCents += amount;
      addonBreakdown[key] =
        (addonBreakdown[key] ?? 0) + Math.round(Number(amount));
    }
  }

  return {
    haulAway: Boolean(selection.haulAway),
    ecoTier: selection.ecoDiversionTier,
    addonBreakdown,
    bonusCents,
  };
}

const ECO_DIVERSIONS: Array<VisitAddonSelection["ecoDiversionTier"]> = [
  0,
  25,
  50,
  100,
];

export function extractVisitAddonSelection(
  metadata: Prisma.JsonValue | null | undefined,
  options?: { deodorize?: boolean | null },
): VisitAddonSelection {
  const selection: VisitAddonSelection = {
    haulAway: false,
    ecoDiversionTier: undefined,
    deodorize: Boolean(options?.deodorize),
    extraAreasCount: undefined,
  };

  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return selection;
  }

  const value = metadata as Record<string, unknown>;

  if (value.haulAway === true) {
    selection.haulAway = true;
  }

  const ecoValue = value.ecoDiversionTier;
  if (typeof ecoValue === "number" && ECO_DIVERSIONS.includes(ecoValue as any)) {
    selection.ecoDiversionTier = ecoValue as VisitAddonSelection["ecoDiversionTier"];
  }

  if (typeof value.extraAreasCount === "number") {
    selection.extraAreasCount = value.extraAreasCount;
  }

  if (value.customAddons && typeof value.customAddons === "object" && !Array.isArray(value.customAddons)) {
    const custom: Record<string, number> = {};
    for (const [key, amount] of Object.entries(value.customAddons as Record<string, unknown>)) {
      const parsed = Number(amount);
      if (!Number.isNaN(parsed) && parsed !== 0) {
        custom[key] = Math.round(parsed);
      }
    }
    if (Object.keys(custom).length) {
      selection.customAddons = custom;
    }
  }

  return selection;
}

export function calculateVisitPayoutBreakdown(
  input: VisitPayoutComputationInput,
): VisitPayoutBreakdown {
  const { schedule, addonSelection, densityBonusCents } = input;

  const addonResult = computeAddonBonuses(schedule, addonSelection);

  const baseAmountCents = schedule.baseRateCents;
  const bonusAmountCents =
    addonResult.bonusCents + Math.round(densityBonusCents ?? 0);

  const mileageMiles = Math.max(0, input.mileageMiles ?? 0);
  const mileageRateCents = Math.max(0, input.mileageRateCents ?? 0);
  const mileageAmountCents = Math.round(mileageMiles * mileageRateCents);

  const ppeAmountCents = Math.max(0, Math.round(input.ppeStipendCents ?? 0));
  const tipsAmountCents = Math.max(0, Math.round(input.tipsCents ?? 0));

  const totalAmountCents =
    baseAmountCents +
    bonusAmountCents +
    mileageAmountCents +
    ppeAmountCents +
    tipsAmountCents;

  return {
    baseAmountCents,
    bonusAmountCents,
    mileageAmountCents,
    ppeAmountCents,
    tipsAmountCents,
    totalAmountCents,
    haulAwayApplied: addonResult.haulAway,
    appliedEcoDiversionTier: addonResult.ecoTier,
    addonBreakdown: addonResult.addonBreakdown,
  };
}

export const DEFAULT_MILEAGE_RATE_CENTS = 30; // $0.30 / mile
export const DEFAULT_PPE_STIPEND_CENTS = 75; // $0.75 per visit

export async function getActiveCompSchedule(
  orgId: string,
  frequency: Frequency,
  asOf: Date = new Date(),
): Promise<VisitCompSchedule | null> {
  return prisma.visitCompSchedule.findFirst({
    where: {
      orgId,
      frequency,
      effectiveFrom: { lte: asOf },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
    },
    orderBy: {
      effectiveFrom: "desc",
    },
  });
}

export async function ensureDefaultCompSchedule(
  orgId: string,
  frequency: Frequency,
  defaults: Partial<VisitCompSchedule>,
) {
  const existing = await getActiveCompSchedule(orgId, frequency);
  if (existing) return existing;

  return prisma.visitCompSchedule.create({
    data: {
      orgId,
      frequency,
      effectiveFrom: new Date(),
      baseRateCents: defaults.baseRateCents ?? 1500,
      binDropBonusCents: defaults.binDropBonusCents ?? 0,
      haulAwayBonusCents: defaults.haulAwayBonusCents ?? 400,
      ecoDiversionBonusCents: defaults.ecoDiversionBonusCents ?? 200,
      addonRates: defaults.addonRates ?? Prisma.JsonNull,
      certificationMatrix: defaults.certificationMatrix ?? Prisma.JsonNull,
      notes: defaults.notes ?? null,
      isDefault: defaults.isDefault ?? true,
    },
  });
}

export async function upsertVisitPayoutForVisit(
  visitId: string,
  options?: {
    tx?: Prisma.TransactionClient;
    densityBonusCents?: number;
    mileageMiles?: number;
    mileageRateCents?: number;
    ppeStipendCents?: number;
    tipsAmountCents?: number;
  },
) {
  const client = options?.tx ?? prisma;

  const visit = await client.serviceVisit.findUnique({
    where: { id: visitId },
    include: {
      job: {
        select: {
          id: true,
          frequency: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          orgId: true,
        },
      },
      tile: {
        select: {
          id: true,
          orgId: true,
        },
      },
      routeShift: {
        select: {
          id: true,
          plannedStops: true,
          completedStops: true,
          actualMiles: true,
        },
      },
    },
  });

  if (!visit) {
    throw new Error(`Visit ${visitId} not found`);
  }

  if (!visit.assignedToId || !visit.assignedTo) {
    throw new Error(`Visit ${visitId} has no assigned scooper`);
  }

  const orgId = visit.orgId ?? visit.assignedTo.orgId ?? visit.tile?.orgId;
  if (!orgId) {
    throw new Error(`Visit ${visitId} missing org context`);
  }

  const frequency = visit.job?.frequency ?? Frequency.WEEKLY;
  let schedule = await getActiveCompSchedule(orgId, frequency);

  if (!schedule) {
    schedule = await ensureDefaultCompSchedule(orgId, frequency, {});
  }

  const metadataValue = visit.metadata as Record<string, any> | null | undefined;
  const sharePercent = extractSharePercent(schedule);
  const baseShareCents =
    typeof visit.revenueCents === "number" && visit.revenueCents >= 0
      ? Math.round(visit.revenueCents * sharePercent)
      : schedule.baseRateCents;

  const scheduleForCalculation = {
    ...schedule,
    baseRateCents: baseShareCents,
  } as VisitCompSchedule;

  const addonSelection = extractVisitAddonSelection(metadataValue ?? null, {
    deodorize: visit.deodorize,
  });

  const mileageMiles = options?.mileageMiles ?? visit.routeShift?.actualMiles ?? 0;
  const densityBonus = options?.densityBonusCents ?? computeDensityBonus(visit.routeShift);
  const mileageRate = options?.mileageRateCents ?? DEFAULT_MILEAGE_RATE_CENTS;
  const ppeStipend = options?.ppeStipendCents ?? DEFAULT_PPE_STIPEND_CENTS;
  const tipsAmount = options?.tipsAmountCents ?? 0;

  const breakdown = calculateVisitPayoutBreakdown({
    schedule: scheduleForCalculation,
    addonSelection,
    mileageMiles,
    mileageRateCents: mileageRate,
    ppeStipendCents: ppeStipend,
    densityBonusCents: densityBonus,
    tipsCents: tipsAmount,
  });

  const vetDiagnosisBonusCents = resolveVetDiagnosisBonusCents(metadataValue ?? null);
  const bonusAmountCents = breakdown.bonusAmountCents + vetDiagnosisBonusCents;
  const totalAmountCents = breakdown.totalAmountCents + vetDiagnosisBonusCents;

  const payout = await client.visitPayout.upsert({
    where: { serviceVisitId: visitId },
    update: {
      orgId,
      scooperId: visit.assignedToId,
      scooperProfileId: await resolveScooperProfileId(client, visit.assignedToId),
      routeShiftId: visit.routeShiftId,
      compScheduleId: schedule.id,
      status: PayoutStatus.PENDING_REVIEW,
      baseAmountCents: breakdown.baseAmountCents,
      bonusAmountCents,
      mileageAmountCents: breakdown.mileageAmountCents,
      ppeAmountCents: breakdown.ppeAmountCents,
      tipsAmountCents: breakdown.tipsAmountCents,
      adjustmentsCents: 0,
      totalAmountCents,
      milesDriven: mileageMiles,
      metadata: {
        ...(metadataValue ?? {}),
        revenueCents: visit.revenueCents ?? null,
        frequency,
        sharePercent,
      },
    },
    create: {
      orgId,
      serviceVisitId: visitId,
      scooperId: visit.assignedToId,
      scooperProfileId: await resolveScooperProfileId(client, visit.assignedToId),
      routeShiftId: visit.routeShiftId,
      compScheduleId: schedule.id,
      status: PayoutStatus.PENDING_REVIEW,
      baseAmountCents: breakdown.baseAmountCents,
      bonusAmountCents,
      mileageAmountCents: breakdown.mileageAmountCents,
      ppeAmountCents: breakdown.ppeAmountCents,
      tipsAmountCents: breakdown.tipsAmountCents,
      adjustmentsCents: 0,
      totalAmountCents,
      milesDriven: mileageMiles,
      metadata: {
        ...(metadataValue ?? {}),
        revenueCents: visit.revenueCents ?? null,
        frequency,
        sharePercent,
      },
    },
  });

  await ensureLedgerEntry(client, {
    orgId,
    payoutId: payout.id,
    scooperId: visit.assignedToId,
    serviceVisitId: visitId,
    amountCents: totalAmountCents,
  });

  return payout;
}

function computeDensityBonus(routeShift?: {
  plannedStops: number;
  completedStops: number;
} | null) {
  if (!routeShift) return 0;
  const stops = routeShift.completedStops || routeShift.plannedStops || 0;
  if (stops >= 23) return 200; // $2.00 bonus
  if (stops >= 18) return 100; // $1.00 bonus
  return 0;
}

async function resolveScooperProfileId(
  client: Prisma.TransactionClient | typeof prisma,
  userId: string,
) {
  const profile = await client.scooperProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  return profile?.id ?? null;
}

async function ensureLedgerEntry(
  client: Prisma.TransactionClient | typeof prisma,
  options: {
    orgId: string;
    payoutId: string;
    scooperId: string;
    serviceVisitId: string;
    amountCents: number;
  },
) {
  const existing = await client.scooperLedgerEntry.findFirst({
    where: {
      payoutId: options.payoutId,
      type: LedgerEntryType.PAYOUT,
    },
  });

  if (existing) {
    await client.scooperLedgerEntry.update({
      where: { id: existing.id },
      data: {
        amountCents: options.amountCents,
        clearedAt: null,
      },
    });
    return;
  }

  await client.scooperLedgerEntry.create({
    data: {
      orgId: options.orgId,
      scooperId: options.scooperId,
      payoutId: options.payoutId,
      sourceVisitId: options.serviceVisitId,
      type: LedgerEntryType.PAYOUT,
      amountCents: options.amountCents,
      recordedAt: new Date(),
    },
  });
}

export function extractSharePercent(schedule: VisitCompSchedule) {
  const matrix = schedule.certificationMatrix as Record<string, unknown> | null;
  const shareValue = matrix?.defaultSharePercent;
  if (typeof shareValue === "number" && shareValue > 0 && shareValue < 1) {
    return shareValue;
  }
  return 0.45;
}

export function estimateVisitPayoutPreview(options: {
  schedule: VisitCompSchedule;
  revenueCents?: number | null;
  metadata?: Prisma.JsonValue | null;
  deodorize?: boolean | null;
  densityBonusCents?: number;
  mileageMiles?: number;
  mileageRateCents?: number;
  ppeStipendCents?: number;
  tipsCents?: number;
}) {
  const sharePercent = extractSharePercent(options.schedule);
  const baseShareCents =
    typeof options.revenueCents === "number" && options.revenueCents >= 0
      ? Math.round(options.revenueCents * sharePercent)
      : options.schedule.baseRateCents;

  const breakdown = calculateVisitPayoutBreakdown({
    schedule: {
      ...options.schedule,
      baseRateCents: baseShareCents,
    } as VisitCompSchedule,
    addonSelection: extractVisitAddonSelection(options.metadata ?? null, {
      deodorize: options.deodorize,
    }),
    densityBonusCents: options.densityBonusCents,
    mileageMiles: options.mileageMiles,
    mileageRateCents: options.mileageRateCents,
    ppeStipendCents: options.ppeStipendCents,
    tipsCents: options.tipsCents,
  });

  return {
    ...breakdown,
    sharePercent,
    baseShareCents,
  };
}

export async function releaseVisitPayout(payoutId: string) {
  const payout = await prisma.visitPayout.findUnique({
    where: { id: payoutId },
    include: {
      scooper: {
        select: {
          id: true,
          stripeConnectAccountId: true,
        },
      },
    },
  });

  if (!payout) {
    throw new Error("payout_not_found");
  }

  if (payout.status !== PayoutStatus.READY) {
    throw new Error("payout_not_ready");
  }

  if (!payout.totalAmountCents || payout.totalAmountCents <= 0) {
    throw new Error("payout_amount_invalid");
  }

  if (payout.stripeTransferId) {
    return payout;
  }

  const accountId = payout.scooper?.stripeConnectAccountId;
  if (!accountId) {
    throw new Error("payout_account_missing");
  }

  const status = await fetchStripeConnectStatus(accountId);
  if (!status.payoutsEnabled) {
    throw new Error("payouts_not_enabled");
  }

  const transfer = await createStripePayoutTransfer({
    payoutId: payout.id,
    amountCents: payout.totalAmountCents,
    destinationAccountId: accountId,
    scooperId: payout.scooperId,
    serviceVisitId: payout.serviceVisitId,
    orgId: payout.orgId,
  });

  const releasedAt = new Date();

  const updated = await prisma.visitPayout.update({
    where: { id: payout.id },
    data: {
      status: PayoutStatus.RELEASED,
      releasedAt,
      stripeTransferId: transfer.id,
      readyAt: payout.readyAt ?? releasedAt,
      clearedAt: payout.clearedAt ?? releasedAt,
    },
  });

  if (payout.scooperId) {
    void sendScooperPayoutReleasedPush({
      userId: payout.scooperId,
      amountCents: payout.totalAmountCents,
    }).catch(() => null);
  }

  return updated;
}
