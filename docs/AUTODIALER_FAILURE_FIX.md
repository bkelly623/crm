# Autodialer recipient-failure progression

## Authorization and scope

New explicit user authorization supersedes the historical blanket stop-on-failed-child policy. Only a safely settled recipient outcome may continue an already opted-in sequential session. No schema/environment changes, provider requests, live calls, build, deployment, or commit were made by this worker. The independent callsToday worker owns dashboard statistics; this change does not edit their files. Existing `.next` and port 3090 preview were left untouched.

## Root evidence (baseline 14af7f4)

1. `BrowserDialer.apply` classified **either** failed leg as an error. `set(error)` permanently revoked `autoAdvanceSafe`; `SequentialSession.observe` stopped the session. A completed browser parent and failed recipient child therefore required manual wrap-up even with authoritative release. A failed child arriving while its parent was still active already poisoned future continuation.
2. After manual settlement, `wrapUp` retained the old display error. A prepared controller could cause a newly started session to stop immediately when it next published state. Separately, `sessionNext(false)` returned the displayed attempted lead, and the mounted session's attempted set rejected it. Start looked enabled but could not move forward.
3. `/api/dialer/next-lead` used immutable `id ASC` ordering with only browser-provided exclusions, eligibility, scope, and organizer predicates. The unchanged `no_contact` disposition was intentional; the browser exclusions disappeared on refresh. The earliest failed candidate was consequently selected again.
4. Existing signed child lifecycle persistence already writes a `Call` row with failed/busy/no_answer/canceled status and attempt `startedAt`. No new storage is necessary. Parent and child lifecycle, leases, and authorization remain unchanged.

## Reproduction and fix

The actual rendered `DialerPanel`, real `BrowserDialer`, and real `SequentialSession` are exercised using fake timers and injected HTTP/SDK boundaries (no provider networking).

- RED: the new automatic-polling failed-recipient regression could not find the next-call countdown; busy/no-answer controls passed. The fixture observes child failure while the parent is active, then supplies completed parent, terminal child, `locked=false`, and `canStartNewIntent=true`.
- GREEN: recipient `failed`, `busy`, or `no-answer` now waits for authoritative two-leg settlement and the existing cancellable five-second countdown, then issues exactly one intent for a **different** lead without manual wrap-up/restart. A child failure alone is no longer a controller error. Nothing restores a previously revoked safety flag.
- RED: both provider-parent-failure and SDK-error explicit restart regressions issued only one connection after manual wrap-up and Start.
- GREEN: acknowledged wrap-up clears stale display errors (not revoked safety); explicit Start skips the mounted session's attempted current lead through the existing save/exclusion/queue path. Device failures still require explicit re-preparation. The bounded attempted set is never evicted.
- RED: route tests without browser exclusions returned failed candidate `a` instead of distinct `b`, for all four persisted unsuccessful outcomes.
- GREEN: the queue applies a relational history predicate, so refresh/new sessions cannot immediately return a recently unsuccessful candidate.

## Retry policy

For automatic queue selection, exclude leads with any persisted `Call.status` in `failed`, `busy`, `no_answer`, or `canceled` whose `startedAt` is within the past **24 hours** (inclusive lower boundary). The predicate spans callers and named lists; it is evaluated by the server and does not depend on browser storage. After 24 hours the lead becomes eligible again, subject to the existing scope, DNC/status, list, phone, and browser-exclusion predicates. Selection still uses deterministic `id ASC` ordering among eligible leads. No automatic same-lead retry is introduced.

This is a bounded queue cooldown, not an unbounded exclusion, a global intent-level retry limit, or a legal/compliance/spam-label guarantee. A deliberately initiated manual call remains governed by existing server intent authorization, not this queue preference. Ordinary lead-list/detail review remains available. Scheduled-callback dispositions and follow-up tasks are not rewritten or deleted; callbacks with no recent unsuccessful attempt remain queue eligible. A recently failed scheduled callback is also held out of the automatic queue for this cooldown and can be reviewed deliberately through ordinary lead/task views. No invented call disposition is saved.

## Fail-closed boundaries

- BOTH legs must be terminal and the server must prove lease release before auto-next.
- Missing/nonterminal parent or child, locked lease, false release permission, wrong intent identity, transport failure, ambiguous issuance, and polling exhaustion cannot advance.
- Parent failure, canceled parent/child/intent, SDK cancel/reject/error/reconnecting, microphone/token/device outage remain sticky stops. Successful later reconciliation never automatically re-arms them.
- Pause/End/hidden/offline/unmount still cancel future work. End still tears down local audio; neither action releases a lease.
- Explicit manual wrap-up/recovery remains available for genuinely unsafe/recovered calls. Start is not a bypass for uncertain leases.
- DNC, actor/lead scope, signed associations, caller ownership, one-call leases, recording policy, and provider reconciliation are untouched.

## Verification and limits

- Targeted final run: **157 passed / 5 files** (controller, actual panel/session, queue API, and real queue-handler integration).
- `npm run lint` and `npm run typecheck`: passed.
- Initial full-suite run: **781 passed, 3 failed / 51 files**; the failures were the concurrently authored stats worker's RED tests. Latest integrated rerun: **797 passed, 1 failed / 51 files**. The remaining failure is `tests/list-queue-pages.test.tsx` → `getCallsToday` (`prisma.call.count` missing from that preexisting page-test mock), introduced by the concurrent dashboard statistics page integration. The stats worker/parent must update that mock and rerun before release. Dialer/queue tests are green; statistics files were not edited here.
- Regression coverage includes explicit restart, two-leg incomplete evidence, wrong intent ID, SDK errors after recipient failure, cancel/reject, existing token/mic/transport/visibility/Stop races, bounded exclusions, manual-review availability, scheduled-callback eligibility, cross-rep cooldown, refresh-like repeated requests, and cooldown expiry.
- These are offline tests with synthetic persistence rows and injected transport/SDK. They do not certify real PostgreSQL query performance, authenticated production behavior, physical-phone audio, or the imported list's contact validity. No calls were made to the unverified imported list `cmuvuorlo00005svpd96iafz0`.
