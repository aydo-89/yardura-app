## Yardura UX Inventory — Apps, IA, Data, Metrics

Last updated: today

### Repo and stack
- **Framework**: Next.js App Router (`src/app`), TypeScript
- **UI**: Tailwind CSS (`tailwind.config.ts`), shadcn/ui (`components/ui/*`), lucide icons
- **Design tokens**: `src/app/styles/tokens.css` + Tailwind CSS vars (brand, chart palette)
- **Animation**: framer-motion + custom presets `src/lib/motion/presets.ts`, helpers (`components/Reveal.tsx`, `hooks/useReducedMotionSafe.ts`), optional animated header (`components/site/AnimatedHeader.tsx`)
- **Charts**: No Recharts/Victory currently. Simple SVG sparkline and stat visuals in `components/InsightsCharts.tsx` and custom SVG in dashboard
- **Backend/data**: Prisma (SQLite by default) with rich domain schema in `prisma/schema.prisma`
- **Auth**: NextAuth (via `src/app/api/auth/[...nextauth]/route.ts` + `src/lib/auth.ts`)
- **Payments**: Stripe (`src/lib/stripe.ts`, customer portal routes)
- **Storage (reports)**: Supabase admin client used in reports API
- **Env config**: `src/lib/env.ts` validates keys; widespread `process.env.*` usage

### Current Information Architecture (high-level)
- **Landing (/) sections (current order)**
  1. Hero (`components/hero`)
  2. Differentiators (`components/Differentiators`)
  3. Why It Matters (`components/WhyItMatters`)
  4. Insights preview (`components/insights`)
  5. How It Works/Services (`components/services`)
  6. Pricing (`components/pricing`)
  7. Quote teaser (`components/QuoteTeaser`)
  8. Eco (`components/eco`)
  9. Testimonials (`components/testimonials`)
  10. FAQ (`components/faq`)
  11. Footer, Sticky CTA (`components/footer`, `components/sticky-cta`)
- **Site nav**: `components/site-header.tsx` (sticky, not shrinking). Alternate animated header exists (`components/site/AnimatedHeader.tsx`) but not wired into layout.
- **Client Dashboard tabs**: Implemented inside `components/DashboardClientNew.tsx`
  - Overview, Wellness, Services, Eco Impact, Rewards, Profile

### User-facing surfaces (routes) and purpose
- `/` Home (Landing). Sections listed above; CTA routes to `/quote`. JSON-LD present.
- `/quote` Instant quote flow. Client component `QuotePageClient` (multi-step form, pricing util, reCAPTCHA support).
- `/quote/success` Quote success confirmation.
- `/dashboard` Client dashboard. Server-loads user, dogs, service visits, data readings; renders `DashboardClientNew` (tabs above, KPIs, onboarding forms, sparkline trends).
- `/insights` Insights hub page (SEO-focused content + preview chart via `InsightsCharts`).
- `/insights/dog-poop-color-health` Article page.
- `/reports` Reports list/generation (generates monthly PDF via API and returns signed URL).
- `/schedule` Basic schedule UI (shows next pickup if any; request reschedule/skip triggers POST to API).
- `/billing` Opens Stripe Customer Portal.
- `/signin`, `/signup` Auth screens.
- `/account` Account placeholder page.
- `/city`, `/city/[city]`, `/minneapolis`, `/richfield`, `/edina`, `/bloomington` Marketing/SEO city pages.
- `/sales-rep/*` Sales-rep signup/customer-signup utilities.
- `/admin/*` Admin (dashboard, devices, labeling, samples) — internal use.

### Key components/pages by surface
- Landing composition: `src/app/page.tsx` imports `hero`, `Differentiators`, `WhyItMatters`, `insights`, `services`, `pricing`, `QuoteTeaser`, `eco`, `testimonials`, `faq`, `footer`, `sticky-cta`.
- Dashboard: `src/app/dashboard/page.tsx` server-loads Prisma data; `components/DashboardClientNew.tsx` renders tabs, KPIs, onboarding forms, charts-as-SVG.
- Insights preview: `components/InsightsCharts.tsx` uses `/api/insights/trends` + SVG trend.
- Pricing: `components/pricing.tsx` uses `lib/priceEstimator` for per-visit/monthly math and frequency tabs.

### Data sources and APIs (selected)
- Dashboard KPIs: `GET /api/dashboard/kpis`
  - deposits30 (sample count last 30d)
  - avgWeight30 (avg sample weightG last 30d)
  - freq7 (sample count last 7d)
  - eco (EcoStat aggregate for current month: lbsDiverted, methaneAvoidedCuFt)
  - alertsOpen (unacknowledged Alert count)
- Insights trend: `GET /api/insights/trends?days=` returns per-sample items: ts, weightG, moistureRaw, colorLabel, consistencyLabel, contentFlags
- Reports: `POST /api/reports/monthly` generates & uploads PDF to Supabase Storage; returns signed URL
- Schedule: `POST /api/schedule/request` submit reschedule/skip; Schedule page reads `Job` list via Prisma
- Billing: `POST /api/billing/portal/me` creates Stripe portal session (redirect URL uses `NEXT_PUBLIC_APP_URL`)
- Quote estimate: `POST /api/quote/estimate` uses `lib/priceEstimator` + `lib/initialCleanEstimator`
- Quote submit: `POST /api/quote` validates via `lib/formProtection`, optional email via Resend

### Env and configuration
- Stripe: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STORAGE_BUCKET`
- Auth: `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- Recaptcha: `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY`
- Google Maps: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- App URLs: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_BASE_URL`
- Admin: `ADMIN_EMAILS`
- Email: `RESEND_API_KEY`, `CONTACT_TO_EMAIL`
- Redis (optional): `REDIS_URL`
- Feature flags: none detected (search found only “contentFlags” for insights, not runtime feature flags)

### Metrics inventory (where computed/shown)
- Deposits Logged: count of `Sample` rows in time windows (7/30d) via `/api/dashboard/kpis`
- Avg Weight (30d): `avg(weightG)` via KPIs API
- Frequency Trend: `freq7` via KPIs API; dashboard also builds 8-week sparkline from `DataReading` timestamps
- Eco: MTD diverted lbs + methane avoided via `EcoStat` in KPIs API; Dashboard Eco tab currently derives compost/methane/space from client-side totals, not `EcoStat`
- 3 C’s: `SampleScore` model (`colorLabel`, `consistencyLabel`, `contentFlags`); `hydrationHint`, `giCluster` fields exist in schema but not surfaced in UI
- Billing snippet: not shown on Dashboard; Stripe portal link exists at `/billing`
- Next/Last Pickup: Dashboard computes `nextServiceAt` and `lastReadingAt` locally from `serviceVisits`/`dataReadings` but not elevated to top-level KPI above the fold

### Duplication and inconsistencies
- Eco metrics appear in multiple places: KPIs API (server, `EcoStat`) vs client-side derived values on Eco tab — can drift
- Service “streak” and counts show in multiple tabs (Overview, Services)
- Insights preview exists on landing and Dashboard Wellness, with different visual treatments
- Two header implementations: `site-header.tsx` (in use) and `site/AnimatedHeader.tsx` (not used)

### Gaps vs target experience
- Above-the-fold KPIs missing: Next Pickup window, Last Pickup date, Recent Insights flags status, Billing snippet (plan + next charge date)
- Insights: No consolidated WATCH/ATTENTION cluster logic; hydration/GI callouts exist in schema but not displayed
- Reports: `/reports` requires manual month/org input; no obvious “history list” for the signed URLs; not surfaced in Dashboard tab
- Schedule: Basic; lacks ETA, skip/reschedule flows integrated into Dashboard
- Billing: Portal access exists, but no embedded plan/add-ons summary in Dashboard
- Visuals: Uses translucent cards (`bg-white/70`, `/80`) in places; guideline requires opaque cards; gradients exist but not consistently tokenized
- Charts: No Recharts/Victory yet; visuals are custom SVG; no “one chart per canvas” theme standard yet
- Mobile apps: No `apps/mobile` or Expo project present; no native screens

### Known pain points and quick notes
- **CTA routing**: Consistent to `/quote` from hero/pricing/header; old `#quote` anchors are redirected by script (back-compat)
- **Sticky header**: Present (non-animated). Animated/shrinking header exists but unused; recommend swapping in with consistent z-index
- **Z-index/layering**: Custom classes `z-sticky`, `z-overlay` appear in animated header; not Tailwind defaults. Ensure z-index scale is standardized (e.g., header > chips > cards)
- **Transparency**: Several components use `bg-white/XX` overlays; convert to opaque cards for content surfaces per spec
- **Accessibility**: Header mobile menu uses focus trap and Escape handling; reduced-motion variants provided; ensure consistent aria and focus rings on new components

### Schema highlights (for metrics & IA)
- `Sample`, `SampleScore` (3 C’s + flags), `Alert` (INFO/WATCH/ATTENTION), `EcoStat` (monthly eco), `Job` (schedule), `ServiceVisit` (next/last pickup), `BillingSnapshot` (billing plan snapshot)

### Proposed next docs (separate deliverables)
- `/docs/ux_audit/02-landing-findings.md`: keep/remove/move per section + conversion order
- `/docs/ux_plan/03-dashboard-IA.md`: final IA for Web + Mobile (tabs, above-the-fold KPIs, chart set)
- Wireflows/wires: Landing wireflow and Dashboard wires (web + mobile)

