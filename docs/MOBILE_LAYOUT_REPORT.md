# First mobile layout slice

## Changed
- `src/components/layout/sidebar.tsx`: one shared role-based navigation panel, collapsed by default below Tailwind `lg`; labelled disclosure button with `aria-expanded` / `aria-controls`; closes on link selection (including the current route), pathname change and Escape. Escape returns focus to the toggle. Links expose `aria-current`; navigation links, toggle and sign-out have 44px minimum-height utilities and visible keyboard focus styles. Desktop retains the persistent sticky sidebar and scrollable navigation. Repeated destinations in supplied navigation are displayed once, fixing the existing duplicate Leads link/key for admins and sales managers without changing role policy.
- `src/app/dashboard/layout.tsx`: phone-first column layout, desktop row layout, dynamic viewport minimum height, and shrinkable content (`min-w-0`). No unprefixed desktop sidebar width is reserved on phones. Content remains an unconditional sibling of navigation, suitable for later persistent workspace work.
- `tests/mobile-layout.test.tsx`: 14 offline component tests covering disclosure state, dismissal, focus restoration, every catalog role's destinations, current-page semantics, touch-size utilities, responsive shell classes and preservation of mounted content/draft value while toggling navigation.
- `docs/MOBILE_LAYOUT_REPORT.md`: this report.

## TDD and verification
Observed RED before implementation for missing toggle, close-on-navigation/path change, Escape dismissal, duplicate manager/admin destinations, active-page semantics, and phone shell layout. Each slice was followed by a passing targeted run. Existing role variants that already worked were retained as regression cases.

Latest verification after formatting refactor:
- `npm test`: **200 passed across 9 files**, including all **14 mobile-layout tests**. This shared working tree includes the other worker's webhook tests; earlier full run passed 186 before that worker added more cases.
- `npm run lint`: passed, zero warnings allowed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- Production build intentionally not run; parent owns that verification after merge.

The tests use jsdom and mocked auth/router/database boundaries; they do not claim CSS layout measurement or live authenticated integration. No test requests reach external services.

## Runtime / browser gate: BLOCKED
Started local Next development server on `127.0.0.1:3088` without adding credentials or environment files. `GET /dashboard` returned **HTTP 500** with `Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL from Supabase↔Vercel integration)`. Browser attempt at **390 × 844** captured a blank app viewport with Next's development indicator, not a rendered dashboard. The server was stopped afterward.

**No visual/mobile verification is claimed.** Actual phone/tablet/desktop layout, overflow, keyboard behavior and authenticated navigation still require a configured authorized runtime. The attempted screenshot is not acceptance evidence and was not added as a repository artifact. No fake login, environment bypass or mock production route was created.

## Deferred / unchanged
- `UsersManager` receives only `initialUsers`; no acting-user role prop is available. Manager invitation options were left untouched because aligning them requires changing the unowned caller or introducing broader auth plumbing. Server authorization policy remains unchanged.
- Existing dialer, call-disabled/recording-disabled behavior, routes, inbound text-back, authored notes and drafts are untouched. Preserving an input while toggling navigation is tested; cross-route draft autosave and persistent call state are **not** implemented or claimed.
- This is the shell slice, not completion of the BUILD_PLAN P2 gate or a redesign of each page.
- No dependencies, live integrations, database changes, migrations, environment files, commits or deployments.

Rollback: revert only the two source paths and remove this slice's test/report; no data rollback is needed.
