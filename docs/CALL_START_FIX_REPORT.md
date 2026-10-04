# Call-start identifier compatibility fix

## Outcome and root cause

Source-only fix; not deployed by this worker. The persisted verified list
`verified-list-41ac9df9-f2cd-4793-9025-71921a609c08` and pilot list
`pilot-list-107c30fb-4431-47db-8abc-449275d999d6` are not CUIDs. The shared
`organizerIdentifier = z.string().cuid().max(100)` rejected them before any queue
lookup. Inventory could list these rows because its response IDs were not parsed
through that input validator. Choosing a visible list therefore produced queue
HTTP 400, before intent issuance or SDK connection. This agrees with the parent
investigation's production queue-400/no-new-intent observation; this worker did not
independently query production logs or data.

The same mismatch affected Leads list filters, organizer catalog `after` cursors,
and membership request bodies. Changing a label, caller number, permission prompt,
provider setting or lead assignment cannot fix this syntax mismatch.

## Exact source scope

Only production change: `src/lib/leads/organizer-validation.ts`.

Organizer IDs now accept an explicit bounded union:

- Lowercase alphanumeric CUID syntax (`c` followed by 8–99 lowercase ASCII letters
  or digits), retaining the previous CUID minimum and 100-character bound. Zod's
  former CUID validator accepted punctuation; the new character set does not.
- Exactly `verified-list-` or `pilot-list-` followed by a lowercase canonical UUID
  v4, including RFC variant bits. No other import prefix, bare UUID, arbitrary
  string, case conversion, trimming or ID rewriting is added.

A first implementation incorrectly assumed every existing CUID input was exactly
25 characters; the existing suite exposed 26-character fixtures and it was
corrected to preserve the bounded legacy CUID length contract, rather than rewrite
IDs or fixtures. Whitespace, including trailing newlines, is rejected.

No ownership/access/query code, SQL, schema, data, calling/provider/environment
configuration, lease behavior or authentication changed. No build, commit,
deployment, live call or external provider/database request was performed.
Synthetic Vitest environment stubs are process-local test boundaries only.
Sequential permission cancellation belongs to a separate worker and is not
implemented or certified by this identifier report.

## Complete shared-use and imported-lead audit

| Path / shared use | Finding and coverage |
| --- | --- |
| `GET /api/lead-organizers/[kind]` / `catalogQuery` | Inventory already returns stored IDs; `after` rejected imports. Regression evaluates owner and cursor predicates plus selected membership for an imported lead. |
| `GET /api/dialer/next-lead` | Shared validator covers `listId`, `tagId`, `smartViewId`; exact imported lists now reach normal existence/scope checks. Exclusions continue to use existing bounded `leadIdentifier`. Both list IDs traverse every exact imported lead, then return empty. Existing tag/view tests remain green. |
| `GET /api/leads` / `listQuery` | Exact list filter and imported lead `after` work with assignment/membership intersection intact. |
| `/dashboard/leads` / `listQuery` | Uses the same query schema, so inherits the list fix. No alternate validator or identifier rewrite. Existing page suite passes. |
| `PUT/DELETE /api/leads/[id]/organizers/[kind]` / `membershipBody` | Organizer body was the blocker; imported lead path ID already accepted. Both verbs exercised; nested connect predicates and parent assignment predicates evaluated by synthetic DB boundary. |
| Shared `leadIdentifier` | Existing 1–200-character, non-trimmed identifier contract accepts `verified-<uuid>` leads and legacy lead IDs. Used by catalog `leadId`, memberships, lead pagination, queue exclusions and saved-view setter filtering. Unchanged; narrowing this unrelated contract to CUID would create a new blocker, including UUID profile IDs in saved views. |
| `POST /api/dialer/intents` | Separate bounded lead-ID input already accepts all three imports. Real POST calls real `issueCallIntent`; both initial and transaction authorization read predicates are evaluated against synthetic rows. Intent creation receives the unchanged ID. |
| `GET/PATCH /api/leads/[id]` | Literal scoped lookup accepts imported IDs; real handlers exercised for every imported ID and wrong-owner denial. No CUID check to replace. |
| `/dashboard/leads/[id]` | Inspected: literal ID plus `salesLeadScope`, not CUID validation. Existing detail-page suite passes. |
| `organizerName` / lead organizer UI | Name validation unchanged and independent of identifier syntax. |

Existing generic lead-ID acceptance is not an authorization grant. Injection-shaped
lead strings remain literal, parameterized, scoped Prisma values and match no
fixture row; tests prove they cannot issue an intent. Organizer input remains
strictly formatted. Existing strict object schemas, duplicate scalar handling,
100-exclusion cap and SQL template parameterization remain unchanged.

The shared organizer schema also serves tag and SmartView inputs. Accepting a
syntactically valid prefixed list ID there does not grant access: tag existence
and SmartView `userId` queries remain authoritative; there are no invented tag or
view rows or fallback to the full lead pool.

## Observed test-first evidence

New `tests/imported-identifiers.test.ts` invokes actual catalog, queue, Leads,
membership, detail and intent route functions. Authentication, Prisma boundaries
and owned-number inventory are synthetic; no real DB or provider is contacted.
It reuses `tests/support/lead-query-fixture.ts` to evaluate production-generated
`AND`, `OR`, owner, assignment, membership, eligibility, cursor and exclusion
predicates instead of returning unconditional permitted rows.

Exact imported lead IDs used unchanged:

- `verified-d3c09531-2ded-49ac-97ae-6822b488ee6f`
- `verified-c2071910-3c79-4227-b2a5-1a59d7935c06`
- `verified-da63434a-dcc7-4d66-84f1-1e02283a39d5`

All other fixture fields, including profile, phone and caller inventory, are
synthetic. Both lists use these synthetic memberships to test format compatibility;
this is not a claim that the production pilot list contains these three leads.

Before production edits, `npm test -- tests/imported-identifiers.test.ts` produced
**8 failed / 14 passed**. Exact list → queue → intent paths stopped at queue **400
instead of 200**; filters/membership also returned 400. The expected wrong-owner
404 paths could not yet reach their authorization checks. This is observed RED,
not an inferred failure. After the fix those paths pass; additional characterization
covers CUID bounds, manager exceptions, revoked transaction-time assignment and
ineligible imported statuses.

Final run:

- `npm test`: **727 tests passed, 46 files passed**, including **36 imported-ID
  regression tests**; duration 29.44s, reported start 23:13:49.
- `npm run lint`: passed (`--max-warnings 0`).
- `npm run typecheck`: passed (`tsc --noEmit --incremental false`).
- `git diff --check`: passed.

Owner-only lists remain hidden/unselectable to other reps; membership never grants
lead access. Admin/sales-manager list access remains permitted. Wrong-owner direct
intent POST is denied, including ownership revoked during inventory before the
transaction read. DNC/wrong-number/not-interested imports remain ineligible. Invalid
organizer IDs fail before database access. No raw request IDs, phones, provider or
DB diagnostics are introduced in user errors or logs. Existing `Invalid queue
filters` and safe queue failure messages were retained; no new message is necessary
for the format fix.

## Evidence limits and follow-up

Synthetic predicate evaluation is not a PostgreSQL/Prisma emulator and does not
prove production persistence, RLS, authenticated browser behavior, audio, carrier
reachability or provider acceptance. Parent owns deployment and separately
read-only API-equivalent checks. Successful offline intent reservation never proves
a real call connected. No source rollback should rewrite/delete persisted IDs;
rollback, if needed, is limited to this validator change and its tests/documentation.
