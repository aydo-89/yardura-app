# Mileage Tracking for Field Tech Payments

## Overview

The system automatically tracks mileage (distance driven) for field techs to calculate per-mile bonuses and gas/maintenance payments. Mileage is calculated from route optimization data and stored in payout records.

## How It Works

### 1. Route Optimization
- When field techs view their schedule, the system optimizes routes using Google Maps APIs
- Each visit gets a `travelFromPrevious` segment with:
  - `distanceMeters`: Distance from previous visit (or home anchor for first visit)
  - `durationSeconds`: Travel time in seconds
- Route plans are stored in `ScooperRoutePlan` table with distance data

### 2. Mileage Calculation (Per Visit)
When a field tech completes a visit:
- System fetches the route plan for that day
- Calculates miles for **THIS visit's travel segment**:
  - If visit has `travelFromPrevious`: Uses that segment's distance
  - If first visit of day: Estimates distance from home anchor to first visit
  - Converts meters to miles: `miles = meters / 1609.34`
- Stores in `VisitPayout.milesDriven` field

### 3. Payment Calculation
- **Mileage Rate**: Default $0.30/mile (configurable per org)
- **Mileage Payment**: `mileageAmountCents = milesDriven × mileageRateCents`
- **Total Payment**: Includes base + bonuses + mileage + PPE + tips

## Database Schema

### `VisitPayout` Model
```typescript
{
  milesDriven: Float?              // Miles driven for this visit
  mileageAmountCents: Int           // Payment amount (miles × rate)
  totalAmountCents: Int             // Total payment including mileage
  // ... other fields
}
```

### `ScooperRoutePlan` Model
```typescript
{
  summary: {
    totalDistanceMeters: number     // Total distance for the day
    totalDurationSeconds: number    // Total travel time
  },
  payload: {
    visits: [{
      id: string
      travelFromPrevious: {
        distanceMeters: number      // Distance to THIS visit
        durationSeconds: number
      }
    }]
  }
}
```

## Mileage Calculation Logic

### Per-Visit Mileage
- **Most visits**: `travelFromPrevious.distanceMeters` converted to miles
- **First visit of day**: Estimated from home anchor (proportional to total distance)
- **Fallback**: If route plan unavailable, falls back to legacy `routeStop.notes` method

### Daily Total Mileage
- Can be calculated from `ScooperRoutePlan.summary.totalDistanceMeters`
- Useful for:
  - Daily gas/maintenance reimbursements
  - Route efficiency analysis
  - Total daily driving statistics

## Payment Structure

### Example Calculation
```
Visit completed with 12.5 miles driven:
- Base Rate: $25.00
- Mileage: 12.5 miles × $0.30 = $3.75
- PPE Stipend: $0.75
- Total: $29.50
```

### Mileage Rate Configuration
- **Default**: $0.30/mile (30 cents)
- **Configurable**: Per organization in compensation schedules
- **Adjustable**: Can be updated per visit via `upsertVisitPayoutForVisit` options

## API Usage

### Calculate Mileage for Visit
```typescript
// Automatic - happens when visit is completed
await upsertVisitPayoutForVisit(visitId, {
  mileageMiles: 12.5  // Optional override
});
```

### Query Total Miles Driven
```typescript
// Total miles for a field tech
const totalMiles = await prisma.visitPayout.aggregate({
  _sum: { milesDriven: true },
  where: {
    scooperId: userId,
    status: { in: [PayoutStatus.RELEASED, PayoutStatus.READY] }
  }
});
```

## Features

### ✅ Automatic Tracking
- Calculated automatically from route optimization
- No manual entry required
- Accurate distance from Google Maps APIs

### ✅ Per-Visit Granularity
- Each visit has its own mileage record
- Can calculate per-visit bonuses
- Track driving patterns

### ✅ Daily Aggregation
- Can sum miles across all visits in a day
- Useful for gas/maintenance reimbursements
- Stored in `ScooperRoutePlan` for reference

### ✅ Fallback Support
- If route plan unavailable, falls back to legacy methods
- Graceful degradation
- Never zero if route data exists

## Configuration

### Mileage Rate
Set in compensation schedules:
- `VisitCompSchedule.mileageRateCents` (per mile, in cents)
- Default: 30 cents/mile ($0.30)
- Can vary by:
  - Organization
  - Frequency (daily, weekly, etc.)
  - Date range

### Rate Calculation
```typescript
const mileageAmountCents = Math.round(
  milesDriven × mileageRateCents
);
```

## Reporting

### Field Tech View
- See miles driven per visit in earnings page
- Total miles for pay period
- Mileage payment breakdown

### Admin View
- Total miles driven by field tech
- Mileage cost analysis
- Route efficiency metrics

## Future Enhancements

### Potential Improvements
1. **Real-time GPS tracking**: Track actual driven route vs. planned
2. **Mileage verification**: Compare planned vs. actual miles
3. **Route efficiency scoring**: Identify inefficient routes
4. **Gas/maintenance auto-reimbursement**: Link mileage to expense tracking
5. **Mileage reports**: Generate tax-deductible mileage reports

## Troubleshooting

### Mileage Shows Zero
- **Check**: Route plan exists for that day
- **Check**: Visit has `travelFromPrevious` data
- **Check**: Route optimization ran successfully
- **Fix**: Re-run route optimization for that day

### Mileage Seems Incorrect
- **Verify**: Route plan data is current
- **Check**: Visit is in correct route order
- **Review**: Route plan expiration (7 days default)

### Missing Route Plans
- Route plans expire after 7 days
- Re-optimize route if plan expired
- Check `ScooperRoutePlan.expiresAt` date

## Summary

✅ **Mileage tracking is fully set up**:
- Automatic calculation from route optimization
- Stored per visit in `VisitPayout.milesDriven`
- Used for per-mile bonus payments
- Default rate: $0.30/mile
- Can be used for gas/maintenance reimbursements
- Daily totals available for reporting

The system is ready to calculate per-mile bonuses and gas/maintenance payments based on actual driven distances from route optimization!









