import type { ServiceTileStatus } from "@prisma/client";

export interface TileTerritorySummary {
  id: string;
  name: string | null;
  timezone?: string | null;
}

export interface TileRecord {
  id: string;
  orgId: string;
  slug: string;
  name: string;
  status: ServiceTileStatus;
  minCertifiedScoopers: number;
  minCustomerUnits: number;
  coverageRadiusMeters: number | null;
  goLiveDate: Date | null;
  notes: string | null;
  territoryId: string | null;
  geometryGeoJSON?: string | null;
}

export interface TileMetricRecord {
  id: string;
  tileId: string;
  weekOf: Date;
  activeScoopers: number;
  scheduledStops: number;
  completedStops: number;
}

export interface TileWithContext {
  tile: TileRecord;
  metrics: TileMetricRecord[];
  territory?: TileTerritorySummary | null;
}

export interface TileServiceWindowInput {
  weekday: number;
  window: "AM" | "PM" | "FULL";
  maxStops: number;
}

export interface CreateTileWithZipsInput {
  orgId: string;
  slug: string;
  name: string;
  status: ServiceTileStatus;
  minCertifiedScoopers: number;
  minCustomerUnits: number;
  coverageRadiusMeters?: number | null;
  goLiveDate?: Date | null;
  notes?: string | null;
  territoryId?: string | null;
  zipCodes: string[];
  serviceWindows: TileServiceWindowInput[];
}

export interface TileReadinessThresholds {
  minCertifiedScoopers: number;
  minCustomerUnits: number;
  // Minimum waitlist signups needed for MVD (Minimum Viable Density)
  // This is the PRIMARY metric for DRAFT/WAITLIST tiles
  minWaitlistSignups: number;
}

export interface TileReadiness {
  tile: TileRecord & { territory?: TileTerritorySummary | null };
  latestSnapshot: TileMetricRecord | null;
  thresholds: TileReadinessThresholds;
  // For LIVE tiles: based on scoopers + actual customers
  activationEligible: boolean;
  // For DRAFT/WAITLIST tiles: based on waitlist signups (MVD)
  waitlistMvdEligible: boolean;
  unmetScooperCount: number;
  unmetCustomerCount: number;
  // Waitlist-specific counts
  unmetWaitlistCount: number;
  advisoryReasons: string[];
  // Waitlist signups from CityWaitlist
  waitlistSignups: number;
  // Population data for dynamic threshold calculation
  estimatedPopulation?: number;
  populationSource?: "postgis" | "static" | "unknown";
}
