# Outbound Lead Management – Phase A Backlog (Foundation)

> Goal: ship the schema/API groundwork so outbound reps can be onboarded incrementally without breaking inbound flows.

## 1. Database / Prisma
- [x] Extend `prisma/schema.prisma` with new tables (`Territory`, `TerritoryAssignment`, `LeadActivity`, `Cadence*`, `Trip*`, `ProspectImport`) and Lead fields (`leadType`, `pipelineStage`, `territoryId`, ownership metadata).
- [x] Generate Prisma migration SQL (`prisma/migrations/<timestamp>_outbound_foundation`) capturing new tables, relations, indexes.
- [x] Generate Prisma migration (`npx prisma migrate dev --name add_outbound_foundation`) and verify against both SQLite (dev) and Postgres shadow DB.
- [x] Update `prisma/seed` scripts to create sample territories, demo outbound leads, a cadence, and a trip.

## 2. Backend APIs (Next.js App Router)
- [x] `/api/admin/leads`: add filters for `leadType`, `pipelineStage`, `ownerId`, `territoryId`, return new metadata (preferred start, next action, last activity).
- [x] Stub `/api/territories` (GET list, POST create) with RBAC guard + Prisma access.
- [x] Stub `/api/leads/outbound` list endpoint with filtering + pagination; include `lastActivityAt`, `nextActionAt`, territory info.
- [x] Create `/api/leads/[id]/activities` POST for logging door-knock/call/email with validation + audit log.
- [x] Hook BullMQ queues (or placeholder jobs) for cadence scheduler + SLA monitor (structure only).
- [ ] Wire `cadenceQueue` / `slaQueue` into worker entry point (`npm run worker`) with proper feature flag.

## 3. Admin Web UI
- [x] Duplicate current lead table into `/admin/leads/outbound` view with new columns (stage, owner, territory badge, next action SLA).
- [ ] Add filters (stage, territory, owner, cadence status) + search chips.
- [x] Inject “Add Activity” drawer modal (reason stub) to demonstrate data binding with `/api/leads/[id]/activities`.
- [ ] Update existing lead drawer (if any) to show timeline tokens for new activities.

## 3b. Admin Map Preview
- [ ] `/admin/leads/outbound` surface “Map Coming Soon” banner linking to spec.
- [ ] Spike PR preview of MapLibre map component (behind `OUTBOUND_MAP_PREVIEW` flag).

## 4. Territory Designer (placeholder)
- [ ] Create `/admin/territories` page scaffolding with map container (MapLibre) and placeholder list.
- [ ] Fetch territory list via `/api/territories`; render table with assignment counts.
- [ ] Add button to import CSV (wire into `/api/prospect-imports` once ready).

## 5. Mobile PWA (Skeleton)
- [ ] Add feature flag + route for `/pwa/outbound` that reuses map component + simple list of assigned outbound leads.
- [ ] Integrate Service Worker queue mock for offline `LeadActivity` submission.

## 6. Testing & Tooling
- [ ] Add Vitest unit coverage for repository functions (territory fetch, lead activity creation).
- [ ] Document manual test plan (door-knock log, pipeline update, territory assignment) in `docs/outbound_manual_tests.md`.

## 7. Documentation & ADRs
- [ ] Draft ADR for mapping provider choice (Mapbox vs Google) and cadence scheduler (BullMQ vs Temporal).
- [ ] Update `docs/Yardura_Master_Build_Checklist (1).md` to mark Phase 2a tasks + owners.
- [ ] Extend runbook with instructions for running outbound queues (`npm run worker` update).

> Once Phase A lands, Phase B can focus on the full territory editor, pipeline Kanban, and import tooling.
- [ ] Wire `cadenceQueue` / `slaQueue` into worker entry point (`npm run worker`) with proper feature flag.
