import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import { ScooperStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import {
  formatServiceDate,
  resolvePreferredTimeWindowRange,
} from '@/lib/time-window';

const expo = new Expo();

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
};

type PushResult = {
  sent: number;
  disabled: number;
};

async function sendPushTokens(
  tokens: { id: string; token: string }[],
  payload: PushPayload,
): Promise<PushResult> {
  const messages: ExpoPushMessage[] = [];
  const tokenIdByValue = new Map<string, string>();

  tokens.forEach((entry) => {
    if (!Expo.isExpoPushToken(entry.token)) {
      return;
    }
    tokenIdByValue.set(entry.token, entry.id);
    messages.push({
      to: entry.token,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      sound: 'default',
      channelId: payload.channelId ?? 'default',
    });
  });

  if (!messages.length) {
    return { sent: 0, disabled: 0 };
  }

  const chunks = expo.chunkPushNotifications(messages);
  const invalidTokenIds: string[] = [];
  let sent = 0;

  for (const chunk of chunks) {
    const tickets = await expo.sendPushNotificationsAsync(chunk);
    tickets.forEach((ticket, index) => {
      if (ticket.status === 'ok') {
        sent += 1;
        return;
      }

      const tokenRaw = chunk[index]?.to;
      const token = Array.isArray(tokenRaw) ? tokenRaw[0] : tokenRaw;
      const tokenId = token ? tokenIdByValue.get(token) : null;
      if (!tokenId) return;
      const errorCode =
        typeof ticket.details === 'object' && ticket.details
          ? (ticket.details as { error?: string }).error
          : null;
      if (errorCode === 'DeviceNotRegistered') {
        invalidTokenIds.push(tokenId);
      }
    });
  }

  if (invalidTokenIds.length) {
    await prisma.userPushToken.updateMany({
      where: { id: { in: invalidTokenIds } },
      data: { disabledAt: new Date() },
    });
  }

  return { sent, disabled: invalidTokenIds.length };
}

export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<PushResult> {
  if (!userIds.length) return { sent: 0, disabled: 0 };
  const tokens = await prisma.userPushToken.findMany({
    where: {
      userId: { in: userIds },
      disabledAt: null,
      user: { pushNotificationsEnabled: true },
    },
    select: {
      id: true,
      token: true,
    },
  });
  return sendPushTokens(tokens, payload);
}

export async function sendScooperOfferPush(options: {
  orgId: string;
  tileId: string;
  offerCount: number;
}): Promise<PushResult> {
  const { orgId, tileId, offerCount } = options;
  const availabilities = await prisma.scooperAvailability.findMany({
    where: {
      orgId,
      tileId,
      scooper: { status: ScooperStatus.CERTIFIED },
    },
    select: {
      scooper: {
        select: {
          userId: true,
        },
      },
    },
  });

  const userIds = Array.from(
    new Set(
      availabilities
        .map((entry) => entry.scooper.userId)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  if (!userIds.length) {
    return { sent: 0, disabled: 0 };
  }

  const title = 'New job offer';
  const body =
    offerCount === 1
      ? 'A new visit is available in your coverage area.'
      : `${offerCount} new visits are available in your coverage area.`;

  return sendPushToUsers(userIds, {
    title,
    body,
    data: { href: '/(app)/(scooper)/offers' },
    channelId: 'offers',
  });
}

export async function sendScooperDirectOfferPush(options: {
  userId: string;
  scheduledDate?: Date | null;
  windowLabel?: string | null;
}): Promise<PushResult> {
  const { userId, scheduledDate, windowLabel } = options;
  const dateLabel = scheduledDate
    ? new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }).format(scheduledDate)
    : 'Upcoming visit';
  const windowText = windowLabel ? ` • ${windowLabel}` : '';

  return sendPushToUsers([userId], {
    title: 'Priority offer ready',
    body: `You’re up next for ${dateLabel}${windowText}. Review to accept or decline.`,
    data: { href: '/(app)/(scooper)/offers', kind: 'direct_offer' },
    channelId: 'offers',
  });
}

export async function sendCustomerDelayPush(options: {
  userId: string;
  scheduledDate?: Date | null;
  windowLabel?: string | null;
}): Promise<PushResult> {
  const { userId, scheduledDate, windowLabel } = options;
  const dateLabel = scheduledDate
    ? new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }).format(scheduledDate)
    : 'Upcoming visit';
  const windowText = windowLabel ? ` • ${windowLabel}` : '';

  return sendPushToUsers([userId], {
    title: 'Visit window updated',
    body: `We’re shifting your visit to ${dateLabel}${windowText}. We’ll confirm your scooper soon.`,
    data: { href: '/(app)/(customer)/visits', kind: 'visit_delay' },
    channelId: 'visits',
  });
}

export async function sendCustomerVisitReminderPush(options: {
  userId: string;
  scheduledDate: Date;
  preferredWindowLabel?: string | null;
  kind: 'visit_today' | 'visit_tomorrow';
}): Promise<PushResult> {
  const { userId, scheduledDate, preferredWindowLabel, kind } = options;
  const dateLabel =
    formatServiceDate(scheduledDate, { weekday: 'short', month: 'short', day: 'numeric' }) ||
    'Upcoming visit';
  const windowLabel = resolvePreferredTimeWindowRange(null, preferredWindowLabel) ?? null;
  const windowText = windowLabel ? ` • ${windowLabel}` : '';
  const isToday = kind === 'visit_today';

  return sendPushToUsers([userId], {
    title: isToday ? 'Visit today' : 'Visit tomorrow',
    body: `${isToday ? 'Today' : 'Tomorrow'}: ${dateLabel}${windowText}.`,
    data: { href: '/(app)/(customer)/visits', kind },
    channelId: 'visits',
  });
}

export async function sendCustomerOnTheWayPush(options: {
  userId: string;
  scheduledDate?: Date | null;
  preferredWindowLabel?: string | null;
  etaMinutes?: number | null;
  technicianName?: string | null;
}): Promise<PushResult> {
  const { userId, scheduledDate, preferredWindowLabel, etaMinutes, technicianName } = options;
  const windowLabel = resolvePreferredTimeWindowRange(null, preferredWindowLabel) ?? null;
  const windowText = windowLabel ? ` • ${windowLabel}` : '';
  const etaText = etaMinutes ? `ETA ${etaMinutes} min` : 'Arriving soon';
  const nameText = technicianName ? ` with ${technicianName}` : '';
  const dateLabel =
    scheduledDate &&
    formatServiceDate(scheduledDate, { weekday: 'short', month: 'short', day: 'numeric' });
  const dateText = dateLabel ? `${dateLabel}${windowText}` : windowText;

  return sendPushToUsers([userId], {
    title: `Scooper on the way${nameText}`,
    body: `${etaText}${dateText ? ` • ${dateText}` : ''}`,
    data: { href: '/(app)/(customer)/visits', kind: 'visit_on_the_way' },
    channelId: 'visits',
  });
}

export async function sendCustomerVisitCompletePush(options: {
  userId: string;
  scheduledDate?: Date | null;
}): Promise<PushResult> {
  const { userId, scheduledDate } = options;
  const dateLabel =
    scheduledDate &&
    formatServiceDate(scheduledDate, { weekday: 'short', month: 'short', day: 'numeric' });

  return sendPushToUsers([userId], {
    title: 'Visit complete',
    body: `Your yard recap is ready${dateLabel ? ` • ${dateLabel}` : ''}.`,
    data: { href: '/(app)/(customer)/visits', kind: 'visit_complete' },
    channelId: 'visits',
  });
}

export async function sendCustomerReminderDuePush(options: {
  userId: string;
  title: string;
  dueLabel?: string | null;
  dogName?: string | null;
}): Promise<PushResult> {
  const { userId, title, dueLabel, dogName } = options;
  const dogText = dogName ? ` for ${dogName}` : '';
  const dueText = dueLabel ? ` • due ${dueLabel}` : '';

  return sendPushToUsers([userId], {
    title: 'Reminder due',
    body: `${title}${dogText}${dueText}.`,
    data: { href: '/(app)/(customer)/reminders', kind: 'reminder_due' },
    channelId: 'reminders',
  });
}

export async function sendCustomerParasiteRiskPush(options: {
  userId: string;
  fleasTicksHigh: boolean;
  heartwormHigh: boolean;
  monthLabel?: string | null;
}): Promise<PushResult> {
  const { userId, fleasTicksHigh, heartwormHigh, monthLabel } = options;
  const riskParts = [
    fleasTicksHigh ? 'fleas & ticks' : null,
    heartwormHigh ? 'heartworm' : null,
  ].filter((part): part is string => Boolean(part));
  const riskLabel = riskParts.length ? riskParts.join(' and ') : 'parasite';
  const monthText = monthLabel ? ` in ${monthLabel}` : '';

  return sendPushToUsers([userId], {
    title: 'High parasite risk',
    body: `High ${riskLabel} activity${monthText}. Stay on prevention.`,
    data: { href: '/(app)/(customer)/wellness-parasite-risk', kind: 'parasite_risk' },
    channelId: 'wellness',
  });
}

export async function sendScooperVisitUpdatePush(options: {
  userId: string;
  scheduledDate?: Date | null;
  action: 'rescheduled' | 'skipped';
}): Promise<PushResult> {
  const { userId, scheduledDate, action } = options;
  const dateLabel =
    scheduledDate &&
    formatServiceDate(scheduledDate, { weekday: 'short', month: 'short', day: 'numeric' });
  const actionLabel = action === 'rescheduled' ? 'rescheduled' : 'skipped';

  return sendPushToUsers([userId], {
    title: 'Visit updated',
    body: `A visit was ${actionLabel}${dateLabel ? ` • ${dateLabel}` : ''}.`,
    data: { href: '/(app)/(scooper)', kind: 'visit_update' },
    channelId: 'visits',
  });
}

export async function sendScooperPayoutReleasedPush(options: {
  userId: string;
  amountCents?: number | null;
}): Promise<PushResult> {
  const { userId, amountCents } = options;
  const amountLabel =
    typeof amountCents === 'number' && Number.isFinite(amountCents)
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amountCents / 100)
      : 'Your payout';

  return sendPushToUsers([userId], {
    title: 'Payout released',
    body: `${amountLabel} is on the way.`,
    data: { href: '/(app)/(scooper)/earnings', kind: 'payout_released' },
    channelId: 'payouts',
  });
}

export async function sendScooperTipReceivedPush(options: {
  userId: string;
  amountCents: number;
  customerName?: string | null;
  visitId?: string | null;
}): Promise<PushResult> {
  const { userId, amountCents, customerName, visitId } = options;
  const amountLabel = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amountCents / 100);
  const nameLabel = customerName ? ` from ${customerName}` : '';

  return sendPushToUsers([userId], {
    title: 'Tip received',
    body: `${amountLabel} tip${nameLabel}.`,
    data: { href: '/(app)/(scooper)/earnings', kind: 'tip_received', visitId },
    channelId: 'payouts',
  });
}

export async function sendSalesLeadAssignedPush(options: {
  userId: string;
  customerName?: string | null;
  city?: string | null;
  state?: string | null;
}): Promise<PushResult> {
  const { userId, customerName, city, state } = options;
  const location = [city, state].filter(Boolean).join(', ');
  const detail = customerName ? `New lead: ${customerName}` : 'New lead assigned';
  const locationText = location ? ` • ${location}` : '';

  return sendPushToUsers([userId], {
    title: 'Lead assigned',
    body: `${detail}${locationText}.`,
    data: { href: '/(app)/(sales)', kind: 'lead_assigned' },
    channelId: 'default',
  });
}

export async function sendAdminScooperApplicationPush(options: {
  userIds: string[];
  applicantName?: string | null;
  homeBase?: string | null;
}): Promise<PushResult> {
  const { userIds, applicantName, homeBase } = options;
  if (!userIds.length) return { sent: 0, disabled: 0 };
  const nameLabel = applicantName ? `New applicant: ${applicantName}` : 'New scooper application';
  const locationText = homeBase ? ` • ${homeBase}` : '';

  return sendPushToUsers(userIds, {
    title: 'Scooper application',
    body: `${nameLabel}${locationText}.`,
    data: { href: '/(app)/(admin)', kind: 'scooper_application' },
    channelId: 'default',
  });
}

export async function sendAdminPayoutRequestPush(options: {
  userIds: string[];
  scooperName?: string | null;
  amountCents?: number | null;
}): Promise<PushResult> {
  const { userIds, scooperName, amountCents } = options;
  if (!userIds.length) return { sent: 0, disabled: 0 };
  const amountLabel =
    typeof amountCents === 'number' && Number.isFinite(amountCents)
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amountCents / 100)
      : 'New';
  const nameLabel = scooperName ? `from ${scooperName}` : 'from a scooper';

  return sendPushToUsers(userIds, {
    title: 'Payout request',
    body: `${amountLabel} request ${nameLabel}.`,
    data: { href: '/(app)/(admin)', kind: 'payout_request' },
    channelId: 'payouts',
  });
}
