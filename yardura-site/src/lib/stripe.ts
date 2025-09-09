import { Stripe } from 'stripe';
import { Frequency, YardSize } from './pricing';

// Initialize Stripe
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is required');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-08-27.basil',
  typescript: true,
});

// Import pricing configuration
import { buildLookupKey } from './stripe-pricing';

// Product IDs for your service variations
// Use the getPriceId() function to get the correct price ID for any combination
export const STRIPE_PRODUCTS = {
  weekly: {
    id: 'prod_weekly_service',
  },
  'twice-weekly': {
    id: 'prod_twice_weekly_service',
  },
  'bi-weekly': {
    id: 'prod_bi_weekly_service',
  },
  'one-time': {
    id: 'prod_one_time_service',
  },
};

// Helper function to get the correct Stripe price ID
export async function getStripePriceId(
  frequency: Frequency,
  yardSize: YardSize,
  dogs: number
): Promise<string> {
  const lookupKey = buildLookupKey(frequency, yardSize, Math.min(dogs, 8) as number);
  const prices = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  if (prices.data.length === 0) {
    throw new Error(
      `Stripe price not found for ${lookupKey}. Make sure products/prices are created.`
    );
  }
  return prices.data[0].id;
}

// Service day mapping to Stripe billing cycle anchors
export const BILLING_ANCHOR_DAYS = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 0,
};

export type ServiceDay = keyof typeof BILLING_ANCHOR_DAYS;

// Customer and subscription interfaces
export interface YarduraCustomer {
  id: string;
  stripeCustomerId: string;
  email: string;
  name: string;
  phone?: string;
  address?: string;
  city?: string;
  zip?: string;
  serviceDay: ServiceDay;
  frequency: Frequency;
  yardSize: YardSize;
  dogs: number;
  salesRepId?: string; // Added for commission tracking
  addOns: {
    deodorize: boolean;
    litter: boolean;
  };
  dataOptIn: boolean;
  status: 'pending' | 'active' | 'paused' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceVisit {
  id: string;
  customerId: string;
  scheduledDate: Date;
  completedDate?: Date;
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
  amount: number;
  stripePaymentIntentId?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
