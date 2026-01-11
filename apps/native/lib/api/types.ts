export type VisitSummary = {
  id: string;
  scheduledDate: string;
  status: string;
  serviceType?: string | null;
  yardSize?: string | null;
};

export type CustomerVisit = {
  id: string;
  scheduledDate: string;
  status: string;
  serviceType: string | null;
  yardSize: string | null;
  preferredTimeWindow?: string | null;
  preferredTimeWindowSlug?: string | null;
  rating?: {
    id: string;
    score: number;
    comment: string | null;
    createdAt: string;
  } | null;
  mediaCount: number;
  insightscoopCount: number;
  flaggedMediaCount: number;
  scooper?: {
    id: string;
    name: string;
    photoUrl: string | null;
    avgRating: number | null;
    ratingCount: number | null;
    completedVisits: number;
  } | null;
  insight?: {
    colorIndicator: string;
    consistencyIndicator: string;
    contentIndicator: string;
    observations: string | null;
    wellnessFlag: boolean;
    flagReason: string | null;
    source?: string | null;
    sourceMediaId?: string | null;
    autoConfidence?: number | null;
    analysisModel?: string | null;
  } | null;
};

export type WellnessReportSummary = {
  id: string;
  weekStart: string;
  noIssues: boolean;
  symptomTags: string[];
};

export type DogSummary = {
  id: string;
  name: string;
  breed?: string | null;
  age?: number | null;
  weight?: number | null;
  allergies?: string | null;
  medications?: string | null;
  dietNotes?: string | null;
  vetName?: string | null;
  vetPhone?: string | null;
  vetClinic?: string | null;
  insuranceProvider?: string | null;
  insurancePolicyNumber?: string | null;
  insurancePhone?: string | null;
  photoUrl?: string | null;
};

export type DogWeightEntry = {
  id: string;
  dogId: string;
  dogName?: string | null;
  weightLbs: number;
  recordedAt: string;
  source?: string | null;
  notes?: string | null;
};

export type VetDocumentAnalysis = {
  patientInfo?: {
    name?: string | null;
    species?: string | null;
    breed?: string | null;
    age?: string | null;
    weight?: string | null;
    sex?: string | null;
  };
  visitInfo?: {
    date?: string | null;
    veterinarian?: string | null;
    clinic?: string | null;
    reason?: string | null;
  };
  diagnostics?: Array<{
    system?: string | null;
    finding: string;
    severity?: string | null;
    notes?: string | null;
  }>;
  problemList?: string[];
  caseSummary?: string | null;
  atHomeCare?: string[];
  followUp?: {
    instructions?: string | null;
    nextAppointment?: string | null;
    watchFor?: string[];
  };
  medications?: Array<{
    name: string;
    dosage?: string | null;
    frequency?: string | null;
    duration?: string | null;
    notes?: string | null;
  }>;
  rawFindings?: string | null;
};

export type VetDocument = {
  id: string;
  dogId?: string | null;
  documentUrl: string;
  documentName: string;
  documentType?: string | null;
  visitDate?: string | null;
  veterinarian?: string | null;
  clinic?: string | null;
  analysis?: VetDocumentAnalysis | null;
  analysisStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  analysisError?: string | null;
  createdAt: string;
  dog?: { id: string; name: string } | null;
};

export type CustomerSummary = {
  customer: {
    id: string;
    name: string;
    city: string;
    state: string;
    zip: string;
  };
  orgId: string;
  contact?: {
    email: string | null;
    phone: string | null;
    preferredContactMethod?: string | null;
  };
  petsCount: number;
  nextVisit: VisitSummary | null;
  lastVisit: VisitSummary | null;
  latestReport: WellnessReportSummary | null;
  wellnessAccess: {
    tier: 'FREE' | 'PREMIUM';
    source: 'DIRECT' | 'SERVICE_PROMO' | 'ADMIN';
    planEndsAt: string | null;
    promoEndsAt: string;
    hasActiveService: boolean;
    usage: {
      periodKey: string;
      scansCount: number;
      chatsCount: number;
      foodScansCount: number;
      inventoryAddsCount: number;
    };
    limits: {
      scansPerMonth: number;
      chatsPerMonth: number;
      foodScansPerMonth: number;
      inventoryAddsPerMonth: number;
    };
    maxDogs: number | null;
  };
};

export type CustomerServicePlan = {
  hasActiveService: boolean;
  customerId?: string;
  orgId?: string;
  jobId?: string;
  dogCount?: number;
  yardSize?: string | null;
  frequency?: string | null;
  deodorizeMode?: string | null;
  divertMode?: string | null;
  areasToClean?: {
    frontYard?: boolean;
    backYard?: boolean;
    sideYard?: boolean;
    dogRun?: boolean;
    fencedArea?: boolean;
    other?: string;
  } | null;
  extraAreas?: number | null;
  billingPreference?: string | null;
  perVisitAmountCents?: number | null;
  recurringAmountCents?: number | null;
  pricing?: Record<string, unknown> | null;
};

export type CustomerSetupPrefill = {
  name: string | null;
  email: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  orgId: string | null;
};

export type CustomerSetupResponse = {
  hasCustomer: boolean;
  setup: CustomerSetupPrefill;
};

export type ScooperSummary = {
  nextVisit: {
    id: string;
    scheduledDate: string;
    status: string;
    customerId: string;
    serviceType?: string | null;
  } | null;
  todayCount: number;
  weekCount: number;
  profileStatus?: string | null;
  backgroundCheckStatus?: string | null;
};

export type ScooperVisit = {
  id: string;
  scheduledDate: string;
  status: string;
  serviceType: string | null;
  yardSize: string | null;
  preferredTimeWindow?: string | null;
  preferredTimeWindowSlug?: string | null;
  tile: {
    id: string;
    slug: string;
    name: string;
  } | null;
  customer: {
    id: string;
    name: string | null;
    addressLine1: string | null;
    city: string | null;
    state?: string | null;
    zip?: string | null;
  } | null;
};

export type ScooperRouteSummary = {
  betweenStopsDistanceMeters?: number;
  betweenStopsDurationSeconds?: number;
  startToFirstDistanceMeters?: number;
  startToFirstDurationSeconds?: number;
  endToHomeDistanceMeters?: number;
  endToHomeDurationSeconds?: number;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
};

export type ScooperRouteSegment = {
  distanceMeters: number;
  durationSeconds: number;
  origin: string;
  destination: string;
  geometry?: [number, number][];
};

export type ScooperRouteVisit = {
  id: string;
  scheduledDate: string;
  status: string;
  serviceType?: string | null;
  yardSize?: string | null;
  deodorize?: boolean | null;
  metadata?: Record<string, unknown> | null;
  preferredTimeWindowSlug?: string | null;
  preferredTimeWindowLabel?: string | null;
  routeSequence?: number | null;
  travelFromPrevious?: ScooperRouteSegment | null;
  travelFromHome?: ScooperRouteSegment | null;
  travelToHome?: ScooperRouteSegment | null;
  geo?: {
    latitude: number;
    longitude: number;
    source?: string | null;
  } | null;
  navigationUrl?: string | null;
  revenueCents?: number | null;
  payoutCents?: number | null;
  projectedPayoutCents?: number | null;
  customer?: {
    id: string;
    name: string | null;
    phone?: string | null;
    email?: string | null;
    addressLine1: string | null;
    city: string | null;
    state?: string | null;
    zip?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    dogs?: Array<{
      id: string;
      name: string;
      breed?: string | null;
    }>;
  } | null;
  job?: {
    id: string;
    frequency?: string | null;
    primaryScooperId?: string | null;
    deodorizeMode?: string | null;
  } | null;
  communications?: Array<{
    id: string;
    channel: string;
    templateId: string | null;
    status: string;
    statusDetail: string | null;
    createdAt: string;
  }>;
  media?: ScooperVisitMedia[];
  insights?: ScooperVisitInsight[];
};

export type ScooperRoutePlan = {
  visits: ScooperRouteVisit[];
  summary: ScooperRouteSummary;
  cached?: boolean;
};

export type ScooperOngoingCustomer = {
  jobId: string;
  frequency: string;
  nextVisitAt: string | null;
  preferredTimeWindow?: string | null;
  preferredTimeWindowSlug?: string | null;
  customer: {
    id: string;
    name: string;
    addressLine1: string;
    city: string;
    state: string;
    zip: string;
    dogs: Array<{
      id: string;
      name: string;
      breed?: string | null;
    }>;
  } | null;
};

export type ScooperOngoingCustomerSummary = {
  currentCount: number;
  limit: number;
  tier: {
    slug: string;
    name: string;
  };
  nextTier?: {
    slug: string;
    name: string;
    limit: number | null;
    pointsToNext: number | null;
  } | null;
};

export type ScooperVisitMedia = {
  id: string;
  assetType: string;
  storagePath?: string | null;
  capturedAt?: string | null;
  uploadedAt?: string | null;
  gpsLat?: number | null;
  gpsLng?: number | null;
  gpsAccuracy?: number | null;
  locationMetadata?: Record<string, unknown> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  notes?: string | null;
  analysisStatus?: string | null;
  analysisResult?: Record<string, unknown> | null;
  stoolSampleId?: string | null;
  stoolSampleView?: string | null;
  url?: string | null;
};

/** Location snap result returned from media upload when GPS is corrected */
export type LocationSnapResult = {
  snapped: boolean;
  wasInside: boolean;
  correctionMeters: number | null;
  status: 'inside' | 'snapped' | 'too_far' | 'no_parcel' | 'disabled' | 'error';
};

export type ScooperVisitInsight = {
  id: string;
  serviceVisitId?: string | null;
  colorIndicator?: string | null;
  consistencyIndicator?: string | null;
  contentIndicator?: string | null;
  observations?: string | null;
  wellnessFlag?: boolean | null;
  flagReason?: string | null;
  source?: string | null;
  sourceMediaId?: string | null;
  autoConfidence?: number | null;
  analysisModel?: string | null;
};

export type ScooperVisitDetail = {
  id: string;
  orgId?: string | null;
  scheduledDate: string;
  status: string;
  serviceType?: string | null;
  yardSize?: string | null;
  preferredTimeWindow?: string | null;
  preferredTimeWindowSlug?: string | null;
  actualStart?: string | null;
  actualEnd?: string | null;
  notes?: string | null;
  deodorize?: boolean | null;
  metadata?: Record<string, unknown> | null;
  customer?: {
    id: string;
    name: string | null;
    email?: string | null;
    phone?: string | null;
    addressLine1?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    notes?: string | null;
  } | null;
  job?: {
    id: string;
    frequency?: string | null;
    deodorizeMode?: string | null;
    billingPlan?: {
      metadata?: Record<string, unknown> | null;
    } | null;
  } | null;
  media?: ScooperVisitMedia[];
  insights?: ScooperVisitInsight[];
  communications?: Array<{
    id: string;
    channel: string;
    templateId: string | null;
    status: string;
    statusDetail?: string | null;
    createdAt: string;
  }>;
  routeStop?: {
    id: string;
    actualArrival?: string | null;
  } | null;
  geo?: {
    latitude: number;
    longitude: number;
    source?: string | null;
  } | null;
};

export type ScooperOffer = {
  id: string;
  orgId: string;
  serviceVisitId: string;
  tileId: string | null;
  scheduledDate: string | null;
  expiresAt: string | null;
  jobId: string | null;
  frequency: string;
  serviceType: string | null;
  status: string;
  priority: number;
  dispatchStrategy: string | null;
  isDirectOffer: boolean;
  isRecurring: boolean;
  handoffType: string | null;
  preferredTimeWindowLabel?: string | null;
  preferredTimeWindowSlug?: string | null;
  preferredTimeWindowRange?: string | null;
  distanceMiles?: number | null;
  tile: {
    id: string;
    slug: string;
    name: string;
    status: string;
  } | null;
  customer: {
    id: string | null;
    name: string | null;
    addressLine1: string | null;
    city: string | null;
    zip: string | null;
    dogs?: Array<{
      id: string;
      name: string;
      breed?: string | null;
    }>;
  } | null;
  revenueCents: number | null;
  estimatedPayout: {
    baseAmountCents: number;
    bonusAmountCents: number;
    mileageAmountCents: number;
    ppeAmountCents: number;
    tipsAmountCents: number;
    totalAmountCents: number;
    sharePercent: number;
    baseShareCents: number;
  } | null;
};

export type ScooperOffersPayload = {
  org: {
    id: string;
    name: string;
    slug: string;
  };
  profileStatus: string;
  offers: ScooperOffer[];
  summary: {
    total: number;
    direct: number;
    broadcast: number;
  };
  generatedAt: string;
};

export type ScooperPayout = {
  id: string;
  status: string;
  totalAmountCents: number;
  tipsAmountCents: number;
  generatedAt: string;
  clearedAt: string | null;
  serviceVisit: {
    id: string;
    scheduledDate: string;
    metadata: Record<string, unknown> | null;
    tile: {
      id: string;
      slug: string;
      name: string;
    } | null;
    customer: {
      id: string;
      name: string | null;
      addressLine1: string | null;
      city: string | null;
    } | null;
  } | null;
};

export type ScooperPayoutDetail = {
  id: string;
  status: string;
  baseAmountCents: number;
  bonusAmountCents: number;
  mileageAmountCents: number;
  ppeAmountCents: number;
  tipsAmountCents: number;
  adjustmentsCents: number;
  totalAmountCents: number;
  milesDriven: number | null;
  minutesOnSite: number | null;
  generatedAt: string;
  readyAt: string | null;
  releasedAt: string | null;
  clearedAt: string | null;
  cancelledAt: string | null;
  notes: string | null;
  serviceVisit: {
    id: string;
    scheduledDate: string;
    metadata: Record<string, unknown> | null;
    tile: {
      id: string;
      slug: string;
      name: string;
    } | null;
    customer: {
      id: string;
      name: string | null;
      addressLine1: string | null;
      city: string | null;
    } | null;
  } | null;
};

export type ScooperPayoutAccountStatus = {
  accountId: string | null;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  requirements: string[];
  disabledReason: string | null;
};

export type ScooperWithdrawalRequest = {
  id: string;
  status: string;
  amountCents: number;
  requestedAt: string;
  reviewedAt: string | null;
  paidAt: string | null;
  payoutCount: number;
};

export type ScooperEarningsSummary = {
  payouts: ScooperPayout[];
  summary: {
    pendingReviewAmountCents: number;
    earnedAmountCents: number;
    monthPaidCents: number;
    lifetimeEarnedCents: number;
    tipsMonthCents: number;
    tipsLifetimeCents: number;
    autoPayoutEnabled: boolean;
  };
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
    pageSize: number;
  };
  generatedAt: string;
};

export type ScooperCheckInPointsRules = {
  basePoints: number;
  streakStep: number;
  streakMax: number;
  milestoneBonuses: Record<string, number>;
};

export type ScooperCheckInPointsPreview = {
  basePoints: number;
  streakBonus: number;
  milestoneBonus: number;
  totalPoints: number;
};

export type ScooperCheckInMilestone = {
  days: number;
  bonusPoints: number;
};

export type ScooperDailyCheckRewards = {
  pointsBalance: number;
  streakCount: number;
  streakIfSubmit: number;
  pointsRules: ScooperCheckInPointsRules;
  pointsPreview: ScooperCheckInPointsPreview;
  lastPointsAwarded?: number | null;
  nextMilestone?: ScooperCheckInMilestone | null;
};

export type ScooperDailyCheckStatus = {
  lastGearCheckAt: string | null;
  check: {
    id: string;
    capturedAt: string;
    photoUrl?: string | null;
    uploadStatus?: string | null;
    reviewStatus?: string | null;
    notes?: string | null;
    pointsAwarded?: number | null;
    streakCount?: number | null;
    selfieSkipped?: boolean | null;
  } | null;
  rewards?: ScooperDailyCheckRewards;
};

export type ScooperRewardItem = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  pointsCost: number;
  category?: string | null;
  imageUrl?: string | null;
  isActive: boolean;
  metadata?: Record<string, unknown> | null;
};

export type ScooperRewardRedemption = {
  id: string;
  status: string;
  pointsCost: number;
  requestedAt: string;
  approvedAt?: string | null;
  fulfilledAt?: string | null;
  cancelledAt?: string | null;
  rewardItem: ScooperRewardItem;
};

export type ScooperRewardTier = {
  slug: string;
  name: string;
  minPoints: number;
  maxPoints?: number;
  perks: string[];
};

export type ScooperTierProgress = {
  pointsToNext: number | null;
  progressPct: number;
};

export type ScooperRewardsPayload = {
  balance: number;
  earnedPoints: number;
  spentPoints: number;
  tier: ScooperRewardTier;
  nextTier?: ScooperRewardTier | null;
  tierProgress?: ScooperTierProgress;
  nextReward?: {
    id: string;
    name: string;
    pointsCost: number;
    remainingPoints: number;
  } | null;
  dailyCheck: {
    streakCount: number;
    nextMilestone: ScooperCheckInMilestone | null;
  };
  items: ScooperRewardItem[];
  redemptions: ScooperRewardRedemption[];
};

export type CustomerRewardItem = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  pointsCost: number;
  category?: string | null;
  imageUrl?: string | null;
  isActive: boolean;
  metadata?: Record<string, unknown> | null;
};

export type CustomerRewardRedemption = {
  id: string;
  status: string;
  pointsCost: number;
  requestedAt: string;
  approvedAt?: string | null;
  fulfilledAt?: string | null;
  cancelledAt?: string | null;
  rewardItem: CustomerRewardItem;
};

export type CustomerRewardsPayload = {
  balance: number;
  earnedPoints: number;
  spentPoints: number;
  nextReward?: {
    id: string;
    name: string;
    pointsCost: number;
    remainingPoints: number;
  } | null;
  items: CustomerRewardItem[];
  redemptions: CustomerRewardRedemption[];
};

export type WellnessReading = {
  id: string;
  timestamp: string;
  color?: string | null;
  consistencyLabel?: string | null;
  contentLabel?: string | null;
  issues: string[];
  source?: 'OWNER' | 'PRO';
  dogName?: string | null;
  hydrationScore?: number | null;
  firmnessScale?: number | null;
  indicator?: 'watch' | 'monitor' | 'vet_now' | null;
  summary?: string | null;
  whatThisCouldMean?: string | null;
  imageUrl?: string | null;
};

export type WellnessReadingsPayload = {
  readings: WellnessReading[];
  visits: {
    id: string;
    date: string;
    notes?: string;
  }[];
};

export type WellnessSampleDetail = {
  id: string;
  source: 'OWNER' | 'PRO';
  capturedAt: string;
  analysisResult: Record<string, unknown> | null;
  analysisConfidence?: number | null;
  analysisModel?: string | null;
  dogName?: string | null;
  stoolSampleView?: string | null;
  reviewStatus?: string | null;
  imageUrl?: string | null;
};

export type WellnessCapture = {
  id: string;
  capturedAt: string;
  analysisStatus: string;
  analysisResult: Record<string, unknown> | null;
  analysisConfidence?: number | null;
  analysisModel?: string | null;
  dogId?: string | null;
  suspectedDogIds?: string[];
  scope?: string | null;
  attribution?: string | null;
  symptomTags?: string[];
  notes?: string | null;
  gpsLat?: number | null;
  gpsLng?: number | null;
  gpsAccuracy?: number | null;
  consentToShare?: boolean;
  metadata?: Record<string, unknown> | null;
  imageUrl?: string | null;
};

export type WellnessChatResponse = {
  reply: string;
  risk_level: 'watch' | 'monitor' | 'vet_now';
  red_flags: string[];
  suggested_actions: string[];
  follow_up_questions: string[];
  disclaimer: string;
  context_used?: string[];
};

export type WellnessChatReply = {
  reply: string;
};

export type WellnessDailyLevel = 'LOW' | 'NORMAL' | 'HIGH' | 'UNKNOWN';

export type WellnessDailyCheckIn = {
  id: string;
  dogId: string | null;
  dogName?: string | null;
  suspectedDogIds: string[];
  loggedAt: string;
  appetite?: WellnessDailyLevel | null;
  energy?: WellnessDailyLevel | null;
  waterIntake?: WellnessDailyLevel | null;
  stoolFrequency?: number | null;
  vomiting: boolean;
  diarrhea: boolean;
  medsGiven: boolean;
  medsNotes?: string | null;
  notes?: string | null;
};

export type WellnessReminder = {
  id: string;
  dogId: string | null;
  dogName?: string | null;
  title: string;
  category:
    | 'MEDS'
    | 'VACCINE'
    | 'DEWORMING'
    | 'FLEA_TICK'
    | 'FOOD_TRANSITION'
    | 'VET_VISIT'
    | 'CUSTOM';
  notes?: string | null;
  nextDueAt: string;
  frequencyDays?: number | null;
  active: boolean;
  lastCompletedAt?: string | null;
};

export type WellnessFoodLog = {
  id: string;
  dogId: string | null;
  dogName?: string | null;
  loggedAt: string;
  type: 'FOOD' | 'TREAT' | 'SUPPLEMENT' | 'MEDICATION';
  productId?: string | null;
  brand?: string | null;
  productName?: string | null;
  ingredients?: string | null;
  portion?: string | null;
  notes?: string | null;
  allergenMatches: string[];
};

export type WellnessFoodProduct = {
  id: string;
  dogId: string | null;
  type: 'FOOD' | 'TREAT' | 'SUPPLEMENT' | 'MEDICATION';
  brand?: string | null;
  productName?: string | null;
  ingredients?: string | null;
  portion?: string | null;
  notes?: string | null;
  imageUrl?: string | null;
};

// Cached pet food product from external sources (Chewy)
export type PetFoodProductSearch = {
  id: string;
  chewyId?: string | null;
  name: string;
  brand: string;
  type: 'FOOD' | 'TREAT' | 'SUPPLEMENT' | 'MEDICATION';
  imageUrl?: string | null;
  price?: number | null;
  autoshipPrice?: number | null;
  ingredients?: string | null;
  lifestage?: string | null;
  breedSize?: string | null;
  specialDiets?: string[];
  source: 'local' | 'chewy';
};

export type WellnessFoodSchedule = {
  id: string;
  dogId: string | null;
  productId: string;
  active: boolean;
  timesOfDay: string[];
  timeZone?: string | null;
  startsOn?: string | null;
  endsOn?: string | null;
  product: WellnessFoodProduct;
};

export type WellnessWalk = {
  id: string;
  dogId: string | null;
  dogName?: string | null;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  distanceMeters: number;
  path: Array<{
    lat: number;
    lng: number;
    accuracy?: number | null;
    timestamp?: string | null;
  }>;
  metadata?: Record<string, unknown> | null;
};

export type WellnessPreferences = {
  shareWellnessNotes: boolean;
  shareWellnessCaptures: boolean;
  autoBlurWellnessPhotos: boolean;
  parasiteRiskNotificationsEnabled?: boolean;
};

export type CustomerEmailReportPreferences = {
  enabled: boolean;
  cadence: 'WEEKLY' | 'MONTHLY';
  sendHour: number;
  dayOfWeek: number;
  dayOfMonth: number;
  timeZone?: string | null;
  recipients: string[];
  includeWellness: boolean;
  includeScooping: boolean;
  includeFood: boolean;
  includeWalks: boolean;
  includeReminders: boolean;
  includeChats: boolean;
  includePhotos: boolean;
};

export type WellnessPointsRules = {
  basePoints: number;
  symptomBonus: number;
  notesBonus: number;
  vetBonus: number;
  streakStep: number;
  streakMax: number;
};

export type WellnessCheckInDog = {
  id: string;
  name: string;
  breed?: string | null;
  age?: number | null;
  photoUrl?: string | null;
  streakCount: number;
  streakIfSubmit: number;
  currentWeekReport: {
    id: string;
    noIssues: boolean;
    symptomTags: string[];
    appetite: string | null;
    hydration: string | null;
    energy: string | null;
    stoolFrequency: number | null;
    vomiting: boolean;
    diarrhea: boolean;
    medsGiven: boolean;
    medsNotes: string | null;
    behaviorNotes: string | null;
    stoolNotes: string | null;
    diagnosisLabel: string | null;
    diagnosisSource: string | null;
    diagnosisNotes: string | null;
    reportedAt: string;
    pointsAwarded: number | null;
    vetProofSubmitted?: boolean;
  } | null;
};

export type WellnessCheckInContext = {
  weekStart: string;
  weekEnd: string;
  pointsRules: WellnessPointsRules;
  pointsBalance: number;
  pointsThisWeek?: number;
  ratingCreditsTotal?: number;
  ratingCreditsThisWeek?: number;
  shareWellnessNotes: boolean;
  aiFlags: {
    flaggedVisitCount: number;
    flaggedDates: string[];
    flagReasons: string[];
  } | null;
  dogs: WellnessCheckInDog[];
};

export type WellnessReport = {
  id: string;
  weekStart: string;
  weekEnd: string;
  noIssues: boolean;
  scope: string;
  attribution: string;
  suspectedDogIds: string[];
  dogId: string | null;
  dogName?: string | null;
  stoolColors: string[];
  stoolConsistency: string[];
  stoolContents: string[];
  symptomTags: string[];
  appetite: string | null;
  hydration: string | null;
  energy?: string | null;
  stoolFrequency?: number | null;
  vomiting?: boolean;
  diarrhea?: boolean;
  medsGiven?: boolean;
  medsNotes?: string | null;
  behaviorNotes: string | null;
  stoolNotes: string | null;
  diagnosisLabel: string | null;
  diagnosisSource: string | null;
  diagnosisDate: string | null;
  diagnosisNotes: string | null;
  consentToShare: boolean;
  reportedAt: string;
  mediaCount: number;
  captureCount?: number | null;
  dailyCheckInCount?: number | null;
  pointsAwarded?: number | null;
  streakCount?: number | null;
  aiFlagCount?: number | null;
  aiFlagReasons?: string[] | null;
};

export type LeadOwner = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

export type LeadTerritory = {
  id: string;
  name: string;
  color?: string | null;
};

export type LeadActivity = {
  id: string;
  type: string;
  channel?: string | null;
  occurredAt: string;
  result?: string | null;
  notes?: string | null;
  followUpAt?: string | null;
  attachments?: Array<{
    filename: string;
    url: string;
    mimeType?: string | null;
  }> | null;
  location?:
    | { type?: string; coordinates?: [number, number]; accuracy?: number | null }
    | { lat?: number; lng?: number; accuracy?: number | null }
    | null;
  user?: LeadOwner | null;
};

export type LeadCadenceEnrollment = {
  id: string;
  cadenceId: string;
  nextRunAt?: string | null;
  status: string;
  cadence?: { id: string; name: string } | null;
};

export type OutboundLead = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  leadType?: string | null;
  pipelineStage?: string | null;
  stageColor?: string | null;
  owner?: LeadOwner | null;
  territory?: LeadTerritory | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  dogs?: number | null;
  lastActivity?: {
    id: string;
    type: string;
    result?: string | null;
    notes?: string | null;
    occurredAt: string;
    location?: { lat: number; lng: number; accuracy?: number | null } | null;
  } | null;
  submittedAt?: string | null;
  lastActivityAt?: string | null;
  nextActionAt?: string | null;
  nextActionSlaMinutes?: number | null;
  cadenceEnrollments?: LeadCadenceEnrollment[];
  serviceArea?: { slug: string; status: string } | null;
};

export type TeamLocation = {
  userId: string;
  name?: string | null;
  email?: string | null;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  occurredAt: string;
  serviceArea?: { slug: string; status: string } | null;
};

export type TerritorySummary = {
  id: string;
  name: string;
  slug: string;
  type: string;
  color?: string | null;
  geometry?: any;
  parentId?: string | null;
  assignments?: Array<{
    id: string;
    role: string;
    isPrimary?: boolean | null;
    user: LeadOwner;
  }>;
};

export type CadenceStepSummary = {
  id: string;
  order: number;
  channel: string;
  waitMinutes: number;
  slaMinutes?: number | null;
  autoComplete?: boolean | null;
};

export type CadenceSummary = {
  id: string;
  name: string;
  description?: string | null;
  targetStage?: string | null;
  steps: CadenceStepSummary[];
  enrollments?: Array<{ id: string; status: string }>;
};

export type ServiceAreaSummary = {
  tile: {
    id: string;
    slug: string;
    name: string;
    status: string;
  };
  zipCount?: number;
  tileGeometry?: any | null;
  hasConflicts?: boolean;
  conflictZipCount?: number;
};
