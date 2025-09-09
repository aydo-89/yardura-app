import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface YarduraCustomer {
  id: string;
  stripeCustomerId: string;
  email: string;
  name: string;
  phone?: string;
  address?: string;
  city?: string;
  zip?: string;
  serviceDay: string;
  frequency: string;
  yardSize: string;
  dogs: number;
  addOns: {
    deodorize: boolean;
    litter: boolean;
  };
  dataOptIn: boolean;
  stripeSubscriptionId?: string;
  stripePriceId: string;
  status: 'pending' | 'active' | 'paused' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface ServiceVisit {
  id: string;
  customerId: string;
  scheduledDate: string;
  completedDate?: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
  amount: number;
  stripePaymentIntentId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceDeposit {
  id: string;
  customerId: string;
  visitId?: string;
  timestamp: string;
  count: number;
  weight_grams?: number;
  moisture_percent?: number;
  c_color?: string;
  c_content?: string;
  c_consistency?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Database operations
export const db = {
  // Customer operations
  async createCustomer(customer: Omit<YarduraCustomer, 'id' | 'createdAt' | 'updatedAt'>) {
    const { data, error } = await supabase
      .from('yardura_customers')
      .insert(customer)
      .select()
      .single();

    if (error) throw error;
    return data as YarduraCustomer;
  },

  async getCustomer(id: string) {
    const { data, error } = await supabase
      .from('yardura_customers')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as YarduraCustomer | null;
  },

  async getCustomerByStripeId(stripeCustomerId: string) {
    const { data, error } = await supabase
      .from('yardura_customers')
      .select('*')
      .eq('stripeCustomerId', stripeCustomerId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as YarduraCustomer | null;
  },

  async updateCustomer(id: string, updates: Partial<YarduraCustomer>) {
    const { data, error } = await supabase
      .from('yardura_customers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as YarduraCustomer;
  },

  // Service visit operations
  async createServiceVisit(visit: Omit<ServiceVisit, 'id' | 'createdAt' | 'updatedAt'>) {
    const { data, error } = await supabase.from('service_visits').insert(visit).select().single();

    if (error) throw error;
    return data as ServiceVisit;
  },

  async getServiceVisit(id: string) {
    const { data, error } = await supabase.from('service_visits').select('*').eq('id', id).single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as ServiceVisit | null;
  },

  async getServiceVisits(customerId: string) {
    const { data, error } = await supabase
      .from('service_visits')
      .select('*')
      .eq('customerId', customerId)
      .order('scheduledDate', { ascending: true });

    if (error) throw error;
    return data as ServiceVisit[];
  },

  async updateServiceVisit(id: string, updates: Partial<ServiceVisit>) {
    const { data, error } = await supabase
      .from('service_visits')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as ServiceVisit;
  },

  async getUpcomingVisits(customerId: string) {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('service_visits')
      .select('*')
      .eq('customerId', customerId)
      .eq('status', 'scheduled')
      .gte('scheduledDate', now)
      .order('scheduledDate', { ascending: true });

    if (error) throw error;
    return data as ServiceVisit[];
  },

  async getVisitsByDateRange(startDate: string, endDate: string) {
    const { data, error } = await supabase
      .from('service_visits')
      .select('*')
      .gte('scheduledDate', startDate)
      .lte('scheduledDate', endDate);

    if (error) throw error;
    return data as ServiceVisit[];
  },
};

export const deposits = {
  async create(deposit: Omit<ServiceDeposit, 'id' | 'createdAt' | 'updatedAt'>) {
    const { data, error } = await supabase
      .from('service_deposits')
      .insert(deposit)
      .select()
      .single();
    if (error) throw error;
    return data as ServiceDeposit;
  },

  async listByCustomer(customerId: string, from?: string, to?: string) {
    let q = supabase
      .from('service_deposits')
      .select('*')
      .eq('customerId', customerId)
      .order('timestamp', { ascending: false });
    if (from) q = q.gte('timestamp', from);
    if (to) q = q.lte('timestamp', to);
    const { data, error } = await q;
    if (error) throw error;
    return data as ServiceDeposit[];
  },

  async remove(id: string) {
    const { error } = await supabase.from('service_deposits').delete().eq('id', id);
    if (error) throw error;
    return true;
  },
};
