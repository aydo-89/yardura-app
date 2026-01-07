import { startCustomerEmailReportWorker } from "@/lib/jobs/customerEmailReportScheduler";

console.log("📬 Customer email report scheduler is running. Press Ctrl+C to exit.");

const worker = startCustomerEmailReportWorker();

if (!worker) {
  console.warn("Customer email report worker did not start (queue disabled).");
}

process.on("SIGINT", async () => {
  if (!worker) return;
  console.log("\n🛑 Shutting down customer email report worker...");
  await worker.close();
  process.exit(0);
});
