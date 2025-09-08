import { useMemo } from 'react';
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
} from '@/shared/wellness';

// Helper function to determine simple status for overall trends
const determineSimpleStatus = (
  softWeeks: number,
  maxConsec: number,
  alertWeeks: number,
  hasCriticalIssues: boolean
): WellnessSimpleStatus => {
  // Red conditions: critical issues (red/black color, consecutive soft ≥ 2)
  if (alertWeeks > 0 || maxConsec >= 2 || hasCriticalIssues) {
    return 'attention';
  }
  // Yellow conditions: soft issues but not critical
  if (softWeeks > 0) {
    return 'monitor';
  }
  // Green: everything normal
  return 'good';
};

// Helper function to determine status for individual week
const determineWeekStatus = (
  softRatio: number,
  hasCriticalIssues: boolean,
  hasYellowColor: boolean,
  hasIssues: boolean
): WellnessSimpleStatus => {
  // Red conditions: critical issues (red/black color)
  if (hasCriticalIssues) {
    return 'attention';
  }
  // Yellow conditions: soft consistency, yellow color, or other issues
  if (softRatio >= WELLNESS_THRESHOLDS.SOFT_CONSISTENCY_THRESHOLD || hasYellowColor || hasIssues) {
    return 'monitor';
  }
  // Green: everything normal
  return 'good';
};

// Generate plain language copy based on status
const generateStatusCopy = (
  status: WellnessSimpleStatus,
  softWeeks: number,
  alertWeeks: number,
  hasParasites: boolean
) => {
  switch (status) {
    case 'good':
      return {
        title: 'All good',
        subtitle: 'Your dog\'s waste patterns look healthy and normal.',
        advice: [
          'Keep up the great work with their diet and exercise!',
          'Continue regular monitoring to stay on top of any changes.',
        ],
      };

    case 'monitor':
      return {
        title: 'Keep an eye on this',
        subtitle: `We've noticed some changes in ${softWeeks} week${softWeeks > 1 ? 's' : ''}.`,
        advice: [
          'Consider adding more fiber to their diet (like pumpkin or sweet potato)',
          'Make sure they\'re getting plenty of fresh water',
          'Track these patterns for the next few days',
        ],
      };

    case 'attention':
      return {
        title: 'Needs attention',
        subtitle: hasParasites
          ? 'We\'re seeing some concerning patterns that may need veterinary attention.'
          : 'There are some patterns here that deserve closer attention.',
        advice: [
          'Consider scheduling a vet visit to rule out any underlying issues',
          'Keep detailed notes about their diet, behavior, and any symptoms',
          'Monitor closely and contact your vet if patterns persist',
        ],
        cta: {
          label: 'Consult a Vet',
          href: '/consult',
        },
      };
  }
};

export const useWellnessData = (
  dataReadings: DataReading[],
  serviceVisits: ServiceVisit[]
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
    const weekly: WellnessComputed['weekly'] = [];
    let currentWeekStart = mondayStart(now);

    let totalSoftWeeks = 0;
    let totalAlertWeeks = 0;
    let maxConsecutiveSoft = 0;
    let consecutiveHighSoft = 0;
    let hasParasites = false;

    // Color totals for donut chart
    const colorTotals = { normal: 0, yellow: 0, red: 0, black: 0 };
    // Consistency totals for stack chart
    const consistencyTotals = { normal: 0, soft: 0, dry: 0 };
    // Signal tracking for sparklines
    const signalCounts = { mucous: 0, greasy: 0, dry: 0 };

    for (let i = 0; i < 8; i++) {
      const weekStart = new Date(currentWeekStart);
      const key = weekStart.toISOString().slice(0, 10);
      const weekReadings = byWeek.get(key) || [];

      // Color counts for this week
      const colors = { normal: 0, yellow: 0, red: 0, black: 0 };
      weekReadings.forEach((r) => {
        const colorKey = colorKeyFor(r.color);
        if (colorKey in colors) {
          colors[colorKey as keyof typeof colors]++;
          colorTotals[colorKey as keyof typeof colorTotals]++;
        }
      });

      // Consistency counts for this week
      const consistency = { normal: 0, soft: 0, dry: 0 };
      let weekSoftCount = 0;
      let hasMucous = false;
      let hasGreasy = false;
      let hasDry = false;

      weekReadings.forEach((r) => {
        const consistencyKey = consistencyKeyFor(r.consistency);

        if (consistencyKey === 'normal') {
          consistency.normal++;
          consistencyTotals.normal++;
        } else if (['soft', 'mucous', 'greasy'].includes(consistencyKey)) {
          consistency.soft++;
          consistencyTotals.soft++;
          weekSoftCount++;
          if (consistencyKey === 'mucous') hasMucous = true;
          if (consistencyKey === 'greasy') hasGreasy = true;
        } else if (consistencyKey === 'dry') {
          consistency.dry++;
          consistencyTotals.dry++;
          hasDry = true;
        }
      });

      // Build issues list in plain language
      const issues: string[] = [];
      const totalWeekReadings = Math.max(1, weekReadings.length);
      const softRatio = weekSoftCount / totalWeekReadings;

      if (softRatio >= WELLNESS_THRESHOLDS.SOFT_CONSISTENCY_THRESHOLD) {
        issues.push('Soft consistency');
        totalSoftWeeks++;
        consecutiveHighSoft++;
        maxConsecutiveSoft = Math.max(maxConsecutiveSoft, consecutiveHighSoft);
      } else {
        consecutiveHighSoft = 0;
      }

      if (colors.red > 0 || colors.black > 0) {
        issues.push(colors.red > 0 ? 'Red traces' : 'Black color');
        totalAlertWeeks++;
      }

      if (colors.yellow > 0) {
        issues.push('Yellow color');
      }

      if (hasMucous || hasGreasy) {
        issues.push(hasMucous && hasGreasy ? 'Mucous & greasy' : hasMucous ? 'Mucous' : 'Greasy');
        hasParasites = true;
      }

      if (hasDry) {
        issues.push('Dry consistency');
      }

      // Determine status for this individual week
      const weekHasCritical = colors.red > 0 || colors.black > 0;
      const weekHasYellow = colors.yellow > 0;
      const weekHasIssues = issues.length > 0;
      const weekStatus = determineWeekStatus(
        softRatio,
        weekHasCritical,
        weekHasYellow,
        weekHasIssues
      );

      // Simulate having images (in real implementation, this would check actual data)
      const hasImage = weekReadings.length > 0 && Math.random() > 0.7; // 30% chance for demo

      weekly.push({
        startISO: key,
        deposits: weekReadings.length,
        status: weekStatus,
        issues,
        hasImage,
        colors,
        consistency,
      });

      // Move to previous week
      currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    }

    // Reverse to get most recent first
    weekly.reverse();

    // Determine overall latest status
    const latestStatus = determineSimpleStatus(totalSoftWeeks, maxConsecutiveSoft, totalAlertWeeks, hasParasites);

    // Generate plain language copy
    const latestCopy = generateStatusCopy(latestStatus, totalSoftWeeks, totalAlertWeeks, hasParasites);

    // Build trends data
    const trends = {
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
        { label: 'Normal', count: colorTotals.normal },
        { label: 'Yellow', count: colorTotals.yellow },
        { label: 'Red', count: colorTotals.red },
        { label: 'Black', count: colorTotals.black },
      ],

      // Signal sparklines (weekly counts for last 8 weeks)
      signalSparklines: [
        {
          key: 'mucous' as const,
          series: weekly.map((w, i) => ({
            x: `Week ${8 - i}`,
            y: w.consistency.soft, // Simplified - in real implementation, track mucous separately
          })),
        },
        {
          key: 'greasy' as const,
          series: weekly.map((w, i) => ({
            x: `Week ${8 - i}`,
            y: Math.floor(w.consistency.soft * 0.3), // Simulate some being greasy
          })),
        },
        {
          key: 'dry' as const,
          series: weekly.map((w, i) => ({
            x: `Week ${8 - i}`,
            y: w.consistency.dry,
          })),
        },
      ],
    };

    return {
      latestStatus,
      latestCopy,
      weekly,
      trends,
    };
  }, [dataReadings, serviceVisits]);
};
