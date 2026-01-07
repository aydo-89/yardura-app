-- Migration: add coverage metrics to service_tile_zip
BEGIN;
SET search_path TO public, geo, admin;
ALTER TABLE geo.service_tile_zip
  ADD COLUMN IF NOT EXISTS coverage_ratio DOUBLE PRECISION DEFAULT 0;

COMMENT ON COLUMN geo.service_tile_zip.coverage_ratio IS
  'Ratio of ZIP area intersecting the tile (0-1).';

COMMIT;
