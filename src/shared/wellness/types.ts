// Shared types for wellness tracking
export type WellnessStatus = 'normal' | 'monitor' | 'action';
export type WellnessSimpleStatus = 'good' | 'monitor' | 'attention';

export type WeekRollup = {
  start: Date;
  label: string;
  deposits: number;
  avgWeight: number;
  colors: { normal: number; yellow: number; red: number; black: number };
  consistency: { normal: number; soft: number; dry: number };
  issues: string[];
  healthStatus: WellnessStatus;
  wellnessScore: number;
};

export type WindowStats = {
  count: number;
  pct: number;
};

export type ColorStatsWindow = Record<'normal' | 'yellow' | 'red' | 'black', WindowStats>;

export type ConsistencyStatsWindow = Record<'normal' | 'soft' | 'dry', WindowStats>;

export type RecentSummary = {
  currentWeekStatus: WellnessStatus;
  currentWeekIssues: string[];
  avgWellness4w: number;
  totalDeposits4w: number;
};

export type DataReading = {
  id: string;
  timestamp: string;
  weight?: number | null;
  volume?: number | null;
  color?: string | null;
  consistency?: string | null;
};

export type ServiceVisit = {
  id: string;
  scheduledDate: string;
  status: string;
  serviceType: string;
  yardSize: string; // This is actually a string in the data
};

// New types for redesigned wellness tab
export type WellnessComputed = {
  latestStatus: WellnessSimpleStatus;
  latestCopy: {
    title: string;
    subtitle: string;
    advice: string[];
    cta?: { label: string; href: string }
  };
  weekly: Array<{
    startISO: string;
    deposits: number;
    status: WellnessSimpleStatus;
    issues: string[]; // e.g., ["Soft", "Yellow", "Red traces"]
    hasImage: boolean;
    // aggregates
    colors: { normal: number; yellow: number; red: number; black: number };
    consistency: { normal: number; soft: number; dry: number };
  }>;
  trends: {
    consistencyStack: Array<{ week: string; normal: number; soft: number; dry: number }>;
    colorDonut: { normal: number; yellow: number; red: number; black: number };
    colorBreakdown: Array<{ label: string; count: number }>;
    signalSparklines: Array<{ key: 'mucous'|'greasy'|'dry'; series: Array<{ x: string; y: number }> }>;
  };
};

export type SignalType = 'mucous' | 'greasy' | 'dry';
