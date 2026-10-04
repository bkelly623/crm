# Local application persistence — actual Prisma/PostgreSQL verification

**Executed:** 2026-10-03 UTC. **Result: PASS — 13/13 integration tests, 1/1 file**, final run started 23:35:28 and completed in 1.97 seconds (exit 0). Earlier 11-test run also passed and verified cleanup; the final run added two-list persistence and post-reassignment task denial.

This closes a **bounded local handler-to-database persistence check**, not full application, Supabase staging, or production readiness. No production code, dependency/package file, Prisma schema, existing test/config, cloud resource, deployment or commit was changed by this harness. No build was run. Concurrent list/queue work was left alone; only this separate suite was executed.

## What was exercised

The tests directly invoke the current exported Next route handlers with real `Request` objects:

- `src/app/api/leads/[id]/route.ts` — GET and PATCH.
- `src/app/api/tasks/route.ts` — POST and PATCH.
- `src/app/api/lead-organizers/[kind]/route.ts` — GET and POST.
- `src/app/api/leads/[id]/organizers/[kind]/route.ts` — PUT and DELETE.

**Only application authentication (`getCurrentProfile`) is mocked.** The mock returns real synthetic Profile rows created by this harness, or null for anonymous tests. It never imports or calls Supabase Auth. The actual `src/lib/prisma.ts` singleton, generated installed Prisma Client, validation/access helpers, nested connects/upserts, relation filters, and local PostgreSQL execute normally. A **separate PrismaClient/connection** verifies persisted records independently of route response bodies. `fetch` is replaced with a throwing function; no HTTP server, provider call, external API, call or SMS is involved.

Read before design: local database report, schema/generated client environment metadata, current handler/auth/Prisma/access/validation code, package and Vitest configuration, access-status and lead-workspace reports. Existing fast tests use database mocks; this harness deliberately does not.

## Isolation and write guards

- Reads only `~/.config/crm/local-staging.env` as data in process, with mode **0600** required. No shell sourcing, secret printing, application `.env` loading, or production environment fallback.
- Requires literal `PGHOST=127.0.0.1`, `PGPORT=55437`, and `POSTGRES_DB=crm_local_staging` before constructing the URL. Credentials are URL-encoded using the URL API.
- Validates PostgreSQL protocol, **exact host `127.0.0.1`, port `55437`, database `/crm_local_staging`**, no fragment, and only the fixed `connection_limit=2` query. Wrong host, localhost alias, wrong port/database and query overrides are rejected in tests.
- Config and worker setup each apply the guard and override database environment URLs with the validated local URL. Inherited provider/database environment variables are removed from the test process; external credential files are not read. Vite automatic env-file loading is disabled.
- Before the first fixture write, **both actual Prisma clients** query server identity and assert database `crm_local_staging` and internal server port `5432` (the already-established Docker mapping is host 55437 → container 5432).
- Synthetic fixtures use a fresh `local-app-<random UUID>` namespace, random UUID profile IDs, `example.invalid` email addresses, and null phone numbers. No copied contacts or real destinations.
- Existing retained PostgreSQL/container/schema/data are reused. No startup/verifier rerun, reset, migration, DDL, container change or broad deletion.

## Actual results

| Check | Observed outcome |
|---|---|
| Isolation guard negative cases | PASS: rejected nonlocal/alias host, wrong port/database, query override and fragment |
| Lead GET/PATCH and Notes | PASS: owned lead loaded; business name/email/segment and multiline Unicode shared Notes persisted; independent reads matched; Notes could be cleared to SQL null without changing owner/source |
| Task creation/completion | PASS: scoped nested lead/user connects produced an owned open task; independent read matched note and due instant; completion persisted; lead GET included open task and excluded completed task |
| Task owner denial | PASS: other rep and sales manager received `{ updated: 0 }`; task remained open |
| Tag creation/membership | PASS: normalized key and real Date read back; repeated PUT yielded one link; catalog reflected selected state; repeated DELETE yielded zero links |
| List creation/membership | PASS: normalized key, UUID owner and real Date read back; repeated PUT/DELETE were idempotent; catalog reflected selection |
| Foreign list owner / lead scope | PASS: foreign-owner list and other-owner/unassigned lead memberships returned 404; independent link counts stayed zero |
| Other-owner/unassigned leads | PASS: rep GET/PATCH/task creation returned 404, lead records unchanged and no tasks created; rep reassignment attempt returned 403 |
| Non-sales and anonymous | PASS: assigned client-role actor denied with 403 and null actor with 401 across tested reads/writes; complete ten-table row-count/content snapshots unchanged after attempted operations |
| Manager and closer-assignment branch | PASS: manager accessed an unassigned lead and assigned rep as closer via UUID; independent read matched; rep then accessed that lead |
| One master lead in two lists | PASS: two persisted memberships, one exact master lead, unchanged total lead count |
| Post-reassignment task access | PASS: manager reassigned the real lead; former owner could no longer complete their existing task; status remained open; manager restored fixture assignment |
| Native types and ORM rollback | PASS: actual catalog types matched UUID, UserRole/TaskStatus enums, core `timestamptz(6)` and draft `timestamp(3)`; invalid UUID raised Prisma P2023; real FK violation P2003 rolled back an earlier Notes update in the same Prisma transaction |
| Cleanup and retained data | PASS after both runs: only exact fixture IDs/composite IDs deleted; all **10 tables' row counts and ordered row-content digests** equal their pre-run baselines |

The rollback test intentionally triggers the real `leads_setter_id_fkey` constraint. The application's existing Prisma logger prints that expected constraint error and code location; it is **not a failed test**, and no credential/connection URL is printed. The test asserts the rejection and independently verifies full lead restoration, including `updatedAt`.

Native-type checks demonstrate that these installed ORM operations work against the reconstructed native types. They **do not resolve schema drift**: core timestamps remain `timestamptz(6)` while the Prisma model has generic DateTime, and draft organizer timestamps remain `timestamp(3)`. The tested due instant has millisecond precision; JavaScript Date does not prove lossless microsecond round-tripping. No index/FK action, timestamp type, schema or migration was changed.

## Cleanup discipline

The harness records created profile/lead IDs, response-returned task/organizer IDs and attempted exact membership keys. If a response/assertion fails after a commit, teardown recovers IDs using only exact names in the fresh random namespace or exact owned fixture lead/profile IDs, then deletes **by exact IDs**. It never uses a prefix delete, unfiltered delete, truncate or reset. Cleanup reads the same exact target back through all-table count/content-digest comparisons before reporting success:

```text
LOCAL_DB_CLEANUP_PASS: exact fixtures removed; all 10 table counts/content digests equal pre-run baseline
```

An abrupt process kill can bypass teardown; do not reset the retained database in response. Review and remove only identified fixtures if such an interruption occurs. Successful normal execution of both observed runs left the previous data intact.

## Reproduction and separation from fast tests

From `/home/precision_focused_solutions/crm`:

```sh
CI=1 ./node_modules/.bin/vitest run --config tests/local-db/vitest.config.ts --reporter verbose
```

Final actual summary:

```text
Test Files  1 passed (1)
     Tests  13 passed (13)
  Start at  23:35:28
  Duration  1.97s
```

Requires the **already-running** local staging database and the private credential file. Fails closed if either is unavailable/incorrect. Do not run the historical database initialization scripts against retained data.

The normal root config includes `tests/**/*.test.{ts,tsx}`. The DB suite is deliberately named **`persistence.integration.ts`**, with its own explicit include and setup, so the existing fast suite does not select it and does not acquire a database requirement. Existing root config/package scripts were not edited. This worker did not rerun the normal suite while the list/queue worker was editing it.

Additional validation commands were attempted but **blocked before execution by the tool's gateway-restart safety hook** (the commands did not request a gateway restart): scoped ESLint plus fast-suite file listing, and scoped TypeScript checking. They were not rerouted or retried through another execution path. Therefore **no lint, standalone typecheck, or executed fast-suite discovery PASS is claimed**. Parent review/consolidated verification should cover these. The separate `tsconfig.json` is provided for `tsc --project tests/local-db/tsconfig.json --noEmit --incremental false` without importing generated `.next` build types.

## Files created by this task

- `tests/local-db/guard.ts` — private env parser, exact local allowlist and process-only configuration.
- `tests/local-db/vitest.config.ts` — isolated serial Node integration selection, no env-file loading.
- `tests/local-db/setup.ts` — explicit auth mock and forbidden external fetch.
- `tests/local-db/persistence.integration.ts` — current handlers + actual Prisma/PostgreSQL assertions and exact fixture cleanup.
- `tests/local-db/tsconfig.json` — scoped no-output typecheck configuration.
- `docs/LOCAL_APP_PERSISTENCE_REPORT.md` — this report.

## Still unverified / not implied

- **Supabase Auth**, actual cookies/JWTs, profile bootstrap, middleware, PostgREST/Data API, Supabase-specific runtime behavior, and production database wiring.
- Browser HTTP routing, React interactions, **mobile rendering**, actual-phone keyboard/date/timezone handling, audio and hydration. Direct in-process handler calls do not exercise those layers.
- **Live calling**, Twilio/other external integrations, recordings, inbound missed-call text-back, callbacks, approved-recipient behavior, Vercel preview/deployment and production release.
- Least-privileged server-role/RLS behavior: the authorized local database credential is the rehearsal owner; handler authorization is real, but this is not an RLS/session-role certification.
- Exhaustive role/route coverage, concurrent ownership/membership races, load/reliability testing, lost-response task idempotency, and server restarts/durable recovery. Notes remains one last-write-wins shared field, not authored history.
- Production and cloud changes remain prohibited. The local database is the pre-existing bounded **volatile tmpfs** rehearsal environment described in `LOCAL_DATABASE_REPORT.md`, not durable staging.
