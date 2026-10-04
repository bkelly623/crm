# Master Leads filters and dialer review queue

## Outcome

Local implementation in `/home/precision_focused_solutions/crm`. **368 tests in 22 files pass; lint, production build, standalone typecheck and `git diff --check` pass.** Named lists and tags now filter master Leads and the dialer **lead-review queue**, using the existing organizer catalog/membership tables and shared sales access helper.

This is **not live calling, a persistent calling lease, or a concurrency-proof dialer**. Calling remains disabled, no `tel:` handoff was added, and no recording/provider/inbound/text-back code was changed. Existing dirty-worktree changes were preserved.

No schema changes, SQL application, database/credential access, secret provisioning, dependency installation, external API calls, deployment, commit or push were performed by this slice. The separate staging audit is outside this worker's evidence. Build regenerated the existing local Prisma client without connecting to a database.

## Authorization and query contract

### Shared scope

Both touched GET APIs and both server page entry points reuse `salesLeadScope`:

- `admin`, `sales_manager`: all sales leads; may select any named list.
- `sales_rep`, `closer`, `hybrid`: setter **or** closer assignment to the current profile; named lists must be owned by that profile.
- `client`, `hiring_manager`, `project_manager`, unknown roles: denied before lead/catalog queries.
- Anonymous APIs return 401; denied roles 403. Pages redirect anonymous users to login and use not-found for denied roles.

List ownership is **not** a grant to its members. The lead assignment scope, list membership, tag membership, search/segment filters and queue eligibility are separate Prisma `AND` clauses. Search's `OR` cannot replace assignment's `OR`. Selected list existence/ownership is checked first, and list-owner scope is repeated inside the membership predicate. Empty lists remain empty; inaccessible/missing lists/tags do not fall back to the full pool.

### `GET /api/leads`

Allowed query keys:

- `segment`: active (default), won, trashed, all.
- `q`: at most 300 characters.
- `myLeads`: exact true/false; optional additional setter-only filter, never an access grant.
- `listId`, `tagId`: existing organizer CUID validation.
- `after`: existing bounded lead identifier validation; whitespace is rejected, not repaired.

Unknown/repeated scalar parameters and malformed values return 400. Missing/inaccessible organizer returns 404. Storage failures return generic 500 messages without database details.

Response: `{ leads, nextCursor }`. Unique immutable `id ASC` ordering, `id > after`, 51-row lookahead, at most 50 returned. No offset pagination or mutable `updatedAt` sorting. A lead edit does not move its ID across pages. This is not a database snapshot: concurrent membership/assignment changes can change which records qualify. No global total is invented.

### `GET /api/dialer/next-lead`

Allowed keys: optional CUID `listId`, `tagId`, `smartViewId`, and repeated `exclude` lead IDs. Scalar duplicates/unknown fields/malformed values return 400. **At most 100 exclusions** are accepted; each uses the existing lead-ID bound of 200 characters. Duplicates count toward validation before being deduplicated for the query. No client role, owner or assignment override is accepted.

A selected SmartView must belong to the current user. Missing views return 404 rather than reverting to all leads. Stored filter JSON is validated; malformed/unknown fields return 400. The view's explicit setter, my-leads and status constraints are independently intersected, never allowed to overwrite one another or access/eligibility.

Review eligibility is deliberately conservative: active segment, status in `no_contact`, `follow_up_needed`, `callback_scheduled`, and phone neither null nor empty. Won/trashed, appointment-booked, DNC, wrong-number, not-interested and unknown statuses are excluded. Explicit filters cannot re-enable them. Results use unique `id ASC`; response is `{ lead }`, with null for no eligible unreviewed result.

**This predicate is only review eligibility.** It does not validate phone numbers, consent, suppression across systems, recipient timezone, cooldowns, calling windows, spend or legal permission to call.

## User-facing behavior

### Master Leads

- Labelled search, segment, named-list and tag controls; explicit Apply filters.
- Existing catalog endpoints are lazy-loaded independently, with bounded More pagination, deduplication, loading/error/retry and empty states. No schema-dependent catalog query runs just to open the board.
- One-column phone / two-column wider filter layout; 44px minimum-height controls, 16px input text, shrinkable containers, wrapping lead cards rather than a wide table.
- Applied filters are preserved across Next/Previous; Apply returns to the first page. UI distinguishes draft controls from applied results with explanatory copy.
- Visible loading, page counts, empty results and error/retry states. Failures are not shown as empty success. Bad initial URL filters show a clear-filters link.
- Server refresh after existing create/import actions invalidates client results while retaining applied filters. Navigating to different URL filter props remounts the board with the new query. UI changes themselves remain in component state; this slice does not implement saved filters or URL-history persistence.
- Master results now load through the authorized API, eliminating the former independent unscoped server-page lead query.

### Review queue

- Named list, tag and existing SmartView selectors combine by intersection. Existing first-SmartView default is retained; choose “No saved filter” to remove that additional constraint.
- Selection changes clear the displayed lead; they do not silently reuse an old lead under the new selection. Reviewed exclusions remain for the mounted session across filter changes and Stop.
- Complete catalog reloads clear a selection that is no longer available. Partial pages do not falsely clear a later-page selection. Catalog failures retain selection and show retry. Queue 400/404 clears selected filters and current lead, shows an error and **does not auto-load all leads**.
- A selection-generation guard ignores queue responses invalidated by an in-flight catalog reload.
- Save & Next checks the PATCH result before advancing. Failure retains the lead and disposition; successful save/explicit Next adds the current ID to in-memory exclusions. A failed next-fetch after successful save does not lose those exclusions or automatically resave the prior record.
- Synchronous in-flight protection and disabled controls prevent duplicate saves/next requests within this component. Pause blocks progression; Resume restores it; Stop clears the current display and pause but retains exclusions.
- At 100 reviewed/skipped leads, stop and show an explicit session-limit message. Never evict old exclusion IDs to keep cycling. Reload/navigation/unmount starts a new in-memory session. Server-side exclusion enforcement is request-local, not a durable lock.
- Empty/error/loading states are visible. A repeated reviewed lead from an inconsistent response is rejected rather than redisplayed.
- Call remains disabled. No Twilio token request, live call, recording instruction or phone-app handoff is made.

## Test-first evidence

Tests were run against missing behavior before the corresponding implementation. The following are actual observed runs, not fabricated expected outcomes:

| Boundary / targeted command | RED observed | GREEN observed |
| --- | --- | --- |
| `npm test -- tests/list-queue-api.test.ts`: role denial and assignment intersection | 7 failed: 200 instead of 403; missing AND assignment | 7 passed |
| Same: authorized list lookup + list/tag intersection | 4 failed / 7 passed: ignored list selection and missing ownership lookup | 11 passed |
| Same: lead-query validation, pagination, safe storage errors | 11 failed / 11 passed | 22 passed |
| Same: queue validation/exclusion bound, immutable ordering, saved-filter/eligibility intersection | 11 failed / 22 passed | 33 passed |
| `npm test -- tests/list-queue-ui.test.tsx`: select → review → save/next, pause/error/stale selection | 4 failed: missing controls, repeated first lead, unguarded pause, no stale-selection error | 4 passed; existing safety suite also passed |
| Same: paginated catalog/reload invalidation | 1 failed / 5 passed: missing More lists | 6 passed |
| `npm test -- tests/list-queue-pages.test.tsx`: page role gates and review-only copy | 6 failed | 6 passed |
| `npm test -- tests/leads-board.test.tsx`: phone filters → pagination and visible failure/retry | 2 failed | 2 passed |
| Queue/catalog async race | 1 failed / 6 passed: stale lead rendered after selection was cleared | 7 passed |
| Leads board server refresh and URL navigation regression | 2 failed / 2 passed: stale results/query retained | 4 passed |

The old safety fetch fixture was updated to include actual HTTP `ok/status` fields because the component now checks response success. Its no-token/no-handoff/disabled-Call assertions remain intact. One new selector-test harness was corrected to wait for fetched options before dispatching its change; this was not a production workaround.

Additional post-GREEN characterization strengthens, but is **not represented as new RED evidence**:

- Fixture evaluation of composed predicates for staff assignment, unassigned/other-owner leads, list+tag+search intersections, missing tag and ineligible queue rows. API suite ends at 39 tests.
- Real component → local fetch dispatcher → real catalog/queue/PATCH route handlers, with only auth and Prisma mocked: a named-list review session returns only assigned members, saves each once, finishes empty and remains empty after Stop; 100-review cap issues no over-limit request; pending double-save yields one scoped mutation and preserves failed disposition.
- Master board component tests likewise dispatch list requests into the actual local GET handler.

All tests use synthetic fixtures. `tests/support/lead-query-fixture.ts` is a deliberately small predicate evaluator, **not a Prisma or PostgreSQL emulator**. It demonstrates that the constructed predicates exclude fixture rows; it does not prove actual generated SQL or live persistence.

## Final verification

Successful final chain, exit 0:

```sh
CI=1 npm test &&
CI=1 npm run lint </dev/null &&
CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build &&
CI=1 npm run typecheck &&
git diff --check
```

- Vitest 3.2.7, reported start **23:30:51**: **368/368 tests, 22/22 files**, duration 12.26s.
- ESLint `--max-warnings 0`: passed, no diagnostics.
- Prisma Client 6.19.3 generated locally; Next.js 15.5.27 compiled in 11.8s; build lint/types passed; **30/30 static pages generated**; build traces completed.
- Built routes include both APIs and both pages. Dialer first-load JS 109 kB; Leads first-load JS 110 kB.
- Standalone `tsc --noEmit --incremental false` after build: passed, no diagnostics.
- `git diff --check`: passed.
- Prior full verification before the refresh regression refinement: 366 tests passed, plus lint/build/typecheck/diff check. The final total above supersedes that run.
- Scoped source/diff review and dangerous-code/debug/secret-pattern searches performed; no matches in lead components/helpers. Independent reviewer subagent tooling was not available to this worker; parent review remains appropriate. No staged/committed verification claim.
- Disk check: 6.7G available, 94% used. Existing dependencies/build artifacts reused.

## Exact paths owned by this slice

Modified:

- `src/app/api/leads/route.ts` — GET only; existing POST unchanged.
- `src/app/api/dialer/next-lead/route.ts`
- `src/app/dashboard/leads/page.tsx`
- `src/app/dashboard/dialer/page.tsx`
- `src/components/dialer/dialer-panel.tsx` — retained disabled calling/no handoff.
- `tests/dialer.test.tsx` — realistic success response fixture only.

Created:

- `src/lib/leads/query.ts`
- `src/lib/leads/selection.ts`
- `src/lib/leads/review.ts`
- `src/components/leads/organizer-select.tsx`
- `src/components/leads/leads-board.tsx`
- `tests/list-queue-api.test.ts`
- `tests/list-queue-ui.test.tsx`
- `tests/list-queue-pages.test.tsx`
- `tests/leads-board.test.tsx`
- `tests/queue-review-integration.test.tsx`
- `tests/support/lead-query-fixture.ts`
- `docs/LIST_QUEUE_REPORT.md`

Active-profile sales CRM procedural memory was updated with intersection, review-session and refresh/race lessons. No other profile changed. Do not attribute pre-existing schema, telephony/auth/mobile/workspace modifications in the shared worktree to this slice. Roll back only the paths/hunks above, preserving earlier safety work.

## Remaining limits / staging acceptance

1. **No DB access and no SQL application.** The existing organizer schema draft is still unapplied by this worker. Catalog/member filtering requires its tables. Before schema application, unfiltered Leads/queue do not query new tables; explicitly requested catalogs/organizer filters show localized safe failures. This is not evidence the deployed database currently supports lists/tags.
2. Require separately authorized isolated staging, backup/restore, reviewed schema application and exact readback. Exercise real Prisma relation predicates, database collation/keyset behavior, RLS/server-role isolation, ownership/assignment changes, Supabase sessions/middleware and persisted disposition readback. Build success does not prove any of these.
3. No fresh real-browser/physical-phone run was performed. jsdom verifies actual React interactions and control classes, not CSS geometry, native select/keyboard usability or session expiry on the user's phone.
4. No cross-tab, cross-device or multi-rep exclusion/lease exists. Refreshing/unmounting resets the session. Another user can review the same lead. Historical reviewed IDs are request-local hints, not a security boundary or calling authorization.
5. Scope hardening is limited to these list/queue reads and page entry points plus the earlier detail/membership scopes. Lead creation/import, dashboard aggregates and other legacy routes still require an app-wide authorization audit. Existing POST `/api/leads` was intentionally not expanded in this read/filter slice.
6. Save response loss can leave the user uncertain whether a disposition persisted; retrying that scoped field update is allowed. There is no audit trail, optimistic version, snapshot isolation or durable calling state. Review/filter state is not persisted across navigation.
7. Existing get247roi inbound missed-call text-back and recording/calling safeguards were untouched. Their prior live verification gates remain separate; no new inbound/provider readiness claim is made.
