
# Yardura Service OS – Master Build Checklist (Existing-App Aware)

> Track owners, due dates, PR links for every item.

## Phase 0 — **Analysis Only (No Feature Changes)**
- [ ] Project survey: structure/workspaces/scripts/env
- [ ] Routing map (App Router), API routes, middleware
- [ ] UI audit: landing, quote/onboarding, portal/dashboard
- [ ] Dependency audit (frameworks, auth, UI, charts, email)
- [ ] Data audit: read Prisma schema; ERD; row counts; DB size; indexes
- [ ] Baseline perf: FCP/LCP, API timings
- [ ] Risk register; compatibility contract; feature-flag plan
- [ ] Write-up: `/docs/00_codebase_survey.md`

## Phase 0.5 — **Dual DB & Migration Readiness**
- [ ] Add Postgres datasource alongside SQLite (no cutover yet)
- [ ] Prisma validate/format/generate; align enums/indices
- [ ] Generate Postgres init migration script (prisma migrate diff → infra/pg/init.sql)
- [ ] Data export plan (SQLite → CSV/NDJSON) and Postgres COPY scripts
- [ ] Introduce data-access layer + flags to toggle reads/writes per model
- [ ] Backups + PITR plan; rollback doc

## Phase 1 — Foundations
- [ ] Monorepo scaffold (apps/web, apps/workers, packages/ui, packages/core, packages/db, packages/config, infra)
- [ ] Next.js 15 + React 19 + TS strict
- [ ] Tailwind + shadcn/ui + Lucide + Framer Motion
- [ ] next-auth configured; seed roles & RBAC guards
- [ ] .env.example filled
- [ ] Docker compose: web, postgres, redis, worker
- [ ] S3/R2 + signed URL helper + CDN
- [ ] Sentry + Vercel Analytics
- [ ] GitHub Actions CI (typecheck, lint, test, build)
- [ ] Seed script + demo tenant

## Phase 2 — F-001 Quote & Leads (Parity)
- [ ] Quote wizard parity (steps/validation/pricing) 1:1
- [ ] POST `/api/quote` → `leadId`; normalized lead storage
- [ ] Success page; analytics events
- [ ] Rate limiting; audit logging

## Phase 2a — F-001B Outbound Field Sales (Spotio-Inspired)
- [ ] Territory schema + assignments (polygons, ZIP slices, heatmap overlays)
- [ ] Outbound lead pipeline (door-knock capture, statuses, dedupe with inbound)
- [ ] Mobile canvassing map (offline pins, photos, quick-note logging)
- [ ] Route planner + Trip log (multi-stop optimization, mileage tracking)
- [ ] Autoplay cadences (templated touchpoints, reminders, SLA alerts)
- [ ] Manager cockpit (team radar, campaign import, pipeline dashboards)
- [ ] Convert-to-customer bridge (merges outbound history into onboarding flow)

## Phase 3 — F-002 Onboarding & Subscriptions
- [ ] ZIP eligibility + zone pricing
- [ ] Cross-sell during onboarding
- [ ] Stripe SetupIntent; ToS acceptance
- [ ] Create subscription; schedule first visit
- [ ] Welcome email + portal credentials
- [ ] Error/dunning flows

## Phase 4 — F-003 Dispatch & Routing
- [ ] Generate jobs (recurring + one-time)
- [ ] Weather check + mass weather skip + client notifications
- [ ] Route optimizer (≤10s/100 stops) + live ETAs
- [ ] Drag-and-drop dispatch board
- [ ] Reassign / reschedule / reclean / recreate

## Phase 5 — F-004 Field Technician PWA
- [ ] PWA installable; offline queue; background sync
- [ ] Shifts (clock in/out, breaks); odometer logs; GPS on shift
- [ ] Job detail: navigate, “on the way” SMS, photos required, notes, complete
- [ ] Timesheet submission

## Phase 6 — F-005 Client Portal
- [ ] Proofs timeline gallery with metadata
- [ ] Subscription mgmt (pause/cancel request)
- [ ] Payment method mgmt (cannot remove last method)
- [ ] Billing history; schedule view; notification prefs

## Phase 7 — F-006 Wellness Insights
- [ ] Photo validation + queue analysis
- [ ] 3Cs classification; Moisture/Weight/Frequency trend logic
- [ ] Non-diagnostic copy; significant-change alerts
- [ ] Portal wellness visualizations
- [ ] Opt-in anonymized toggle

## Phase 8 — F-007 Billing & QBO
- [ ] Recurring invoice scheduler; one-time & setup fees
- [ ] Skip-reason pricing rules
- [ ] Payments/refunds; open balance; automated dunning
- [ ] QBO sync: customers, invoices, payments
- [ ] Reconciliation dashboard; retries/backoff

## Phase 9 — F-008 Payroll
- [ ] Hourly / hourly+bonus / commission models
- [ ] Overtime rules; mileage reimbursement
- [ ] Pay slip export (CSV/PDF); approvals
- [ ] Performance link to bonuses

## Phase 10 — F-009 Franchise
- [ ] Parent oversight; subaccount switching
- [ ] Brand consistency controls
- [ ] Consolidated payments; ACH royalty collection (percent/minimum)
- [ ] Franchise & consolidated reporting

## Phase 11 — F-010 Cross-Sell
- [ ] Catalog + taxable flags
- [ ] Per-client request mgmt; recurring/one-time
- [ ] Completion → billing integration
- [ ] Commission tracking/reporting

## Phase 12 — APIs, Webhooks, Reporting (F-011–F-016)
- [ ] Public REST API (tenant-scoped PATs); OpenAPI + /docs
- [ ] Outbound webhooks (HMAC; idempotency); retry/backoff
- [ ] Stripe/QBO/Twilio/Email webhook consumers tested
- [ ] Reporting dashboards for ops/finance/franchise

## Phase 13 — Quality, Perf, Security
- [ ] Jest unit tests; Playwright E2E for critical paths
- [ ] Load tests: routing (100 stops), portal P95 < 500ms
- [ ] Zod validation everywhere; rate limiting configured
- [ ] PII encryption at rest; audit logs on sensitive ops
- [ ] Backups + PITR; disaster recovery checklist

## Phase 14 — Cutover & Cleanup
- [ ] Flip reads/writes fully to Postgres; freeze window executed
- [ ] Validate counts and integrity; decommission SQLite
- [ ] Feature flags: wellness, franchise (phased rollout)
- [ ] Runbook + on-call; SLOs and alerting
- [ ] Admin demo tenant + sample data for sales
- [ ] Production deploy; post-launch KPI dashboard
