import { Queue, Worker, Job, JobsOptions } from "bullmq";
import { CommunicationChannel, CommunicationStatus, JobStatus, ServiceStatus } from "@prisma/client";
import { addDays, subMilliseconds } from "date-fns";

import { prisma } from "@/lib/prisma";
import {
  sendPushToUsers,
  sendCustomerVisitReminderPush,
  sendCustomerReminderDuePush,
  sendCustomerParasiteRiskPush,
} from "@/lib/notifications/push";
import { getWeekWindow } from "@/lib/wellness/reports";
import { SERVICE_TIME_ZONE, constructZonedDate, convertUtcToZonedParts } from "@/lib/timezone";
import { resolvePreferredTimeWindowLabel } from "@/lib/time-window";
import { createVisitCommunication, updateVisitCommunicationStatus } from "@/lib/service-visits/communications";
import { getParasiteRiskForState } from "@/data/parasite-risk";

import {
  getRedisConnectionConfig,
  queueUnavailableReason,
  shouldAutoStartWorkers,
} from "./shared";

export type PushReminderKind =
  | "scooper-daily-checkin"
  | "customer-weekly-checkin"
  | "customer-visit-today"
  | "customer-visit-tomorrow"
  | "customer-reminder-due"
  | "customer-parasite-risk";

export interface PushReminderJobData {
  orgId: string;
  kind: PushReminderKind;
}

const QUEUE_NAME = "push-notification-scheduler";
const DAILY_CHECKIN_CRON = "0 7 * * *";
const WEEKLY_CHECKIN_CRON = "0 10 * * 1";
const VISIT_TODAY_CRON = "15 7 * * *";
const VISIT_TOMORROW_CRON = "0 18 * * *";
const REMINDER_DUE_CRON = "30 8 * * *";
const PARASITE_RISK_CRON = "0 9 1 * *";

type ModuleState = {
  queue?: Queue<PushReminderJobData>;
  worker?: Worker<PushReminderJobData> | null;
  disabledLogged?: boolean;
};

const globalState = globalThis as typeof globalThis & {
  __pushNotificationSchedulerState?: ModuleState;
};

if (!globalState.__pushNotificationSchedulerState) {
  globalState.__pushNotificationSchedulerState = {};
}

const state = globalState.__pushNotificationSchedulerState;

function logDisabledOnce(reason: string) {
  if (state.disabledLogged) return;
  state.disabledLogged = true;
  console.warn(`[jobs] ${QUEUE_NAME} queue disabled (${reason}); requests will be ignored`);
}

function getQueueInstance(): Queue<PushReminderJobData> | null {
  const disabledReason = queueUnavailableReason();
  if (disabledReason) {
    logDisabledOnce(disabledReason);
    return null;
  }

  if (!state.queue) {
    state.queue = new Queue<PushReminderJobData>(QUEUE_NAME, {
      connection: getRedisConnectionConfig(),
    });
  }

  return state.queue;
}

export async function enqueuePushReminder(
  data: PushReminderJobData,
  options?: JobsOptions,
): Promise<void> {
  const queue = getQueueInstance();
  if (!queue) return;

  await queue.add("reminder", data, {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 2,
    ...options,
  });
}

export async function scheduleRecurringPushReminders(orgId: string): Promise<void> {
  const queue = getQueueInstance();
  if (!queue) return;

  await queue.add(
    "reminder",
    { orgId, kind: "scooper-daily-checkin" },
    {
      jobId: `daily-checkin-${orgId}`,
      repeat: {
        pattern: DAILY_CHECKIN_CRON,
        tz: SERVICE_TIME_ZONE,
      },
      removeOnFail: 20,
    },
  );

  await queue.add(
    "reminder",
    { orgId, kind: "customer-weekly-checkin" },
    {
      jobId: `weekly-checkin-${orgId}`,
      repeat: {
        pattern: WEEKLY_CHECKIN_CRON,
        tz: SERVICE_TIME_ZONE,
      },
      removeOnFail: 20,
    },
  );

  await queue.add(
    "reminder",
    { orgId, kind: "customer-visit-today" },
    {
      jobId: `visit-today-${orgId}`,
      repeat: {
        pattern: VISIT_TODAY_CRON,
        tz: SERVICE_TIME_ZONE,
      },
      removeOnFail: 20,
    },
  );

  await queue.add(
    "reminder",
    { orgId, kind: "customer-visit-tomorrow" },
    {
      jobId: `visit-tomorrow-${orgId}`,
      repeat: {
        pattern: VISIT_TOMORROW_CRON,
        tz: SERVICE_TIME_ZONE,
      },
      removeOnFail: 20,
    },
  );

  await queue.add(
    "reminder",
    { orgId, kind: "customer-reminder-due" },
    {
      jobId: `reminder-due-${orgId}`,
      repeat: {
        pattern: REMINDER_DUE_CRON,
        tz: SERVICE_TIME_ZONE,
      },
      removeOnFail: 20,
    },
  );

  await queue.add(
    "reminder",
    { orgId, kind: "customer-parasite-risk" },
    {
      jobId: `parasite-risk-${orgId}`,
      repeat: {
        pattern: PARASITE_RISK_CRON,
        tz: SERVICE_TIME_ZONE,
      },
      removeOnFail: 20,
    },
  );
}

export async function scheduleRecurringPushRemindersForAllOrgs(): Promise<void> {
  const queue = getQueueInstance();
  if (!queue) return;

  const orgs = await prisma.org.findMany({
    select: { id: true },
  });

  await Promise.all(orgs.map((org) => scheduleRecurringPushReminders(org.id)));
}

function getServiceDayWindow(now: Date) {
  const parts = convertUtcToZonedParts(now, SERVICE_TIME_ZONE);
  const start = constructZonedDate(parts.year, parts.month, parts.day, 0, 0, 0, 0, SERVICE_TIME_ZONE);
  const end = constructZonedDate(parts.year, parts.month, parts.day, 23, 59, 59, 999, SERVICE_TIME_ZONE);
  return { start, end };
}

function getServiceDayWindowWithOffset(now: Date, offsetDays: number) {
  const parts = convertUtcToZonedParts(now, SERVICE_TIME_ZONE);
  const base = constructZonedDate(parts.year, parts.month, parts.day, 0, 0, 0, 0, SERVICE_TIME_ZONE);
  const start = addDays(base, offsetDays);
  const end = subMilliseconds(addDays(base, offsetDays + 1), 1);
  return { start, end };
}

function getServiceMonthContext(now: Date) {
  const parts = convertUtcToZonedParts(now, SERVICE_TIME_ZONE);
  const monthStart = constructZonedDate(parts.year, parts.month, 1, 0, 0, 0, 0, SERVICE_TIME_ZONE);
  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: SERVICE_TIME_ZONE,
  }).format(monthStart);
  return {
    monthIndex: parts.month - 1,
    monthStart,
    monthLabel,
  };
}

async function sendDailyScooperCheckIn(orgId: string) {
  const { start, end } = getServiceDayWindow(new Date());
  const visits = await prisma.serviceVisit.findMany({
    where: {
      orgId,
      assignedToId: { not: null },
      status: { in: [ServiceStatus.SCHEDULED, ServiceStatus.IN_PROGRESS] },
      scheduledDate: { gte: start, lte: end },
    },
    select: { assignedToId: true },
  });

  const userIds = Array.from(
    new Set(
      visits
        .map((visit) => visit.assignedToId)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  if (!userIds.length) {
    return { targeted: 0, sent: 0 };
  }

  const checks = await prisma.scooperDailyCheck.findMany({
    where: {
      userId: { in: userIds },
      capturedAt: { gte: start, lte: end },
    },
    select: { userId: true },
  });

  const checkedIds = new Set(checks.map((check) => check.userId));
  const missing = userIds.filter((id) => !checkedIds.has(id));

  if (!missing.length) {
    return { targeted: userIds.length, sent: 0 };
  }

  const result = await sendPushToUsers(missing, {
    title: "Daily check-in needed",
    body: "Complete your gear check to unlock today’s route.",
    data: { href: "/(app)/(scooper)/daily-check", kind: "scooper-daily-checkin" },
    channelId: "visits",
  });

  return { targeted: userIds.length, sent: result.sent };
}

async function sendWeeklyCustomerCheckIn(orgId: string) {
  const now = new Date();
  const { weekStart } = getWeekWindow(now);
  const customers = await prisma.customer.findMany({
    where: {
      orgId,
      userId: { not: null },
      jobs: { some: { status: JobStatus.ACTIVE } },
    },
    select: { id: true, userId: true },
  });

  if (!customers.length) {
    return { targeted: 0, sent: 0 };
  }

  const reports = await prisma.weeklyWellnessReport.findMany({
    where: {
      customerId: { in: customers.map((customer) => customer.id) },
      weekStart,
    },
    select: { customerId: true },
  });

  const reported = new Set(reports.map((report) => report.customerId));
  const missingUserIds = customers
    .filter((customer) => !reported.has(customer.id) && customer.userId)
    .map((customer) => customer.userId as string);

  if (!missingUserIds.length) {
    return { targeted: customers.length, sent: 0 };
  }

  const result = await sendPushToUsers(missingUserIds, {
    title: "Weekly wellness check-in",
    body: "Share this week’s pet wellness update to earn care credits.",
    data: { href: "/(app)/(customer)/check-in", kind: "customer-weekly-checkin" },
    channelId: "wellness",
  });

  return { targeted: customers.length, sent: result.sent };
}

async function sendCustomerVisitReminders(orgId: string, offsetDays: number) {
  const now = new Date();
  const { start, end } = getServiceDayWindowWithOffset(now, offsetDays);
  const templateId = offsetDays === 0 ? "visit_reminder_today_push" : "visit_reminder_tomorrow_push";

  const visits = await prisma.serviceVisit.findMany({
    where: {
      orgId,
      status: ServiceStatus.SCHEDULED,
      scheduledDate: { gte: start, lte: end },
      customer: { userId: { not: null } },
    },
    select: {
      id: true,
      scheduledDate: true,
      preferredTimeWindow: true,
      preferredTimeWindowSlug: true,
      customer: {
        select: {
          userId: true,
        },
      },
      communications: {
        where: {
          channel: CommunicationChannel.PUSH,
          templateId,
        },
        select: { id: true },
      },
    },
  });

  let sent = 0;
  for (const visit of visits) {
    if (!visit.customer?.userId) continue;
    if (visit.communications.length) continue;

    const preferredLabel = resolvePreferredTimeWindowLabel(
      visit.preferredTimeWindowSlug ?? null,
      visit.preferredTimeWindow ?? null,
    );

    const communication = await createVisitCommunication({
      serviceVisitId: visit.id,
      channel: CommunicationChannel.PUSH,
      templateId,
      messageBody: "visit reminder",
      status: CommunicationStatus.PENDING,
    });

    const result = await sendCustomerVisitReminderPush({
      userId: visit.customer.userId,
      scheduledDate: visit.scheduledDate,
      preferredWindowLabel: preferredLabel ?? null,
      kind: offsetDays === 0 ? "visit_today" : "visit_tomorrow",
    });

    const status = result.sent > 0 ? CommunicationStatus.SENT : CommunicationStatus.FAILED;
    await updateVisitCommunicationStatus({
      id: communication.id,
      status,
      statusDetail: status === CommunicationStatus.SENT ? "sent" : "push_failed",
      sentAt: new Date(),
    });

    if (status === CommunicationStatus.SENT) {
      sent += 1;
    }
  }

  return { targeted: visits.length, sent };
}

async function sendCustomerReminderDue(orgId: string) {
  const { start, end } = getServiceDayWindow(new Date());
  const reminders = await prisma.customerWellnessReminder.findMany({
    where: {
      orgId,
      active: true,
      nextDueAt: { gte: start, lte: end },
      customer: { userId: { not: null } },
      OR: [
        { lastNotifiedAt: null },
        { lastNotifiedAt: { lt: start } },
      ],
    },
    select: {
      id: true,
      title: true,
      nextDueAt: true,
      lastNotifiedAt: true,
      customer: { select: { userId: true } },
      dog: { select: { name: true } },
    },
  });

  let sent = 0;
  for (const reminder of reminders) {
    if (!reminder.customer?.userId) continue;
    const dueLabel = reminder.nextDueAt
      ? new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
        }).format(reminder.nextDueAt)
      : null;

    const result = await sendCustomerReminderDuePush({
      userId: reminder.customer.userId,
      title: reminder.title,
      dueLabel,
      dogName: reminder.dog?.name ?? null,
    });

    if (result.sent > 0) {
      sent += 1;
      await prisma.customerWellnessReminder.update({
        where: { id: reminder.id },
        data: { lastNotifiedAt: new Date() },
      });
    }
  }

  return { targeted: reminders.length, sent };
}

async function sendCustomerParasiteRiskNudges(orgId: string) {
  const now = new Date();
  const { monthIndex, monthStart, monthLabel } = getServiceMonthContext(now);

  const customers = await prisma.customer.findMany({
    where: {
      orgId,
      userId: { not: null },
      parasiteRiskNotificationsEnabled: true,
      jobs: { some: { status: JobStatus.ACTIVE } },
      OR: [
        { parasiteRiskLastNotifiedAt: null },
        { parasiteRiskLastNotifiedAt: { lt: monthStart } },
      ],
    },
    select: { id: true, userId: true, state: true },
  });

  let targeted = 0;
  let sent = 0;

  for (const customer of customers) {
    if (!customer.userId) continue;
    const calendar = getParasiteRiskForState(customer.state);
    const entry = calendar[monthIndex];
    const fleasTicksHigh = entry?.fleasTicks === "HIGH";
    const heartwormHigh = entry?.heartworm === "HIGH";
    if (!fleasTicksHigh && !heartwormHigh) continue;

    targeted += 1;
    const result = await sendCustomerParasiteRiskPush({
      userId: customer.userId,
      fleasTicksHigh,
      heartwormHigh,
      monthLabel,
    });

    if (result.sent > 0) {
      sent += result.sent;
      await prisma.customer.update({
        where: { id: customer.id },
        data: { parasiteRiskLastNotifiedAt: now },
      });
    }
  }

  return { targeted, sent };
}

export function startPushNotificationWorker(): Worker<PushReminderJobData> | null {
  if (state.worker) {
    return state.worker;
  }

  const disabledReason = queueUnavailableReason();
  if (disabledReason) {
    logDisabledOnce(disabledReason);
    return null;
  }

  const connection = getRedisConnectionConfig();
  const worker = new Worker<PushReminderJobData>(
    QUEUE_NAME,
    async (job: Job<PushReminderJobData>) => {
      if (job.data.kind === "scooper-daily-checkin") {
        return sendDailyScooperCheckIn(job.data.orgId);
      }

      if (job.data.kind === "customer-weekly-checkin") {
        return sendWeeklyCustomerCheckIn(job.data.orgId);
      }

      if (job.data.kind === "customer-visit-today") {
        return sendCustomerVisitReminders(job.data.orgId, 0);
      }

      if (job.data.kind === "customer-visit-tomorrow") {
        return sendCustomerVisitReminders(job.data.orgId, 1);
      }

      if (job.data.kind === "customer-reminder-due") {
        return sendCustomerReminderDue(job.data.orgId);
      }

      if (job.data.kind === "customer-parasite-risk") {
        return sendCustomerParasiteRiskNudges(job.data.orgId);
      }

      return { targeted: 0, sent: 0 };
    },
    { connection },
  );

  worker.on("completed", (job, result) => {
    console.log("[PushReminderWorker] completed", job.id, JSON.stringify(result));
  });

  worker.on("failed", (job, err) => {
    console.error("[PushReminderWorker] failed", job?.id, err);
  });

  state.worker = worker;
  void scheduleRecurringPushRemindersForAllOrgs().catch((err) => {
    console.error("[PushReminderWorker] schedule failed", err);
  });

  return worker;
}

if (shouldAutoStartWorkers()) {
  startPushNotificationWorker();
}
