# Outbound Lead Management – API Contract (Phase A foundation)

> All endpoints live under `app/api` (Next.js App Router). Assume JWT-based session from NextAuth; tenant scoping via `orgId` derived from session + query.

## Conventions

- Responses are JSON `{ ok: boolean, data?, error? }`
- Pagination: cursor-based `?cursor=<id>&limit=20`
- All list endpoints accept `businessId` override for super-admin tenants.

## 1. Territories

### POST `/api/territories`

Create or update a territory polygon.

```
Body {
  name: string,
  slug?: string,
  type: 'REGION' | 'AREA' | 'MICRO',
  color?: string,
  geometry: GeoJSON,
  parentId?: string,
  assignees?: [{ userId: string, role: 'OWNER' | 'CONTRIBUTOR' | 'VIEWER', isPrimary?: boolean }]
}
```

Responses

- 201 → `{ ok: true, data: Territory }`
- 409 if slug already exists, 403 if user lacks `SALES_MANAGER` or above.

### GET `/api/territories`

```
Query: search?, type?, parentId?, bbox=[minLon,minLat,maxLon,maxLat], includeAssignments=true|false
```

Returns array of territories with optional assignment summary.

### PATCH `/api/territories/[id]`

Partial update; same payload as POST but optional fields.

### DELETE `/api/territories/[id]`

Soft delete (`active=false`); requires `OWNER`.

## 2. Lead Outbound Listing

### GET `/api/leads/outbound`

Filters

```
?pipelineStage=CONTACTED
?ownerId=<user>
?territoryId=<territory>
?leadType=outbound
?search=string (matches name/email/phone/address)
?nextActionBefore=ISO
?includeCadence=true
```

Response

```
{
  ok: true,
  data: {
    leads: [
      {
        id,
        firstName,
        lastName,
        leadType,
        pipelineStage,
        owner: { id, name },
        territory: { id, name, color },
        lastActivity: { id, type, occurredAt, result },
        nextActionAt,
        nextActionSlaMinutes,
        preferredStartDate,
        contact: { email, phone },
        address: { city, state, zipCode, latitude, longitude }
      }
    ],
    pageInfo: { nextCursor }
  }
}
```

### POST `/api/leads/outbound`

Create manual outbound lead.

```
Body {
  firstName?, lastName?, email?, phone?,
  address?: { line1, city, state, zip },
  territoryId?, pipelineStage?, ownerId?, campaignId?,
  initialActivity?: { type, notes, result, location }
}
```

Returns created lead with stage.

### PATCH `/api/leads/[id]/stage`

```
Body { pipelineStage: string, ownerId?, territoryId?, nextActionAt? }
```

Triggers automation (enqueue cadence scheduler if stage change enters configured cadence).

## 3. Lead Activities

### POST `/api/leads/[id]/activities`

```
Body {
  type: 'DOOR_KNOCK' | 'CALL' | 'SMS' | 'EMAIL' | 'NOTE' | 'TASK' | 'MEETING',
  channel?: string,
  occurredAt?: ISO,
  result?: string,
  notes?: string,
  attachments?: [{ filename, url, mimeType }],
  location?: { lat, lng, accuracy? },
  followUpAt?: ISO
}
```

Response includes new activity & updated lead summary (`lastActivityAt`, `nextActionAt`).

### GET `/api/leads/[id]/activities`

Paginated timeline sorted by `occurredAt desc`.

## 4. Cadence Management

### GET `/api/cadences`

```
?targetStage=CONTACTED
```

### POST `/api/cadences`

Create cadence with steps.

```
Body {
  name,
  description?,
  targetStage?,
  steps: [
    { order, channel, templateId?, waitMinutes, slaMinutes?, autoComplete?, metadata? }
  ]
}
```

### POST `/api/cadences/[id]/enroll`

```
Body { leadId, startImmediately?: boolean }
```

Enqueues first step, returns enrollment status.

### POST `/api/cadence-executor`

Called by cron/worker. No request body; worker loads due enrollments and dispatches channel-specific jobs.

## 5. Trips & Routing

### POST `/api/trips`

```
Body {
  ownerId?,
  territoryId?,
  name?,
  optimization?: 'fastest' | 'shortest' | 'walking',
  startLocation: { lat, lng },
  endLocation?: { lat, lng },
  stopLeadIds: string[],
  plannedStart?: ISO
}
```

Server calls routing provider -> returns ordered stops with ETAs.

```
Response {
  ok: true,
  data: {
    id,
    stops: [{ order, leadId, plannedAt, address, etaMinutes, distanceMeters }],
    distanceMeters,
    durationMinutes
  }
}
```

### PATCH `/api/trips/[id]/status`

Body `{ status: 'in_progress' | 'completed' | 'cancelled', actualStart?, actualEnd?, notes? }`

### POST `/api/trips/[id]/stops/[stopId]`

Mark stop outcome (completed/skipped), optionally create activity.

## 6. Prospect Imports

### POST `/api/prospect-imports`

Multipart form: uploads CSV to S3 (pre-signed). Response includes import job id.

```
Body fields: campaignId?, territoryId?, defaultOwnerId?, dedupeStrategy?
```

### GET `/api/prospect-imports`

List recent imports with status stats (rows processed, duplicates). Managers only.

## 7. Reports

### GET `/api/reports/outbound`

```
?range=2025-09-01:2025-09-30
?territoryId=
?ownerId=
```

Returns aggregated metrics: touches per stage, conversion %, SLA breaches, Trip mileage, coverage heatmap data.

## Authentication & Authorization Matrix

| Endpoint                     | Role Requirement                                      |
| ---------------------------- | ----------------------------------------------------- |
| `/api/territories*`          | `SALES_MANAGER` or `FRANCHISE_OWNER`                  |
| `/api/leads/outbound` GET    | `SALES_REP` (filtered to own/territories) or higher   |
| `/api/leads/outbound` POST   | `SALES_REP` (auto owner) or `SALES_MANAGER`           |
| `/api/leads/[id]/activities` | `SALES_REP` on assigned lead, manager override        |
| `/api/cadences*`             | `SALES_MANAGER`                                       |
| `/api/cadence-executor`      | Worker token                                          |
| `/api/trips*`                | `SALES_REP` (self) or `SALES_MANAGER` (assign to rep) |
| `/api/prospect-imports`      | `SALES_MANAGER`                                       |
| `/api/reports/outbound`      | Manager-level                                         |

## Response Projections & Caching

- Use `select` to reduce payload sizes; include hypermedia `links` for next actions.
- Aggressive use of SWR caching on list endpoints with `etag` header based on `updatedAt`.

## Error Codes

- 400 validation errors (Zod) with `errors[]`
- 403 unauthorized/territory mismatch
- 409 duplicate territory slug or conflicting assignment
- 422 cadence step invalid template/channel combination

## Future Considerations

- Webhooks for third-party CRM sync (push outbound activity to HubSpot/Salesforce).
- Long-running activity (meeting) support – start/stop events.
- Websocket channel for live map updates (subscribe to trip/lead updates).
