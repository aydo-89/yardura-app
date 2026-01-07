# Testing Google Maps API Quotas

## Current Quota Status ✅

Your quotas are now properly configured:

### Routes API (ComputeRoutes) - **ACTIVE**
- ✅ Per request per day: **50,000** (was 1,000)
- ✅ Per request per minute: **1,000** (was 200)
- ✅ Per request per minute per user: **2,000** (was 200)

**Status:** ✅ Excellent! This API is actively used for route optimization.

### ComputeRouteMatrix API - **DISABLED IN CODE**
- ✅ Per-element per day: **50,000** (was 1,000)
- ✅ Per-element per minute: **1,000** (was 200)
- ✅ Per-element per minute per user: **2,000** (was 200)

**Status:** ✅ Good! These quotas are set correctly but the API is disabled in code due to parsing issues.

**Note:** ComputeRouteMatrix is intentionally disabled in `src/lib/google/maps.ts` (line 566-568) because the response format doesn't match our parser. We're using the legacy Distance Matrix API instead.

### Legacy Distance Matrix API - **ACTIVE (FALLBACK)**
- ✅ Elements per day: **50,000**
- ✅ Elements per minute: **1,000**
- ✅ Elements per minute per user: **2,000**

**Status:** ✅ Perfect! Used as fallback when Routes API can't be used.

## Test Plan

### 1. Clear Caches
```bash
./scripts/clear-google-cache.sh
```

This ensures fresh API calls will hit Google's APIs.

### 2. Start Dev Server with API Tracking
```bash
./scripts/test-quotas.sh
```

Or manually:
```bash
export TRACK_GOOGLE_API_CALLS=true
npm run dev
```

### 3. Test Route Optimization

1. **Log in as a field tech**
   - Navigate to `/field-tech/schedule`
   - Ensure you have upcoming visits (use seed data if needed)

2. **Optimize a route**
   - The route optimization should happen automatically
   - Watch the terminal for API call logs

3. **Check for errors**
   - ✅ No `OVER_QUERY_LIMIT` errors
   - ✅ No `PERMISSION_DENIED` errors
   - ✅ Routes API calls succeed
   - ✅ Distance Matrix fallback works if needed

4. **Test high-volume scenario**
   - Use seed data with 130+ visits: `node scripts/seed-hennepin-heavy.js`
   - Attempt route optimization
   - Should complete without quota errors

### 4. Expected API Call Patterns

#### Low Volume (10-20 visits):
- **Routes API**: 1 request (handles up to 23 waypoints)
- **Distance Matrix**: 0-3 requests (only if Routes API fails)
- **Geocoding**: 0-1 requests (only if home anchor not set)

#### High Volume (34+ visits):
- **Routes API**: 1 request (first 23 waypoints)
- **Distance Matrix**: ~17 requests (remaining visits, batched)
- **Geocoding**: 0-1 requests

#### With Caching:
- **First request**: Full API calls (as above)
- **Subsequent requests**: ~90% cache hits, minimal API calls

## What to Watch For

### ✅ Success Indicators:
- Routes API calls complete successfully
- Distance Matrix API calls complete successfully (if needed)
- No `OVER_QUERY_LIMIT` errors
- No `PERMISSION_DENIED` errors
- Route optimization completes in <30 seconds
- API call summary shows reasonable usage

### ❌ Failure Indicators:
- `OVER_QUERY_LIMIT` errors → Quota too low (shouldn't happen now)
- `PERMISSION_DENIED` errors → API key or billing issue
- `400` errors → API configuration issue
- Route optimization fails → Check API responses

## API Call Tracking

With `TRACK_GOOGLE_API_CALLS=true`, you'll see:

```
[google-api] Distance Matrix API call (cached: false)
[google-api] Routes API call (cached: false)
[google-api] Geocoding API call (cached: false)
```

At the end of the session:
```
=== Google Maps API Usage Summary ===
Distance Matrix: 5 calls (15 cached) - 75% cache hit rate
Routes API: 2 calls (8 cached) - 80% cache hit rate
Geocoding: 1 calls (3 cached) - 75% cache hit rate
Total API Calls: 8 actual (26 cached)
Cache Savings: $0.13
```

## Verification Checklist

- [ ] Clear all caches
- [ ] Start dev server with API tracking
- [ ] Log in as field tech
- [ ] Navigate to schedule page
- [ ] Route optimization completes successfully
- [ ] No `OVER_QUERY_LIMIT` errors
- [ ] API call summary shows reasonable usage
- [ ] Test with high-volume scenario (130+ visits)
- [ ] Verify caching works (second optimization uses cached data)

## Troubleshooting

### If you see `OVER_QUERY_LIMIT`:
1. Check Google Cloud Console → APIs & Services → Quotas
2. Verify quotas are set to recommended values above
3. Check which API is hitting the limit
4. Increase that specific quota

### If Routes API fails:
- Falls back to Distance Matrix API (legacy)
- This is expected behavior
- Should still complete route optimization

### If ComputeRouteMatrix is called:
- This shouldn't happen - it's disabled in code
- Check `src/lib/google/maps.ts` line 566-568
- Ensure it's using legacy API

## Cost Monitoring

Monitor costs in Google Cloud Console:
- **Billing** → **Reports**
- Filter by: Distance Matrix API, Routes API, Geocoding API
- With caching enabled, expect $3-10/month









