-- PostGIS bootstrap script
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Dedicated schemas for spatial assets
CREATE SCHEMA IF NOT EXISTS geo;
CREATE SCHEMA IF NOT EXISTS admin;

-- Record dataset metadata
CREATE TABLE IF NOT EXISTS admin.dataset_version (
  dataset_name TEXT PRIMARY KEY,
  source_url TEXT,
  version TEXT,
  loaded_at TIMESTAMPTZ DEFAULT now()
);
