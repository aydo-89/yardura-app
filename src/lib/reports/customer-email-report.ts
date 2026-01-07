import {
  CustomerEmailReportCadence,
  FoodLogType,
  ServiceStatus,
} from "@prisma/client";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { createSignedUrl } from "@/lib/supabase-admin";
import {
  SERVICE_TIME_ZONE,
  constructZonedDateFromParts,
  convertUtcToZonedParts,
  formatZonedDate,
} from "@/lib/timezone";
import {
  buildWellnessReadingsFromCaptures,
  buildWellnessReadingsFromMedia,
} from "@/lib/wellness/readings";

export type EmailReportSections = {
  includeWellness: boolean;
  includeScooping: boolean;
  includeFood: boolean;
  includeWalks: boolean;
  includeReminders: boolean;
  includeChats: boolean;
  includePhotos: boolean;
};

export type EmailReportPeriod = {
  start: Date;
  end: Date;
  label: string;
  cadence: CustomerEmailReportCadence;
  days: number;
  periodKey: string;
};

export type CustomerEmailReportData = {
  customer: {
    id: string;
    name: string | null;
    email: string | null;
    city: string | null;
    state: string | null;
  };
  dogs: Array<{ id: string; name: string | null }>;
  period: EmailReportPeriod;
  stats: {
    wellnessScore: number;
    wellnessLabel: string;
    totalCaptures: number;
    checkInsCount: number;
    visitCount: number;
    walkDistanceMiles: number;
    foodLogCount: number;
  };
  highlights: string[];
  wellness?: {
    issues: Array<{ label: string; count: number }>;
    colorSummary: string;
    consistencySummary: string;
    hydrationAvg: number | null;
    firmnessAvg: number | null;
    indicatorSummary: string;
    latestSummary: string | null;
    latestIndicator: string | null;
    weeklyNotes: string | null;
    stoolNotes: string | null;
  };
  checkIns?: {
    vomitingCount: number;
    diarrheaCount: number;
    medsGivenCount: number;
    appetiteMode: string | null;
    energyMode: string | null;
    waterMode: string | null;
    total: number;
  };
  food?: {
    total: number;
    typeCounts: Record<string, number>;
    topAllergens: string[];
    topItems: string[];
  };
  walks?: {
    total: number;
    distanceMiles: number;
    durationMinutes: number;
  };
  reminders?: {
    upcoming: Array<{ title: string; dueAt: string }>;
  };
  chats?: {
    entries: Array<{
      message: string;
      riskLevel: string | null;
      redFlags: string[];
      suggestedActions: string[];
    }>;
  };
  visits?: {
    completed: number;
    skipped: number;
    upcoming: number;
    nextVisitDate: string | null;
    lastVisitDate: string | null;
  };
  photos?: {
    owner: Array<{ url: string; caption: string }>;
    pro: Array<{ url: string; caption: string }>;
  };
};

const MAX_PHOTOS_PER_SOURCE = 2;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const formatRangeLabel = (start: Date, end: Date) => {
  const startLabel = formatZonedDate(start, { month: "short", day: "numeric" });
  const endLabel = formatZonedDate(end, { month: "short", day: "numeric" });
  const startYear = formatZonedDate(start, { year: "numeric" });
  const endYear = formatZonedDate(end, { year: "numeric" });
  return startYear === endYear ? `${startLabel} – ${endLabel}, ${startYear}` : `${startLabel}, ${startYear} – ${endLabel}, ${endYear}`;
};

export function resolveReportPeriod(options: {
  cadence: CustomerEmailReportCadence;
  now?: Date;
  timeZone?: string | null;
}): EmailReportPeriod {
  const now = options.now ?? new Date();
  const timeZone = options.timeZone ?? SERVICE_TIME_ZONE;
  const parts = convertUtcToZonedParts(now, timeZone);
  const zonedNow = constructZonedDateFromParts(parts, timeZone);
  const days = options.cadence === "MONTHLY" ? 30 : 7;
  const start = new Date(zonedNow);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const end = zonedNow;
  const label = formatRangeLabel(start, end);
  const periodKey = `${options.cadence.toLowerCase()}-${start.toISOString().slice(0, 10)}`;

  return {
    start,
    end,
    label,
    cadence: options.cadence,
    days,
    periodKey,
  };
}

const summarizeCounts = (counts: Record<string, number>, fallback: string) => {
  const entries = Object.entries(counts)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => `${key} ${value}`);
  return entries.length ? entries.join(" · ") : fallback;
};

const modeFromCounts = (counts: Record<string, number>) => {
  const entries = Object.entries(counts).filter(([, value]) => value > 0);
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
};

const toMiles = (meters: number) => meters / 1609.34;

const sanitizeEmailList = (recipients: string[]) =>
  recipients
    .map((email) => email.trim().toLowerCase())
    .filter((email, index, list) => Boolean(email) && list.indexOf(email) === index);

export async function buildCustomerEmailReportData(options: {
  orgId: string;
  customerId: string;
  period: EmailReportPeriod;
  sections: EmailReportSections;
}): Promise<CustomerEmailReportData | null> {
  const { orgId, customerId, period, sections } = options;

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, orgId },
    select: {
      id: true,
      name: true,
      email: true,
      city: true,
      state: true,
      dogs: { select: { id: true, name: true } },
    },
  });

  if (!customer) return null;

  const start = period.start;
  const end = period.end;

  const shouldFetchWellness = sections.includeWellness || sections.includePhotos;
  const shouldFetchChat = sections.includeChats;
  const shouldFetchFood = sections.includeFood;
  const shouldFetchWalks = sections.includeWalks;
  const shouldFetchReminders = sections.includeReminders;
  const shouldFetchVisits = sections.includeScooping;

  const [
    weeklyReports,
    ownerCaptures,
    proMedia,
    chatLogs,
    foodLogs,
    walks,
    reminders,
    visits,
  ] = await Promise.all([
    sections.includeWellness
      ? prisma.weeklyWellnessReport.findMany({
          where: { customerId, weekStart: { gte: start }, weekEnd: { lte: end } },
          orderBy: { weekStart: "desc" },
          select: {
            behaviorNotes: true,
            stoolNotes: true,
            appetite: true,
            hydration: true,
            energy: true,
            stoolFrequency: true,
            vomiting: true,
            diarrhea: true,
            medsGiven: true,
            medsNotes: true,
          },
        })
      : Promise.resolve([]),
    shouldFetchWellness
      ? prisma.customerWellnessCapture.findMany({
          where: {
            customerId,
            capturedAt: { gte: start, lte: end },
          },
          orderBy: { capturedAt: "desc" },
          include: { dog: { select: { name: true } } },
        })
      : Promise.resolve([]),
    shouldFetchWellness
      ? prisma.serviceVisitMedia.findMany({
          where: {
            serviceVisit: { customerId },
            capturedAt: { gte: start, lte: end },
            assetType: "INSIGHTSCOOP",
            analysisStatus: { in: ["COMPLETED", "NEEDS_REVIEW"] },
            visibilityState: "VISIBLE",
          },
          orderBy: { capturedAt: "desc" },
          take: 6,
        })
      : Promise.resolve([]),
    shouldFetchChat
      ? prisma.customerWellnessChatLog.findMany({
          where: { customerId, createdAt: { gte: start, lte: end } },
          orderBy: { createdAt: "desc" },
          take: 3,
        })
      : Promise.resolve([]),
    shouldFetchFood
      ? prisma.customerFoodLog.findMany({
          where: { customerId, loggedAt: { gte: start, lte: end } },
          orderBy: { loggedAt: "desc" },
          take: 40,
        })
      : Promise.resolve([]),
    shouldFetchWalks
      ? prisma.customerWellnessWalk.findMany({
          where: { customerId, startedAt: { gte: start, lte: end } },
          orderBy: { startedAt: "desc" },
          take: 20,
        })
      : Promise.resolve([]),
    shouldFetchReminders
      ? prisma.customerWellnessReminder.findMany({
          where: {
            customerId,
            active: true,
            nextDueAt: { gte: new Date(), lte: new Date(Date.now() + 14 * 86400000) },
          },
          orderBy: { nextDueAt: "asc" },
          take: 5,
        })
      : Promise.resolve([]),
    shouldFetchVisits
      ? prisma.serviceVisit.findMany({
          where: { customerId, scheduledDate: { gte: start, lte: end } },
          orderBy: { scheduledDate: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const ownerReadings = shouldFetchWellness
    ? buildWellnessReadingsFromCaptures(
        ownerCaptures.map((capture) => ({
          id: capture.id,
          capturedAt: capture.capturedAt,
          analysisResult: capture.analysisResult as Record<string, unknown> | null,
          dogName: capture.dog?.name ?? null,
          storagePath: capture.storagePath ?? null,
        })),
      )
    : [];

  const proReadings = shouldFetchWellness
    ? buildWellnessReadingsFromMedia(
        proMedia.map((media) => ({
          id: media.id,
          capturedAt: media.capturedAt,
          analysisResult: media.analysisResult as Record<string, unknown> | null,
          stoolSampleId: media.stoolSampleId ?? null,
          stoolSampleView: media.stoolSampleView ?? null,
          assetType: media.assetType ?? null,
        })),
      )
    : [];

  const allReadings = [...ownerReadings, ...proReadings];
  const totalCaptures = ownerCaptures.length + proMedia.length;

  const issueCounts = new Map<string, number>();
  const colorCounts: Record<string, number> = {};
  const consistencyCounts: Record<string, number> = {};
  const indicatorCounts = { watch: 0, monitor: 0, vet_now: 0 };

  let hydrationTotal = 0;
  let hydrationCount = 0;
  let firmnessTotal = 0;
  let firmnessCount = 0;

  allReadings.forEach((reading) => {
    if (reading.color) {
      colorCounts[reading.color] = (colorCounts[reading.color] ?? 0) + 1;
    }
    if (reading.consistencyLabel) {
      consistencyCounts[reading.consistencyLabel] = (consistencyCounts[reading.consistencyLabel] ?? 0) + 1;
    }
    reading.issues.forEach((issue) => {
      issueCounts.set(issue, (issueCounts.get(issue) ?? 0) + 1);
    });
    if (reading.indicator) {
      indicatorCounts[reading.indicator] += 1;
    }
    if (typeof reading.hydrationScore === "number") {
      hydrationTotal += reading.hydrationScore;
      hydrationCount += 1;
    }
    if (typeof reading.firmnessScale === "number") {
      firmnessTotal += reading.firmnessScale;
      firmnessCount += 1;
    }
  });

  const issues = Array.from(issueCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));

  const hydrationAvg = hydrationCount ? hydrationTotal / hydrationCount : null;
  const firmnessAvg = firmnessCount ? firmnessTotal / firmnessCount : null;

  const latestOwnerReading = ownerReadings[0];
  const latestSummary = latestOwnerReading?.summary ?? null;
  const latestIndicator = latestOwnerReading?.indicator ?? null;

  const latestReport = weeklyReports[0] ?? null;
  const checkInsCount = weeklyReports.length;
  const vomitingCount = weeklyReports.filter((entry) => entry.vomiting).length;
  const diarrheaCount = weeklyReports.filter((entry) => entry.diarrhea).length;
  const medsGivenCount = weeklyReports.filter((entry) => entry.medsGiven).length;

  const appetiteCounts: Record<string, number> = {};
  const energyCounts: Record<string, number> = {};
  const waterCounts: Record<string, number> = {};
  weeklyReports.forEach((entry) => {
    if (entry.appetite) {
      appetiteCounts[entry.appetite.toLowerCase()] = (appetiteCounts[entry.appetite.toLowerCase()] ?? 0) + 1;
    }
    if (entry.energy) {
      energyCounts[entry.energy.toLowerCase()] = (energyCounts[entry.energy.toLowerCase()] ?? 0) + 1;
    }
    if (entry.hydration) {
      waterCounts[entry.hydration.toLowerCase()] = (waterCounts[entry.hydration.toLowerCase()] ?? 0) + 1;
    }
  });

  const appetiteMode = modeFromCounts(appetiteCounts);
  const energyMode = modeFromCounts(energyCounts);
  const waterMode = modeFromCounts(waterCounts);

  const foodLogCount = foodLogs.length;
  const typeCounts: Record<string, number> = {};
  const allergenCounts: Record<string, number> = {};
  const itemCounts: Record<string, number> = {};

  foodLogs.forEach((log) => {
    const type = log.type ?? FoodLogType.FOOD;
    typeCounts[type] = (typeCounts[type] ?? 0) + 1;
    log.allergenMatches.forEach((allergen) => {
      allergenCounts[allergen] = (allergenCounts[allergen] ?? 0) + 1;
    });
    const label = [log.brand, log.productName].filter(Boolean).join(" ").trim();
    if (label) {
      itemCounts[label] = (itemCounts[label] ?? 0) + 1;
    }
  });

  const topAllergens = Object.entries(allergenCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label]) => label);
  const topItems = Object.entries(itemCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label]) => label);

  const walkDistanceMeters = walks.reduce((sum, walk) => sum + walk.distanceMeters, 0);
  const walkDurationSeconds = walks.reduce((sum, walk) => sum + walk.durationSeconds, 0);

  const completedVisits = visits.filter((visit) => visit.status === ServiceStatus.COMPLETED).length;
  const skippedVisits = visits.filter((visit) => visit.status === ServiceStatus.SKIPPED).length;
  const upcomingVisits = visits.filter((visit) => visit.status === ServiceStatus.SCHEDULED).length;

  const nextVisit = sections.includeScooping
    ? await prisma.serviceVisit.findFirst({
        where: { customerId, scheduledDate: { gt: end }, status: ServiceStatus.SCHEDULED },
        orderBy: { scheduledDate: "asc" },
        select: { scheduledDate: true },
      })
    : null;

  const lastVisit = sections.includeScooping
    ? await prisma.serviceVisit.findFirst({
        where: { customerId, completedDate: { not: null } },
        orderBy: { completedDate: "desc" },
        select: { completedDate: true },
      })
    : null;

  const chatEntries = chatLogs.map((log) => {
    const response = (log.response ?? {}) as Record<string, unknown>;
    return {
      message: log.message,
      riskLevel: log.riskLevel ?? null,
      redFlags: Array.isArray(response.red_flags) ? (response.red_flags as string[]).slice(0, 3) : [],
      suggestedActions: Array.isArray(response.suggested_actions)
        ? (response.suggested_actions as string[]).slice(0, 3)
        : [],
    };
  });

  const highlightList: string[] = [];
  if (issues.length) {
    highlightList.push(`Stool observations: ${issues.slice(0, 2).map((item) => item.label).join(", ")}`);
  }
  if (vomitingCount > 0) {
    highlightList.push(`Vomiting reported ${vomitingCount} time${vomitingCount === 1 ? "" : "s"}`);
  }
  if (diarrheaCount > 0) {
    highlightList.push(`Diarrhea reported ${diarrheaCount} time${diarrheaCount === 1 ? "" : "s"}`);
  }
  if (topAllergens.length) {
    highlightList.push(`Top allergens: ${topAllergens.join(", ")}`);
  }
  if (completedVisits > 0) {
    highlightList.push(`${completedVisits} visit${completedVisits === 1 ? "" : "s"} completed`);
  }
  if (reminders.length) {
    highlightList.push(`${reminders.length} reminder${reminders.length === 1 ? "" : "s"} coming up`);
  }

  const chatRiskPenalty =
    chatEntries.filter((entry) => entry.riskLevel === "vet_now").length * 10 +
    chatEntries.filter((entry) => entry.riskLevel === "monitor").length * 5;

  const wellnessScore = clamp(
    100 -
      issues.length * 5 -
      indicatorCounts.vet_now * 12 -
      indicatorCounts.monitor * 6 -
      indicatorCounts.watch * 3 -
      vomitingCount * 6 -
      diarrheaCount * 6 -
      chatRiskPenalty,
    0,
    100,
  );

  const wellnessLabel =
    wellnessScore >= 85 ? "Strong" : wellnessScore >= 70 ? "Stable" : wellnessScore >= 55 ? "Watch" : "Needs attention";

  const bucket = env.STORAGE_BUCKET;
  const ownerPhotoItems: Array<{ url: string; caption: string }> = [];
  const proPhotoItems: Array<{ url: string; caption: string }> = [];

  if (sections.includePhotos && bucket) {
    const ownerPhotos = ownerCaptures.slice(0, MAX_PHOTOS_PER_SOURCE);
    const proPhotos = proMedia.slice(0, MAX_PHOTOS_PER_SOURCE);

    for (const capture of ownerPhotos) {
      if (!capture.storagePath) continue;
      try {
        const url = await createSignedUrl(bucket, capture.storagePath, 60 * 60 * 12);
        ownerPhotoItems.push({
          url,
          caption: capture.dog?.name ? `${capture.dog.name} · Owner capture` : "Owner capture",
        });
      } catch {
        // ignore signed url errors
      }
    }

    for (const media of proPhotos) {
      try {
        const url = await createSignedUrl(bucket, media.storagePath, 60 * 60 * 12);
        proPhotoItems.push({
          url,
          caption: "Scooper capture",
        });
      } catch {
        // ignore signed url errors
      }
    }
  }

  const reportData: CustomerEmailReportData = {
    customer: {
      id: customer.id,
      name: customer.name ?? null,
      email: customer.email ?? null,
      city: customer.city ?? null,
      state: customer.state ?? null,
    },
    dogs: customer.dogs,
    period,
    stats: {
      wellnessScore,
      wellnessLabel,
      totalCaptures,
      checkInsCount,
      visitCount: completedVisits + upcomingVisits,
      walkDistanceMiles: Number.isFinite(walkDistanceMeters) ? toMiles(walkDistanceMeters) : 0,
      foodLogCount,
    },
    highlights: highlightList.slice(0, 4),
  };

  if (sections.includeWellness) {
    reportData.wellness = {
      issues,
      colorSummary: summarizeCounts(colorCounts, "No color trends yet"),
      consistencySummary: summarizeCounts(consistencyCounts, "No consistency trends yet"),
      hydrationAvg,
      firmnessAvg,
      indicatorSummary: summarizeCounts(indicatorCounts, "No urgency tags yet"),
      latestSummary,
      latestIndicator,
      weeklyNotes: latestReport?.behaviorNotes ?? null,
      stoolNotes: latestReport?.stoolNotes ?? null,
    };
  }

  if (sections.includeWellness) {
    reportData.checkIns = {
      vomitingCount,
      diarrheaCount,
      medsGivenCount,
      appetiteMode,
      energyMode,
      waterMode,
      total: checkInsCount,
    };
  }

  if (sections.includeFood) {
    reportData.food = {
      total: foodLogCount,
      typeCounts,
      topAllergens,
      topItems,
    };
  }

  if (sections.includeWalks) {
    reportData.walks = {
      total: walks.length,
      distanceMiles: Number.isFinite(walkDistanceMeters) ? toMiles(walkDistanceMeters) : 0,
      durationMinutes: walkDurationSeconds / 60,
    };
  }

  if (sections.includeReminders) {
    reportData.reminders = {
      upcoming: reminders.map((reminder) => ({
        title: reminder.title,
        dueAt: reminder.nextDueAt.toISOString(),
      })),
    };
  }

  if (sections.includeChats) {
    reportData.chats = {
      entries: chatEntries,
    };
  }

  if (sections.includeScooping) {
    reportData.visits = {
      completed: completedVisits,
      skipped: skippedVisits,
      upcoming: upcomingVisits,
      nextVisitDate: nextVisit?.scheduledDate?.toISOString() ?? null,
      lastVisitDate: lastVisit?.completedDate?.toISOString() ?? null,
    };
  }

  // NOTE: We intentionally do NOT include stool photos in email reports.
  // People don't want to see poop images in their inbox!
  // Instead, we just note the count - they can view details in the app.
  // Flagged items (if any) are mentioned in the highlights.

  return reportData;
}

export const emailReportUtils = {
  sanitizeEmailList,
};
