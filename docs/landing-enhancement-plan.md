### Landing Enhancement Plan

Scope: Elevate Yardura landing to flagship quality with consistent tokens, motion, copy, a11y, and performance.

#### Global Improvements

- Tokens: add `app/styles/tokens.css` with brand CSS vars (ink, muted, accent, accent-soft, warning, panel, card). Use via Tailwind hsl(var(--var)).
- Typography: H1 36/44, H2 30/38, H3 24/32, body 16/26; tighten on xl.
- Spacing: Section padding `py-24 md:py-32`.
- Components: `components/Reveal.tsx` fade+lift on scroll; respects prefers-reduced-motion.
- Analytics: `lib/analytics.ts` with `track(name, payload)` no-op to console.info; add `data-analytics` on CTAs.
- Accessibility: Strict H1→H2→H3; visible focus rings; aria-labels; keyboardable menus/carousels.
- Performance: Replace `<img>` with `next/image` with width/height; mark LCP image priority; avoid CLS.
- CTA Unification: Normalize to "Get My Quote" across sections and header.

#### Section-by-Section

1. Header & Navigation

- Add primary CTA button (Get My Quote) right-aligned; intersection active-section highlighting (hook `useActiveSection`).
- Mobile: focus trap and aria-controls; lock scroll when open; analytics for menu open/close.

2. Hero

- Ensure Next/Image with explicit dimensions; priority for LCP.
- Keep two CTAs; audit alt text; add Reveal wrapper.

3. How It Works

- Add checklist "What you’ll get every visit"; refine icons and concise copy.
- Use `Reveal` for step cards.

4. Quote Form

- Inline validation; estimated price updates (use `lib/priceEstimator.ts`).
- Hidden UTM fields (utm_source, utm_medium, utm_campaign).
- Consent checkbox for anonymized stool photos (informational only).
- Keyboard navigation + success/edge states.

5. Text & Email Updates (split from quote section)

- Add dedicated section: left copy, right mock phone frame image (Next/Image).
- Mention day-of arrival, completion, secure gate status.

6. Why It Matters

- Keep content; ensure secondary CTA links to `#insights`; small refinements to tokens and motion.

7. Trends Preview

- Extract preview into `sections/TrendsPreview.tsx`; include legend dots and micro-badge.
- Clarify informational-only copy.

8. Services

- Keep three cards, refine tokens; add small bullet lists; add-ons clearly marked.

9. Pricing

- Add toggle Weekly / Every-other week (if supported) with immediate price updates.
- Unify CTA: Get My Quote; ensure disclaimers small print.

10. Eco Impact

- Replace static numbers with `useInViewCountUp` and units; add fine print.

11. Carousel

- Ensure accessible buttons, roving tabindex, lazy-load offscreen slides, `aria-live="polite"` for changes.

12. Community-Backed Science

- Privacy chips + short opt-in explainer; link to privacy page; Data Consent Modal component trigger from Quote.

13. Testimonials

- Keep 3–5 authentic quotes; option to add static stars; CTA to quote.

14. FAQ

- Add schema.org FAQ markup; ensure headings and keyboard nav.

15. Footer

- Service areas, hours, contact links; legal: non-diagnostic disclaimer; privacy/terms links.

#### Implementation Checklist

- [ ] Create `app/styles/tokens.css` and import in `app/layout.tsx`
- [ ] Build `components/Reveal.tsx`
- [ ] Add `lib/analytics.ts` and wire core CTAs with `track`
- [ ] Add `hooks/useActiveSection.ts` for nav highlighting
- [ ] Add `lib/priceEstimator.ts` and wire `QuoteForm`
- [ ] Replace hero image with `next/image` (width/height/priority)
- [ ] Unify CTA labels to "Get My Quote"
- [ ] Extract TrendsPreview to `components/sections/TrendsPreview.tsx`
- [ ] Add Text & Email Updates section
- [ ] Add FAQ schema JSON-LD
- [ ] Add LocalBusiness/Offer JSON-LD
- [ ] Verify a11y and Lighthouse ≥ 90 across categories

