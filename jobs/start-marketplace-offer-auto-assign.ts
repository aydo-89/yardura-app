import { prisma } from "@/lib/prisma";
import {
  scheduleRecurringOfferAutoAssign,
  startMarketplaceOfferAutoAssignWorker,
} from "@/lib/jobs/marketplaceOfferAutoAssign";

startMarketplaceOfferAutoAssignWorker();

async function scheduleRecurring() {
  const orgs = await prisma.org.findMany({ select: { id: true } });
  await Promise.all(
    orgs.map((org) =>
      scheduleRecurringOfferAutoAssign(org.id).catch((error) => {
        console.error("[MarketplaceOfferAutoAssign] scheduleRecurring failed", org.id, error);
      }),
    ),
  );
}

scheduleRecurring().catch((error) => {
  console.error("[MarketplaceOfferAutoAssign] scheduleRecurring fatal", error);
});

console.log("Marketplace offer auto-assign worker is running. Press Ctrl+C to exit.");
