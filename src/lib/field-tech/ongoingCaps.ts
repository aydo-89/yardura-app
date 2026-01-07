export const SCOOPER_ONGOING_LIMITS: Record<string, number> = {
  rookie: 15,
  'route-pro': 50,
  elite: 100,
  legend: 150,
};

export function resolveScooperOngoingLimit(tierSlug?: string | null): number {
  if (!tierSlug) return SCOOPER_ONGOING_LIMITS.rookie;
  return SCOOPER_ONGOING_LIMITS[tierSlug] ?? SCOOPER_ONGOING_LIMITS.rookie;
}
