## Component and Route Map (Web + Mobile)

### Web (Next.js)
- Routes
  - `/` → Landing composition (sections via components)
  - `/quote` → `QuotePageClient` (pricing SSoT `lib/priceEstimator`)
  - `/dashboard` → `DashboardClientNew` (tabs; KPIs)
  - `/insights` → Insights hub
  - `/reports` → Reports list/history
  - `/schedule` → Next window + requests
  - `/billing` → Stripe portal opener
  - `/profile` (new) → profile editor, privacy controls
- Shared UI
  - Header (swap to `components/site/AnimatedHeader`)
  - KPI components: capsule chips, stat rings, sparkline, timeline markers
  - Chart wrappers (Recharts) for trends/distributions

### Mobile (Expo – to be created)
- Tabs: Home, Insights, Reports, Schedule, Billing, Profile
- Screens mirror web IA; use Victory Native/react-native-svg charts
- Utilities: pull-to-refresh; in-app browser for Stripe; push notifications

### Data & Utilities
- Pricing: `lib/priceEstimator` (single SSoT for all pricing displays)
- KPIs API: extend `/api/dashboard/kpis` with alerts, next/last pickup, billing snippet
- Insights: `/api/insights/trends` enriched; `SampleScore` markers
- Reports: add list/history endpoint
- Schedule: `Job` + `ServiceVisit` sources

