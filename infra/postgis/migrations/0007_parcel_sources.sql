-- Migration: parcel source registry and county metadata
BEGIN;
SET search_path TO extensions, public, geo, admin;

ALTER TABLE geo.parcel
  ADD COLUMN IF NOT EXISTS county_fips TEXT,
  ADD COLUMN IF NOT EXISTS county_name TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT;

CREATE INDEX IF NOT EXISTS parcel_county_fips_idx ON geo.parcel (county_fips);
CREATE INDEX IF NOT EXISTS parcel_state_idx ON geo.parcel (state);
CREATE INDEX IF NOT EXISTS parcel_state_county_idx ON geo.parcel (state, county_fips);
CREATE INDEX IF NOT EXISTS parcel_zip_idx ON geo.parcel (zip_code);

CREATE TABLE IF NOT EXISTS admin.parcel_source (
  source_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  county_name TEXT,
  state TEXT,
  county_fips TEXT,
  source_type TEXT NOT NULL DEFAULT 'arcgis',
  source_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  last_imported_at TIMESTAMPTZ,
  record_count INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS parcel_source_state_idx ON admin.parcel_source (state);
CREATE INDEX IF NOT EXISTS parcel_source_county_idx ON admin.parcel_source (county_fips);
CREATE INDEX IF NOT EXISTS parcel_source_status_idx ON admin.parcel_source (status);

COMMIT;
