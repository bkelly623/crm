# Sequential flow fix report

## Outcome and scope

Source-only correction to the opted-in session workflow. Start session still requires a manually chosen named list and verified owned caller ID. An ordinary **Hang up** now ends the current SDK call without treating the user's deliberate action as an audio failure. Once the existing server lifecycle proves both legs terminal and the lease released, the existing five-second countdown advances to the next eligible lead automatically. No per-call Prepare, Complete wrap-up, Next or Call click is required in a healthy active session.

No provider call, provider/API configuration, database, environment, build, deployment or commit was performed. Existing `.next` / preview3090 were not touched. Parent owns independent review, browser/physical-device acceptance, build and release.

## Root cause and observed RED

`BrowserDialer.hangUp()` called `uncertain()` unconditionally after successful local `call.disconnect()`. That published an error and sticky-cleared `autoAdvanceSafe`, immediately stopping `SequentialSession.observe()`. Later authoritative terminal proof could not rearm it. This was intentional prior behavior but conflicted with the user's requested sequential workflow. Manual instructions and disabled per-call controls remained visible even when automatic progression owned the transition.

Before source edits, a regression rendering the real `DialerPanel` / `BrowserCallControls`, real browser-call controller and session coordinator clicked the actual **Hang up** button. An injected SDK emitted normal disconnect. After server terminal settlement the expected countdown was absent (RED, `/tmp/crm-flow-red.log`). Minimal controller change made this regression pass.

A second RED established that manual Call/Save controls remained visible during a session and End session was missing (`/tmp/crm-flow-ui-red.log`). Session-aware controls and End session passed it. A further RED caught End during countdown not tearing down a remaining SDK call object; that now tears down local audio after revoking continuation.

## Exact controls and safety semantics

- **Start session:** prepares microphone once when needed, obtains the queue lead and initiates one authorized call; subsequent healthy calls reuse the prepared Device.
- **Hang up during an active call:** invokes local SDK disconnect and waits in reconciling. It preserves existing automation eligibility, never sets it back to true, never clears existing errors and never releases a server hold. Normal SDK disconnect is expected. It does not itself authorize another intent.
- **Pause:** synchronously revokes future session/timer/queue/save work; does not hang up current audio. Explicit restart/manual recovery remains required.
- **End session:** first executes the same synchronous cancellation, then tears down current or pending local audio through the controller. Late SDK connect results disconnect without becoming a current call. If terminal wrap-up has no remaining local call object, no redundant teardown is needed. No controller wrap-up, lease deletion or pretend server completion occurs.
- **Failure handling remains fail-closed:** SDK cancel/reject/error (even emitted during Hang up), failed/canceled parent or child outcomes, canceled intents, local teardown exceptions, uncertain responses and missing terminal proof do not acquire automatic continuation. Reconciliation cannot restore a revoked flag. Hanging up before a SDK call object exists keeps the existing conservative pending-connect/device teardown behavior; it is not declared successful completed calling.
- **Active-session UI:** hides manual Prepare, Call, Next/Save & Next, Complete wrap-up and advanced/manual-review controls; shows session-specific settlement text. Disposition edits, errors, status checks, mute, Hang up and keypad remain available where applicable. Manual controls return outside the active session for recovery/optional manual mode.
- Foreground/online checks, generation cancellation, bounded polling/queue/save waits, exclusions, no retries, unchanged dispositions, server ownership/DNC/authorization and two-leg release logic are untouched. Pacing remains human wrap-up time, not spam-label prevention.

## Verification

- `CI=1 npm test`: **46 files / 747 tests passed**. Full log: `/tmp/crm-flow-tests.log`.
- `CI=1 npm run lint </dev/null`: passed, zero warnings.
- `CI=1 npm run typecheck`: passed.
- `git diff --check`: passed.
- Real-component integration file: **32 tests passed**. New coverage exercises actual Hang up, release-before-countdown timing, no repeated microphone preflight, End during prepare/queue/connect/countdown, local teardown failure, SDK cancel/reject/error during Hang up, failed/canceled provider outcomes, missing legs and retained server locks. Existing Pause/save/error/hidden/offline/unmount regressions still pass.
- Automatic-polling integration performs only Start → Hang up → End user clicks: held live server fixture does not advance; authoritative terminal fixture starts a five-second countdown; exactly two intent POSTs and SDK connects occur, with one microphone preparation; End prevents a third. This uses real panel/controller/session code, injected synthetic HTTP/SDK boundaries and fake time, not provider audio.
- The first full run exposed one old mobile test still querying the renamed Stop label. Updated that expectation to End session, then reran the complete suite successfully.

## Files changed

- `src/components/dialer/browser-dialer.ts`: successful local disconnect no longer unconditionally publishes uncertainty; exception path remains unsafe.
- `src/components/dialer/browser-call-controls.tsx`: session-aware manual controls and messaging.
- `src/components/dialer/dialer-panel.tsx`: explicit End session, cancellation-before-teardown, active-session UI.
- `tests/sequential-dialer-ui.test.tsx`: integrated event/polling fixtures and regressions.
- `tests/browser-dialer-ui.test.tsx`, `tests/caller-id-selector.test.tsx`, `tests/mobile-usability.test.tsx`, `tests/queue-review-integration.test.tsx`: Stop → End session label expectations only.
- `docs/SEQUENTIAL_FLOW_FIX_REPORT.md`: this report; supersedes the old report's statement that ordinary Hang up must pause the session.

## Remaining acceptance

Parent independent source review and build/release are still required. Synthetic integration does not certify physical-device audio or deployed runtime behavior. Pending connect, SDK cancellations and unsafe server outcomes intentionally still require manual recovery rather than blindly enabling auto-next.
