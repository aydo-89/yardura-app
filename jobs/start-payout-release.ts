import { prisma } from "@/lib/prisma";
import {
  scheduleRecurringPayoutRelease,
  startPayoutReleaseWorker,
} from "@/lib/jobs/payoutRelease";

startPayoutReleaseWorker();

async function scheduleRecurring() {
  const orgs = await prisma.org.findMany({ select: { id: true } });
  await Promise.all(
    orgs.map((org) =>
      scheduleRecurringPayoutRelease(org.id).catch((error) => {
        console.error("[PayoutReleaseWorker] scheduleRecurring failed", org.id, error);
      }),
    ),
  );
}

scheduleRecurring().catch((error) => {
  console.error("[PayoutReleaseWorker] scheduleRecurring fatal", error);
});

console.log("Payout release worker is running. Press Ctrl+C to exit.");
