# Customer Mobile Dashboard & Scooper Workflow Roadmap

## Current Desktop Dashboard (reference)
- **Entry point:** `src/app/dashboard/page.tsx` (server-render), feeds `Dashboard` component (`src/components/dashboard/Dashboard.tsx`).
- **Key tabs & components:** Overview (`tabs/OverviewTab.tsx`), Profile (`tabs/ProfileTab.tsx`), Visits, Billing, Wellness, Eco.
- **Data contracts:** see `src/components/dashboard/types.ts` for `DashboardServiceVisit`, `DashboardDog`, `DashboardUser`, etc.
- **Critical flows to mirror on mobile:**
  - Service overview (plan frequency, weekend upgrade flag, trial status, next visit).
  - Skip/reschedule requests (currently POST `/api/schedule/request`).
  - Billing snapshot (ledger entries, first charge date).
  - Wellness insights cards (stool readings, media gallery).
  - Support / contact CTA.

## Mobile Experience Goals
1. **Responsive shell** – dedicated app layout (`src/app/mobile/dashboard/layout.tsx` TBD) using Tailwind breakpoints + bottom navigation.
2. **Home tab** – condensed Overview + next visit CTA, skip/reschedule buttons, tile readiness messaging when applicable.
3. **Visits tab** – timeline of past/future visits with media modal, ability to request skip/reschedule (reuse `ScheduleSelector` logic for mobile modal).
4. **Billing tab** – ledger list, invoice status, QuickBooks sync indicator (reuse data from `/api/admin/billing/dashboard` but filtered for customer).
5. **Wellness tab** – stool trend, badges, export to vet.

## Component Reuse Strategy
- Extract shared cards from desktop tabs (`OverviewTab`, `ProfileTab`) into portable components under `src/components/dashboard/mobile/`.
- Use existing hooks for tile messaging (`buildTileMessaging`) to maintain consistent copy.
- Leverage `ScheduleSelector` with a compact mode prop for mobile skip/reschedule modal.
- Billing summary: reuse `FirstWeekCreditBanner`, `PricingSummary` components with mobile variants.

## API Surface Review
- `/api/schedule/request` already returns enriched metadata (trial extensions). No changes needed.
- Need a customer-facing billing endpoint (subset of `/api/admin/billing/dashboard`). Proposed `/api/customer/billing/ledger` returning ledger entries + credits for authenticated user.
- Ensure QuickBooks integration flag respected (hide sync messaging unless enabled).

## Scooper Workflow Simplification Alignment
- Field-tech pages live under `src/app/field-tech/visits/` (gear check, media capture).
- Recent work simplified media requirements (daily gear check, deposit capture, gate photo, sanitation clip).
- Next actions:
  - Create daily gear-check toggle UI (single selfie unlock) – see `FIELD_TECH_IMPROVEMENTS.md`.
  - Update visit action buttons to remove proof photo step and clarify remaining requirements.
  - Surface “on the way” text automation toggle.

## Deliverables Outline
1. **Mobile shell & navigation** (`/mobile/dashboard`, components, responsive layout).
2. **Shared card library** (`src/components/dashboard/mobile/`), migrating existing tab cards.
3. **Customer billing endpoint** (`/api/customer/billing/ledger`) + mobile billing tab UI.
4. **Skip/reschedule modal** reusing `ScheduleSelector` in compact mode.
5. **Scooper workflow UI updates** (daily gear check button, updated completion tiles) with doc updates.
6. **Test plan:**
   - Unit tests for new API route(s).
   - Vitest/component tests for mobile cards.
   - Manual regression checklist (skip flow, billing view, field-tech visit completion).

## Open Questions
- Do we build separate mobile entry (`/app/mobile`) or reuse same route with responsive layout? Recommend new nested route for clarity while sharing server loader.
- Authentication: ensure mobile routes use same session guard.
- Offline caching? Consider future iteration.

Next step: scaffold mobile dashboard layout + shared card components.
