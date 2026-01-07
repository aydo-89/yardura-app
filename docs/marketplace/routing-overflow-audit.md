# Weekend Routing Overflow Audit Guide

This checklist captures the scenario we still need to exercise before calling Phase 3 complete. It describes the data preconditions, manual test steps, and expected signals (logs + queue activity) to confirm `autoAssignVisitToRoute` gracefully falls back to publishing marketplace offers when weekend volume exceeds staffed routes.

## Preconditions

- Org has at least one **LIVE** tile with assigned customers and visits.
- Generate weekend-dated visits (Saturday/Sunday) whose jobs share the same tile slug.
- Ensure no route instances exist for the target day **with technicians attached** so we can validate both failure and success paths.

## Scenario Matrix

| Case | Technician coverage | Expected behaviour |
|------|---------------------|--------------------|
| A    | No routes, no techs | `autoAssignVisitToRoute` creates new route, logs `no-candidate-routes`, enqueues offer publishing (already covered by unit test). |
| B    | Existing route with tech | Visit attaches to route, no offer publishing, `dispatch.autoAssign.candidates` log shows selection (unit test added). |
| C    | Existing routes *without* techs | Visit creates new technicianless route, logs `weekend-routes-without-technicians`, enqueues offer publishing (covered by unit test). |
| D    | Route becomes over capacity mid-run | We still need to simulate this: manually seed additional visits so scoring chooses a technicianless route and confirm we log the warning + enqueue offers only once per tile. |

## Manual Test Harness (staging idea)

1. Run `tsx jobs/audit-weekend-routing.ts <tile-slug> [ISO-date]` to inspect upcoming weekend coverage.
2. Use the output to identify unassigned visits and technicianless routes.
3. Trigger `/api/dispatch/auto-assign` (or the scheduler worker) for highlighted visits and capture console output.
4. Verify BullMQ `marketplaceOfferPublisher` job receives the tile slug when routes lack technicians.
5. Repeat with a technician assigned to confirm no offers are requeued.

Logs to watch:

- `dispatch.autoAssign`
- `dispatch.autoAssign.candidates`
- `marketplace.offerPublisher.enqueue`

Next actions: implement a staging-only script under `jobs/` that performs step 1–4, and add an integration test if feasible. Reply back to this doc when complete.

## Remaining ZIP Entry Points

As of now, the only ZIP flows still using legacy messaging were on the onboarding quote form. That component now performs a live `/api/zip-eligibility` lookup (see `src/components/quote-form.tsx`).

The hero, quote wizard, admin ZIP search, and voice bot tools all rely on `checkZipEligibility` + `buildTileMessaging`, so no additional migrations are required.
