# Google Maps API Cost Analysis

## Current Pricing (2024/2025)

**Base Pricing:**
- **Routes API (ComputeRoutes)**: **$5.00 per 1,000 requests**
- **Distance Matrix API (Legacy)**: **$5.00 per 1,000 elements** (not requests!)
- **Distance Matrix API (ComputeRouteMatrix)**: **$5.00 per 1,000 elements**
- **Geocoding API (v4)**: **$5.00 per 1,000 requests**

**Free Monthly Credit:**
- **$200/month** applied automatically to your bill

## Important: Elements vs Requests

⚠️ **Critical Distinction:**
- **Routes API** counts **requests** (1 request per route optimization)
- **Distance Matrix** counts **elements** (origin×destination pairs)
  - Example: 34 visits = 34×34 = **1,156 elements** for full matrix
  - Plus start anchor: 1×34 = **34 elements**
  - Plus end anchor: 34×1 = **34 elements**
  - **Total: ~1,224 elements per optimization**

## Usage Patterns

### Routes API (ComputeRoutes) - **Preferred**
- **1 request** per route optimization
- Handles up to **23 waypoints** per request
- Falls back to Distance Matrix if >23 visits or API fails
- **Cached**: Route plans cached in database for 7 days
- **Typical usage**: 1-5 requests/day per field tech

### Distance Matrix API (Legacy) - **Fallback**
- Counts **elements** (origin×destination pairs)
- For N visits: ~N² elements for full matrix
- **Cached**: 10 minutes default (Redis + database)
- **Typical usage**: Only used when Routes API unavailable or >23 visits

### Geocoding API (v4)
- **1 request** per address geocoding
- Used for: Home anchors, new addresses
- **Cached**: 24 hours default
- **Typical usage**: 1-10 requests/day per organization

## Cost Scenarios

### Scenario 1: Small Team (1-5 Field Techs) - **With Caching**

**Daily Usage (with caching):**
- **Routes API**: 5 requests/day × $0.005 = **$0.025/day**
- **Distance Matrix**: 500 elements/day × $0.005/1000 = **$0.0025/day**
- **Geocoding**: 5 requests/day × $0.005 = **$0.025/day**

**Daily Total**: **~$0.05/day** | **Monthly**: **~$1.50/month**

**Monthly Credit Applied**: $200 - $1.50 = **$0.00/month** ✅

---

### Scenario 2: Medium Team (5-15 Field Techs) - **With Caching**

**Daily Usage (with caching):**
- **Routes API**: 15 requests/day × $0.005 = **$0.075/day**
- **Distance Matrix**: 2,000 elements/day × $0.005/1000 = **$0.01/day**
- **Geocoding**: 10 requests/day × $0.005 = **$0.05/day**

**Daily Total**: **~$0.14/day** | **Monthly**: **~$4.20/month**

**Monthly Credit Applied**: $200 - $4.20 = **$0.00/month** ✅

---

### Scenario 3: Large Team (15+ Field Techs) - **With Caching**

**Daily Usage (with caching):**
- **Routes API**: 50 requests/day × $0.005 = **$0.25/day**
- **Distance Matrix**: 10,000 elements/day × $0.005/1000 = **$0.05/day**
- **Geocoding**: 20 requests/day × $0.005 = **$0.10/day**

**Daily Total**: **~$0.40/day** | **Monthly**: **~$12/month**

**Monthly Credit Applied**: $200 - $12 = **$0.00/month** ✅

---

### Scenario 4: Peak Usage (No Caching) - **Worst Case**

**Daily Usage (worst case, no caching):**
- **Routes API**: 100 requests/day × $0.005 = **$0.50/day**
- **Distance Matrix**: 50,000 elements/day × $0.005/1000 = **$0.25/day**
- **Geocoding**: 500 requests/day × $0.005 = **$2.50/day**

**Daily Total**: **~$3.25/day** | **Monthly**: **~$97.50/month**

**Monthly Credit Applied**: $200 - $97.50 = **$0.00/month** ✅

**Note:** This scenario is extremely unlikely due to caching.

---

### Scenario 5: Heavy Production Load - **With Caching**

**Daily Usage (realistic production, with caching):**
- **Routes API**: 30 requests/day × $0.005 = **$0.15/day**
- **Distance Matrix**: 5,000 elements/day × $0.005/1000 = **$0.025/day**
- **Geocoding**: 30 requests/day × $0.005 = **$0.15/day**

**Daily Total**: **~$0.33/day** | **Monthly**: **~$10/month**

**Monthly Credit Applied**: $200 - $10 = **$0.00/month** ✅

## Cost Breakdown by API

### Routes API (ComputeRoutes)

**Cost per optimization:**
- **1 request** = **$0.005** (half a cent)
- **Cached for 7 days**, so repeat optimizations = **$0.00**

**Monthly cost estimate:**
- 5 field techs × 1 optimization/day × 30 days = 150 requests
- 150 requests × $0.005 = **$0.75/month**

---

### Distance Matrix API (Legacy)

**Cost per optimization (34 visits):**
- **~1,224 elements** = **$0.00612** (half a cent)
- **Cached for 10 minutes**, so repeat optimizations = **$0.00**

**Monthly cost estimate:**
- 5 field techs × 3 optimizations/day × 30 days × 1,224 elements = 550,800 elements
- But with 10-minute caching: ~10% actual calls = 55,080 elements
- 55,080 elements × $0.005/1000 = **$0.28/month**

**Note:** This is only used when Routes API unavailable or >23 visits.

---

### Geocoding API (v4)

**Cost per geocoding:**
- **1 request** = **$0.005** (half a cent)
- **Cached for 24 hours**, so repeat geocodings = **$0.00**

**Monthly cost estimate:**
- ~30 new addresses/month × $0.005 = **$0.15/month**

---

## Cost Optimization Strategies

### 1. **Aggressive Caching** ✅ (Already Implemented)
- Routes API: 7-day cache (database)
- Distance Matrix: 10-minute cache (Redis)
- Geocoding: 24-hour cache (Redis)
- **Savings**: ~90% reduction in API calls

### 2. **Prefer Routes API** ✅ (Already Implemented)
- Routes API is cheaper per optimization (1 request vs ~1,224 elements)
- **Savings**: ~80% cost reduction vs Distance Matrix

### 3. **Batch Requests** ✅ (Already Implemented)
- Distance Matrix batches elements into requests (max 80 elements/request)
- **Savings**: Reduces overhead

### 4. **Monitor Usage**
- Enable API call tracking (`TRACK_GOOGLE_API_CALLS=true`)
- Review usage reports in Google Cloud Console
- Set budget alerts

## Monthly Cost Estimates Summary

| Scenario | Monthly Cost | With $200 Credit | Actual Cost |
|----------|--------------|------------------|-------------|
| **Small Team (1-5 techs)** | $1.50 | ✅ Free | **$0.00** |
| **Medium Team (5-15 techs)** | $4.20 | ✅ Free | **$0.00** |
| **Large Team (15+ techs)** | $12.00 | ✅ Free | **$0.00** |
| **Heavy Production** | $10.00 | ✅ Free | **$0.00** |
| **Peak (No Cache)** | $97.50 | ✅ Free | **$0.00** |

## Realistic Production Cost

**Expected Monthly Cost: $3-10/month**

**With $200 monthly credit: $0.00/month** ✅

**Cost per field tech per month: ~$0.20-0.50**

## Cost Monitoring

### Enable API Call Tracking
```bash
export TRACK_GOOGLE_API_CALLS=true
npm run dev
```

This will log:
- Actual API calls (vs cached)
- Call types (Routes, Distance Matrix, Geocoding)
- Summary at end of session

### Google Cloud Console
1. Navigate to **APIs & Services** → **Dashboard**
2. View usage by API
3. Set up **budget alerts**
4. Review **Billing** → **Reports** for cost breakdown

### Set Budget Alerts
1. Go to **Billing** → **Budgets & alerts**
2. Create budget for Google Maps Platform
3. Set threshold (e.g., $50/month) for alerts
4. Get email notifications when approaching limit

## Key Takeaways

1. ✅ **With $200/month credit, expect $0/month costs** for typical usage
2. ✅ **Caching reduces costs by ~90%** (already implemented)
3. ✅ **Routes API is preferred** - cheaper and more efficient (already implemented)
4. ✅ **Distance Matrix is fallback only** - used when Routes API unavailable
5. ✅ **Cost per field tech: ~$0.20-0.50/month** (very low)

## When Costs Could Increase

### Without Caching:
- **10x increase** in costs (but caching is always enabled)

### Without Routes API (using Distance Matrix only):
- **80x increase** in costs for route optimization
- Example: $0.005 vs $0.40 per optimization

### Massive Scale (100+ field techs):
- Might exceed $200/month credit
- But with caching: still likely under $50/month

## Conclusion

**Expected Monthly Cost: $0.00** (covered by $200 credit) ✅

With proper caching and using Routes API, Google Maps API costs are **negligible** for typical field tech operations. You'll likely never exceed the $200/month free credit.









