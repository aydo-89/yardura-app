export type ScooperRewardTier = {
  slug: string;
  name: string;
  minPoints: number;
  maxPoints?: number;
  perks: string[];
};

export const SCOOPER_REWARD_TIERS: ScooperRewardTier[] = [
  {
    slug: "rookie",
    name: "Rookie",
    minPoints: 0,
    maxPoints: 1999,
    perks: ["Access to rewards catalog"],
  },
  {
    slug: "route-pro",
    name: "Route Pro",
    minPoints: 2000,
    maxPoints: 6999,
    perks: ["Priority support", "Early bonus access"],
  },
  {
    slug: "elite",
    name: "Elite",
    minPoints: 7000,
    maxPoints: 14999,
    perks: ["Faster reward fulfillment", "Priority bonus reviews"],
  },
  {
    slug: "legend",
    name: "Legend",
    minPoints: 15000,
    perks: ["Top-tier recognition", "Exclusive bonus drops"],
  },
];

export type ScooperTierProgress = {
  earnedPoints: number;
  current: ScooperRewardTier;
  next: ScooperRewardTier | null;
  pointsToNext: number | null;
  progressPct: number;
};

export function getScooperTierProgress(earnedPoints: number): ScooperTierProgress {
  const safePoints = Number.isFinite(earnedPoints) ? Math.max(0, earnedPoints) : 0;
  const tiers = [...SCOOPER_REWARD_TIERS].sort((a, b) => a.minPoints - b.minPoints);
  const current =
    tiers.find((tier) => {
      const max = tier.maxPoints ?? Number.POSITIVE_INFINITY;
      return safePoints >= tier.minPoints && safePoints <= max;
    }) ?? tiers[0];
  const currentIndex = tiers.findIndex((tier) => tier.slug === current.slug);
  const next = currentIndex >= 0 && currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null;
  const pointsToNext = next ? Math.max(0, next.minPoints - safePoints) : null;
  const currentSpan = (current.maxPoints ?? next?.minPoints ?? current.minPoints + 1) - current.minPoints;
  const progressPct = currentSpan > 0 ? Math.min(1, (safePoints - current.minPoints) / currentSpan) : 1;

  return {
    earnedPoints: safePoints,
    current,
    next,
    pointsToNext,
    progressPct,
  };
}
