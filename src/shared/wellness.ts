// Shared wellness types and constants
export const TONE_GREEN = '#10B981';
export const TONE_AMBER = '#F59E0B';
export const TONE_RED = '#EF4444';

export const COLOR_HEX = {
  normal: '#8B5A3C',
  yellow: '#FCD34D',
  red: '#EF4444',
  black: '#1F2937',
} as const;

export const CONS_HEX = {
  normal: '#10B981',
  soft: '#F59E0B',
  dry: '#EF4444',
} as const;

export const wellnessTheme = {
  colors: {
    green: TONE_GREEN,
    amber: TONE_AMBER,
    red: TONE_RED,
    teal: '#0EA5E9',
    yellow: '#FCD34D',
    orange: '#F97316',
    blue: '#3B82F6',
  },
  slate800: '#1E293B',
  gradients: {
    good: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    monitor: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
    attention: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
  },
  slate50: '#F8FAFC',
  slate200: '#E2E8F0',
  radiusLg: '12px',
  cardShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
} as const;

export type WellnessStatus = 'good' | 'monitor' | 'attention';
export type WellnessSimpleStatus = 'good' | 'monitor' | 'attention';

export interface ColorStatsWindow {
  yellow: number;
  red: number;
  black: number;
  normal: number;
  total: number;
}

export interface ConsistencyStatsWindow {
  normal: number;
  soft: number;
  dry: number;
  total: number;
}

// Extended stats with count/pct structure for component use
export interface ColorStatsWithDetails {
  normal: { count: number; pct: number };
  yellow: { count: number; pct: number };
  red: { count: number; pct: number };
  black: { count: number; pct: number };
}

export interface ConsistencyStatsWithDetails {
  normal: { count: number; pct: number };
  soft: { count: number; pct: number };
  dry: { count: number; pct: number };
}

export interface WeekRollup {
  startISO: string;
  start: Date; // Added for backward compatibility
  deposits: number;
  colors: ColorStatsWindow;
  consistency: ConsistencyStatsWindow;
  issues: string[];
  status: WellnessStatus;
  // Additional properties expected by components
  label?: string;
  avgWeight?: number;
  healthStatus?: string;
  wellnessScore?: number;
  hasImage?: boolean;
}

export interface DataReading {
  id: string;
  timestamp: string;
  colors: ColorStatsWindow;
  consistency: ConsistencyStatsWindow;
  color?: string; // Legacy single color property for backward compatibility
  weight?: number; // Optional weight property
  issues: string[];
  imageUrl?: string;
}

export interface ServiceVisit {
  id: string;
  date: string;
  type: 'residential' | 'commercial';
  areas: string[];
  notes?: string;
}

export interface WellnessComputed {
  status: WellnessStatus;
  confidence: number;
  latestStatus: WellnessStatus;
  latestCopy: {
    title: string;
    subtitle: string;
    advice: string[];
    cta?: { text: string; action: string; href?: string; label?: string };
  };
  weekly: WeekRollup[];
  trends: {
    colorTrend: 'improving' | 'stable' | 'declining';
    consistencyTrend: 'improving' | 'stable' | 'declining';
    overallTrend: 'improving' | 'stable' | 'declining';
    colorDonut: {
      normal: number;
      yellow: number;
      red: number;
      black: number;
    };
    consistencyStack: {
      normal: number;
      soft: number;
      dry: number;
    }[];
    signalSparklines: {
      key: string;
      series: { x: number; y: number }[];
      issues: string[];
    }[];
  };
  insights: string[];
  recommendations: string[];
}

export function toneForStatus(status: WellnessStatus): string {
  switch (status) {
    case 'good':
      return TONE_GREEN;
    case 'monitor':
      return TONE_AMBER;
    case 'attention':
      return TONE_RED;
    default:
      return TONE_GREEN;
  }
}

// Helper functions for wellness data processing
export function mondayStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  return new Date(d.setDate(diff));
}

export function colorKeyFor(color: string): string {
  const colorMap: Record<string, string> = {
    'normal': 'normal',
    'yellow': 'yellow',
    'red': 'red',
    'black': 'black',
    'brown': 'normal',
    'white': 'normal',
    'orange': 'yellow',
    'dark': 'black',
  };
  return colorMap[color.toLowerCase()] || 'normal';
}

export function consistencyKeyFor(consistency: string): string {
  const consistencyMap: Record<string, string> = {
    'normal': 'normal',
    'soft': 'soft',
    'firm': 'dry',
    'hard': 'dry',
    'runny': 'soft',
    'watery': 'soft',
    'mushy': 'soft',
    'formed': 'normal',
    'loose': 'soft',
    'dry': 'dry',
    'mucous': 'mucous',
    'greasy': 'greasy',
  };
  return consistencyMap[consistency.toLowerCase()] || 'normal';
}

// Wellness thresholds for analysis
export const WELLNESS_THRESHOLDS = {
  SOFT_CONSISTENCY_THRESHOLD: 0.3, // 30% soft consistency threshold
  HIGH_SOFT_RATIO: 0.4, // 40% considered high
  CRITICAL_SOFT_RATIO: 0.5, // 50% considered critical
  YELLOW_COLOR_THRESHOLD: 2, // 2+ yellow occurrences
  RED_COLOR_THRESHOLD: 1, // 1+ red occurrence
  BLACK_COLOR_THRESHOLD: 1, // 1+ black occurrence
  CONSECUTIVE_SOFT_WEEKS: 2, // 2+ consecutive weeks of high soft ratio
} as const;

// Missing utility functions that are imported in useWellnessData
export function formatWeekLabel(weekStart: Date): string {
  return weekStart.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}

export function determineWellnessStatus(
  colorScore: number,
  consistencyScore: number,
  totalDeposits: number
): 'good' | 'monitor' | 'attention' {
  if (colorScore <= WELLNESS_THRESHOLDS.RED_COLOR_THRESHOLD &&
      consistencyScore <= WELLNESS_THRESHOLDS.SOFT_CONSISTENCY_THRESHOLD) {
    return 'good';
  }

  if (colorScore > WELLNESS_THRESHOLDS.RED_COLOR_THRESHOLD ||
      consistencyScore > WELLNESS_THRESHOLDS.CRITICAL_SOFT_RATIO) {
    return 'attention';
  }

  return 'monitor';
}

export function calculateWellnessScore(
  readings: any[],
  weeks: number = 4
): { colorScore: number; consistencyScore: number; overallScore: number } {
  // Simple implementation - would need more sophisticated logic in production
  const colorScore = Math.random() * 3; // Mock score
  const consistencyScore = Math.random() * 0.5; // Mock score
  const overallScore = (colorScore + consistencyScore * 10) / 2;

  return { colorScore, consistencyScore, overallScore };
}

export function shouldShowParasiteWarning(
  readings: any[],
  weeks: number = 4
): boolean {
  // Mock implementation - would check for patterns indicating parasites
  return Math.random() > 0.8; // 20% chance of showing warning
}

