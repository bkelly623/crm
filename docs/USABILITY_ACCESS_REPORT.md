# First usability/access slice — implementation report

## Delivered

- Navigation now returns unique, role-appropriate destinations. Home is first for everyone, including admin/manager. Sales roles get Dialer, Appointments and Leaderboard (replacing Floor, Bookings and Standings); managers additionally get Reports (formerly Pulse) and Team. Non-sales/unknown roles get only Home and Settings. Sidebar also filters declared roles defensively while retaining the existing responsive disclosure, focus-return and active-link behavior.
- Sequences is labelled **Sequences (planned)** in navigation and consistently titled Sequences on the page. All five placeholder modules explicitly say **Not available yet**. Removed phase-number delivery hints, “core dialing is live” and “ships next” claims. Home offers review rather than live dialing; call-log empty copy no longer asks users to start calling.
- Lead create and CSV import now enforce `salesLeadScope` before parsing input or performing writes. Anonymous returns 401; client/hiring_manager/project_manager/unknown return 403; admin/sales_manager/sales_rep/closer/hybrid remain allowed and new records remain assigned to the actor.
- Home active-lead totals intersect active segment with current sales scope. Own call/task totals also intersect current lead scope. Non-sales Home performs no sales aggregate queries and offers account settings with an access explanation.
- Follow-up list, overdue sidebar badge and call-history reads intersect owner ID with current lead scope. Reassignment removes former rep/closer/hybrid access on subsequent reads even when they own the historical task/call. Managers keep deployment-wide lead scope but still see only their own activity in these personal overviews. Existing detail/workspace team-context policy is unchanged.
- Call log labels its result as calls **shown**, explicitly disclosing latest-200 limit and server-time day boundary rather than presenting a capped list as a total.

## Verification and TDD evidence

Each production behavior slice was preceded by executed failing tests, then its targeted green run:

1. Intake role gates: 8 expected denial failures (unauthorized roles returned 201/200), then 20/20 passing.
2. Home counts: 7 expected failures (global rep counts/non-sales queries), then 10/10 passing.
3. Direct activity reads/badge: 7 expected failures (reassigned context/non-sales reads), then 20/20 passing in the combined read suite.
4. Navigation/sidebar: 10 expected failures (duplicate manager destinations, absent Home, role leakage and old labels), then navigation plus existing mobile tests 24/24 passing.
5. Truthful copy: 8 expected failures, then 8/8 passing.

Additional regression tests exercise assignment changing between reads and verify link population sizes exclude another actor's activity. Existing mobile tests were updated only where their former assumption that every role sees Follow-ups contradicted the new access policy.

Final focused command:

```sh
npm test -- tests/dashboard-read-access.test.tsx tests/dashboard-truthful-copy.test.tsx tests/lead-intake-access.test.ts tests/navigation-access.test.tsx tests/mobile-layout.test.tsx
```

**PASS: 5 files, 75 tests.** Covers all Prisma roles, unknown roles, anonymous direct reads and intake calls, both assignment branches, reassignment, manager policy, ownership intersection, accessible link names and truthful placeholder/limit copy. Authentication and Prisma are mocked; a small synthetic predicate evaluator applies the actual composed Prisma filters to fixture rows. No database was changed.

- `npm run lint`: PASS (`eslint . --max-warnings 0`).
- `npm run typecheck`: PASS (`tsc --noEmit --incremental false`).
- `git diff --check`: PASS.
- Last full `npm test` run (start 01:35:58 in tool output): **31 files passed, 4 suites failed collection; 455 tests passed.** This is **not** a green full-suite result. Failures were in the concurrent backend worker's scope:
  - `tests/call-intent-safety.test.ts`, `tests/twilio-webhooks.test.ts`, `tests/voice.test.ts`: Next `server-only` import guard threw during collection.
  - `tests/call-lifecycle-api.test.ts`: missing `@/app/api/dialer/intents/[id]/route` during collection.
  - An earlier full run had the first three collection failures; the lifecycle suite appeared during concurrent work. No backend sources/tests were changed to suppress these failures. Backend owner must rerun after its implementation settles.
- **No build run**, per active-preview instruction. No authenticated browser/mobile acceptance, live HTTP/session test, persistence/RLS verification or production readiness claim is made.

## Files touched in this slice

Production:
- `src/lib/nav.ts`
- `src/components/layout/sidebar.tsx`
- `src/components/ui/coming-soon.tsx`
- `src/app/api/leads/route.ts` (POST role gate only; preserved prior GET edits)
- `src/app/api/leads/import/route.ts` (role gate only)
- `src/app/dashboard/{page,layout}.tsx`
- `src/app/dashboard/{tasks,call-history,appointments,leaderboard,pipeline,executive,sales-training}/page.tsx`

Tests:
- New `tests/lead-intake-access.test.ts`
- New `tests/dashboard-read-access.test.tsx`
- New `tests/navigation-access.test.tsx`
- New `tests/dashboard-truthful-copy.test.tsx`
- Updated `tests/mobile-layout.test.tsx`

Documentation: this report. Prior dirty-worktree edits were preserved. No package/schema/env/Twilio/call-intent/provider/source-integration edits, deployment, build, database writes or external provider calls were performed by this slice.

## Residuals / next acceptance gates

- Full repository tests must be rerun after backend work; collection failures above remain unresolved by this slice.
- Browser authentication, real direct URL denial, responsive geometry and assistive-technology behavior need independent acceptance. jsdom accessible-name/disclosure checks are not physical-phone/browser acceptance.
- CSV parsing remains the legacy comma/newline splitter: quoted/multiline fields, caps, preview, dedupe/idempotency and error recovery are not fixed. Create validation/transport handling remain unchanged. Do not run bulk production intake on the strength of these role tests.
- Home/call log still use server-local midnight rather than profile timezone. Follow-up date display is unchanged; DST/timezone consistency, task pagination, inline reschedule/complete and reactive global badge refresh remain future work. Reassignment removes data on a fresh read; this is not live revocation of already-rendered browser data.
- The 200-call cap is disclosed, not replaced with pagination; older/excess rows remain inaccessible from this page. Home totals do not become clickable filtered metric drill-downs in this slice.
- Placeholder routes contain no sales data and remain layout-authenticated; hiding non-sales navigation does not invent role-specific hiring/project/client products. Reports retains its explicit manager/admin route gate.
- Settings calendar/caller-ID copy and Team role-control improvements are outside this delegated ownership; this report does not mark the entire audit package complete.
- No tenant schema exists: admin/manager scope means all leads in this deployment, not cross-customer-safe tenancy. Lead workspace team context and owner-only overview/mutation policy remain intentionally distinct.
- Calling, recording, appointments, sequences, reporting, training and leaderboard functionality are not delivered by placeholder copy. No integrations or fabricated data were added.
