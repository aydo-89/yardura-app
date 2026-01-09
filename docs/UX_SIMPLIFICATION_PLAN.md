# Mobile App UX Simplification Plan

## Executive Summary

This document provides a comprehensive analysis of the InsightScoop native app's customer-facing screens (Home, Service, Wellness, Account) with research-backed recommendations for simplifying the UI while preserving all functionality.

**Core Problem:** The current screens suffer from cognitive overload—too many elements competing for attention, excessive scrolling, redundant options, and unclear information hierarchy.

---

## Research Foundation: Mobile UX Best Practices

### Key Principles from Industry Research

1. **Miller's Law**: Users can hold 7±2 items in working memory. Screens should limit visible choices to ~5-7 at once.

2. **Hick's Law**: Decision time increases logarithmically with the number of choices. Reduce options visible at once.

3. **Progressive Disclosure**: Show only essential information initially; reveal details on demand.

4. **F-Pattern/Z-Pattern Reading**: Users scan in predictable patterns—place primary actions where eyes naturally land.

5. **Thumb Zone Design**: 75% of mobile interactions use a single thumb. Critical actions should be in the comfortable reach zone (bottom 2/3 of screen).

6. **Visual Hierarchy**: Use size, color, and spacing to guide attention. One primary CTA per screen.

7. **Cognitive Load Theory**: Minimize extraneous load (confusing UI) to maximize germane load (actual tasks).

### Industry Benchmarks

| App | Key UX Pattern |
|-----|----------------|
| **Duolingo** | One primary action per screen, playful micro-interactions |
| **Headspace** | Calming empty space, progressive disclosure |
| **Peloton** | Clear status at top, action at bottom |
| **Apple Health** | Summary cards that expand, data visualization |
| **Fitbit** | Single metric focus with drill-down |

---

## Current State Analysis

### Screen-by-Screen Breakdown

---

### 1. HOME SCREEN (`index.tsx`)
**Lines of Code:** 861
**State Variables:** 15+

#### Current Issues

| Problem | Severity | User Impact |
|---------|----------|-------------|
| Hero section competes with quick actions | Medium | Unclear primary focus |
| 4 quick action cards + 2 quick links = 6 immediate choices | Medium | Decision paralysis |
| Snapshot grid duplicates info from hero pills | Low | Redundant information |
| Check-in card buried below scroll | High | Misses critical weekly action |
| Weather pill and weather link both present | Low | Redundant paths |

#### Current Structure
```
[Hero: Greeting, Location, Pills, Pack]
[Quick Actions: 4 cards]
[Quick Links: Reminders, Weather]
[Snapshot: 4 tiles]
[Check-in Card]
```

#### Recommended Structure
```
[Compact Hero: Greeting + Status Pill]
[Weekly Check-in CTA (if pending)] ← Elevated priority
[Today's Summary: 2-3 key metrics]
[Quick Actions: 2x2 grid, collapsed]
[Weather Alert (only if alert exists)]
```

#### Key Changes
1. **Elevate weekly check-in** to top if pending (most time-sensitive action)
2. **Collapse pack info** into tappable avatar stack (expand on tap)
3. **Merge snapshot and hero pills** into unified status row
4. **Hide weather unless alert** — move to pull-down or subtle indicator
5. **Reduce quick actions** to 2 primary (Scan, Chat) with "More" expansion

---

### 2. SERVICE/VISITS SCREEN (`visits.tsx`)
**Lines of Code:** 1,406
**State Variables:** 25+

#### Current Issues

| Problem | Severity | User Impact |
|---------|----------|-------------|
| Plan cards show when no service, but take full scroll | Medium | Long scroll to actions |
| Past visits list is verbose | Low | Information overload |
| Three modals (reschedule, skip, rating) with similar structure | Low | Code complexity |
| Visit cards have 5+ metadata rows each | Medium | Hard to scan |

#### Current Structure
```
[Hero: Title + Subtitle]
[Primary Visit Card OR Plan Cards]
[Service Plan Link]
[Poop Map Link]
[Upcoming Visits List]
[Past Visits List]
[3 Modals]
```

#### Recommended Structure
```
[Compact Hero: "Service" + status badge]
[Next Visit Card (prominent, actionable)]
  └── Inline actions: Reschedule | Skip
[Timeline: Compressed upcoming dots]
  └── Tap to expand individual visit
[History: Collapsible section]
  └── Shows only unrated visits prominently
[Bottom Sheet for Reschedule/Skip/Rate]
```

#### Key Changes
1. **Compact the hero** to a single line with status badge
2. **Inline reschedule/skip actions** on the card (no modal for simple actions)
3. **Use timeline visualization** instead of card list for upcoming visits
4. **Auto-surface unrated visits** with subtle prompt
5. **Use bottom sheet** instead of centered modals (better for mobile thumb reach)

---

### 3. WELLNESS SCREEN (`wellness.tsx`) ⚠️ HIGHEST PRIORITY
**Lines of Code:** 1,994
**State Variables:** 30+

#### Current Issues

| Problem | Severity | User Impact |
|---------|----------|-------------|
| **12+ distinct sections** requiring extensive scroll | Critical | Overwhelming |
| Toolkit with 8-9 items expands inline | High | Pushes content down |
| Three separate stacked bar charts (Color, Consistency, Content) | Medium | Visual noise |
| Weekly pulse + Trend analytics + Risk score = redundant trend info | Medium | Confusion |
| Flags section, sample insights, and check-ins all show similar data | High | Redundancy |
| Hero has metrics + button + helper text | Medium | Cluttered header |

#### Current Structure (requiring 10+ scrolls)
```
[Hero: Title, Status, Metrics (3), Check-in Button, Helper]
[Flags to Review Card]
[Access Tag (Plan Info)]
[Weather Alert]
[Wellness Toolkit (8 items)]
[Upgrade Card]
[Weekly Pulse (4 bars)]
[Trend Analytics Card]
[Sample Profile: 3 Charts]
[Latest Sample Insights (5 cards)]
[Weekly Check-ins Section]
[Risk Score Card]
```

#### Recommended Structure
```
[Tab Bar: Overview | Samples | Tools]

--- OVERVIEW TAB (default) ---
[Wellness Score Ring + Status]
  └── "92 - Healthy" with trend arrow
[Alert Banner (if flags exist)]
  └── Tap to view flags
[This Week Summary]
  └── Samples: 4 | Flags: 0 | Check-in: ✓
[Quick Actions: 2 primary CTAs]
  └── Scan Stool | Weekly Check-in

--- SAMPLES TAB ---
[Filter Chips: All | Flagged]
[Sample Cards: Compact, expandable]
  └── Date, Status Dot, Tap to expand

--- TOOLS TAB ---
[Tool Grid: 6 items]
  └── Food Log, Walks, Reminders, Poop Map, Stool Library, AI Chat
[Premium Upsell (if free)]
```

#### Key Changes
1. **Add tab navigation** to split content into digestible chunks
2. **Single wellness score** as hero metric (replaces multiple scattered stats)
3. **Collapse toolkit** to dedicated tab (not inline expansion)
4. **Merge redundant trend displays** into one "Trends" drill-down
5. **Flags as alert banner** that links to detail view
6. **Remove inline upgrade card** — move to Tools tab or Account

---

### 4. ACCOUNT SCREEN (`account.tsx`)
**Lines of Code:** 1,919
**State Variables:** 40+

#### Current Issues

| Problem | Severity | User Impact |
|---------|----------|-------------|
| 8 distinct card sections | High | Long scroll |
| Email Reports card has 7+ toggle options | Critical | Overwhelming complexity |
| Privacy card has multiple toggles and choice chips | Medium | Decision fatigue |
| Dog modal has "advanced details" toggle but still shows 4 basic + 6 advanced fields | Medium | Complex form |
| Care Credits card has 4 sub-elements | Medium | Verbose |

#### Current Structure
```
[Hero: Account title]
[Service Address Card]
[Pet Profiles Section]
[Roles Card]
[Appearance Card]
[Notifications Card]
[Email Reports Card (VERY LONG)]
[Care Credits Card]
[Privacy Card]
[Sign Out]
```

#### Recommended Structure
```
[Profile Header: Avatar, Name, Email]
  └── Tap for full profile edit

[Pets Section: Horizontal scroll avatars]
  └── Tap avatar to edit, + to add

[Settings Groups (Collapsible)]
├── Notifications → Toggle + "More options"
├── Reports → Toggle + "Configure"
├── Privacy → Link to settings sheet
└── Appearance → Inline 3-button toggle

[Care Credits: Compact inline]
  └── "1,250 credits" + "Redeem" link

[Account Actions]
├── Switch Role (if multi-role)
├── Become a Scooper (if applicable)
└── Sign Out
```

#### Key Changes
1. **Collapse settings into groups** with expand-on-tap
2. **Email Reports: Single toggle visible**, detail screen for configuration
3. **Pets as horizontal avatars** (compact, familiar pattern from social apps)
4. **Care Credits as inline stat** with action link
5. **Move appearance toggle inline** (it's just 3 options)

---

### 5. FOOD/TREAT/MED LOG (`wellness-food-log.tsx`) ⚠️ CRITICAL REFACTOR
**Lines of Code:** 4,173 (!!)
**State Variables:** 70+ (!!)

This is the most complex screen in the entire app and needs fundamental restructuring.

#### Current Issues

| Problem | Severity | User Impact |
|---------|----------|-------------|
| 3 modes (SCAN, LOG, INVENTORY) with different UIs | Critical | Confusing navigation |
| 2-step log flow with multiple sub-states | High | Complex mental model |
| Multi-select product system | Medium | Power user feature adding complexity |
| Schedule management inline with logging | High | Mixed concerns |
| 70+ state variables | Critical | Maintenance nightmare |
| Calendar view + log history + inventory all in one screen | Critical | Information overload |

#### Current Structure
```
[Mode Tabs: Quick Scan | Log | Inventory]
[Dog Selector]
[Content varies by mode...]
  - SCAN: Camera/paste, analysis results
  - LOG: 2-step wizard (Items → Details)
  - INVENTORY: Product list, schedules
[Multiple Modals for editing]
```

#### Recommended Structure
```
--- SPLIT INTO 3 SCREENS ---

1. FOOD LOG (Main Entry Point)
   [Today's Log: Timeline view]
   [+ Log Meal/Treat/Med FAB]
     └── Opens bottom sheet with type selection
   [Recent Items: Quick re-log chips]

2. SCAN FOOD (Separate Screen)
   [Camera Viewfinder]
   [Paste Ingredients Button]
   [Results + Save Flow]

3. PANTRY/INVENTORY (Separate Screen)
   [Product Cards with Schedule Badges]
   [+ Add Product]
   [Schedule Management as drill-down]
```

#### Key Refactoring Steps
1. **Split into 3 separate route files** (~1,000-1,500 lines each)
2. **Extract shared state** to context or Zustand store
3. **Use bottom sheet** for log entry (not multi-step wizard)
4. **Move schedules to Pantry screen** with dedicated management
5. **Simplify multi-select** — make it opt-in power mode

---

## Design System Recommendations

### Component Patterns to Introduce

#### 1. Collapsible Section
```tsx
<CollapsibleSection title="Email Reports" defaultOpen={false}>
  {/* Full settings UI */}
</CollapsibleSection>
```

#### 2. Quick Action FAB
Floating action button for primary actions (Scan, Log, Check-in)

#### 3. Bottom Sheet
Replace centered modals with bottom sheets for better thumb reach

#### 4. Summary Card
Standardized card showing single metric with trend indicator

#### 5. Timeline View
For visits and logs—more scannable than stacked cards

### Information Architecture Changes

```
BEFORE:
Home → [Everything visible]
Wellness → [12 sections, extreme scroll]
Account → [8 cards]

AFTER:
Home → [Status + Primary CTA + Summary]
Wellness → [Tabs: Overview | Samples | Tools]
Account → [Grouped Settings + Quick Actions]
```

---

## Implementation Phases

### Phase 1: Quick Wins (1-2 days each)
- [ ] Add tab navigation to Wellness screen
- [ ] Collapse Email Reports section in Account
- [ ] Elevate check-in CTA on Home when pending
- [ ] Convert modals to bottom sheets

### Phase 2: Screen Refactors (3-5 days each)
- [ ] Restructure Home screen layout
- [ ] Simplify Wellness Overview tab
- [ ] Create Wellness Samples tab
- [ ] Create Wellness Tools tab
- [ ] Refactor Account into collapsible groups

### Phase 3: Major Refactors (1-2 weeks)
- [ ] Split Food Log into 3 screens
- [ ] Extract shared state to stores
- [ ] Create reusable CollapsibleSection component
- [ ] Implement Timeline view for visits

### Phase 4: Polish (ongoing)
- [ ] Add micro-interactions
- [ ] Refine animations
- [ ] A/B test new layouts
- [ ] Gather user feedback

---

## Metrics to Track

| Metric | Current Baseline | Target |
|--------|-----------------|--------|
| Scroll depth on Wellness | ~10 scrolls | ≤3 scrolls |
| Time to complete check-in | TBD | -30% |
| Food log abandonment rate | TBD | -50% |
| Settings confusion support tickets | TBD | -40% |

---

## Appendix: Screen Complexity Scores

| Screen | Lines | State Vars | Sections | Complexity Score |
|--------|-------|------------|----------|------------------|
| Home | 861 | 15 | 5 | Medium |
| Visits | 1,406 | 25 | 6 | Medium-High |
| Wellness | 1,994 | 30 | 12 | **Critical** |
| Account | 1,919 | 40 | 8 | High |
| Food Log | 4,173 | 70+ | 10+ | **Critical** |

---

## Next Steps

1. Review this document and prioritize phases
2. Create detailed wireframes for Phase 1 changes
3. Set up analytics to capture baseline metrics
4. Begin implementation with Wellness tab navigation
5. Iterate based on user testing feedback

---

*Document prepared for InsightScoop mobile app UX simplification initiative*
*Last updated: January 9, 2026*

