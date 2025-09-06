# Client Dashboard IA (Web + Mobile)

## Web (Next.js)

- Tabs: Overview, Wellness, Services, Eco Impact, Reports, Billing, Rewards, Profile
- Overview (above the fold):
  - Next Pickup (date + stat ring days to next)
  - Last Pickup (date + stat ring days since)
  - Recent Insights (All normal or Watch)
  - Activity (7d/30d counts, avg wt 30d + stat ring for 7d of 30)
  - Eco (MTD diverted + methane + stat ring vs prev month)
  - Billing snippet (active/setup + portal link)
- Wellness:
  - Key Signals (Last sample, WoW change, 8-week sparkline)
  - Insights Timeline (stacked markers)
  - Core 3Cs (condensed copy, informational-only)
  - Color Distribution (30d)
  - Service Streak + Observations Breakdown
- Reports: Monthly list + download
- Services: Next service, streak, total services, scheduling CTAs
- Eco Impact: MTD stats and comparison
- Billing: Stripe portal link/embedded
- Profile: Account and dogs

Accessibility: Informational-only disclaimer on insights; keyboard focus and labels.

## Mobile (Expo/React Native)

- Bottom Tabs: Home, Insights, Reports, Schedule, Billing, Profile
- Home:
  - KPI cards: Next Pickup, Last Pickup, Recent Insights, Activity, Eco, Billing
  - Single-column cards, larger tap targets, pull-to-refresh
- Insights:
  - Key Signals (compact)
  - Timeline (scrollable markers)
  - Condensed Core 3Cs + Color Distribution
- Reports: List + open in viewer
- Schedule: Upcoming window, skip/reschedule request
- Billing: Open Stripe Portal in in-app browser
- Profile: Household & dogs, privacy controls

Notes:
- Light theme only, gradients on CTAs and chips; opaque cards; no transparency.
- Copy: “Insights are informational only and not veterinary advice.”

## Client Dashboard — Final IA (Web + Mobile)

Audience: Everyday dog owners. Core questions: Am I okay? Anything to watch? When are you coming? What am I paying? What good are we doing?

### Above-the-fold KPIs (Home/Overview)
- Next Pickup: date/time window (from `Job.nextVisitAt` or nearest `ServiceVisit.scheduledDate`)
- Last Pickup: last completed date (from `ServiceVisit.completedDate`)
- Recent Insights: show WATCH/ATTENTION if any open `Alert` in last 30d else “All normal”
- Activity: Deposits (7/30d), Avg weight (30d), Frequency trend (WoW)
- Eco (MTD): lbs diverted + methane avoided (from `EcoStat` for current month)
- Billing snippet: current plan + next charge date; deep-link to Stripe Portal

### Tabs (clean and minimal)
- Insights
  - Timeline with stacked markers for `SampleScore` (color, consistency, content)
  - Consistency trend (sparkline)
  - Color distribution
  - Content flags heatmap
  - Hydration/GI callouts (non-medical), vet CTA when clusters persist
- Reports
  - Monthly PDF history; list + download/share
- Schedule
  - Calendar of visits; request skip/reschedule; ETA (if integrated)
- Billing
  - Plan, add-ons, receipts; open Stripe Portal; pricing util SSoT
- Profile
  - Household + dogs; privacy/consent controls; data deletion request

### Data model alignment
- Server endpoints
  - `/api/dashboard/kpis`: extend to include alerts summary, next/last pickup, plan snippet
  - `/api/insights/trends`: enrich with markers and aggregation buckets
  - `/api/reports/monthly` & history list endpoint
  - `/api/schedule/request` unchanged; add list/ETA endpoint if available
  - `/api/billing/portal/me` unchanged; add `/api/billing/summary`

### Web vs Mobile
- Web: persistent left/top nav, multi-column grids, hover tooltips, PDF preview
- Mobile (Expo): bottom tabs (Home, Insights, Reports, Schedule, Billing, Profile); single-column cards, larger tap targets, pull-to-refresh, skeletons

### Visual/Interaction guidelines
- Premium chips (capsule), sparkline glyphs, stacked timeline markers, stat rings
- One chart per canvas; theme-driven colors only
- Opaque cards; tasteful gradients on CTAs/status
- Copy: “Insights are informational only and not veterinary advice.”

