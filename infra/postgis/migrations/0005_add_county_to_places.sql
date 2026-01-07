-- Migration 0005: Add county information to places
-- Adds county_name column to places and creates county table
SET search_path TO public, geo, admin;
-- Add county_name column to places
ALTER TABLE geo.place
ADD COLUMN IF NOT EXISTS county_name text;

-- Create county table for Census county boundaries
CREATE TABLE IF NOT EXISTS geo.county (
  county_id text PRIMARY KEY,
  name text NOT NULL,
  state text NOT NULL,
  geom geometry(MultiPolygon, 4326)
);

-- Create spatial index on county geometry
CREATE INDEX IF NOT EXISTS idx_county_geom 
ON geo.county USING GIST(geom);

-- Create index on county (state, name) for fast lookups
CREATE INDEX IF NOT EXISTS idx_county_state_name
ON geo.county(state, name);

-- Create index on place.county_name for fast filtering
CREATE INDEX IF NOT EXISTS idx_place_county_name
ON geo.place(county_name);

-- Note: Run `npm run etl:counties` to download and import US Census county data

















