// Pure pricing logic for Yardura quote system
// No external API calls - all calculations are local

export type YardSize = 'small' | 'medium' | 'large' | 'xl';
export type Frequency = 'weekly' | 'biweekly';
export type AddonType = 'deodorize' | 'litterBox';

export interface QuoteInput {
  address: string;
  city?: string;
  zip?: string;
  dogs: 1 | 2 | 3 | 4;
  yardSize: YardSize;
  frequency: Frequency;
  addons: { [key in AddonType]?: boolean };
  notes?: string;
  contact?: {
    name: string;
    email: string;
    phone: string;
  };
  schedulePref?: {
    day?: string;
    window?: string;
  };
  consent?: {
    stoolPhotosOptIn: boolean;
    terms: boolean;
  };
}

export interface PriceBreakdown {
  basePrice: number;
  dogMultiplier: number;
  sizeMultiplier: number;
  frequencyMultiplier: number;
  addonsTotal: number;
  total: number;
  firstVisitPrice: number; // Initial clean + first service
  monthlyEstimate: number; // Approximate monthly cost
}

export interface EstimatorResult {
  breakdown: PriceBreakdown;
  formatted: {
    total: string;
    firstVisit: string;
    monthly: string;
  };
  description: string;
}

// Base pricing per visit (weekly rates)
const BASE_PRICING: Record<YardSize, number> = {
  small: 25,    // < 2,500 sq ft
  medium: 35,   // 2,500-5,000 sq ft
  large: 45,    // 5,000-10,000 sq ft
  xl: 60,       // > 10,000 sq ft
};

// Dog multipliers (percentage increase per additional dog)
const DOG_MULTIPLIERS = [1, 1.2, 1.4, 1.6]; // 1 dog, 2 dogs, 3 dogs, 4 dogs

// Frequency multipliers
const FREQUENCY_MULTIPLIERS: Record<Frequency, number> = {
  weekly: 1,
  biweekly: 0.95, // 5% discount for bi-weekly
};

// Add-on pricing
const ADDON_PRICING: Record<AddonType, number> = {
  deodorize: 15,
  litterBox: 10,
};

// First visit/initial clean pricing (one-time)
const FIRST_VISIT_PRICING: Record<YardSize, number> = {
  small: 75,
  medium: 95,
  large: 125,
  xl: 175,
};

// Service area premium (cities with higher cost of living)
const PREMIUM_CITIES = [
  'minneapolis', 'st paul', 'edina', 'bloomington',
  'wayzata', 'hopkins', 'minnetonka', 'plymouth'
];

/**
 * Calculate pricing for a quote
 */
export function calculatePrice(input: Partial<QuoteInput>): EstimatorResult {
  const {
    dogs = 1,
    yardSize = 'medium',
    frequency = 'weekly',
    addons = {},
    address = '',
    city = ''
  } = input;

  // Base price calculation
  const basePrice = BASE_PRICING[yardSize];

  // Dog multiplier
  const dogMultiplier = DOG_MULTIPLIERS[dogs - 1] || 1;

  // Size multiplier (already built into base pricing)
  const sizeMultiplier = 1;

  // Frequency multiplier
  const frequencyMultiplier = FREQUENCY_MULTIPLIERS[frequency];

  // Add-ons total
  const addonsTotal = Object.entries(addons).reduce((total, [addon, selected]) => {
    if (selected && addon in ADDON_PRICING) {
      return total + ADDON_PRICING[addon as AddonType];
    }
    return total;
  }, 0);

  // City premium (if applicable)
  const cityLower = (city || address.split(',').pop() || '').toLowerCase().trim();
  const isPremiumArea = PREMIUM_CITIES.some(premium =>
    cityLower.includes(premium) || premium.includes(cityLower)
  );
  const premiumMultiplier = isPremiumArea ? 1.1 : 1;

  // Calculate per-visit total
  const perVisitTotal = Math.round(
    (basePrice * dogMultiplier * frequencyMultiplier + addonsTotal) * premiumMultiplier
  );

  // First visit pricing
  const firstVisitBase = FIRST_VISIT_PRICING[yardSize];
  const firstVisitTotal = Math.round(
    (firstVisitBase * dogMultiplier + addonsTotal) * premiumMultiplier
  );

  // Monthly estimate (4 weeks average)
  const visitsPerMonth = frequency === 'weekly' ? 4 : 2;
  const monthlyEstimate = Math.round(perVisitTotal * visitsPerMonth * 1.05); // +5% for taxes/fees

  const breakdown: PriceBreakdown = {
    basePrice,
    dogMultiplier,
    sizeMultiplier,
    frequencyMultiplier,
    addonsTotal,
    total: perVisitTotal,
    firstVisitPrice: firstVisitTotal,
    monthlyEstimate
  };

  const formatted = {
    total: formatPrice(perVisitTotal),
    firstVisit: formatPrice(firstVisitTotal),
    monthly: formatPrice(monthlyEstimate)
  };

  const description = generatePriceDescription(input, breakdown);

  return {
    breakdown,
    formatted,
    description
  };
}

/**
 * Format price as currency string
 */
export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Generate human-readable price description
 */
function generatePriceDescription(input: Partial<QuoteInput>, breakdown: PriceBreakdown): string {
  const { dogs = 1, yardSize, frequency, addons = {} } = input;
  const activeAddons = Object.entries(addons).filter(([, selected]) => selected).length;

  let description = `${frequency === 'weekly' ? 'Weekly' : 'Bi-weekly'} service`;

  if (dogs > 1) {
    description += ` for ${dogs} dogs`;
  }

  if (activeAddons > 0) {
    description += ` + ${activeAddons} add-on${activeAddons > 1 ? 's' : ''}`;
  }

  if (breakdown.frequencyMultiplier < 1) {
    description += ` (${Math.round((1 - breakdown.frequencyMultiplier) * 100)}% discount for bi-weekly)`;
  }

  return description;
}

/**
 * Validate quote input
 */
export function validateQuoteInput(input: Partial<QuoteInput>): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  // Address validation
  if (!input.address?.trim()) {
    errors.address = ['Address is required'];
  } else if (input.address.trim().length < 10) {
    errors.address = ['Please enter a complete address'];
  }

  // Dogs validation
  if (!input.dogs || input.dogs < 1 || input.dogs > 4) {
    errors.dogs = ['Please select 1-4 dogs'];
  }

  // Yard size validation
  if (!input.yardSize) {
    errors.yardSize = ['Please select yard size'];
  }

  // Frequency validation
  if (!input.frequency) {
    errors.frequency = ['Please select service frequency'];
  }

  // Contact validation (if provided)
  if (input.contact) {
    if (!input.contact.name?.trim()) {
      errors['contact.name'] = ['Name is required'];
    }

    if (!input.contact.email?.trim()) {
      errors['contact.email'] = ['Email is required'];
    } else if (!isValidEmail(input.contact.email)) {
      errors['contact.email'] = ['Please enter a valid email'];
    }

    if (!input.contact.phone?.trim()) {
      errors['contact.phone'] = ['Phone is required'];
    } else if (!isValidPhone(input.contact.phone)) {
      errors['contact.phone'] = ['Please enter a valid phone number'];
    }
  }

  return errors;
}

/**
 * Email validation
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Phone validation (basic US format)
 */
function isValidPhone(phone: string): boolean {
  const phoneRegex = /^\(?[\d\s\-\(\)]{10,}$/;
  const cleanPhone = phone.replace(/[^\d]/g, '');
  return phoneRegex.test(phone) && cleanPhone.length >= 10;
}

/**
 * Get yard size options with descriptions
 */
export function getYardSizeOptions() {
  return [
    { value: 'small', label: 'Small', description: '< 2,500 sq ft', price: BASE_PRICING.small },
    { value: 'medium', label: 'Medium', description: '2,500-5,000 sq ft', price: BASE_PRICING.medium },
    { value: 'large', label: 'Large', description: '5,000-10,000 sq ft', price: BASE_PRICING.large },
    { value: 'xl', label: 'XL', description: '> 10,000 sq ft', price: BASE_PRICING.xl }
  ];
}

/**
 * Get addon options
 */
export function getAddonOptions() {
  return [
    {
      id: 'deodorize',
      label: 'Deodorize & Sanitize',
      description: 'Pet-safe enzymatic spray',
      price: ADDON_PRICING.deodorize
    },
    {
      id: 'litterBox',
      label: 'Litter Box Service',
      description: 'Clean and maintain outdoor litter areas',
      price: ADDON_PRICING.litterBox
    }
  ];
}

/**
 * Get frequency options
 */
export function getFrequencyOptions() {
  return [
    { value: 'weekly', label: 'Weekly', description: 'Every 7 days', discount: 0 },
    { value: 'biweekly', label: 'Bi-weekly', description: 'Every 14 days', discount: 5 }
  ];
}
