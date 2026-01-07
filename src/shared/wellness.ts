// Shared wellness types and constants
export const TONE_GREEN = "#19B4A3";
export const TONE_AMBER = "#FFC24D";
export const TONE_RED = "#F3645B";

export const COLOR_HEX = {
  normal: "#B07749",
  yellow: "#FFC24D",
  red: "#F3645B",
  black: "#1B1E23",
} as const;

export const CONS_HEX = {
  normal: "#19B4A3",
  soft: "#FFC24D",
  dry: "#F3645B",
} as const;

export const wellnessTheme = {
  colors: {
    green: TONE_GREEN,
    amber: TONE_AMBER,
    red: TONE_RED,
    mint: "#19B4A3",
    gold: "#FFC24D",
    coral: "#F3645B",
    evergreen: "#204B36",
    teal: "#19B4A3",
    yellow: "#FFC24D",
    orange: "#FF7A45",
    blue: "#204B36",
  },
  slate800: "#1B1E23",
  gradients: {
    good: "linear-gradient(135deg, #19B4A3 0%, #0F786F 100%)",
    monitor: "linear-gradient(135deg, #FFC24D 0%, #E5A324 100%)",
    attention: "linear-gradient(135deg, #F3645B 0%, #C43D37 100%)",
  },
  slate50: "#FAF7F1",
  slate200: "#E5DED0",
  radiusLg: "12px",
  cardShadow:
    "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
} as const;

export type WellnessStatus = "good" | "monitor" | "attention";
export type WellnessSimpleStatus = "good" | "monitor" | "attention";

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
  volume?: number; // Optional total deposits captured for this reading
  consistencyLabel?: string; // Optional single consistency descriptor for legacy data
  contentLabel?: string; // Optional content descriptor (3rd C)
  issues: string[];
  imageUrl?: string;
  source?: "OWNER" | "PRO";
  dogName?: string;
  hydrationScore?: number;
  firmnessScale?: number;
  indicator?: "watch" | "monitor" | "vet_now";
  summary?: string;
  whatThisCouldMean?: string;
}

export interface ServiceVisit {
  id: string;
  date: string;
  type: "residential" | "commercial";
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
    colorTrend: "improving" | "stable" | "declining";
    consistencyTrend: "improving" | "stable" | "declining";
    overallTrend: "improving" | "stable" | "declining";
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
    case "good":
      return TONE_GREEN;
    case "monitor":
      return TONE_AMBER;
    case "attention":
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
    normal: "normal",
    yellow: "yellow",
    red: "red",
    black: "black",
    brown: "normal",
    white: "normal",
    orange: "yellow",
    dark: "black",
  };
  return colorMap[color.toLowerCase()] || "normal";
}

export function consistencyKeyFor(consistency: string): string {
  const consistencyMap: Record<string, string> = {
    normal: "normal",
    soft: "soft",
    firm: "dry",
    hard: "dry",
    runny: "soft",
    watery: "soft",
    mushy: "soft",
    formed: "normal",
    loose: "soft",
    dry: "dry",
    mucous: "mucous",
    greasy: "greasy",
  };
  return consistencyMap[consistency.toLowerCase()] || "normal";
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
  return weekStart.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function determineWellnessStatus(
  colorScore: number,
  consistencyScore: number,
  totalDeposits: number,
): "good" | "monitor" | "attention" {
  if (
    colorScore <= WELLNESS_THRESHOLDS.RED_COLOR_THRESHOLD &&
    consistencyScore <= WELLNESS_THRESHOLDS.SOFT_CONSISTENCY_THRESHOLD
  ) {
    return "good";
  }

  if (
    colorScore > WELLNESS_THRESHOLDS.RED_COLOR_THRESHOLD ||
    consistencyScore > WELLNESS_THRESHOLDS.CRITICAL_SOFT_RATIO
  ) {
    return "attention";
  }

  return "monitor";
}

export function calculateWellnessScore(
  readings: any[],
  weeks: number = 4,
): { colorScore: number; consistencyScore: number; overallScore: number } {
  const recent = Array.isArray(readings) ? readings.slice(0, weeks * 10) : [];
  if (recent.length === 0) {
    return { colorScore: 0, consistencyScore: 0, overallScore: 0 };
  }

  let colorIssues = 0;
  let softIssues = 0;

  recent.forEach((reading: any) => {
    const color = typeof reading?.color === "string" ? reading.color.toLowerCase() : "";
    if (["yellow", "red", "black", "dark", "light", "mixed"].includes(color)) {
      colorIssues += 1;
    }

    const consistency = typeof reading?.consistencyLabel === "string"
      ? reading.consistencyLabel.toLowerCase()
      : typeof reading?.consistency === "string"
        ? reading.consistency.toLowerCase()
        : "";
    if (["soft", "loose", "watery", "mucous", "greasy"].includes(consistency)) {
      softIssues += 1;
    }
  });

  const total = recent.length;
  const colorScore = (colorIssues / total) * 3;
  const consistencyScore = softIssues / total;
  const overallScore = Math.max(0, 1 - (colorScore / 3) * 0.6 - consistencyScore * 0.4);

  return { colorScore, consistencyScore, overallScore };
}

export function shouldShowParasiteWarning(
  readings: any[],
  weeks: number = 4,
): boolean {
  const recent = Array.isArray(readings) ? readings.slice(0, weeks * 10) : [];
  return recent.some((reading: any) => {
    const issues = Array.isArray(reading?.issues) ? reading.issues : [];
    return issues.some(
      (issue: unknown) =>
        typeof issue === "string" &&
        /parasite|worm|mucous|mucus/i.test(issue),
    );
  });
}
