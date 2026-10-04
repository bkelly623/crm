# P0.1 — local outbound safety slice

Observed 2026-10-03 UTC in `/home/precision_focused_solutions/crm`, based on `9c871dc`.

**Outcome: default-off outbound route gates, disabled dialer handoff, recording forced off, and all four local quality gates pass. This is not complete P0, production authorization, or verified live Twilio security. Keep calling disabled.**

## Changes

- `/api/twilio/token` returns HTTP 503 with `Outbound calling disabled` before profile lookup or token construction unless server environment `TWILIO_CALLING_ENABLED` is exactly `true`. Unset, empty, `false`, `1`, `TRUE`, and whitespace-padded values deny. Existing authentication and required token-config checks remain when enabled.
- `/api/twilio/voice` returns HTTP 200 `text/xml` with only `<Response><Hangup/></Response>` (plus XML declaration) when that flag is not exactly `true` or caller ID is missing. This check precedes form parsing. A terminal TwiML response is intentional rather than an HTTP failure that could trigger provider fallback; no provider behavior was tested.
- Enabled voice TwiML explicitly uses `record="do-not-record"`, with no recording callback instructions. Request recording/consent flags cannot enable recording. There is deliberately no supported recording-enable parameter, environment switch, or UI toggle until an authorized consent/call-intent model exists.
- Removed `window.open(tel:...)` and the token-readiness fetch from the dialer. The Call button remains disabled even if credentials/flag are enabled because browser Voice SDK and call-intent safety are not implemented. The UI now says Calling unavailable and Load Lead/Ready to Review; existing lead review/disposition operations remain.
- `.env.example` documents `TWILIO_CALLING_ENABLED=false` as server-only. No real environment or secret was provisioned.
- Added noninteractive `test` (Vitest run), `lint` (ESLint CLI, Next core-web-vitals, zero warnings), and `typecheck` (standalone tsc, no incremental output) scripts. Added pinned development dependencies, ESLint/Vitest configuration, isolated route tests and jsdom component tests; updated the pre-existing untracked lockfile.

## Test-first evidence

Each behavior slice was exercised RED before its production edit, then GREEN before proceeding:

| Slice | Observed RED | Observed GREEN |
| --- | --- | --- |
| Token flag gate | `npm test -- tests/token.test.ts`: 6 failures, expected 503 but received 200 | Same command: 6 passed |
| Voice flag gate | `npm test -- tests/voice.test.ts`: 6 failures, received Dial with recording instead of Hangup | Full suite: 12 passed |
| Voice missing caller ID | Voice suite: 2 new failures, received Dial without caller ID | Full suite: 14 passed |
| Recording always off | Voice suite: 2 new failures, received `record-from-answer-dual` plus recording callback | Full suite: 16 passed |
| Dialer handoff removal | `npm test -- tests/dialer.test.tsx`: 4 failures, `window.open` called with tel URL | Full suite: 20 passed |

Subsequent characterization/regression cases cover enabled token generation, unauthenticated denial, each missing token credential, disabled malformed-body handling, and missing voice destination. These retained behaviors were not presented as newly implemented features. One characterization assertion initially assumed Twilio serializes an incoming grant with `allow:false`; the SDK omits the grant instead. Corrected the assertion to require absence; no production change was made for that test error. A TypeScript fixture inference issue was also corrected before its recording RED run.

The final suite has **28 passing tests across 3 files**: token 12, voice 12, dialer 4. The real route handlers and Twilio's offline JWT/TwiML builders execute. Auth is mocked to avoid Supabase/Prisma calls; all fixtures are synthetic. Fetch defaults to throwing, with only explicit local component responses mocked. UI tests prove the Call button cannot open a phone app, has no tel link, shows the warning, and makes only the mocked next-lead read—not a token request. Token-state scenarios remain denial-safe because the UI no longer consults token readiness at all.

## Final verification

From the repository, the following chained commands all exited **0**:

```sh
CI=1 npm test
CI=1 npm run lint </dev/null
CI=1 npm run typecheck
CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build
```

- Tests: 28/28 passed, Vitest 3.2.7.
- Lint: ESLint completed without diagnostics or interactive prompts; no warning suppression added.
- Typecheck: TypeScript completed without diagnostics, including tests.
- Build: Prisma Client 6.19.3 generated locally; Next.js 15.5.27 compiled successfully, lint/type checks succeeded, generated 30/30 pages and completed traces. Existing webpack large-string cache serialization warnings remain. Client generation is not a DB write or connectivity test.
- `git diff --check`: passed. Source search for `tel:`, `record-from-answer`, and the calling flag found only the two server calling gates; no residual phone-app or automatic-recording instruction in application source.
- `npm ls --depth=0`: resolved dependencies listed; several optional WASM packages were marked extraneous. No prune or duplicate clean installation was performed.
- Final disk observation: 7.2G free (93% used). Reused the existing node_modules and build directory; did not retain duplicate builds.

## Tooling issues and dependency blockers

Initial development-tool installation succeeded (357 packages added). It warned that ESLint 9.39.5 is no longer supported; it is the compatible major chosen for Next 15's configuration. The installation guard reported incomplete package threat-intelligence checks, not a malware finding.

`npm audit --json` exited **1**, reporting **12 affected package entries: 9 high, 3 moderate, 0 critical**. Existing Prisma/deepmerge-ts and Next/PostCSS issues from the baseline remain. Added development tooling brings a Next ESLint plugin/fast-glob/micromatch/braces stack-exhaustion chain and the Vitest/mocker arbitrary-file-read advisory [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9). These counts are package entries, not independent exploitable application vulnerabilities.

Attempted `npm install --save-dev --save-exact vitest@4.1.11 --no-fund` to remove the introduced Vitest advisory. npm 10.9.8 failed in Arborist peer resolution with `Cannot read properties of null (reading 'edgesOut')`. A second attempt explicitly pairing the already installed compatible `vite@7.3.6` failed the same way. Neither upgrade landed: manifest and installed Vitest remain 3.2.7. No force/legacy-peer-deps workaround or global npm change was made. Resolve the installer issue and upgrade the test tooling in a follow-up; do not expose Vitest UI/browser/mock servers or run untrusted test projects. The checked script uses batch `vitest run`, not a public test server. This is a documented residual dependency risk, not a clean security audit.

Clean `npm ci` reproducibility in an isolated, disk-appropriate environment remains unverified; the local working install, lint, typecheck, tests and build were actually exercised.

## Remaining live-calling blockers (not fixed here)

1. **Unsigned voice/status/recording handlers remain.** No Twilio signature or account validation was added. When the exact server flag is enabled, voice still trusts arbitrary `To`; a nonempty caller-ID configuration is not proof of owned/authorized caller ID. The flag is a deployment safety switch, not per-user/per-call authorization. Do not enable it for live use.
2. **Status and recording endpoints remain unchanged and are not gated by this flag.** Their unsigned writes, arbitrary record associations, callback replay/double-counting/out-of-order problems, duration/status parsing and missing SID binding remain. Forcing voice recording off does not authenticate or disable the recording callback endpoint, stop externally started recordings, or delete historical audio.
3. **Auth and data authorization remain open.** User-metadata role bootstrap, manager role granting, lead/task row-access policy, task update validation, and conditional GHL secret enforcement remain as documented in `BASELINE_REPORT.md`.
4. No server-authorized call intents, destination allowlist, suppression/timezone/eligibility checks, caller-ID ownership enforcement, rate/spend limits, atomic queue leases, consent records, retention/private playback, or callback idempotency were added.
5. No full-stack authenticated HTTP/browser/mobile/provider test occurred. The jsdom test is component evidence, not actual phone verification. Existing middleware still depends on Supabase config and may fail before a route's response in an unconfigured runtime. Build success is not configured runtime readiness.
6. Staging isolation, clean-install reproduction, backup/restore, deployment inspection, dependency remediation and approved live-recipient testing remain future gates.

## Preservation and rollback boundary

Modified: `.env.example`, `package.json`, pre-existing untracked `package-lock.json`, token and voice route files, dialer panel. Created: `eslint.config.mjs`, `vitest.config.ts`, `tests/setup.ts`, `tests/token.test.ts`, `tests/voice.test.ts`, `tests/dialer.test.tsx`, and this report.

Read and preserved `docs/BASELINE_REPORT.md`, `docs/BUILD_PLAN.md`, existing requirements/sample files and local rules. No plan acceptance checkboxes were rewritten. No status/recording/SMS handler, schema, auth implementation or provider settings were changed. No commit, push, deploy, migration, DB push, real call, SMS, live provider API request or live app/database operation was performed. Network access was limited to package metadata/install/audit tooling.

The supplied inbound URL **https://www.get247roi.com/api/voice/inbound** and missed-call text-back were not touched or tested. Callback priority, promise tracking and the compact brief only after **connected talk time >150 seconds** remain future work; none enables recording.

Rollback is local and scoped: review/revert only the implementation/configuration files listed above, preserving all existing planning documents and the baseline lockfile provenance. Reverting the safety code would restore the unsafe handoff/recording behavior, so it is not a recommended live rollback. There was no deployed state to undo.
