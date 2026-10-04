# Phase 0 — local baseline report

Baseline observed 2026-10-03 UTC, checkout `/home/precision_focused_solutions/crm`, branch `main`, commit `9c871dc`.

**Outcome: dependency installation, production build and standalone typecheck pass. Lint is blocked by missing setup. Security and staging gates remain open; this is not completion of all P0 acceptance criteria.**

## Scope and change boundary

Read the workspace business-context rule, repository `.cursor/rules/vercel-env-automation.mdc`, `docs/BUILD_PLAN.md`, README, manifest/configuration, Prisma schema, auth/access paths and Twilio handlers. The environment-sync rule was read, not executed: this task explicitly forbids live configuration changes.

Deliverable files created by this baseline:
- `package-lock.json`
- `docs/BASELINE_REPORT.md`

No production source, package manifest, environment files or requirements documents were edited. Existing untracked planning files (`docs/BUILD_PLAN.md`, `docs/mobile-dialer-requirements.md`, `docs/pa-lead-sample.csv`, `docs/pa-lead-sample.json`) were preserved. Dependency/build commands generated ignored local `node_modules/`, `.next/` and `next-env.d.ts`; no copies of build artifacts or large logs were added to the repository. No commit, push, deployment, migration, DB push, provider request, call or SMS was performed. No live app endpoints were invoked.

## Actual command results

Commands ran from the checkout above, using Node `v22.22.3` and npm `10.9.8`.

| Command | Exit / result |
| --- | --- |
| `CI=1 npm install --no-fund` | **0**. Added 148 packages; audited 149 in 39 seconds. Generated lockfile. Existing postinstall `prisma generate` succeeded, generating Prisma Client `6.19.3`. Deprecation warning for `scmp@2.1.0`. Audit reported 5 vulnerable packages: 1 moderate, 4 high. |
| `CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build` | **0**. Existing script `prisma generate && next build` completed. Next.js `15.5.27`: compiled successfully in 22.8 seconds, checked types, generated 30/30 static pages, finalized optimization and build traces. Dashboard/API paths appear as dynamic routes. No missing-environment build error occurred. Warnings: no initial build cache; webpack large-string cache serialization. |
| `CI=1 npm exec --no -- tsc --noEmit --incremental false` | **0**, no diagnostic output. Uses installed TypeScript `5.9.3`. There is no package `typecheck` script, so this directly exercised the existing tsconfig after Next generated its types. Incremental output disabled to avoid another cache. |
| `CI=1 npm run lint </dev/null` | **1**. Existing `next lint` script emits deprecation warning, then asks “How would you like to configure ESLint?” with Strict/Base/Cancel choices. Closed stdin prevents configuration selection. No lint scan completed; no configuration was created. No ESLint dependency or config exists in the scaffold. |
| `npm audit --json` | **1**. 5 vulnerable package entries, 0 critical / 4 high / 1 moderate. Details below. No audit fix was run. |
| `npm ls --depth=0` | Completed and listed resolved packages. Also labeled `@emnapi/runtime@1.11.3` and `@img/sharp-wasm32@0.35.5` extraneous; recorded without pruning or altering the manifest. |
| `git diff --exit-code` | No tracked-file diff after install/build/lint/typecheck. |

A combined verification command using the direct `./node_modules/.bin/tsc` path was rejected by the tool's gateway-safety guard before execution (the tool reported a restart/stop prohibition despite the requested command being a typecheck). The equivalent installed compiler was then successfully exercised through `npm exec` as recorded above. This did not require bypassing a safety control or changing the environment.

Scripts were inspected before installation: postinstall and build generate a Prisma client only; neither migrates a database. `db:push`, `db:migrate`, `db:studio` and `vercel:sync-env` were not run. No automated test script/test suite was present in the initial inventory. A clean `npm ci` reinstall and runtime/browser tests were not performed; the new lockfile is generated, but a second clean-install reproducibility run is still a future check.

### Disk and generated artifacts

`df -h .` before installation: 96G filesystem, 87G used, 9.8G available (90%). After checks: 88G used, 8.1G available (92%). `du -sh node_modules .next`: 709M and 258M respectively. These are observations, not a claim that every filesystem delta belongs to this task; npm caches and other host activity can also contribute. Avoid retaining duplicate build outputs or running unnecessary reinstalls on this host.

## Environment: build success is not runtime readiness

Only `.env.example` and `.env.vercel-sync.example` were present at the repository root. No relevant Supabase, Twilio, Postgres/database or application-URL variable names were exported in the command environment. No secret values were printed, read into this report, invented or provisioned.

The production build genuinely succeeded without these values because it did not exercise authenticated dynamic requests/database operations. Runtime access remains unverified and lacks configuration:
- `src/lib/supabase/env.ts:6-40` requires a Supabase URL and publishable key for normal clients; the admin path separately requires a server-only secret. With no URL, the helper throws `Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL from Supabase↔Vercel integration)`.
- Middleware creates a Supabase client across almost all routes (`src/middleware.ts:8-12`, `src/lib/supabase/middleware.ts:8-10`). Missing Supabase config can therefore prevent reaching a route's own 401/503 response. This is a source-derived expectation, not an HTTP result from this run.
- Prisma actually reads `POSTGRES_PRISMA_URL` and `POSTGRES_URL_NON_POOLING` (`prisma/schema.prisma:5-9`). README still lists `DATABASE_URL` / `DIRECT_URL`; reconcile documentation before provisioning staging. Client generation is not a database connectivity test.
- Twilio token creation needs account SID, API key, API secret and TwiML app SID. Voice generation also references caller ID and app URL. No provider configuration or credential validity was checked here.

## Dependency audit

The npm audit output identified these dependency paths:
- **High:** `prisma -> @prisma/config -> deepmerge-ts`, recursive object graph stack exhaustion: [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx). The audit marks three affected package entries along this path, not three independent root advisories.
- **High PostCSS / moderate Next package entry:** `next -> postcss`, including CSS stringify XSS and source-map path traversal/file disclosure: [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93), [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q), [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp), [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849).

These are registry audit findings, not demonstrated exploitability of this application. Audit suggested a semver-major Next upgrade as a fix; no automatic fix or major upgrade was applied. Review runtime/build exposure and compatible remediations in a separate dependency-change slice.

## Read-only auth and row-access audit

Findings below are static source observations; no account was created and no authorization exploit was exercised.

1. **High — role bootstrap trusts user-controlled metadata.** `src/lib/auth.ts:18-28` reads `user.user_metadata.role`, casts it to `UserRole`, and persists it when the profile is first created. User-editable metadata must not determine privileged roles. Existing profiles are not overwritten (`update: {}`), so this particular issue concerns profile bootstrap rather than every subsequent request. Use a safe default or a trusted server-side invitation/role assignment.
2. **High — manager can create an admin.** `src/app/api/users/route.ts:30-32,55-71,81-93` permits a sales manager to create a user with any role from a schema that includes `admin`, while PATCH requires admin. Constrain role-granting authority consistently across creation and updates.
3. **High — authentication is not row/role authorization.** Lead list defaults to all matching leads; `myLeads` is optional (`src/app/api/leads/route.ts:21-43`). GET/PATCH by ID use only the supplied ID after checking a profile, and PATCH accepts `setterId` (`src/app/api/leads/[id]/route.ts:6-58`). Task creation accepts an arbitrary lead ID (`src/app/api/tasks/route.ts:12-26`). Decide the shared-lead/team policy explicitly and enforce it server-side, especially for the `client` role. Nav visibility is not an access boundary. `buildLeadWhere` can also overwrite `myLeadsOnly` with an explicit setter filter (`src/lib/leads/filters.ts:27-33`).
4. **Existing positive controls, not blanket approval:** normal CRM APIs check `getCurrentProfile`; profile updates select the current user; SmartViews are user-scoped; task updates include current `userId`; user-management APIs have role checks. These need denial tests and schema validation. Task PATCH lacks an input schema; an omitted ID can remove that Prisma filter and affect multiple tasks owned by the user (`src/app/api/tasks/route.ts:38-42`).
5. **Database access remains unverified.** Prisma queries use a database connection, not a per-request Supabase JWT/RLS client. No policy/migration evidence in this checkout establishes effective row isolation. Live RLS policies, DB roles, staging separation and backup/restore were not inspected. Do not assume Supabase protects these server queries automatically.
6. **Adjacent fail-open webhook:** GHL's secret check is conditional on its environment variable being set (`src/app/api/webhooks/ghl/route.ts:10-12`); missing configuration does not deny the request. Integration behavior was not invoked.

## Read-only Twilio audit

| Surface | Existing behavior and safety gap |
| --- | --- |
| `/api/twilio/token` | Requires a profile and checks required configuration; grants outgoing access, `incomingAllow: false`. No explicit role/eligibility check, short TTL policy, rate limit or default-off calling flag is visible (`token/route.ts:5-48`). |
| `/api/twilio/voice` | No Twilio signature validation or server-authorized call intent. Accepts arbitrary form `To` and emits `<Dial><Number>` TwiML using an environment caller ID. No server-side allowed-destination, suppression, timezone, spend or concurrency gate. Generating TwiML alone does not place a call, but provider use of this endpoint would lack these protections (`voice/route.ts:4-26`). |
| Recording default | Voice handler unconditionally specifies `record: "record-from-answer-dual"` (`voice/route.ts:21`). This directly contradicts the updated requirement: recording OFF by default, explicit per-call discovery toggle only with consent. No consent record or unrecorded-decline path is implemented. |
| `/api/twilio/status` | No signature verification. Trusts submitted `leadId`, `userId` and `CallSid`; upserts records and increments `dialedCount` on every completed delivery. Duplicate callbacks can double-count; out-of-order callbacks can regress status. Unknown statuses map to completed; the mapping uses `in_progress` rather than the provider's `in-progress`. Duration parsing is not validated. No authoritative parent/child SID binding (`status/route.ts:4-44`). |
| Status wiring | Voice TwiML supplies a recording callback but no status callback or authoritative lead/user binding (`voice/route.ts:18-26`). Do not treat the separate status endpoint as proven connected logging. |
| `/api/twilio/recording` | Unsigned input stores arbitrary `RecordingUrl` against a supplied CallSid. No consent association, provider/account validation, early-event reconciliation, retention or private authorized playback lifecycle (`recording/route.ts:4-13`). This write does not itself fetch the URL; no SSRF execution was tested or claimed. |
| Actual dialer | `src/components/dialer/dialer-panel.tsx:55-60` always launches a `tel:` handoff. Token readiness does not implement browser voice; no Voice SDK dependency is installed. Next-lead is a read, not an atomic lease. No reliable call-state/wrap-up gate or default-off safety switch is present. |

All Twilio route references above are under `src/app/api/twilio/`. Missing signatures on callbacks are not remedied by middleware: middleware only redirects unauthenticated dashboard traffic, not these API paths.

### Inbound protection and updated product constraints

The supplied existing inbound voice URL is **https://www.get247roi.com/api/voice/inbound**, with missed-call text-back already in service. It is outside this checkout's Twilio handlers; its behavior was not reverified here. This baseline did not inspect or modify its live configuration. Preserve both voice routing and text-back, and require a separately authorized audit/rollback plan before any future cutover.

Callback priority and promise tracking are confirmed requirements, not implemented features. A compact post-call brief is allowed only when **connected talk time is strictly greater than 150 seconds**, using permitted transcript content or authored notes. It must not automatically activate recording or equate ringing/total elapsed time with talk time. Existing call duration storage does not demonstrate these requirements. Keep recording off by default and require explicit per-call opt-in plus consent for discovery calls.

## Next smallest implementation slice (not performed)

**P0.1: offline safety regression harness and default-off outbound behavior**, before browser voice, migrations or live credentials.

1. Add explicit noninteractive lint/typecheck/test scripts and an ESLint configuration compatible with the installed Next version. Establish a small mocked test harness with no network/database effects.
2. Write failing tests proving outbound token issuance and dial TwiML fail closed when the calling feature is unset/disabled; include the `tel:` fallback so missing Twilio credentials cannot silently enable phone-app dialing.
3. Implement that default-off boundary and remove unconditional recording. Tests must prove no recording instruction without explicit per-call consent, and no live provider requests. Defer actual recording activation until a consent model exists.
4. Run tests, standalone typecheck, lint and build; perform a clean lockfile install in a disk-appropriate isolated environment. Keep the manifest/production edits for that separately authorized slice, not this baseline.

Acceptance: no external-call path enabled by default; recording off; all four local quality gates genuinely execute. This slice is not sufficient to enable live dialing: role bootstrap, row authorization, signed/idempotent callbacks, authoritative call intents, dependency remediation and isolated staging/backup gates must also be resolved first. No database migration or inbound routing change is needed for this first slice. Rollback is limited to its local code/config changes; this baseline itself has no production rollback action.

## P0 gates still open

- Working noninteractive lint and automated denial/regression tests.
- Dependency vulnerability triage/remediation.
- Runtime authenticated access and role/row authorization verification in isolated staging.
- Authorized deployment/database inspection; backup and restore rehearsal.
- Default-off external calling, explicit recording consent, signed and idempotent webhook handling.
- Approved inbound/text-back inventory and rollback documentation; provider trust/registration discovery.
- No live telephony, SMS, production database or mobile calling verification has been claimed.
