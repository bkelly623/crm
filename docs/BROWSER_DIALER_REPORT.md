# Browser Voice dialer implementation report

## Result and verification

Implemented the actual outgoing Twilio browser Voice SDK client against `DIALER_CLIENT_CONTRACT.md`; not a simulated call button. **Calling remains unavailable until the server is configured/authorized and the user explicitly completes microphone preflight.** No server flag, credentials, environment, database, provider routing, inbound text-back handler or deployment was changed by this worker.

Final local verification:

- `CI=1 npm test`: **580 tests passed in 38 files**, including the unchanged backend/inbound suites, existing review/catalog regressions and 29 dedicated browser-client/adapter/UI tests. Final run began 02:17:54 UTC and exited 0.
- `CI=1 npm run lint`: passed, zero warnings.
- `CI=1 npm run typecheck`: passed (`tsc --noEmit --incremental false`).
- `git diff --check`: passed.
- `npm ls @twilio/voice-sdk --depth=0`: official **2.18.5** installed and pinned exactly.
- Disk checked before installation: 6.5 GB available. Targeted `npm install --save-exact @twilio/voice-sdk --ignore-scripts --no-audit --no-fund` added seven packages. No unrelated upgrade requested; install scripts did not regenerate Prisma.
- **No Next build**: explicitly prohibited while the existing production `.next` preview is serving. These source changes are not claimed to be visible in that existing built preview.
- No real provider requests/calls, test-recipient contact, DB commands, deployment or commit. No physical-phone or real-browser audio certification.

## Implemented behavior

- Browser-only dynamic import of the installed SDK; SSR/review-only sessions never construct a Device. Outgoing-only Device, no inbound registration or inbound-routing changes.
- Explicit **Prepare browser calling** requests secure-context microphone permission, stops the preflight stream, retrieves a same-origin authenticated/no-store token, then creates the Device. Token refresh updates the same Device; it never reconnects or calls. Tokens stay in memory, not local/session storage or logs. Missing permission, unsupported browsers, token/auth/config errors including existing 503 remain safely unavailable.
- Mount-time authenticated `GET /api/dialer/intents` recovers the user's server hold. Unknown/error state locks review mutations as well as calling. Recovery never attaches audio, requests microphone or dials.
- Manual **Call** synchronously holds queue/list/caller/lead controls, POSTs only `{leadId,callerIdSid}`, then connects exactly once with `{params:{IntentId}}`. No raw destination/caller number, custom user identifiers, recording parameters, `tel:` or phone-app fallback.
- Server child lifecycle is authoritative. SDK `accept` is only parent connection, never recipient answer. UI distinguishes connecting, recipient ringing, recipient connected, reconciling and manual wrap-up. Only consistent server `canStartNewIntent: true`, released lease and terminal/expired/canceled state permit the wrap-up control; explicit **Complete wrap-up**, then explicit Next/Call, are required.
- Thumb-sized mute/unmute, Hang up and twelve-key DTMF controls; Hang up also cancels a pending SDK connect locally. Recoverable SDK errors retain Hang up rather than losing the live call handle. Local teardown never clears a server lease.
- Requests have a 12-second deadline and AbortController. Status polling is bounded to eight attempts with exponential backoff capped at 15 seconds. Exhaustion is visible and remains held; manual **Check server status** performs the contract's read-only-provider reconciliation POST with no body. An uncertain/409/error result never unlocks. No automatic call retry, lead advance or redial.
- Offline, pagehide, visibility loss, SDK reconnecting/error and disconnect retain a hold. Returning to the tab does not automatically dial. Late SDK connect results are disconnected after cancellation/disposal; generation and identity guards reject stale call events. Unmount aborts outstanding HTTP, cancels poll timers, disconnects audio and destroys the Device, without claiming provider termination.
- A lost issuance response is treated conservatively: an empty subsequent GET cannot prove an in-flight POST never committed. The session remains held until an identified intent has server terminal proof; no speculative client expiry/force-unlock.
- Review progress, exclusions/session limit, dispositions, pause/stop, manual caller preference and existing queue behavior remain intact outside a call hold. A late organizer-catalog invalidation cannot clear the lead after Call starts. The server page retains review-first framing with truthful pilot-call copy.

## Test-first evidence and test boundaries

Observed RED -> GREEN iterations covered initial recovery, explicit mic/token/intent/SDK connection, persisted terminal/manual-wrap-up requirements, failed recovery, local controls vs parent events, late connection/disposal, token refresh, bounded polling/reconciliation, ambiguous issuance, tab/network interruption, pending-connect Hang up, HTTP timeout, inconsistent terminal proof, transport abort on unmount, recoverable SDK error/reconnecting controls, mobile UI integration/holds, late catalog response and server-page copy.

Permission denial and stale post-wrap events were additional GREEN characterization of guards introduced in earlier slices, not falsely claimed as new RED evidence. The installed-SDK construction test initially exposed missing jsdom `mediaDevices.enumerateDevices`; its browser boundary fixture was corrected, not the production SDK bypassed.

Dedicated tests:

- `tests/browser-dialer.test.ts`: real state machine with injected Device/HTTP/timer boundaries; 22 tests.
- `tests/browser-dialer-ui.test.tsx`: real panel/hook/state machine against mocked browser Device and HTTP transport; three tests.
- `tests/voice-sdk-adapter.test.ts`: microphone lifecycle, secure-context denial, dynamic import/support gate and real installed Device construction/destruction with mocked browser media APIs; four tests. No provider connection occurs.
- Existing catalog/review suites use `tests/support/render-review-dialer.tsx` to answer only the new mount recovery GET with an empty fixture and await it; their existing route transports, fetch-count assertions and review regressions otherwise remain exercised. Active/error recovery has separate dedicated coverage, not a production bypass.

These tests prove client behavior, not Twilio media delivery, carrier identity, Android audio focus, Supabase runtime authentication or DB persistence. Backend PostgreSQL evidence belongs to the backend/parent report and was not run or claimed by this worker.

## Owned changes

Created:

- `src/components/dialer/browser-dialer.ts`
- `src/components/dialer/voice-sdk-adapter.ts`
- `src/components/dialer/use-browser-dialer.ts`
- `src/components/dialer/browser-call-controls.tsx`
- The three dedicated test files and review-render helper listed above.
- `docs/BROWSER_DIALER_REPORT.md`

Modified only relevant portions of the existing dirty workspace:

- `src/components/dialer/dialer-panel.tsx`
- `src/components/dialer/caller-id-selector.tsx`
- `src/app/dashboard/dialer/page.tsx` (subtitle only)
- `package.json` / `package-lock.json` (official browser SDK addition)
- Existing `dialer`, `caller-id-selector`, `caller-id-integration`, `list-queue-ui`, `queue-review-integration`, and `list-queue-pages` tests for recovery-aware rendering/truthful page copy.

Pre-existing changes were preserved. Do not roll back entire files against HEAD: many were already dirty before this slice.

## Remaining release gates / operational limits

1. Parent/operator must provision valid server-only Twilio account/API/TwiML credentials, approved test-recipient allowlist and explicit activation approval. Configure the dedicated outbound app and signed lifecycle callback URLs exactly as the backend contract requires. Do not repoint existing inbound voice/text-back routing.
2. Run a fresh coordinated build and serve the updated source only after stopping the existing preview safely; this task intentionally did not touch its `.next` output.
3. Authorized HTTPS Android Chrome physical-phone test: microphone allow/deny, speaker/headset and volume, correct owned caller ID, real two-way audio, DTMF, busy/no-answer, Hang up, token longevity, Wi-Fi/cellular transition, screen lock, tab/app switch, incoming cellular interruption, reload recovery and manual wrap-up/Next. No claims of reliable background calling; a recovered page cannot reattach audio to the old call.
4. During an active/uncertain server lease there is no client force-unlock. Missing/ambiguous provider child state requires operator investigation, not another call or lease deletion. Status checks stop after the bounded window and require explicit further checks on longer calls.
5. Recording stays off. Provider/physical-phone acceptance, eligibility/spend controls and the backend's production/schema/backup approvals remain separate gates. This is a source-tested controlled-pilot client, not a declaration that live outreach is enabled or production-ready.
