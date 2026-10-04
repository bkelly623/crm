# Manual real-lead calling — source change and verification

## Outcome and authority

The user explicitly authorized manual production calling of real leads, superseding the historical single-recipient pilot restriction. The later explicit instruction also replaces the artificial 120-second pilot cutoff with a bounded 3600-second (one-hour) normal-use ceiling. This report describes tested source, **not a deployment or verified live call**.

No call/SMS, provider API/configuration change, environment-file change, schema change, build, commit, push or deployment was performed. The existing `.next` preview was not rebuilt. Existing uncommitted mobile work and constant-label reservation diagnostics remain intact. Local PostgreSQL tests used only the existing guarded loopback staging database and synthetic fixtures; cleanup verified the original data digests.

## Source/configuration decisions

- `src/lib/twilio/call-intents.ts`: removed recipient allowlist parsing and checks from **both issuance and signed-voice consumption**. `TWILIO_TEST_RECIPIENT_ALLOWLIST` is no longer read anywhere in application source. Existing values can remain configured but have no effect; unset/empty/nonmatching/malformed legacy values do not restrict eligible leads. No replacement pilot-mode flag or client bypass was introduced.
- `requireCallingEnabled()` retains the exact server-only `TWILIO_CALLING_ENABLED === "true"` requirement before issuance/binding and again under transaction locks after fresh provider inventory. The HTTP intent, voice and token route gates also remain.
- Token source required no change: authentication, supported sales role, required account/key/secret/TwiML-app configuration, profile-bound identity and outgoing-only grant remain. Tests explicitly characterize issuance with missing/empty/stale/malformed legacy recipient configuration, without printing tokens.
- Important pre-existing gap discovered: the review queue excluded DNC and other statuses, but direct reservation/binding previously checked only `segment: active`. Before removing test-only isolation, failing tests proved both functions would authorize active DNC/wrong-number/not-interested/appointment-booked/unknown-status leads. Both now match the queue's existing eligibility predicate at every DB lead read: **active** plus `sdrStatus` in **no_contact, follow_up_needed, callback_scheduled**. This is an enforcement alignment, not a new outreach policy. Won/trashed, out-of-scope, revoked-profile and invalid-phone leads remain denied.
- `src/app/api/twilio/voice/route.ts`: `timeLimit: 120` -> `timeLimit: 3600`. `timeout: 30`, `record: "do-not-record"`, server-derived caller/destination and signed intent-bound status/action URLs remain unchanged.
- Page/panel copy now describes server-authorized manual calling, eligible leads and the one-hour ceiling. No UI lifecycle/SDK behavior was broadened. The current `DIALER_CLIENT_CONTRACT.md` is updated; prior diagnosis is explicitly historical rather than silently rewritten.
- Reservation diagnostics retain safe stage labels and generic 409 responses. The removed recipient stage becomes the still-required configuration recheck. The diagnostic regression now exercises destination-format rejection, retaining no-persistence/no-PII and inventory-error coverage.

## Protections and limits

Retained: trusted user/lead access (including locked recheck), normalized stored international destination, fresh owned voice-capable caller inventory, canonical provider signatures, client identity/account/intent/parent-child associations, one-call user/lead leases, single-use unexpired consumption, both-leg terminal proof, uncertainty holds, manual Hang up and explicit wrap-up/Next, recording OFF and disabled phone-app fallback. Status/lifecycle/reconciliation/browser-call code was not changed.

Duration limits are distinct:

- **3600-second Dial ceiling** for a connected call; not unlimited calling. This replaces the prior **120-second** pilot ceiling by explicit request.
- **30-second ringing timeout**, unchanged.
- **60-second reservation expiry**, unchanged; it applies only to never-bound intents and never releases an active/uncertain call.
- One concurrent reservation/call per user and per lead, not an organization-wide spend budget.
- Existing 100-item browser review-session bound is not a daily calling-attempt or spend cap. No aggregate spend, daily rate/attempt, retry/cooldown or recipient-timezone/business-hours enforcement was added or claimed. No provider budget setting was inspected/changed.
- Existing short bounded client polling remains unchanged; longer calls can require explicit **Check server status**. Browser disconnect alone never unlocks. This change does not certify reliable background phone audio, legal eligibility or consent.

## TDD evidence

All behavior-changing source edits followed observed failing tests:

| Slice | RED | GREEN |
| --- | --- | --- |
| Eligible intent without recipient restriction | Four legacy-config cases returned 409, expected 201 | Four passed after issuance edit |
| Signed voice without recipient restriction | Four cases returned Hangup-only, expected Dial | Eight issuance/voice cases passed after binding edit |
| Normal-use bounded duration | Real TwiML contained `timeLimit="120"`, expected `3600` | Duration regression passed, retaining timeout/recording assertions |
| DNC/queue eligibility at both boundaries | Five status cases returned `[fulfilled, fulfilled]`, expected both rejected | All guard cases passed with active/eligible predicate |
| Truthful manual-call UI | Rendered page still said pilot instead of manual | Page/panel assertions pass with one-hour disclosure |

New `tests/production-manual-calling.test.ts` exercises real intent/voice handlers and issuance/binding functions with mocked auth/DB/inventory boundaries, real offline Twilio signature/TwiML handling and synthetic values. Additional tests characterize retained identity/access/format/inventory/lease/replay/kill-switch protections; they are not presented as independent feature RED cycles.

Final verification (all commands exit 0):

- `CI=1 npm test`: **636 passed / 43 files**.
- `npx --no-install vitest run --config tests/local-db/vitest.config.ts`: **87 passed / 4 files; one opt-in pilot-readiness diagnostic skipped**. Actual local SQL races, persistence, signatures, leases, lifecycle and DNC-after-issuance checks run with provider HTTP mocked. All intent/lifecycle suites print baseline-preserving 12-table cleanup confirmations; persistence suite confirms its 10-table baseline. Expected rejection-stage warnings and intentional FK-rollback diagnostic appear; no test failure.
- `CI=1 npm run lint`: zero-warning gate passed.
- `CI=1 npm run typecheck`: passed.
- `npx --no-install tsc -p tests/local-db/tsconfig.json --noEmit`: passed.
- `git diff --check`: passed.
- Application source search: no `allowlist` or `pilot` remaining; the only `timeLimit` is 3600 in the voice handler.

## Files in this change

Source: `src/lib/twilio/call-intents.ts`, `src/app/api/twilio/voice/route.ts`, `src/app/api/dialer/intents/route.ts` (comment only), `src/app/dashboard/dialer/page.tsx` and `src/components/dialer/dialer-panel.tsx` (copy only over preserved mobile changes).

Tests: new `tests/production-manual-calling.test.ts`; updated `tests/pilot-call-limit.test.ts` (retained historical filename), `tests/token.test.ts`, `tests/list-queue-pages.test.tsx`, existing uncommitted `tests/call-reservation-diagnostics.test.ts`, `tests/local-db/call-intents.integration.ts`, `tests/local-db/lifecycle-guards.integration.ts`.

Docs: this report, `docs/DIALER_CLIENT_CONTRACT.md`, historical note in `docs/RESERVATION_FAILURE_DIAGNOSIS.md`.

## Remaining release requirements

1. Parent owns final independent review, isolated build (do not overwrite serving `.next`), commit/push/deployment and exact deployed commit/canonical-alias readback. This worker performed none of those.
2. Verify authenticated production intent issuance and signed lifecycle end-to-end after release. Original inventory/token 200 then intent 409 suggests the old recipient restriction but the exact failing production POST payload was never captured; do not report the historical root cause as proven or all future 409s as fixed.
3. User-operated HTTPS physical-phone acceptance: Load Lead, **Load numbers**, choose **Call from**, prepare microphone, manually Call; then validate correct caller ID, two-way audio, Hang up, authoritative terminal release, wrap-up and Next. No agent-initiated call was made.
4. User/operator retains responsibility for real-lead eligibility and usage monitoring; broad compliance/timezone/spend controls are absent, not supplied by this change. Preserve existing inbound missed-call/text-back routing. Recording remains unavailable.

Rollback is a reviewed source/deployment action owned by the parent; never restore whole dirty files or delete leases to force a retry. The retained global calling switch can prevent new calls while existing lifecycle reconciliation remains available.
