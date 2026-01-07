export type ParasiteRiskLevel = 'LOW' | 'MODERATE' | 'HIGH';

export type ParasiteRiskMonth = {
  month: number;
  fleasTicks: ParasiteRiskLevel;
  heartworm: ParasiteRiskLevel;
};

type RegionKey = 'WARM' | 'MODERATE' | 'COOL';

const REGION_BY_STATE: Record<string, RegionKey> = {
  AL: 'WARM',
  AK: 'COOL',
  AZ: 'WARM',
  AR: 'MODERATE',
  CA: 'WARM',
  CO: 'COOL',
  CT: 'MODERATE',
  DE: 'MODERATE',
  FL: 'WARM',
  GA: 'WARM',
  HI: 'WARM',
  ID: 'COOL',
  IL: 'MODERATE',
  IN: 'MODERATE',
  IA: 'MODERATE',
  KS: 'MODERATE',
  KY: 'MODERATE',
  LA: 'WARM',
  ME: 'COOL',
  MD: 'MODERATE',
  MA: 'MODERATE',
  MI: 'COOL',
  MN: 'COOL',
  MS: 'WARM',
  MO: 'MODERATE',
  MT: 'COOL',
  NE: 'MODERATE',
  NV: 'WARM',
  NH: 'COOL',
  NJ: 'MODERATE',
  NM: 'WARM',
  NY: 'MODERATE',
  NC: 'MODERATE',
  ND: 'COOL',
  OH: 'MODERATE',
  OK: 'WARM',
  OR: 'MODERATE',
  PA: 'MODERATE',
  RI: 'MODERATE',
  SC: 'WARM',
  SD: 'COOL',
  TN: 'MODERATE',
  TX: 'WARM',
  UT: 'COOL',
  VT: 'COOL',
  VA: 'MODERATE',
  WA: 'MODERATE',
  WV: 'MODERATE',
  WI: 'COOL',
  WY: 'COOL',
  DC: 'MODERATE',
};

const RISK_BY_REGION: Record<RegionKey, ParasiteRiskMonth[]> = {
  WARM: [
    { month: 0, fleasTicks: 'MODERATE', heartworm: 'HIGH' },
    { month: 1, fleasTicks: 'MODERATE', heartworm: 'HIGH' },
    { month: 2, fleasTicks: 'HIGH', heartworm: 'HIGH' },
    { month: 3, fleasTicks: 'HIGH', heartworm: 'HIGH' },
    { month: 4, fleasTicks: 'HIGH', heartworm: 'HIGH' },
    { month: 5, fleasTicks: 'HIGH', heartworm: 'HIGH' },
    { month: 6, fleasTicks: 'HIGH', heartworm: 'HIGH' },
    { month: 7, fleasTicks: 'HIGH', heartworm: 'HIGH' },
    { month: 8, fleasTicks: 'HIGH', heartworm: 'HIGH' },
    { month: 9, fleasTicks: 'HIGH', heartworm: 'HIGH' },
    { month: 10, fleasTicks: 'MODERATE', heartworm: 'HIGH' },
    { month: 11, fleasTicks: 'MODERATE', heartworm: 'HIGH' },
  ],
  MODERATE: [
    { month: 0, fleasTicks: 'LOW', heartworm: 'LOW' },
    { month: 1, fleasTicks: 'LOW', heartworm: 'LOW' },
    { month: 2, fleasTicks: 'MODERATE', heartworm: 'MODERATE' },
    { month: 3, fleasTicks: 'MODERATE', heartworm: 'MODERATE' },
    { month: 4, fleasTicks: 'HIGH', heartworm: 'HIGH' },
    { month: 5, fleasTicks: 'HIGH', heartworm: 'HIGH' },
    { month: 6, fleasTicks: 'HIGH', heartworm: 'HIGH' },
    { month: 7, fleasTicks: 'HIGH', heartworm: 'HIGH' },
    { month: 8, fleasTicks: 'MODERATE', heartworm: 'MODERATE' },
    { month: 9, fleasTicks: 'MODERATE', heartworm: 'MODERATE' },
    { month: 10, fleasTicks: 'LOW', heartworm: 'LOW' },
    { month: 11, fleasTicks: 'LOW', heartworm: 'LOW' },
  ],
  COOL: [
    { month: 0, fleasTicks: 'LOW', heartworm: 'LOW' },
    { month: 1, fleasTicks: 'LOW', heartworm: 'LOW' },
    { month: 2, fleasTicks: 'LOW', heartworm: 'MODERATE' },
    { month: 3, fleasTicks: 'MODERATE', heartworm: 'MODERATE' },
    { month: 4, fleasTicks: 'HIGH', heartworm: 'MODERATE' },
    { month: 5, fleasTicks: 'HIGH', heartworm: 'HIGH' },
    { month: 6, fleasTicks: 'HIGH', heartworm: 'HIGH' },
    { month: 7, fleasTicks: 'HIGH', heartworm: 'MODERATE' },
    { month: 8, fleasTicks: 'MODERATE', heartworm: 'MODERATE' },
    { month: 9, fleasTicks: 'MODERATE', heartworm: 'MODERATE' },
    { month: 10, fleasTicks: 'LOW', heartworm: 'LOW' },
    { month: 11, fleasTicks: 'LOW', heartworm: 'LOW' },
  ],
};

export function getParasiteRiskForState(state?: string | null): ParasiteRiskMonth[] {
  const region = state ? REGION_BY_STATE[state.toUpperCase()] : null;
  return RISK_BY_REGION[region ?? 'MODERATE'];
}

export function getRegionLabel(state?: string | null): string {
  const region = state ? REGION_BY_STATE[state.toUpperCase()] : null;
  if (region === 'WARM') return 'Warm climate';
  if (region === 'COOL') return 'Cool climate';
  return 'Moderate climate';
}
