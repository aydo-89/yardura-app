import { NextRequest, NextResponse } from 'next/server';
import { WellnessPlanStatus } from '@prisma/client';

import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';

const resolveAuthHeader = (request: NextRequest): string | null => {
  return (
    request.headers.get('authorization') ||
    request.headers.get('x-revenuecat-authorization') ||
    request.headers.get('x-webhook-authorization')
  );
};

const isAuthorized = (request: NextRequest): boolean => {
  const secret = env.REVENUECAT_WEBHOOK_SECRET;
  if (!secret) return true;
  const header = resolveAuthHeader(request);
  if (!header) return false;
  if (header === secret) return true;
  return header === `Bearer ${secret}`;
};

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' && !/^\d+$/.test(value)) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const ms = numeric < 1e12 ? numeric * 1000 : numeric;
  const parsed = new Date(ms);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const resolvePlanStatus = (eventType: string, endsAt: Date | null, now: Date) => {
  const normalized = eventType.toUpperCase();
  if (normalized === 'EXPIRATION') return WellnessPlanStatus.CANCELED;
  if (normalized === 'BILLING_ISSUE' || normalized === 'SUBSCRIPTION_PAUSED') {
    return WellnessPlanStatus.PAUSED;
  }
  if (endsAt && endsAt <= now) return WellnessPlanStatus.CANCELED;
  return WellnessPlanStatus.ACTIVE;
};

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let payload: any = null;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const event = payload?.event ?? payload;
  if (!event) {
    return NextResponse.json({ ok: false, error: 'Missing event' }, { status: 400 });
  }

  const appUserId =
    event.app_user_id ?? event.appUserId ?? event.subscriber?.app_user_id ?? null;
  if (!appUserId) {
    return NextResponse.json({ ok: true, skipped: 'missing_app_user_id' });
  }

  const entitlementIds = Array.isArray(event.entitlement_ids)
    ? event.entitlement_ids
    : [];
  const entitlementId = event.entitlement_id ?? event.entitlementId ?? null;
  const premiumEntitlement = env.REVENUECAT_PREMIUM_ENTITLEMENT_ID;
  if (
    premiumEntitlement &&
    entitlementId !== premiumEntitlement &&
    !entitlementIds.includes(premiumEntitlement)
  ) {
    return NextResponse.json({ ok: true, skipped: 'non_premium_entitlement' });
  }

  const customer = await prisma.customer.findFirst({
    where: { userId: appUserId },
    select: { id: true, orgId: true },
  });

  if (!customer) {
    return NextResponse.json({ ok: true, skipped: 'customer_not_found' });
  }

  const startedAt =
    toDate(
      event.purchased_at_ms ??
        event.original_purchase_date_ms ??
        event.purchased_at ??
        event.event_timestamp_ms,
    ) ?? new Date();
  const endsAt =
    toDate(event.expiration_at_ms ?? event.expires_at_ms ?? event.expiration_at) ??
    null;

  const now = new Date();
  const eventType = String(event.type ?? '');
  const status = resolvePlanStatus(eventType, endsAt, now);

  const existingPlan = await prisma.customerWellnessPlan.findFirst({
    where: {
      customerId: customer.id,
      revenueCatAppUserId: appUserId,
    },
    orderBy: { startedAt: 'desc' },
  });

  const planData = {
    status,
    endsAt,
    revenueCatAppUserId: appUserId,
    revenueCatOriginalAppUserId: event.original_app_user_id ?? null,
    revenueCatEntitlementId: entitlementId,
    revenueCatProductId: event.product_id ?? null,
    revenueCatStore: event.store ?? null,
  };

  if (existingPlan) {
    await prisma.customerWellnessPlan.update({
      where: { id: existingPlan.id },
      data: planData,
    });
  } else {
    await prisma.customerWellnessPlan.create({
      data: {
        orgId: customer.orgId,
        customerId: customer.id,
        tier: 'PREMIUM',
        source: 'DIRECT',
        startedAt,
        ...planData,
      },
    });
  }

  return NextResponse.json({ ok: true });
}

export const runtime = 'nodejs';
