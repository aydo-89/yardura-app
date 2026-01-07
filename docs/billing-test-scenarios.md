# Billing Test Scenarios

Use Stripe test mode to validate the captured-card, post-service billing flow. Suggested runs:

1. **Monthly member – kickoff push:**
   - Create a lead selecting monthly billing. Confirm onboarding stores the card with no immediate charge and credits shown in onboarding.
   - Reschedule the first visit forward by ~1 week. Verify the plan’s ledger reflects the new date and no interim charge fires.
   - Complete the first visit and run the worker/manual invoice script: Stripe should issue a single invoice for that visit on the following day with promo credits applied.

2. **Monthly member – skip before first visit:**
   - Schedule kickoff, then mark the visit skipped. Confirm the ledger records the skip credit and the next scheduled visit inherits the kickoff flag.
   - Complete the next visit; only that visit should bill the day after completion while the skip credit appears as a negative line item.

3. **Pay-per-visit plan – completion vs skip:**
   - Complete a weekly visit and verify a single-visit invoice finalizes the next day.
   - Skip the following visit and ensure no invoice is generated while the ledger reflects the free credit.

4. **Refund / void:**
   - After a visit is invoiced, simulate a failure or refund in Stripe and confirm ledger entries flip to `VOID` and scooper payouts remain pending or claw back appropriately.

Log Stripe webhook payloads for each run to confirm metadata (ledgerEntryId, jobId) is present, and that admin billing dashboards show matching invoices, credits, and payout states.
