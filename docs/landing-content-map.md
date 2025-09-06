### Landing Page Content Map

Sections in render order with sources, key copy, CTAs, data, and quick UX/IA notes.

1. Header / Navigation

- File: `src/components/site-header.tsx`
- Copy/CTAs: Nav to #services, #pricing, #insights, #eco, #faq; Sign up; Log in; Mobile "Call"
- Data/State: `isMenuOpen` for mobile; uses inline logo `/yardura-logo.png`
- UX/IA: Sticky, translucent; missing active-section highlight; mobile menu has ARIA label on button; needs focus trap; consider adding primary CTA

2. Hero

- File: `src/components/hero.tsx`
- Key copy: H1 "Poop-free yard. Smarter Insights. Less landfill."; service area; trust chips; testimonial
- CTAs: "Get My Quote" → `#quote`, "How it works" → `#how`
- Data: Static image `/modern_yard.png`
- UX/IA: LCP image via <img>; recommend Next/Image with dimensions to avoid CLS

3. Quote Section

- File: inline in `src/app/page.tsx` (#quote)
- Copy: "Get Your Instant Quote" heading; explainer; right column text/email updates teaser
- CTAs: submit in `QuoteForm`
- Data: `QuoteForm`
- UX/IA: CTA label differs from global primary; add UTM capture + consent checkbox

4. How it works

- File: inline in `src/app/page.tsx` (#how)
- Copy: 3 steps; microcopy
- CTA: —
- UX/IA: Add "What you’ll get every visit" checklist

5. Services

- File: `src/components/services.tsx` (#services)
- Copy: 3 cards; badges
- CTA: —
- UX/IA: Good; keep bullets concise, mark add-ons

6. Picture‑Perfect Yards (Carousel)

- File: `src/components/yard-carousel.tsx`
- Copy: Section container in page.tsx
- CTA: —
- UX/IA: Ensure accessible controls; lazy-load

7. Pricing

- File: inline in `src/app/page.tsx` (#pricing)
- Copy: Three cards; CTA "Get Your Custom Quote"
- CTA: `#quote`
- UX/IA: Unify CTA label; consider weekly/every-other toggle

8. Eco Impact

- File: `src/components/eco.tsx` (#eco)
- Copy: Counters + community impact
- CTA: —
- UX/IA: Use count-up; add fine print

9. Community

- File: `src/components/community.tsx`
- Copy: Community-focused content
- CTA: —
- UX/IA: Ensure spacing harmony

10. Why It Matters

- File: `src/components/WhyItMatters.tsx` (#why-matters)
- Copy: Rationale; callout; pillars; conditions; vet chips; disclaimer
- CTA: Get My Quote; How Insights Work
- UX/IA: Strong; anchors + aria-labelledby present

11. Insights

- File: `src/components/insights.tsx` (#insights)
- Copy: Coming soon; 3C’s; preview card
- CTA: —
- UX/IA: Keep non-diagnostic tone

12. FAQ

- File: `src/components/faq.tsx` (#faq)
- Copy: 8 items
- CTA: —
- Data: shadcn accordion
- UX/IA: Add FAQ schema

13. Testimonials

- File: `src/components/testimonials.tsx`
- Copy: 3 cards; CTA chip
- CTA: "Get My Quote" → `#quote`
- UX/IA: Lightweight; consistent tokens

14. Footer / Sticky CTA / Progress Indicator

- Files: `src/components/footer.tsx`, `src/components/sticky-cta.tsx`, `src/components/progress-indicator.tsx`
- Copy: Footer info + global CTA
- UX/IA: Include legal disclaimer (non-diagnostic)

Duplications / inconsistencies

- CTA labels vary: "Get My Quote" vs "Get Your Instant Quote" vs "Get Your Custom Quote" → unify to "Get My Quote"
- Multiple insight disclaimers — unify phrasing

Accessibility risks

- Hero image lacks explicit dimensions; use Next/Image
- Mobile menu needs focus trap + active section highlighting
- Maintain H1→H2→H3 order; verify contrast for greens on white

Performance risks

- <img> instead of Next/Image for hero and others
- Missing width/height may cause CLS; ensure eager only for LCP image
- Keep motion subtle; respect prefers-reduced-motion

