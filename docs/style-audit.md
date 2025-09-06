# Style Audit Report

Generated: 2025-08-30T15:33:27.050Z

## Summary

- **Files scanned**: 99
- **Files with violations**: 40
- **Total violations**: 374

## Violations by Type

- **inconsistentRadii**: 161 violations
- **adhocColorClasses**: 100 violations
- **typographyDrift**: 86 violations
- **heavyShadows**: 26 violations
- **darkBackgrounds**: 1 violations

## Violations by File

- **src/components/insights.tsx**: 47 violations
- **src/components/eco.tsx**: 26 violations
- **src/app/admin/dashboard/page.tsx**: 25 violations
- **src/app/signup/page.tsx**: 23 violations
- **src/components/quote-form.tsx**: 22 violations
- **src/components/hero.tsx**: 20 violations
- **src/components/sections/TrendsPreview.tsx**: 19 violations
- **src/app/dashboard/page.tsx**: 19 violations
- **src/components/sections/EcoImpact.tsx**: 14 violations
- **src/components/services.tsx**: 13 violations
- **src/components/WhyItMatters.tsx**: 13 violations
- **src/components/quote-calculator.tsx**: 11 violations
- **src/components/sections/Pricing.tsx**: 11 violations
- **src/app/sales-rep/dashboard/page.tsx**: 11 violations
- **src/components/ui/typography.tsx**: 10 violations
- **src/components/site-header.tsx**: 9 violations
- **src/components/sections/Hero.tsx**: 9 violations
- **src/components/community.tsx**: 8 violations
- **src/components/testimonials.tsx**: 7 violations
- **src/components/sections/HowItWorks.tsx**: 6 violations
- **src/app/signin/page.tsx**: 6 violations
- **src/components/sections/Services.tsx**: 5 violations
- **tailwind.config.ts**: 4 violations
- **src/app/styles/tokens.css**: 4 violations
- **scripts/style-audit.ts**: 3 violations
- **src/components/yard-carousel.tsx**: 3 violations
- **src/app/globals.css**: 3 violations
- **src/components/ui/switch.tsx**: 3 violations
- **src/app/sales-rep/customer-signup/page.tsx**: 3 violations
- **src/app/admin/sales-reps/create/page.tsx**: 3 violations
- **src/components/sticky-cta.tsx**: 2 violations
- **src/components/faq.tsx**: 2 violations
- **src/app/page.tsx**: 2 violations
- **src/components/ui/dialog.tsx**: 2 violations
- **src/components/footer.tsx**: 1 violations
- **src/app/layout.tsx**: 1 violations
- **src/components/ui/sheet.tsx**: 1 violations
- **src/components/ui/card.tsx**: 1 violations
- **src/components/ui/alert.tsx**: 1 violations
- **src/components/admin/SalesRepForm.tsx**: 1 violations

## Detailed Findings

### tailwind.config.ts

#### typographyDrift

- **Line 30**: `text-2xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 31**: `text-3xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 32**: `text-4xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 33**: `text-5xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height

### scripts/style-audit.ts

#### darkBackgrounds

- **Line 35**: `bg-black`
  - Suggestion: Replace with bg-card (content) or bg-panel (sections)

#### heavyShadows

- **Line 39**: `shadow-lg`
  - Suggestion: Use shadow-soft for subtle depth

#### inconsistentRadii

- **Line 48**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently

### src/components/yard-carousel.tsx

#### inconsistentRadii

- **Line 62**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 69**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 81**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently

### src/components/testimonials.tsx

#### typographyDrift

- **Line 33**: `text-3xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height

#### adhocColorClasses

- **Line 34**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 51**: `text-slate-700`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 59**: `text-slate-500`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 73**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border

#### inconsistentRadii

- **Line 72**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 74**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently

### src/components/sticky-cta.tsx

#### inconsistentRadii

- **Line 27**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently

#### heavyShadows

- **Line 27**: `shadow-lg`
  - Suggestion: Use shadow-soft for subtle depth

### src/components/site-header.tsx

#### inconsistentRadii

- **Line 75**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 94**: `rounded-lg`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 115**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 126**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 134**: `rounded-lg`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 169**: `rounded-lg`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 185**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 191**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently

#### heavyShadows

- **Line 154**: `shadow-xl`
  - Suggestion: Use shadow-soft for subtle depth

### src/components/services.tsx

#### typographyDrift

- **Line 8**: `text-3xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height

#### adhocColorClasses

- **Line 9**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 22**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 38**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 54**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 73**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 83**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border

#### heavyShadows

- **Line 15**: `shadow-lg`
  - Suggestion: Use shadow-soft for subtle depth
- **Line 31**: `shadow-lg`
  - Suggestion: Use shadow-soft for subtle depth
- **Line 47**: `shadow-lg`
  - Suggestion: Use shadow-soft for subtle depth

#### inconsistentRadii

- **Line 17**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 33**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 49**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently

### src/components/quote-form.tsx

#### inconsistentRadii

- **Line 100**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 102**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 110**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 126**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 141**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 156**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 173**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 188**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 205**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 209**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 218**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 237**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 248**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 256**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 269**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 273**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently

#### adhocColorClasses

- **Line 251**: `text-slate-500`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 258**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 260**: `text-slate-500`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 263**: `text-slate-500`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 264**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border

#### typographyDrift

- **Line 259**: `text-3xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height

### src/components/quote-calculator.tsx

#### inconsistentRadii

- **Line 40**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 53**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 63**: `rounded-lg`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 68**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 105**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 124**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently

#### adhocColorClasses

- **Line 107**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 110**: `text-slate-500`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 114**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 128**: `text-slate-500`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border

#### typographyDrift

- **Line 108**: `text-3xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height

### src/components/insights.tsx

#### inconsistentRadii

- **Line 10**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 20**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 23**: `rounded-lg`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 27**: `rounded-lg`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 31**: `rounded-lg`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 35**: `rounded-lg`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 39**: `rounded-lg`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 43**: `rounded-lg`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 64**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 66**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 67**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 68**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 69**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 73**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 74**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 75**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 81**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 84**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 85**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 88**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 91**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 92**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 95**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 98**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 99**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 102**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 105**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 106**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 112**: `rounded-lg`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently

#### typographyDrift

- **Line 10**: `text-3xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height

#### adhocColorClasses

- **Line 11**: `text-slate-700`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 12**: `text-slate-700`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 25**: `text-slate-700`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 29**: `text-slate-700`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 33**: `text-slate-700`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 37**: `text-slate-700`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 41**: `text-slate-700`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 45**: `text-slate-700`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 48**: `text-slate-500`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 60**: `text-slate-500`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 72**: `text-slate-700`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 82**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 89**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 96**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 103**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 123**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 127**: `text-slate-500`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border

### src/components/hero.tsx

#### inconsistentRadii

- **Line 17**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 18**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 40**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 51**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 54**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 76**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 78**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 96**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 102**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 111**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently

#### adhocColorClasses

- **Line 27**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 37**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 82**: `text-slate-700`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 85**: `text-slate-500`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 105**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 120**: `text-slate-500`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border

#### typographyDrift

- **Line 30**: `text-4xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 30**: `text-5xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 104**: `text-2xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height

#### heavyShadows

- **Line 111**: `shadow-lg`
  - Suggestion: Use shadow-soft for subtle depth

### src/components/footer.tsx

#### adhocColorClasses

- **Line 4**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border

### src/components/faq.tsx

#### typographyDrift

- **Line 9**: `text-3xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height

#### adhocColorClasses

- **Line 10**: `text-slate-700`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border

### src/components/eco.tsx

#### typographyDrift

- **Line 8**: `text-3xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 26**: `text-2xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 27**: `text-5xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 39**: `text-2xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 40**: `text-5xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 51**: `text-2xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 52**: `text-5xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 63**: `text-2xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 69**: `text-4xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 70**: `text-2xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 74**: `text-4xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 75**: `text-2xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height

#### adhocColorClasses

- **Line 12**: `text-slate-700`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 64**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 71**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 76**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border

#### inconsistentRadii

- **Line 22**: `rounded-3xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 29**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 30**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 35**: `rounded-3xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 42**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 43**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 47**: `rounded-3xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 54**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 55**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 61**: `rounded-3xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently

### src/components/community.tsx

#### typographyDrift

- **Line 8**: `text-3xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height

#### adhocColorClasses

- **Line 9**: `text-slate-700`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 21**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 28**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 35**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 47**: `text-slate-700`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 50**: `text-slate-700`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border

#### inconsistentRadii

- **Line 40**: `rounded-3xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently

### src/components/WhyItMatters.tsx

#### inconsistentRadii

- **Line 102**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 164**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 244**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 262**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 280**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 361**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 411**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 442**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 453**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently

#### typographyDrift

- **Line 109**: `text-3xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 109**: `text-4xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 223**: `text-2xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 306**: `text-2xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height

### src/app/page.tsx

#### typographyDrift

- **Line 42**: `text-3xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height

#### adhocColorClasses

- **Line 43**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border

### src/app/layout.tsx

#### adhocColorClasses

- **Line 23**: `text-slate-800`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border

### src/app/globals.css

#### inconsistentRadii

- **Line 63**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 67**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 81**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently

### src/components/sections/TrendsPreview.tsx

#### typographyDrift

- **Line 75**: `text-3xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 75**: `text-4xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height

#### inconsistentRadii

- **Line 78**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 117**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 155**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 158**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 162**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 166**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 170**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 177**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 180**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 183**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 200**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 202**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 211**: `rounded-lg`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently

#### heavyShadows

- **Line 158**: `shadow-lg`
  - Suggestion: Use shadow-soft for subtle depth
- **Line 162**: `shadow-lg`
  - Suggestion: Use shadow-soft for subtle depth
- **Line 166**: `shadow-lg`
  - Suggestion: Use shadow-soft for subtle depth
- **Line 170**: `shadow-lg`
  - Suggestion: Use shadow-soft for subtle depth

### src/components/sections/Services.tsx

#### typographyDrift

- **Line 79**: `text-3xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 79**: `text-4xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height

#### heavyShadows

- **Line 99**: `shadow-lg`
  - Suggestion: Use shadow-soft for subtle depth
- **Line 140**: `shadow-lg`
  - Suggestion: Use shadow-soft for subtle depth

#### inconsistentRadii

- **Line 106**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently

### src/components/sections/Pricing.tsx

#### typographyDrift

- **Line 77**: `text-3xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 77**: `text-4xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 166**: `text-5xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height

#### inconsistentRadii

- **Line 94**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 104**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 111**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 136**: `rounded-3xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently

#### heavyShadows

- **Line 145**: `shadow-lg`
  - Suggestion: Use shadow-soft for subtle depth
- **Line 154**: `shadow-lg`
  - Suggestion: Use shadow-soft for subtle depth
- **Line 212**: `shadow-lg`
  - Suggestion: Use shadow-soft for subtle depth
- **Line 212**: `shadow-xl`
  - Suggestion: Use shadow-soft for subtle depth

### src/components/sections/HowItWorks.tsx

#### typographyDrift

- **Line 67**: `text-3xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 67**: `text-4xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 118**: `text-2xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height

#### heavyShadows

- **Line 84**: `shadow-lg`
  - Suggestion: Use shadow-soft for subtle depth
- **Line 87**: `shadow-lg`
  - Suggestion: Use shadow-soft for subtle depth

#### inconsistentRadii

- **Line 116**: `rounded-3xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently

### src/components/sections/Hero.tsx

#### inconsistentRadii

- **Line 42**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 43**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 52**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 82**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 143**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 171**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently

#### heavyShadows

- **Line 105**: `shadow-lg`
  - Suggestion: Use shadow-soft for subtle depth
- **Line 105**: `shadow-xl`
  - Suggestion: Use shadow-soft for subtle depth
- **Line 195**: `shadow-lg`
  - Suggestion: Use shadow-soft for subtle depth

### src/components/sections/EcoImpact.tsx

#### typographyDrift

- **Line 72**: `text-3xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 72**: `text-4xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 104**: `text-2xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 110**: `text-5xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 140**: `text-2xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 146**: `text-5xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 147**: `text-2xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 151**: `text-5xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 152**: `text-2xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height

#### inconsistentRadii

- **Line 90**: `rounded-3xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 120**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 122**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 138**: `rounded-3xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently

#### heavyShadows

- **Line 100**: `shadow-lg`
  - Suggestion: Use shadow-soft for subtle depth

### src/components/ui/typography.tsx

#### typographyDrift

- **Line 9**: `text-4xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 9**: `text-5xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 10**: `text-3xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 10**: `text-4xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 11**: `text-2xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 11**: `text-3xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 12**: `text-2xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 17**: `text-2xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 26**: `text-5xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 26**: `text-6xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height

### src/components/ui/switch.tsx

#### inconsistentRadii

- **Line 14**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 22**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently

#### heavyShadows

- **Line 22**: `shadow-lg`
  - Suggestion: Use shadow-soft for subtle depth

### src/components/ui/sheet.tsx

#### heavyShadows

- **Line 34**: `shadow-lg`
  - Suggestion: Use shadow-soft for subtle depth

### src/components/ui/dialog.tsx

#### inconsistentRadii

- **Line 41**: `rounded-lg`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently

#### heavyShadows

- **Line 41**: `shadow-lg`
  - Suggestion: Use shadow-soft for subtle depth

### src/components/ui/card.tsx

#### inconsistentRadii

- **Line 12**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently

### src/components/ui/alert.tsx

#### inconsistentRadii

- **Line 6**: `rounded-lg`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently

### src/components/admin/SalesRepForm.tsx

#### adhocColorClasses

- **Line 219**: `text-gray-500`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border

### src/app/signup/page.tsx

#### typographyDrift

- **Line 182**: `text-3xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height

#### adhocColorClasses

- **Line 183**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 376**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 384**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 388**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 392**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 396**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 425**: `text-slate-500`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 447**: `text-slate-500`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 492**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border

#### inconsistentRadii

- **Line 185**: `rounded-lg`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 290**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 316**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 327**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 344**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 356**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 380**: `rounded-lg`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 403**: `rounded-lg`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 419**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 436**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 450**: `rounded-lg`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 496**: `rounded-lg`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 507**: `rounded-lg`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently

### src/app/styles/tokens.css

#### typographyDrift

- **Line 26**: `text-2xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 27**: `text-3xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 28**: `text-4xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 29**: `text-5xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height

### src/app/signin/page.tsx

#### typographyDrift

- **Line 20**: `text-2xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height

#### adhocColorClasses

- **Line 21**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 37**: `border-gray-300`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 40**: `text-gray-500`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 49**: `text-slate-500`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border

#### inconsistentRadii

- **Line 28**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently

### src/app/dashboard/page.tsx

#### typographyDrift

- **Line 60**: `text-3xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 81**: `text-2xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 94**: `text-2xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 107**: `text-2xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 120**: `text-2xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height

#### adhocColorClasses

- **Line 63**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 144**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 155**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 177**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 207**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 213**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 217**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 221**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 227**: `text-slate-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border

#### inconsistentRadii

- **Line 139**: `rounded-lg`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 174**: `rounded-lg`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 211**: `rounded-lg`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 215**: `rounded-lg`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 219**: `rounded-lg`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently

### src/app/sales-rep/dashboard/page.tsx

#### adhocColorClasses

- **Line 73**: `text-gray-900`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 74**: `text-gray-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 165**: `text-gray-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 168**: `text-gray-500`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 179**: `text-gray-500`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border

#### typographyDrift

- **Line 73**: `text-3xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 85**: `text-2xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 95**: `text-2xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 105**: `text-2xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 115**: `text-2xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height

#### inconsistentRadii

- **Line 157**: `rounded-lg`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently

### src/app/sales-rep/customer-signup/page.tsx

#### adhocColorClasses

- **Line 34**: `text-gray-900`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 35**: `text-gray-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border

#### typographyDrift

- **Line 34**: `text-3xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height

### src/app/admin/dashboard/page.tsx

#### inconsistentRadii

- **Line 134**: `rounded-full`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 219**: `rounded-lg`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 256**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 260**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently
- **Line 264**: `rounded-xl`
  - Suggestion: Use rounded-xl (1rem) or rounded-2xl (1.25rem) consistently

#### adhocColorClasses

- **Line 135**: `text-gray-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 145**: `text-gray-900`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 146**: `text-gray-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 225**: `text-gray-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 226**: `text-gray-500`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 234**: `text-gray-500`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 273**: `text-gray-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 277**: `text-gray-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 281**: `text-gray-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 285**: `text-gray-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 302**: `text-gray-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 365**: `text-gray-500`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border

#### typographyDrift

- **Line 145**: `text-3xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 158**: `text-2xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 168**: `text-2xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 184**: `text-2xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 198**: `text-2xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 258**: `text-2xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 262**: `text-2xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
- **Line 266**: `text-2xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height

### src/app/admin/sales-reps/create/page.tsx

#### adhocColorClasses

- **Line 28**: `text-gray-900`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border
- **Line 29**: `text-gray-600`
  - Suggestion: Use standardized tokens: text-ink, text-muted, bg-card, bg-panel, border-border

#### typographyDrift

- **Line 28**: `text-3xl`
  - Suggestion: Use standardized scale: H1/H2/H3 text sizes with default line-height
