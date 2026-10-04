# Sequential dialer implementation report

## Scope and status

Client-only, explicitly opted-in sequential calling built on the existing authenticated call-intent lifecycle. The newer user authorization for sequential next-lead calling supersedes manual-only wrap-up **only while this session remains opted in and all automatic-advance guards pass**. No server route, schema, environment, provider routing, recording policy, or authorization changes.

Source verification is offline/synthetic. Parent owns independent review, build, real responsive-browser checks and any release. No build, commit, push, deployment, production write, or provider call was performed by this implementation worker. The running preview's `.next` was not rebuilt.

## User workflow

1. **Load lists** and **Load numbers** are explicit read-only setup actions. Choose a **Named list** and **Call from** owned-number inventory entry manually. Neither is automatically selected. Optional tags/SmartViews and legacy manual review are under **Advanced filters & manual review**; no saved filter is silently selected.
2. **Start session** is unavailable until those choices exist and recovery confirms the browser is not holding an earlier call. Its click initiates microphone/token preparation if needed, fetches the first eligible list lead and requests one authorized intent. No extra Prepare/Call click is required for this path.
3. Browser accept alone never labels a recipient connected. Existing server child-call evidence controls the connected label. Existing bounded status polling remains in place.
4. Automatic advance requires the current, locally started, error-free call to reach server-confirmed wrap-up: `canStartNewIntent === true`, `locked === false`, terminal intent state **and terminal statuses on both parent and child legs**. Missing-leg/expired/unbound proof is not enough for automatic advance; the session pauses for manual review.
5. A visible **Next call in 5 seconds** countdown starts only after that proof. Duplicate status responses do not create duplicate timers. After five foreground seconds, any edited disposition is saved successfully before fetching the next lead. Unedited dispositions cause no PATCH and no fabricated outcome. Then the controller completes proven wrap-up and starts exactly one next intent using the same selected caller ID and named-list queue.
6. **Pause** and **Stop** are always enabled, including during current calls, pending queue/save operations and countdown. Both immediately revoke automatic continuation and invalidate late queue results. They do not call wrap-up, delete leases, hang up, or pretend the current call ended. A call whose intent has already been initiated remains the current call, including a pending SDK connection; use **Hang up** for current-call audio teardown. Hang up also prevents this session from automatically advancing.
7. After pausing/error/interruption, finish/check any held call, explicitly **Complete wrap-up**, then use manual **Next Lead** (or **Save & Next** for retained edits) and **Start session** as appropriate. A previously attempted lead is never automatically retried. The legacy **Resume** button inside manual review only re-enables manual review; it does not opt back into automatic calling.

## Failure, race and limit handling

- A session generation invalidates pending preparation/queue/save continuations on Stop, interruption or disposal. Once a current intent is issued, its existing controller/server hold remains authoritative.
- Microphone/token/intent/SDK/status/network/queue/save failures stop automatic continuation. A later successful reconcile does not silently opt back in. Recovered calls never acquire an automatic session.
- Hidden, offline, pagehide and unmount stop continuation. Returning visible/online does not restart it. Availability is checked at explicit start and again around asynchronous call preparation/queue transitions, not only in event listeners.
- Queue/save transport including queue JSON parsing is bounded at 12 seconds. Timeout retains drafts and stops; a late response cannot dial. A timed-out or interrupted save may have committed remotely, so the UI instructs manual verification before retry. Unmount aborts queued transport best-effort without modifying server leases.
- Stop during a save allows the already-issued write to settle but does not fetch another lead afterward. Stop during next-lead fetch ignores the late candidate. Pause/Stop do not erase exclusions or reset attempt history.
- Both the existing review exclusion limit and the sequential attempt set are capped at **100** for this mounted workspace. IDs are never evicted to make room. Exhaustion or the limit stops automatic calls; a reload is an explicit new in-memory session, not a cross-session cooldown or durable do-not-retry guarantee.
- Changing selection invalidates the session rather than silently falling back to all leads or a different number. Setup/filter/manual call controls remain held while the session runs. Disposition remains editable during the call/countdown, and is disabled while a save/queue transition is underway.
- Server identity, assignment/access, eligible SDR statuses including DNC exclusion, owned voice-number validation, one-user/one-lead leases, signed lifecycle proof and recording OFF remain unchanged. The browser still passes only `IntentId` to the SDK. No parallel/predictive dialing or automatic intent retry was added.

## Pacing and operational limits

The five-second gap is human wrap-up/cancellation time, **not spam-filter prevention**. Carrier labeling, consent/legal eligibility, time-of-day restrictions, aggregate spend/daily rate limits, durable retry cooldowns and number reputation are not solved by this delay. Existing 30-second ring timeout / one-hour call ceiling and recording OFF are preserved; this slice does not change inbound routing. Delayed callbacks/polling can make the actual inter-call gap longer than five seconds. Mobile audio reliability, browser background behavior and real recipient connectivity require separate authorized physical-phone acceptance.

## Files

- New `src/components/dialer/sequential-session.ts`: bounded sequential orchestration, cancellation generations, timers, attempt history and call-proof gates.
- `src/components/dialer/browser-dialer.ts`: exposes both-leg proof and sticky per-call automatic-advance safety; normal SDK disconnect waits for server completion instead of being treated as permission to advance.
- `src/components/dialer/dialer-panel.tsx`: explicit list/number setup, Start/Pause/Stop, visible countdown/error states, save-before-next, bounded queue transport and browser lifecycle cancellation.
- `src/components/dialer/browser-call-controls.tsx`: neutral ready label and disables manual wrap-up while automatic progression owns the transition; Hang up/status/error controls remain accessible.
- New `tests/sequential-session.test.ts` and `tests/sequential-dialer-ui.test.tsx`; related existing browser/UI/mobile tests updated for intentional Pause/Stop availability and advanced-filter layout.

## Verification evidence

Observed RED before feature implementation: Start did not call (0 versus expected 1), missing Start-session UI, missing both-leg proof. Additional observed RED regressions preceded fixes for hung queue timeout, selection invalidation stranding an active session, hidden/offline explicit Start, and nonterminal-leg manual recovery.

Coverage includes real controller plus injected SDK/HTTP boundaries and rendered real panel under jsdom: duplicate Start/status, five-second timing, normal disconnect, both-leg mismatch, active/countdown/queue/save Stop races, late microphone/queue results, save-before-next and unchanged outcomes, queue/save failures, microphone/intent/token errors, browser lifecycle events, recovered state, no repeated leads, empty queue and 100-attempt cap. Existing server guard/lifecycle tests run unchanged.

Final full run after the two independent-review blocker fixes: **45 test files / 685 tests passed** (`CI=1 npm test`). `CI=1 npm run lint </dev/null`, `CI=1 npm run typecheck` and `git diff --check` passed.

### Independent-review safety blockers corrected

- **Server failure is independent of SDK errors.** A server `failed` or `canceled` status on either leg, or a canceled intent, now publishes a call error and sticky-revokes `autoAdvanceSafe`. This includes a completed parent / failed child with `locked=false` and `canStartNewIntent=true`. Terminal lease-release proof remains valid: the user can manually wrap up after authoritative release, but terminal does not imply safe automatic continuation. Completed/busy/no-answer child outcomes remain eligible for continuation when all other guards pass.
- **SDK cancel/reject are not normal disconnect.** Each immediately publishes an error, stops the opted-in session and sticky-revokes per-call automation safety. The server hold remains until authoritative proof; later successful status checks/reconciliation cannot rearm the stopped session. Normal SDK disconnect still waits for server proof without itself revoking error-free continuation.
- Observed RED→GREEN: the five server-outcome cases (failed parent, failed child, canceled parent, canceled child, canceled intent) first failed because `autoAdvanceSafe` remained true; all passed after the server-outcome fix. Separate cancel and reject tests then failed for the same unsafe flag and passed after the SDK-event fix. Each sequential regression advances fake time before and after later successful reconciliation and asserts exactly **one intent issuance and one SDK connect**, no countdown/restart, and manual recovery. Added direct browser-controller regressions also check manual wrap-up on failed terminal outcomes and cancel/reject release holds. These tests exercise actual TypeScript controllers with injected HTTP/SDK boundaries, not real provider calls.
- This correction modified only `src/components/dialer/browser-dialer.ts`, `tests/sequential-session.test.ts`, `tests/browser-dialer.test.ts`, and this report; existing page-copy/UI work and real-lead records were not changed.

No real provider/audio calls or authenticated production acceptance are claimed.

### Parent verification and browser evidence
- Parent independently reran all 685 tests, lint, typecheck and an isolated production Next build successfully. Logs: `/tmp/crm-sequential-final-tests.log`, `/tmp/crm-sequential-final-build.log`. Serving preview3090 and its `.next` were not overwritten.
- Actual components at320/390/412px mobile emulation: no horizontal document overflow, all visible measured controls at least44px high, Start session inside first844px viewport. Evidence: `docs/sequential-evidence/setup-measurements.json` and matching PNGs. Setup screenshots precede the shorter page-copy correction (which separately observed RED then GREEN).
- At390px, a synthetic-only browser scenario exercised manual list/number selection, Start, one intent, authoritative completion, visible countdown, second intent, then Stop followed by settlement with no third intent. `docs/sequential-evidence/session-flow.json` and `countdown-390.png`. Harness-only `session-fixture.ts` uses simulated SDK/microphone/network and cannot call a provider. An initial fixture bug counted reconcile POST as new intent; corrected exact endpoint matching before the successful final run. Foreground visibility was explicitly restored using Page.bringToFront; hidden-tab refusal worked as intended.
- Production contact import was independently read back by the parent: exactly3 members in `Allentown Plumbing — Verified Contacts`; see `REAL_LEADS_IMPORT_REPORT.md`. Old placeholder contacts are excluded, not overwritten.
- Provider diagnosis of previous attempts: parent notifications identify error13224, invalid number, for all three failed child calls. Those destinations were placeholder data; no trial/geo/routing change was justified. Correct contact data is separate from proof that a future call will connect.
- Independent rereview and production release readback are recorded by the release owner after completion.
