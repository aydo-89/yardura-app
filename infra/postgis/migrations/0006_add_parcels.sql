-- Migration: parcel boundary storage
BEGIN;
SET search_path TO extensions, public, geo, admin;

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

COMMIT;
