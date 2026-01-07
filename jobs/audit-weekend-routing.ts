#!/usr/bin/env node

import { addDays, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";

function nextWeekendRange(reference: Date) {
  const day = reference.getUTCDay();
  const daysUntilSaturday = (6 - day + 7) % 7;
  const saturday = addDays(startOfDay(reference), daysUntilSaturday);
  const sunday = addDays(saturday, 1);
  return { saturday, sunday };
}

async function main() {
  const tileSlug = process.argv[2];
  const orgId = process.env.ORG_ID ?? "yardura";

  if (!tileSlug) {
    console.error("Usage: tsx jobs/audit-weekend-routing.ts <tile-slug> [ISO-date]");
    process.exit(1);
  }

  const reference = process.argv[3] ? new Date(process.argv[3]) : new Date();
  if (Number.isNaN(reference.getTime())) {
    console.error(`Invalid reference date: ${process.argv[3]}`);
    process.exit(1);
  }

  const { saturday, sunday } = nextWeekendRange(reference);

  console.log("\n▶ Weekend routing audit", {
    tileSlug,
    orgId,
    range: `${saturday.toISOString()} → ${sunday.toISOString()}`,
  });

  const visits = await prisma.serviceVisit.findMany({
    where: {
      orgId,
      scheduledDate: { gte: saturday, lt: sunday },
      job: {
        tile: { slug: tileSlug },
      },
    },
    include: {
      customer: { select: { name: true, addressLine1: true } },
      routeStop: {
        select: {
          routeInstanceId: true,
          status: true,
        },
      },
    },
    orderBy: { scheduledDate: "asc" },
  });

  const routes = await prisma.routeInstance.findMany({
    where: {
      orgId,
      scheduledDate: { gte: saturday, lt: sunday },
    },
    include: {
      technician: { select: { id: true, name: true } },
      stops: {
        select: {
          serviceVisitId: true,
        },
      },
    },
  });

  const routesWithTech = routes.filter((r) => r.technicianId);
  const technicianlessRoutes = routes.filter((r) => !r.technicianId);

  console.log("\nRoutes", {
    total: routes.length,
    withTechnician: routesWithTech.length,
    withoutTechnician: technicianlessRoutes.length,
  });

  technicianlessRoutes.forEach((route) => {
    console.log("  ⚠ Technician missing", {
      routeId: route.id,
      stops: route.stops.length,
    });
  });

  console.log("\nVisits", {
    total: visits.length,
    assigned: visits.filter((v) => Boolean(v.routeStop?.routeInstanceId)).length,
    unassigned: visits.filter((v) => !v.routeStop?.routeInstanceId).length,
  });

  visits.forEach((visit) => {
    console.log(
      `  • ${visit.id} ${visit.customer?.name ?? "Customer"} – ${visit.routeStop?.routeInstanceId ? "assigned" : "unassigned"}`,
    );
  });

  console.log("\nSuggested next steps:");
  if (routesWithTech.length === 0) {
    console.log(
      "  • Consider assigning a technician to an existing route and re-running to test path B.",
    );
  }
  if (technicianlessRoutes.length === 0) {
    console.log(
      "  • Seed an additional technicianless route to test weekend overflow warnings.",
    );
  }
  if (visits.some((v) => !v.routeStop?.routeInstanceId)) {
    console.log(
      "  • Trigger autoAssignVisitToRoute for unassigned visits to validate fallback behaviour.",
    );
  }
}

main()
  .catch((error) => {
    console.error("Weekend routing audit failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
