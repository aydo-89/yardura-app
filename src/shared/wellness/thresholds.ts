// Centralized thresholds and decision logic for wellness status
import { WellnessStatus } from './types';

export const WELLNESS_THRESHOLDS = {
  // Soft consistency thresholds
  SOFT_CONSISTENCY_THRESHOLD: 0.3, // 30% soft readings trigger alert
  MAX_CONSECUTIVE_SOFT_WEEKS: 2, // 2+ consecutive soft weeks = action

  // Alert conditions
  MIN_PARASITE_WEEKS: 2, // 2+ weeks with mucous/greasy = parasite indicator

  // Wellness score calculation
  WELLNESS_SCORE_ISSUE_MULTIPLIER: 25, // Subtract 25 points per issue
  WELLNESS_SCORE_MIN: 0,
  WELLNESS_SCORE_MAX: 100,
} as const;

export const determineWellnessStatus = (
  softWeeks: number,
  maxConsecutiveSoft: number,
  alertWeeks: number
): WellnessStatus => {
  // Red conditions (highest priority)
  if (alertWeeks > 0 || maxConsecutiveSoft >= WELLNESS_THRESHOLDS.MAX_CONSECUTIVE_SOFT_WEEKS) {
    return 'action';
  }

  // Amber conditions
  if (softWeeks >= 2) {
    return 'monitor';
  }

  // Default to green
  return 'normal';
};

export const calculateWellnessScore = (
  normalRate: number,
  issueRate: number
): number => {
  const score = Math.max(
    WELLNESS_THRESHOLDS.WELLNESS_SCORE_MIN,
    Math.min(
      WELLNESS_THRESHOLDS.WELLNESS_SCORE_MAX,
      normalRate * 100 - issueRate * WELLNESS_THRESHOLDS.WELLNESS_SCORE_ISSUE_MULTIPLIER
    )
  );

  return Math.round(score);
};

export const shouldShowParasiteWarning = (mucousWeeks: number, greasyWeeks: number): boolean => {
  return Math.max(mucousWeeks, greasyWeeks) >= WELLNESS_THRESHOLDS.MIN_PARASITE_WEEKS;
};
