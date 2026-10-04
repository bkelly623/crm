# Call intent foundation — local implementation report

**Historical foundation report. Superseded for lifecycle/voice behavior by
`CALL_LIFECYCLE_REPORT.md` and the stable `DIALER_CLIENT_CONTRACT.md`.** Signed
voice now consumes issued intents; authoritative callbacks and reconciliation
are implemented locally. The reservation-only limitations below describe the
earlier slice, not current source. External calling remains unactivated.

## Outcome and deliberately bounded scope

**Server-authoritative reservation foundation implemented; calling remains unavailable.** Chosen the explicitly permitted narrow scope: issue/reserve intents and test a non-routed single-use binding primitive. The voice endpoint now returns Hangup-only TwiML even for a valid provider signature, exact enabled flag, real issued intent and matching client identity. The legacy raw-`To` Dial path has been removed, not hidden behind another enable flag. There is no `calls.create`, browser Voice SDK integration, UI activation, recording instruction, live provider request or simulated successful call.

The existing UI Call control remains disabled and unchanged. No consent is inferred/stored; API responses explicitly say `callingAvailable: false` and `recording: "do-not-record"`. No environment credentials or calling flags were provisioned/changed. The parent's preview stays on its prior `.next` build until the parent rebuilds; these source changes are not claimed to be running in that preview.

## Contract and authority

### `POST /api/dialer/intents`

- Requires authenticated trusted profile and existing sales role policy (`admin`, `sales_manager`, `sales_rep`, `closer`, `hybrid`). Anonymous 401, unsupported role 403.
- Requires server `TWILIO_CALLING_ENABLED` **exactly** `true`; unset/false/malformed returns 503. Request/public env fields cannot enable it.
- Strict JSON object accepts only `leadId` and `callerIdSid`. Rejects browser `To`, caller number, user/account identity, consent, recording and other unknown fields. Invalid input returns 400. Reservation/config/provider/DB/access/conflict failures return a generic 409; no provider error details are returned.
- Server-only `TWILIO_TEST_RECIPIENT_ALLOWLIST` is mandatory: comma-separated explicit canonical E.164 entries, each 8–15 digits after `+`, no whitespace/empty entries/wildcards, at most 100 entries. No default or public-lead fallback. **No actual recipient has been authorized/configured by this work.** A future operator must select an approved test recipient; do not copy synthetic fixtures into live configuration.
- Re-fetches the trusted profile and in-scope active lead from PostgreSQL; checks again after inventory access under `FOR UPDATE` locks on profile then lead. Managers have the existing broad sales scope; reps/closers/hybrid require assignment. Revoked role, reassignment, non-active lead or missing lead fail closed.
- Destination comes only from stored lead phone. Accepts an explicit `+` country code and conservative digits/space/parenthesis/hyphen formatting, normalizes formatting, validates E.164 shape and checks the allowlist. No country inference, extension, vanity or client identity. Syntax is **not** proof of routability, consent, suppression eligibility or legal calling permission.
- Extends the existing account inventory helper with `ownedVoiceNumber(PN SID)`: exact validated SID, fixed account IncomingPhoneNumbers resource GET, returned SID/account equality, strict boolean voice capability and E.164 caller number. The actual caller number is server-derived. Ten-second timeout/no automatic retries; no arbitrary pagination/resource URL. The dropdown cache/configured caller string does not grant authority.
- Creates UUID intent plus exclusive lease in one transaction, returns only intent ID/expiry and unavailable/recording flags with private no-store caching. Does not return destination/caller/lead metadata as a simulated call result.

### Expiry, concurrency and internal binding

- Intent lasts **60 seconds**, using PostgreSQL clock after reservation locks. Intent and lease are atomic. Database UNIQUE constraints enforce one reserved lead per user and one user per reserved lead, including independent concurrent transactions; composite FK ensures lease user/lead match its intent.
- Issuance conditionally expires conflicting **issued, never-bound** intents and deletes only those leases in the same transaction. Expired history remains. Cleanup is lazy on a later issuance, not a scheduler. If another conflict/error rolls back the transaction, cleanup rolls back too; it can be retried safely.
- `bindCallIntent` is server-only and **not called by any HTTP handler**. It is exercised with the real local DB. Requires intent UUID, matching `client:<user UUID>`, configured/matching account SID and valid parent CallSid; rechecks current role/lead/destination, allowlist and flag. Conditional SQL consumes only an unexpired issued intent with a lease, stores unique parent CallSid, changes state to `bound`. Exactly one concurrent consumer succeeds; even retrying the same SID is rejected (not an instruction to redial).
- This primitive is **not signature authentication**. Any future voice integration must authenticate the provider before invoking it and explicitly validate authoritative provider fields. Current signed voice does not consume even a valid intent, avoiding a false active reservation for a call it cannot run.
- **Bound leases never expire or release by clock**, browser disconnect, retry, or arbitrary callback. No bound-call release API exists. A `bound` row represents unknown/potentially active provider state until a future verified lifecycle/reconciler proves terminal state. No unsafe timeout unlock is implemented. `canceled` is reserved in the draft state constraint but no cancellation transition is exposed in this slice.
- Unique/lock/transaction failures fail closed; there is no automatic retry/redial. No per-user request-rate/spend controls or distributed operational monitoring yet.

## Callback and live lifecycle gate — not completed

Status/recording handlers were **not changed or connected to intents**. They gain no new intent authority. Their previously documented residual risks remain: signed custom lead/user association can still reach legacy status persistence; callbacks are not bound to authoritative parent/child intent SID lifecycle, status transitions/dial counts are not fully replay-safe, and recording attachment lacks an intent/consent authority model. Provider signature alone is not lead/user authorization. This report does **not** certify those existing callback writes as safe for an enabled dialer.

Before enabling any calling:

1. Replace legacy callback association trust with issued-intent/parent/child/account bindings; validate known status values, order events, deduplicate effects and increment counts once. Prove terminal child **and** parent semantics before releasing a lease; cancellation of a browser leg alone does not prove PSTN termination.
2. Integrate signed voice with consumption and server-derived destination/caller only; revalidate provider ownership close to Dial time and define stale-inventory behavior. Current ownership check is at issuance, not a future live Dial.
3. Reconcile lost response/crash after binding, missed/out-of-order callbacks, network/tab loss and unknown provider state. Hold queue during uncertainty; explicit provider terminal confirmation and an audited recovery path are required. Never expire a known-active call or auto-redial after reconnect.
4. Add client SDK/audio/token-refresh/wrap-up flow and physical-phone tests; unknown connectivity must not advance queue. Call stays disabled meanwhile.
5. Approved test recipient, real credentials/protected staging, suppression/timezone/cooldown/rate/spend controls, legal eligibility/consent review, production backup/schema/RLS/server-role review and explicit live activation approval remain required.
6. Keep recordings off until separate consent, authoritative association, storage/private playback/retention gates pass. Existing inbound missed-call text-back/provider routing was not touched or reverified; preserve and regression-test it before any routing cutover.

Token endpoint now applies the same sales-role check before credential/JWT issuance. Existing exact calling flag/authentication requirements remain. It can still construct an offline outgoing JWT in enabled synthetic tests; a JWT is not proof the dialer is callable, and this voice handler always hangs up.

## Additive schema and actual local application

- Added Prisma `CallIntent` and `CallIntentLease`, plus relation fields only on existing Profile/Lead. **No existing scalar/native type, table, timestamp, enum or FK was changed.** Existing known Prisma/live baseline drift is not repaired by this task; do not use `db push`.
- Reviewable draft: `docs/schema-drafts/call-intents-local-only.sql`, outside production migrations. Only two new tables, new constraints/indexes/RLS/revokes. New timestamp fields explicitly use timestamptz(6); original native timestamps remain unchanged.
- Applied only to owned `crm-local-staging` container after exact container/running state, loopback `127.0.0.1:55437 -> 5432` mapping and database/user identity checks. Runner `docs/apply-local-call-intents.py` refuses existing intent tables and any mismatched identity. SQL itself checks database name. This runner is local-only, not a cloud migration tool.
- Initial transaction rolled back because local PostgreSQL has no `anon` role. Draft now conditionally revokes existing Supabase-named roles; does not create them. RLS enabled with no direct-client policies. Local superuser tests are **not** Supabase RLS/service-role proof.
- Prisma generation required explicit composite uniqueness on the defining one-to-one lease relation even though intent ID already uniquely identifies it. Added the matching redundant composite unique index locally and to the draft; final catalog readback verified all seven new indexes and zero retained intent/lease fixtures. No drops/recreates/reset of existing schema.
- Existing schema creation reports describe ten tables; retained database now has these **two additional empty tables**. Original synthetic/application rows are preserved.

## Test-first and verification evidence

Observed RED -> GREEN tracer slices before their production behavior:

| Slice | RED observation | GREEN observation |
| --- | --- | --- |
| Fail-closed voice + token role | 4 assertion failures: signed raw To returned Dial; non-sales returned configuration 503 instead of role 403 | 4 passed |
| Exact owned-number SDK fetch | missing `ownedVoiceNumber` export | actual SDK GET construction/resource handling passed |
| Intent API contract | missing route module | 15 API tests passed |
| Real DB issuance + persisted authority | missing service module; then schema/client and nested create errors during implementation | real PostgreSQL independent readback passed |
| Single-use parent binding | missing binding export | actual DB wrong-user/account/replay/race checks passed |
| Safe expiry | second issuance hit user lease uniqueness after expiry | expiry frees only issued leases; bound lease remains held |

Additional negative cases/races are explicitly characterization of those implemented guards, not claimed as separately observed RED cycles. No tests were deleted: old enabled-voice Dial expectations were strengthened to Hangup/no-Dial, webhook signature assertions retained, and token fixture now supplies an authorized sales role.

Final combined command, exit **0** (run beginning 00:27:26 UTC):

```sh
CI=1 npm test &&
npx --no-install vitest run --config tests/local-db/vitest.config.ts &&
CI=1 npm run lint </dev/null &&
CI=1 npm run typecheck &&
npx --no-install tsc -p tests/local-db/tsconfig.json --noEmit &&
git diff --check
```

- **483 fast tests / 30 files passed**, including the parent's separate 39 redirect tests. SDK HTTP transport mocked at `RequestClient.prototype.request`; no real provider/secret use. Unexpected fetches fail.
- **38 real local PostgreSQL tests / 2 files passed**: 25 intent integration tests plus all 13 previous persistence tests. Concurrent same-user, same-lead, same-both issuance and simultaneous consumption; replay/expiry/rebind race; correct normalized stored authority; role/assignment change across provider fetch; wrong client/account; stale lead phone; allowlist/phone rejects; bound lease retained beyond TTL; real route to real DB and real offline signed voice still Hangup-only.
- New suite cleanup verifies **all 12 table row counts/content digests exactly equal pre-run baseline**, with exact fixture IDs only. Existing suite separately confirms its ten-table baseline. Expected prior FK-failure test prints a Prisma diagnostic and passes; this is intentional rollback evidence, not a suite failure.
- ESLint zero-warning gate passed. Main standalone TypeScript and local-DB test TypeScript passed. Prisma client generated locally (6.19.3), no dependency install. Earlier editor LSP model errors were stale after generation; actual compiler checks passed.
- `git diff --check` passed. Final read-only PostgreSQL catalog query confirmed two empty new tables/seven indexes.
- **No Next build**: preview on 127.0.0.1:3090 was active. Did not overwrite `.next`; main typecheck uses existing `.next/types` and therefore does not certify regenerated route types. Parent must rebuild/restart later. No deploy/commit/cloud DB/Supabase admin/provider call/SMS/recording/routing operation.

## Owned files

Created:
- `src/app/api/dialer/intents/route.ts`
- `src/lib/twilio/call-intents.ts`
- `tests/call-intent-api.test.ts`
- `tests/call-intent-inventory.test.ts`
- `tests/call-intent-safety.test.ts`
- `tests/local-db/call-intents.integration.ts`
- `docs/schema-drafts/call-intents-local-only.sql`
- `docs/apply-local-call-intents.py`
- `docs/CALL_INTENTS_REPORT.md`

Modified only own additive/targeted hunks in:
- `prisma/schema.prisma`
- `src/lib/twilio/number-inventory.ts`
- `src/app/api/twilio/voice/route.ts`
- `src/app/api/twilio/token/route.ts`
- `tests/token.test.ts`, `tests/voice.test.ts`, `tests/twilio-webhooks.test.ts`

Preserved other dirty source/UI/reports and the redirect worker's files. Local Prisma generated artifacts changed by generation, not source dependencies. Do not roll back the entire dirty worktree or reapply the local creation runner to the retained database.
