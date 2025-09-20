# Yardura Service OS - Codebase Survey & Analysis

**Date:** September 11, 2025  
**Analysis Phase:** Complete  
**Next Phase:** Dual DB Setup & Migration Preparation

---

## Executive Summary

This document provides a comprehensive analysis of the existing Yardura codebase in preparation for the full Yardura Service OS implementation. The current application is a well-structured Next.js 15 app with SQLite database, featuring a production-ready quote/onboarding flow and basic client portal.

**Key Findings:**

- ✅ **Production-Ready Foundation**: Next.js 15, TypeScript strict, comprehensive tooling
- ✅ **Stable Quote System**: 8-step wizard with pricing logic, form protection, and email notifications
- ✅ **Database Ready**: Prisma schema with 19+ models, multi-tenant structure already in place
- ⚠️ **SQLite → Postgres Migration Required**: Current data volume minimal (1 user, 1 service visit)
- ⚠️ **Feature Gaps**: Missing dispatch/routing, field tech PWA, billing engine

**Compatibility Contract:** Quote wizard and client portal semantics must remain unchanged during migration.

---

## 1. Project Structure Survey

### Directory Structure

```
yardura_commercial/
├── src/app/                          # Next.js App Router (19 routes)
│   ├── api/                          # 15 API routes (auth, billing, data, stripe)
│   ├── dashboard/                    # Client portal (1 page)
│   ├── quote/                        # Quote wizard (1 page, 8 steps)
│   ├── signin|signup|account/        # Auth pages
│   └── insights|services|contact/    # Marketing pages
├── src/components/                   # 50+ React components
│   ├── quote/                        # QuoteWizard + 8 step components
│   ├── dashboard/                    # Portal tabs (Overview, Wellness, etc.)
│   ├── ui/                           # 17 shadcn/ui components
│   └── auth|stripe|seo/              # Feature-specific components
├── src/lib/                          # Core utilities (15 modules)
│   ├── priceEstimator.ts             # Complex pricing logic (700+ lines)
│   ├── auth.ts                       # NextAuth configuration
│   ├── stripe.ts                     # Payment processing
│   └── prisma.ts                     # Database client
├── prisma/                           # Database layer
│   ├── schema.prisma                 # 19 models, comprehensive schema
│   └── dev.db                        # SQLite (208KB, minimal data)
└── public/                           # Static assets (20 images, QR codes)
```

### Key Architecture Patterns

- **App Router**: Modern Next.js routing with server/client components
- **Component Organization**: Feature-based structure (quote/, dashboard/, auth/)
- **Utility Libraries**: Centralized business logic in `/lib`
- **Type Safety**: TypeScript strict mode, comprehensive interfaces
- **Styling**: Tailwind + shadcn/ui + custom brand colors

---

## 2. Dependency & Configuration Audit

### Core Framework Stack

```json
{
  "next": "^15.5.2", // Latest stable
  "react": "18.2.0", // Stable version
  "typescript": "^5", // Latest
  "@prisma/client": "^6.15.0", // Latest
  "prisma": "^6.15.0" // Latest
}
```

### Key Dependencies Analysis

- ✅ **NextAuth 4.24**: Email + OAuth + credentials, role-based access
- ✅ **Stripe 18.4**: Full payment processing, webhooks
- ✅ **Framer Motion 12.23**: Animations (optimized bundle splits)
- ✅ **Zod 4.1**: Runtime validation, form protection
- ✅ **Tailwind 3.4**: Custom brand colors, shadcn/ui integration
- ✅ **Resend 6.0**: Email notifications (SMTP fallback)

### Configuration Files

- ✅ **TypeScript**: Strict mode, path aliases (`@/*`)
- ✅ **Tailwind**: Custom brand palette, responsive design
- ✅ **Next.js**: Performance optimizations, security headers
- ⚠️ **ESLint**: Uses Next.js defaults (no custom config found)
- ⚠️ **Prettier**: Uses defaults (no custom config found)

### Development Tools

- ✅ **Vitest**: Unit testing framework
- ✅ **Husky**: Git hooks for linting
- ✅ **Bundle Analyzer**: Performance monitoring
- ✅ **Lighthouse CI**: Performance auditing

---

## 3. Data Layer Audit

### Database Overview

- **Provider**: SQLite (file-based)
- **ORM**: Prisma 6.15 (latest)
- **Size**: 208KB database file
- **Migration**: Single migration (2025-09-05)

### Schema Analysis

#### Core Models (Authentication & Users)

```prisma
model User {          // 1 record
  id, email, name, phone, address, zipCode
  role: CUSTOMER|SALES_REP|ADMIN|TECH|OWNER
  stripeCustomerId, salesRepId, commissionRate
  // Relations: dogs, serviceVisits, dataReadings
}

model Account {       // NextAuth OAuth accounts
model Session {       // NextAuth sessions
model VerificationToken { // Email verification
```

#### Domain Models (Business Logic)

```prisma
model Dog {           // 0 records
  name, breed, age, weight, userId
  // Relations: dataReadings, orgId, customerId
}

model ServiceVisit {  // 1 record
  scheduledDate, status, serviceType, yardSize
  dogsServiced, notes, deodorize, litterService
  // Relations: user, dataReadings, commissions
}

model DataReading {   // 0 records (Raspberry Pi sensor data)
  weight, volume, color, consistency, temperature
  methaneLevel, location, deviceId
  // Relations: user, dog, serviceVisit
}
```

#### Multi-Tenant Models (Future Operations)

```prisma
model Org {           // 1 record (multi-tenant root)
  name, slug, users[], customers[], devices[]
  jobs[], dogs[], samples[], alerts[]
}

model Customer {      // 0 records (business customers)
model Job {           // 0 records (recurring services)
model Device {        // 0 records (IoT devices)
model Sample {        // 0 records (waste analysis samples)
model Alert {         // 0 records (health/wellness alerts)
```

#### Financial Models

```prisma
model Commission {    // Sales rep commissions
model EcoStat {       // Environmental impact tracking
model BillingSnapshot { // Subscription snapshots
model GlobalStats {   // Aggregate statistics
```

### Data Volume Assessment

```sql
-- Current Row Counts (2025-09-11)
Users: 1              -- Single test user
Dogs: 0               -- No dog profiles yet
ServiceVisits: 1      -- One test service visit
DataReadings: 0       -- No sensor data yet
Orgs: 1               -- Single organization
Customers: 0          -- No business customers
Jobs: 0               -- No recurring jobs
Samples: 0            -- No waste analysis
Alerts: 0             -- No health alerts
```

### Database Performance Considerations

- ✅ **Indexes**: Comprehensive indexing on foreign keys and compound queries
- ✅ **Relations**: Well-normalized schema with proper foreign key constraints
- ⚠️ **SQLite Limitations**: No concurrent writes, limited scalability
- ✅ **Migration Ready**: Schema already supports multi-tenant operations

---

## 4. API Routes & Routing Map

### App Router Structure

```
src/app/
├── page.tsx                    # Landing page (/)
├── quote/page.tsx             # Quote wizard (/quote)
├── dashboard/page.tsx         # Client portal (/dashboard)
├── signin/page.tsx            # Authentication (/signin)
├── signup/page.tsx            # Registration (/signup)
├── account/page.tsx           # Account settings (/account)
├── insights/page.tsx          # Wellness insights (/insights)
├── services/page.tsx          # Services page (/services)
├── contact/page.tsx           # Contact form (/contact)
└── api/                       # 15 API endpoints
```

### API Routes Inventory

```typescript
// Authentication & Users
/api/auth/[...nextauth]        # NextAuth handler
/api/auth/signup               # User registration

// Billing & Payments
/api/billing/link              # Stripe customer portal
/api/billing/portal/me         # Portal configuration

// Data & Analytics
/api/dashboard/kpis            # Dashboard metrics
/api/data                      # Generic data endpoint
/api/insights/trends           # Wellness trends
/api/reports/monthly           # Monthly reports
/api/stats                     # Statistics endpoint

// Business Operations
/api/dogs                      # Dog profile management
/api/service-visits            # Service visit CRUD
/api/users                     # User management

// External Integrations
/api/stripe/                   # 8 Stripe webhooks/endpoints
/api/quote                     # Quote submission
/api/og                        # OpenGraph images
/api/health                    # Health check
/api/ingest                    # Data ingestion
/api/score                     # Scoring/AI analysis
/api/schedule                  # Scheduling operations
```

### Middleware Configuration

```typescript
// middleware.ts
- Admin routes: /admin/*, /api/admin/*
- Sales rep routes: /sales-rep/*, /api/sales-rep/*
- Protected routes: Stripe charge, cancel/reschedule
- Authentication: NextAuth token validation
- Role-based access: Admin email whitelist + DB roles
- Development bypass: Allows testing without full auth
```

---

## 5. UI Components & User Experience

### Landing Page (`/`)

- **Hero Section**: Compelling value proposition, CTA to quote
- **Differentiators**: Key benefits (eco-friendly, tech-enabled, health insights)
- **Services**: Service offerings with pricing preview
- **Pricing**: Transparent pricing structure
- **Eco Impact**: Environmental benefits showcase
- **Insights Preview**: Wellness dashboard teaser
- **FAQ**: Common questions and answers
- **Contact**: Lead capture form

### Quote Wizard (`/quote`)

**8-Step Process** (Production-Critical - Must Remain Unchanged):

1. **StepBasics**: Service type, dog count, yard size
2. **StepServiceType**: Residential vs Commercial
3. **StepFrequency**: Weekly, bi-weekly, one-time
4. **StepCustomization**: Add-ons (deodorize, extra areas)
5. **StepWellness**: Health insights opt-in
6. **StepZipCheck**: Service area validation
7. **StepContactReview**: Contact information
8. **StepCommercialContact**: Commercial-specific details

**Key Features**:

- ✅ **Pricing Calculator**: Real-time pricing updates
- ✅ **Form Protection**: reCAPTCHA, rate limiting, bot detection
- ✅ **Address Autocomplete**: Google Places integration
- ✅ **Email Notifications**: Resend integration with fallbacks
- ✅ **Validation**: Zod schemas, comprehensive error handling

### Client Portal (`/dashboard`)

**Tab-Based Interface**:

- **Overview**: Service history, upcoming visits, profile completion
- **Wellness**: Health insights, trends, alerts
- **Services**: Service history, scheduling, modifications
- **Eco**: Environmental impact, waste diverted metrics
- **Billing**: Payment methods, invoices, subscriptions
- **Profile**: Account settings, dog profiles, preferences

**Current State**: Using mock data for development, minimal real data

---

## 6. Business Logic & Pricing

### Pricing Structure

**Base Rates** (Weekly Service):

- Small yard (< 1/4 acre): $20/visit
- Medium yard (1/4 - 1/2 acre): $22/visit
- Large yard (1/2 - 1 acre): $24/visit
- XL yard (> 1 acre): Custom quote

**Frequency Multipliers**:

- Weekly: 1.0x (base rate)
- Bi-weekly: 1.3x
- Twice-weekly: 1.8x
- One-time: 1.5x + $89 setup

**Add-ons**:

- Deodorize: +$5/visit
- Extra areas: +$3-5/area
- Commercial properties: Custom pricing

### Wellness Insights System

- **3Cs Analysis**: Color, Consistency, Content analysis
- **Trend Tracking**: Weight, moisture, frequency patterns
- **Health Alerts**: Significant changes, veterinary recommendations
- **Privacy Controls**: Opt-in data collection, anonymized reporting

### Commission System

- **Sales Rep Structure**: Hierarchical referrals, commission rates
- **Payment Tracking**: Pending → Paid status flow
- **Performance Metrics**: Commission totals, customer acquisition

---

## 7. Runtime Behaviors & Invariants

### Critical User Flows (Must Preserve)

#### Quote → Onboarding Flow

1. **Quote Submission**: Form validation, spam protection, email notification
2. **Lead Qualification**: ZIP code validation, service area check
3. **Pricing Calculation**: Real-time updates, add-on pricing
4. **Contact Collection**: Progressive disclosure, consent management

#### Client Portal Experience

1. **Dashboard Overview**: Profile completion, service history, upcoming visits
2. **Wellness Insights**: Health trends, alerts, educational content
3. **Service Management**: Schedule changes, add-on modifications
4. **Billing Management**: Payment methods, invoice history

### Performance Characteristics

- **Lighthouse Scores**: Configured for CI monitoring
- **Bundle Optimization**: Vendor chunks, Framer Motion separation
- **Image Optimization**: WebP/AVIF, responsive sizing
- **Caching Strategy**: Static assets cached, dynamic content optimized

### Security Measures

- **Authentication**: NextAuth with multiple providers
- **Authorization**: Role-based access control
- **Data Protection**: Form validation, rate limiting
- **Payment Security**: Stripe Elements, no PAN storage

---

## 8. Risk Register & Compatibility Plan

### High-Risk Areas

#### 🚨 SQLite → Postgres Migration

**Risk**: Data corruption, downtime, breaking changes
**Impact**: Complete service disruption
**Mitigation**:

- Feature flags for read/write toggles
- Dual database setup during transition
- Comprehensive testing of all data flows
- Rollback plan with backups

#### 🚨 Quote Wizard Compatibility

**Risk**: Breaking existing quote flow during refactoring
**Impact**: Lost leads, customer confusion
**Mitigation**:

- Preserve exact step sequence and validation
- Maintain pricing calculation logic
- Keep API contract unchanged
- Extensive E2E testing before deployment

#### 🚨 Client Portal Semantics

**Risk**: Dashboard changes break user expectations
**Impact**: Poor user experience, support burden
**Mitigation**:

- Preserve tab structure and navigation
- Maintain data presentation formats
- Keep wellness insights terminology
- User acceptance testing

### Medium-Risk Areas

#### ⚠️ Multi-Tenant Operations

**Risk**: Permission leaks, data isolation failures
**Impact**: Privacy violations, incorrect billing
**Mitigation**:

- Comprehensive RLS policies
- Tenant-scoped queries
- Audit logging
- Penetration testing

#### ⚠️ Real-time Features

**Risk**: WebSocket connection issues, offline sync failures
**Impact**: Field tech productivity loss
**Mitigation**:

- Progressive enhancement
- Offline-first architecture
- Background sync with conflict resolution
- Extensive device testing

### Feature Flag Strategy

```typescript
// Proposed feature flags
{
  USE_POSTGRES: process.env.USE_POSTGRES === 'true',
  ENABLE_DISPATCH: process.env.ENABLE_DISPATCH === 'true',
  ENABLE_FIELD_PWA: process.env.ENABLE_FIELD_PWA === 'true',
  ENABLE_BILLING_V2: process.env.ENABLE_BILLING_V2 === 'true',
  ENABLE_MULTI_TENANT: process.env.ENABLE_MULTI_TENANT === 'true'
}
```

---

## 9. Migration Roadmap

### Phase 0.5: Dual Database Setup

1. **Add Postgres Datasource**: Beside existing SQLite
2. **Generate Migration**: Prisma diff for Postgres schema
3. **Data Export Plan**: SQLite → CSV/NDJSON scripts
4. **Import Scripts**: Postgres COPY commands
5. **Feature Flags**: Read/write toggles per model

### Phase 1: Foundation Preservation

1. **Preserve Quote Flow**: Exact 1:1 reproduction
2. **Client Portal**: Maintain current semantics
3. **Authentication**: Keep NextAuth configuration
4. **Testing**: Contract tests for critical paths

### Phase 2-14: Feature Implementation

- Follow Master Build Checklist phases
- Maintain backward compatibility
- Gradual feature rollout with monitoring

---

## 10. Recommendations

### Immediate Actions (Phase 0.5)

1. **Set up Postgres**: Local development environment
2. **Create Migration Scripts**: Automated data transfer
3. **Implement Feature Flags**: Gradual rollout capability
4. **Establish Monitoring**: Performance baselines, error tracking

### Development Priorities

1. **Preserve Critical Flows**: Quote wizard, client portal
2. **Database Migration**: Safe, reversible transition
3. **Testing Infrastructure**: Unit, E2E, contract tests
4. **Documentation**: API specs, runbooks, troubleshooting

### Risk Mitigation

1. **Compatibility Contract**: Formal agreement on preserved behaviors
2. **Gradual Rollout**: Feature flags for all new functionality
3. **Rollback Plan**: Tested procedures for reverting changes
4. **User Communication**: Transparent updates, support channels

---

## Conclusion

The existing Yardura codebase provides an excellent foundation for the full Service OS implementation. The architecture is modern, well-structured, and production-ready. The primary challenges are the database migration and maintaining compatibility with existing critical user flows.

**Next Steps:**

1. Complete dual database setup
2. Implement feature flags
3. Begin Phase 1 development with preserved quote/client portal
4. Establish comprehensive testing and monitoring

The codebase is well-positioned for the ambitious Service OS vision while maintaining stability for current operations.

---

**Analysis Complete** ✅  
**Ready for Phase 0.5: Dual DB Setup**
