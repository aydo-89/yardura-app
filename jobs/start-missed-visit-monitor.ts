import { prisma } from "@/lib/prisma";
import {
  scheduleRecurringMissedVisitMonitor,
  startMissedVisitMonitorWorker,
} from "@/lib/jobs/missedVisitMonitor";

startMissedVisitMonitorWorker();

async function scheduleRecurring() {
  const orgs = await prisma.org.findMany({ select: { id: true } });
  await Promise.all(
    orgs.map((org) =>
      scheduleRecurringMissedVisitMonitor(org.id).catch((error) => {
        console.error("[MissedVisitMonitor] scheduleRecurring failed", org.id, error);
      }),
    ),
  );
}

scheduleRecurring().catch((error) => {
  console.error("[MissedVisitMonitor] scheduleRecurring fatal", error);
});

console.log("Missed visit monitor worker is running. Press Ctrl+C to exit.");
