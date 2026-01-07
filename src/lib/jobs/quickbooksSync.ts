import { Prisma } from "@prisma/client";
import { Job, JobsOptions, Queue, Worker } from "bullmq";

import { getQuickBooksSettings, updateBusinessConfig } from "@/lib/business-config";
import { prisma } from "@/lib/prisma";
import { info, warn } from "@/lib/log";

import {
  getRedisConnectionConfig,
  queueUnavailableReason,
  shouldAutoStartWorkers,
} from "./shared";

export interface QuickBooksSyncJobData {
  orgId: string;
  limit?: number;
  reason?: string;
}

const QUEUE_NAME = "quickbooks-sync";

type QuickBooksSyncState = {
  queue?: Queue<QuickBooksSyncJobData>;
  worker?: Worker<QuickBooksSyncJobData> | null;
  disabledLogged?: boolean;
};

const globalState = globalThis as typeof globalThis & {
  __quickBooksSyncState?: QuickBooksSyncState;
};

if (!globalState.__quickBooksSyncState) {
  globalState.__quickBooksSyncState = {};
}

const state = globalState.__quickBooksSyncState;

function logDisabledOnce(reason: string) {
  if (state.disabledLogged) return;
  state.disabledLogged = true;
  console.warn(
    `[jobs] ${QUEUE_NAME} queue disabled (${reason}); requests will be ignored`,
  );
}

function getQueueInstance(): Queue<QuickBooksSyncJobData> | null {
  const disabledReason = queueUnavailableReason();
  if (disabledReason) {
    logDisabledOnce(disabledReason);
    return null;
  }

  if (!state.queue) {
    state.queue = new Queue<QuickBooksSyncJobData>(QUEUE_NAME, {
      connection: getRedisConnectionConfig(),
    });
  }

  return state.queue;
}

const toObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return { ...(value as Record<string, unknown>) };
};

function hasQuickBooksCredentials(settings: {
  clientId?: string | null;
  clientSecret?: string | null;
  refreshToken?: string | null;
  realmId?: string | null;
  needsReconnect?: boolean;
}) {
  if (!settings) return false;
  if (settings.needsReconnect) return false;
  return Boolean(
    settings.clientId &&
      settings.clientSecret &&
      settings.refreshToken &&
      settings.realmId,
  );
}

export async function enqueueQuickBooksSync(
  data: QuickBooksSyncJobData,
  options?: JobsOptions,
): Promise<void> {
  const queue = getQueueInstance();
  if (!queue) {
    return;
  }

  await queue.add("sync", data, {
    removeOnComplete: 100,
    removeOnFail: 20,
    attempts: 3,
    ...options,
  });
}

export async function scheduleRecurringQuickBooksSync(
  orgId: string,
  cron: string = "*/30 * * * *", // every 30 minutes by default
) {
  const jobId = `quickbooks-sync-${orgId}`;
  const queue = getQueueInstance();
  if (!queue) {
    return;
  }

  await queue.add(
    "recurring-sync",
    { orgId, reason: "recurring" },
    {
      jobId,
      repeat: { pattern: cron },
      removeOnFail: 20,
    },
  );
}

async function updateEntryQuickBooksMetadata(
  entryId: string,
  updater: (current: Record<string, unknown>) => Record<string, unknown>,
) {
  const entry = await prisma.customerBillingLedgerEntry.findUnique({
    where: { id: entryId },
    select: { metadata: true },
  });

  const baseMetadata = toObject(entry?.metadata ?? {});
  const qbMetadata = toObject(baseMetadata.quickbooks);
  const nextQuickBooks = updater(qbMetadata);
  const nextMetadata: Record<string, unknown> = {
    ...baseMetadata,
    quickbooks: nextQuickBooks,
  };

  await prisma.customerBillingLedgerEntry.update({
    where: { id: entryId },
    data: { metadata: nextMetadata as Prisma.InputJsonValue },
  });
}

export async function handleQuickBooksSync(
  data: QuickBooksSyncJobData,
) {
  const { orgId, limit = 20 } = data;
  const settings = await getQuickBooksSettings(orgId);

  if (!settings.enabled) {
    info("quickbooks.sync", {
      orgId,
      skipped: true,
      reason: "integration_disabled",
    });
    return {
      skipped: true,
      reason: "integration_disabled",
    };
  }

  const now = new Date().toISOString();

  const pendingEntries = await prisma.customerBillingLedgerEntry.findMany({
    where: {
      orgId,
      metadata: {
        path: ["quickbooks", "status"],
        equals: "pending",
      },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true, metadata: true, amountCents: true },
  });

  if (!pendingEntries.length) {
    info("quickbooks.sync", {
      orgId,
      processed: 0,
      reason: "no_pending_entries",
    });
    return {
      processed: 0,
      reason: "no_pending_entries",
    };
  }

  const credentialsAvailable = hasQuickBooksCredentials(settings);

  if (!credentialsAvailable) {
    const updates = pendingEntries.map((entry) =>
      updateEntryQuickBooksMetadata(entry.id, (current) => ({
        ...current,
        status: "blocked",
        lastAttempt: now,
        note: "Awaiting QuickBooks credentials or reconnect",
      })),
    );
    await Promise.all(updates);

    await updateBusinessConfig(orgId, {
      integrations: {
        quickbooks: {
          enabled: Boolean(settings.enabled),
          lastSyncAt: now,
        },
      },
    });

    warn("quickbooks.sync", {
      orgId,
      blocked: pendingEntries.length,
      reason: "missing_credentials",
    });

    return {
      processed: 0,
      blocked: pendingEntries.length,
      reason: "missing_credentials",
    };
  }

  const updates = pendingEntries.map((entry) =>
    updateEntryQuickBooksMetadata(entry.id, (current) => ({
      ...current,
      status: "queued",
      lastAttempt: now,
      note: "QuickBooks sync queued (stub)",
    })),
  );

  await Promise.all(updates);

  await updateBusinessConfig(orgId, {
    integrations: {
      quickbooks: {
        enabled: Boolean(settings.enabled),
        lastSyncAt: now,
      },
    },
  });

  info("quickbooks.sync", {
    orgId,
    processed: pendingEntries.length,
    reason: data.reason ?? "manual",
  });

  return {
    processed: pendingEntries.length,
  };
}

export function startQuickBooksSyncWorker():
  | Worker<QuickBooksSyncJobData>
  | null {
  if (state.worker) {
    return state.worker;
  }

  const disabledReason = queueUnavailableReason();
  if (disabledReason) {
    logDisabledOnce(disabledReason);
    return null;
  }

  const worker = new Worker<QuickBooksSyncJobData>(
    QUEUE_NAME,
    async (job: Job<QuickBooksSyncJobData>) => handleQuickBooksSync(job.data),
    {
      connection: getRedisConnectionConfig(),
      concurrency: 2,
    },
  );

  worker.on("completed", (job, result) => {
    info("quickbooks.sync.completed", {
      jobId: job.id,
      orgId: job.data.orgId,
      result,
    });
  });

  worker.on("failed", (job, error) => {
    warn("quickbooks.sync.failed", {
      jobId: job?.id,
      orgId: job?.data?.orgId,
      error: error?.message,
    });
  });

  state.worker = worker;
  return worker;
}

if (shouldAutoStartWorkers()) {
  startQuickBooksSyncWorker();
}
