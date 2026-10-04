# Sequential microphone-preparation restart fix

## Finding and scope

This is a deterministic client defect, **not evidence that microphone interruption caused the reported production incident**. The separate imported-ID/HTTP 400 work is outside this change.

Read the actual `SequentialSession`, `BrowserDialer.prepare()` / `interrupt()` generation guards, and `/tmp/crm-call-start-probe/permission-retry.test.ts` before changing code. The controller already invalidates interrupted preparation and protects newer preparation from old success/catch/finally handlers. The session's boolean `working`, however, remained true until the unresolved old permission promise settled. A fresh explicit Start therefore silently returned before a second microphone request.

## Change

- Replace the session-wide boolean with a per-run work identity and a preparation-only flag.
- Stop detaches only preparation work. If that preflight is still marked preparing and unlocked, invalidate it through the existing controller interruption mechanism. This is logical cancellation; it does not claim to cancel the browser's permission prompt itself.
- Queue/disposition-save and intent work remain exclusive until their actual completion. Stop does not indiscriminately clear working state.
- Old run continuations remain epoch-guarded; only the current work identity can clear work or observe in `finally`.
- Stop never wraps up, releases a call lock, or disconnects an active call. No BrowserDialer, UI, API, validator, persistence, or provider code was changed.

## Regression evidence

Tests instantiate the actual BrowserDialer and SequentialSession, mocking browser microphone/SDK/HTTP boundaries only; there are no live calls.

1. **RED:** `npm test -- tests/sequential-session.test.ts -t 'fresh Start'` failed both resolve/reject cases with `expected "spy" to be called 2 times, but got 1 times`, before the production edit.
2. **GREEN:** the same session suite passed after the phase/identity change (32 tests at that step).
3. Expanded safety coverage then passed: **36/36 session tests**.

New coverage checks:

- Interrupt unresolved microphone preparation, explicitly Start again, and observe a second microphone request before resolving the old one.
- Resolve or reject old permission while the new permission remains pending: no queue call, SDK call, readiness/error overwrite, countdown, or session interruption.
- After stale completion, Stop/restart cannot replay a newer pending queue operation; late queue completion cannot dial. A later deliberate Start can call normally.
- Resolve or reject old permission after a newer call starts: its snapshot/lock remain unchanged, with no extra connection or local teardown.
- Stop during an unsettled disposition save remains exclusive even if the caller manually wraps up the proven-terminal call.
- Plain Stop during preflight permits explicit fresh preparation; old completion cannot duplicate the call.
- Stop during pending intent issuance preserves the hold, does not duplicate issuance, and a failed response cannot restart automation.

Existing pause/stop/countdown, SDK failure/recovery, authoritative terminal-leg proof, server failure/cancellation, save failure, selection, session-limit and no-automatic-retry checks remain passing.

## Verification and concurrent-work boundary

No competing Vitest/lint/typecheck/build process was found before the full checks.

- `CI=1 npm test`: **705 passed, 8 failed, 713 total; 45 files passed, 1 failed.** All failures were in the other worker's newly added `tests/imported-identifiers.test.ts`, exercising imported-list/lead validation (including expected 200/404 responses receiving 400). That worker's validator change was still in progress. These files were not edited here. This is not a claim that the combined checkout is fully green; rerun combined verification after that worker finishes.
- `CI=1 npm run lint </dev/null`: passed.
- `CI=1 npm run typecheck`: passed.
- `git diff --check`: passed.

Owned changes only:

- `src/components/dialer/sequential-session.ts`
- `tests/sequential-session.test.ts`
- `docs/SEQUENTIAL_PERMISSION_FIX.md`

No build, calls, data changes, environment/auth changes, commit, deployment, or production verification was performed.
