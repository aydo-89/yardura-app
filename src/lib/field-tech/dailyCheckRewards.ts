import { convertUtcToZonedParts, SERVICE_TIME_ZONE } from "@/lib/timezone";

export const SCOOPER_CHECKIN_REWARD_RULES = {
  basePoints: 10,
  streakStep: 2,
  streakMax: 10,
  milestoneBonuses: {
    5: 15,
    10: 30,
    20: 60,
  } as Record<number, number>,
};

export type ScooperCheckInPointsBreakdown = {
  basePoints: number;
  streakBonus: number;
  milestoneBonus: number;
  totalPoints: number;
};

export type ScooperCheckInMilestone = {
  days: number;
  bonusPoints: number;
};

function formatDayKey(year: number, month: number, day: number) {
  const paddedMonth = String(month).padStart(2, "0");
  const paddedDay = String(day).padStart(2, "0");
  return `${year}-${paddedMonth}-${paddedDay}`;
}

function shiftDayKey(dayKey: string, deltaDays: number) {
  const [year, month, day] = dayKey.split("-").map((value) => Number(value));
  const anchor = new Date(Date.UTC(year, month - 1, day));
  anchor.setUTCDate(anchor.getUTCDate() + deltaDays);
  return formatDayKey(
    anchor.getUTCFullYear(),
    anchor.getUTCMonth() + 1,
    anchor.getUTCDate(),
  );
}

export function getDayKey(date: Date, timeZone?: string): string {
  if (!timeZone) {
    return date.toISOString().slice(0, 10);
  }
  const parts = convertUtcToZonedParts(date, timeZone);
  return formatDayKey(parts.year, parts.month, parts.day);
}

export function calculateDailyStreak(
  dayKeys: Date[],
  anchorDay: Date,
  timeZone: string = SERVICE_TIME_ZONE,
): number {
  const set = new Set(dayKeys.map((day) => getDayKey(day, timeZone)));
  let streak = 0;
  let cursorKey = getDayKey(anchorDay, timeZone);

  while (set.has(cursorKey)) {
    streak += 1;
    cursorKey = shiftDayKey(cursorKey, -1);
  }

  return streak;
}

export function calculateDailyCheckPoints(streakCount: number): ScooperCheckInPointsBreakdown {
  const basePoints = SCOOPER_CHECKIN_REWARD_RULES.basePoints;
  const streakBonusRaw = Math.max(0, streakCount - 1) * SCOOPER_CHECKIN_REWARD_RULES.streakStep;
  const streakBonus = Math.min(streakBonusRaw, SCOOPER_CHECKIN_REWARD_RULES.streakMax);
  const milestoneBonus =
    SCOOPER_CHECKIN_REWARD_RULES.milestoneBonuses[streakCount] ?? 0;
  const totalPoints = basePoints + streakBonus + milestoneBonus;

  return {
    basePoints,
    streakBonus,
    milestoneBonus,
    totalPoints,
  };
}

export function getNextMilestone(streakCount: number): ScooperCheckInMilestone | null {
  const milestones = Object.keys(SCOOPER_CHECKIN_REWARD_RULES.milestoneBonuses)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  const next = milestones.find((value) => value > streakCount);
  if (!next) return null;
  return {
    days: next,
    bonusPoints: SCOOPER_CHECKIN_REWARD_RULES.milestoneBonuses[next] ?? 0,
  };
}

export type DailyCheckRewardSummary = {
  pointsBalance: number;
  streakCount: number;
  streakIfSubmit: number;
  pointsRules: typeof SCOOPER_CHECKIN_REWARD_RULES;
  pointsPreview: ScooperCheckInPointsBreakdown;
  lastPointsAwarded: number | null;
  nextMilestone: ScooperCheckInMilestone | null;
};

export function buildDailyCheckRewardSummary(
  checks: Array<{ capturedAt: Date; pointsAwarded: number | null }>,
  latestCheck: { capturedAt: Date; pointsAwarded: number | null } | null,
  anchorDate: Date,
  spentPoints: number = 0,
  timeZone: string = SERVICE_TIME_ZONE,
): DailyCheckRewardSummary {
  const dayKeys = checks.map((check) => check.capturedAt);
  const streakCount = latestCheck
    ? calculateDailyStreak(dayKeys, latestCheck.capturedAt, timeZone)
    : 0;
  const streakIfSubmit = Math.max(
    1,
    calculateDailyStreak([...dayKeys, anchorDate], anchorDate, timeZone),
  );
  const pointsPreview = calculateDailyCheckPoints(streakIfSubmit);
  const pointsByDay = new Map<string, number>();
  checks.forEach((check) => {
    const dayKey = getDayKey(check.capturedAt, timeZone);
    const points = check.pointsAwarded ?? 0;
    const existing = pointsByDay.get(dayKey) ?? 0;
    pointsByDay.set(dayKey, Math.max(existing, points));
  });
  const earnedPoints = Array.from(pointsByDay.values()).reduce(
    (sum, points) => sum + points,
    0,
  );
  const pointsBalance = Math.max(0, earnedPoints - spentPoints);

  return {
    pointsBalance,
    streakCount,
    streakIfSubmit,
    pointsRules: SCOOPER_CHECKIN_REWARD_RULES,
    pointsPreview,
    lastPointsAwarded: latestCheck?.pointsAwarded ?? null,
    nextMilestone: getNextMilestone(streakCount),
  };
}
