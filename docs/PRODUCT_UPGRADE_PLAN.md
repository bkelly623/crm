# Outpost usability and workflow upgrade plan

## Evidence and scope
This is the current product-priority plan; docs/BUILD_PLAN.md remains the detailed safety requirements reference, but its initial NOT STARTED status is historical and not current. Existing implementation reports contain verified results.

User requested understandable, useful navigation, visible test leads, a built-in Lead Scraper and completion of unwired features. Do not equate passing isolated tests with a complete product.

- Working repository: bkelly623/crm. Public GitHub inventory returned 22 repositories; only crm matched CRM/Optional/Radiant/Outpost naming or description. Private or differently named source repositories are not ruled out. Current repo is not marked a fork.
- Original product URL radiant-ai.replit.app currently serves Work Optional CRM sign-in. Historical docs/audit contains employee-access observations and inferred admin features, not proof of a complete original source-code copy. Authenticated current original-product inspection remains unverified.
- Local preview database read: one lead total; zero matching the three Pennsylvania samples. Those samples were collected as docs/pa-lead-sample.csv/json, not installed into this preview. Integration test fixtures intentionally clean up. Do not promise visible fixtures that were never seeded.
- Latest parent verification: 483 fast tests,38 PostgreSQL integration tests, lint/build/typecheck passed. Calling remains deliberately unavailable; reservation-only intent backend is not finished telephony.

## Page contract
Every page must say what it is for, show the next useful action, link records into a complete workflow, save changes reliably, and show loading/empty/error states. Missing integrations must show Not connected rather than fake success. Phone usability and server-side authorization are mandatory. The source-level navigation audit is being recorded separately in NAVIGATION_AUDIT.md; it is not an authenticated browser audit.

## Intended navigation and purposes
- Home: today's follow-ups, callbacks, appointments and next recommended action.
- Leads: master records, create/edit/search/import, tags/lists, ownership, notes and activity.
- Lead Scraper (new): find public business prospects by niche/location, inspect source-backed results, deduplicate and import selected records into a named list.
- Dialer (rename Floor): select eligible list and owned caller ID; review lead, call, disposition, note and follow-up, then advance.
- Tasks & Follow-ups: create/reschedule/complete linked work; overdue/today/upcoming filters; promise review.
- Appointments (rename Bookings): book/reschedule/cancel with explicit timezone, calendar connection state and outcomes.
- Pipeline: stages and next actions for opportunities. Do not label a static list Sequences; email sequences require a separate working sending/scheduling/unsubscribe integration.
- Call History: authoritative outcomes/durations, linked leads and permitted recording playback.
- Playbook: editable scripts, objection handling and short contextual operating instructions, not copied compensation rules.
- Reports (rename Pulse): real conversion/activity metrics with date ranges and drill-downs; no invented totals.
- Team: invitations/assignment/roles matching server permissions.
- Settings: profile/timezone/security and real integration readiness with clear connect/test actions.
- Leaderboard (rename Standings): optional team view of real metrics; hide for solo operation unless useful.

## Latest user-approved priority and scraper requirements

Finish the dialer first so the user can place real controlled test calls, while usability/access repairs proceed independently. Browser SDK integration follows the authoritative lifecycle contract; then actual recipient-approved pilot. No unsolicited sample-business test calls or inbound routing changes.

Lead Scraper must support mobile-only results via provider-verified line type enrichment, not prefix guesses or website SMS buttons. Preserve mobile, landline, fixed/nonfixed VoIP, other and unknown separately with provider/timestamp/errors. Strict mobile-only excludes unknown; offer mobile-preferred separately. Twilio Lookup Line Type Intelligence supports these categories and is paid; do not enable paid batches without explicit budget, cost preview, cache policy and hard cap. Deduplicate before billable lookup. Provider data can be stale or wrong; no absolute guarantee.

Owner/direct reachability is separate from line type. Store source-backed owner/contact role, explicit direct/cell labels, business size evidence when available, and later user-confirmed outcomes (owner reached, receptionist, IVR, wrong number). Distinguish observed facts from likely-owner heuristics and show the reasons rather than unsupported numeric probabilities. A mobile business number is not consent or proof of no receptionist; do not collect hidden private numbers or auto-dial to probe ownership. Apply suppression/eligibility separately from acquisition filters.

Source: https://www.twilio.com/docs/lookup/v2-api/line-type-intelligence and https://www.twilio.com/docs/lookup/quickstart (checked during this planning update).

## Delivery order
### 1. Make preview understandable and populated
Audit each navigation page/component and action. Rename ambiguous labels. Publish in-app purpose/next-step guidance. Safely seed a clearly marked Pennsylvania demo list into the local database, assigned to the confirmed signed-in user with idempotency and readback through normal scoped APIs. Never call these real businesses for QA; keep all demo records excluded from calling. Verify on user's actual phone and an authenticated browser. Do not import directly into production.

### 2. Finish lead acquisition and daily work
Replace fragile CSV parsing with quoted-field support, mapping, preview, per-row errors, duplicate review, source tracking and idempotent import batches. One master record can belong to multiple lists. Complete create/edit, timestamped authored notes, tasks, meaningful pipeline stages and appointment lifecycle. Provide a demo walkthrough: import -> list -> lead edit -> note -> follow-up -> appointment -> outcome.

### 3. Build Lead Scraper into CRM
Inputs: industry/keywords, city/region/radius, limit and destination list. Choose a permitted provider/source adapter, with explicit provider costs before activation. Prefer licensed datasets/APIs and permitted public business sites; check Google/provider storage and reuse terms before persistent CRM ingestion. Do not bypass CAPTCHAs/logins or invent contact data.
Jobs persist progress, limits, cancellation, failure/retry and provenance. Outbound website fetching needs SSRF protection, redirect/size/time limits and rate control. Show business name, phone, website, available public email, source URL/date and uncertain/missing fields. No guessed email represented as verified. Review/dedupe before import; phone match alone is not proof of same business. Select results -> import batch -> named list -> linked master leads. No automatic outreach. Source/job counts and billable usage verified.
Acceptance: one real permitted source search works end-to-end; retry or import twice produces no unintended duplicates; unselected results stay out; job resumable; no arbitrary internal-network fetching; outreach eligibility remains separate.

### 4. Finish calling without risking existing inbound
Complete parent/child SID binding, signed callback idempotency, terminal release/reconciliation, authoritative call history, suppression/timezone/cooldown/spend constraints, then Voice SDK audio and real owned-number inventory. Preserve default-off recording and the existing inbound missed-call text-back. Test only an explicitly approved recipient. Verify real mobile audio/interruptions; enable no prospect calling on mock evidence.

### 5. Connect automation and reporting
Calendar integration, consent-aware recording, callback priority, human-confirmed promise tasks, compact briefs only for connected duration strictly over150seconds. Business mailbox/email integration is separate from identity naming; require sender authentication, unsubscribe/suppression, explicit send controls and budget before outbound campaigns. Report real conversions rather than decorative counters.

### 6. Release gate
Authenticated click-through of all navigation destinations; representative solo/staff/admin authorization; backup/restore and schema-drift reconciliation; persistent deployment rather than an ephemeral tunnel/tmpfs database; signed-in real-phone walkthrough; explicit production migration/calling/inbound cutover approval. Keep existing inbound/text-back behavior unchanged until separately tested and approved.

## Business email recommendation
Use brendan@get247roi.com as the human-facing mailbox for sales and relationship follow-up. Add hello@ as a general-inquiry alias and admin@ as a private operational alias if useful. Founder@ is optional branding, not needed. Do not request passwords in chat; connect via OAuth or a secure credential channel when available. Mailbox creation/DNS/sending are not performed by this plan.
