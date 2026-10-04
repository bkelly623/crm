# Preview redirect repair

## Outcome

`src/lib/supabase/middleware.ts` now creates login/dashboard redirects from a validated `NEXT_PUBLIC_APP_URL` origin, not `request.nextUrl`, `Host`, `Forwarded`, or `X-Forwarded-*`. Existing authentication still calls Supabase `getUser()`; there is no auth bypass or change to route authorization.

- HTTPS configured origins are accepted, with at most a single trailing slash.
- HTTP is accepted only with `NODE_ENV=development` and a loopback hostname (`localhost`, `127.0.0.1`, or `[::1]`). Production-mode local previews must use the approved HTTPS tunnel origin.
- Credentials, paths (including dot-segment paths), query/fragment delimiters, whitespace, backslashes, invalid URLs and parser-repaired URL syntax are rejected.
- Absent/invalid configuration uses a fixed relative `Location: /login` or `/dashboard`, status 307. This keeps browser same-origin navigation without reflecting any request authority. The original unsafe absolute internal-host fallback is intentionally not preserved.
- Redirects never propagate incoming query parameters or fragments (including auth codes/tokens, email or `next`).
- Refreshed/deleted auth cookies and their attributes are copied to redirects. Existing pass-through cookie handling remains intact.

## TDD and verification

Tests use real `NextRequest`/`NextResponse` and the real middleware; only the Supabase client boundary is mocked to prevent provider requests.

Observed RED → GREEN slices:
1. Unauthenticated dashboard behind the proxy: failed with `https://localhost:3090/login`, then passed with the configured preview origin.
2. Authenticated `/login`: failed with internal-host dashboard URL, then passed with the configured preview origin.
3. Absent/invalid configuration: 20 failing cases, then all passed with safe relative redirects.
4. Development loopback HTTP: 3 failing cases, then passed.
5. Redirect cookie refresh/deletion: 2 failing cases (missing cookies), then passed.

Additional regression coverage checks sensitive query removal, normal logged-in/out pass-through paths, trailing slash handling and non-loopback development HTTP rejection.

Executed from `/home/precision_focused_solutions`:

- `npm --prefix crm test -- tests/session-redirects.test.ts`: **39 passed**.
- `npm --prefix crm test -- --reporter=dot`: **465 passed, 8 failed; 27 test files passed, 3 failed (473 tests total)** at the time of execution. Failures are in the concurrently edited calling worker's scope: `tests/token.test.ts` (5), `tests/voice.test.ts` (2), `tests/twilio-webhooks.test.ts` (1). Token requests now returned 403 and voice requests returned Hangup where older tests expected issuance/dialing. No calling files were changed by this repair.
- `npm --prefix crm run lint`: **passed**, no warnings.
- `npm --prefix crm run typecheck`: **blocked by 5 Prisma typing errors outside this repair**, in `src/lib/twilio/call-intents.ts` and `tests/local-db/call-intents.integration.ts`: generated client missing `callIntent` / `callIntentLease`. No redirect-file errors reported. Coordinate with the schema worker; no dependency/client generation performed here.

## Required preview rebuild (parent-owned; NOT performed)

The currently running production-mode preview still serves the old build. Source-level tests are not a claim that the live tunnel is repaired.

1. Parent must set `NEXT_PUBLIC_APP_URL=https://ending-personals-rooms-participating.trycloudflare.com` in the approved local build environment **before building**. `NEXT_PUBLIC_*` values are embedded by Next at build time; a server restart alone does not update the old middleware bundle. Verify the temporary tunnel still owns that origin; use its current approved origin if it changed.
2. Coordinate all workers and finish their source/typecheck gates. Stop the current loopback preview (`proc_5f1481812870` in the parent's process session) before overwriting its `.next` directory. Do not run competing Next builds.
3. From `/home/precision_focused_solutions`, run `npm --prefix crm run build` (the project script runs `prisma generate && next build`; this is not a migration), then restart using `npm --prefix crm run start -- --hostname 127.0.0.1 --port 3090` with the same approved local environment.
4. Verify the public `/login` returns 200, unauthenticated `/dashboard` returns 307 with the public canonical `/login` Location and no sensitive query, and `/api/leads` remains 401. Authenticated dashboard/login behavior requires a normal authorized login; do not bypass authentication. Recheck mobile navigation through the tunnel.

No environment edits, production build, server restart, DB/provider calls, deployment, dependency changes or commit were performed by this repair. Only the assigned middleware, new redirect test file, and this report were changed.
