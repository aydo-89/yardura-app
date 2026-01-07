import { Job, JobsOptions, Queue, Worker } from "bullmq";

import { getSiteUrl } from "@/lib/env";
import { sendCustomerEmailReport } from "@/lib/emails/customer-report";
import { prisma } from "@/lib/prisma";
import {
  EmailReportSections,
  buildCustomerEmailReportData,
  emailReportUtils,
  resolveReportPeriod,
} from "@/lib/reports/customer-email-report";
import { SERVICE_TIME_ZONE, convertUtcToZonedParts, getZonedWeekday } from "@/lib/timezone";

import {
  getRedisConnectionConfig,
  queueUnavailableReason,
  shouldAutoStartWorkers,
} from "./shared";

export interface CustomerEmailReportJobData {
  orgId: string;
}

const QUEUE_NAME = "customer-email-report-scheduler";
const REPORT_CRON = "5 * * * *";

type SchedulerState = {
  queue?: Queue<CustomerEmailReportJobData>;
  worker?: Worker<CustomerEmailReportJobData> | null;
  disabledLogged?: boolean;
};

const globalState = globalThis as typeof globalThis & {
  __customerEmailReportState?: SchedulerState;
};

if (!globalState.__customerEmailReportState) {
  globalState.__customerEmailReportState = {};
}

const state = globalState.__customerEmailReportState;

function logDisabledOnce(reason: string) {
  if (state.disabledLogged) return;
  state.disabledLogged = true;
  console.warn(`[jobs] ${QUEUE_NAME} queue disabled (${reason}); requests will be ignored`);
}

function getQueueInstance(): Queue<CustomerEmailReportJobData> | null {
  const disabledReason = queueUnavailableReason();
  if (disabledReason) {
    logDisabledOnce(disabledReason);
    return null;
  }

  if (!state.queue) {
    state.queue = new Queue<CustomerEmailReportJobData>(QUEUE_NAME, {
      connection: getRedisConnectionConfig(),
    });
  }

  return state.queue;
}

export async function scheduleRecurringCustomerEmailReports(orgId: string): Promise<void> {
  const queue = getQueueInstance();
  if (!queue) return;

  await queue.add(
    "sweep",
    { orgId },
    {
      jobId: `customer-email-report-${orgId}`,
      repeat: { pattern: REPORT_CRON, tz: SERVICE_TIME_ZONE },
      removeOnFail: 10,
    },
  );
}

export async function scheduleRecurringCustomerEmailReportsForAllOrgs(): Promise<void> {
  const queue = getQueueInstance();
  if (!queue) return;

  const orgs = await prisma.org.findMany({ select: { id: true } });
  await Promise.all(orgs.map((org) => scheduleRecurringCustomerEmailReports(org.id)));
}

function resolveRecipients(preference: { recipients: string[] }, fallback: Array<string | null | undefined>) {
  const combined = [...preference.recipients, ...fallback].filter(Boolean) as string[];
  return emailReportUtils.sanitizeEmailList(combined);
}

function shouldSendThisHour(preference: { sendHour: number }, hour: number) {
  return preference.sendHour === hour;
}

function shouldSendThisDay(options: {
  cadence: "WEEKLY" | "MONTHLY";
  dayOfWeek: number;
  dayOfMonth: number;
  now: Date;
  timeZone: string;
}) {
  const { cadence, dayOfWeek, dayOfMonth, now, timeZone } = options;
  const parts = convertUtcToZonedParts(now, timeZone);
  if (cadence === "WEEKLY") {
    const weekday = getZonedWeekday(now, timeZone);
    return weekday === dayOfWeek;
  }

  const daysInMonth = new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate();
  const targetDay = Math.min(Math.max(dayOfMonth, 1), daysInMonth);
  return parts.day === targetDay;
}

async function processCustomerEmailReports(orgId: string) {
  const now = new Date();
  const preferences = await prisma.customerEmailReportPreference.findMany({
    where: { orgId, enabled: true },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          user: { select: { email: true } },
        },
      },
    },
  });

  if (!preferences.length) {
    return { processed: 0, sent: 0 };
  }

  let sent = 0;
  const baseUrl = getSiteUrl();
  const dashboardUrl = `${baseUrl}/mobile/dashboard/wellness`;
  const manageUrl = `${baseUrl}/mobile/dashboard/account`;

  for (const preference of preferences) {
    const timeZone = preference.timeZone ?? SERVICE_TIME_ZONE;
    const parts = convertUtcToZonedParts(now, timeZone);
    if (!shouldSendThisHour(preference, parts.hour)) continue;

    if (
      !shouldSendThisDay({
        cadence: preference.cadence,
        dayOfWeek: preference.dayOfWeek,
        dayOfMonth: preference.dayOfMonth,
        now,
        timeZone,
      })
    ) {
      continue;
    }

    const period = resolveReportPeriod({
      cadence: preference.cadence,
      now,
      timeZone,
    });

    if (preference.lastPeriodKey === period.periodKey) {
      continue;
    }

    const recipients = resolveRecipients(preference, [
      preference.customer?.email,
      preference.customer?.user?.email,
    ]);
    if (!recipients.length) continue;

    const sections: EmailReportSections = {
      includeWellness: preference.includeWellness,
      includeScooping: preference.includeScooping,
      includeFood: preference.includeFood,
      includeWalks: preference.includeWalks,
      includeReminders: preference.includeReminders,
      includeChats: preference.includeChats,
      includePhotos: preference.includePhotos,
    };

    try {
      const report = await buildCustomerEmailReportData({
        orgId,
        customerId: preference.customerId,
        period,
        sections,
      });
      if (!report) continue;

      await sendCustomerEmailReport({
        report,
        recipients,
        dashboardUrl,
        manageUrl,
      });

      sent += 1;
      await prisma.customerEmailReportPreference.update({
        where: { id: preference.id },
        data: { lastSentAt: new Date(), lastPeriodKey: period.periodKey },
      });
    } catch (error) {
      console.error("[CustomerEmailReport] send failed", {
        customerId: preference.customerId,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  return { processed: preferences.length, sent };
}

export function startCustomerEmailReportWorker(): Worker<CustomerEmailReportJobData> | null {
  if (state.worker) return state.worker;

  const disabledReason = queueUnavailableReason();
  if (disabledReason) {
    logDisabledOnce(disabledReason);
    return null;
  }

  const worker = new Worker<CustomerEmailReportJobData>(
    QUEUE_NAME,
    async (job: Job<CustomerEmailReportJobData>) => processCustomerEmailReports(job.data.orgId),
    {
      connection: getRedisConnectionConfig(),
    },
  );

  worker.on("completed", (job, result) => {
    console.log("[CustomerEmailReport] completed", job.id, JSON.stringify(result));
  });

  worker.on("failed", (job, err) => {
    console.error("[CustomerEmailReport] failed", job?.id, err);
  });

  state.worker = worker;
  void scheduleRecurringCustomerEmailReportsForAllOrgs().catch((err) => {
    console.error("[CustomerEmailReport] schedule failed", err);
  });

  return worker;
}

if (shouldAutoStartWorkers()) {
  startCustomerEmailReportWorker();
}
