// Core quote types - aligned with existing QuoteInput
export interface QuoteData {
  // Service area validation
  zipCode?: string;
  zipValidated?: boolean;
  tileSlug?: string;
  tileStatus?: string;
  tileActivationEligible?: boolean;
  serviceType?: "residential" | "commercial";

  // Basic service details
  dogs?: number;
  yardSize?: "small" | "medium" | "large" | "xl";
  frequency?: "weekly" | "biweekly" | "twice-weekly" | "daily" | "monthly" | "one-time";
  weekendUpgrade?: boolean;

  // Property info
  propertyType?: "residential" | "commercial"; // Legacy field, use serviceType instead
  businessType?: string; // Added for commercial business type
  serviceFrequency?: string; // Added for commercial service frequency

  // Address information
  address?: string;
  addressValidated?: boolean;
  addressMeta?: {
    city?: string;
    state?: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
  };

  // Add-ons and services
  addOns?: {
    deodorize?: boolean;
    deodorizeMode?: "first-visit" | "each-visit" | "every-other" | "one-time" | "onetime";
    sprayDeck?: boolean;
    sprayDeckMode?: "first-visit" | "each-visit" | "every-other" | "one-time" | "onetime";
    divertMode?: "none" | "takeaway" | "compost";
  };

  // Additional service areas (legacy property)
  areasToClean?: Record<string, boolean | string>;

  deepCleanAssessment?: {
    daysSinceLastCleanup?: number;
  };

  // Cleanup timing
  lastCleanedBucket?: string;
  lastCleanedDate?: string;
  initialClean?: boolean;
  daysSinceLastCleanup?: number;

  // Contact information
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  contact?: {
    name?: string;
    title?: string;
    email?: string;
    phone?: string;
  };

  // Additional preferences
  specialInstructions?: string;
  referralSource?: string;
  preferredContactMethod?: "email" | "phone";
  preferredContactMethods?: string[]; // For multiple selections
  howDidYouHear?: string;
  salesRepId?: string;
  salesRepName?: string;

  consent?: {
    stoolPhotosOptIn?: boolean;
    terms?: boolean;
    marketingOptIn?: boolean;
  };

  // Commercial details
  commercialNotes?: string;

  // Wellness options
  premiumOnboarding?: string;
  wellnessWaitlist?: {
    dna?: boolean;
    microbiome?: boolean;
    main?: boolean;
  };
  wellnessDataOptIn?: boolean;

  // Scheduling preferences
  preferredStartDate?: string;
  customStartDate?: string;
}

export interface PricingData {
  basePrice?: number;
  frequency?: string;
  serviceType?: string;
  addOns?: Array<{
    name: string;
    price: number;
  }>;
  totalPrice?: number;
  requiresCustomQuote?: boolean;
  commercialMessage?: string;
  perVisit?: number | string;
  monthly?: number | string;
  oneTime?: number | string;
  initialClean?: number | string;
  initialCleanDiscount?: number | string;
  discountedInitialClean?: number | string;
  amountDueToday?: number | string | null;
  firstMonthCents?: number | string | null;
  firstMonthVisits?: number | string | null;
  visitsPerMonth?: number | string;
  fullMonthlyAmount?: number | string;
  firstVisitAddOns?: Record<string, string | number>;
  recurringAddOns?: Record<string, string | number>;
  firstVisitTotal?: number | string;
  firstVisitTotalCents?: number;
  initialCleanBucket?: string;
  breakdown?: any;
  zoneMultiplier?: number;
  weekendUpgrade?: boolean;
  weekendSurchargeCents?: number | null;
  weekendVisitsPerMonth?: number | null;
  trialWeek?: {
    initialCleanCents: number;
    followUpVisitCount: number;
    followUpVisitsCents: number;
    addOnCents: number;
    totalValueCents: number;
    creditsCents: {
      initialClean: number;
      followUpVisits: number;
      addOns: number;
      total: number;
    };
    netDueCents?: number;
    trialLengthDays?: number;
  } | null;
  postTrial?: {
    recurringPerVisitCents: number;
    recurringMonthlyCents: number;
    firstInvoiceAddOnsCents: number;
    firstInvoiceAddOns?: Record<string, number>;
    premiumOnboardingCents?: number;
    activationDelayDays?: number;
  } | null;
}

export interface QuoteStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  component: React.ComponentType<StepProps>;
}

export interface QuoteState {
  currentStep: number;
  quoteData: QuoteData;
  pricing: PricingData | null;
  isSubmitting: boolean;
  errors: Record<string, string>;
}

// Step component props
export interface StepProps {
  quoteData: QuoteData;
  updateQuoteData: (updates: Partial<QuoteData>) => void;
  _errors?: Record<string, string[]>;
  errors?: Record<string, string>;
  _estimatedPrice?: PricingData;
  estimatedPrice?: PricingData;
  onNext?: () => void;
  orgId?: string;
}

// Trust signals for the quote process
export interface TrustSignal {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}
