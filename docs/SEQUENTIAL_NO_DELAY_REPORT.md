# Sequential calling: no added inter-call delay

## Outcome / release boundary

Source-only change: removed the explicit five-second pacing countdown from opted-in sequential calling. A healthy active session now starts its existing save/queue continuation as soon as the browser controller has authoritative proof of **both call legs terminal and the server hold released**. The next intent still waits for any edited disposition to save successfully and the next eligible queue lead to load. No timer, scheduled retry or polling loop replaces the countdown.

This supersedes older reports describing a mandatory five-second session pause. Pause before the call ends when time is needed for notes or wrap-up. Pause and End session remain available during asynchronous continuation; neither can undo an intent that was already issued before the user clicked.

No build, deployment, commit, real call, database write, environment edit or provider change was performed. The existing `.next` and preview3090 were not rebuilt or operated on. Parent owns independent review and release. These are local synthetic tests, not deployed-runtime or physical-phone verification.

## Five seconds removed versus reported >30 seconds

The verified source delay was `SequentialSession.observe()` publishing `countdown: 5` and scheduling five one-second ticks **after** terminal release proof. That entire delay and its UI/state were removed.

The user's reported greater-than-30-second wait was not measured or reproduced against production in this task. Its full cause is **unverified**; removing five seconds does not establish that all observed latency has been fixed or that the next recipient will connect instantaneously. Existing server settlement/status-observation latency, queue/save/intent HTTP work and recipient connection time still exist. They are possible contributors, not a diagnosis of this report.

Unchanged: the 30-second ring timeout, browser status polling/backoff and bounded polling window, reconciliation requests and proof predicates, server lease release rules, provider settings and call-duration/recording policy. No safety confirmation was shortened or bypassed to achieve immediate orchestration.

## Implementation and safety

- `src/components/dialer/sequential-session.ts`: removes countdown state/timer; consumes the armed continuation synchronously before starting asynchronous work. Existing `working` exclusion, cancellation epochs, selection/foreground/online checks, attempted-lead exclusions, session limit and no-retry behavior remain.
- The coordinator also remembers consumed terminal intent IDs, bounded by the existing session attempt limit. A deliberately duplicated old proof arriving while the next intent response is pending cannot be consumed as a second completion or trigger another queue advance.
- `src/components/dialer/browser-dialer.ts`: adds only a read-only `terminalIntentId` accessor to identify the controller's existing terminal proof. It does not change how proof is calculated, status reconciled, holds managed, polling scheduled or calls issued.
- `src/components/dialer/dialer-panel.tsx` and `browser-call-controls.tsx`: remove countdown messaging and state; explain no added delay, required proof/save readiness, and using Pause before completion for notes. During settlement/save/queue work the controls say that edits are being saved and the next lead loaded, rather than showing a fake timer.
- Failed/busy/no-answer recipient outcomes may continue only under existing safe settlement rules. Canceled outcomes, failed parents, SDK/transport/audio errors, unknown/missing proof and interrupted sessions remain fail-closed. Later successful reconciliation does not restore revoked opt-in.
- Pause/End, hidden/offline/pagehide/unmount and save/queue failure still cancel continuation. Generation checks after awaited work prevent late responses from placing another call. No overlapping calls, automatic retry, double advancement or busy-loop mechanism was introduced.

## RED → GREEN evidence

1. Before changing source, changed the immediate-progression regression to require the next save/queue request immediately upon authoritative settlement. RED: expected two queue callbacks, received one; the old implementation was still waiting for its countdown. The same regression passes with the clock unchanged through save readiness and next connection.
2. Before changing UI, a rendered-panel regression required truthful no-added-delay copy and absence of countdown/pacing language. RED: the new copy was absent. It passes after updating the actual panel and controls. Initial UI RED log: `/tmp/crm-no-delay-ui-red.log`.
3. An adversarial duplicate-proof regression then caught an extra queue callback when an old terminal response was repeated during the next intent issuance. RED: expected two queue callbacks, received three. The consumed-intent guard and read-only proof identity accessor made it pass without altering controller reconciliation/proof criteria. Unit fixtures now issue distinct synthetic intent IDs, as actual issuance does.

Updated `tests/sequential-session.test.ts` and `tests/sequential-dialer-ui.test.tsx` cover:

- Immediate continuation at unchanged fake time, with duplicate notifications during save/queue work and pending intent issuance.
- Separate deferred disposition save and deferred next-lead request: no intent before both complete; exactly one write, queue advance and new intent afterward.
- Pause before proof, in the same turn as a pending proof response, and immediately after resolving a save promise.
- End session during queue work; Pause during disposition save; hidden/offline/pagehide/unmount during queue work and late responses.
- Real rendered Hang up through the real controller and automatic polling: proof required, then next distinct lead without an additional five seconds.
- Missing/nonterminal legs, unreleased holds, failed/canceled parents, canceled child/intent, SDK errors/cancel/reject, queue/save errors and timeout, duplicate lead, exhausted queue and the bounded session limit.

Prior countdown-window cancellation tests now hold actual save/queue promises or pause before settlement rather than assuming a grace period that no longer exists. Safety assertions on intent/connect counts and held calls remain.

## Verification

- `npm test`: **51 files, 805 tests passed**. Full log: `/tmp/crm-no-delay-tests.log`.
- `npm run lint`: passed with zero warnings (`eslint . --max-warnings 0`).
- `npm run typecheck`: passed (`tsc --noEmit --incremental false`).
- `git diff --check`: passed.
- No build/deploy/commit/provider/env work; no real or synthetic outbound networking to a calling provider.

## Remaining

Independent parent review and any authorized build/release/runtime acceptance. Production timing and the cause of the reported >30-second wait remain unverified. Local fake-time/HTTP/SDK tests establish source orchestration and cancellation behavior, not provider audio or real connection latency.
