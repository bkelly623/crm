# Calls today — source fix and verification

## Outcome and exact source causes

The baseline `14af7f4` Home counter was a server-rendered snapshot from `prisma.call.count`, using `new Date(new Date().setHours(0, 0, 0, 0))`. This selects the **server's** midnight, ignores `Profile.timezone`, and has no exclusive next-midnight bound. The rendered label explicitly said server time. No polling, call-result refresh, visibility refresh or calendar-rollover mechanism existed. A mounted page could retain yesterday's count indefinitely, regardless of whether the server query would return a different answer on a new navigation.

The baseline Dialer page/panel had **no calls-today counter**. The Call log has a separate latest-200 list explicitly labelled “shown today (server time)”; it is not the Home aggregate. This scoped change does not relabel or alter that separate log.

Ranked hypotheses checked: (1) retained server snapshot; (2) server/actor day mismatch; (3) count drawn from cumulative lead dialedCount or session increments; (4) provider duplicate callbacks. Source and executable regressions confirm (1) and (2). The Home query already counted Call rows, not lead dialedCount or intents; no counting mutation was needed. Existing lifecycle creates one Call on the first associated child event and updates that record on subsequent events. No provider/lifecycle source was changed.

**Production-specific limit:** the user's exact three production rows, browser session and timezone were not read. These are confirmed source defects and reproductions, not a claim that those particular production rows had the synthetic timestamps below.

## Change

- `src/lib/calls/today.ts`: common scoped aggregate, using authenticated actor ID AND the current `salesLeadScope` relation. Managers still see their own activity, not everybody's calls. Calendar-day bounds use the stored actor timezone, inclusive start/exclusive next-day start, accounting for DST rather than adding 24 hours. Invalid/missing timezone explicitly falls back to UTC and the displayed label says UTC; no profile/environment/schema write.
- `src/app/api/calls/today/route.ts`: dynamic authenticated GET, 401/403 guards before sales reads, private/no-store response and generic 503 on failure. No caller-selected actor, timezone or date parameters. Standard existing `getCurrentProfile` authentication is reused.
- `src/components/dashboard/calls-today-card.tsx`: shared live counter on Home and Dialer. Re-reads on mount, every 15 seconds while visible, focus, online and visibility restoration, plus actor-day rollover. Uses only persisted server counts; repeated results replace values and never increment them. An actual call appears within the next successful poll after its Call row is persisted, not on button click or SDK accept. No browser controller/panel/queue hooks or mutations were added.
- At midnight the expired number is removed before the read completes. Failed/timed-out reads show an unavailable marker, not a fabricated zero or yesterday's count. Requests time out after 8 seconds; superseded/unmounted requests are aborted and late responses ignored. Hidden tabs do not poll; returning visible refreshes immediately.
- `src/app/dashboard/page.tsx` and `src/app/dashboard/dialer/page.tsx`: mount the shared card with an initially scoped server snapshot.

“Calls” means **recorded call attempts by persisted Call.startedAt**, not answered conversations. Failed/busy/no-answer rows count if persisted, because they are real attempts. Preparation/reservation without a Call does not count. The existing lifecycle's startedAt is the record creation time on the first child event, not a retroactively fetched provider timestamp. No historical rows were rewritten.

## Executed RED → GREEN evidence

1. `npm test -- tests/calls-today.test.tsx` initially failed: frozen `2026-10-05T05:00:00Z`, America/New_York actor, three records at `00:30Z`, `01:00Z`, `03:59:59Z` rendered **3** although all belong to October 4 locally. The same test now renders **0** and asserts the exact scoped `04:00Z` to next-day `04:00Z` query.
2. `npm test -- tests/calls-today-api.test.ts` initially failed because the fresh count endpoint did not exist; after implementation all route authorization/no-cache/failure tests pass.
3. `npm test -- tests/calls-today-refresh.test.tsx` initially failed against actual Home/Dialer page components: Home retained **3** across local midnight, Dialer lacked a counter, failed rollover left **3** displayed. After implementation, both pages refresh to zero at midnight and then to a persisted one without double increments.
4. Added bounds/authorization coverage: spring 23-hour and autumn 25-hour New York days, Kathmandu fractional offset, invalid-zone fallback, exact start/end instants, actor vs other-owner calls, setter/closer overlap without duplication, reassigned/unassigned exclusions for reps and own-activity-only managers. Added hidden/focus, timeout, abort/late-response and unmount checks.

Tests created: `tests/calls-today.test.tsx`, `tests/calls-today-api.test.ts`, `tests/calls-today-refresh.test.tsx`.

One existing **page test fixture** in `tests/list-queue-pages.test.tsx` needed `prisma.call.count` added for the new Dialer card; it now also verifies denied roles never query calls. No queue behavior or queue assertions were changed by this worker. Controller/panel/queue source belongs to the separate failure-progression worker and was left untouched.

## Final verification

- `npm test`: **51 files / 800 tests passed**, full run starting 23:45:14 in tool output. Includes concurrent failure-progression worker changes visible in the shared checkout.
- `npm run typecheck`: PASS (`tsc --noEmit --incremental false`).
- Focused ESLint: PASS with `--max-warnings 0` on the new helper/card/route, both changed pages, calls-today tests and adjusted page fixture.
- `git diff --check`: PASS.
- First full run exposed only the missing new count mock in the existing page fixture; corrected it and reran the full suite successfully.

## Limits and operational scope

These are real rendered-component (jsdom), server-function and route executions with synthetic authentication/Prisma/HTTP boundaries. They do not verify production row timestamps, physical-phone audio, a deployed browser, database/RLS execution, provider persistence or authenticated production behavior. No production/provider requests, credential reads/refreshes, production writes, schema/environment changes, build, deployment or commit were performed. The existing preview `.next` was not rebuilt. Poll refresh is bounded/eventual (15 seconds plus request latency), not a push subscription. Existing Call log server-time semantics and unrelated historical Home copy were deliberately left outside this fix.
