-- Migration: service tile tables and relationships
BEGIN;
SET search_path TO public, geo, admin;

CREATE TABLE IF NOT EXISTS geo.service_tile (
  tile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  min_scoopers INTEGER DEFAULT 0,
  min_customer_units INTEGER DEFAULT 0,
  coverage_radius_m INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  geom geometry(MultiPolygon, 4326) NOT NULL,
  geom_simplified geometry(MultiPolygon, 4326)
);
CREATE UNIQUE INDEX IF NOT EXISTS service_tile_slug_unique ON geo.service_tile (org_id, slug);
CREATE INDEX IF NOT EXISTS service_tile_geom_idx ON geo.service_tile USING GIST (geom);

CREATE TABLE IF NOT EXISTS geo.service_tile_window (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tile_id UUID NOT NULL REFERENCES geo.service_tile(tile_id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL,
  window_slot TEXT NOT NULL,
  max_stops INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS service_tile_window_tile_idx ON geo.service_tile_window (tile_id);

CREATE TABLE IF NOT EXISTS geo.service_tile_zip (
  tile_id UUID NOT NULL REFERENCES geo.service_tile(tile_id) ON DELETE CASCADE,
  zip TEXT NOT NULL REFERENCES geo.zcta(zip) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'AVAILABLE',
  added_by TEXT,
  added_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  PRIMARY KEY (tile_id, zip)
);
CREATE INDEX IF NOT EXISTS service_tile_zip_zip_idx ON geo.service_tile_zip (zip);

CREATE TABLE IF NOT EXISTS geo.service_tile_metric (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tile_id UUID NOT NULL REFERENCES geo.service_tile(tile_id) ON DELETE CASCADE,
  week_of DATE NOT NULL,
  coverage_percent NUMERIC,
  active_zips INTEGER,
  uncovered_zips INTEGER,
  total_population INTEGER,
  last_computed TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tile_id, week_of)
);

COMMIT;
