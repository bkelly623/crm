# Production dialer failure: verified reservation-stage evidence

**Historical diagnosis:** the later explicit user authorization for real-lead manual calling supersedes the pilot-only recommendation below. See `PRODUCTION_MANUAL_CALLING_REPORT.md`. Fixed-stage reservation logging is retained; the removed recipient-allowlist stage is replaced by the still-required configuration recheck. The original 409 cause remains inferred, not proven.

Read-only Vercel logs for production deployment `dpl_CvN3gd34x66RuvihJ2gtssTME9ba` show on 2026-10-04 UTC:

- 20:41:53.601 GET `/api/dialer/numbers`: 200
- 20:42:14.429 GET `/api/twilio/token`: 200
- 20:42:19.241 GET `/api/dialer/next-lead`: 400
- 20:42:23.101 GET `/api/dialer/next-lead`: 200
- 20:42:26.029 GET `/dashboard/leads/194db0b2-c0a4-490f-ac13-afae70eada16`: 200
- 20:42:33.104 POST `/api/dialer/intents`: **409** (request `t75tz-1791146553104-5238f91e1d4c`)
- Subsequent GET intents requests: 200. No intent, lease, or call exists in production.

This establishes a server reservation rejection after token/inventory requests succeeded, not a demonstrated microphone/SDK/Twilio call failure. The failed request has no internal exception log or captured request body, so its precise thrown condition remains unproven.

## Strongest explanation, not claimed as certain

The lead-detail request immediately before reservation references a real active non-pilot lead with no lists and a destination outside the approved allowlist. The queue endpoint does not filter by the pilot recipient allowlist; an unrestricted queue returns the lexically first lead, which is that same non-pilot lead. This request is consistent with loading All lists rather than `Dialer Test`; a detail fetch could also be a prefetch, so it is not proof of the POST payload.

Production has exactly one approved active pilot lead (`pilot-571e99fa-6346-46ae-98d7-9d3c012e2cfd`), assigned to the existing admin, in `Dialer Test`. Other five active leads are outside the allowlist. Keep that restriction; do not widen it to make a call succeed.

## Verified exclusions

- Exact decrypted nonsecret Vercel configuration compares equal to `true`, the single approved recipient, and `https://crm-sepia-xi.vercel.app`; no whitespace mismatch. Sensitive Twilio variables remain unreadable, not claimed byte-verified. Successful actual runtime inventory/token endpoints are stronger than existence checks.
- Read-only provider inventory returns exactly one voice-capable owned number and no next page.
- Live production constraints match reviewed intent/lease schema; no lease triggers. A bounded SQL transaction using the actual pilot and actual owned caller inserted intent + lease successfully and explicitly rolled back. Independent readback: intents=0, leases=0, calls=0. This validates SQL/schema, not authenticated Prisma execution.

## Local diagnostic change, NOT deployed

`src/lib/twilio/call-intents.ts` now logs only constant failure-stage labels (`configuration`, `initial_authorization`, `caller_inventory`, `transaction_authorization`, `destination_format`, `recipient_allowlist`, `lease_check`, `intent_persistence`). No raw exception, SQL, user/lead IDs, numbers, credentials, or request bodies. Existing generic response and safety rules unchanged.

New `tests/call-reservation-diagnostics.test.ts` exercised the real route + issuance function with mocked DB/provider boundaries. Both tests failed before logging was added and passed afterward: unauthorized pilot recipient gives 409 without persistence; provider failure emits only the safe stage.

Verification: 587 tests / 42 files pass, TypeScript noEmit passes, lint passes. No competing Next build or deployment performed; mobile worker owns that workflow.

Minimal next action: parent coordinate diagnostic release with mobile worker, then use the existing `Dialer Test` selection (not All lists) for any user-initiated retry. If it still returns 409, its new fixed stage log distinguishes inventory/allowlist/SQL immediately without requesting screenshots. No call/SMS or auth account created during diagnosis.
