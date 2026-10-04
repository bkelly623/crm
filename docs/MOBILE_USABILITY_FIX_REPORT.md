# Mobile usability fix report

> Historical UI-slice evidence: pilot-only copy and release-pending statements below describe the mobile verification snapshot. The subsequent user-authorized manual-calling change supersedes recipient restrictions and the two-minute limit; see `PRODUCTION_MANUAL_CALLING_REPORT.md` and its release readback.

## Release state

**UI changes verified locally; not committed, pushed or deployed by this worker.** Parent is coordinating the newly reported call failure with a separate backend diagnostic worker. No calling success is claimed. Codex and Claude CLI reviews failed with expired OAuth, then a fresh independent reviewer (`sa-0-12428a32`) passed the scoped mobile diff with no security or logic blockers. Combined release coordination remains required. No Vercel READY/alias claim applies to these uncommitted changes.

## Proven findings, not an assumed navigation bug

- Baseline is Git `756da38`. Inspected dashboard server pages and their real client components, including Sidebar, DialerPanel, BrowserCallControls, CallerIdSelector, LeadsBoard, new/import forms, LeadWorkspace, organizers/follow-ups, Settings and Users. Placeholder pages reuse ComingSoon.
- Real baseline admin Sidebar **already opens and closes** at 320, 390 and 412 CSS pixels with CDP mobile emulation (`mobile=true`). Actual toggle clicks and visible navigation were checked, not just class names. The same checks pass after changes. Desktop at 1280 retains the sidebar.
- Production `https://crm-sepia-xi.vercel.app/dashboard` redirected the unsigned-in browser to `/login`; its rendered viewport is `width=device-width, initial-scale=1`, with `innerWidth=390`. Root layout does not override Next's viewport default. There is no substantiated missing viewport/hydration fix here. Authenticated production nav, desktop-site mode and the user's in-app browser were not available for acceptance. User subsequently confirmed the mobile interface was present.
- Baseline mobile chrome occupied 137px. Dialer's desktop `p-8`, horizontal header, always-expanded optional queue filters, three stacked review buttons and repeated instructions buried Load Lead below the first screen. The header's Lead board link became cramped; desktop height was only 38px.
- At a reduced 320×320 viewport the New Lead form extended from y=-40 to y=360, with no scrolling modal container. Five inputs and two actions were 38px tall; inputs were 14px. This is a measured short-viewport defect, not a claim of physical keyboard testing.

## Changes (presentation only, except native disclosure)

- Sidebar: logo/role and the existing Open/Close navigation button share one compact mobile row. Existing aria state, Escape, route dismissal, role filtering and all sign-out logic retained; desktop remains unchanged.
- Dialer page: 16px phone padding, wrapping header, smaller phone heading and 44px Lead board link; concise load → number → mic → Call instructions.
- DialerPanel: optional queue filters use a native disclosure; Load/Next, Pause and Stop remain outside it in one row. Caller selection and browser controls remain visible; concise safety copy retains pilot-only authorization, recording-off and no fallback constraints. No queue/controller handlers or disabled/held predicates changed.
- BrowserCallControls and CallerIdSelector: shorter instructional copy only. Errors, status, microphone preparation, reconciliation, wrap-up, Hang up, Mute and DTMF controls unchanged.
- New Lead: scrollable, top-safe modal with auto margins when there is room; 44px fields/actions, 16px input text and safe-area bottom padding. Submission/data logic unchanged.
- Dashboard main adds safe-area bottom padding. No global overflow clipping or hidden error workaround.

## Browser evidence

`tests/mobile-harness/` is a **separate Vite test entry**, not a Next route. It imports actual server page render functions/client components and actual application Tailwind CSS. Auth/Prisma/navigation boundaries and fetch are synthetic **only in harness aliases**. Every screen is visibly labelled SYNTHETIC COMPONENT HARNESS. Unknown requests and writes return 403; the final harness also substitutes an adapter that rejects microphone/SDK access. No production accounts, auth bypass, provider calls, DB/env/schema changes or token issuance.

The baseline was exported with `git archive HEAD` into `/tmp/crm-mobile-baseline`, using the same harness on port 3093. Current harness uses loopback 3092. Tailwind's scan base is explicitly the respective project root so baseline classes removed from current source still compile correctly. Browser evidence was re-captured in isolated session `crm-mobile` after detecting a shared screenshot-path/session risk; use the named before/after evidence below.

| Viewport | Nav chrome before → after | Load Lead top before → after |
|---|---:|---:|
| 320×844 | 137 → 61px | 1469 → 395px |
| 390×844 | 137 → 61px | 1371 → 377px |
| 412×844 | 137 → 61px | 1291 → 357px |
| 1280×844 | persistent desktop sidebar | 770 → 240px |

`docs/mobile-evidence/before.json` and `after.json` each contain 32 measurements: Dialer, Leads, lead detail, Users, Settings, Tasks, Calls and Home at all four widths. Dialer/Leads/detail have no horizontal page overflow and no rendered controls below 44px height in the measured after states. The scan includes disabled controls and filters out nonvisible controls. This is a **height check**, not a full WCAG audit of target spacing, width, zoom or all dynamic states.

Representative screenshots:
- `mobile-evidence/before-dialer-390.png` / `after-dialer-390.png`
- `mobile-evidence/before-nav-open-390.png` / `after-nav-open-390.png`
- `mobile-evidence/before-leads-320.png` / `after-leads-320.png`
- `mobile-evidence/before-dialer-1280.png` / `after-dialer-1280.png`
- `mobile-evidence/before-new-lead-320-short.png` / `after-new-lead-320-short.png` / `after-new-lead-320-scrolled.png`
- `mobile-evidence/after-dialer-loaded-390.png`

`interaction-checks.json` records the short-height modal change: top now 16px, overflow auto, zero undersized fields/actions, five 16px inputs, Create reachable by scrolling within the modal. Native queue filter toggle works in browser; synthetic lead and number load/selection works while Call remains disabled without microphone readiness. Final harness microphone rejection was asserted visible outside disclosures; screenshot capture for that extra error state timed out, so no error screenshot is claimed.

## Tests, build and review

- New `tests/mobile-usability.test.tsx` observed RED (missing Queue filters disclosure) before implementation, then GREEN. Verifies closed optional filters, always-available Load Lead and visible queue errors. Existing call race/lock/wrap-up tests retained unchanged.
- Full `npm test`: **585 passed, 41 files** (log `/tmp/crm-mobile-tests-final.log`).
- `npm run lint`: passed, zero warnings allowed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- Production Next build passed using an isolated source copy at `/tmp/crm-mobile-build`, with shared existing node_modules and its own `.next` (`node node_modules/next/dist/bin/next build /tmp/crm-mobile-build`). Log `/tmp/crm-mobile-build.log`. No fake credentials. Existing generated Prisma client reused; schema unchanged.
- Preview 3090 remains on the original PID 3161588. Its `.next` was not rebuilt or overwritten, and its process was not stopped.
- Static scan of added source/harness lines found no hardcoded secret assignment, private keys, real AC/SK provider identifiers, shell injection or unsafe deserialization patterns. Synthetic number SID is explicitly generated in test code.
- Independent fresh-context review passed: no security or logic blockers in the seven mobile source diffs and harness/test. One fixture suggestion was a read-output redaction artifact: a direct on-disk check confirms the number is valid synthetic E.164 and there is no masked literal. Non-blocking suggestions: include short-viewport modal checks in the reusable script, expose active filters in the summary, and separately address existing New Lead error/focus semantics. The 585-test run and isolated build preceded the concurrent reservation-diagnostics changes; rerun the combined release tree. No release performed; commit/push and exact Vercel commit/READY/alias verification remain pending coordination.

## Limits and deferred findings

- This is synthetic component/browser CSS evidence, **not authenticated deployment acceptance or mobile audio certification**. No Call, SDK connection, provider request, microphone grant, real lead write or production test account was created. User's failed test call is a separate investigation.
- Reduced viewport verifies scroll reachability, not native keyboard/safe-area behavior on a physical phone. No claim of all in-app browser behavior.
- Inspected Users/Settings retain preexisting sub-44px controls, and Users' desktop table can clip within its container on phones. Left outside this focused nav/Dialer/Leads correction; raw measurements disclose them. No comprehensive dashboard polish claim.
- Error/empty/held lifecycle correctness is principally covered by existing automated tests. No authenticated data, permissions, persistence or deployment behavior inferred from fixtures.
- Reproduction: `node node_modules/vite/bin/vite.js --config tests/mobile-harness/vite.config.mjs`; open `/tests/mobile-harness/index.html?screen=dialer` (or leads/detail/home/users/settings/tasks/calls). `check.py` runs through browser_exec helper globals in an isolated session, with the archived baseline server running on 3093. It asserts actual toggle visibility/clicks and records geometry/screenshots.

Rollback: revert only the seven presentation source files plus test/evidence/report. No data or configuration rollback required.
