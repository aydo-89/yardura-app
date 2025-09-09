# Analytics Events (Development Stub)

These events log to console by default via `src/lib/analytics.ts`. Flip `hasRealAnalytics` when wiring a provider.

## Landing
- nav_click: { section }
- cta_header_get_quote
- header_phone_call
- cta_hero_get_quote
- cta_hero_how_it_works
- cta_pricing_get_quote: { dogs, frequency, yardSize, popular }
- cta_pricing_bottom_get_quote
- cta_testimonials_get_quote
- cta_sticky_get_quote
- cta_insights_get_quote
- cta_insights_learn_more

## Dashboard
- dashboard_tab_change: { tab }
- billing_portal_opened: { location }
- dashboard_quick_action: { action }
- referral_copy
- referral_native_share
- report_download: { month, orgId }

### Notes
- Keep payloads small and privacy-respecting.
- Add new events sparingly; prefer reusing patterns.