import {
  ensureBillingSweepScheduled,
  startBillingInvoiceWorker,
} from "@/lib/jobs/billingInvoiceWorker";

console.log("Billing automation worker is starting...");

startBillingInvoiceWorker();

ensureBillingSweepScheduled()
  .then(() => {
    console.log("Billing sweep scheduled (15 minute interval).");
  })
  .catch((error) => {
    console.error("Failed to schedule billing sweep", error);
  });

console.log("Billing automation worker is running. Press Ctrl+C to exit.");
