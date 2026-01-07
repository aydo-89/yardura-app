import { prisma } from "@/lib/prisma";
import {
  scheduleRecurringOfferSweeper,
  startMarketplaceOfferSweeperWorker,
} from "@/lib/jobs/marketplaceOfferSweeper";

startMarketplaceOfferSweeperWorker();

async function scheduleRecurring() {
  const orgs = await prisma.org.findMany({ select: { id: true } });
  await Promise.all(
    orgs.map((org) =>
      scheduleRecurringOfferSweeper(org.id).catch((error) => {
        console.error("[MarketplaceOfferSweeper] scheduleRecurring failed", org.id, error);
      }),
    ),
  );
}

scheduleRecurring().catch((error) => {
  console.error("[MarketplaceOfferSweeper] scheduleRecurring fatal", error);
});

console.log("Marketplace offer sweeper worker is running. Press Ctrl+C to exit.");
