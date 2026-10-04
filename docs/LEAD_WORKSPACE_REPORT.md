# Lead workspace — bounded existing-schema slice

Observed locally on 2026-10-03 UTC in `/home/precision_focused_solutions/crm`.

## Outcome

Implemented a usable lead-detail edit → save → create follow-up → complete follow-up flow. Offline component tests dispatch requests through the actual route handlers, with only auth/database boundaries mocked. **262 tests pass across 13 files; lint, standalone typecheck, production build and `git diff --check` pass.** This is local implementation and mocked verification, not live database/staging acceptance or completed app-wide authorization.

Read the Prisma schema, auth/roles, existing lead detail/API/task paths, existing tests and reports, repository rule, supplied project rules and `docs/BUILD_PLAN.md`. Preserved the earlier dirty worktree. No dependency installation/change, schema/migration, real database access, credentials, provider request, call, SMS, environment provisioning, deployment or commit was performed.

## User-facing behavior

- Phone-first single-column forms, responsive wider layout, shrinkable containers, labelled fields, 44px minimum-height input/select/button utilities, visible focus styles and 16px input text.
- Editable existing fields: business name, contact name, phone, email, website, revenue, location, industry, SIC code, market, type, disposition, segment and **Notes**. Source/dial count remain read-only context; provenance, timestamps and ownership are not exposed as editable form fields.
- Notes is the existing nullable string. It is explicitly described as **one shared field, not a timestamped note history**. No authored-note model, invented authors/times or migration.
- Explicit save, unsaved/saving/saved/error states. Inputs disable during their pending operation. Failed saves retain drafts and permit retry. Only changed fields are sent, avoiding unnecessary overwrites of unrelated fields and validation of untouched legacy values. Existing unknown disposition values remain visible until deliberately changed.
- Create a self-owned follow-up with note and due date/time; show pending/error/success, retain failed form input, and add successful creation to the open list without refreshing away unsaved lead edits.
- Complete owned tasks; remove from the open list only after `{ updated: 1 }`. Zero matches and server failures retain the task with an error. Other team members' tasks remain visible for an authorized lead but have no completion control. Managers also cannot complete another user's task.
- Due-date entry uses device-local time converted to an ISO instant. Saved task times display explicitly in UTC, avoiding server/client timezone hydration differences. Past dates are allowed for intentional overdue follow-ups.
- Removed the inert Call and Book Appointment controls from the detail page; displayed calling/booking unavailability instead. No `tel:` handoff or simulated calling/booking.

## Scoped server policy

Shared `salesLeadScope` helper is applied to **only the touched surfaces**:

| Surface | Enforcement |
| --- | --- |
| Server-rendered `/dashboard/leads/[id]` | Auth checked before the lead query. Anonymous users redirect to login. Denied roles, missing records and records outside scope are not found. |
| `GET /api/leads/[id]` | Auth + role check, scoped lead query including its tasks/calls. |
| `PATCH /api/leads/[id]` | Auth + role check, validated allowlist, scoped lookup and assignment predicate repeated in the update itself. |
| `POST /api/tasks` | Auth + role check, scoped lead lookup and scope repeated in the nested lead connect; current profile is the task owner, status explicitly open. |
| `PATCH /api/tasks` | Existing validated task ID/status and exact current-user ownership preserved; additionally requires the task's lead to be in sales scope. Zero-match contract stays `{ updated: 0 }`; no broader retry. |

- `admin` and `sales_manager`: all sales leads.
- `sales_rep`, `closer`, `hybrid`: only leads whose `setterId` **or** `closerId` equals the current profile ID.
- `client`, `hiring_manager`, `project_manager`, unknown roles: denied, including when an assignment happens to match.
- Non-managers cannot send `setterId` or `closerId` updates, even null/no-op assignments. Managers retain UUID/null assignment support through the API; no assignment UI was added.
- API statuses: anonymous 401, forbidden role/ownership change 403, absent/out-of-scope lead 404, malformed/invalid edits 400, caught database failures generic 500. Database details are not returned.

Validation bounds: nonblank business name (300), ordinary text fields (300), phone formatting/length (50), email format/length (254), HTTP(S) website (2000), Notes (20000), follow-up note trimmed/nonblank (2000), supported segment/disposition, valid ISO task due date. Task lead identifiers are not silently trimmed. Unknown lead-update keys and empty patches are rejected. Optional empty contact fields normalize to null. The existing task PATCH still validates CUID/status and ignores caller-supplied userId.

## Observed test-first evidence

Each implementation boundary below had a failing run before its production behavior was added. Existing passing cases and additional post-implementation characterization cases are not represented as new RED regressions.

| Command / boundary | Observed RED | Observed GREEN |
| --- | --- | --- |
| `npm test -- tests/lead-workspace-api.test.ts`: scoped access | 7 failed, 2 passed: unauthorized mutation/read accepted; staff query lacked assignment predicate | 9 passed |
| Same file: editing/validation/reassignment/error handling | 13 failed, 9 passed: ownership edits accepted, invalid edits accepted/threw, fields stripped, database and JSON failures escaped | 22 passed |
| `npm test -- tests/lead-followups.test.ts`: creation + task access | 14 failed: no scoped lookup, no task lead predicate, forbidden roles accepted, validation/error handling absent | Combined follow-up + existing task tests: 39 passed |
| `npm test -- tests/lead-workspace.test.tsx`: editing | Initial missing-module setup failure was resolved with an empty component; actual RED then had 3 failed assertions for missing editing/availability UI | 3 passed |
| Same component file: follow-ups | 4 failed, 3 passed: missing add/completion controls and behavior | 7 passed |
| `npm test -- tests/lead-detail-page.test.tsx`: server-rendered access + integration | Initial render harness needed real Next router context; corrected run: 9 failed, including denied access still rendering, unscoped query, missing editor | 9 passed |
| Follow-up refinements: write-time scoped connect, identifier preservation, stable UTC display | Route: 2 failed/13 passed; component: 3 failed/5 passed (including transport fixture contract during nested-connect transition) | Combined: 23 passed; standalone typecheck passed |

New tests are in `lead-workspace-api.test.ts`, `lead-followups.test.ts`, `lead-workspace.test.tsx`, `lead-detail-page.test.tsx`. Existing `tasks.test.ts` keeps its prior validation/owner cases, now with a real staff role fixture and the extra lead predicate expectation. All other existing tests are unchanged by this slice.

The component harness executes actual React events → local fetch dispatcher → actual Next route/validation/access logic → mocked Prisma/auth, including deferred database rejection for visible pending/error/retry states. Page tests exercise the actual async server component and real Next not-found/redirect behavior. No external network fetch is permitted by the test setup. These do not prove Prisma's actual SQL execution, HTTP middleware, Supabase session behavior, browser CSS layout or database persistence.

## Final verification

Executed as one successful chain (exit 0):

```sh
CI=1 npm test &&
CI=1 npm run lint </dev/null &&
CI=1 npm run typecheck &&
CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build &&
git diff --check
```

- Vitest 3.2.7, start 21:21:48 UTC: **262/262 tests; 13/13 files**.
- New slice files: lead API 26, follow-up API 17, workspace component 9, server page 9. Existing task tests: 25.
- ESLint zero-warning gate: passed, no diagnostics.
- Standalone TypeScript: passed, no diagnostics.
- Prisma Client 6.19.3 generated locally; Next.js 15.5.27 compiled successfully (15.4 seconds), lint/types passed, **30/30 pages generated**, traces completed. Client generation is not a database connectivity check. Detail route reported 16.1 kB / 122 kB first load.
- `git diff --check`: passed. Scoped tracked diff reviewed; new component/helper/test source reviewed. Bounded dangerous-code/secret/debug-pattern searches on lead components/helpers found no matches. No independent reviewer process was available to this worker; parent review remains appropriate.
- Disk at 21:23:12 UTC: 7.2G available, 93% used. Reused existing dependencies/build artifacts.

## Paths changed by this slice

Modified:
- `src/app/api/leads/[id]/route.ts`
- `src/app/api/tasks/route.ts` (preserving the earlier owner/ID hardening)
- `src/app/dashboard/leads/[id]/page.tsx`
- `tests/tasks.test.ts`

Created:
- `src/lib/leads/access.ts`
- `src/lib/leads/validation.ts`
- `src/components/leads/lead-workspace.tsx`
- `src/components/leads/lead-follow-ups.tsx`
- `tests/lead-workspace-api.test.ts`
- `tests/lead-followups.test.ts`
- `tests/lead-workspace.test.tsx`
- `tests/lead-detail-page.test.tsx`
- `docs/LEAD_WORKSPACE_REPORT.md`

No changes in this slice to Twilio, dialer, inbound routing, missed-call text-back, package/dependency files, schema or earlier reports. The worktree already contained uncommitted safety/auth/mobile/webhook work; its presence in the overall git diff is not attributable to this slice. Roll back only this slice's additions/hunks; do not reset the shared dirty worktree or remove the pre-existing tests/docs.

## Explicit remaining limits and release blockers

1. **Not app-wide row authorization.** List/search/import/create-lead, dialer queue, dashboard aggregates, task-list reads and other pages/routes were not brought under this policy. For example, the task-list page still uses owner-only reads with included leads; a task on a reassigned lead may be visible there but no longer completable through this API. List results may link to details that are now denied. Full role/row review remains a release blocker.
2. No configured authorized runtime database/Supabase staging session was available. No real DB access was attempted. Actual assignment predicates/nested connects, relational constraints, RLS/service-role behavior, historical Profile authority, middleware, session expiry and authenticated full-stack readback require isolated staging tests. Typecheck/build success is not persistence proof.
3. No fresh rendered-browser or actual-phone evidence is claimed. The prior mobile report documents missing Supabase configuration blocking runtime. CSS overflow, device keyboard, datetime-picker behavior/DST ambiguity, hydration and accessibility need configured phone/tablet/desktop validation. Local jsdom only verifies DOM behavior/control utilities.
4. Notes remains last-write-wins shared text, not an audit trail. Only changed fields reduce unrelated overwrites; simultaneous changes to the same field can still conflict. No concurrency version, authorship, timestamped note timeline, task audit history, reminders, tags/lists or promise tracker.
5. Drafts survive handled request failures and task actions while this component remains mounted; they do not survive navigation/reload/tab loss. No autosave/local persistence or navigation guard. The UI explicitly says to save before leaving.
6. Task creation has pending-button protection, not a durable idempotency key. A lost response after a committed creation followed by retry could duplicate a task. Scoped nested connect repeats access at creation, but live concurrent reassignment/transaction behavior has not been tested.
7. Assignment UI and eligible-assignee role validation are deferred. The manager API accepts schema-valid UUID/null ownership changes; actual existence is enforced by the database and database failures yield a generic error. This slice does not certify historical assignments.
8. Initial server-query failures use Next's existing error behavior; no custom loading/error boundary was added. Mutation pending/error/retry is implemented. Session failures outside the route's database try/catch may be handled by framework middleware/error handling.
9. Existing inbound routing and missed-call text-back are **unchanged and unverified**, not newly certified. No calling/provider work was done. Default-off calling, recording safeguards and earlier webhook protections remain in place. Staging, backup/restore, approved real-recipient and inbound/text-back regression gates remain prerequisites to production/live calling.

This report records a bounded local foundation for P1/P2; it does not mark the broader BUILD_PLAN gates complete.
