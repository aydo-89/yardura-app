# Outbound Lead Management – UI Integration Plan

## Overview

We’ll layer outbound-first interfaces into both the admin browser app and the existing PWA. Phase A focuses on foundational tables & filters; later phases unlock map tooling and cadences.

## 1. Admin Web (Next.js)

### 1.1 Navigation

- Add `/admin/leads/outbound` alongside current lead management tab.
- Introduce `/admin/territories` entry under “Sales Ops”.
- Future: `/admin/cadences`, `/admin/trips` if needed.

### 1.2 Outbound Lead Table (Phase A)

- Base component on existing table but include new columns:
  - `Stage` badge (color-coded), `Owner` avatar, `Territory` pill, `Next Action` (date + SLA chip), `Last Touch` summary.
- Filters row:
  - Stage multi-select.
  - Territory dropdown (searchable, grouped by hierarchy).
  - Owner dropdown (reps assigned).
  - Toggle `Show only leads overdue` (uses `nextActionAt`).
- Row actions: “Log Activity” (drawer), “Start Trip” (Phase C), “Enroll in Cadence” (Phase D).

### 1.3 Lead Drawer Enhancements

- Tabs: `Summary`, `Timeline`, `Cadences`, `Trips`.
- Summary shows territory assignment, pipeline stage, lead score (if available), upcoming tasks.
- Timeline uses new `/activities` endpoint; infinite scroll.
- Quick action buttons for call / SMS / email (auto logs via server action stub).

### 1.4 Territory Management

- Phase A: list view with create/edit modal (geometry JSON pasted or manual coordinates).
- Phase B: interactive MapLibre canvas with drawing tools, assignment sidebar, imports list.
- Implement lazy-loaded map chunk to avoid bloating initial bundle.

### 1.5 Reports Dashboard (Phase B/E)

- “Outbound Overview” page showing KPIs (cards + charts). Use existing analytics layout components.
- Heatmap map layer + table exports.

## 2. Mobile PWA (Field Rep)

### 2.1 Navigation Changes

- Add “Outbound” tab with subviews: `Map`, `Tasks`, `Trips`.
- Ensure offline-first service worker caches new API routes (`/api/leads/outbound`, `/api/leads/*/activities`, `/api/trips`).

### 2.2 Map (Phase C)

- MapLibre map with clustering; stage color legend.
- Drawer on pin tap with quick actions: mark door knock (opens form), start navigation (external maps), assign follow-up.
- Offline tiles via Mapbox or local MBTiles (to be decided in ADR).

### 2.3 Activity Logging Form

- Simple form modal with radio buttons for outcome, textarea for notes, camera capture for photos, follow-up reminder pickers.
- Works offline by writing to IndexedDB; service worker flushes to `/activities` when online.

### 2.4 Trips UI

- Trip list (planned/in-progress/completed) with start/complete actions.
- Trip detail stepper: shows ordered stops; swipe to mark complete/skip; auto-suggest follow-up for skipped stops.

### 2.5 Tasks / Cadences (Phase D)

- Task inbox groups due steps from cadences; provides CTA to log (call, send template SMS/email, manual note).
- Quick view of SLA countdown, ability to snooze or complete (with reason).

## 3. Shared Components & Design

- Extend Badge component palette (stage colors, territory chips).
- Create `LeadStageBadge`, `TerritoryPill`, `SlaChip` components for reuse.
- Timeline component to render `LeadActivity` feed with icons per type.
- Modal/Drawer scaffolding reused between admin + PWA where possible via shared package.

## 4. Feature Flags & Rollout

- `OUTBOUND_V1` flag gating navigation items (env + server fetch).
- Gradual rep onboarding: start with manager-only access; enable rep map after training.
- Telemetry: instrument analytics events (`outbound_activity_logged`, `outbound_trip_started`, etc.)

## 5. Accessibility & Performance

- Territory map: keyboard shortcuts for drawing; high-contrast mode.
- Table virtualization for outbound lead list (React Virtualized) once row counts > 500.
- PWA map should lazy-load heavy libs only when tab selected.
- All new forms validate via Zod + accessible error states.

## 6. Open Questions

- Do we integrate native push notifications for overdue tasks? (Requires additional infra.)
- Should we unify inbound/outbound leads into a single board with stage filters? (May reduce duplication.)
- Are there regulatory constraints for storing GPS breadcrumbs (needs consent toggle per rep)?

## 7. Milestone Alignment

- **Phase A**: Table enhancements, API wiring, minimal territory list, activity logging.
- **Phase B**: Territory canvas, imports, pipeline board.
- **Phase C**: Mobile map & Trips.
- **Phase D**: Cadence UI & task inbox.
- **Phase E**: Analytics dashboards, conversion handoff automation.
