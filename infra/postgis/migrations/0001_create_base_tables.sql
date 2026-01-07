-- Migration: create core spatial tables
BEGIN;
SET search_path TO public, geo, admin;

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

COMMIT;
