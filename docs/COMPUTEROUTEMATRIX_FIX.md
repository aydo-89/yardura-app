# ComputeRouteMatrix API Fix

## Summary

The Routes Matrix API (`computeRouteMatrix`) has been **re-enabled** with improved parsing logic that handles multiple response formats and gracefully falls back to the legacy Distance Matrix API if needed.

## What Was Fixed

### 1. **Improved Duration Parsing**
- **Before**: Only handled string format (e.g., "123s")
- **After**: Handles multiple formats:
  - String: `"123s"` or `"123"`
  - Object: `{ seconds: "123" }` or `{ seconds: 123 }`

### 2. **Enhanced Response Parsing**
- **Before**: Only parsed newline-delimited JSON (NDJSON) streaming format
- **After**: Handles both formats:
  - **NDJSON streaming format**: Newline-delimited JSON (one JSON object per line)
  - **Single JSON object**: Non-streaming format with `routeMatrix` array

### 3. **Better Error Handling**
- **Before**: Threw errors on any parsing failure
- **After**: 
  - Continues processing if individual lines fail
  - Falls back to legacy API if entire response fails to parse
  - Logs warnings with response preview for debugging

### 4. **Improved Status Code Handling**
- **Before**: Only checked for `"OK"` status
- **After**: Handles multiple status code formats:
  - `0` (numeric OK)
  - `200` (HTTP OK)
  - `"OK"` (string OK)

### 5. **Re-enabled Routes Matrix API**
- **Before**: Completely disabled, always used legacy API
- **After**: Tries Routes Matrix API first, falls back to legacy if it fails

## Why This Matters

1. **Future-Proofing**: Google is deprecating the legacy Distance Matrix API (effective March 2025)
2. **Better Performance**: Routes Matrix API is more efficient and supports traffic-aware routing
3. **Cost Efficiency**: Routes Matrix API may be more cost-effective at scale
4. **Graceful Degradation**: Falls back to legacy API automatically if Routes Matrix fails

## Code Changes

### Updated `parseDurationSeconds` Function
```typescript
function parseDurationSeconds(duration?: string | null | { seconds?: string | number }): number
```
- Now handles both string and object formats
- More robust parsing logic

### Updated `fetchRoutesMatrixData` Function
- Handles both NDJSON streaming and single JSON object formats
- Improved error handling and logging
- Better status code validation

### Updated `fetchDistanceMatrixChunk` Function
- Now tries Routes Matrix API first
- Falls back to legacy API if Routes Matrix fails
- No breaking changes to external API

## Testing

To test the fix:

1. **Clear caches**:
   ```bash
   ./scripts/clear-google-cache.sh
   ```

2. **Enable API tracking**:
   ```bash
   export TRACK_GOOGLE_API_CALLS=true
   npm run dev
   ```

3. **Test route optimization**:
   - Log in as field tech
   - Navigate to `/field-tech/schedule`
   - Attempt route optimization
   - Check logs for:
     - `[google-routes]` messages (Routes Matrix API)
     - `[google] Routes Matrix API failed, falling back...` (if fallback occurs)

## Expected Behavior

### Success Case:
```
[google-api] Distance Matrix API call (cached: false)
[google-routes] Routes Matrix API successful
```

### Fallback Case:
```
[google-api] Distance Matrix API call (cached: false)
[google] Routes Matrix API failed, falling back to legacy Distance Matrix API
```

### Both Should Work:
- Routes Matrix API should work for most cases
- Legacy API fallback ensures reliability

## Monitoring

Watch for these log messages:

### Success Indicators:
- ✅ No `[google-routes] Failed to parse matrix line` errors
- ✅ No `[google-routes] Routes Matrix API returned no valid entries` warnings
- ✅ Route optimization completes successfully

### Fallback Indicators:
- ⚠️ `[google] Routes Matrix API failed, falling back...` messages
- This is expected behavior if Routes Matrix API isn't enabled or has issues
- System continues to work via legacy API

## Configuration

No configuration changes needed. The fix is automatic:
1. Tries Routes Matrix API first
2. Falls back to legacy API if Routes Matrix fails
3. Uses caching to minimize API calls

## Migration Notes

- **No breaking changes**: External API remains the same
- **Automatic**: No configuration needed
- **Backward compatible**: Falls back to legacy API if needed
- **Future-proof**: Ready for Google's API deprecation in 2025

## Next Steps

1. ✅ **Fixed**: Routes Matrix API parsing
2. ✅ **Re-enabled**: Routes Matrix API is now active
3. ⏳ **Monitor**: Watch for any parsing errors in production
4. ⏳ **Optimize**: Fine-tune response parsing based on actual responses

## Troubleshooting

### If Routes Matrix API fails:
- **Check**: Is Routes Matrix API enabled in Google Cloud Console?
- **Check**: Are quotas set correctly (50,000/day, 1,000/min)?
- **Check**: Logs will show the error and automatically fall back to legacy API

### If parsing still fails:
- **Check**: Logs will show `[google-routes] Response preview:` with actual response
- **Action**: Review response format and update parsing logic if needed

### If legacy API is always used:
- **Check**: Routes Matrix API might not be enabled
- **Result**: This is fine - legacy API still works
- **Action**: Enable Routes Matrix API in Google Cloud Console if desired









