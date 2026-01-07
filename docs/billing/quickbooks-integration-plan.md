# QuickBooks Online Integration Plan (Optional)

## Guiding Principles

1. **Optional by Design** – Core billing (Stripe + internal ledger) must operate identically when QuickBooks is disabled. No hard dependencies in critical paths (`invoice-processor`, ledger writes).
2. **Org-Level Opt-In** – Each org can toggle QuickBooks sync independently (config record or feature flag). Default is off. Enabling requires storing OAuth credentials + account mappings.
3. **Non-Blocking Sync** – Pushes to QuickBooks happen via background jobs. Failures log & notify but never block ledger updates or Stripe invoicing.
4. **Reversible & Auditable** – Admins can disable sync without data loss. Track sync status per ledger entry/invoice for reconciliation.

## Architecture Overview

### Configuration

- New `OrgIntegrationSettings` (or extend `BusinessConfig.settings.integrations.quickbooks`):
  - `enabled`: boolean (default `false`)
  - `realmId`, `clientId`, `clientSecret`, `refreshToken`
  - `accountMappings`: map of ledger types → QuickBooks account ids (e.g., revenue, discounts, AR)
- Feature flag gate in code paths to ensure optional usage.

### Data Flow

1. **Stripe → Ledger** (existing)
2. **Ledger Entry Applied** – when `markEntriesApplied` runs, enqueue QuickBooks sync if org enabled.
3. **Sync Worker** (new job, e.g., `jobs/quickbooksSyncWorker.ts`):
   - Reads `CustomerBillingLedgerEntry` with `stripeInvoiceId` and `integrationStatus = PENDING`
   - Fetches related customer/job context
   - Calls QuickBooks API via SDK (Invoice for charges, CreditMemo for credits)
   - Stores QuickBooks identifiers + status on ledger entry metadata (`integration.quickbooks.invoiceId` etc.)
4. **Retry Mechanism** – status `FAILED` with error message; background job retries with exponential backoff.

### Failure Handling

- Ledger remains `APPLIED`; QuickBooks sync flagged `FAILED` but does not revert billing.
- Admin dashboard shows sync status per entry so finance can investigate/resync.
- Provide manual "Retry QuickBooks Sync" action in future UI.

### Security & Storage

- Store OAuth tokens encrypted (KMS or pgcrypto).
- Refresh token flow handled in sync worker; on failure due to auth, mark integration as `needsReconnect` and notify admins.

## Without QuickBooks

- `enabled` remains false → no additional jobs queued.
- Admin billing dashboard still functions (data from Stripe + ledger).
- Optional UI surfaces (e.g., "Connect QuickBooks" button) hidden unless user has permissions.

## Next Steps

1. Define schema migration for org integration settings.
2. Choose QuickBooks SDK (e.g., `node-quickbooks`) or REST helper using OAuth2.
3. Implement background sync worker with retry + logging (`info("billing.quickbooks", ...)`).
4. Extend admin dashboard to display integration status and allow opt-in/out.
5. Document recon process (how to export ledger CSV if QuickBooks disabled).

