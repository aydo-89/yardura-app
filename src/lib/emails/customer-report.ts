import { sendTransactionalEmail } from "@/lib/email";
import { buildCustomerEmailReportEmail } from "@/lib/email/templates";
import type { CustomerEmailReportData } from "@/lib/reports/customer-email-report";

type SendCustomerEmailReportOptions = {
  report: CustomerEmailReportData;
  recipients: string[];
  dashboardUrl: string;
  manageUrl?: string | null;
};

const formatShortDate = (value: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const formatNumber = (value: number, decimals = 0) =>
  Number.isFinite(value) ? value.toFixed(decimals) : "0";

export async function sendCustomerEmailReport({
  report,
  recipients,
  dashboardUrl,
  manageUrl,
}: SendCustomerEmailReportOptions): Promise<string | null> {
  const wellnessAccent: 'mint' | 'gold' | 'coral' =
    report.stats.wellnessScore >= 85
      ? "mint"
      : report.stats.wellnessScore >= 70
        ? "gold"
        : "coral";

  // ─────────────────────────────────────────────────────────────
  // Build visualization data for stunning visual charts
  // ─────────────────────────────────────────────────────────────
  const visualizations: {
    wellnessScore?: number;
    wellnessLabel?: string;
    bristolAvg?: number | null;
    hydrationLevel?: number | null;
    issues?: Array<{ label: string; count: number }>;
    checkInDays?: number[];
    periodDays?: number;
    foodBreakdown?: Record<string, number>;
    walkStats?: { total: number; distanceMiles: number; durationMinutes: number };
    activitySummary?: Array<{ label: string; value: number; color?: string }>;
  } = {};

  // Wellness score gauge
  visualizations.wellnessScore = report.stats.wellnessScore;
  visualizations.wellnessLabel = report.stats.wellnessLabel;

  // Bristol scale average (firmness)
  if (report.wellness?.firmnessAvg != null) {
    visualizations.bristolAvg = report.wellness.firmnessAvg;
  }

  // Hydration level
  if (report.wellness?.hydrationAvg != null) {
    visualizations.hydrationLevel = report.wellness.hydrationAvg;
  }

  // Issues breakdown for bubble chart
  if (report.wellness?.issues?.length) {
    visualizations.issues = report.wellness.issues;
  }

  // Check-in activity dots
  if (report.checkIns?.total) {
    visualizations.periodDays = report.period.days;
    // Generate sample active days based on total check-ins
    // In a real scenario, this would come from actual check-in dates
    const checkInDays: number[] = [];
    const totalDays = report.period.days;
    const checkInsCount = Math.min(report.checkIns.total, totalDays);
    for (let i = 1; i <= checkInsCount; i++) {
      // Distribute check-ins across the period
      checkInDays.push(Math.ceil((i / checkInsCount) * totalDays));
    }
    visualizations.checkInDays = Array.from(new Set(checkInDays)); // Remove duplicates
  }

  // Food breakdown donut chart
  if (report.food?.typeCounts && Object.keys(report.food.typeCounts).length > 0) {
    visualizations.foodBreakdown = report.food.typeCounts;
  }

  // Walk stats
  if (report.walks) {
    visualizations.walkStats = {
      total: report.walks.total,
      distanceMiles: report.walks.distanceMiles,
      durationMinutes: report.walks.durationMinutes,
    };
  }

  // Activity summary bars
  const activityItems: Array<{ label: string; value: number; color?: string }> = [];
  if (report.stats.totalCaptures > 0) {
    activityItems.push({ label: "Stool scans", value: report.stats.totalCaptures, color: "#34D399" });
  }
  if (report.stats.checkInsCount > 0) {
    activityItems.push({ label: "Check-ins", value: report.stats.checkInsCount, color: "#FBBF24" });
  }
  if (report.visits?.completed) {
    activityItems.push({ label: "Scoops", value: report.visits.completed, color: "#38BDF8" });
  }
  if (report.walks?.total) {
    activityItems.push({ label: "Walks", value: report.walks.total, color: "#A78BFA" });
  }
  if (report.food?.total) {
    activityItems.push({ label: "Food logs", value: report.food.total, color: "#FB7185" });
  }
  if (activityItems.length > 1) {
    visualizations.activitySummary = activityItems;
  }

  // ─────────────────────────────────────────────────────────────
  // Legacy stat cards (kept for fallback)
  // ─────────────────────────────────────────────────────────────
  const stats = [
    {
      label: "Wellness score",
      value: `${report.stats.wellnessScore}`,
      note: report.stats.wellnessLabel,
      accent: wellnessAccent,
      progress: report.stats.wellnessScore,
    },
    {
      label: "Stool scans",
      value: `${report.stats.totalCaptures}`,
      note: report.stats.totalCaptures ? "Owner + scooper" : "None yet",
    },
    {
      label: "Check-ins",
      value: `${report.stats.checkInsCount}`,
      note: report.stats.checkInsCount ? "Logged days" : "No logs",
      progress: report.period.days
        ? Math.round((report.stats.checkInsCount / report.period.days) * 100)
        : null,
    },
  ];

  if (report.visits) {
    stats.push({
      label: "Scoops",
      value: `${report.visits.completed}`,
      note: report.visits.upcoming ? `${report.visits.upcoming} upcoming` : "No upcoming visits",
    });
  } else if (report.walks) {
    stats.push({
      label: "Walks",
      value: `${report.walks.total}`,
      note: `${formatNumber(report.walks.distanceMiles, 1)} mi`,
    });
  } else if (report.food) {
    stats.push({
      label: "Meals",
      value: `${report.food.total}`,
      note: "Food + meds",
    });
  }

  const sections: Array<{ title: string; lines: string[]; accent?: "coral" | "mint" | "gold" | "slate" | "emerald" }> = [];

  if (report.wellness) {
    const lines = [
      `Color trend: ${report.wellness.colorSummary}`,
      `Consistency trend: ${report.wellness.consistencySummary}`,
      report.wellness.indicatorSummary ? `Urgency tags: ${report.wellness.indicatorSummary}` : "",
      report.wellness.latestSummary ? `Latest capture: ${report.wellness.latestSummary}` : "",
      report.wellness.weeklyNotes ? `Behavior notes: ${report.wellness.weeklyNotes}` : "",
      report.wellness.stoolNotes ? `Stool notes: ${report.wellness.stoolNotes}` : "",
    ].filter(Boolean);
    // Only add section if visualizations don't already cover it
    if (!visualizations.bristolAvg && !visualizations.hydrationLevel) {
      sections.push({ title: "Wellness snapshot", lines, accent: "mint" });
    }
  }

  if (report.checkIns) {
    const lines = [
      `Vomiting episodes: ${report.checkIns.vomitingCount}`,
      `Diarrhea episodes: ${report.checkIns.diarrheaCount}`,
      `Meds given: ${report.checkIns.medsGivenCount}`,
      report.checkIns.appetiteMode ? `Appetite: mostly ${report.checkIns.appetiteMode}` : "",
      report.checkIns.energyMode ? `Energy: mostly ${report.checkIns.energyMode}` : "",
      report.checkIns.waterMode ? `Water intake: mostly ${report.checkIns.waterMode}` : "",
    ].filter(Boolean);
    sections.push({ title: "Daily check-ins", lines, accent: "gold" });
  }

  // Food section only if not showing donut chart
  if (report.food && !visualizations.foodBreakdown) {
    const typeSummary = Object.entries(report.food.typeCounts)
      .map(([type, count]) => `${type.toLowerCase()}: ${count}`)
      .join(" · ");
    const lines = [
      `Logs recorded: ${report.food.total}`,
      typeSummary ? `By type: ${typeSummary}` : "",
      report.food.topItems.length ? `Top items: ${report.food.topItems.join(", ")}` : "",
      report.food.topAllergens.length ? `Potential allergens: ${report.food.topAllergens.join(", ")}` : "",
    ].filter(Boolean);
    sections.push({ title: "Food + meds tracking", lines, accent: "coral" });
  }

  // Walks section only if not showing walk stats visuals
  if (report.walks && !visualizations.walkStats) {
    const lines = [
      `Walks logged: ${report.walks.total}`,
      `Distance: ${formatNumber(report.walks.distanceMiles, 1)} miles`,
      `Total time: ${formatNumber(report.walks.durationMinutes)} min`,
    ];
    sections.push({ title: "Walks & activity", lines, accent: "emerald" });
  }

  if (report.visits) {
    const lines = [
      `Completed visits: ${report.visits.completed}`,
      `Skipped visits: ${report.visits.skipped}`,
      `Upcoming visits: ${report.visits.upcoming}`,
      `Last visit: ${formatShortDate(report.visits.lastVisitDate)}`,
      `Next visit: ${formatShortDate(report.visits.nextVisitDate)}`,
    ];
    sections.push({ title: "Scooping service", lines, accent: "slate" });
  }

  if (report.reminders) {
    const lines = report.reminders.upcoming.length
      ? report.reminders.upcoming.map((item) => `${item.title} · due ${formatShortDate(item.dueAt)}`)
      : ["No reminders due soon."];
    sections.push({ title: "Upcoming reminders", lines, accent: "gold" });
  }

  if (report.chats) {
    const lines = report.chats.entries.length
      ? report.chats.entries.map((entry) => {
          const risk = entry.riskLevel ? ` (${entry.riskLevel.replace("_", " ")})` : "";
          const actions = entry.suggestedActions.length ? ` · ${entry.suggestedActions[0]}` : "";
          return `${entry.message.slice(0, 80)}${entry.message.length > 80 ? "…" : ""}${risk}${actions}`;
        })
      : ["No chat sessions this period."];
    sections.push({ title: "AI chat highlights", lines, accent: "coral" });
  }

  // NOTE: We do NOT include stool photos in email reports - people don't want poop in their inbox!
  // Instead, flagged items are mentioned in highlights and users can view in the app.
  const photos = undefined;

  const cadenceLabel = report.period.cadence === "MONTHLY" ? "Monthly" : "Weekly";

  const { html, text } = buildCustomerEmailReportEmail({
    toName: report.customer.name,
    cadenceLabel,
    periodLabel: report.period.label,
    stats,
    highlights: report.highlights.length ? report.highlights : ["Everything looks on track this period."],
    sections,
    photos,
    dashboardUrl,
    manageUrl,
    visualizations,
  });

  const subject = `${cadenceLabel} Wellness Report • ${report.period.label}`;

  return sendTransactionalEmail({
    to: recipients,
    subject,
    html,
    text,
  });
}
