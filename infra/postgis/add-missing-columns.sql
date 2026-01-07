-- Add missing columns to geo.service_tile and geo.service_tile_zip
-- Run this in Supabase SQL Editor

SET search_path TO extensions, public, geo, admin;

-- Add missing columns to service_tile
ALTER TABLE geo.service_tile ADD COLUMN IF NOT EXISTS min_scoopers INTEGER;
ALTER TABLE geo.service_tile ADD COLUMN IF NOT EXISTS min_customer_units INTEGER;
ALTER TABLE geo.service_tile ADD COLUMN IF NOT EXISTS coverage_radius_m NUMERIC;
ALTER TABLE geo.service_tile ADD COLUMN IF NOT EXISTS territory_id TEXT;

-- Add missing columns to service_tile_zip
ALTER TABLE geo.service_tile_zip ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE geo.service_tile_zip ADD COLUMN IF NOT EXISTS added_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE geo.service_tile_zip ADD COLUMN IF NOT EXISTS added_by TEXT;
ALTER TABLE geo.service_tile_zip ADD COLUMN IF NOT EXISTS notes TEXT;

-- Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'geo' 
  AND table_name = 'service_tile'
ORDER BY ordinal_position;

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'geo' 
  AND table_name = 'service_tile_zip'
ORDER BY ordinal_position;









