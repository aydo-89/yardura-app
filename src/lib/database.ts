// Database implementation using Supabase
// This replaces the mock database with real database operations

export interface YarduraCustomer {
  id: string;
  stripeCustomerId: string;
  email: string;
  name: string;
  phone?: string;
  address?: string;
  city?: string;
  zip?: string;
  serviceDay: string; // 'monday', 'tuesday', etc.
  frequency: string; // 'weekly', 'twice-weekly', 'bi-weekly', 'one-time'
  yardSize: string; // 'small', 'medium', 'large', 'xlarge'
  dogs: number;
  salesRepId?: string; // Added for commission tracking
  addOns: {
    deodorize: boolean;
    litter: boolean;
  };
  dataOptIn: boolean;
  stripeSubscriptionId?: string;
  stripePriceId: string;
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

// Import Supabase client
import { supabase } from './supabase';

// Convert Supabase timestamp to Date
function parseTimestamp(timestamp: string): Date {
  return new Date(timestamp);
}

// Convert database record to our interface
function mapCustomerRecord(record: any): YarduraCustomer {
  return {
    ...record,
    createdAt: parseTimestamp(record.createdAt),
    updatedAt: parseTimestamp(record.updatedAt),
  };
}

function mapVisitRecord(record: any): ServiceVisit {
  return {
    ...record,
    scheduledDate: parseTimestamp(record.scheduledDate),
    completedDate: record.completedDate ? parseTimestamp(record.completedDate) : undefined,
    createdAt: parseTimestamp(record.createdAt),
    updatedAt: parseTimestamp(record.updatedAt),
  };
}

export const db = {
  async createCustomer(customer: Omit<YarduraCustomer, 'id' | 'createdAt' | 'updatedAt'>): Promise<YarduraCustomer> {
    const { data, error } = await supabase
      .from('yardura_customers')
      .insert(customer)
      .select()
      .single();

    if (error) throw error;
    return mapCustomerRecord(data);
  },

  async getCustomer(id: string): Promise<YarduraCustomer | null> {
    const { data, error } = await supabase
      .from('yardura_customers')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data ? mapCustomerRecord(data) : null;
  },

  async getCustomerByStripeId(stripeCustomerId: string): Promise<YarduraCustomer | null> {
    const { data, error } = await supabase
      .from('yardura_customers')
      .select('*')
      .eq('stripeCustomerId', stripeCustomerId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data ? mapCustomerRecord(data) : null;
  },

  async updateCustomer(id: string, updates: Partial<YarduraCustomer>): Promise<YarduraCustomer | null> {
    const { data, error } = await supabase
      .from('yardura_customers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return mapCustomerRecord(data);
  },

  async createServiceVisit(visit: Omit<ServiceVisit, 'id' | 'createdAt' | 'updatedAt'>): Promise<ServiceVisit> {
    const { data, error } = await supabase
      .from('service_visits')
      .insert(visit)
      .select()
      .single();

    if (error) throw error;
    return mapVisitRecord(data);
  },

  async getServiceVisit(id: string): Promise<ServiceVisit | null> {
    const { data, error } = await supabase
      .from('service_visits')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data ? mapVisitRecord(data) : null;
  },

  async getServiceVisits(customerId: string): Promise<ServiceVisit[]> {
    const { data, error } = await supabase
      .from('service_visits')
      .select('*')
      .eq('customerId', customerId)
      .order('scheduledDate', { ascending: true });

    if (error) throw error;
    return data.map(mapVisitRecord);
  },

  async updateServiceVisit(id: string, updates: Partial<ServiceVisit>): Promise<ServiceVisit | null> {
    const { data, error } = await supabase
      .from('service_visits')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return mapVisitRecord(data);
  },

  async getUpcomingVisits(customerId: string): Promise<ServiceVisit[]> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('service_visits')
      .select('*')
      .eq('customerId', customerId)
      .eq('status', 'scheduled')
      .gte('scheduledDate', now)
      .order('scheduledDate', { ascending: true });

    if (error) throw error;
    return data.map(mapVisitRecord);
  },

  async getVisitsByDateRange(startDate: Date, endDate: Date): Promise<ServiceVisit[]> {
    const { data, error } = await supabase
      .from('service_visits')
      .select('*')
      .gte('scheduledDate', startDate.toISOString())
      .lte('scheduledDate', endDate.toISOString());

    if (error) throw error;
    return data.map(mapVisitRecord);
  }
};
