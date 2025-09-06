# Analytics & Testing Framework

_Version: 1.0 | Last Updated: January 15, 2024_

## Executive Summary

Comprehensive analytics implementation and A/B testing framework to optimize conversion rates and track SEO/LEO performance. Focus on user journey analytics, conversion attribution, and data-driven optimization.

## Analytics Implementation

### Google Analytics 4 (GA4) Setup

#### GA4 Configuration

```javascript
// lib/analytics.ts - Enhanced tracking
import { track } from '@/lib/analytics';

export const analytics = {
  // Page view tracking
  trackPageView: (page_path: string) => {
    track('page_view', { page_path });
  },

  // Conversion tracking
  trackQuoteStart: (source: string) => {
    track('quote_start', {
      source, // 'hero', 'pricing', 'insights', 'footer'
      timestamp: new Date().toISOString()
    });
  },

  trackQuoteStep: (step: number, data: any) => {
    track('quote_step', {
      step, // 1-3
      has_address: !!data.address,
      has_dogs: !!data.dogs,
      frequency: data.frequency,
      addons: Object.keys(data.addons || {}).filter(k => data.addons[k])
    });
  },

  trackQuoteComplete: (quoteData: any) => {
    track('quote_complete', {
      dogs: quoteData.dogs,
      yard_size: quoteData.yardSize,
      frequency: quoteData.frequency,
      addons_count: Object.values(quoteData.addons || {}).filter(Boolean).length,
      estimated_price: quoteData.estimatedPrice,
      service_area: quoteData.city
    });
  },

  // User engagement tracking
  trackScrollDepth: (depth: number) => {
    track('scroll_depth', { depth_percentage: depth });
  },

  trackTimeOnPage: (page: string, time: number) => {
    track('time_on_page', { page, time_seconds: time });
  },

  // Local SEO tracking
  trackLocalSearch: (query: string, location: string) => {
    track('local_search', { query, location });
  },

  trackGBPClick: (source: string) => {
    track('gbp_click', { source }); // 'footer', 'contact', 'about'
  },

  // Content engagement
  trackBlogRead: (article: string, time: number) => {
    track('blog_read', { article, time_spent: time });
  },

  trackInsightsClick: (source: string) => {
    track('insights_click', { source }); // 'hero', 'footer', 'insights_page'
  }
};
```

#### GA4 Events to Track

**Conversion Events:**

- `quote_start` - User initiates quote process
- `quote_step_1` - Basics form completion
- `quote_step_2` - Contact info completion
- `quote_step_3` - Account creation
- `quote_complete` - Final submission

**Engagement Events:**

- `scroll_depth` - Track user engagement depth
- `time_on_page` - Measure content consumption
- `button_click` - Track CTA performance
- `form_interaction` - Monitor form field engagement

**Local SEO Events:**

- `phone_click` - Track local phone call intent
- `direction_request` - GBP directions clicks
- `local_search` - Minneapolis-specific searches

### Search Console Integration

#### GSC Setup Checklist

- [ ] Verify domain ownership
- [ ] Submit XML sitemap
- [ ] Set up local search queries tracking
- [ ] Configure rich results monitoring
- [ ] Enable Core Web Vitals tracking

#### GSC Custom Events

```javascript
// Track local search performance
track('local_search_query', {
  query: searchQuery,
  location: 'Minneapolis',
  results_position: position,
});
```

### Conversion Funnel Setup

#### Primary Conversion Funnel

```
Homepage Visit → Quote Start → Step 1 → Step 2 → Step 3 → Account Created → Success
```

#### Micro-Conversion Funnels

```
Blog Visit → Insights Click → Quote Start
Pricing Page → Quote Start
Local Search → GBP Profile → Contact
```

## A/B Testing Framework

### Test Planning Template

#### Test Structure

```javascript
interface ABTest {
  id: string;
  name: string;
  hypothesis: string;
  variants: {
    control: React.ComponentType;
    variant: React.ComponentType;
  };
  audience: {
    percentage: number;
    targeting?: {
      location?: string[];
      device?: string[];
      source?: string[];
    };
  };
  metrics: {
    primary: string; // 'quote_completion_rate'
    secondary: string[]; // ['time_on_page', 'bounce_rate']
  };
  duration: number; // days
  status: 'draft' | 'running' | 'completed';
}
```

### Planned A/B Tests

#### Test 1: Hero Headline Optimization

**Hypothesis:** Local-first headlines will increase quote starts by 25%
**Variants:**

- Control: "Poop-free yard. Smarter Insights."
- Variant A: "Clean Yards, Healthy Dogs – Minneapolis"
- Variant B: "Minneapolis Dog Waste Removal Experts"

**Metrics:** Quote starts, time on page, bounce rate

#### Test 2: CTA Button Text

**Hypothesis:** Benefit-focused CTAs convert 20% better
**Variants:**

- Control: "Get My Quote"
- Variant A: "Get Free Minneapolis Quote"
- Variant B: "Start Clean Yard Service"

**Metrics:** Click-through rate, quote completion rate

#### Test 3: Pricing Display

**Hypothesis:** Transparent pricing increases trust and conversions
**Variants:**

- Control: "Starting at $20/visit"
- Variant A: "$20-35/visit (based on yard size)"
- Variant B: "See Minneapolis Pricing"

**Metrics:** Quote starts from pricing section, trust signals

#### Test 4: Trust Signals Placement

**Hypothesis:** Early trust signals reduce anxiety and increase conversions
**Variants:**

- Control: Trust signals after hero
- Variant A: Trust signals in hero
- Variant B: Trust signals as progress indicators

**Metrics:** Conversion rate, form abandonment rate

#### Test 5: Local Content Emphasis

**Hypothesis:** Minneapolis-focused content resonates better locally
**Variants:**

- Control: General Twin Cities messaging
- Variant A: Specific Minneapolis neighborhoods
- Variant B: Local landmarks and proof points

**Metrics:** Local search conversion rate, GBP referrals

### Test Execution Framework

#### Test Implementation

```typescript
// components/ABTest.tsx
'use client';

import { useABTest } from '@/hooks/useABTest';

interface ABTestProps {
  testId: string;
  variants: Record<string, React.ComponentType>;
  fallback?: React.ComponentType;
}

export function ABTest({ testId, variants, fallback }: ABTestProps) {
  const { variant, track } = useABTest(testId);

  const Component = variants[variant] || fallback || variants.control;

  // Track variant exposure
  React.useEffect(() => {
    track('variant_exposed', { variant });
  }, [variant, track]);

  return <Component />;
}
```

#### Test Analytics Integration

```typescript
// Track test performance
track('ab_test_conversion', {
  test_id: 'hero_headline_test',
  variant: 'variant_a',
  conversion_type: 'quote_start',
  user_id: anonymousId,
});
```

## Performance Monitoring

### Core Web Vitals Tracking

#### CWV Implementation

```typescript
// lib/web-vitals.ts
import { track } from './analytics';

export function trackWebVitals(metric: any) {
  track('web_vitals', {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    navigation_type: metric.navigationType,
  });
}

// In _app.tsx or layout.tsx
if (typeof window !== 'undefined') {
  import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
    getCLS(trackWebVitals);
    getFID(trackWebVitals);
    getFCP(trackWebVitals);
    getLCP(trackWebVitals);
    getTTFB(trackWebVitals);
  });
}
```

### SEO Performance Tracking

#### Ranking Tracking

```typescript
// Track keyword rankings
track('seo_ranking', {
  keyword: 'dog waste removal Minneapolis',
  position: 3,
  search_engine: 'google',
  device: 'desktop',
  location: 'Minneapolis, MN',
});
```

#### SERP Features Tracking

```typescript
// Track rich results appearance
track('serp_feature', {
  feature_type: 'local_pack',
  keyword: 'dog waste removal Minneapolis',
  position: 1,
  competitors_count: 2,
});
```

## User Journey Analytics

### Heatmap Integration

#### Hotjar Setup (Recommended)

```javascript
// lib/heatmaps.ts
export const heatmaps = {
  init: () => {
    if (typeof window !== 'undefined') {
      // Hotjar integration
      (function(h,o,t,j,a,r){
        h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
        h._hjSettings={hjid:YOUR_HJID,hjsv:6};
        a=o.getElementsByTagName('head')[0];
        r=o.createElement('script');r.async=1;
        r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
        a.appendChild(r);
      })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
    }
  },

  trackConversion: (step: string) => {
    if (window.hj) {
      window.hj('event', `quote_${step}`);
    }
  }
};
```

### Session Recording Setup

#### Session Recording Integration

- Record 5% of sessions for qualitative analysis
- Focus on high-value user journeys
- Identify friction points in quote flow
- Track mobile vs desktop behavior patterns

## Attribution Modeling

### Multi-Touch Attribution Setup

#### Attribution Model

```typescript
// Track conversion attribution
track('conversion_attribution', {
  conversion_id: 'quote_12345',
  touchpoints: [
    {
      source: 'google',
      medium: 'organic',
      campaign: '(not set)',
      keyword: 'dog waste removal Minneapolis',
      timestamp: '2024-01-15T10:00:00Z',
    },
    {
      source: 'direct',
      page: '/insights/dog-poop-color-health',
      timestamp: '2024-01-15T10:05:00Z',
    },
    {
      source: 'direct',
      page: '/quote',
      timestamp: '2024-01-15T10:10:00Z',
    },
  ],
  conversion_value: 89,
  attribution_model: 'first_click', // or 'last_click', 'linear', etc.
});
```

## Reporting & Dashboard Setup

### Analytics Dashboard Structure

#### Executive Dashboard

- Overall conversion rate
- Revenue attribution
- Customer acquisition cost
- LTV vs CAC ratio

#### Marketing Dashboard

- Campaign performance
- Channel attribution
- SEO rankings
- Local search performance

#### Product Dashboard

- Feature usage
- User flow completion
- Form abandonment rates
- Mobile vs desktop performance

### Automated Reporting

#### Weekly SEO Report

- Keyword ranking changes
- Organic traffic trends
- Local pack performance
- GBP insights summary

#### Monthly Conversion Report

- Conversion rate trends
- A/B test results
- Customer journey analysis
- Revenue attribution breakdown

## Privacy & Compliance

### GDPR & CCPA Compliance

- [ ] Cookie consent management
- [ ] Data retention policies
- [ ] User data export/deletion
- [ ] Privacy policy updates

### Analytics Data Retention

- Event data: 26 months
- User data: 38 months (Google Analytics default)
- Custom retention for sensitive data

## Implementation Timeline

### Phase 1: Foundation (Week 1)

- [ ] GA4 setup and configuration
- [ ] Search Console integration
- [ ] Basic event tracking implementation
- [ ] Privacy compliance setup

### Phase 2: Advanced Tracking (Week 2)

- [ ] Conversion funnel setup
- [ ] Custom event implementation
- [ ] Attribution modeling
- [ ] Heatmap integration

### Phase 3: Testing Framework (Week 3)

- [ ] A/B testing infrastructure
- [ ] Test planning and prioritization
- [ ] Analytics dashboard setup
- [ ] Automated reporting

### Phase 4: Optimization (Ongoing)

- [ ] A/B test execution and analysis
- [ ] Performance monitoring
- [ ] Dashboard maintenance
- [ ] Reporting automation

---

## Success Metrics

### Analytics Implementation KPIs

- **Data Accuracy:** 95%+ event tracking coverage
- **Real-time Monitoring:** <5 minute data latency
- **Conversion Attribution:** 90%+ touchpoint coverage
- **Privacy Compliance:** 100% GDPR/CCPA compliant

### Testing Framework KPIs

- **Test Velocity:** 2-3 tests running simultaneously
- **Statistical Significance:** 95% confidence level
- **Implementation Speed:** <1 week from idea to live
- **Conversion Impact:** 15-25% improvement per quarter

### Overall Analytics ROI

- **Conversion Rate:** +30% through data-driven optimization
- **Customer Acquisition Cost:** -20% through attribution insights
- **Revenue Attribution:** 85%+ of conversions properly attributed
- **Decision Speed:** 50% faster optimization cycles

---

_Comprehensive analytics and testing framework for data-driven growth optimization._
