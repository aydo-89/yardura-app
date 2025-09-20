# Outbound Spotio Parity – Gap Tracker

This checklist compares the current outbound prototype to the Spotio capabilities outlined in
`docs/Spotio Field Sales Platform Analysis and Yardura PRD.pdf`, the Friendly Spec (section J), and
the Master Build Checklist (Phase 2a). It helps us pick the next implementation targets.

## 1. Lead & Prospect Management

- [x] Outbound leads API and admin UI (table + map) with pipeline stages, owners, territories.
- [ ] Mobile-first capture flow (PWA/offline draft, quick pin drop from phone, photo attachments).
- [ ] Bulk import/purchased list ingestion with territory auto-assignment.
- [ ] “Lead Machine” enrichment (owner/tenant, demographics, credit capacity, etc.).
- [ ] Digital business card / shareable contact card for reps.

## 2. Territory & Mapping

- [x] Territory listing page with polygon render and assignments.
- [ ] Territory hierarchy (parent/child overlays, multi-select stacking).
- [ ] Heatmap overlays (inbound density, priority scores, pipeline stage shading).
- [ ] Territory overlap prevention warnings and route coverage analytics.
- [ ] Territory filter selector integrated into outbound map/table.

## 3. Map Visualization & Pin Colorization

- [x] Pipeline-based pin coloring (stage badge → marker hue).
- [x] Drop pin mode for new prospects + coordinate capture.
- [ ] Custom color rules (e.g., last touch result, owner, SLA status) with legend toggle.
- [ ] Photo/attachment previews and quick note view on pin popover.
- [ ] Offline pin cache & sync indicator for mobile canvassing.

## 4. Route Planning & Trips

- [x] Trip model + admin trip planner (manual ordering, basic mileage placeholder).
- [~] `/api/trips/optimize` heuristic + UI hook (replace with Distance Matrix + lasso tooling).
- [ ] Lasso/multi-select add-to-route tooling on the map.
- [ ] Recurring route templates with cadence reminders.
- [ ] Mileage tracking + export for reimbursements.

## 5. Geolocation & Team Radar

- [ ] Real-time “team radar” view (live rep locations, breadcrumbs, last-touch timestamps).
- [ ] Location opt-in with privacy controls and permission reminders.
- [ ] Assignment status indicator (who is in which territory right now).
- [ ] Manager alerts when reps enter/exit assigned territories.

## 6. Activity Engine & Cadences

- [x] Manual activity logging sheet (type, outcome, notes).
- [ ] Auto-logging for calls/SMS/email via integrations (Twilio/Resend).
- [ ] Autoplay cadences (templated sequences, wait steps, SLA timers).
- [ ] Task queue + reminders for overdue follow-ups.
- [ ] Campaign launch tooling (bulk assign cadence to filtered leads).

## 7. Reporting & Manager Cockpit

- [ ] Territory-level scorecards (pipeline counts, conversion, coverage).
- [ ] Map filters for “last touched” heat, scheduled follow-ups, or high-value prospects.
- [ ] Import/upload workflow for purchased lists with data validation report.
- [ ] Exportable pipeline and activity reports.
- [ ] Integration with existing lead/customer conversion flow (merge outbound → onboarding) with audit trail.

## 8. Integrations & Compliance

- [ ] Twilio SMS/voice logging; Resend email sync; call recording metadata (per legal settings).
- [ ] Distance Matrix / routing API integration (Google, Mapbox, or internal optimizer).
- [ ] Territory + lead CRUD auditing (who moved stages, reassigned territory, etc.).
- [ ] Feature flags for outbound stack (per Friendly Spec compatibility plan).

## Next Steps (Suggested Order)

1. **Trip Enhancements:** add lasso selections and a server-side optimizer hook (Google/Mapbox Distance Matrix stub).
2. **Team Radar MVP:** server endpoint + websocket/long-poll to stream rep locations; map overlay with “last seen” chips.
3. **Cadence Planner:** data model + UI skeleton for templated follow-up flows; integrate with existing activity logging.

Update this file as parity items ship; link PRs and assignees for traceability.
