// Shared types for dashboard components
export type User = {
  id: string;
  name?: string | null;
  image?: string | null;
  email: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  zipCode?: string | null;
  preferredDay?: string | null;
  preferredTime?: string | null;
  preferredTimeWindowSlug?: string | null;
  serviceAreas?: string[] | null;
  specialInstructions?: string | null;
  stripeCustomerId?: string | null;
  orgId?: string | null;
  dogsCount?: number | null;
  yardSize?: string | null;
  serviceFrequency?: string | null;
  firstServiceDate?: string | null;
};

export type Dog = {
  id: string;
  name: string;
  breed?: string | null;
  age?: number | null;
  weight?: number | null;
  photoUrl?: string | null;
};

// Dashboard-specific service visit type (different from wellness ServiceVisit)
export type DashboardServiceVisit = {
  id: string;
  scheduledDate: string; // ISO
  status: string;
  serviceType: string;
  yardSize: string;
  preferredTimeWindow?: string | null;
  preferredTimeWindowSlug?: string | null;
  media?: Array<{
    id: string;
    assetType: string;
    capturedAt: string;
    analysisStatus?: string;
    analysisModel?: string | null;
    analysisConfidence?: number | null;
    analysisResult?: Record<string, unknown> | null;
    stoolSampleId?: string | null;
    stoolSampleView?: string | null;
  }>;
  insight?: {
    colorIndicator: string;
    consistencyIndicator: string;
    contentIndicator: string;
    observations: string | null;
    wellnessFlag: boolean;
    flagReason: string | null;
    source?: string;
    sourceMediaId?: string | null;
    autoConfidence?: number | null;
    analysisModel?: string | null;
  } | null;
};

// Dashboard-specific data reading type (different from wellness DataReading)
export type DashboardDataReading = {
  id: string;
  timestamp: string; // ISO
  weight?: number | null;
  volume?: number | null;
  color?: string | null;
  consistency?: string | null;
  issues?: string[] | null;
  consistencyLabel?: string | null;
};

export type ServiceSummary = {
  planName?: string | null;
  frequency?: string | null;
  yardSize?: string | null;
  dogsCount?: number | null;
  billingPreference?: string | null;
  perVisitCents?: number | null;
  monthlyCents?: number | null;
  divertMode?: string | null; // none | takeaway | compost
  startDate?: string | null;
  firstVisitDate?: string | null;
  nextVisitDate?: string | null;
  nextBillingDate?: string | null;
  subscriptionStatus?: string | null;
  trialEndsAt?: string | null;
  trialStartsAt?: string | null;
  firstChargeAt?: string | null;
  billingActivationAt?: string | null;
  specialInstructions?: string | null;
  deodorizeMode?: string | null;
  referralSource?: string | null;
  preferredTimeWindow?: string | null;
  preferredTimeWindowSlug?: string | null;
  weekendCoverage?: string | null;
  weekendUpgrade?: boolean | null;
};

export type DashboardClientProps = {
  user: User;
  dogs: Dog[];
  serviceVisits: DashboardServiceVisit[];
  dataReadings: DashboardDataReading[];
  serviceSummary: ServiceSummary | null;
};
