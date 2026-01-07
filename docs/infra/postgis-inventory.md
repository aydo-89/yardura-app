# PostGIS Integration – Current Data Flow Inventory

This document captures the pre-refactor state for geospatial and tile-related code paths so we can migrate them to the new PostGIS-backed architecture with confidence.

## Admin Marketplace Tiles (`src/app/admin/marketplace/tiles/page.tsx`)
- **Data source:** REST endpoints under `/api/admin/service-tiles` (Prisma-backed).
- **Fetch sequence:**
  - `GET /api/admin/service-tiles` → list of tiles + readiness snapshots (from `listTileReadiness`).
  - `GET /api/admin/service-tiles/[slug]` → detailed readiness payload (same Prisma helper).
  - `GET /api/admin/service-tiles/[slug]/metrics` → historical metrics (Prisma `tileMetricSnapshot`).
- **Map overlay:** Uses `MapLibreMap` with locally generated GeoJSON (static circles/polygons – no PostGIS). No tile → ZIP association.

## Marketplace Helpers
- **`src/lib/marketplace/tiles.ts`**
  - Prisma queries `serviceTile`, `tileMetrics`, `territory`.
  - Shapes results into `TileReadiness` objects.
- **`src/lib/marketplace/tile-readiness.ts`**
  - Pure helper building readiness summaries from Prisma payloads.
- **`src/lib/marketplace/tile-map.ts`**
  - Maps city names to hard-coded tile slugs (`CITY_TILE_MAP`).
  - Falls back to first LIVE tile via Prisma lookup.
- **Coupling:** No awareness of ZIP polygons or tile geometry.

## Service Tile Metrics API (`src/app/api/admin/service-tiles/[slug]/metrics/route.ts`)
- Prisma `serviceTile` + `tileMetricSnapshot` (latest 12 weeks).
- Response: `{ tile, snapshots }`, no spatial data.

## ZIP Search API (`src/app/api/geo/zip-search/route.ts`)
- **External sources:**
  - `@/lib/pmtiles` & `@/lib/geo` wrappers hitting PMTiles / GitHub-hosted GeoJSON.
  - `turf.js` for clipping/intersection.
- **Flow:** Fetch place polygon → fetch entire state ZCTA collection → clip & score ZCTAs client-side → respond with derived GeoJSON + stats.
- **Pain points:** Network-heavy, turf intersection failures, no tile alignment.

## ZIP Eligibility API / Service (`src/app/api/zip-eligibility/route.ts`, `src/lib/zip-eligibility.ts`)
- Reads from `business-config` JSON (service zones defined manually).
- Determines eligibility & pricing multipliers from config.
- For eligible ZIPs, resolves tile via `resolveTileSlugForCity` (hard-coded mapping) and `getTileReadinessBySlug` (Prisma path).
- No spatial validation; no PostGIS involvement.

## ZIP Map Component (`src/components/maps/ZIPSearchMap.tsx`)
- Expects response from legacy `/api/geo/zip-search` (place + clipped ZCTAs GeoJSON).
- Renders features client-side; manages selection state via React.
- No PostGIS integration yet.

## Leads Outbound (`src/app/admin/leads/outbound/page.tsx` & related APIs)
- **Page:**
  - Pulls lead data from `/api/admin/leads/outbound` (Prisma query + JSON metadata).
  - Map overlays use lead-level stored coordinates and static tile overlays; no PostGIS cross-check.
- **APIs:**
  - Calculate owner load, route suggestions, etc. using Prisma service tiles, `CITY_TILE_MAP`, and manual capacity thresholds.
  - No spatial join between leads and tiles; relies on stored metadata (e.g., assignedTileSlug).

## Scooper Availability (`src/app/api/scoopers/[scooperId]/availability/route.ts`, `src/lib/marketplace/scooper.ts`)
- Prisma-driven view of scooper profile, certifications, availability.
- Service window logic lives in `ServiceTileWindow` Prisma table; no PostGIS geometry usage.
- Coverage radius and territory logic still pulled from `serviceTile` Prisma records.

## Legacy Docs & Seeding
- `docs/archive/HENNEPIN_SEEDING.md`, `scripts/seed-hennepin.js`, `prisma/seed-data/hennepinTiles.ts` describe JSON-based tile seeding.
- No PostGIS tiles or tile→ZIP mapping; all coverage tracked in config files.

## Summary of Pain Points
- Multiple code paths depend on Prisma + JSON configuration rather than spatial queries.
- Map components rely on client-side turf processing and static lookups.
- No authoritative tile↔ZIP relationship; leads/scoopers assume slugs map to cities without verification.
- Seeding & docs refer to legacy workflow (prisma seeds + GitHub GeoJSON).

This inventory feeds directly into the implementation checklist in `IMPLEMENTATION_PLAN.md`.
