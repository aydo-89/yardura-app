-- Combined PostGIS migrations for Supabase SQL Editor
-- Run this in: Supabase Dashboard → SQL Editor → New Query

-- Ensure search path includes extensions schema where PostGIS is installed
SET search_path TO extensions, public, geo, admin;

-- Extension setup (should already be done)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- Create schemas
CREATE SCHEMA IF NOT EXISTS geo;
CREATE SCHEMA IF NOT EXISTS admin;

-- Create metadata table
CREATE TABLE IF NOT EXISTS admin.dataset_version (
  dataset_name TEXT PRIMARY KEY,
  source_url TEXT,
  version TEXT,
  loaded_at TIMESTAMPTZ DEFAULT now()
);

-- Migration tracking table
CREATE TABLE IF NOT EXISTS admin.migrations (
  id SERIAL PRIMARY KEY,
  file_name TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Migration 0001: Create base tables
-- ============================================================================

-- ZCTA polygons
CREATE TABLE IF NOT EXISTS geo.zcta (
  zip TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  county TEXT,
  place_name TEXT,
  population INTEGER,
  area_sq_m DOUBLE PRECISION,
  geom geometry(MultiPolygon, 4326) NOT NULL,
  geom_simplified geometry(MultiPolygon, 4326),
  centroid geometry(Point, 4326)
);
CREATE INDEX IF NOT EXISTS zcta_geom_idx ON geo.zcta USING GIST (geom);
CREATE INDEX IF NOT EXISTS zcta_state_idx ON geo.zcta (state);

-- Incorporated places
CREATE TABLE IF NOT EXISTS geo.place (
  place_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  type TEXT,
  population INTEGER,
  bbox geometry(Polygon, 4326),
  geom geometry(MultiPolygon, 4326) NOT NULL,
  geom_simplified geometry(MultiPolygon, 4326)
);
CREATE INDEX IF NOT EXISTS place_geom_idx ON geo.place USING GIST (geom);
CREATE INDEX IF NOT EXISTS place_state_idx ON geo.place (state);
CREATE INDEX IF NOT EXISTS place_name_idx ON geo.place USING GIN (name gin_trgm_ops);

-- Record migration
INSERT INTO admin.migrations (file_name) VALUES ('0001_create_base_tables.sql')
ON CONFLICT (file_name) DO NOTHING;

-- ============================================================================
-- Migration 0002: Service tiles
-- ============================================================================

CREATE TABLE IF NOT EXISTS geo.service_tile (
  tile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  min_scoopers INTEGER,
  min_customer_units INTEGER,
  coverage_radius_m NUMERIC,
  territory_id TEXT,
  delivery_days INTEGER[],
  go_live_date TIMESTAMPTZ,
  notes TEXT,
  centroid geometry(Point, 4326),
  bbox geometry(Polygon, 4326),
  geom geometry(MultiPolygon, 4326) NOT NULL,
  geom_simplified geometry(MultiPolygon, 4326),
  geom_buffered geometry(MultiPolygon, 4326),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS service_tile_geom_idx ON geo.service_tile USING GIST (geom);
CREATE INDEX IF NOT EXISTS service_tile_slug_idx ON geo.service_tile (slug);
CREATE UNIQUE INDEX IF NOT EXISTS service_tile_org_slug_idx ON geo.service_tile (org_id, slug);

CREATE TABLE IF NOT EXISTS geo.service_tile_zip (
  tile_id UUID REFERENCES geo.service_tile(tile_id) ON DELETE CASCADE,
  zip TEXT NOT NULL,
  status TEXT,
  coverage_percent DOUBLE PRECISION,
  area_sq_m DOUBLE PRECISION,
  added_at TIMESTAMPTZ DEFAULT now(),
  added_by TEXT,
  notes TEXT,
  PRIMARY KEY (tile_id, zip)
);
CREATE INDEX IF NOT EXISTS service_tile_zip_zip_idx ON geo.service_tile_zip (zip);

INSERT INTO admin.migrations (file_name) VALUES ('0002_service_tiles.sql')
ON CONFLICT (file_name) DO NOTHING;

-- ============================================================================
-- Migration 0003: Tile parity
-- ============================================================================

ALTER TABLE geo.service_tile ADD COLUMN IF NOT EXISTS prisma_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS service_tile_prisma_id_idx 
  ON geo.service_tile (prisma_id) 
  WHERE prisma_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS service_tile_org_status_idx 
  ON geo.service_tile (org_id, status);

INSERT INTO admin.migrations (file_name) VALUES ('0003_tile_parity.sql')
ON CONFLICT (file_name) DO NOTHING;

-- ============================================================================
-- Migration 0004: Add service tile zip coverage
-- ============================================================================

ALTER TABLE geo.service_tile_zip ADD COLUMN IF NOT EXISTS clipped_geom geometry(MultiPolygon, 4326);
CREATE INDEX IF NOT EXISTS service_tile_zip_clipped_geom_idx 
  ON geo.service_tile_zip USING GIST (clipped_geom) 
  WHERE clipped_geom IS NOT NULL;

INSERT INTO admin.migrations (file_name) VALUES ('0004_add_service_tile_zip_coverage.sql')
ON CONFLICT (file_name) DO NOTHING;

-- ============================================================================
-- Migration 0005: Add county to places
-- ============================================================================

ALTER TABLE geo.place ADD COLUMN IF NOT EXISTS county TEXT;

CREATE TABLE IF NOT EXISTS geo.county (
  county_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  geom geometry(MultiPolygon, 4326)
);
CREATE INDEX IF NOT EXISTS county_geom_idx ON geo.county USING GIST (geom);
CREATE INDEX IF NOT EXISTS county_state_idx ON geo.county (state);

CREATE INDEX IF NOT EXISTS place_county_idx ON geo.place (county);

INSERT INTO admin.migrations (file_name) VALUES ('0005_add_county_to_places.sql')
ON CONFLICT (file_name) DO NOTHING;

-- ============================================================================
-- Migration 0006: Parcel boundaries
-- ============================================================================

CREATE TABLE IF NOT EXISTS geo.parcel (
  parcel_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'hennepin-umn',
  house_no INTEGER,
  street_name TEXT,
  zip_code TEXT,
  municip_name TEXT,
  geom geometry(MultiPolygon, 4326) NOT NULL,
  centroid geometry(Point, 4326),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (parcel_id, source)
);

CREATE INDEX IF NOT EXISTS parcel_geom_idx ON geo.parcel USING GIST (geom);
CREATE INDEX IF NOT EXISTS parcel_centroid_idx ON geo.parcel USING GIST (centroid);
CREATE INDEX IF NOT EXISTS parcel_source_idx ON geo.parcel (source);

INSERT INTO admin.migrations (file_name) VALUES ('0006_add_parcels.sql')
ON CONFLICT (file_name) DO NOTHING;

-- ============================================================================
-- Migration 0007: Parcel source registry
-- ============================================================================

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

INSERT INTO admin.migrations (file_name) VALUES ('0007_parcel_sources.sql')
ON CONFLICT (file_name) DO NOTHING;

-- ============================================================================
-- Verification
-- ============================================================================

-- Show completed migrations
SELECT * FROM admin.migrations ORDER BY applied_at;

-- Show created tables
SELECT schemaname, tablename 
FROM pg_tables 
WHERE schemaname IN ('geo', 'admin') 
ORDER BY schemaname, tablename;
