import { useMemo } from "react";
import {
  mondayStart,
  colorKeyFor,
  WELLNESS_THRESHOLDS,
  type DataReading,
  type ServiceVisit,
  type WellnessComputed,
  type WellnessSimpleStatus,
} from "@/shared/wellness";

// Helper function to determine simple status for overall trends
const determineSimpleStatus = (
  softWeeks: number,
  maxConsec: number,
  alertWeeks: number,
  hasCriticalIssues: boolean,
): WellnessSimpleStatus => {
  // Red conditions: critical issues (red/black color, consecutive soft ≥ 2)
  if (alertWeeks > 0 || maxConsec >= 2 || hasCriticalIssues) {
    return "attention";
  }
  // Yellow conditions: soft issues but not critical
  if (softWeeks > 0) {
    return "monitor";
  }
  // Green: everything normal
  return "good";
};

// Helper function to determine status for individual week
const determineWeekStatus = (
  softRatio: number,
  hasCriticalIssues: boolean,
  hasYellowColor: boolean,
  hasIssues: boolean,
): WellnessSimpleStatus => {
  // Red conditions: critical issues (red/black color)
  if (hasCriticalIssues) {
    return "attention";
  }
  // Yellow conditions: soft consistency, yellow color, or other issues
  if (
    softRatio >= WELLNESS_THRESHOLDS.SOFT_CONSISTENCY_THRESHOLD ||
    hasYellowColor ||
    hasIssues
  ) {
    return "monitor";
  }
  // Green: everything normal
  return "good";
};

// Generate plain language copy based on status
const generateStatusCopy = (
  status: WellnessSimpleStatus,
  softWeeks: number,
  alertWeeks: number,
  hasParasites: boolean,
) => {
  switch (status) {
    case "good":
      return {
        title: "Patterns look healthy",
        subtitle: "Your dog's waste patterns are well within the healthy baseline.",
        advice: [
          "Keep up the great work with their diet and exercise!",
          "Continue regular monitoring to stay on top of any changes.",
        ],
      };

    case "monitor":
      return {
        title: "Keep an eye on this",
        subtitle: `We've noticed some changes in ${softWeeks} week${softWeeks > 1 ? "s" : ""}.`,
        advice: [
          "Consider adding more fiber to their diet (like pumpkin or sweet potato)",
          "Make sure they're getting plenty of fresh water",
          "Track these patterns for the next few days",
        ],
      };

    case "attention":
      return {
        title: "Needs attention",
        subtitle: hasParasites
          ? "We're seeing some concerning patterns that may need veterinary attention."
          : "There are some patterns here that deserve closer attention.",
        advice: [
          "Consider scheduling a vet visit to rule out any underlying issues",
          "Keep detailed notes about their diet, behavior, and any symptoms",
          "Monitor closely and contact your vet if patterns persist",
        ],
        cta: {
          text: "Consult a Vet",
          action: "consult-vet",
          href: "/consult",
          label: "Consult a Vet",
        },
      };
  }
};

export const useWellnessData = (
  dataReadings: DataReading[],
  _serviceVisits: ServiceVisit[],
): WellnessComputed => {
  return useMemo(() => {
    const now = new Date();

    // Process readings into weekly buckets
    const byWeek = new Map<string, DataReading[]>();
    dataReadings.forEach((reading) => {
      const weekStart = mondayStart(new Date(reading.timestamp));
      const key = weekStart.toISOString().slice(0, 10);
      const readings = byWeek.get(key) || [];
      readings.push(reading);
      byWeek.set(key, readings);
    });

    // Build weekly data for the last 8 weeks (most recent first)
    const weekly: WellnessComputed["weekly"] = [];
    const currentWeekStart = mondayStart(now);

    let totalSoftWeeks = 0;
    let totalAlertWeeks = 0;
    let maxConsecutiveSoft = 0;
    let consecutiveHighSoft = 0;
    let overallHasParasites = false;

    // Color totals for donut chart
    const colorTotals = { normal: 0, yellow: 0, red: 0, black: 0 };
    // Consistency totals for stack chart
    const consistencyTotals = { normal: 0, soft: 0, dry: 0 };
    const weeklySignals: Array<{
      mucous: number;
      greasy: number;
      parasites: number;
      foreign: number;
    }> = [];

    for (let i = 0; i < 8; i++) {
      const weekStart = new Date(currentWeekStart);
      weekStart.setDate(weekStart.getDate() - i * 7); // Go back i weeks
      const key = weekStart.toISOString().slice(0, 10);
      const weekReadings = byWeek.get(key) || [];

      const readingUnits = weekReadings.map((reading) => {
        const rawVolume = typeof reading.volume === "number" ? reading.volume : null;
        return {
          reading,
          units:
            rawVolume && Number.isFinite(rawVolume) && rawVolume > 0
              ? rawVolume
              : 1,
        };
      });

      const totalWeekUnits = readingUnits.reduce((sum, entry) => sum + entry.units, 0);

      // Color counts for this week
      const colors: {
        normal: number;
        yellow: number;
        red: number;
        black: number;
        total: number;
      } = {
        normal: 0,
        yellow: 0,
        red: 0,
        black: 0,
        total: 0,
      };
      readingUnits.forEach(({ reading: r, units }) => {
        const colorKey = r.color ? colorKeyFor(r.color) : undefined;
        if (colorKey && typeof colorKey === "string" && colorKey in colors) {
          colors[colorKey as keyof typeof colors] += units;
          colorTotals[colorKey as keyof typeof colorTotals] += units;
        }
      });

      // Consistency counts for this week
      const consistency: {
        normal: number;
        soft: number;
        dry: number;
        total: number;
      } = { normal: 0, soft: 0, dry: 0, total: 0 };
      let weekSoftCount = 0;
      let hasMucous = false;
      let hasGreasy = false;
      let hasDry = false;
      let weekHasParasites = false;
      let hasForeign = false;
      let mucousCount = 0;
      let greasyCount = 0;
      let parasiteCount = 0;
      let foreignCount = 0;
      const issuesSet = new Set<string>();

      readingUnits.forEach(({ reading: r, units }) => {
        const rawConsistency =
          typeof r.consistencyLabel === "string"
            ? r.consistencyLabel.toLowerCase()
            : typeof (r as any).consistency === "string"
              ? ((r as any).consistency as string).toLowerCase()
              : "normal";
        const normalizedConsistency = rawConsistency === "firm" ? "normal" : rawConsistency;

        if (["normal", "formed"].includes(normalizedConsistency)) {
          consistency.normal += units;
          consistencyTotals.normal += units;
        } else if (
          ["soft", "loose", "watery", "mucous", "greasy"].includes(
            normalizedConsistency,
          )
        ) {
          consistency.soft += units;
          consistencyTotals.soft += units;
          weekSoftCount += units;
          if (normalizedConsistency === "mucous") {
            hasMucous = true;
            mucousCount += units;
          }
          if (normalizedConsistency === "greasy") {
            hasGreasy = true;
            greasyCount += units;
          }
        } else if (["dry", "hard"].includes(normalizedConsistency)) {
          consistency.dry += units;
          consistencyTotals.dry += units;
          hasDry = true;
        } else {
          consistency.normal += units;
          consistencyTotals.normal += units;
        }

        const readingIssues = Array.isArray(r.issues) ? r.issues : [];
        readingIssues.forEach((issue) => {
          if (typeof issue !== "string") return;
          const normalized = issue.toLowerCase();
          issuesSet.add(issue);
          if (normalized.includes("mucous") || normalized.includes("mucus")) {
            hasMucous = true;
            mucousCount += units;
          }
          if (normalized.includes("greasy")) {
            hasGreasy = true;
            greasyCount += units;
          }
          if (normalized.includes("parasite") || normalized.includes("worm")) {
            weekHasParasites = true;
            parasiteCount += units;
          }
          if (normalized.includes("foreign")) {
            hasForeign = true;
            foreignCount += units;
          }
          if (normalized.includes("dry")) {
            hasDry = true;
          }
        });
      });

      // Build issues list in plain language
      const totalWeekReadings = totalWeekUnits || weekReadings.length || 0;
      const softRatio =
        totalWeekReadings > 0 ? weekSoftCount / totalWeekReadings : 0;

      if (softRatio >= WELLNESS_THRESHOLDS.SOFT_CONSISTENCY_THRESHOLD) {
        issuesSet.add("Soft consistency");
        totalSoftWeeks++;
        consecutiveHighSoft++;
        maxConsecutiveSoft = Math.max(maxConsecutiveSoft, consecutiveHighSoft);
      } else {
        consecutiveHighSoft = 0;
      }

      if (colors.red > 0 || colors.black > 0) {
        issuesSet.add(colors.red > 0 ? "Red traces" : "Black color");
        totalAlertWeeks++;
      }

      if (colors.yellow > 0) {
        issuesSet.add("Yellow color");
      }

      if (hasMucous || hasGreasy) {
        issuesSet.add(
          hasMucous && hasGreasy
            ? "Mucous & greasy"
            : hasMucous
              ? "Mucous"
              : "Greasy",
        );
        weekHasParasites = true;
        if (hasMucous) {
          parasiteCount += 1;
        }
      }

      if (hasDry) {
        issuesSet.add("Dry consistency");
      }

      if (hasForeign) {
        issuesSet.add("Possible foreign material");
      }

      // Determine status for this individual week
      const weekHasCritical = colors.red > 0 || colors.black > 0;
      const weekHasYellow = colors.yellow > 0;
      const issues = Array.from(issuesSet);
      const weekHasIssues = issues.length > 0;
      const weekStatus = determineWeekStatus(
        softRatio,
        weekHasCritical,
        weekHasYellow,
        weekHasIssues,
      );

      const hasImage = weekReadings.some((reading) => Boolean(reading.imageUrl));

      const finalDeposits = totalWeekUnits || weekReadings.length;

      colors.total =
        colors.normal + colors.yellow + colors.red + colors.black;
      consistency.total =
        consistency.normal + consistency.soft + consistency.dry;

      weeklySignals.push({
        mucous: mucousCount,
        greasy: greasyCount,
        parasites: parasiteCount,
        foreign: foreignCount,
      });

      weekly.push({
        startISO: key,
        start: new Date(key),
        deposits: finalDeposits,
        status: weekStatus,
        issues,
        hasImage,
        colors,
        consistency,
      });

      overallHasParasites = overallHasParasites || weekHasParasites;
    }

    // Determine overall latest status
    const latestStatus = determineSimpleStatus(
      totalSoftWeeks,
      maxConsecutiveSoft,
      totalAlertWeeks,
      overallHasParasites,
    );

    // Generate plain language copy
    const latestCopy = generateStatusCopy(
      latestStatus,
      totalSoftWeeks,
      totalAlertWeeks,
      overallHasParasites,
    );

    // Build trends data
    const trends = {
      // Overall trends
      colorTrend: "stable" as const,
      consistencyTrend: "stable" as const,
      overallTrend: "stable" as const,

      // Consistency stack data (last 8 weeks, most recent first)
      consistencyStack: weekly.map((w, i) => ({
        week: `Week ${8 - i}`, // Week 8, Week 7, ..., Week 1
        normal: w.consistency.normal,
        soft: w.consistency.soft,
        dry: w.consistency.dry,
      })),

      // Color donut data
      colorDonut: colorTotals,

      // Color breakdown for lollipop chart
      colorBreakdown: [
        { label: "Normal", count: colorTotals.normal },
        { label: "Yellow", count: colorTotals.yellow },
        { label: "Red", count: colorTotals.red },
        { label: "Black", count: colorTotals.black },
      ],

      // Signal sparklines (weekly counts for last 8 weeks)
      signalSparklines: [
        {
          key: "mucous" as const,
          issues: [],
          series: weeklySignals.map((signal, index) => ({
            x: weeklySignals.length - index,
            y: signal.mucous,
          })),
        },
        {
          key: "greasy" as const,
          issues: [],
          series: weeklySignals.map((signal, index) => ({
            x: weeklySignals.length - index,
            y: signal.greasy,
          })),
        },
        {
          key: "parasites" as const,
          issues: [],
          series: weeklySignals.map((signal, index) => ({
            x: weeklySignals.length - index,
            y: signal.parasites,
          })),
        },
        {
          key: "foreign" as const,
          issues: [],
          series: weeklySignals.map((signal, index) => ({
            x: weeklySignals.length - index,
            y: signal.foreign,
          })),
        },
      ],
    };

    return {
      status: latestStatus,
      confidence: 0.85, // Default confidence score
      latestStatus,
      latestCopy,
      weekly,
      trends,
      insights: [], // TODO: Implement insights generation
      recommendations: [], // TODO: Implement recommendations generation
    };
  }, [dataReadings, _serviceVisits]);
};
