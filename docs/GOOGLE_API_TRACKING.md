# Google Maps API Call Tracking

## Overview

To prevent excessive charges from Google Maps APIs, we've implemented comprehensive call tracking. This helps you monitor actual API usage vs cache hits.

## How to Enable

Set the environment variable:

```bash
TRACK_GOOGLE_API_CALLS=true
```

Add this to your `.env.local` or export it before starting your server:

```bash
export TRACK_GOOGLE_API_CALLS=true
npm run dev
```

## What Gets Tracked

### API Endpoints Monitored:
1. **Distance Matrix API** - Route optimization calls
2. **Directions API** - Turn-by-turn navigation  
3. **Geocoding API** - Address to coordinates conversion

### Output Example:

```
🔍 [Google API Tracking] ENABLED - monitoring all API calls

[💰 Google API] DISTANCEMATRIX - ACTUAL API CALL #1
[💰 Google API] DIRECTIONS - ACTUAL API CALL #1
[💰 Google API] DIRECTIONS - ACTUAL API CALL #2
[💰 Google API] GEOCODE - ACTUAL API CALL #1

============================================================
📊 GOOGLE MAPS API USAGE SUMMARY
============================================================
Distance Matrix:  1 actual | 24 cached
Directions:       2 actual | 16 cached
Geocoding:        1 actual | 5 cached
------------------------------------------------------------
TOTAL API CALLS:  4 actual | 45 cached
💵 CACHE SAVINGS:  45 calls avoided (91.8%)
============================================================
```

## Testing with Seed Data

### 1. Seed Your Database

```bash
node scripts/seed-hennepin.js
```

This creates consistent test data with visits and routes.

### 2. Enable Tracking

```bash
export TRACK_GOOGLE_API_CALLS=true
npm run dev
```

### 3. Load Field Tech Schedule

Navigate to: `http://localhost:3000/field-tech/schedule`

**First Load:**
- Should see ACTUAL API CALLS logged
- Typically 1-2 Distance Matrix calls
- Several Directions calls (one per route leg)
- Maybe 1 Geocode call for home anchor

**Subsequent Loads (within cache TTL):**
- Should see 0 actual calls
- All requests served from cache
- Summary shows high cache hit rate

### 4. Monitor Production

On the server:

```bash
ssh -i ~/.ssh/id_ed25519 root@159.223.197.13
export TRACK_GOOGLE_API_CALLS=true
pm2 restart yardura --update-env
pm2 logs yardura | grep "Google API"
```

## Cache Behavior

### Three Levels of Caching:

1. **In-Memory Cache** (30 min TTL)
   - Fastest, per-process
   - Lost on restart

2. **Redis Cache** (30 min TTL)  
   - Shared across all processes
   - Persists through restarts

3. **Database Cache** (7 day TTL)
   - `ScooperRoutePlan` table
   - Full route plans cached by signature
   - Includes optimization results

### Cache Keys Include:
- Origin/destination coordinates
- Travel mode
- Date (for route plans)
- Visit signatures

This means:
- ✅ Same route on same day = **0 API calls**
- ✅ Field tech refresh = **0 API calls** (within 30 min)
- ✅ PM2 restart = **0 API calls** (Redis persists)
- ⚠️ Different custom start/end = **new API calls** (but costs 1 credit)

## Cost Estimates

### Without Caching:
- 1 field tech with 10 visits
- Route loaded 20 times/day
- Distance Matrix: ~20 calls × $5/1000 = **$0.10/day**
- Directions: ~200 calls × $5/1000 = **$1.00/day**
- **Total: ~$1.10/day per tech** = $33/month

### With Caching (Current):
- First load: 1-2 API calls
- Refreshes: 0 calls
- **~95% reduction = $1.65/month per tech** ✅

## Summary Report Schedule

- **Every 5 minutes** during runtime
- **On process exit** (Ctrl+C or graceful shutdown)

## Troubleshooting

### Not seeing tracking output?

1. Verify environment variable:
   ```bash
   echo $TRACK_GOOGLE_API_CALLS
   ```

2. Check it's set to exactly "true" (lowercase)

3. Restart your dev server after setting the variable

### Seeing too many actual calls?

1. Check Redis is running and connected
2. Verify `REDIS_URL` in `.env.local`
3. Check cache TTL settings in `src/lib/google/maps.ts`
4. Look for errors in Redis connection logs

### Want to clear cache for testing?

```bash
# Clear Redis cache
redis-cli FLUSHALL

# Or just the Google cache keys
redis-cli --scan --pattern "geocode:*" | xargs redis-cli DEL
redis-cli --scan --pattern "distance-matrix:*" | xargs redis-cli DEL
redis-cli --scan --pattern "directions:*" | xargs redis-cli DEL

# Clear database route plans
npm run db:reset-route-plans  # (if script exists)
```

## Questions?

The tracking code is in `src/lib/google/maps.ts` at the top of the file.









