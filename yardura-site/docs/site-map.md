# Yardura Site Map & Architecture

_Generated: January 15, 2024 | Branch: feat/runbook-full-pass_

## Executive Summary

Current site architecture overview showing all routes, components, and homepage section order. This document serves as the baseline for the runbook optimization phases.

---

## 📁 Directory Structure

### App Routes (`/src/app/`)

```
/                           # Homepage
├── admin/
│   ├── dashboard/         # Admin dashboard
│   └── sales-reps/
│       └── create/        # Sales rep creation
├── api/                   # API routes (auth, stripe, data, etc.)
├── dashboard/             # User dashboard
├── facts/                 # LEO fact sheet page
├── insights/              # Blog/Resources hub
│   └── dog-poop-color-health/ # Cornerstone article
├── quote/                 # Quote stepper flow
│   └── success/           # Quote completion
├── sales-rep/
│   ├── customer-signup/   # Customer signup for reps
│   └── dashboard/         # Sales rep dashboard
├── signin/                # Authentication
├── signup/                # User registration
└── styles/                # CSS tokens
```

### Component Architecture (`/src/components/`)

```
├── admin/                 # Admin-specific components
├── auth/                  # Authentication forms
├── site/                  # Site-wide components
│   ├── AnimatedHeader.tsx # Premium sticky navbar
│   └── ScrollProgress.tsx # Top scroll indicator
├── seo/                   # SEO/structured data
│   └── StructuredData.tsx # Schema markup component
├── ui/                    # Design system primitives
│   ├── button.tsx, card.tsx, input.tsx, etc.
├── community.tsx          # Community-backed science section
├── eco.tsx               # Eco impact counters
├── faq.tsx               # FAQ accordion
├── footer.tsx            # Site footer
├── hero.tsx              # Main hero section
├── insights.tsx          # Health insights dashboard
├── quote-form.tsx        # Quote form component
├── services.tsx          # Services overview
├── site-header.tsx       # Navigation header
├── sticky-cta.tsx        # Floating CTA
├── testimonials.tsx      # Customer testimonials
├── WhyItMatters.tsx      # Stool monitoring rationale
└── yard-carousel.tsx     # Picture-perfect yards carousel
```

---

## 🏠 Homepage Section Order (Current)

**File:** `/src/app/page.tsx`
**Route:** `/`
**Layout:** Single-column with container sections

### Current Section Flow:

```
1. SiteHeader (Navigation)
2. Hero (Main value proposition)
3. Quote Form Section (Conversion attempt - TOO EARLY)
4. Services (Feature overview)
5. Yard Carousel (Visual proof)
6. Eco Impact (Environmental stats)
7. Community (Science backing)
8. Why It Matters (Health rationale - SHOULD BE HIGHER)
9. Insights (Health dashboard - SHOULD BE HIGHER)
10. FAQ (Support)
11. Testimonials (Social proof)
12. Footer (Site links)
13. StickyCTA (Floating action)
```

### Component Mapping:

```tsx
<SiteHeader />              // Navigation
<main>
  <Hero />                  // Section 1
  <section id="quote">      // Section 2 (TOO EARLY)
    <QuoteForm />
  </section>
  <Services />              // Section 3
  <YardCarousel />          // Section 4
  <Eco />                   // Section 5
  <Community />             // Section 6
  <WhyItMatters />          // Section 7 (SHOULD BE ~3)
  <Insights />              // Section 8 (SHOULD BE ~4)
  <FAQ />                   // Section 9
  <Testimonials />          // Section 10
</main>
<Footer />                  // Section 11
<StickyCTA />              // Section 12
```

---

## 🔄 Key User Flows

### Primary Conversion Flow:

```
Homepage → Hero CTA → Quote Form → Account Creation → Success
```

### Secondary Flows:

```
Homepage → Why It Matters → Insights → Quote
Homepage → Services → Pricing → Quote
Homepage → FAQ → Contact → Quote
```

### Navigation Flows:

```
Header → Services → Quote
Header → Insights → Article → Quote
Footer → Contact → Quote
```

---

## 📊 Content Architecture

### Homepage Sections:

- **Hero:** Value prop, trust signals, primary CTA
- **Quote Form:** Early conversion attempt (problematic placement)
- **Services:** Weekly/bi-weekly, add-ons, guarantees
- **Yard Carousel:** Visual proof of clean results
- **Eco Impact:** Environmental statistics with counters
- **Community:** Science-backed methodology
- **Why It Matters:** Health monitoring rationale (KEY DIFFERENTIATOR)
- **Insights:** Health dashboard preview (KEY DIFFERENTIATOR)
- **FAQ:** Common questions and answers
- **Testimonials:** Customer social proof

### Supporting Pages:

- **Quote Flow:** 3-step stepper (Basics → Contact → Account)
- **Facts:** LEO-optimized fact sheet
- **Insights:** Blog/Resources hub with articles
- **Success:** Post-quote confirmation

---

## 🎯 Current IA Issues (Pre-Runbook)

### Critical Issues:

1. **Quote Form Too Early** - Section 2 (should be 5-6)
2. **Why It Matters Too Low** - Section 7 (should be 3-4)
3. **Insights Too Low** - Section 8 (should be 4-5)
4. **Missing Differentiators Section** - No dedicated unique value props

### Conversion Flow Problems:

1. **Trust Before Commitment** - Quote form appears before value demonstration
2. **Features Before Benefits** - Services shown before unique advantages
3. **Social Proof Late** - Testimonials appear after FAQ
4. **No Progressive Disclosure** - All information at once

### SEO/Content Issues:

1. **No Clear Hierarchy** - All sections treated equally
2. **Missing Internal Links** - Limited cross-section navigation
3. **Weak Anchor Text** - Generic "Get Quote" vs descriptive
4. **No Contextual CTAs** - Same CTA everywhere

---

## 🛠️ Technical Architecture

### Framework & Stack:

- **Next.js 14** (App Router)
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **shadcn/ui** for components
- **Lucide React** for icons

### Key Libraries:

- **@radix-ui/\*** - Accessible primitives
- **zod** - Form validation
- **react-hook-form** - Form handling
- **sonner** - Toast notifications
- **next/image** - Optimized images

### Performance Features:

- **Server Components** - Default rendering
- **Client Components** - Interactive elements only
- **Image Optimization** - Next.js built-in
- **Bundle Splitting** - Automatic code splitting

---

## 📈 Analytics & Tracking

### Current Events (Basic):

- Page views
- CTA clicks
- Form interactions
- Quote completions

### Missing Events:

- Scroll depth
- Section engagement
- A/B test variants
- Conversion attribution
- Local search tracking

---

## 🔒 Security & Compliance

### Current Security:

- Basic authentication (NextAuth.js)
- Stripe payment processing
- Form validation
- HTTPS enforcement

### Missing Security:

- CSP headers
- Rate limiting
- Input sanitization
- Privacy compliance
- Error logging

---

## 🚀 Runbook Impact Areas

### Phase 1 (IA Reorganization):

- Move Why It Matters + Insights to positions 3-4
- Add Differentiators section
- Implement A/B testing for section order
- Create quote teaser instead of full form

### Phase 2 (Motion QA):

- Audit all animations for performance
- Verify reduced motion support
- Z-index conflict resolution
- Animation timing optimization

### Phase 3-5 (Performance & Quality):

- Core Web Vitals optimization
- Accessibility compliance
- Design system enforcement
- Bundle size optimization

### Phase 6-7 (SEO & LEO):

- Technical SEO implementation
- Content optimization
- Structured data enhancement
- LEO resource creation

### Phase 8-10 (Content & Local):

- Dynamic OG image generation
- Blog system implementation
- City-specific landing pages
- Local SEO optimization

### Phase 11-18 (Conversion & Systems):

- Quote flow rebuild
- Form security enhancement
- Analytics taxonomy
- A/B testing framework
- Security hardening
- Error state handling
- Referral system
- Final QA and documentation

---

## 📋 Component Dependencies

### Critical Path Components:

- `Hero` → `SiteHeader`, `StickyCTA`
- `QuoteForm` → `QuoteCalculator`, `StripePaymentForm`
- `WhyItMatters` → `Insights`, `Reveal`
- `Insights` → `Eco`, `Testimonials`

### Shared Dependencies:

- All components → `Reveal` (motion wrapper)
- Forms → `ui/*` (shadcn components)
- SEO → `StructuredData` (schema markup)

---

## 🎯 Success Metrics (Post-Runbook)

### Performance Targets:

- **LCP:** <2.5s (mobile)
- **CLS:** <0.1
- **INP:** <200ms
- **Bundle Size:** <500KB

### Conversion Targets:

- **Quote Starts:** +40% (from IA optimization)
- **Completion Rate:** +25% (from flow improvements)
- **Time on Page:** +30% (from content reorganization)

### SEO Targets:

- **Organic Traffic:** +50% (from technical + content SEO)
- **Local Rankings:** Top 3 for primary keywords
- **Rich Results:** 100% eligible pages

### Quality Targets:

- **Accessibility:** 95+ Axe score
- **Performance:** 90+ Lighthouse score
- **SEO:** 100% rich results validation

---

_This site map serves as the baseline for the comprehensive runbook optimization. All subsequent phases will reference and update this document._

