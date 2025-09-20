
# Yardura Service OS — Friendly Build Spec (with Existing-App Awareness)

This guide keeps the official spec actionable **and** ensures we respect the current app’s code and data.

---

## A) What Exists Today (Keep Stable)
**Code:** landing page, quote/onboarding flow, basic client portal/dashboard with wellness insights.  
**Data:** Prisma schema using **SQLite** (see Appendix A).  
**Auth/Payments/UI:** NextAuth accounts/sessions; Stripe subscriptions/webhooks; Tailwind/shadcn‑style components; Framer Motion animations; Resend/SMTP emails.

**Guardrails**
- Quote wizard must remain functionally identical (steps, fields, validation, pricing).
- Client portal semantics must not change without an adapter + migration note.
- No breaking changes to existing API contracts or env vars without shims.

---

## B) First Step: Analysis (No Feature Changes)
1. Project survey: structure, workspaces, scripts, routing map, shared components.
2. Dependency audit: Next.js/React/Prisma/Auth/Stripe/UI/email versions + configs.
3. Data audit: read current Prisma schema; produce ERD; row counts; DB size; indexes.
4. Runtime pass: run quote→onboarding→portal happy path; capture invariants & perf.
5. Risk register: list probable breakpoints; plan feature flags + compatibility adapters.

Deliver `/docs/00_codebase_survey.md` with findings + screenshots.

---

## C) Migration: SQLite → Postgres (Safe & Phased)
- Add Postgres alongside SQLite; keep names stable; migrate with `migrate diff` and COPY.
- Introduce a small data‑access layer to flip reads/writes per model behind flags.
- Start with non‑critical writes; defer quote/onboarding writes to last.
- Verify counts/RI; run backfills; add backups + PITR; keep a rollback plan.

---

## D) v1 Feature Set (integrated)
- **F-001 Quote & Leads** — Quote wizard keeps parity while passing tenant context (`org`/`businessId`/`tenantId`). `POST /api/quote` stores the lead under that org, snapshots pricing, and returns `leadId` for follow-up.
- **F‑002 Onboarding & Subscriptions** — ZIP/zone pricing; cross‑sell; Stripe SetupIntent; ToS; first visit scheduling; portal creds.
- **F‑003 Dispatch & Routing** — Jobs (recurring/one‑time); weather skip + notify; optimize ≤10s/100; live ETAs; drag‑drop board; reassign/reschedule/reclean/recreate.
- **F‑004 Field Tech PWA** — Clock/breaks/odometer; GPS; on‑the‑way SMS; photos required; offline queue + sync.
- **F‑005 Client Portal** — Timeline gallery; payment‑method mgmt (cannot remove last); billing history; schedule; notification prefs.
- **F‑006 Wellness** — 3Cs + Moisture/Weight/Frequency trends; non‑diagnostic disclaimers; alerts; opt‑in anonymized data.
- **F‑007 Billing** — Recurring & one‑time invoices; skip‑reason pricing; payments/refunds; dunning; QBO sync.
- **F‑008 Payroll** — Hourly/bonus/commission; overtime; mileage; pay slips; approvals.
- **F‑009 Franchise** — Parent oversight; brand controls; consolidated payments; ACH royalties; reporting.
- **F‑010 Cross‑Sell** — Catalog; taxable flags; per‑client requests; completion → billing; commissions.

Integrations (F‑011–F‑016): Stripe, QBO, Maps/Distance Matrix, Twilio, Resend, Reporting & Public API/Webhooks.

---

## E) Data Model Notes (Mapping from Today → v1)
Your current schema includes `User/Account/Session/VerificationToken`, domain objects (`Dog`, `ServiceVisit`, `DataReading`), ops (`Org`, `Customer`, `Job`, `Device`, `Sample`, `SampleScore`, `Alert`), finance (`Commission`, `BillingSnapshot`), impact metrics (`EcoStat`, `GlobalStats`), and ML labeling (`GroundTruth`).  
**Strategy:** Keep names and relations stable; add new v1 models incrementally. Where models differ (e.g., `Job` vs `Route/Job` pairing), provide an adapter layer and backfill scripts.

---

## F) API & Webhooks
- REST handlers; OpenAPI JSON + `/docs`
- HMAC + idempotency for outbound webhooks; retry/backoff
- Consumers for Stripe/QBO/Twilio/Email with tests

---

## G) Security & SLAs
- Stripe Elements, no PAN in DB; Zod input validation; rate limits
- Column-level encryption for PII; audit trails on billing, payroll, scheduling
- SLAs: route optimization ≤10s/100; portal P95 < 500ms (cached); job list <200ms; photo upload ≤3s; wellness <5s

---

## I) Lead Management & Quote Email Flow
- Quote wizard reads `org`, `businessId`, or `tenantId` from the URL (or falls back to `yardura`) so every submission stays scoped to the correct tenant.
- `/api/quote` accepts the same tenant identifier in the payload, persists leads with pricing snapshots (`estimatedPrice`, `pricingBreakdown`), and returns the stable `leadId` used by downstream flows.
- `/quote/success` and `/quote/sent` propagate the tenant query param; the latter now calls `POST /api/leads/:id/send-quote` to deliver customer-facing emails via Resend and flips the lead status to `PROPOSAL_SENT`.
- Quote emails include schedule, add-ons, and pricing highlights; internal teams stay copied via `CONTACT_TO_EMAIL`, and the API rejects tenant mismatches to prevent cross-org leakage.

---

## J) Outbound Field Sales & Territory Ops (Spotio Parity)
- Mobile-first canvassing workspace lets reps add cold leads from the map, drop door-knock pins with GPS/timestamp evidence, capture photos/notes, and stage them through a configurable outbound pipeline (cold → contacted → scheduled → closed/lost).
- Territory management supports multi-level polygons, ZIP slices, heatmaps, and assignment rules; territory overlays show inbound lead density, rep coverage, and priority routes while preventing accidental overlap.
- Route planner mirrors Spotio’s Trips: reps (or managers) lasso addresses, auto-optimize multi-stop walking/driving loops, reorder on the fly, save recurring canvass routes, and log mileage for reimbursement.
- Activity engine logs every touch automatically (door knocks, calls, SMS, email, tasks) and powers Autoplay-style follow-up cadences with templated scripts, wait steps, reminders, and SLA alerts when touchpoints are overdue.
- Manager cockpit provides live “team radar” with optional location breadcrumbs, territory-level scorecards, pipeline forecasting, and bulk tools to import purchased lists, assign leads, or launch campaigns.
- Outbound leads sync with the existing lead/customer model: converting an outbound prospect merges history with inbound quotes, preserves territory metadata, and triggers the standard onboarding + scheduling flow.

---

## H) Delivery Checklist (Milestones)
1) **Analysis (no code changes)** — survey, routing map, ERD, invariants, risk register  
2) Repo + Infra + Auth + RBAC  
3) DB schema & seeds; **dual DB (SQLite+Postgres) setup**  
4) Quote parity + `/api/quote`  
5) Onboarding + Stripe + schedule first visit  
6) Dispatch board + job generator + weather skip  
7) Route optimizer + device push + ETAs  
8) Tech PWA (offline + photos + GPS + SMS)  
9) Client Portal (proofs, billing, PM methods, schedule)  
10) Billing engine + dunning + QBO sync  
11) Wellness pipeline + trends + alerts  
12) Payroll + slips + approvals  
13) Franchise + royalties + reporting  
14) Public API + webhooks + docs  
15) QA (unit/E2E/load), Sentry, analytics  
16) Production deploy + runbook

---

## Appendix A — Current Prisma Schema (verbatim)
```prisma
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "debian-openssl-3.0.x"]
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// User accounts with authentication
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  phone         String?
  address       String?
  city          String?
  zipCode       String?
  role          UserRole  @default(CUSTOMER)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  stripeCustomerId String?

  // Sales rep specific fields
  salesRepId    String?   // ID of the sales rep who signed them up
  commissionRate Float?   // Commission rate for this sales rep

  accounts      Account[]
  sessions      Session[]
  dogs          Dog[]
  serviceVisits ServiceVisit[]
  dataReadings  DataReading[]
  referrals     User[]           @relation("SalesRepReferrals")
  salesRep      User?            @relation("SalesRepReferrals", fields: [salesRepId], references: [id])
  earnedCommissions Commission[]  @relation("CommissionSalesRep")
  receivedCommissions Commission[] @relation("CommissionCustomer")
  orgId         String?
  org           Org?      @relation(fields: [orgId], references: [id])
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// Dog profiles
model Dog {
  id           String   @id @default(cuid())
  name         String
  breed        String?
  age          Int?
  weight       Float?
  userId       String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  dataReadings DataReading[]
  orgId        String?
  org          Org?     @relation(fields: [orgId], references: [id])
  customerId   String?
  customer     Customer? @relation(fields: [customerId], references: [id])
  samples      Sample[]
}

// Service visits
model ServiceVisit {
  id              String   @id @default(cuid())
  userId          String?
  scheduledDate   DateTime
  completedDate   DateTime?
  status          ServiceStatus @default(SCHEDULED)
  serviceType     ServiceType
  yardSize        YardSize
  dogsServiced    Int
  accountNumber   String?  // For linking Raspberry Pi data
  notes           String?
  deodorize       Boolean  @default(false)
  litterService   Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user            User?         @relation(fields: [userId], references: [id])
  dataReadings    DataReading[]
  commissions     Commission[]
}

// Data readings from Raspberry Pi
model DataReading {
  id             String   @id @default(cuid())
  userId         String?
  dogId          String?
  serviceVisitId String?
  timestamp      DateTime @default(now())
  weight         Float?   // Waste weight in grams
  volume         Float?   // Waste volume in ml
  color          String?  // Color analysis (RGB values)
  consistency    String?  // Texture/consistency analysis
  temperature    Float?   // Temperature reading
  methaneLevel   Float?   // Methane sensor reading
  location       String?  // GPS coordinates if mobile
  deviceId       String   // Raspberry Pi device identifier
  accountNumber  String?  // For anonymous data collection

  user         User?         @relation(fields: [userId], references: [id])
  dog          Dog?          @relation(fields: [dogId], references: [id])
  serviceVisit ServiceVisit? @relation(fields: [serviceVisitId], references: [id])
}

// Global eco statistics
model GlobalStats {
  id                   String   @id @default("global")
  totalWasteDiverted  Float    @default(0) // in lbs
  totalMethaneAvoided Float    @default(0) // in ft³
  totalUsers          Int      @default(0)
  totalDogs           Int      @default(0)
  totalServiceVisits  Int      @default(0)
  updatedAt           DateTime @updatedAt
}

// Commission tracking for sales reps
model Commission {
  id            String   @id @default(cuid())
  salesRepId    String   // Sales rep who earned the commission
  customerId    String   // Customer who generated the commission
  serviceVisitId String  // Service visit that generated commission
  amount        Float    // Commission amount
  status        CommissionStatus @default(PENDING)
  paidAt        DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  salesRep      User         @relation("CommissionSalesRep", fields: [salesRepId], references: [id])
  customer      User         @relation("CommissionCustomer", fields: [customerId], references: [id])
  serviceVisit  ServiceVisit @relation(fields: [serviceVisitId], references: [id])

  @@unique([salesRepId, serviceVisitId])
}

// Enums
enum UserRole {
  CUSTOMER
  SALES_REP
  ADMIN
  TECH
  OWNER
}

enum CommissionStatus {
  PENDING
  PAID
  CANCELLED
}

enum ServiceStatus {
  SCHEDULED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum ServiceType {
  REGULAR
  ONE_TIME
  SPRING_CLEANUP
  DEODORIZATION
}

enum YardSize {
  SMALL    // < 1/4 acre
  MEDIUM   // 1/4 - 1/2 acre
  LARGE    // 1/2 - 1 acre
  XLARGE   // > 1 acre
}

// ====================
// Multi-tenant & Edge → Cloud pipeline models
// ====================

model Org {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users     User[]
  customers Customer[]
  devices   Device[]
  jobs      Job[]
  dogs      Dog[]
  samples   Sample[]
  alerts    Alert[]

  // unique on slug already declared at field level
}

model Customer {
  id           String   @id @default(cuid())
  orgId        String
  org          Org      @relation(fields: [orgId], references: [id])
  name         String
  email        String?
  phone        String?
  addressLine1 String
  city         String
  state        String
  zip          String
  latitude     Float?
  longitude    Float?
  notes        String?
  createdAt    DateTime @default(now())

  dogs Dog[]
  jobs Job[]
  samples Sample[]
}

model Job {
  id            String        @id @default(cuid())
  orgId         String
  org           Org           @relation(fields: [orgId], references: [id])
  customerId    String
  customer      Customer      @relation(fields: [customerId], references: [id])
  frequency     Frequency     @default(WEEKLY)
  nextVisitAt   DateTime?
  dayOfWeek     Int?
  extraAreas    Int           @default(0)
  deodorizeMode DeodorizeMode @default(NONE)
  status        JobStatus     @default(ACTIVE)
  createdAt     DateTime      @default(now())
  samples       Sample[]
}

enum Frequency {
  ONE_TIME
  WEEKLY
  BI_WEEKLY
  TWICE_WEEKLY
}

enum JobStatus {
  ACTIVE
  PAUSED
  CANCELED
}

enum DeodorizeMode {
  NONE
  FIRST_VISIT
  EACH_VISIT
}

model Device {
  id          String   @id @default(cuid())
  orgId       String
  org         Org      @relation(fields: [orgId], references: [id])
  name        String
  type        String
  apiKeyHash  String
  uniqueId    String   @unique
  lastSeenAt  DateTime?
  createdAt   DateTime @default(now())
  samples     Sample[]

  @@index([orgId])
}

model Sample {
  id             String    @id @default(cuid())
  orgId          String
  org            Org       @relation(fields: [orgId], references: [id])
  deviceId       String
  device         Device    @relation(fields: [deviceId], references: [id])
  customerId     String?
  customer       Customer? @relation(fields: [customerId], references: [id])
  dogId          String?
  dog            Dog?      @relation(fields: [dogId], references: [id])
  jobId          String?
  job            Job?      @relation(fields: [jobId], references: [id])
  capturedAt     DateTime  @default(now())
  imageUrl       String?
  weightG        Float?
  moistureRaw    Int?
  temperatureC   Float?
  gpsLat         Float?
  gpsLng         Float?
  notes          String?
  freshnessScore Float?
  createdAt      DateTime  @default(now())

  scores SampleScore[]
  alerts Alert[]
  groundTruth GroundTruth[]

  @@index([orgId, capturedAt])
  @@index([customerId, capturedAt])
  @@index([dogId, capturedAt])
}

model SampleScore {
  id               String   @id @default(cuid())
  sampleId         String
  sample           Sample   @relation(fields: [sampleId], references: [id])
  colorLabel       String?
  consistencyLabel String?
  contentFlags     String?
  hydrationHint    String?
  giCluster        String?
  confidence       Float?
  baselineDelta    Json?
  scoredAt         DateTime @default(now())
}

model Alert {
  id           String     @id @default(cuid())
  orgId        String
  sampleId     String
  sample       Sample     @relation(fields: [sampleId], references: [id])
  level        AlertLevel @default(INFO)
  kind         String
  message      String
  acknowledged Boolean    @default(false)
  createdAt    DateTime   @default(now())

  org          Org        @relation(fields: [orgId], references: [id])

  @@index([orgId, createdAt])
  @@index([sampleId])
}

enum AlertLevel {
  INFO
  WATCH
  ATTENTION
}

model EcoStat {
  id                 String   @id @default(cuid())
  orgId              String
  customerId         String?
  dogId              String?
  periodMonth        String
  lbsDiverted        Float
  methaneAvoidedCuFt Float
  createdAt          DateTime @default(now())

  @@index([orgId, periodMonth])
}

model BillingSnapshot {
  id                   String   @id @default(cuid())
  orgId                String
  customerId           String
  plan                 String
  pricePerVisitCents   Int
  visitsPerMonth       Int
  oneTimeFeeCents      Int
  discountOneTimeCents Int
  createdAt            DateTime @default(now())

  @@index([orgId, customerId])
}

model GroundTruth {
  id           String   @id @default(cuid())
  sampleId     String   @unique
  sample       Sample   @relation(fields: [sampleId], references: [id])
  dataset      String   // e.g., v0.1
  split        String   // train|val|test
  colorLabel   String?
  consistency  String?
  contentFlags String?
  freshness    String?
  notStool     Boolean  @default(false)
  notes        String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([dataset, split])
}

```
