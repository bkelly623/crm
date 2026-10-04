# P0.3 — local Twilio webhook authentication boundary

**Outcome: voice, status and recording now require Twilio SDK signature validation before Dial instructions or callback database operations. Default-off calling and `do-not-record` remain. This is not call authorization or permission to enable calling.**

## Scope and configuration contract

Read the workspace business rule, `.cursor/rules/vercel-env-automation.mdc`, `BUILD_PLAN.md`, baseline/safety/auth reports, existing tests and the installed Twilio SDK validator before implementation. No environment-sync command was run.

New shared server helper: `src/lib/twilio/webhook.ts`.

- `TWILIO_AUTH_TOKEN`: required server-side account auth token, not an API-key secret. Empty or whitespace-containing configuration returns 503. The token remains opaque; no provider credential-validity check occurs. A wrong nonempty token rejects genuine signatures (403).
- `TWILIO_WEBHOOK_BASE_URL`: required **server-only canonical HTTPS origin**, e.g. `https://crm.example.test`, with an optional trailing `/`. No credentials, base path, query, fragment, whitespace or URL-repair forms are accepted. Canonical spelling is required (lowercase hostname, no explicit default port); a canonical nondefault port is supported. Missing/invalid configuration returns 503 before body parsing. This new variable is documented here only: no environment/example/deployment files were changed or provisioned. There is deliberately no fallback to `NEXT_PUBLIC_APP_URL`, localhost, the incoming request origin, `Host`, `Forwarded`, or `X-Forwarded-*`.
- Verification URL = configured canonical origin + incoming request URL pathname + incoming search string. Query ordering, repeated query parameters and encoded characters are not rebuilt through URLSearchParams. Proxies must preserve the externally configured path/query; deployments with rewrites/base paths require separately reviewed mapping, not forwarded-header trust.
- The real installed `twilio.validateRequest` verifies the `X-Twilio-Signature` with all submitted form fields. The SDK itself permits its documented port/legacy-query serialization variants; this implementation does not replace that algorithm or claim byte-exact equivalence beyond the SDK's validation contract.
- Accept only `application/x-www-form-urlencoded` (including charset parameters), not JSON/bodySHA256 or multipart/file uploads. Unsupported content type returns 415; unreadable form returns 400. Parse once and return that exact FormData to the handler. Every duplicate decoded form key, including identical duplicates, is rejected with 400 instead of signing a last value and consuming a first value. A null-prototype parameter map preserves ordinary provider fields such as `constructor` and `__proto__`. Query parameters are signed in the URL, never merged into form fields.
- Absent/invalid signatures return 403. Callback denials return generic JSON with no secret/signature/payload logging. Enabled voice denials return Hangup-only XML with the denial status, never Dial.

### Preserved terminal voice gate

The existing default-off gate runs first: unless `TWILIO_CALLING_ENABLED` is exactly `true` and caller ID is nonempty, voice returns HTTP 200 Hangup-only XML without parsing/authenticating anything. This intentional no-op preserves the earlier safety contract, including malformed-body handling. It is **not** an authenticated-success response. All paths capable of Dial require authentication; every accepted Dial remains `record="do-not-record"`, with no recording callback or recording-enable parameter. Token/UI/auth protections were not edited.

## Observed test-first evidence

The route and real Twilio HMAC/signature/TwiML code execute offline. `prisma` is replaced entirely by mocks, including accepted callback requests; no real DB or provider SDK client is used. Test fixtures use synthetic tokens and `.test` domains. Existing unexpected-fetch denial remains in the test harness.

Command for each development cycle: `CI=1 npm test -- tests/twilio-webhooks.test.ts`.

| Slice | Observed RED | Observed GREEN |
| --- | --- | --- |
| Status authentication | 1 failed / 1 passed; invalid signature returned 200 | 2 passed |
| Fail-closed token/base URL configuration | 15 failed / 2 passed; exceptions or incorrect 403/200 behavior | 17 passed |
| Form content type, parsing and duplicate-key boundary | 9 failed / 18 passed; duplicates accepted and parse errors escaped | 27 passed |
| Recording and voice integration | 18 failed / 40 passed; unsigned/tampered calls returned 200 | Integration cases passed in subsequent full suite |
| Reject silently repaired canonical configuration | 4 failed / 59 passed; abbreviated HTTPS/dot path/empty query or fragment returned 200 | Subsequent complete suite passed |

Additional characterization covers actual missing headers, tampered association/recording fields, differently valued duplicates, Unicode/plus/space fields, repeated/encoded queries, canonical validation despite hostile forwarded headers, and valid status/recording requests reaching only mocked DB. These already-passing characterization cases are not claimed as separate RED-driven production changes.

Existing 12 voice safety assertions were preserved; their enabled fixtures now carry real offline signatures. An initial full run caught two fixture signature mismatches caused by a redacted phone literal in the newly added signing parameters; using the synthetic caller-ID fixture fixed the test data, not the production validator.

## Final verification

From `/home/precision_focused_solutions/crm`:

```sh
CI=1 npm test &&
CI=1 npm run lint </dev/null &&
CI=1 npm run typecheck &&
git diff --check
```

Final chained command exited **0**:

- **201 tests passed in 9 files**, including **73 webhook tests** and the preserved 12 voice safety tests. This total includes 14 concurrent mobile-layout tests owned by the other worker; those files were not edited here.
- ESLint zero-warning gate: no diagnostics.
- Standalone TypeScript: no diagnostics.
- `git diff --check`: clean.
- An earlier typecheck failed with TS6053 for disappearing `.next/types` files during concurrent work. No build outputs were changed by this task; the unchanged typecheck command passed on the final retry.
- Production build deliberately left to the parent agent to avoid concurrent build-output interference. No build success is claimed by this report.

## Residual blockers — keep calling disabled

1. **Signatures authenticate provider-signed payloads, not arbitrary lead/user/destination authorization.** A provider can sign browser-originated/custom parameters. Voice still lacks server-created call intents, permitted destinations, caller-ID ownership validation, recipient eligibility/suppression, concurrency, spend and rate limits. A signed request does not establish an authorized CRM lead association.
2. Status still trusts signed `leadId`/`userId`, lacks authoritative parent/child CallSid binding, increments dial count on replay, permits out-of-order regression, and retains existing weak duration/status parsing (including `in_progress` mapping and unknown-status fallback). No replay protection/idempotency/transactional lifecycle was added. HMAC signatures do not expire.
3. Recording callback still stores a signed RecordingUrl for matching CallSid. Signature validation is not consent, recording ownership, retention/private-playback authorization, or an URL allowlist. No recording was started, stopped, fetched, played or deleted. Callback endpoints remain independent of the outbound calling flag so valid callbacks can arrive while outbound calling is off.
4. No AccountSid field-to-configuration policy, multi-account routing or auth-token rotation protocol was added. Validation is scoped to the configured token. Provisioning and exact public webhook/proxy URL verification remain staging tasks requiring authorization.
5. No real HTTP/middleware, Twilio callback, Supabase, DB-constraint, mobile-call or deployment verification occurred. Existing middleware configuration, dependency/audit findings, historical role/row authorization, staging/backup and consent gates from prior reports remain open. HTTP failure/fallback behavior must be checked in authorized staging before routing changes.

## Files and preservation

Changed only:
- `src/app/api/twilio/{voice,status,recording}/route.ts`
- `src/lib/twilio/webhook.ts` (new)
- `tests/twilio-webhooks.test.ts` (new)
- `tests/voice.test.ts` (signed fixture setup only)
- `docs/WEBHOOK_SECURITY_REPORT.md` (new)

No dependency/environment/schema changes, real secrets, provider calls, DB operations, migrations, commits, deployment or build-output edits. Prior tracked/untracked work and concurrent mobile work were preserved. The live inbound **https://www.get247roi.com/api/voice/inbound** and existing missed-call text-back are outside this checkout and were neither touched nor tested.

Local rollback must isolate the files above and preserve the previous default-off/do-not-record voice gate. Removing this authentication boundary would restore unsigned callback writes; no deployed state exists to roll back from this task.
