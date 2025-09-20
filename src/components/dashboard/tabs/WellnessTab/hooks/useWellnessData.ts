import { useMemo } from "react";
import {
  mondayStart,
  formatWeekLabel,
  colorKeyFor,
  consistencyKeyFor,
  determineWellnessStatus,
  calculateWellnessScore,
  shouldShowParasiteWarning,
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
        title: "All good",
        subtitle: "Your dog's waste patterns look healthy and normal.",
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
  serviceVisits: ServiceVisit[],
): WellnessComputed => {
  return useMemo(() => {
    const now = new Date();

    // Generate mock data if no real data is available
    const hasRealData = dataReadings && dataReadings.length > 0;

    // Process readings into weekly buckets
    const byWeek = new Map<string, DataReading[]>();
    if (hasRealData) {
      dataReadings.forEach((reading) => {
        const weekStart = mondayStart(new Date(reading.timestamp));
        const key = weekStart.toISOString().slice(0, 10);
        const readings = byWeek.get(key) || [];
        readings.push(reading);
        byWeek.set(key, readings);
      });
    }

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
    // Signal tracking for sparklines
    const signalCounts = {
      mucous: 0,
      greasy: 0,
      dry: 0,
      parasites: 0,
      foreign: 0,
    };

    for (let i = 0; i < 8; i++) {
      const weekStart = new Date(currentWeekStart);
      weekStart.setDate(weekStart.getDate() - i * 7); // Go back i weeks
      const key = weekStart.toISOString().slice(0, 10);
      const weekReadings = byWeek.get(key) || [];

      // Generate mock data if no real data exists OR if this specific week has no readings
      const mockColors: {
        normal: number;
        yellow: number;
        red: number;
        black: number;
        total: number;
      } = { normal: 0, yellow: 0, red: 0, black: 0, total: 0 };
      const mockConsistency: {
        normal: number;
        soft: number;
        dry: number;
        total: number;
      } = { normal: 0, soft: 0, dry: 0, total: 0 };
      let mockDeposits = 0;
      const useMockForThisWeek = !hasRealData || weekReadings.length === 0;

      if (useMockForThisWeek) {
        // Generate realistic mock data for ALL WEEKS
        // Healthy dogs typically have 10-21 bowel movements per week (1.4-3 per day) PER DOG
        // For 1 dog: ~14/week (2/day), for 2 dogs: ~28/week (2/day each), for 3 dogs: ~42/week, etc.

        // Create more consistent deposit patterns across weeks while allowing realistic variation
        // Base: 14-18 deposits per dog per week (more realistic range than 10-22)
        const baseDepositsPerDog = Math.floor(Math.random() * 4) + 14; // 14-18 deposits per dog per week
        mockDeposits = baseDepositsPerDog * 2; // Assume 2 dogs for demo purposes (real app would get from user data)

        // Special handling for Sept 7 week to ensure it has normal deposit counts
        const currentDate = new Date();
        const sept7Date = new Date(currentDate.getFullYear(), 8, 7); // September 7
        const weekDiff = Math.abs(
          (weekStart.getTime() - sept7Date.getTime()) /
            (1000 * 60 * 60 * 24 * 7),
        );

        // More specific check: if this week contains Sept 7 or is adjacent to it
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        const isSept7Week =
          (sept7Date >= weekStart && sept7Date <= weekEnd) ||
          (sept7Date.getTime() >=
            weekStart.getTime() - 7 * 24 * 60 * 60 * 1000 &&
            sept7Date.getTime() <= weekEnd.getTime() + 7 * 24 * 60 * 60 * 1000);

        // Debug: Check if this is the Sept 7 week (September is month 8 in JS)
        const isSept7WeekDebug =
          weekStart.getMonth() === 8 &&
          weekEnd.getMonth() === 8 &&
          weekStart.getDate() <= 7 &&
          weekEnd.getDate() >= 7;

        if (isSept7Week || weekDiff <= 1 || isSept7WeekDebug) {
          // Within 1 week of Sept 7 or contains Sept 7
          // Ensure Sept 7 week has consistent, normal deposit count (26-34 range)
          mockDeposits = 26 + Math.floor(Math.random() * 8);
        } else {
          // Add some weekly variation (±20%) to make it look more realistic
          const variation = (Math.random() - 0.5) * 0.4; // ±20% variation
          mockDeposits = Math.floor(mockDeposits * (1 + variation));

          // Ensure deposits stay in reasonable range: 20-40 per week total
          mockDeposits = Math.max(20, Math.min(40, mockDeposits));
        }

        // Generate readings based on deposits (typically 1-2 readings per deposit)
        const totalReadings = Math.floor(
          mockDeposits * (1 + Math.random() * 0.5),
        ); // 1-1.5 readings per deposit

        // Generate color distribution (ensure some weeks have concerning colors)
        mockColors.normal = Math.floor(
          totalReadings * (0.65 + Math.random() * 0.15),
        ); // 65-80% normal (leave room for concerning colors)
        mockColors.yellow = Math.floor(
          totalReadings * (0.12 + Math.random() * 0.18),
        ); // 12-30% yellow (guaranteed to trigger issues)
        mockColors.red = Math.floor(Math.random() * 3); // 0-2 red (more common for demo)
        mockColors.black = Math.floor(Math.random() * 2); // 0-1 black

        // Generate consistency distribution (ensure soft consistency triggers issues)
        mockConsistency.normal = Math.floor(
          totalReadings * (0.6 + Math.random() * 0.1),
        ); // 60-70% normal
        mockConsistency.soft = Math.floor(
          totalReadings * (0.25 + Math.random() * 0.15),
        ); // 25-40% soft (guaranteed to exceed 30% threshold often)
        mockConsistency.dry =
          totalReadings - mockConsistency.normal - mockConsistency.soft;

        // Ensure non-negative values
        mockConsistency.dry = Math.max(0, mockConsistency.dry);

        // Add total properties for mock data
        mockColors.total =
          mockColors.normal +
          mockColors.yellow +
          mockColors.red +
          mockColors.black;
        mockConsistency.total =
          mockConsistency.normal + mockConsistency.soft + mockConsistency.dry;
      }

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
      if (!useMockForThisWeek) {
        weekReadings.forEach((r) => {
          const colorKey = r.color ? colorKeyFor(r.color) : undefined;
          if (colorKey && typeof colorKey === "string" && colorKey in colors) {
            colors[colorKey as keyof typeof colors]++;
            colorTotals[colorKey as keyof typeof colorTotals]++;
          }
        });
      } else {
        // Use mock data
        colorTotals.normal += colors.normal;
        colorTotals.yellow += colors.yellow;
        colorTotals.red += colors.red;
        colorTotals.black += colors.black;
      }

      // Consistency counts for this week
      let consistency: {
        normal: number;
        soft: number;
        dry: number;
        total: number;
      };
      let weekSoftCount = 0;
      let hasMucous = false;
      let hasGreasy = false;
      let hasDry = false;
      let weekHasParasites = false;
      let hasForeign = false;

      if (useMockForThisWeek) {
        // Use mock data
        consistency = mockConsistency;
        consistencyTotals.normal += consistency.normal;
        consistencyTotals.soft += consistency.soft;
        consistencyTotals.dry += consistency.dry;
      } else {
        consistency = { normal: 0, soft: 0, dry: 0, total: 0 };
        weekReadings.forEach((r) => {
          const consistencyKey =
            typeof r.consistency === "string" ? r.consistency : "normal";

          if (consistencyKey === "normal") {
            consistency.normal++;
            consistencyTotals.normal++;
          } else if (["soft", "mucous", "greasy"].includes(consistencyKey)) {
            consistency.soft++;
            consistencyTotals.soft++;
            weekSoftCount++;
            if (consistencyKey === "mucous") hasMucous = true;
            if (consistencyKey === "greasy") hasGreasy = true;
          } else if (consistencyKey === "dry") {
            consistency.dry++;
            consistencyTotals.dry++;
            hasDry = true;
          }

          // Simulate parasite detection (would normally come from AI analysis)
          if (Math.random() < 0.05) {
            // 5% chance for demo purposes
            weekHasParasites = true;
          }

          // Simulate foreign object detection (would normally come from AI analysis)
          if (Math.random() < 0.03) {
            // 3% chance for demo purposes
            hasForeign = true;
          }
        });
      }

      // Build issues list in plain language
      const issues: string[] = [];
      const totalWeekReadings = Math.max(1, weekReadings.length);
      const softRatio = weekSoftCount / totalWeekReadings;

      if (softRatio >= WELLNESS_THRESHOLDS.SOFT_CONSISTENCY_THRESHOLD) {
        issues.push("Soft consistency");
        totalSoftWeeks++;
        consecutiveHighSoft++;
        maxConsecutiveSoft = Math.max(maxConsecutiveSoft, consecutiveHighSoft);
      } else {
        consecutiveHighSoft = 0;
      }

      if (colors.red > 0 || colors.black > 0) {
        issues.push(colors.red > 0 ? "Red traces" : "Black color");
        totalAlertWeeks++;
      }

      if (colors.yellow > 0) {
        issues.push("Yellow color");
      }

      if (hasMucous || hasGreasy) {
        issues.push(
          hasMucous && hasGreasy
            ? "Mucous & greasy"
            : hasMucous
              ? "Mucous"
              : "Greasy",
        );
        weekHasParasites = true;
      }

      if (hasDry) {
        issues.push("Dry consistency");
      }

      // Determine status for this individual week
      const weekHasCritical = colors.red > 0 || colors.black > 0;
      const weekHasYellow = colors.yellow > 0;
      const weekHasIssues = issues.length > 0;
      const weekStatus = determineWeekStatus(
        softRatio,
        weekHasCritical,
        weekHasYellow,
        weekHasIssues,
      );

      // Simulate having images (in real implementation, this would check actual data)
      const hasImage = !useMockForThisWeek
        ? weekReadings.length > 0 && Math.random() > 0.7 // 30% chance for real data
        : Math.random() > 0.6; // 40% chance for mock data

      const finalDeposits = useMockForThisWeek
        ? mockDeposits
        : weekReadings.length;

      // Calculate totals for colors and consistency
      if (!useMockForThisWeek) {
        colors.total =
          colors.normal + colors.yellow + colors.red + colors.black;
        consistency.total =
          consistency.normal + consistency.soft + consistency.dry;
      }

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

      // Move to previous week
      currentWeekStart.setDate(currentWeekStart.getDate() - 7);

      overallHasParasites = overallHasParasites || weekHasParasites;
    }

    // Reverse to get most recent first
    weekly.reverse();

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
          series: weekly.map((w, i) => {
            // Use the actual issues data if available, otherwise generate mock data
            const weekData = weekly.find((wk) => wk.startISO === w.startISO);
            if (
              weekData &&
              weekData.issues.some((issue) => issue.includes("Mucous"))
            ) {
              return {
                x: 8 - i,
                y: Math.floor(Math.random() * 3) + 1, // 1-3 if mucous detected
              };
            }
            return {
              x: 8 - i,
              y: hasRealData
                ? w.consistency.soft
                : Math.floor(Math.random() * 3) + 1, // 1-3 occurrences per week (no zeros)
            };
          }),
        },
        {
          key: "greasy" as const,
          issues: [],
          series: weekly.map((w, i) => {
            // Use the actual issues data if available, otherwise generate mock data
            const weekData = weekly.find((wk) => wk.startISO === w.startISO);
            if (
              weekData &&
              weekData.issues.some((issue) => issue.includes("Greasy"))
            ) {
              return {
                x: 8 - i,
                y: Math.floor(Math.random() * 2) + 1, // 1-2 if greasy detected
              };
            }
            return {
              x: 8 - i,
              y: hasRealData
                ? Math.floor(w.consistency.soft * 0.3)
                : Math.floor(Math.random() * 2) + 1, // 1-2 occurrences per week (no zeros)
            };
          }),
        },
        {
          key: "parasites" as const,
          issues: [],
          series: weekly.map((w, i) => {
            // Use the actual issues data if available, otherwise generate mock data
            const weekData = weekly.find((wk) => wk.startISO === w.startISO);
            if (
              weekData &&
              weekData.issues.some(
                (issue) => issue.includes("Mucous") || issue.includes("Greasy"),
              )
            ) {
              return {
                x: 8 - i,
                y: Math.floor(Math.random() * 2) + 1, // 1-2 if issues detected
              };
            }
            return {
              x: 8 - i,
              y: hasRealData
                ? Math.random() < 0.1
                  ? Math.floor(Math.random() * 2) + 1
                  : Math.floor(Math.random() * 2)
                : Math.random() < 0.15
                  ? Math.floor(Math.random() * 2) + 1
                  : Math.floor(Math.random() * 2), // More common for demo, some zeros allowed
            };
          }),
        },
        {
          key: "foreign" as const,
          issues: [],
          series: weekly.map((w, i) => {
            // Use the actual issues data if available, otherwise generate mock data
            const weekData = weekly.find((wk) => wk.startISO === w.startISO);
            if (
              weekData &&
              weekData.issues.some((issue) => issue.includes("Yellow"))
            ) {
              return {
                x: 8 - i,
                y: Math.floor(Math.random() * 2) + 1, // 1-2 if yellow color detected
              };
            }
            return {
              x: 8 - i,
              y: hasRealData
                ? Math.random() < 0.08
                  ? Math.floor(Math.random() * 2) + 1
                  : Math.floor(Math.random() * 2)
                : Math.random() < 0.12
                  ? Math.floor(Math.random() * 2) + 1
                  : Math.floor(Math.random() * 2), // More common for demo, some zeros allowed
            };
          }),
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
  }, [dataReadings, serviceVisits]);
};
