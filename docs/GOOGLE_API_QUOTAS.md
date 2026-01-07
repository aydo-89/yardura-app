# Google Maps API Quota Recommendations

## Current Usage Patterns

### Distance Matrix API (Legacy Fallback)
- **Per optimization with N visits**: ~(N²/80 + 2) requests (batched)
  - Example: 34 visits = ~17 requests
  - Example: 10 visits = ~2 requests
- **Caching**: 10 minutes default (vastly reduces calls)
- **Peak usage**: When multiple field techs optimize routes simultaneously

### Routes API (Preferred)
- **Per day route**: 1 request (handles up to 23 waypoints)
- **Falls back** to Distance Matrix if >23 visits or if API fails
- **Caching**: Route plans cached in database for 7 days

### Geocoding API
- **Used for**: Home anchors, new addresses
- **Caching**: 24 hours default
- **Typical usage**: 1-10 requests/day per org

## Recommended Quota Settings

### For Small Team (1-5 Field Techs)
```
Distance Matrix API:
  - Daily: 1,000 requests/day
  - Per Minute: 100 requests/minute

Routes API:
  - Daily: 200 requests/day
  - Per Minute: 20 requests/minute

Geocoding API:
  - Daily: 500 requests/day
  - Per Minute: 50 requests/minute
```

### For Medium Team (5-15 Field Techs)
```
Distance Matrix API:
  - Daily: 5,000 requests/day
  - Per Minute: 200 requests/minute

Routes API:
  - Daily: 500 requests/day
  - Per Minute: 50 requests/minute

Geocoding API:
  - Daily: 1,000 requests/day
  - Per Minute: 100 requests/minute
```

### For Large Team (15+ Field Techs)
```
Distance Matrix API:
  - Daily: 20,000 requests/day
  - Per Minute: 500 requests/minute

Routes API:
  - Daily: 2,000 requests/day
  - Per Minute: 100 requests/minute

Geocoding API:
  - Daily: 5,000 requests/day
  - Per Minute: 200 requests/minute
```

## Current Quota Analysis

If you currently have **2,000/day and 50/min**:

**Distance Matrix API:**
- ✅ **Daily (2,000)**: Good for 5-10 field techs with caching
- ⚠️ **Per Minute (50)**: May be low if multiple techs optimize simultaneously
  - **Recommendation**: Increase to **100-200/min** to handle peak loads

**Routes API:**
- ✅ **Daily (200-500)**: Sufficient (1 request per tech per day)
- ✅ **Per Minute (20-50)**: Should be fine (optimizations are spread out)

## Cache Impact

**Without caching** (worst case):
- 10 field techs × 30 visits each × 17 requests = **5,100 requests/day**

**With caching** (typical case):
- 10 field techs × 2-3 unique optimizations per day × 17 requests = **340-510 requests/day**
- **~90% reduction** due to caching

## Cost Considerations

- **Distance Matrix**: $5.00 per 1,000 elements (batched, so very efficient)
- **Routes API**: $5.00 per 1,000 requests (preferred for optimization)
- **Geocoding**: $5.00 per 1,000 requests (heavily cached)

## Monitoring Recommendations

1. **Enable API tracking** (`TRACK_GOOGLE_API_CALLS=true`) to monitor actual usage
2. **Set quota alerts** at 80% of daily limits
3. **Monitor cache hit rates** to ensure caching is working effectively
4. **Review logs** for `OVER_QUERY_LIMIT` errors and adjust quotas accordingly

## Adjusting Quotas

To update quotas in Google Cloud Console:
1. Go to **APIs & Services** > **Quotas**
2. Search for the specific API (Distance Matrix, Routes, Geocoding)
3. Select the quota you want to change
4. Click **Edit Quotas** and adjust values
5. Submit request (usually approved instantly for reasonable increases)









