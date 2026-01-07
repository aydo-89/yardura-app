import { addDays } from 'date-fns';

export const WELLNESS_REWARD_RULES = {
  basePoints: 10,
  symptomBonus: 5,
  notesBonus: 3,
  vetBonus: 30,
  streakStep: 2,
  streakMax: 10,
};

export type WellnessPointsBreakdown = {
  basePoints: number;
  symptomBonus: number;
  notesBonus: number;
  vetBonus: number;
  streakBonus: number;
  totalPoints: number;
};

export function getWeekKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function calculateStreak(
  weekStarts: Date[],
  anchorWeekStart: Date,
): number {
  const set = new Set(weekStarts.map(getWeekKey));
  let streak = 0;
  let cursor = new Date(anchorWeekStart);

  while (set.has(getWeekKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -7);
  }

  return streak;
}

export function calculateReportPoints(input: {
  noIssues: boolean;
  symptomTags?: string[] | null;
  behaviorNotes?: string | null;
  stoolNotes?: string | null;
  diagnosisSource?: string | null;
  diagnosisLabel?: string | null;
}, streakCount: number): WellnessPointsBreakdown {
  const basePoints = WELLNESS_REWARD_RULES.basePoints;
  const symptomBonus =
    input.noIssues || !input.symptomTags?.length
      ? 0
      : WELLNESS_REWARD_RULES.symptomBonus;
  const notesBonus =
    input.noIssues || !(input.behaviorNotes || input.stoolNotes)
      ? 0
      : WELLNESS_REWARD_RULES.notesBonus;
  const vetBonus =
    input.diagnosisSource === 'VET_CONFIRMED'
      ? WELLNESS_REWARD_RULES.vetBonus
      : 0;

  const streakBonusRaw =
    Math.max(0, streakCount - 1) * WELLNESS_REWARD_RULES.streakStep;
  const streakBonus = Math.min(streakBonusRaw, WELLNESS_REWARD_RULES.streakMax);

  const totalPoints =
    basePoints + symptomBonus + notesBonus + vetBonus + streakBonus;

  return {
    basePoints,
    symptomBonus,
    notesBonus,
    vetBonus,
    streakBonus,
    totalPoints,
  };
}
