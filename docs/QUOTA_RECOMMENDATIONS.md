# Google Maps API Quota Adjustment Recommendations

## Current Quota Analysis

### Distance Matrix API (ComputeRouteMatrix)
**Current:**
- Per-element per day: **150** (10.67% used = 16 elements)
- Per-element per minute: **50** (0% used)

**Problem:** 
- Distance Matrix API counts **elements**, not requests
- 34 visits = 34×34 = **1,156 elements** for full matrix
- Plus start anchor: 1×34 = **34 elements**
- Plus end anchor: 34×1 = **34 elements**
- **Total: ~1,224 elements per optimization**
- Current quota of **150/day** is way too low!

**Recommended:**
- Per-element per day: **50,000** (up from 150)
- Per-element per minute: **1,000** (up from 50)

### Routes API (ComputeRoutes)
**Current:**
- Per request per day: **500** (4.2% used = 21 requests) ✅
- Per request per minute: **150** (5.67% used = 8.5) ✅

**Status:** These are fine, but could increase slightly for safety

**Recommended:**
- Per request per day: **1,000** (up from 500) - safety buffer
- Per request per minute: **200** (up from 150) - peak load safety

### Geocoding API (v4)
**Current:**
- All geocoding APIs: **500/day, 20/min** (0% used)

**Status:** ✅ These are fine - mostly cached, very low usage

**Recommended:** No change needed (keep at 500/day, 20/min)

## Summary of Changes Needed

### ✅ Already Set Correctly

| API | Quota Type | Current | Status |
|-----|------------|---------|--------|
| **Legacy Distance Matrix** | Elements per day | 50,000 | ✅ Good |
| **Legacy Distance Matrix** | Elements per minute | 1,000 | ✅ Good |
| **Legacy Distance Matrix** | Elements per minute per user | 2,000 | ✅ Good |
| **Routes (ComputeRoutes)** | Per request per day | 1,000 | ✅ Good |
| **Routes (ComputeRoutes)** | Per request per minute | 200 | ✅ Good |
| **Geocoding** | All v4 APIs | 500/day, 20/min | ✅ Good |

### ⚠️ Needs Fix

| API | Quota Type | Current | Recommended | Why |
|-----|------------|---------|-------------|-----|
| **ComputeRouteMatrix** | Per-element per day | 1,000 | **50,000** | Too low for future use |
| **ComputeRouteMatrix** | Per-element per minute | 200 | **1,000** | Too low for peak loads |
| **ComputeRouteMatrix** | Per-element per minute per user | 200 | **2,000** | Can't handle one optimization |

## Current Status

**✅ You're good for current usage!** The legacy Distance Matrix API (which is what we're using) has proper quotas set.

However, if you ever enable ComputeRouteMatrix (the newer API), you'll need to increase those quotas as shown above.

## Why Distance Matrix Needs Major Increase

Distance Matrix API counts **elements** (origin×destination pairs), not requests:
- Each optimization with 34 visits needs **~1,224 elements**
- With caching: 500-1,000 elements/day typically
- Without caching: Could hit 5,000-10,000 elements/day
- Current **150/day** quota can handle less than 1 optimization per day!

## Calculation Example

With your current **150 elements/day** quota:
- ✅ Can handle: ~12 visits (12×12 = 144 elements)
- ❌ Cannot handle: 34 visits (34×34 = 1,156 elements)

With recommended **50,000 elements/day**:
- ✅ Can handle: ~223 visits (223×223 = 49,729 elements)
- ✅ Can handle: 40+ optimizations of 34 visits each
- ✅ Provides safety buffer for peak loads

## Notes

1. **Distance Matrix** is the critical one - it's what's causing `OVER_QUERY_LIMIT` errors
2. **Routes API** is fine but increasing slightly for safety
3. **Geocoding** doesn't need changes (mostly cached, very low usage)
4. Caching reduces actual usage by ~90%, but quotas need to handle peak loads without cache

