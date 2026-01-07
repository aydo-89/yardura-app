import {
  scheduleRecurringQuickBooksSync,
  enqueueQuickBooksSync,
  startQuickBooksSyncWorker,
} from "@/lib/jobs/quickbooksSync";

const orgId = process.env.ORG_ID ?? "yardura";

console.log(`[QuickBooks] sync worker starting for org ${orgId}...`);

startQuickBooksSyncWorker();

scheduleRecurringQuickBooksSync(orgId)
  .then(() => {
    console.log(`[QuickBooks] recurring sync scheduled for ${orgId}.`);
  })
  .catch((error) => {
    console.error("[QuickBooks] failed to schedule recurring sync", error);
  });

enqueueQuickBooksSync({ orgId, reason: "startup" })
  .then(() => {
    console.log(`[QuickBooks] initial sync job enqueued for ${orgId}.`);
  })
  .catch((error) => {
    console.error("[QuickBooks] unable to enqueue initial sync job", error);
  });

console.log("QuickBooks sync worker is running. Press Ctrl+C to exit.");
