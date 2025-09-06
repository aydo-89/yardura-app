## Landing Page Audit — Findings and Fix Plan

Scope: Improve conversion, clarify value, reinforce trust, and make visuals premium and consistent.

### Current structure (observed in `src/app/page.tsx`)
1. Hero
2. Differentiators
3. Why It Matters
4. Insights preview
5. Services (How it Works)
6. Pricing (calculator-style cards)
7. Quote teaser
8. Eco
9. Testimonials
10. FAQ

Header: sticky, opaque; animated/shrinking header exists but unused. Multiple translucent cards in hero/sections.

### Proposed section order for conversion
- Hero → Differentiators (+ Insights preview snippet)
- Proof: Testimonial + eco stats
- Pricing/Quote
- How it Works (Services)
- FAQ
- Final CTA

### Keep / Move / Remove
- Keep: Hero, Differentiators, Insights preview, Pricing, Services, Eco stats (condense into proof), Testimonials (one strong tile), FAQ, Sticky CTA.
- Move: Insights preview up (paired with Differentiators). Eco metrics and one testimonial grouped into “Proof” above Pricing.
- Remove/Reduce:
  - Duplicated quote elements (prefer single clear CTA cluster per major section).
  - Transparent card backgrounds; use opaque cards for readability.
  - Excess micro-motion; prefer subtle, token-driven transitions.

### Style and interaction fixes
- Cards: Opaque surfaces (no bg-white/70), stronger contrast, tokenized gradients (accent/brand only).
- Header: Use animated/shrinking header (`components/site/AnimatedHeader.tsx`) for premium feel; unify z-index tokens (`z-sticky` > chips > cards).
- Motion: Section enter fade/slide, subtle card hover (scale/elevation), nav shrink on scroll.
- Chips/Badges: Capsule style with gradients; consistent focus rings; WCAG contrast.

### CTA routing
- Ensure all CTAs route to `/quote` (Hero, Pricing, sticky-cta, header). Retain back-compat `#quote` redirect.

### Content copy and trust
- Tagline: “Clean yard. Smarter insights. Less landfill.”
- Proof: Show “lbs diverted” and “methane avoided” at-a-glance (month-to-date), one customer quote.
- Insights: 3C’s explained without medical claims; include disclaimer.

### Technical actions (web)
- Swap header to animated variant; keep accessibility from current header (focus trap, ESC) or merge features.
- Normalize section IDs to match header links: `#services`, `#pricing`, `#insights`, `#eco`, `#faq`.
- Consolidate eco + testimonial block above Pricing; adjust `components/eco` usage accordingly.
- Remove semi-transparent surfaces; apply `bg-card` or solid white with borders and `shadow-soft`.
- Ensure pricing uses single source (`lib/priceEstimator`) across site; no duplicated math.

### Risks / Notes
- Keep LCP fast: hero image preloaded in `layout.tsx` (already present). Ensure animated header does not regress CLS.
- Respect reduced motion with `useReducedMotionSafe`.

