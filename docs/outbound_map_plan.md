# Outbound Map & Pinning – Functional Design

## 1. Objectives

- Give reps a live map of their assigned territories with clear visual history of door knocks and outcomes.
- Allow reps to drop accurate pins (auto GPS + manual address search) and log context in one step.
- Equip managers with territory coverage views, filters, and ability to review/reassign leads.

## 2. Core User Stories

### Reps

1. **View territory map** – See only leads and pins inside my assigned territories, color-coded by stage/outcome.
2. **Log a door knock** – Tap map, confirm address/pin, choose outcome, add notes/photos, optionally follow-up reminder.
3. **Mark revisits** – Pins show previous touches; rep can reopen timeline to review notes before knocking again.
4. **Offline mode** – If offline, pin + note is queued and synced when online, with GPS timestamp preserved.

### Managers

1. **Territory heatmap** – Overlay showing pins by outcome (interested, not home, no-solicit) with filters by date range.
2. **Duplicate detection** – Ensure same address doesn’t get double counted; merge pins by address.
3. **Change history** – Audit log of pin edits, stage movements, territory assignment changes.
4. **Export** – CSV export of canvassing activity for campaigns.

## 3. Data Requirements

- `Lead` now carries `territoryId`, `pipelineStage`, `lastActivityAt`, `nextActionAt`, `LAT/LNG`.
- `LeadActivity` stores `type`, `result`, optional `location` (GeoJSON point), `followUpAt`.
- Need `LeadActivityAttachment` (future) to store photo IDs.
- Deduping by `address` + `zipCode` combo; maintain `addressNormalized` field for deterministic match.

## 4. API Endpoints

- `GET /api/leads/outbound?territoryId=...&bbox=...`: returns leads + last activity.
- `POST /api/leads/:id/activities`: already exists; extend to accept `location`, `attachments`, `followUpAt`.
- `POST /api/leads/outbound`: support address autocomplete (call geocoder on server).
- `GET /api/territories/:id/coverage?range=30`: returns aggregated counts for heatmap.
- `POST /api/prospect-imports`: mark imported addresses with LAT/LNG.
- `GET /api/leads/outbound/timeline`: aggregated timeline for map popover (optional, re-use `/activities`).

## 5. Map Stack

- **Library**: MapLibre GL JS (already dependency). Use vector tiles; consider Mapbox or custom MBTiles via PMTiles for offline.
- **Tiles**: Provide default basemap from MapTiler/Mapbox; allow customizing style.
- **Layers**:
  - Territory polygons (fill opacity + border color).
  - Lead pins (circle layer) with color based on stage.
  - Trip routes (line layer) when Trip selected.
  - Heatmap overlay (density) toggled via UI.

## 6. Rep UI Flow (Mobile PWA)

1. Map renders with clusters; stage legend at bottom.
2. Tap cluster zooms in; tap pin opens card with contact details + last activity timeline.
3. “Log activity” button opens modal with drop-down outcome, notes, follow-up time picker, attach photo.
4. GPS auto-captures lat/lng; rep can adjust address via search (Mapbox Geocoding) if pin is off.
5. Save logs activity, updates lead stage, schedules follow-up.

## 7. Manager UI Flow (Web)

1. `/admin/territories/map`: map + territory list + filter panel.
2. List of pins in right sidebar with filters (date range, stage, owner, result).
3. Clicking pin shows aggregated timeline (all activities) and quick assign/quick stage update.
4. Bulk actions: select multiple pins → assign to cadence, update stage, reassign owner.
5. Export button → download CSV (lead details, last activity, territory, outcome).

## 8. Offline & Sync Strategy

- Service worker caches tiles (Mapbox static tiles or PMTiles) + lead JSON.
- Activities queued in IndexedDB; includes `location`, `notes`, attachments (blobs) until upload.
- Sync module replays queue on network resume; handles conflict (if lead stage changed on server, show conflict resolution modal).

## 9. Address & GPS Accuracy

- Use reverse geocoding to confirm address; allow rep to nudge pin by dragging.
- Store `locationSource` (GPS | manual) + `accuracyMeters`.
- Validate out-of-territory pins: warn but allow logging (with manager review flag).

## 10. Open Questions

- Should we support street canvass (non-address pins) for apartments? Need unit handling.
- How to handle no-solicit flags? Possibly mark lead as `status=ARCHIVED` + reason.
- Do we integrate with existing `Trip` routes automatically (Trip stops become leads)?

## 11. Next Steps

1. Build `/admin/territories` map list (Phase B) – reuse MapLibre + simple layer for territories.
2. Implement mobile map view (Phase C) with clustering, fetch from `/api/leads/outbound`.
3. Wire offline queue + location capture in PWA (`idb-keyval` + service worker).
4. Add geocoding helper on server (Mapbox/Google) and address normalization.
5. Extend `LeadActivity` attachments support for photos.
6. Create heatmap query and aggregated coverage API.
