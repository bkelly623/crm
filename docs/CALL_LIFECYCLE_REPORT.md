# Authoritative outbound lifecycle — implementation report

## Outcome

**Backend now supports a real controlled-pilot call path, not reservation-only.** Signed voice consumes one issued intent and returns a single server-authorized `<Dial><Number>`. Parent/child lifecycle, once-only accounting, recording denial, owner-scoped status and REST reconciliation are implemented and exercised. The browser SDK worker can use `docs/DIALER_CLIENT_CONTRACT.md` **unchanged**.

**No real call/audio, recording, SMS, provider configuration, incoming-number routing, cloud database change, deployment, environment enablement or Next build was performed.** Preview `.env.local` remains disabled, contains no Twilio account/auth/API secrets and has no recipient allowlist. No recipient has been approved. Source is not claimed to be running in the existing production-build preview.

## Implemented authority

- Voice authenticates the existing canonical HTTPS Twilio form signature before interpreting provider identity. Exact server enable flag and explicit canonical E.164 test-recipient allowlist remain mandatory. `To`, caller number, lead/user IDs and recording/consent fields never select dialing authority.
- Consumption now re-fetches the exact owned PN resource immediately before binding, checks returned account/number/voice capability against the reserved authority, then rechecks current DB role, scope, active lead and unchanged normalized phone under locks. It rechecks the flag/allowlist after provider access. Ownership timeout/change, expired intent, changed assignment/phone and replay all fail closed.
- Voice returns stored destination/caller only, one Number, 30-second ring timeout, `record="do-not-record"`, all four Number status events and an intent-bound Dial action URL. Same-intent retries never return another Dial. A response loss after binding retains the lease rather than dialing again.
- Legacy status `leadId`/`userId` upsert/counting was removed. All persisted association comes from an issued bound intent, configured/matching account, unique parent SID and one unique associated child SID. Unknown/malformed status/duration/account/SID or conflicting child is rejected, not defaulted to completed.
- Parent app callbacks resolve by bound parent SID. Number callbacks require signed intent query + provider ParentCallSid + child CallSid. Dial action uses signed parent CallSid and DialCallSid, returns Hangup, and updates **child only**; it cannot prove the parent is terminal.
- Events serialize with issuance/binding under profile -> lead -> intent locks. States advance monotonically; terminal state is absorbing. Duplicate/out-of-order callbacks do not regress state or double count. Duration is populated only from terminal child evidence and not overwritten by late nonterminal events.
- First valid child association creates exactly one Call and increments the stored lead's dialedCount once, in the same transaction as binding the child. Count represents an actual provider child attempt, including busy/no-answer/failure/cancellation, not only answered calls. Parent-only failures without a known child are not invented as PSTN attempts.
- Only persisted terminal **parent AND child** proof sets `finished_at` and deletes that exact intent lease. Late old callbacks cannot remove a newer lease. Bound-call expiry, browser cancellation/disconnect and parent-only terminal never unlock.
- Recording callbacks authenticate then return 403 with no DB/audio access: there is no approved per-call consent authority. No recording attachment, retrieval, transcription or generated transcript was added.

## Client recovery contract

- `GET /api/dialer/intents`: authenticated owner's active lease, otherwise most recent intent; `{intent:null}` if none.
- `GET /api/dialer/intents/:id`: owner-only status, including terminal proof/locked/canStartNewIntent. Managers cannot read another user's intent through this interface. No destination/account secrets/recording URLs are returned.
- `POST /api/dialer/intents/:id/reconcile`: owner-only, provider GETs only, available even while calling is disabled. Re-fetches exact stored parent SID and one bounded children page (pageSize 2), never follows arbitrary pagination/resource URLs, never creates/updates/cancels/redials a provider call. Account, resource/parent SID, client identity, caller and destination must match stored authority.
- Parent+child terminal REST evidence can recover missing callbacks and release. Active legs remain locked. Missing/extra child, next page, mismatched identity, contradictory current REST evidence, errors and timeouts retain uncertainty. There is no speculative no-child release or force-unlock API.
- Never-bound expired reservations can be released with a conditional PostgreSQL-clock update; concurrent binding cannot revive them. An unexpired issued reservation simply remains held.
- APIs are private/no-store and fail without provider diagnostics. The frontend must use `canStartNewIntent`, retain hold on uncertainty, require explicit wrap-up/next, and never auto-redial. Responses are snapshots: issuance still arbitrates all races.

## Provider wiring / unchanged inbound

Before approved activation, the dedicated **outgoing TwiML App** needs Voice POST `/api/twilio/voice` and application call-status POST `/api/twilio/status` for the parent. Number/Dial child URLs are emitted by TwiML. This is NOT an instruction to modify IncomingPhoneNumber inbound routing.

`https://www.get247roi.com/api/voice/inbound` was not changed. Existing missed-call text-back was not exercised against its external deployment; its required regression remains a routing-cutover gate. No routing cutover occurred.

Provider protocol references checked: Twilio [Number callbacks](https://www.twilio.com/docs/voice/twiml/number.md) and [Dial action fields](https://www.twilio.com/docs/voice/twiml/dial.md). Mock transport proves this source/SDK interaction, not real carrier delivery or physical-phone audio.

## Additive local schema

Added only `child_call_sid` (unique), `parent_status`, `child_status`, `finished_at` to the previously added call_intents table, with state/binding/terminal-proof checks. Existing Profile/Lead/Call native types, enum values and baseline tables were not changed. Finished intents retain historical `state=bound` and non-null parent SID; `finished_at` distinguishes verified completion. Existing binding constraints therefore remain intact.

Draft: `docs/schema-drafts/call-lifecycle-local-only.sql`. Guarded runner: `docs/apply-local-call-lifecycle.py`. Applied only after checking exact owned running container, `127.0.0.1:55437 -> 5432`, database/user identity and empty call_intents baseline. Runner refuses reapplication. Prisma client generated locally; no install, db push, production migration or baseline schema reset.

A real failing test exposed SQL CHECK's NULL/UNKNOWN allowance. Tightened this task's newly added terminal-proof constraint to require non-null parent/child status. The corrected draft matches the local constraint; exact pg_constraint readback verified it. All fixture cleanup preserved pre-run table counts/content digests.

## Test-first / verification evidence

Observed failing -> passing slices: signed recording attachment denied; transactional child accounting and two-leg release; signed voice returns stored Dial after fresh inventory and consumes once; signed child/action routing no longer trusts legacy association; REST recovery; owner-scoped status/reconcile APIs; latest recovery and enabled intent response; never-bound expiry reconciliation; queued-status mapping. Additional guards characterize these behaviors rather than claiming every parameterized case had an independent RED cycle.

Two additional regression REDs were fixed and rerun: contradictory latest REST active state could otherwise combine with old terminal evidence; nullable SQL proof check could otherwise accept missing parent evidence. Both now fail closed.

Actual verification:

- **551 fast tests / 35 files passed**, including backend plus other workers' completed changes. A full suite also passed at the earlier snapshot before the browser SDK worker began adding tests.
- Latest backend-inclusive rerun explicitly excluded only the concurrently developed `tests/browser-dialer.test.ts`: **551 passed**. A contemporaneous full run hit that worker's expected RED (`dialer.prepare is not a function`); its files were not changed by this task.
- **87 real guarded PostgreSQL tests / 4 files passed**: existing reservation/persistence suites plus lifecycle tracer/guard suites. Independent concurrent callbacks, callback-vs-REST race, expiry-vs-bind race, both terminal orders, busy/no-answer/failure/cancellation, replay/late-event/new-lease safety, wrong identity/child/query data, active/absent/ambiguous children, provider failure, fresh ownership/flag/allowlist revocation, SQL terminal proof and exact fixtures preserved.
- All intent/lifecycle suites assert all **12 table counts and full-content digests equal their pre-run baseline** after exact-owned-fixture cleanup. Prior persistence suite separately checks its ten-table baseline. Its intentional FK-error diagnostic is rollback evidence, not a failed test.
- **ESLint zero-warning gate passed. Local-DB TypeScript passed. git diff --check passed.** Main standalone typecheck passed before the new SDK test arrived; latest main typecheck is blocked solely by the concurrently edited `tests/browser-dialer.test.ts:23` mock tuple errors TS2493/TS2339. Parent/SDK worker owns that repair and final combined rerun.
- SDK HTTP transport was mocked; unexpected external fetch is blocked by the test harness. No genuine provider credentials or requests were used.
- No Next build or `.next` regeneration. No edits to SDK/UI components, package files or lockfile by this task. Preserve all existing dirty work.

## Owned files

New:
- `src/lib/twilio/call-lifecycle.ts`, `intent-status.ts`
- `src/app/api/dialer/intents/[id]/route.ts`, `[id]/reconcile/route.ts`
- `tests/call-lifecycle-api.test.ts`
- `tests/local-db/call-lifecycle.integration.ts`, `lifecycle-guards.integration.ts`
- `docs/DIALER_CLIENT_CONTRACT.md`, `CALL_LIFECYCLE_REPORT.md`
- `docs/schema-drafts/call-lifecycle-local-only.sql`, `apply-local-call-lifecycle.py`

Targeted modifications:
- `src/lib/twilio/call-intents.ts`
- `src/app/api/dialer/intents/route.ts`
- `src/app/api/twilio/{voice,status,recording}/route.ts`
- `prisma/schema.prisma` (only this task's additive lifecycle fields/comments)
- `tests/{call-intent-api,call-intent-safety,voice,twilio-webhooks}.test.ts`
- `tests/local-db/call-intents.integration.ts` (replace historical always-Hangup expectation with the tested intent-bound Dial contract)
- `docs/CALL_INTENTS_REPORT.md` (mark historical reservation-only report superseded)

## Remaining controlled-pilot / production gates

1. Browser SDK/audio/token-refresh/wrap-up slice and final combined checks; rebuild/restart preview only when the parent decides it is safe. Physical phone foreground, background, lock, network loss/GSM interruption, microphone/headset tests are not covered by backend mocks.
2. Explicitly approved test recipient, protected environment, server secrets, outbound-only TwiML App wiring and explicit activation approval. No env was enabled here.
3. Approved production schema/backup/RLS/server-role review. Local PostgreSQL superuser tests are not Supabase RLS evidence.
4. Operational rate/spend limits, outreach suppression/timezone/cooldown/eligibility and applicable legal review before broader use. An allowlist is not a consent or legality determination.
5. Monitoring/operator investigation for genuinely uncertain/missing-child calls. This intentionally conservative API does not provide a dangerous manual lease-release shortcut.
6. Existing inbound missed-call text-back regression before any future inbound routing change. Recording consent/storage/private playback/retention remains a separate disabled feature.
