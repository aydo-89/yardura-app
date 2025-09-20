# Outbound Lead Management – Functional & Technical Blueprint

## 1. Goals & Success Metrics
- Give Yardura field reps a Spotio-grade toolkit for sourcing and closing outbound business while staying in one system.
- Provide managers live visibility into territory coverage, pipeline health, and rep productivity.
- Maintain a single source of truth for leads that flows cleanly into onboarding, scheduling, billing, and commissions.

**North-star metrics**
- 30% reduction in “cold” leads without a follow-up logged within SLA.
- 20% increase in closes per door-knock route (Trips) after 90 days of rollout.
- Territory coverage (touches per polygon) reported weekly with <5% gaps in assigned zones.

## 2. Personas & Workflows
- **Outbound Sales Rep** (mobile-first): canvasses assigned territories, drops pins, runs routes, logs activity, executes cadences, converts wins to onboarding.
- **Sales Manager / Franchise Owner** (desktop/web): defines territories, imports lists, assigns reps, monitors live map & pipeline, tunes cadences, reviews KPIs.
- **Ops/Dispatch**: sees outbound activity to anticipate demand, handoff to onboarding when a lead becomes “Won”.

### Representative Flow (Rep)
1. Start shift → open mobile canvassing map.
2. Select territory or Trip → optimized route displayed.
3. Knock door → log outcome (no answer, interested, scheduled, not qualified) with optional notes/photos.
4. System auto-enrolls lead into cadence (e.g., send follow-up SMS next morning). Tasks appear in rep inbox.
5. When lead commits → mark stage “Scheduled” → triggers onboarding and removes from outbound pipeline.

### Representative Flow (Manager)
1. Draw Territory polygons or assign ZIP clusters.
2. Import purchased list or create manual prospect segments.
3. Monitor live map to watch active reps + heatmap of touches.
4. Review pipeline board (Kanban) to ensure cadence compliance, reassign neglected leads, launch new campaigns.
5. Run reports on Trips, conversion, territory saturation.

## 3. Capability Breakdown
| Capability | Description |
| --- | --- |
| Territory Management | Hierarchical territories (Region → Area → Micro) with GeoJSON polygons, color coding, assignment rules, coverage analytics. |
| Prospect/Lead Pipeline | Unified lead entity with new fields: `leadType`, `pipelineStage`, `territoryId`, `campaignId`, `createdBy`, `lastActivityAt`, `nextActionAt`, `ownerId`. |
| Activity Logging | `LeadActivity` captures door-knocks, calls, SMS, emails, notes, tasks; includes channel metadata, location, outcome, attachments. |
| Cadences (Autoplay) | Reusable sequences with steps (channel, template, delay, SLA, drop logic). `LeadCadenceEnrollment` tracks progress; scheduler enqueues jobs. |
| Route Planner & Trips | `Trip` & `TripStop` store optimized canvassing runs; integrates with Google Maps Distance Matrix/Mapbox Optimization API. Tracks mileage, arrival, completion state. |
| Mobile Map Workspace | MapLibre/Mapbox map with cluster layers, offline tile cache, quick actions (log door-knock, add note, start Trip). |
| Manager Dashboards | Territory heatmap, pipeline Kanban, cadence compliance, leaderboard, import wizard, live rep radar. |

## 4. Data Model (Prisma-ish)
```prisma
model Territory {
  id             String   @id @default(cuid())
  orgId          String
  name           String
  slug           String   @unique
  type           String   // REGION | AREA | MICRO
  color          String?
  geometry       Json     // GeoJSON polygon/multipolygon
  parentId       String?
  parent         Territory? @relation("TerritoryHierarchy", fields: [parentId], references: [id])
  children       Territory[] @relation("TerritoryHierarchy")
  priorityWeight Int       @default(1)
  active         Boolean   @default(true)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  assignments    TerritoryAssignment[]
  leads          Lead[]
}

model TerritoryAssignment {
  id           String   @id @default(cuid())
  territoryId  String
  territory    Territory @relation(fields: [territoryId], references: [id])
  userId       String
  user         User      @relation(fields: [userId], references: [id])
  role         String    // OWNER | CONTRIBUTOR | VIEWER
  assignedAt   DateTime  @default(now())
  isPrimary    Boolean   @default(false)
}

model Lead {
  // existing fields ...
  leadType          String   @default("inbound") // inbound | outbound | partner
  pipelineStage     String?  // e.g., COLD, CONTACTED, SCHEDULED, FOLLOW_UP
  territoryId       String?
  territory         Territory? @relation(fields: [territoryId], references: [id])
  campaignId        String?
  createdById       String?
  createdBy         User?    @relation("LeadCreator", fields: [createdById], references: [id])
  ownerId           String?
  owner             User?    @relation("LeadOwner", fields: [ownerId], references: [id])
  lastActivityAt    DateTime?
  nextActionAt      DateTime?
  lastActivityId    String?
  activities        LeadActivity[]
  cadenceEnrollments LeadCadenceEnrollment[]
  trips             TripStop[]
}

model LeadActivity {
  id            String    @id @default(cuid())
  leadId        String
  lead          Lead      @relation(fields: [leadId], references: [id])
  orgId         String
  userId        String?
  user          User?     @relation(fields: [userId], references: [id])
  type          String    // DOOR_KNOCK | CALL | SMS | EMAIL | NOTE | TASK | MEETING
  channel       String?
  occurredAt    DateTime  @default(now())
  result        String?   // NOT_HOME | INTERESTED | SCHEDULED | NOT_QUALIFIED etc.
  notes         String?
  location      Json?
  attachments   Json?     // array of file URLs or metadata
  durationSecs  Int?
  followUpAt    DateTime?
  createdAt     DateTime  @default(now())
}

model Cadence {
  id          String   @id @default(cuid())
  orgId       String
  name        String
  description String?
  targetStage String   // pipeline stage this cadence starts from
  active      Boolean  @default(true)
  steps       CadenceStep[]
}

model CadenceStep {
  id          String   @id @default(cuid())
  cadenceId   String
  cadence     Cadence  @relation(fields: [cadenceId], references: [id])
  order       Int
  channel     String   // SMS | EMAIL | CALL | TASK | VISIT
  templateId  String?
  waitMinutes Int      @default(0)
  slaMinutes  Int?
  autoComplete Boolean @default(false)
  metadata    Json?
}

model LeadCadenceEnrollment {
  id             String   @id @default(cuid())
  leadId         String
  lead           Lead     @relation(fields: [leadId], references: [id])
  cadenceId      String
  cadence        Cadence  @relation(fields: [cadenceId], references: [id])
  currentStepId  String?
  status         String   @default("active") // active | paused | completed | cancelled
  startedAt      DateTime @default(now())
  lastExecutedAt DateTime?
  nextRunAt      DateTime?
  cancelledAt    DateTime?
}

model Trip {
  id            String   @id @default(cuid())
  orgId         String
  createdById   String
  createdBy     User     @relation(fields: [createdById], references: [id])
  ownerId       String
  owner         User     @relation("TripOwner", fields: [ownerId], references: [id])
  name          String?
  territoryId   String?
  startLocation Json
  endLocation   Json?
  optimization  String   // FASTEST | SHORTEST | WALKING
  plannedStart  DateTime?
  status        String   @default("planned") // planned | in_progress | completed | cancelled
  distanceMeters Int?
  durationMinutes Int?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  stops         TripStop[]
}

model TripStop {
  id          String   @id @default(cuid())
  tripId      String
  trip        Trip     @relation(fields: [tripId], references: [id])
  leadId      String?
  lead        Lead?    @relation(fields: [leadId], references: [id])
  order       Int
  plannedAt   DateTime?
  arrivalAt   DateTime?
  completedAt DateTime?
  status      String   @default("pending") // pending | skipped | completed
  notes       String?
}

model ProspectImport {
  id          String   @id @default(cuid())
  orgId       String
  uploadedBy  String
  source      String   // CSV | Purchase | Manual
  status      String   @default("processing")
  stats       Json?
  fileUrl     String
  createdAt   DateTime @default(now())
}
```

## 5. API Surface (Next.js App Router)
| Route | Method | Description |
| --- | --- | --- |
| `/api/territories` | GET/POST | List/create territories (supports bbox filters, hierarchy). |
| `/api/territories/[id]` | PATCH/DELETE | Update polygon, colors, assignments. |
| `/api/leads/outbound` | GET | Filter by territory, owner, stage, cadence status, SLA. |
| `/api/leads/outbound` | POST | Create outbound lead (manual entry or import). |
| `/api/leads/[id]/activities` | POST | Log activity with optional attachment upload. |
| `/api/leads/[id]/stage` | PATCH | Move between pipeline stages; triggers automation. |
| `/api/cadences` | CRUD | Manage sequences and steps. |
| `/api/cadences/[id]/enroll` | POST | Enroll lead into cadence; returns next action info. |
| `/api/cadence-executor` | POST (cron) | Scheduler endpoint invoked by background job to process due steps. |
| `/api/trips` | GET/POST | Create optimized routes; integration with Mapbox/Google via server action. |
| `/api/trips/[id]/status` | PATCH | Start/complete trip, update stats. |
| `/api/prospect-imports` | POST | Upload CSV (S3 pre-signed URL) + kickoff parsing job. |
| `/api/reports/outbound` | GET | Aggregated stats (coverage, conversion, activity by rep). |

Supporting server actions for offline/mobile quick log (RSC-friendly) should be provided to avoid extra API endpoints where appropriate.

## 6. Background Jobs & Integrations
- **Cadence Scheduler** (BullMQ): scans `LeadCadenceEnrollment` for `nextRunAt <= now`, enqueues channel-specific jobs (SMS via Twilio, email via Resend, call tasks). Respects quiet hours per territory.
- **Route Optimization**: server-side call to Mapbox Optimization API or Google Maps Routes API; fallback to OSRM for cost control.
- **Geocoding/Reverse Geocoding**: ensure imported leads have lat/long for map placement (use Google Geocoding or Pelias).
- **Import Processor**: ingest CSV, validate columns, fuzzy match duplicates (by address/email/phone), assign to territories, optionally auto-enroll in cadence.
- **SLA Monitor**: cron job to detect overdue follow-ups (no activity within stage SLA). Emits notifications (in-app + email) and updates `nextActionAt`.
- **Analytics ETL**: nightly aggregation into `outbound_stats` tables powering dashboards (touches per territory, Trip efficiency, cadence conversion).

## 7. UI & UX Sketch
### Web (Manager/Admin)
1. **Territory Designer**: map with draw/edit tools, multi-level list, assignment panel.
2. **Pipeline Board**: Kanban columns by stage with cards showing lead summary, SLA badge, last touch. Drag-drop updates stage.
3. **Cadence Builder**: step timeline with channel icons, wait durations, templates.
4. **Live Map / Team Radar**: toggle layers (territories, leads by stage, active reps, Trip routes). Clicking a pin reveals activity timeline and quick actions.
5. **Reports**: charts (touches vs closes, cadence performance, rep leaderboard, territory saturation heatmap).

### Mobile (Rep)
1. **Home**: shows today’s tasks, active Trip, upcoming cadences requiring action.
2. **Map View**: offline tiles, lead pins color-coded by stage; quick add prospect; start Trip; filter by status or cadence.
3. **Trip Dashboard**: step list with ETA, open navigation in Google/Apple Maps, mark completed/skip, log notes.
4. **Lead Detail**: timeline of activities, buttons for call/SMS/email (auto logs), add note/photo, enroll into cadence.
5. **Activity Log**: offline queue shows unsynced logs with retry.

### Offline & Sync
- Local IndexedDB/Service Worker caches territories, lead subset, cadences.
- Activity logs queue while offline; background sync posts to `/api/leads/[id]/activities` when connection resumes.

## 8. Security, Permissions, Auditing
- Extend RBAC: `SALES_REP`, `SALES_MANAGER`, `FRANCHISE_OWNER` roles with territory-scoped permissions. Reps only view leads they own/assigned territories.
- Every activity, stage change, territory edit recorded in audit log (existing logging infrastructure or new `AuditEntry`).
- GPS data flagged as PII: encrypt location fields at rest (align with existing encryption strategy from spec).
- Managers can override ownership; actions recorded with `actedBy` metadata.

## 9. Rollout & Phasing
1. **Phase A – Foundation**
   - Schema migrations for Territory, Activities, Cadence, Trips.
   - Extend Lead model and admin API filters.
   - Basic web pipeline table & lead filters for outbound-only view.

2. **Phase B – Territory & Manager Tools**
   - Territory designer + assignment UI.
   - Imports + dedupe + auto territory assignment.
   - Reports for coverage + pipeline.

3. **Phase C – Mobile Canvassing & Trips**
   - Map view with pins, door-knock logging, Trip creation & execution.
   - Offline storage + background sync.
   - Activity timeline UI across web/mobile.

4. **Phase D – Cadences & Automations**
   - Cadence builder, scheduler, SLA alerts, template system.
   - Integration with SMS/email providers and call logging.

5. **Phase E – Advanced Analytics & Handoff**
   - Heatmaps, conversion analytics, rep leaderboards.
   - Seamless conversion into onboarding (auto create quote/portal invite).
   - Commission hooks (tie to existing `Commission` model).

## 10. Dependencies & Open Questions
- Mapping vendor: confirm Mapbox vs Google vs internal OSRM. Budget for API usage?
- SMS compliance (opt-in, quiet hours) for cadence automation.
- Duplicate detection rules across inbound/outbound (address vs email priority).
- Template management: reuse existing communication template system or build new module?
- Device management: is current PWA sufficient or do we deliver native wrapper for GPS stability?

## 11. Next Steps
1. Confirm data model changes with data/infra team (Postgres migration plan).
2. Prioritize Phase A stories (schema migration, API list view, territory stub) for upcoming sprint.
3. Engage design for mobile map/Trip UI wireframes.
4. Define communication template & SMS provider requirements (legal review).
5. Draft ADR covering choice of routing service + cadence scheduler implementation.
