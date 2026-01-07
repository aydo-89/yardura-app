import type {
  AvailabilityWindow,
  BackgroundCheckStatus,
  CertificationStatus,
  CertificationType,
  LedgerEntryType,
  PayoutStatus,
  QaOutcome,
  RouteShiftStatus,
  ScooperStatus,
  ServiceTile,
  ServiceTileStatus,
  Territory,
  TileMetricSnapshot,
  VisitCompSchedule,
} from "@prisma/client";

export type EcoDiversionTier = 0 | 25 | 50 | 100;

export interface TileActivationThresholds {
  minCertifiedScoopers: number;
  minCustomerUnits: number;
}

export type { TileReadiness } from "@/lib/tiles/types";

export interface VisitAddonSelection {
  haulAway?: boolean;
  ecoDiversionTier?: EcoDiversionTier;
  deodorize?: boolean;
  extraAreasCount?: number;
  customAddons?: Record<string, number>;
}

export interface VisitPayoutComputationInput {
  schedule: VisitCompSchedule;
  addonSelection?: VisitAddonSelection;
  mileageMiles?: number;
  mileageRateCents?: number;
  ppeStipendCents?: number;
  densityBonusCents?: number;
  tipsCents?: number;
}

export interface VisitPayoutBreakdown {
  baseAmountCents: number;
  bonusAmountCents: number;
  mileageAmountCents: number;
  ppeAmountCents: number;
  tipsAmountCents: number;
  totalAmountCents: number;
  appliedEcoDiversionTier?: EcoDiversionTier;
  haulAwayApplied?: boolean;
  addonBreakdown?: Record<string, number>;
}

export interface ScooperCertificationSnapshot {
  type: CertificationType;
  status: CertificationStatus;
  expiresAt?: Date | null;
}

export interface ScooperComplianceSummary {
  profileStatus: ScooperStatus;
  backgroundCheckStatus: BackgroundCheckStatus;
  vehicleVerified: boolean;
  insuranceOnFile: boolean;
  activeCertifications: CertificationType[];
  inactiveCertifications: ScooperCertificationSnapshot[];
  canClaimHaulAway: boolean;
  canClaimEcoDiversion: boolean;
  complianceIssues: string[];
}

export interface LedgerEntryDraft {
  scooperId: string;
  orgId: string;
  type: LedgerEntryType;
  amountCents: number;
  notes?: string;
  metadata?: Record<string, unknown>;
  sourceVisitId?: string;
  payoutId?: string;
  recordedById?: string;
}

export interface QaAuditSummary {
  outcome: QaOutcome;
  score?: number | null;
  issues?: string[];
}

export interface RouteShiftSummary {
  id: string;
  status: RouteShiftStatus;
  scheduledWindow: AvailabilityWindow;
  serviceDate: Date;
  tileStatus: ServiceTileStatus;
  plannedStops: number;
  completedStops: number;
  plannedMiles?: number | null;
  actualMiles?: number | null;
}
