# P0.2 — bounded local auth hardening

Observed 2026-10-03 UTC in `/home/precision_focused_solutions/crm`.

**Outcome: four bounded security fixes implemented with observed RED → GREEN tests. Full suite: 114 passing tests in 7 files; lint, standalone typecheck and production build pass. This is not complete row authorization, a clean security audit, or permission to enable live calling.**

## Scope and role authority

Read `docs/BASELINE_REPORT.md`, `docs/SAFETY_SLICE_REPORT.md`, the supplied workspace business-context rule, repository `.cursor/rules/vercel-env-automation.mdc`, existing tests/configuration, Prisma schema and relevant source before changing production code. The environment-sync rule was not executed: live configuration is explicitly out of scope.

### Profile bootstrap

`getCurrentProfile` still verifies the Supabase user through `auth.getUser`, returns null for unauthenticated users, and upserts a legitimate user's profile. A newly created profile always receives **sales_rep**. User-editable `user_metadata.role` is no longer read or cast into an authorization role. Display-name metadata remains display-only.

The existing invitation/create-user route writes its authorized role directly to the server-owned Prisma `Profile` row after Supabase user creation. Bootstrap's `update: {}` preserves that assignment when the profile already exists. Source search found no separate trusted invitation-assignment record or verified `app_metadata` role protocol to consult when the profile is missing; none was invented. If Auth creation succeeds but the profile write fails, subsequent bootstrap defaults to sales_rep rather than recovering privileged metadata. Cross-service atomicity/reconciliation remains future work.

**No existing users were migrated, downgraded or inspected.** Profiles previously created with unsafe roles retain them until a separately authorized audit/remediation. The existing Profile assignment is the application's authority, not proof that every historical assignment was legitimate. First-admin provisioning/recovery also requires a separately reviewed trusted administrative process; users cannot bootstrap an admin via metadata.

### Conservative role-grant policy

| Actor | Create/invite user (`POST /api/users`) | Change existing profile role (`PATCH /api/users`) |
| --- | --- | --- |
| admin | Any schema-valid role | Any schema-valid role; existing self-demotion guard retained |
| sales_manager | **sales_rep only** | Denied |
| Any other role, unknown role, or unauthenticated | Denied | Denied |

Valid roles are `admin`, `sales_manager`, `hiring_manager`, `sales_rep`, `closer`, `project_manager`, `hybrid`, `client`. No relative ordering is inferred from job titles: managers cannot grant even closer, hybrid, or client. Policy is documented next to the server check. Denials precede admin-client construction, Auth creation and target-profile writes. Invalid role/schema input in valid JSON returns 400. Invitations no longer duplicate their role into editable Auth metadata; the authorized Profile write remains. Existing GET/list permissions are unchanged.

### Task PATCH

Require a CUID string ID (matching `Task.id @default(cuid())`) and one of Prisma's `TaskStatus` values: `open`, `completed`, `canceled`. Missing, null, empty, whitespace, wrong-type, object/filter-shaped or invalid IDs/statuses are rejected with 400 before any task write. Malformed JSON also returns 400. No trimming, coercion or identifier repair occurs.

Retain `updateMany` with **both validated ID and current profile userId**. ID is the primary key, so this targets at most one owned task; an absent ID cannot remove the filter. Client-provided userId is ignored. Zero matches still return `{ updated: 0 }` without a broader retry; all valid statuses return the existing response contract. This is targeted input validation and preservation of an existing owner filter, not a new CRM-wide row policy.

### GHL webhook

POST returns 503 when `GHL_WEBHOOK_SECRET` is unset, empty or whitespace-only, before parsing payload or loading the integration adapter. When configured, absent/mismatched header returns 401; exact match retains the existing adapter path. Whitespace checking only detects missing configuration; the configured credential is not normalized for comparison. GET health check is unchanged. No payload schema, replay prevention, rate limit or provider-signature protocol was added.

## Actual test-first evidence

Each behavior boundary was tested before its production edit and followed by a passing complete suite before proceeding. External auth/database/integration operations are mocked; real helper/route logic executes. Fixtures are synthetic and the existing setup rejects unexpected fetches. These are offline unit/route/component tests, not live database or HTTP middleware evidence.

| RED command | Observed failure before implementation | Subsequent GREEN |
| --- | --- | --- |
| `CI=1 npm test -- tests/auth.test.ts` | 8 failed, 3 passed: editable roles persisted instead of sales_rep | Complete suite 39 passed |
| `CI=1 npm test -- tests/users.test.ts` | 7 failed, 33 passed: manager grants returned 201 instead of 403 | Complete suite 79 passed |
| Same users command after metadata/invalid-role tests | 3 failed, 40 passed: role still written to editable metadata; invalid roles threw Zod errors rather than 400 responses | Complete suite 82 passed |
| `CI=1 npm test -- tests/tasks.test.ts` | 20 failed, 5 passed: invalid inputs reached updates/returned 200; null and malformed JSON threw instead of returning 400 | Complete suite 107 passed |
| `CI=1 npm test -- tests/ghl.test.ts` | 3 failed, 4 passed: missing/empty configuration returned 200; whitespace returned 401 instead of configuration denial | Complete suite 114 passed |

Cases already passing in RED runs characterize preserved behavior: authenticated defaults, existing-profile preservation, unauthenticated denial, admin valid-role grants, manager sales_rep invitations, non-admin update denial, self-demotion guard, owner-scoped valid task updates, and configured GHL secret checks. They are not claimed as newly fixed regressions.

Final suite inventory: auth 11, users 43, tasks 25, GHL 7, existing token 12, existing voice 12, existing dialer 4. Existing 28 safety tests were not edited.

## Verification

The following chained command completed with exit **0**:

```sh
CI=1 npm test &&
CI=1 npm run lint </dev/null &&
CI=1 npm run typecheck &&
CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build &&
git diff --check
```

- Vitest 3.2.7: **114/114 passing, 7/7 files**.
- ESLint zero-warning gate: no diagnostics, no prompts.
- TypeScript standalone check: no diagnostics, includes tests.
- Build: local Prisma Client 6.19.3 generation; Next.js 15.5.27 compiled successfully, checked lint/types, generated **30/30 pages**, completed traces. No build warnings in this run. Client generation is not a database operation or connectivity check.
- `git diff --check`: passed. Reviewed scoped production diff and final worktree status.
- Reused installed dependencies and existing build directory. No dependency changes, package installation or duplicate artifacts. Disk observation: 7.2G available, 93% used.

## Changed paths in this slice only

Modified:
- `src/lib/auth.ts`
- `src/app/api/users/route.ts`
- `src/app/api/tasks/route.ts`
- `src/app/api/webhooks/ghl/route.ts`

Created:
- `tests/auth.test.ts`
- `tests/users.test.ts`
- `tests/tasks.test.ts`
- `tests/ghl.test.ts`
- `docs/AUTH_HARDENING_REPORT.md`

Pre-existing tracked edits, test harness, lockfile, planning/report/requirements/sample files were preserved. No schema changes, commits, pushes, deployments, database queries/migrations, live API requests, calls, SMS or real credentials were used. No production state exists to roll back from this task; any local rollback must isolate the paths above and preserve prior safety work.

## Residual blockers and limitations

1. **Full role/row authorization is not implemented.** Shared/team/client lead access, arbitrary lead associations, lead setter changes and database/RLS effectiveness remain unresolved as described in the baseline. A sales_rep default is required here but is not evidence of adequate least-privilege data isolation.
2. Historical Profile roles need an authorized audit; no silent migration was performed. The database's protection of those rows was not verified live. Auth user creation/profile persistence are not transactional across services.
3. No staging credentials: authenticated full-stack, middleware, real DB constraints, Supabase behavior and real GHL requests remain unverified. Missing Supabase config can fail in middleware before the route-level status documented here. Build success does not establish runtime readiness.
4. User-management UI still offers the full role catalog to managers; the server now rejects disallowed choices. Role-aware UI is a follow-up, not an access boundary. Malformed JSON in user-management routes still throws; valid JSON with invalid schema now gets 400. Broader error handling and invitation lifecycle improvements were not included.
5. GHL remains a shared-secret webhook stub, with unchanged payload processing and public health check. No comprehensive webhook hardening or replay protection is claimed.
6. Existing dependency audit findings and npm upgrade/clean-install blockers in `SAFETY_SLICE_REPORT.md` remain; no fresh dependency audit or dependency remediation was attempted.
7. Calling remains default-off behind exact `TWILIO_CALLING_ENABLED=true`; Call UI stays disabled and recording stays `do-not-record`. Unsigned Twilio voice/status/recording handlers, call intents, callback idempotency, eligibility/suppression/spend controls, consent/retention and staging/backup gates still block live calling. Those handlers and safety controls were not modified.
8. Existing inbound **https://www.get247roi.com/api/voice/inbound** and missed-call text-back were not touched or tested. Callback priority, promise tracking and briefs only after **connected talk time >150 seconds** remain future work; recording was not enabled.
