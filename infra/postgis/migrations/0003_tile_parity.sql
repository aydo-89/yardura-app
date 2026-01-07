-- Migration: align service tile tables with Prisma schema
BEGIN;
SET search_path TO public, geo, admin;
ALTER TABLE geo.service_tile
  ADD COLUMN IF NOT EXISTS territory_id TEXT,
  ADD COLUMN IF NOT EXISTS go_live_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS service_windows JSONB;

CREATE INDEX IF NOT EXISTS service_tile_org_idx ON geo.service_tile (org_id);
CREATE INDEX IF NOT EXISTS service_tile_territory_idx ON geo.service_tile (territory_id);

ALTER TABLE geo.service_tile_metric
  ADD COLUMN IF NOT EXISTS active_scoopers INTEGER,
  ADD COLUMN IF NOT EXISTS scheduled_stops INTEGER,
  ADD COLUMN IF NOT EXISTS completed_stops INTEGER;

COMMIT;
