# Navigation audit and actionable upgrade plan

## Scope and evidence

Source audit of the current dirty worktree in `/home/precision_focused_solutions/crm`, not a review of only the committed scaffold. The requested `lib/nav.ts` is actually `src/lib/nav.ts`; routes live under `src/app`. All current dashboard pages, their imported feature components, all current API route handlers, shared authorization/selection logic, telephony foundations and Prisma models were inspected. Existing implementation reports provide historical context, not fresh execution evidence. `docs/audit/` describes a reference product and must not be treated as this application's implementation.

**No authenticated browser test, API request, database query, build, migration, environment change, provider activation or deployment was performed for this audit.** Only this document is created. Source-connected means there is an implementation path, not proof that the running preview has that code, correct credentials, tables or data. The PA sample files are not evidence of an import. Historical local persistence tests mock authentication and do not certify Supabase sessions or production readiness.

## Coverage and navigation defects

There are **12 distinct current navigation destinations**, including role-only Pulse and Team, and **13 dashboard page routes** including the non-nav lead detail page. Five destinations are ComingSoon-only: Playbook, Standings, Bookings, Sequences and Pulse. The remaining seven have some source-connected behavior, with substantial limits below.

- `SALES_REP_NAV`: 10 entries. `ADMIN_EXTRA_NAV`: 2 entries. Role composition adds literal Team and Leads entries, so counting textual `href` occurrences alone overcounts.
- Admin/manager composition produces 12 entries but only 11 unique destinations: Leads is duplicated and Home is omitted. Sidebar deduplication hides the duplicate; it does not restore Home. Login still redirects to Home, and direct Home access is possible.
- All other roles receive the entire sales-rep navigation. `client`, `hiring_manager` and `project_manager` therefore see Leads/Floor links that return not-found under `salesLeadScope`. Their assigned-role descriptions promise surfaces that do not exist.
- Role visibility is not authorization. The sidebar does not generically enforce each item's `roles` property; route/API policy must remain authoritative.
- Mobile menu supports toggle, Escape, focus return and link-close in source. This is not fresh geometry, keyboard or physical-phone verification. Sign-out calls Supabase but has no visible failure handling.
- Shared layout performs profile bootstrap and an overdue task count on every dashboard request. `getCurrentProfile` upserts a missing Profile as `sales_rep`, preserving existing database roles; it is not read-only database behavior. Auth/database failure can block even placeholder routes. There are no dashboard-specific loading/error boundary files in the inspected route tree.

**Navigation acceptance:** execute `getNavForRole` for every Prisma role; assert unique destinations, explicit allowed visibility, accessible landing page and no dead-end role links. Decide deliberately whether managers keep Home alongside Pulse. Anonymous, non-sales, assigned rep, closer, manager and admin tests must cover direct URLs and APIs, not merely hidden links.

## Per-destination audit

Each heading below is a coverage key matching the exact current destination. Acceptance criteria are proposed work, not passed tests.

### `/dashboard/sales-training` — Playbook

**Purpose/workflow:** prepare for an outreach conversation: choose an industry/script, review objections, keep the selected script beside a lead, record coaching feedback.

**Actual:** `src/app/dashboard/sales-training/page.tsx` renders `components/ui/coming-soon.tsx`, with scripts/onboarding copy and a Phase 6 label. No training content, search, editor, progress state, persistence model or API is wired. All authenticated roles reach it through the layout.

**Gaps/access:** common ComingSoon copy incorrectly says core dialing is live; it is not. Phase labels are not delivery evidence. No approved script or version authority exists.

**Next:** start with a useful read/search library of user-approved scripts and objections, manager publishing/versioning, and contextual Floor links. Do not copy proprietary reference-product training or invent certifications.

**Acceptance:** publish a versioned script as a permitted editor; a rep can find and open it from a lead and return without losing saved work; unauthorized edits fail; empty content has a clear add/request action; no fabricated completion or coaching metrics.

### `/dashboard/leaderboard` — Standings

**Purpose/workflow:** compare attributable outcomes, identify a coaching opportunity, drill into supporting records.

**Actual:** only ComingSoon, Phase 2. No aggregation query, date/team selector, drill-down, ranking API or leaderboard model. Existing Calls and Leads are possible inputs, not a standings implementation.

**Gaps/access:** dial counts are not trustworthy enough for rankings: legacy completed status callbacks increment repeatedly. Bookings/closed outcomes lack a implemented booking lifecycle. Non-sales roles also see the placeholder.

**Next:** after event correctness, define team visibility, reporting timezone, attributable conversations/bookings/wins and exclusions for synthetic data. Prefer outcomes and sample sizes to rewarding raw dials. Defer ranking until data exists; show unavailable rather than invented scores.

**Acceptance:** a fixed fixture set yields documented ties, date boundaries and denominators; duplicate callbacks do not alter rankings; each permitted metric drills into its authorized contributing rows; no-data states do not rank imaginary reps.

### `/dashboard/tasks` — Follow-ups

**Purpose/workflow:** start with overdue callbacks/promises, open the lead, act, complete or reschedule, then see the next commitment.

**Actual:** page reads all current user's open Tasks ordered by due date, includes Lead, and groups overdue/upcoming. Cards show note, server-formatted date and lead link. No direct create/complete/reschedule control on this page. Real creation/completion exists in `lead-follow-ups.tsx` through POST/PATCH `/api/tasks`, reached through Lead detail. New tasks belong to the actor; only that owner can complete, even for managers. Sidebar badge counts overdue open tasks.

**Gaps/access:** list and badge use user ownership but do not intersect current lead scope. A task on a reassigned lead can still expose lead context/link while detail and completion deny access. No pagination, completed history, task editing, reassignment, reminder delivery, priority, durable create idempotency or promise extraction. Page server-local formatting differs from workspace device-local input/UTC display; profile timezone is not applied consistently. Creating/completing inside the workspace updates component state, not an explicit global badge refresh.

**Next:** align read/write policy, add inline completion/reschedule and outcome/context links, consistent timezone labels and bounded paging. Add confirmed callback priority first; promise proposals must be user-confirmed, sourced notes/transcripts, never silent commitments.

**Acceptance:** create on a lead, independently reload Follow-ups and badge, complete/reschedule and independently read back exact task; reassignment removes unauthorized context/actions; repeated create with one operation key yields one task; DST/overdue boundaries match displayed timezone; failure retains draft and displays retry.

### `/dashboard` — Home

**Purpose/workflow:** a daily starting desk: see authorized leads and due commitments, choose a list, resume review or follow up.

**Actual:** page queries all active Leads globally, current user's calls since server-local midnight and own open task count. Three static links lead to Floor, Leads and Follow-ups. There is no dedicated dashboard API; queries run server-side through Prisma.

**Gaps/access:** global lead count bypasses `salesLeadScope`, including for non-sales roles; it can reveal out-of-scope aggregate information. “Start dialing” and “power dial flow” overstate the review-only implementation. Counts have no drill-down filter parity, reporting timezone or synthetic-data separation. Home disappears from admin/manager sidebar despite being the login landing route.

**Next:** scope all widgets, make due callbacks and saved-list review the actual primary actions, replace dialing claims, add honest availability/error states. Make Home the individual work desk and Pulse the optional team dashboard.

**Acceptance:** rep totals equal authorized filtered records, non-sales receives its intended landing surface, manager can navigate back; widget links reproduce the counted population; local-date tests pass and no UI claims a working caller.

### `/dashboard/dialer` — Floor

**Purpose/workflow:** currently select a list/tag/saved filter, load one lead, review/disposition, save and move on. Eventually a human-controlled call → wrap-up → next workflow.

**Actual:** server page enforces sales scope and loads actor-owned SmartViews. `dialer-panel.tsx` calls GET `/api/dialer/next-lead`; list/tag/SmartView constraints intersect assignment and conservative review status rules. Save & Next PATCHes the lead before advancing; Next skips without saving. Pause/Resume/Stop are review controls. Mounted-session exclusions persist across Stop/filter changes, cap at 100, and reset on unmount/reload. Empty/error states exist. `caller-id-selector.tsx` lazily calls GET `/api/dialer/numbers` to browse owned voice-capable account numbers; selection is component-local only.

**Unwired:** Call is disabled; no browser Voice SDK, token request, call-intent request or phone-app handoff originates from this component. Selected caller ID is not passed to a call action. POST `/api/dialer/intents` is an authenticated, allowlisted reservation foundation; internal binding is not connected to voice. `/api/twilio/voice` always emits Hangup-only TwiML, even if the calling flag is enabled. Token generation is not working audio. SmartView GET/POST exists, but no create/edit/delete UI is wired; arbitrary saved filter JSON can later fail stricter queue validation.

**Gaps/access:** non-sales sidebar links lead to not-found. Queue is review-only: non-empty phone/status checks are not calling consent, suppression, timezone, cooldown or spend checks. No durable review session or review concurrency exclusion. Calling reservations do not make this UI concurrency-safe. Callback-priority sorting is absent; ordering is stable ID. Selecting `callback_scheduled` or `appointment_booked` does not create a corresponding task/booking.

**Next:** preserve unavailable calling, improve list-to-review continuity and explicit unsaved-disposition handling. Before real calling, finish authoritative parent/child lifecycle, callback dedupe/reconciliation and eligibility; then SDK/audio preflight, wrap-up lock, approved-recipient tests, mobile interruptions and recovery. Caller ID must be server-authorized again, not accepted from a profile phone field.

**Acceptance:** authorized list membership → each reviewed lead once in session → saved disposition independently read back; denied list never falls back to all leads; Stop/reload behavior is explicit. Before activation, dual tabs/reps cannot acquire one call lease, unknown provider state holds the queue, and no next call occurs until terminal provider state plus wrap-up. Prove suppression/windows/kill switch and approved two-way audio; retain recording OFF and unchanged inbound handler until separate approval.

### `/dashboard/leads` — Leads

**Purpose/workflow:** maintain one master business record, find it, qualify it, attach multiple lists/tags, preserve context and schedule the next action.

**Actual:** `leads-board.tsx` fetches scoped GET `/api/leads` with search, segment, list and tag filters, 50-row keyset paging, Previous/Next, and explicit Apply. Cards link to the workspace. URL input supports `myLeads`, but no visible my-leads toggle; applied filter changes remain component state rather than updating URL. `new-lead-button.tsx` POSTs `/api/leads`; `csv-upload-button.tsx` POSTs multipart `/api/leads/import` and refreshes. Catalog selectors are lazy-loaded. Owner/list/tag predicates intersect rather than granting access.

**Gaps/access:** create and import handlers require authentication but do not require a sales role, unlike list/detail reads. Non-sales actors can directly create/import records they cannot subsequently access. Create validation is weaker than edit validation and uses uncaught `.parse`; errors are not shown in the new-lead form. Both create/import clients lack robust transport-error recovery. Import splits on newlines/commas, breaks quoted commas/multiline values, defaults missing business names to Unknown, has no row/size cap, mapping preview, dedupe, operation idempotency or safe undo. Re-import duplicates leads. Website/source provenance is limited; source is a coarse enum, not per-field evidence. No bulk membership, assignment UI, merge/audit or authored note timeline.

**Next:** first align create/import authorization and shared validation. Then implement a bounded CSV preview/normalize/review/import pipeline reusable by Lead Scraper. Preserve one master record, add duplicate review, assignment controls for permitted managers and bulk list membership without copying leads.

**Acceptance:** denied roles cannot create/import; quoted commas, Unicode, blank and multiline fields round-trip; malformed rows produce downloadable reasons and no silent substitutions; repeated import operation creates no duplicate records; partial failures reconcile explicitly. One lead in two lists remains one master ID. Filters survive intended navigation, all pages remain accessible, and mutation/network failures show recoverable state. Do not claim the PA sample is present until an authorized import and exact target readback happen.

### `/dashboard/appointments` — Bookings

**Purpose/workflow:** book a qualified lead with an available closer, confirm it, then record attended/no-show/rescheduled and follow-up outcome.

**Actual:** ComingSoon, Phase 2, claiming a Sat–Fri board. No booking form, calendar availability query, appointment API/model, reminder job or closer outcome persistence. Settings' calendar ID does not create a connection. `appointment_booked` is a lead status string, not an appointment record. GHL appointment push is a no-op stub.

**Gaps/access:** all authenticated roles see placeholder; setter/closer/team visibility and cancellation authority have not been designed.

**Next:** add internal appointment lifecycle first, authorized participant/lead linkage, explicit timezone and overlap checks. Calendar integration is optional and must show connected/error states, OAuth authority and sync provenance rather than treating an ID as a connection. Paid providers remain off unless approved.

**Acceptance:** create → reload → reschedule → outcome changes one identified appointment with audit history; overlapping bookings are refused atomically; DST and participant permissions tested; cancellation creates no duplicate reminders; disconnected calendar cannot report a sync success.

### `/dashboard/pipeline` — Sequences

**Purpose/workflow:** keep a lead moving through an explicit series of human follow-up steps; pause/stop when a reply, booking or opt-out changes eligibility.

**Actual:** navigation says Sequences, page says Pipeline; only ComingSoon, Phase 2. No pipeline board, sequence model, enrollment, scheduler, workflow editor or sequence API. GHL disposition/workflow push is a no-op stub. Changing `sdrStatus` does not enroll or execute anything.

**Gaps/access:** terminology conflates sales stages with ordered tasks; automation and team ownership are unspecified. No suppression authority or durable execution dedupe exists.

**Next:** decide on “Sequences” as scheduled manual task plans, distinguish it from lead stage filtering, and make a useful manual next-action queue before any sending automation. Show previewed dates, owner, pause/stop and enrollment history. No unsolicited messaging or paid execution by default.

**Acceptance:** user previews and confirms a plan; exactly one next task appears per step under retry/concurrency; completing a step moves the same enrollment; pause, booking and opt-out stop future work as defined; no contact/provider call is made by the manual MVP; inaccessible leads cannot enroll.

### `/dashboard/call-history` — Call log

**Purpose/workflow:** find a real conversation/attempt, inspect outcome and next action, reopen the associated lead; later view authorized recording/brief when consent permits.

**Actual:** server page reads current user's Calls since server-local midnight, newest first, capped at 200. Shows lead/business/phone/contact, status and local-rendered time with a link. No date range, older-page navigation, call detail, duration display, disposition editor, playback or log API. Lead workspace separately shows recent call summaries. The page's no-data copy tells users to start dialing despite disabled calling.

**Gaps/access:** userId-only query includes current Lead without current assignment scope; reassigned lead metadata can remain exposed and the detail link fail. Cap is labeled as “calls today,” potentially presenting a truncated count as a total. Legacy signed status handler trusts custom lead/user associations, defaults unknown statuses to completed, does not model authoritative parent/child events, and increments `dialedCount` on every repeated completed callback. Recording handler attaches a URL by SID without an implemented consent/intent policy; there is no secure playback workflow. Signatures alone do not fix association or replay correctness.

**Next:** correct callback event storage and exactly-once derived effects before analytics; adopt explicit historical access policy, date filters/paging and honest counts. Later add a sourced post-call brief only for connected talk time strictly greater than 150 seconds; never fabricate a transcript for unrecorded audio.

**Acceptance:** repeated/out-of-order callbacks leave one correct call and one count effect; unknown status is rejected/quarantined, not completed; authorized historical access works after reassignment per policy; more than 200 records remain reachable and count labels truthful; exact 150-second boundary does not trigger a brief; recording access requires consent and authorization.

### `/dashboard/settings` — Settings

**Purpose/workflow:** manage profile preferences and inspect what integrations/calling permissions are actually available.

**Actual:** page displays account identity/role; `settings-form.tsx` PATCHes own phone, timezone, Google Calendar ID and extended-dialer-hours flag through `/api/profile`. API explicitly selects these fields but has no schema validation. Client shows basic Saved/Failed on HTTP results, without transport try/finally or refreshed account data.

**Gaps/access:** phone placeholder implies outbound caller ID, but actual caller IDs come from verified Twilio inventory. Calendar ID copy claims appointment syncing, but no sync implementation exists. Extended-hours checkbox is stored, not enforced by the queue or a live caller. Timezone options do not make Home/Call log/Follow-ups use that zone. There is no integrations console or organization calling-safety configuration UI. OrgSettings/GHL code is not a settings feature.

**Next:** relabel contact phone and unavailable features truthfully; validate IANA zones and field lengths/types; add save/reload/error recovery. Show integration capability and connection state separately from preferences. Future extended-hours changes cannot override server/legal eligibility policy.

**Acceptance:** valid preferences persist and read back after reload; invalid/unknown fields are rejected consistently; network failure clears pending state and retains draft; changing phone never authorizes caller ID; no calendar-sync or extended-calling claim without an exercised implementation.

### `/dashboard/executive` — Pulse (admin/sales_manager)

**Purpose/workflow:** review team conversion, overdue commitments and capacity, then assign a concrete corrective action.

**Actual:** explicit admin/manager page gate; unauthorized users receive an Access denied view. Authorized users get ComingSoon, Phase 4. No executive queries, KPI API, charts or drill-down. This is not the reference product's proprietary admin implementation.

**Gaps/access:** team metric definitions and organization boundary are unspecified. Prisma currently has no tenant/organization key on leads/profiles: manager scope means all rows in this deployment, not a general multi-tenant policy. Call/booking data quality prerequisites are missing.

**Next:** design a small first-party team operations view: due/overdue tasks, unassigned leads, verified outcomes and coverage gaps. Define single-organization scope explicitly; if serving multiple customer organizations, implement tenancy before exposing this dashboard. Avoid unsupported revenue/spam-score claims.

**Acceptance:** fixed fixtures yield reconciled numerators/denominators and date windows; each tile leads to authorized contributing rows and an assignment/follow-up action; non-manager direct route/API calls deny data; missing source data is labeled unavailable rather than zero or fabricated success.

### `/dashboard/users` — Team (admin/sales_manager)

**Purpose/workflow:** onboard an authorized teammate with least privilege, manage supported roles, and verify their actual accessible workspace.

**Actual:** page gate allows admins/managers and lists all Profiles. `users-manager.tsx` calls GET/POST/PATCH `/api/users` paths as applicable (initial page list uses Prisma directly). POST creates an immediately email-confirmed Supabase user using an entered temporary password, then upserts Profile; it is not an emailed invitation. Admin can create all schema roles; manager may create sales_rep only. PATCH is admin-only and blocks self-demotion. Existing role metadata no longer controls authorization.

**Gaps/access:** UI offers every role and role-change selector to managers despite API denials; page falsely states “Your account is admin.” Catalog offers client/project/hiring roles with no matching useful surfaces. Supabase account creation and Profile upsert span systems without compensation/reconciliation; failure after Auth creation can leave a partial account. No pending invite state, revoke/deactivate, password reset flow, role-change audit or pagination. Table mobile usability is not proven. Client errors lack transport protection.

**Next:** render actor-aware controls, truthfully label account creation or replace it with secure invitation acceptance, restrict unsupported role offerings, add audit/reconciliation and deactivation with ownership handoff policy. Admin promotion stays explicit and protected.

**Acceptance:** manager sees only rep creation and no editable role grants; direct prohibited POST/PATCH denies changes; invited user sets their own credential and receives intended role; induced Profile failure is reconciled without silently granting another role; deactivated user loses new access; ownership transfer and last-admin protection follow a documented policy.

## Related non-nav page: `/dashboard/leads/[id]` — Lead workspace

**Purpose/workflow:** open one master lead, edit business/contact context, save notes/disposition, manage lists/tags, schedule/complete a follow-up, inspect recent calls.

**Actual:** page and GET/PATCH `/api/leads/[id]` enforce sales scope (manager all, rep/closer/hybrid assigned setter OR closer). `lead-workspace.tsx` edits bounded fields, only PATCHes changed values, shows unsaved/success/error and retains in-memory draft on request failure. Notes is one shared text field, not timestamped authored history. `lead-organizers.tsx` creates shared tags and actor-owned lists via `/api/lead-organizers/[kind]`, pages catalogs and PUT/DELETEs membership via `/api/leads/[id]/organizers/[kind]`; manager can manage team lists, other staff only own lists. Membership is not a grant of lead access. `lead-follow-ups.tsx` supports creation and owner-only completion. Page shows source/dial count and last 10 calls; GET API includes last 20. Calling/booking are expressly unavailable.

**Gaps/access:** no autosave/navigation guard, authored note audit, concurrency versioning or assignment UI. Editing same field concurrently is last-write-wins. Manager API accepts UUID assignment without checking intended assignee role; database existence alone is not role suitability. Workspace includes all open tasks/calls attached to an accessible lead, unlike owner-only overview pages; document this team-context policy. Segment/status edits are not global suppression or downstream automation. Unmounting to the board loses unsaved draft and queue state.

**Next/acceptance:** add audited notes, conflict detection and safe draft navigation; manager assignment picker must show only eligible actors. Verify two concurrent edits cannot silently overwrite a note, failed follow-up preserves input, scope revocation denies subsequent writes, memberships persist without new master rows, and all timestamps are clearly zoned. Introduce real appointment/task transitions rather than status labels pretending to create events.

## New requested destination: Lead Scraper (proposed, absent today)

Proposed route `/dashboard/lead-scraper`, label **Lead Scraper**, beside Leads. There is currently no scraper route/component/API, worker, candidate model or navigation entry. Do not count this proposal as a thirteenth existing nav destination. A tab with search boxes and fake results is not delivery.

**Useful end-to-end job:** choose business niche + geographic area + permitted source and bounded result limit → see source/rate/cost policy → start acquisition → inspect real candidates and evidence → deduplicate/qualify → approve selected rows → attach to a named list on the master Leads table → review in Floor. Scraped business information is not outreach consent or call eligibility.

### Staged, testable implementation

1. **Contract and allowed sources.** Support approved public business websites/permitted public datasets initially, with manual URL/CSV intake as an explicit fallback, not falsely called completed web scraping. No paid provider, hidden subscription, logged-in scraping, access-control circumvention or proprietary reference-product data. Establish source terms/robots/rate policy, geographic interpretation, and public-business-only fields. Obtain approval before any paid provider.
2. **Durable acquisition.** Add reviewed `LeadAcquisitionJob`/candidate/evidence storage (names are proposals), creator/role scope, parameters, source, timestamps, bounded progress, job states, retry/cancel and per-source errors. Use a worker with time, row, response-size, request-rate and concurrency caps; do not hold a long scrape inside a Next request. Fetcher must defend against SSRF, private/loopback/link-local/metadata addresses, DNS rebinding and redirect pivots; sanitize untrusted HTML and isolate any browser fetches. No model-generated contact fields presented as fetched facts.
3. **Review, not automatic pollution.** Candidates stay separate from master Leads until approval. Store source URL, retrieved time and per-field evidence/confidence; flag unavailable phone/email and possible duplicates by normalized domain/phone/name+location. Phone-only matches need review, not automatic destructive merge. Existing source enum has no scraper value: add a reviewed migration or explicit provenance mapping, never force an invalid enum or silently relabel evidence as manual.
4. **Promotion transaction.** Preview new records vs links to existing records; preserve existing notes, assignment and suppression. Commit an idempotent batch, authorized assignment, selected list/tag memberships and import provenance together. Log exact created IDs/links for safe rollback that cannot delete later edits or pre-existing leads. Reuse the corrected import validation/promotion service rather than current comma-split importer.
5. **Actionable handoff.** Results show imported/skipped/rejected/duplicate-review counts, per-row reasons and source links; open the exact list in Leads/Floor with filters preserved. Neither scrape completion nor list membership enables calling or sends a message.

**Proposed API boundaries:** POST/GET `/api/lead-acquisition/jobs`, GET `/api/lead-acquisition/jobs/[id]`, explicit cancel/review/import operations scoped to job owner or authorized manager; server validates source, location/limit and promotion target, not browser-supplied actor/role. These paths do not currently exist. Decide whether reps may run jobs or only review manager-created jobs; enforce the decision in both nav and API.

**Acceptance:** an approved real small source produces traceable candidates or an explicit source error (never fabricated rows); unit/fixture extraction tests cover missing/ambiguous fields; job polling/reload/cancel/retry works and cannot exceed limits. Repeated promotion with the same operation key creates no duplicate leads or memberships; existing suppressed records remain suppressed; unknown private-network URLs/redirects are refused. A reviewed candidate can be read back as one master lead in two lists with provenance intact and surfaced in the selected review queue, with calling still unavailable. Authenticated isolated staging and browser tests plus exact database readback are required before marking the tab complete. Production scraping/import requires explicit deployment/data approval.

## Cross-feature API and data blockers

- **App-wide access is inconsistent:** strong scope on lead list/detail/queue/organizers and task mutations, weaker legacy create/import and aggregate/history/task reads. Fix policy before adding acquisition volume. Decide single-organization vs tenant isolation explicitly; current schema is not tenant-scoped.
- **Signed callback does not mean authorized lifecycle:** status/recording still lack intent-bound account/parent/child authority and full replay ordering. Keep voice Hangup-only. Recordings remain off pending explicit consent, secure playback and retention.
- **GHL is not connected end-to-end:** `/api/webhooks/ghl` POST fails closed without its configured shared secret; with accepted payload it invokes an adapter that creates a local lead. Native fallback can label that lead native and drop external identity; GHL adapter retains external identity but still creates rather than idempotently upserts. Both omit assignment, so normal reps will not see newly unassigned leads. External ID index is not unique. GHL outbound sync methods are stubs. Public GET health queries settings and reports enabled state without user auth. Define health disclosure, source preservation, dedupe, assignment and authorized settings management before describing an integration as working.
- **Saved views are only partial infrastructure:** API GET/POST is actor-owned but only authentication-gated; creator accepts arbitrary filter JSON, count-limit enforcement is not atomic, and there is no update/delete UI/API. Queue validation is stricter. Align one schema, enforce sales capability and build usable save/apply/edit/delete with concurrent limit tests.
- **Runtime truth is unverified here:** new Prisma models do not prove deployed tables, and source does not prove the running preview is rebuilt. Existing access/local/staging reports describe different evidence scopes. Authenticate and independently read the exact intended environment before accepting end-to-end workflows; do not use production as staging or reset the dirty worktree.

## Prioritized delivery packages (not a cosmetic rebuild)

| Order | Package and useful outcome | Dependencies and release gate |
|---|---|---|
| 1 | Truthful shell and complete access matrix | Fix false live-dialing/calendar/admin copy; clean role nav; align create/import/read scopes and task/history policy. Test every role/direct endpoint and deny unauthorized data. No provider activation. |
| 2 | Reliable lead intake + follow-up loop | Shared validation, robust previewable/idempotent import, provenance/dedupe review, assignment, list handoff, task reschedule/completion, draft safety. Exact readback in isolated staging; same lead remains one record. |
| 3 | Real Lead Scraper acquisition-to-list workflow | Package 2 promotion service, approved source/limits, durable jobs and secure fetching. Real evidenced candidates, safe retry/cancel, duplicate-proof approved import. No paid provider or automatic outreach. |
| 4 | Calling safety and controlled test pilot | Intent-bound lifecycle, suppression/timezone/cooldown/spend, queue locks, reconciler, SDK/audio/wrap-up, approved recipient and phone interruption tests. Preserve `https://www.get247roi.com/api/voice/inbound`; prove existing missed-call text-back exactly once and opt-outs intact before routing changes. |
| 5 | Bookings + manual sequences + actionable playbook | Persisted appointment/task/script models with role permissions and audit history. One completed workflow per feature, no fake calendar connection or silent messaging. Playbook can ship earlier independently once useful content is approved. |
| 6 | Trustworthy Standings/Pulse and optional integrations | Correct event accounting and booking outcomes first; reproducible metric definitions and drill-down. Consent-aware sourced briefs only above connected 150 seconds; AI task suggestions always confirmed. |

Each implementation ticket should name its owner, source paths, model/migration impact, dependencies, authorization policy, failure/rollback behavior, automated checks and an authenticated mobile acceptance journey. Green mock tests or an attractive page are insufficient. Do not enable calling, recording, production migrations or external paid services to make a demo look complete.

## Reproducible coverage check

This source-only check uses the full literal destination union in `src/lib/nav.ts` (including role-only/inline entries), requires a dedicated heading for each, verifies corresponding page files and separately counts dynamic detail pages. Role composition counts use the current explicit slice expression, not an assumption that raw text occurrences equal displayed links. Re-run after nav changes; an implementation should ultimately test the actual TypeScript function for all roles.

```python
from pathlib import Path
import re
root = Path('/home/precision_focused_solutions/crm')
nav = (root / 'src/lib/nav.ts').read_text()
audit = (root / 'docs/NAVIGATION_AUDIT.md').read_text()
expected = set(re.findall(r'href: "([^"]+)"', nav))
covered = re.findall(r'^### `(/dashboard[^`]*)` — ', audit, re.M)
assert len(covered) == len(set(covered)), 'Duplicate audit headings'
assert expected == set(covered), (expected - set(covered), set(covered) - expected)
assert all((root / 'src/app' / href.lstrip('/') / 'page.tsx').is_file() for href in expected)
pages = list((root / 'src/app/dashboard').rglob('page.tsx'))
placeholders = [href for href in expected
    if '<ComingSoon' in (root / 'src/app' / href.lstrip('/') / 'page.tsx').read_text()]
print({'nav_destinations': len(expected), 'covered': len(covered),
       'dashboard_pages': len(pages), 'placeholder_destinations': len(placeholders)})
```

Executed source-coverage result: **PASS — 12 expected destinations, 12 unique dedicated audit headings, 13 dashboard page files, 5 ComingSoon destinations.** The current role-composition check returned 10 sales entries, 12 raw manager/admin entries, 11 unique manager/admin destinations, and `/dashboard` omitted from manager/admin navigation. All expected destination page files exist.

Audit acceptance is coverage and source-grounded findings, not a claim that any proposed feature or runtime test passed.
