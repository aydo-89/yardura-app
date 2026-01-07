import { prisma } from "@/lib/prisma";
import {
  scheduleRecurringOfferPublishing,
  startMarketplaceOfferWorker,
} from "@/lib/jobs/marketplaceOfferPublisher";

startMarketplaceOfferWorker();

async function scheduleRecurring() {
  const orgs = await prisma.org.findMany({ select: { id: true } });
  await Promise.all(
    orgs.map((org) =>
      scheduleRecurringOfferPublishing(org.id).catch((error) => {
        console.error("[MarketplaceOfferWorker] scheduleRecurring failed", org.id, error);
      }),
    ),
  );
}

scheduleRecurring().catch((error) => {
  console.error("[MarketplaceOfferWorker] scheduleRecurring fatal", error);
});

console.log("Marketplace offer publisher worker is running. Press Ctrl+C to exit.");
