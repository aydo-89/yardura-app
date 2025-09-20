// Core quote types - aligned with existing QuoteInput
export interface QuoteData {
  // Service area validation
  zipCode?: string;
  serviceType?: 'residential' | 'commercial';

  // Basic service details
  dogs?: number;
  yardSize?: 'small' | 'medium' | 'large' | 'xl';
  frequency?: 'weekly' | 'biweekly' | 'twice-weekly' | 'monthly' | 'one-time';

  // Property info
  propertyType?: 'residential' | 'commercial'; // Legacy field, use serviceType instead
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
    deodorizeMode?: 'first-visit' | 'each-visit' | 'every-other' | 'one-time';
    sprayDeck?: boolean;
    sprayDeckMode?: 'first-visit' | 'each-visit' | 'every-other' | 'one-time';
    divertMode?: 'none' | 'takeaway' | '25' | '50' | '100';
  };

  // Additional service areas (legacy property)
  areasToClean?: Record<string, boolean>;

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
  preferredContactMethod?: 'email' | 'phone';
  preferredContactMethods?: string[]; // For multiple selections
  smsConsent?: boolean;
  howDidYouHear?: string;

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
}

// Trust signals for the quote process
export interface TrustSignal {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}
