// Mock wellness data for development
import type { DataReading, ServiceVisit, WeekRollup } from "@/shared/wellness";

export const mockDataReadings: DataReading[] = [
  {
    id: "1",
    timestamp: "2024-01-15T10:00:00Z",
    colors: {
      yellow: 2,
      red: 0,
      black: 1,
      normal: 15,
      total: 18,
    },
    consistency: {
      normal: 12,
      soft: 4,
      dry: 2,
      total: 18,
    },
    issues: [],
  },
  {
    id: "2",
    timestamp: "2024-01-22T10:00:00Z",
    colors: {
      yellow: 1,
      red: 1,
      black: 0,
      normal: 16,
      total: 18,
    },
    consistency: {
      normal: 14,
      soft: 3,
      dry: 1,
      total: 18,
    },
    issues: ["Yellow stool detected"],
  },
];

export const mockServiceVisits: ServiceVisit[] = [
  {
    id: "1",
    date: "2024-01-10",
    type: "residential",
    areas: ["frontYard", "backYard"],
    notes: "Standard residential service completed successfully.",
  },
  {
    id: "2",
    date: "2024-01-17",
    type: "residential",
    areas: ["frontYard", "backYard", "sideYard"],
    notes: "Additional side yard area serviced.",
  },
];

export const mockWeekRollups: WeekRollup[] = [
  {
    startISO: "2024-01-08",
    start: new Date("2024-01-08"),
    deposits: 18,
    colors: {
      yellow: 3,
      red: 1,
      black: 1,
      normal: 13,
      total: 18,
    },
    consistency: {
      normal: 13,
      soft: 4,
      dry: 1,
      total: 18,
    },
    issues: ["Mild yellow coloring detected"],
    status: "monitor",
  },
  {
    startISO: "2024-01-15",
    start: new Date("2024-01-15"),
    deposits: 18,
    colors: {
      yellow: 2,
      red: 0,
      black: 1,
      normal: 15,
      total: 18,
    },
    consistency: {
      normal: 14,
      soft: 3,
      dry: 1,
      total: 18,
    },
    issues: [],
    status: "good",
  },
];

// Mock scenarios for different wellness states
export const MOCK_SCENARIOS = {
  healthy: {
    name: "Healthy Dog",
    description: "Normal stool with consistent patterns",
    colorTrend: "stable" as const,
    consistencyTrend: "stable" as const,
    overallTrend: "stable" as const,
  },
  monitor: {
    name: "Needs Monitoring",
    description: "Some variations requiring attention",
    colorTrend: "stable" as const,
    consistencyTrend: "declining" as const,
    overallTrend: "stable" as const,
  },
  attention: {
    name: "Requires Attention",
    description: "Significant changes detected",
    colorTrend: "declining" as const,
    consistencyTrend: "declining" as const,
    overallTrend: "declining" as const,
  },
  // Additional scenario keys used by components
  normal_mix: {
    name: "Normal Mix",
    description: "Mixed normal readings",
    colorTrend: "stable" as const,
    consistencyTrend: "stable" as const,
    overallTrend: "stable" as const,
  },
  perfect: {
    name: "Perfect Health",
    description: "Ideal stool characteristics",
    colorTrend: "improving" as const,
    consistencyTrend: "stable" as const,
    overallTrend: "improving" as const,
  },
  red_alert: {
    name: "Red Alert",
    description: "Critical red stool detected",
    colorTrend: "declining" as const,
    consistencyTrend: "stable" as const,
    overallTrend: "declining" as const,
  },
  mucous_alert: {
    name: "Mucous Alert",
    description: "Mucous in stool detected",
    colorTrend: "stable" as const,
    consistencyTrend: "declining" as const,
    overallTrend: "stable" as const,
  },
  yellow_alert: {
    name: "Yellow Alert",
    description: "Yellow stool detected",
    colorTrend: "declining" as const,
    consistencyTrend: "stable" as const,
    overallTrend: "stable" as const,
  },
  soft_alert: {
    name: "Soft Alert",
    description: "Soft stool consistency",
    colorTrend: "stable" as const,
    consistencyTrend: "declining" as const,
    overallTrend: "stable" as const,
  },
  dry_alert: {
    name: "Dry Alert",
    description: "Dry stool consistency",
    colorTrend: "stable" as const,
    consistencyTrend: "declining" as const,
    overallTrend: "stable" as const,
  },
  black_alert: {
    name: "Black Alert",
    description: "Black stool detected",
    colorTrend: "declining" as const,
    consistencyTrend: "stable" as const,
    overallTrend: "stable" as const,
  },
};

// Generate week readings for a given scenario
export function generateWeekReadings(
  scenarioOrWeekStart: keyof typeof MOCK_SCENARIOS | Date = "healthy",
  scenario?: keyof typeof MOCK_SCENARIOS,
): WeekRollup[] {
  // Handle both calling patterns: generateWeekReadings(scenario) or generateWeekReadings(weekStart, scenario)
  const actualScenario =
    typeof scenarioOrWeekStart === "string"
      ? scenarioOrWeekStart
      : scenario || "healthy";
  const baseData = mockWeekRollups[0];

  switch (actualScenario) {
    case "healthy":
      return [baseData];
    case "monitor":
      return [
        {
          ...baseData,
          status: "monitor" as const,
          issues: ["Mild variations detected"],
        },
      ];
    case "attention":
      return [
        {
          ...baseData,
          status: "attention" as const,
          issues: ["Significant changes detected", "Consult veterinarian"],
        },
      ];
    default:
      return [baseData];
  }
}

// Get scenario data
export function getScenario(key: keyof typeof MOCK_SCENARIOS) {
  return MOCK_SCENARIOS[key];
}

// Get random scenario key
export function getRandomScenarioKey(): keyof typeof MOCK_SCENARIOS {
  const keys = Object.keys(MOCK_SCENARIOS) as (keyof typeof MOCK_SCENARIOS)[];
  return keys[Math.floor(Math.random() * keys.length)];
}
