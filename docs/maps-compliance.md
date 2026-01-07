# Google Maps Platform Compliance Notes

Last updated: 2024-11-12

## API Keys
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (browser) is restricted by HTTP referrers and only has access to `Maps JavaScript API` and `Map Tiles API`.
- `GOOGLE_MAPS_SERVER_API_KEY` is IP-restricted to backend services and enables: `Geocoding API`, `Address Validation API`, `Routes API`, `Route Optimization (Directions v2)`, `Directions API`, and `Distance Matrix API`.

## Allowed Caching Windows
| API | Data Cached | TTL |
| --- | --- | --- |
| Distance Matrix / Directions | Redis + in-memory matrix responses | 10 minutes (<< 30-day TOS limit) |
| Routes API (`computeRoutes`) | Stored only inside `ScooperRoutePlan` for ≤14 days; no sharing with third parties | 14 days |
| Address Validation | Store the resolved lat/lng + verdict in `ScooperProfile.metadata` until the user edits their address again | User-action scoped |

All caches are purged automatically:
- Redis keys expire in 10 minutes.
- `ScooperRoutePlan` rows include `expiresAt` and are deleted (in-app cleanup) once past due.

## Request Guardrails
- Quotas are enforced in Google Cloud Console:
  - Distance Matrix: 2,000 elements/day, 50/min global, 10/min/user.
  - Directions: 500 requests/day, 20/min global, 5/min/user.
  - Geocoding & Address Validation: 500 requests/day, 20/min global, 5/min/user.
  - Routes API: 50 route computations/day, 150/min global, 50/min/user.
- Budget alert at $100 with email notifications at 50%, 90%, 100%, 150% usage.

## Usage Summary
- Address save flows call the Address Validation API first and only persist corrections supplied by Google.
- Technician routing now calls Routes API’s `optimizeWaypointOrder` once per schedule change and caches the results locally instead of recomputing on every refresh.
- Fallback logic (legacy Distance Matrix heuristic) only runs when Routes API cannot service the request (e.g., >23 intermediate stops) and still observes the 10-minute cache TTL.
