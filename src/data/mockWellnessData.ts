// Mock wellness data scenarios for testing different alert types
// Each scenario represents realistic dog wellness data with one specific type of alert

export type MockReading = {
  id: string;
  timestamp: string;
  consistency: 'normal' | 'soft' | 'mucous' | 'greasy' | 'dry';
  color: 'normal' | 'red' | 'black' | 'yellow';
  weight?: number;
};

export type MockWeekData = {
  readings: MockReading[];
  description: string;
  expectedAlerts: string[];
};

// Generate realistic timestamps within a week
const generateWeekTimestamps = (weekStart: Date): string[] => {
  const timestamps: string[] = [];
  for (let day = 0; day < 7; day++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + day);
    // Add some randomness to the time of day
    date.setHours(8 + Math.random() * 12, Math.random() * 60, Math.random() * 60);
    timestamps.push(date.toISOString());
  }
  return timestamps;
};

// Scenario 1: Perfect Health (baseline)
export const perfectHealth: MockWeekData = {
  description: "Perfect health - all readings normal",
  expectedAlerts: [],
  readings: [
    { id: 'ph-1', timestamp: '', consistency: 'normal', color: 'normal', weight: 18 },
    { id: 'ph-2', timestamp: '', consistency: 'normal', color: 'normal', weight: 16 },
    { id: 'ph-3', timestamp: '', consistency: 'normal', color: 'normal', weight: 19 },
    { id: 'ph-4', timestamp: '', consistency: 'normal', color: 'normal', weight: 17 },
    { id: 'ph-5', timestamp: '', consistency: 'normal', color: 'normal', weight: 18 },
  ]
};

// Scenario 2: Red Stool Alert
export const redStoolAlert: MockWeekData = {
  description: "Red stool detected - potential blood",
  expectedAlerts: ["Red stool", "Action needed"],
  readings: [
    { id: 'rsa-1', timestamp: '', consistency: 'normal', color: 'normal', weight: 17 },
    { id: 'rsa-2', timestamp: '', consistency: 'normal', color: 'normal', weight: 16 },
    { id: 'rsa-3', timestamp: '', consistency: 'normal', color: 'normal', weight: 18 },
    { id: 'rsa-4', timestamp: '', consistency: 'soft', color: 'red', weight: 12 },
    { id: 'rsa-5', timestamp: '', consistency: 'normal', color: 'normal', weight: 17 },
  ]
};

// Scenario 3: Yellow/Gray Stool Alert
export const yellowStoolAlert: MockWeekData = {
  description: "Yellow/gray stool - possible liver or pancreas issue",
  expectedAlerts: ["Yellow stool", "Monitor"],
  readings: [
    { id: 'ysa-1', timestamp: '', consistency: 'normal', color: 'normal', weight: 18 },
    { id: 'ysa-2', timestamp: '', consistency: 'normal', color: 'normal', weight: 17 },
    { id: 'ysa-3', timestamp: '', consistency: 'normal', color: 'yellow', weight: 15 },
    { id: 'ysa-4', timestamp: '', consistency: 'normal', color: 'normal', weight: 16 },
    { id: 'ysa-5', timestamp: '', consistency: 'normal', color: 'normal', weight: 18 },
  ]
};

// Scenario 4: Soft Consistency Alert
export const softConsistencyAlert: MockWeekData = {
  description: "Soft/mushy consistency - potential dietary issue",
  expectedAlerts: ["Soft consistency", "Monitor"],
  readings: [
    { id: 'sca-1', timestamp: '', consistency: 'normal', color: 'normal', weight: 17 },
    { id: 'sca-2', timestamp: '', consistency: 'soft', color: 'normal', weight: 14 },
    { id: 'sca-3', timestamp: '', consistency: 'soft', color: 'normal', weight: 13 },
    { id: 'sca-4', timestamp: '', consistency: 'normal', color: 'normal', weight: 16 },
    { id: 'sca-5', timestamp: '', consistency: 'soft', color: 'normal', weight: 15 },
  ]
};

// Scenario 5: Dry/Hard Stool Alert
export const dryStoolAlert: MockWeekData = {
  description: "Dry/hard consistency - potential dehydration",
  expectedAlerts: ["Dry consistency"],
  readings: [
    { id: 'dsa-1', timestamp: '', consistency: 'normal', color: 'normal', weight: 18 },
    { id: 'dsa-2', timestamp: '', consistency: 'dry', color: 'normal', weight: 20 },
    { id: 'dsa-3', timestamp: '', consistency: 'dry', color: 'normal', weight: 19 },
    { id: 'dsa-4', timestamp: '', consistency: 'normal', color: 'normal', weight: 17 },
    { id: 'dsa-5', timestamp: '', consistency: 'dry', color: 'normal', weight: 21 },
  ]
};

// Scenario 6: Mucous/Greasy Alert
export const mucousAlert: MockWeekData = {
  description: "Mucous/greasy consistency - possible parasite or infection",
  expectedAlerts: ["Mucous/greasy", "Action needed"],
  readings: [
    { id: 'ma-1', timestamp: '', consistency: 'normal', color: 'normal', weight: 17 },
    { id: 'ma-2', timestamp: '', consistency: 'mucous', color: 'normal', weight: 14 },
    { id: 'ma-3', timestamp: '', consistency: 'normal', color: 'normal', weight: 16 },
    { id: 'ma-4', timestamp: '', consistency: 'greasy', color: 'normal', weight: 15 },
    { id: 'ma-5', timestamp: '', consistency: 'normal', color: 'normal', weight: 18 },
  ]
};

// Scenario 7: Black Stool Alert
export const blackStoolAlert: MockWeekData = {
  description: "Black stool - potential gastrointestinal bleeding",
  expectedAlerts: ["Black stool", "Action needed"],
  readings: [
    { id: 'bsa-1', timestamp: '', consistency: 'normal', color: 'normal', weight: 18 },
    { id: 'bsa-2', timestamp: '', consistency: 'normal', color: 'normal', weight: 17 },
    { id: 'bsa-3', timestamp: '', consistency: 'soft', color: 'black', weight: 13 },
    { id: 'bsa-4', timestamp: '', consistency: 'normal', color: 'normal', weight: 16 },
    { id: 'bsa-5', timestamp: '', consistency: 'normal', color: 'normal', weight: 18 },
  ]
};

// Scenario 8: Mixed Normal Readings (no alerts)
export const mixedNormal: MockWeekData = {
  description: "Mixed normal readings with natural variation",
  expectedAlerts: [],
  readings: [
    { id: 'mn-1', timestamp: '', consistency: 'normal', color: 'normal', weight: 16 },
    { id: 'mn-2', timestamp: '', consistency: 'normal', color: 'normal', weight: 19 },
    { id: 'mn-3', timestamp: '', consistency: 'soft', color: 'normal', weight: 14 }, // Natural variation
    { id: 'mn-4', timestamp: '', consistency: 'normal', color: 'normal', weight: 17 },
    { id: 'mn-5', timestamp: '', consistency: 'normal', color: 'normal', weight: 18 },
  ]
};

// Available scenarios
export const MOCK_SCENARIOS = {
  perfect: perfectHealth,
  red_alert: redStoolAlert,
  yellow_alert: yellowStoolAlert,
  soft_alert: softConsistencyAlert,
  dry_alert: dryStoolAlert,
  mucous_alert: mucousAlert,
  black_alert: blackStoolAlert,
  normal_mix: mixedNormal,
} as const;

export type MockScenarioKey = keyof typeof MOCK_SCENARIOS;

// Generate readings for a specific week with timestamps
export const generateWeekReadings = (
  weekStart: Date,
  scenario: MockWeekData
): MockReading[] => {
  const timestamps = generateWeekTimestamps(weekStart);
  return scenario.readings.map((reading, index) => ({
    ...reading,
    timestamp: timestamps[index] || timestamps[0]
  }));
};

// Get scenario by key with fallback
export const getScenario = (key: string): MockWeekData => {
  return MOCK_SCENARIOS[key as MockScenarioKey] || MOCK_SCENARIOS.perfect;
};

// Get random scenario key
export const getRandomScenarioKey = (): MockScenarioKey => {
  const keys = Object.keys(MOCK_SCENARIOS) as MockScenarioKey[];
  return keys[Math.floor(Math.random() * keys.length)];
};
