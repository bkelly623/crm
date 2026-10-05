# Dialer pre-import check

## Result and scope

**PASS for source and synthetic mobile component readiness; not production calling or import acceptance.** Reviewed clean baseline `bce9782` (inline notes/tasks), following `cd415aa` (routine hangup continuation). No commit or deployment performed.

Added the existing lead's industry, location and website to the current caller card. Business/contact/phone were already rendered. The queue already returns these scalar fields; only the panel's type/render omitted them. The new labelled **Caller context** section uses plain text (including website), wraps long URLs, shows `Not provided` for missing values, and makes no additional request or navigation. No schema/API/controller/session/identity-lock changes.

## Candidate-field review (local aggregate only)

The literal `~/crm-lead-research125` path does not exist. Discovered the matching **125-row** dataset at `~/crm-lead-research/pa-service-callable-looking.json`. Did not dump candidate records or inspect production rows.

| Dataset field | Nonempty rows | Existing CRM field / display |
| --- | ---: | --- |
| business_name | 125 | businessName; already in caller card |
| phone | 125 | phone; already in caller card |
| category | 125 | industry; now visible inline if populated by import |
| city | 101 | location; now visible inline if populated by import |
| address | 108 | location can carry address/locality; no new schema |
| state_published | 100 | location; missing state must not be invented as published evidence |
| website | 94 | website; now visible inline, non-navigating plain text |
| source_urls | 125 | no dedicated source-URLs scalar; existing notes can retain provenance |
| tags | 125 | candidate source tags are not automatically CRM Tag memberships |

Every row reports `verification_status=unverified_candidate` and `outreach_consent=not_established`. Published OSM candidate data and phone formatting are not contact verification or consent. Dataset does not have an `existingLead` object; existing CRM fields were checked in `prisma/schema.prisma`. A published business name is not a named decision-maker: missing contactName must remain missing rather than invented.

The key caller gap was **industry/locality/website not shown despite existing queue data**; fixed here. Source URLs/provenance remain accessible through shared notes only if the separate importer puts them there. Inline notes replaces the shared field, so callers should preserve provenance rather than overwrite it inadvertently. Full source-tag display, CRM tag membership chips, email display, multiple contacts, alternate phones, authored notes history and inline task listing/completion are not added.

Import execution, mapping, identifier checks and production verification belong to the separate import worker and its `docs/PA_CANDIDATE_IMPORT_REPORT.md`; this check neither writes nor certifies that report/import.

## Executed RED → GREEN and regression commands

- Baseline `npm test`: **47 files / 760 tests passed** (`/tmp/crm-preimport-baseline.log`).
- Added `tests/dialer-context.test.tsx`; executed RED: **2 failed**, both because the accessible Caller context region was missing (`/tmp/crm-preimport-red.log`).
- Minimal panel render change; focused GREEN: **2 passed**. Tests assert populated/missing existing fields, preserved contact, no website navigation and no extra fetch.
- Final `npm test`: **48 files / 762 tests passed** (`/tmp/crm-preimport-tests.log`). Existing real panel/controller tests cover pause/edit/save, no auto-resume, countdown cancellation, selection holds, explicit next/start and unsafe terminal/error handling. Existing editor tests cover tasks, failures, timeouts, dirty drafts and StrictMode stale reads.
- `TZ=America/New_York npm test -- tests/inline-lead-work.test.tsx`: **11 passed** (`/tmp/crm-preimport-timezone.log`).
- `npm run lint`: **PASS**, zero warnings (`/tmp/crm-preimport-lint.log`).
- `npm run typecheck`: **PASS**, `--noEmit --incremental false` (`/tmp/crm-preimport-typecheck.log`).
- `git diff --check`: **PASS**.

No Next build was run; `.next`, preview3090, environment files, schema and dependencies were not changed.

## Synthetic browser evidence — actual components and CSS

Used the existing loopback-only Vite harness on `127.0.0.1:3092`, with actual dashboard layout, DialerPanel, InlineLeadWork, browser-call controller and sequential-session code. Auth/database aliases and fake SDK/transport stay under `tests/mobile-harness`; no application auth bypass. Expanded the existing synthetic fixture with in-memory note/task/disposition writes for synthetic lead IDs only, a disconnect counter and a deliberately long `example.invalid` website. Unknown application requests remain blocked. No real SDK, microphone, provider or production request occurred.

Repro script: `tests/mobile-harness/preimport-check.py`, run through `browser_exec` in a named isolated session after `new_tab('http://127.0.0.1:3092/tests/mobile-harness/index.html?screen=dialer&scenario=sequential')`. The script explicitly foregrounds the page rather than weakening the visibility gate. Native controls use synthetic value/input/change events; buttons use coordinate clicks.

| Emulated viewport | Page scrollWidth | Sticky Hang up hit-test | Control size | Reduced 500px height |
| --- | ---: | --- | --- | --- |
| 320 × 844 | 320 | PASS | 132 × 66 | PASS, no horizontal overflow; bottom148 |
| 390 × 844 | 390 | PASS | 167 × 66 | PASS, no horizontal overflow; bottom148 |
| 412 × 844 | 412 | PASS | 178 × 44 | PASS, no horizontal overflow; bottom126 |

All three full workflows passed:

1. Load/choose named list and caller ID, explicitly Start; exactly one synthetic intent.
2. Open Notes & follow-up during synthetic audio; calling pauses, **zero disconnects** from opening the editor.
3. Edit shared notes and a follow-up with device-local due time. While scrolled to due time, computed toolbar position is sticky; Hang up is visible and unobstructed. Long website causes no horizontal page overflow.
4. Save notes and create task through actual UI; in-memory payloads bind both writes to `synthetic-one`, and neither resumes calling.
5. Coordinate-click sticky Hang up; exactly one disconnect. Supply synthetic two-leg terminal proof, let actual polling settle, then wait six seconds: still only one intent.
6. Complete wrap-up, close editor, wait another six seconds: still one intent. Explicit manual **Resume → change disposition → Save & Next → Start session** issues the second intent for the next synthetic lead. End session remains workable.

Evidence files (all synthetic):
- `docs/preimport-evidence/check-{320,390,412}.json`: measured geometry, assertions and small synthetic write payloads.
- `docs/preimport-evidence/editor-{320,390,412}.png`: editor at full height.
- `docs/preimport-evidence/editor-short-{320,390,412}.png`: editor at reduced height.

Inspected the 320 × 500 screenshot: sticky Pause/End, Mute/Hang up remain at top; due-time and Add follow-up remain within the narrow page. The reduced height is a **geometry proxy, not real on-screen keyboard evidence**.

## Limits and remaining acceptance

- Browser transport, auth, DB, SDK and terminal proof are synthetic. This proves rendered interaction/layout and controller integration, not production persistence, RLS, real auth, provider callbacks, microphone permission or physical-phone audio.
- No real mobile OS keyboard, Safari, screen lock, cellular interruption, network transition or performance benchmark was exercised. No promise of physical-phone smoothness.
- Notes remain a replacement shared field with last-write-wins and no durable crash recovery. Task writes have no idempotency key; uncertain results require checking Follow-ups before retrying.
- Explicit manual Resume is review-only; it does not restart sequential calling. After a pause, users must finish/settle and wrap up, close saved/discarded drafts, advance the prior attempted lead, then explicitly Start session.
- No provider/production/database/network verification, live call, import, build, deployment, auth bypass or environment change was undertaken. All network activity for this slice was local loopback component serving; the application fetch boundary was synthetic.

## Files owned by this check

- Modified `src/components/dialer/dialer-panel.tsx` (existing caller context only).
- Added `tests/dialer-context.test.tsx`.
- Modified `tests/mobile-harness/session-fixture.ts` (synthetic-only fixture).
- Added `tests/mobile-harness/preimport-check.py`.
- Added this report and the nine evidence files above.
