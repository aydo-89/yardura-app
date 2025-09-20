-- Yardura Dog Waste Removal Service Database Setup
-- Run this SQL in your Supabase SQL Editor

-- Create yardura_customers table
CREATE TABLE yardura_customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stripeCustomerId TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  city TEXT,
  zip TEXT,
  serviceDay TEXT NOT NULL CHECK (serviceDay IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'twice-weekly', 'bi-weekly', 'one-time')),
  yardSize TEXT NOT NULL CHECK (yardSize IN ('small', 'medium', 'large', 'xlarge')),
  dogs INTEGER NOT NULL CHECK (dogs >= 1 AND dogs <= 8),
  addOns JSONB DEFAULT '{}'::jsonb,
  dataOptIn BOOLEAN DEFAULT false,
  stripeSubscriptionId TEXT,
  stripePriceId TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'cancelled')),
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create service_visits table
CREATE TABLE service_visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customerId UUID NOT NULL REFERENCES yardura_customers(id) ON DELETE CASCADE,
  scheduledDate TIMESTAMP WITH TIME ZONE NOT NULL,
  completedDate TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')),
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  stripePaymentIntentId TEXT,
  notes TEXT,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_yardura_customers_stripe_id ON yardura_customers(stripeCustomerId);
CREATE INDEX idx_yardura_customers_email ON yardura_customers(email);
CREATE INDEX idx_yardura_customers_status ON yardura_customers(status);
CREATE INDEX idx_service_visits_customer_id ON service_visits(customerId);
CREATE INDEX idx_service_visits_scheduled_date ON service_visits(scheduledDate);
CREATE INDEX idx_service_visits_status ON service_visits(status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updatedAt = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_yardura_customers_updated_at
    BEFORE UPDATE ON yardura_customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_visits_updated_at
    BEFORE UPDATE ON service_visits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add Row Level Security (RLS) policies
ALTER TABLE yardura_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_visits ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your authentication needs)
-- For now, we'll allow all operations (you can restrict this later)
CREATE POLICY "Allow all operations on yardura_customers" ON yardura_customers FOR ALL USING (true);
CREATE POLICY "Allow all operations on service_visits" ON service_visits FOR ALL USING (true);

-- Insert some sample data for testing (optional)
-- INSERT INTO yardura_customers (
--   stripeCustomerId,
--   email,
--   name,
--   city,
--   serviceDay,
--   frequency,
--   yardSize,
--   dogs,
--   addOns,
--   stripePriceId,
--   status
-- ) VALUES (
--   'cus_test123',
--   'test@example.com',
--   'Test Customer',
--   'Minneapolis',
--   'monday',
--   'weekly',
--   'medium',
--   2,
--   '{"deodorize": false, "litter": false}'::jsonb,
--   'price_test123',
--   'active'
-- );

-- Show completion message
DO $$
BEGIN
    RAISE NOTICE 'Database setup complete!';
    RAISE NOTICE 'Tables created: yardura_customers, service_visits';
    RAISE NOTICE 'Indexes and triggers have been set up';
    RAISE NOTICE 'Row Level Security is enabled';
END $$;

-- =============================================
-- Deposits tracking for Eco Impact calculations
-- =============================================

CREATE TABLE IF NOT EXISTS service_deposits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customerId UUID NOT NULL REFERENCES yardura_customers(id) ON DELETE CASCADE,
  visitId UUID REFERENCES service_visits(id) ON DELETE SET NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  count INTEGER NOT NULL CHECK (count >= 1),
  weight_grams INTEGER CHECK (weight_grams >= 0),
  moisture_percent INTEGER CHECK (moisture_percent >= 0 AND moisture_percent <= 100),
  c_color TEXT,
  c_content TEXT,
  c_consistency TEXT,
  notes TEXT,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_deposits_customer ON service_deposits(customerId);
CREATE INDEX IF NOT EXISTS idx_service_deposits_visit ON service_deposits(visitId);
CREATE INDEX IF NOT EXISTS idx_service_deposits_time ON service_deposits(timestamp);

CREATE TRIGGER update_service_deposits_updated_at
    BEFORE UPDATE ON service_deposits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE service_deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on service_deposits" ON service_deposits FOR ALL USING (true);
