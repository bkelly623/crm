# Outpost: mobile-first sales CRM and sequential dialer

Status: PLANNED. Source inspected and read-only Twilio inventory checked; no implementation, database migration, live routing change or call made.

## Objective and scope
One master lead database, named calling lists/tags, editable lead workspace, authored notes/tasks, one-at-a-time calling, selectable owned caller IDs, consent-aware recordings, protected inbound callbacks, and a phone-first interface. Functional workflows take priority over copying the original desktop layout.

## Verified starting point
- Local checkout: /home/precision_focused_solutions/crm; baseline commit 9c871dc.
- Existing Next.js / Prisma / Supabase app; current dialer opens tel: links, not Twilio browser audio.
- Current schema has leads, calls, tasks and SmartViews; no structured tag/list or note timeline models.
- CSV importer naively splits on commas; fix quoted fields and duplicate detection before bulk import.
- Supplied Twilio credentials successfully authenticated a read-only number inventory request.
- Inventory returned one voice-capable number, matching the user's (610) 300-3001; no further inventory pages.
- Existing inbound Voice URL is https://www.get247roi.com/api/voice/inbound. Preserve it until its behavior and ownership are audited and a routing cutover is approved.
- Credentials are not included in this document or repository. User authorized supplied credential use. Rotation is recommended because it was shared in chat, but is not treated as a user-approved blocking requirement. Production still needs server-side secret provisioning; never send account secrets to the browser.
- Real lead sample: three plumbing businesses serving Allentown PA, verified from business websites, not a Google Maps scrape. Website listing does not establish consent or calling eligibility.

## Product decisions

### Latest approved requirements (override earlier optional wording)
- Preserve the existing missed-call text-back automation end-to-end. Do not overwrite voice/SMS/status routes. Trace the existing trigger first; voicemail answering can change call outcomes and must not suppress or duplicate the text-back. Regression gate: missed inbound call -> original text-back exactly once plus CRM callback task, with opt-out handling preserved.
- Callback priority and promise tracker are confirmed scope, not merely suggestions. Ship callback priority with P4; promise tracker follows reliable notes/consented transcript handling.
- Compact brief means a post-call brief triggered only when connected talk time is strictly greater than 150 seconds (2 minutes 30 seconds), not ring time. Use available authorized notes/transcripts; no fabricated content if audio was not recorded. Threshold configurable later. Test below/at/above the boundary.
- Recording is OFF by default with an explicit per-call on/off toggle. Discovery calls can be recorded with the approved consent workflow. Length alone never enables recording; toggling off stops subsequent recording and does not silently erase previously retained audio.
- Keep user-facing updates short: shipped, verified, blockers. Maintain detailed plan/tests in the repo rather than long chat reports.
- Dialing is sequential and human-controlled; wrap-up precedes the next call. No predictive or parallel dialing.
- Single master lead, many tags and many named lists; saved filters are dynamic views, not copies.
- Caller ID: manual override > prior caller ID for this lead where appropriate > list/regional rule > default. Only server-verified authorized numbers; region is not inferred solely from an area code. No rotation to evade spam labeling.
- Dialer Focus Mode sends inbound business callbacks to voicemail during a session, including wrap-up. Missed calls become visible callback tasks. Shared-number ownership rules must be explicit for future multi-rep use.
- Personal cellular calls remain outside browser control. Phone Focus/DND configuration is a checklist, not an enforcement guarantee. Mobile browser background/GSM interruptions are a documented limitation.[4]
- Automatic recording attachment is supported only after the approved consent policy permits recording. Pennsylvania's all-party prior-consent exception is relevant; obtain legal review of the actual announcement/consent workflow and interstate calls before launch.[5]
- No unsolicited prospect calls during QA; use explicitly authorized test recipients.

## Build sequence and acceptance gates

### P0 — Baseline, environments and safety (NEXT)
- [ ] Read local repository rules; audit auth, row access, APIs, dependency security, existing integration settings and deployments.
- [ ] Install with a lockfile; reproduce build/typecheck/lint; establish automated tests and document baseline failures.
- [ ] Obtain authorized deployment/database access; inspect schema without changing production. Establish backup and restore rehearsal.
- [ ] Create isolated staging database/deployment and test-recipient allowlist. Default external calling off.
- [ ] Provision server-only Twilio secrets/API key/TwiML app as needed; scrub logs and limit destinations/spend.
- [ ] Audit existing inbound handler, fallback behavior and rollback route. No blind overwrite.
Gate: reproducible build, authenticated staging, denied unauthorized access, restore proven, zero live dialing by default.

### P1 — Master leads, lists, notes and tasks
Depends on P0.
- [ ] Add Tag, LeadTag, LeadList, LeadListMembership, LeadNote and ActivityEvent; migration preserves existing leads/tasks/notes.
- [ ] Add source provenance, contact timezone/confidence, phone normalization, suppression and test-data isolation.
- [ ] Build lead CRUD/search, bulk tags/list membership, filtering, notes, task due dates and assignment/completion.
- [ ] Replace CSV parser; preview, field mapping, validation/error report, dedupe and safe import undo.
- [ ] Add soft deletion and merge audit. Phone match alone flags possible duplicates, not automatic deletion.
Gate: import twice without accidental duplicates; one lead in two lists stays one record; edits persist; unauthorized lead access blocked; source tracking retained.

### P2 — Mobile interface and dialer workspace
Depends on P1; mobile design begins here, not after desktop completion.
- [ ] Responsive shell, lead cards, thumb-sized controls, keyboard-safe notes and accessible contrast/labels.
- [ ] Persistent call workspace across internal navigation; autosaved drafts with visible save/error states.
- [ ] List selector, caller-ID selector, queue preview and eligibility reasons.
- [ ] Home-screen manifest and best-effort wake lock; no insecure caching of secrets, recordings or sensitive responses.
Gate: browser automation at phone/tablet/desktop widths; no sideways page scrolling; software keyboard does not hide save/hangup; drafts survive expected navigation.

### P3 — Real Twilio calling and authoritative queue
Depends on P0-P2.
- [ ] Voice SDK, authenticated short-lived tokens, microphone/audio-device preflight and token refresh.
- [ ] Server-created call intents bind user, authorized lead and approved caller ID; browser cannot choose arbitrary destinations/caller IDs.
- [ ] Explicit states: ready -> dialing -> ringing -> connected -> wrap-up -> next; pause/stop/error states included.
- [ ] Mute, hangup, DTMF, duration, manual caller-ID selection, optional regional rules.
- [ ] Atomic lead leases and idempotency prevent double clicks, dual tabs and two reps dialing one lead simultaneously.
- [ ] Validate Twilio signatures; handle parent/child call SIDs, duplicate/out-of-order events and stuck-call reconciliation.
- [ ] Hold queue on tab loss, audio failure or unknown call state; never auto-redial on recovery.
Gate: approved test calls connect both ways with correct caller ID; busy/no-answer/failure log correctly; duplicate callbacks do not double count; no next call while an existing call is active.

### P4 — Inbound protection, voicemail and recordings
Depends on P3; preserve current inbound route until approved cutover.
- [ ] Server-side session availability with heartbeat expiry and provider call-state checks; stale sessions cannot leave permanent DND.
- [ ] Route inbound business calls according to Focus Mode; keep personal cellphone limitations explicit.
- [ ] Business voicemail greeting, secure recording association and callback tasks deduplicated by inbound call ID.
- [ ] Match known callers to leads; unknown callers stay in inbox until reviewed; shared business numbers may be ambiguous.
- [ ] Consent-aware recording start, decline/unrecorded path, private playback, access audit and retention/deletion lifecycle.
- [ ] Optional transcripts only under the same approved consent/data policy.
Gate: inbound call during outbound/wrap-up does not ring the CRM; voicemail persists and creates one task; stale-session recovery works; unauthorized playback denied; existing inbound behavior can be restored.

### P5 — Caller trust, eligibility and operating limits
Start registration discovery during P0; required controls before pilot.
- [ ] Inspect Trust Hub status; verify real business profile and eligible numbers for SHAKEN/STIR.[2]
- [ ] Register numbers through Voice Integrity; evaluate CNAM/branded calling where supported. Confirm actual account/product availability instead of assuming reputation-monitoring APIs exist.[3]
- [ ] Global DNC suppression and documented applicability review for DNC/TCPA/state rules, business vs personal/mobile contacts and recording.
- [ ] Recipient-timezone business-hour eligibility, conservative retry/cooldown policy, wrong-number retirement and per-contact attempt limits across all lists/numbers.
- [ ] One concurrent call per rep; controlled volume changes, daily spend/usage guardrails and kill switch.
- [ ] Dashboard for answer/no-answer/failure rates, short calls, opt-outs, carrier errors, costs and verified external label reports. These are indicators, not a claimed carrier spam score.
- [ ] Registration/remediation checklist for each new number. No promise of avoiding spam labels: carrier decisions and complaints still apply.[1]
Gate: suppressed/out-of-window leads cannot be dialed server-side; new numbers cannot bypass eligibility; cost/kill switches tested; business identity accurate; labels never fabricated from call metrics.

### P6 — Pilot, production cutover and release
Depends on P1-P5 gates.
- [ ] Full regression, access-control review, backup/restore, staging load and webhook replay tests.
- [ ] User's real phone: foreground call, screen lock, app switch, cellular interruption, headset, permission denial, lost Wi-Fi and network transition.
- [ ] Confirm interruption behavior; if browser calling fails the required reliability bar, use phone-bridge fallback or native app rather than promise a web fix.
- [ ] Approved real test recipient exercises call -> notes -> task -> disposition -> next; voicemail and recording tests included.
- [ ] Explicit approval for production migrations, inbound routing change and external-call activation. Capture old settings and rollback procedure.
- [ ] Small supervised pilot; expand only after reviewing errors, user experience, callbacks and calling eligibility.
Gate: user completes an end-to-end mobile session with verified persisted records; production readback and smoke tests pass; monitoring and rollback are usable.

### P7 — High-value upgrades (after core reliability)
- [ ] Callback priority: callers who return your call go to the top after wrap-up, retaining last conversation and original number.
- [ ] Promise tracker: propose tasks from opted-in transcripts or dictated notes; user confirms dates/assignees before saving. No silent AI commitments.
- [ ] Call brief: compact sourced business facts + last conversation + next promised action, with observed facts separated from hypotheses.
- [ ] Relationship continuity: same caller ID per lead, history visible, no repeated pitch after prior contact.
- [ ] Outcome learning: compare list/time/script performance by conversations and booked outcomes, not raw dial volume; show sample sizes and uncertainty.
- [ ] Readiness check: mic, audio, connectivity, foreground state, wake lock, account configuration and approved caller ID before a session.

## Definition of done for every implementation ticket
Red test -> implementation -> green tests -> typecheck/lint/build -> browser or integration evidence -> security review -> documentation. Each ticket records owner, dependencies, migration impact, test commands/results and rollback. Completion means exercised behavior, not a button or route that merely exists. Never mark live calling verified from mocked tests.

## Decisions needed before relevant gates
- Actual phone OS/browser and approved live test recipient (before P3/P6).
- Real business identity, trust-registration details, database/deployment access and preferred secret provisioning (before production).
- Legal-reviewed recording script, retention and outreach eligibility policy (before P4/P5 live use).
- Whether the current inbound handler must remain default outside dialer sessions (audit first).
- Public lead sample is UI/import data only and not automatically placed in an eligible dialing queue.

## Plan status
- [x] Inspect source and identify scaffold gaps.
- [x] Verify Twilio credential and number inventory read-only.
- [x] Collect small sourced Pennsylvania business sample.
- [x] Write this phased plan.
- [ ] P0-P7 implementation and acceptance tests — NOT STARTED.

## Sources

[1] https://support.twilio.com/hc/en-us/articles/9375068873499-Outbound-Calls-Blocked-or-Labeled-as-Spam-or-Scam-Likely
[2] https://www.twilio.com/docs/voice/trusted-calling-with-shakenstir/shakenstir-onboarding
[3] https://twilio.com/docs/voice/spam-monitoring-with-voiceintegrity
[4] https://www.twilio.com/docs/voice/sdks/javascript
[5] https://legis.state.pa.us/WU01/LI/LI/CT/HTM/18/00.057.004.000..HTM
