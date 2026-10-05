# Dialer inline notes and follow-up workflow

## Delivered source scope

- A **Notes & follow-up** button is available on the current lead during an active sequential call, without navigating away. Opening it synchronously pauses sequential orchestration and invalidates queue continuations; it does not hang up, wrap up, reconcile, or release a call lease.
- The editor reads current notes using the existing authenticated/scoped `GET /api/leads/:id`. It saves only `{ notes }` through the existing scoped `PATCH /api/leads/:id`. Existing notes must load successfully before editing; failed/mismatched reads cannot turn an unread shared field into an empty overwrite.
- Notes are explicitly labelled **Shared lead notes**: one replacement field shared by authorized users, **not** an authored/timestamped notes timeline. No extra note database/model/API was added. Existing concurrent-editor last-write-wins behavior remains; there is no optimistic version check in that API.
- Follow-up creation uses existing `followUpSchema` and `POST /api/tasks`, which assigns ownership to the authenticated actor and scopes the lead again at write time. The device-local `datetime-local` → `new Date(value).toISOString()` conversion matches the existing lead-detail form. The UI explains device-local entry, UTC display on Follow-ups, and actor ownership. No profile/recipient timezone is invented.
- While the editor is open, list/caller/filter changes, manual next, calls, and Start session remain blocked even after server settlement or manual wrap-up. Drafts or pending writes prevent closing; only successful saves or explicit per-draft discard unlock Close. Save never resumes calling. Pause/End session do not clear drafts.
- Explicit continuation: finish the call, wait for existing authoritative settlement, complete wrap-up, save/discard and close the editor, choose **Next Lead**, then **Start session**. The prior attempted lead is not silently redialed. To preserve an edited disposition instead of skipping, use existing **Resume** (manual review only), then **Save & Next**, then **Start session**.
- Existing mute, Hang up, keypad, status/reconciliation, and recovery controls remain mounted. While editing with active audio, additional compact mute/hang-up controls sit in the sticky session toolbar; they delegate to the same unchanged controller.
- Notes and task saves are bounded to 12 seconds, including task response decoding; late results do not clear drafts, retry automatically, or restart calling. Errors retain input. An uncertain task result warns to check Follow-ups before retrying, because the existing task API is not idempotent.
- Internal anchor navigation is blocked while dirty/saving, and `beforeunload` requests the browser's exit warning. No sensitive drafts/tokens are stored in browser persistent storage. Drafts are retained through this in-page workflow, **not durably autosaved across browser crashes, forced unload, history/programmatic navigation, sign-out, or device termination**. Browser warnings are best effort; durable draft recovery remains future work.

## Safety and race coverage

The inline form is keyed to the selected lead. Request IDs/paths are captured from that held lead; selection remains frozen until the form closes. An abandoned or aborted lead read cannot replace another lead's notes, including React StrictMode's setup/cleanup replay. Opening during the countdown cancels it synchronously. Opening is disabled during a queue/disposition operation already in flight, avoiding detaching its displayed lead.

Unchanged: browser calling controller, sequential session state machine, server API authorization/scope, intent issuance, terminal two-leg proof, authoritative leases, sticky auto-safety flags, offline/hidden behavior, recordings, exclusions, provider integration, schema, environment, and existing detail workspace.

## Executed verification

Each added production slice followed an executed RED → GREEN cycle:

1. Active-call inline notes: missing button failed, then held-lead scoped save and explicit continuation passed.
2. Follow-up creation: missing fields failed, then actor-scoped API payload, device-time conversion, pending draft retention and explicit close passed.
3. Navigation guard: uncancelled exit failed, then internal link/exit protection passed.
4. Sticky compact controls: missing in-editor toolbar actions failed, then controls remained available.
5. Save timeout: both pending-write cases lacked an error and failed, then retained-draft bounded timeout behavior passed.
6. StrictMode stale read: an aborted earlier response replaced an edited draft and failed, then abort-aware read guards passed.

Additional regressions exercise load denials (401/403/404/500), task validation/denial without retry, explicit discard, late old-lead reads, countdown cancellation, selection holds, pending note writes, task draft retention, and actual explicit Next Lead → Start session continuation through the real panel/controller with mocked SDK/network.

Final commands/results:

- `npm test`: **47 files passed, 760 tests passed** (final full run; output `/tmp/crm-inline-full-tests.log`).
- `TZ=America/New_York npm test -- tests/inline-lead-work.test.tsx`: **11 passed**, exercising the same local-time conversion outside UTC.
- `npm run lint`: **PASS**, zero warnings.
- `npm run typecheck`: **PASS** (`--noEmit --incremental false`).
- `git diff --check`: **PASS**.

These are source/jsdom and mocked-boundary tests, not authenticated production persistence, mobile keyboard geometry, real audio, or live call acceptance. No build was run; the existing `.next`/port 3090 preview was not rebuilt or replaced. No deployment, commit, provider request, live call, database write, schema change, environment change, install, or paid service was performed.

## Files owned by this slice

- `src/components/dialer/dialer-panel.tsx`
- `src/components/dialer/inline-lead-work.tsx` (new)
- `tests/sequential-dialer-ui.test.tsx`
- `tests/inline-lead-work.test.tsx` (new)
- `docs/DIALER_INLINE_WORKFLOW_REPORT.md` (new)

The initial worktree was clean. Other workers' later changes, if any, are not claimed or modified by this slice.

## Remaining contacts/product gaps

- The current master `Lead` has one `contactName`, phone and email; there is no separate `Contact` model or multiple-person contact directory per business. Inline editing does not implement contact CRUD, multi-contact calling, alternate phone selection, contact roles, or contact history.
- The existing lead-detail workspace still owns broader lead/contact-field editing and follow-up list/completion. This inline slice creates follow-ups but does not list, reschedule, assign to another actor, or complete them during a call.
- Shared notes are not an authored append-only history, activity timeline, transcript, or promise tracker. Concurrent editing/version-conflict protection and durable draft recovery are not delivered.
- No lead sourcing, enrichment, scraping, CSV-intake improvements, deduplication/merge, bulk contacts, or hundreds-per-day compliance/spend controls were added. Current APIs and eligible named lists remain prerequisites, not evidence of verified recipient contact data or consent.
- The compact toolbar has component/accessibility coverage but still needs real phone viewport/keyboard acceptance. Mobile OS interruptions and browser history/forced unload cannot be certified by jsdom.
