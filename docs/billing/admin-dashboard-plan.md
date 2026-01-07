# Billing Admin Dashboard – Data Contract & UI Outline

## Goals

1. Give admins a single place to view customer billing posture: recurring amounts, active trials, outstanding invoices, credits/skips, and Stripe sync health.
2. Surface actionable states (e.g., invoice failed, schedule credit applied but not invoiced) with traceability back to ledger entries and service visits.
3. Provide exportable data so finance/ops can reconcile with QuickBooks when we introduce the integration.

## Key Entities

| Entity | Source | Notes |
| --- | --- | --- |
| CustomerBillingPlan | `prisma.customerBillingPlan` | Includes billing preference, cadence metadata (`billingAutomation`), Stripe ids, trial markers. |
| CustomerBillingLedgerEntry | `prisma.customerBillingLedgerEntry` | Charges/credits/adjustments per job, optionally tied to a service visit. Stores Stripe invoice ids when applied. |
| ServiceVisit | `prisma.serviceVisit` | Needed for linking ledger entries to date, frequency, weekend upgrade, etc. |
| Stripe Invoice | Stripe API | For invoice status, hosted link, amounts; cross-reference via `stripeInvoiceId`. |
| Stripe Subscription/Schedule | Stripe API | For recurring billing state (pause, cancel, next invoice date). |
| BillingSnapshot | `prisma.billingSnapshot` | Quote-time pricing context (per-visit amount, monthly equivalent) for historical reference. |

## API Contract (proposed)

### `GET /api/admin/billing/dashboard`

**Query Params**

- `orgId` (optional for HQ view)
- `customerId` / `jobId` (optional drill-down)
- `status` (invoice status filter: pending, failed, paid)
- `dateRange` (ISO strings)
- `skip` / `take` for pagination

**Response**

```json
{
  "plans": [
    {
      "jobId": "job_123",
      "customerId": "cust_123",
      "orgId": "yardura",
      "customerName": "Ayden Dunham",
      "address": "1234 Minnehaha, Minneapolis, MN 55417",
      "billingPreference": "monthly",
      "recurringAmountCents": 30300,
      "perVisitAmountCents": 700,
      "weekendUpgrade": true,
      "trial": {
        "trialEndsAt": "2025-04-08T00:00:00Z",
        "firstChargeAt": "2025-04-09T00:00:00Z",
        "status": "active"
      },
      "stripe": {
        "customerId": "cus_abc",
        "subscriptionId": "sub_123",
        "scheduleId": null,
        "subscriptionStatus": "active"
      },
      "billingAutomation": {
        "lastBaseEntryAt": "2025-05-01T00:00:00Z",
        "billingCadenceDays": 30
      }
    }
  ],
  "ledger": {
    "entries": [
      {
        "id": "ledg_123",
        "jobId": "job_123",
        "serviceVisitId": "visit_456",
        "type": "CHARGE",
        "status": "PENDING",
        "amountCents": 1700,
        "description": "Service visit charge",
        "createdAt": "2025-04-05T15:00:00Z",
        "metadata": {
          "source": "service-completion",
          "serviceFrequency": "DAILY",
          "weekendUpgrade": true
        },
        "stripeInvoiceId": null,
        "serviceVisit": {
          "scheduledDate": "2025-04-05T15:00:00Z",
          "status": "COMPLETED"
        }
      }
    ],
    "summary": {
      "pendingChargesCents": 5100,
      "pendingCreditsCents": -2200,
      "appliedThisCycleCents": 30300
    }
  },
  "invoices": [
    {
      "id": "in_123",
      "status": "open",
      "amountDueCents": 30300,
      "invoiceDate": "2025-06-01T12:00:00Z",
      "hostedInvoiceUrl": "https://stripe.com/invoice/abc",
      "customer": {
        "name": "Ayden Dunham"
      }
    }
  ],
  "credits": {
    "skipCredits": 2,
    "introCredits": 1,
    "valueCents": -1200
  }
}
```

### Supporting Endpoints

- `GET /api/admin/billing/ledger?jobId=...` – fetch paginated ledger entries with filters (`type`, `status`, `source`).
- `POST /api/admin/billing/ledger/void` – void entries with optional reason (writes to metadata, sets `VOID`).
- `POST /api/admin/billing/ledger/apply-credit` – admin-awarded credit, reuses `createCreditEntry` helper.
- `GET /api/admin/billing/invoices?customerId=...` – proxy to Stripe invoice list with caching to avoid rate limits.
- `GET /api/admin/billing/plan/{jobId}` – detail view including `BillingSnapshot` history and timeline of ledger entries/invoices.

## UI Sketch

1. **Summary Header** – Totals by status (Pending, Approved, Failed), quick filters, date picker.
2. **Plan Grid/List** – Each card shows customer, preference (Monthly/Weekly/Per-Visit), amount, trial badge, weekend upgrade flag, Stripe subscription status. Clicking drills into ledger timeline.
3. **Ledger Timeline** – Vertical list grouped by cycle with color-coded charges vs credits. Each entry reveals metadata (source, service visit link, invoice link).
4. **Invoice Panel** – Table of latest invoices with status pill, amount, Stripe link, retry action if failed.
5. **Credits & Skips Report** – Aggregation table showing skip reason, applied credit, responsible actor (field tech vs customer). Useful for spotting abuse/over-crediting.
6. **Actions Sidebar** – Buttons to award manual credit, void entry, sync invoice, export CSV.

### Data Integration Notes

- Use existing `processPendingLedgerEntriesForJob` triggers to keep ledger statuses in sync after admin actions.
- For the dashboard, create read-optimized SQL views (or Prisma `@@index`) to avoid N+1 when querying ledger entries joined to service visits/customers.
- Stripe data should be cached (store invoice snapshot in ledger metadata or a new `StripeInvoiceSync` table) to minimize API calls when admins paginate.

## Open Questions / Next Steps

1. Define permissions: ensure only admins/owners can access the new endpoints (reuse `/admin` auth guard).
2. Decide on caching layer for Stripe data – short-lived Redis cache vs persisted snapshot table.
3. Confirm export requirements (CSV columns) for QuickBooks hand-off.

Once this contract is approved, we can scaffold the API handlers, add Prisma helpers for aggregated queries, and then build the React dashboard page under `src/app/admin/billing`.

