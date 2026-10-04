# Outpost CRM — authenticated staging readiness audit

**Audit date:** 2026-10-03 UTC. Authenticated catalog/provider observations collected 23:00–23:03 UTC; local review followed in this session.

**Verdict: NOT staging-ready.** Management access works and the existing database baseline is now documented, but no isolated staging environment was found or created. Backup recovery, staging credentials, authorization boundaries, and the requested aggregate counts remain unverified. The additive SQL draft is not executable as currently written.

## Scope and evidence handling

- Repository: `/home/precision_focused_solutions/crm`; HEAD `9c871dcb2d6559df84fe3e3d815c6e4004f943ae`, with substantial existing uncommitted source/tests/docs changes. This audit changed no source or SQL.
- Supabase OAuth was read directly into memory from the separately secured credential file. No token refresh, credential rotation, database-password reset, secret output, application-row export, or credential insertion into this repository occurred.
- Supabase requests were GETs plus the documented **read-only SQL endpoint** `POST /v1/projects/{ref}/database/query/read-only`, exclusively SELECT catalog queries. Its identity probe returned `current_user = session_user = supabase_read_only_user`, `transaction_read_only = on`, HTTP 201.
- Vercel requests were GETs. Environment values were neither printed nor persisted; only names, scope, and metadata were retained. No deployments, branches, projects, migrations, calls, SMS, or external configuration writes occurred.
- The existing inbound URL `https://www.get247roi.com/api/voice/inbound` was **not changed or exercised**. Its missed-call text-back behavior must remain intact; this audit does not claim to have retested it.
- A follow-up command containing SELECT-only core-table counts, profile-role aggregates, effective privilege checks, and extra migration/trigger catalog checks was **denied by the tool/user approval boundary before execution**. It was not retried or routed around. Consequently, those results are explicitly missing below. Earlier successful catalog reads remain valid evidence.

## 1. Supabase project, branching, and backup observations

Authenticated GET `/v1/projects/fzjsgerhohsfxwsqkjdu` returned HTTP 200:

| Field | Verified value |
|---|---|
| Project | `crm` / `fzjsgerhohsfxwsqkjdu` |
| Organization | `ruckmkufeqsevptzvjsy` |
| Region | `us-west-2` |
| Status | `ACTIVE_HEALTHY` |
| Database version | `17.6.1.141`, Postgres engine `17`, release channel `ga` |
| Project created | `2026-07-11T05:05:53.797009Z` |

GET `/v1/projects/{ref}/branches`: HTTP 200, **empty array**. No branches are reported for this project. This does not establish whether other standalone projects exist in the organization; no organization-wide project inventory was taken.

GET `/v1/projects/{ref}/database/backups`: HTTP 200:

```json
{"region":"us-west-2","walg_enabled":true,"pitr_enabled":false,"backups":[],"physical_backup_data":{}}
```

There is **no listed recoverable backup or usable restore point verified by this response**. WAL-G enabled is not proof of retained backups. PITR is disabled. No restore or export was attempted, and recoverability remains a gate before any production migration.

GET `/v1/projects/{ref}/billing/addons`: **HTTP 401**, while database/project/backup endpoints succeeded. Billing entitlement access was not verified; this response does not establish whether the cause is OAuth scope, endpoint authorization, or another billing-access restriction. Do not infer the organization's plan from the backup list or branch inventory.

Official documentation says daily backups are available on Pro/Team/Enterprise with plan-dependent retention; storage objects are not included in database backups. Project-specific entitlement and an actual restorable backup must still be confirmed.

## 2. Verified live public schema

Catalog reads: `pg_class`/`pg_namespace`, `information_schema.columns`, `pg_constraint` with `pg_get_constraintdef`, `pg_indexes`, `pg_type`/`pg_enum`, and `pg_policies`, all HTTP 201. The public schema contains **6 tables, 63 columns, 17 indexes, and 15 constraints** in those results. No public views/materialized views were returned by the relation inventory.

All six tables are owned by `postgres`. **RLS and FORCE RLS are disabled on every one. `pg_policies` returned no public policies.** This is not acceptable evidence of row isolation. Server-route authorization does not automatically protect direct database/API access.

### Complete column inventory

Notation: `?` means nullable; everything else is NOT NULL. Defaults shown below are database defaults. All listed date/time columns are **`timestamp with time zone`, precision 6**. Text columns are unbounded `text`.

- **profiles:** `id uuid`; `email text`; `full_name text?`; `role UserRole = sales_rep`; `phone text?`; `timezone text = America/New_York`; `google_calendar_id text?`; `dialer_hours_extended boolean = false`; `twilio_phone_number text?`; `ghl_contact_id text?`; `created_at timestamptz(6) = now()`; `updated_at timestamptz(6) = now()`.
- **leads:** `id text`; `business_name text`; `contact_name text?`; `phone text?`; `email text?`; `website text?`; `revenue text?`; `location text?`; `industry text?`; `sic_code text?`; `market text?`; `type text?`; `source LeadSource = native`; `segment LeadSegment = active`; `sdr_status text = no_contact`; `external_id text?`; `external_source text?`; `notes text?`; `dialed_count integer = 0`; `setter_id uuid?`; `closer_id uuid?`; `created_at timestamptz(6) = now()`; `updated_at timestamptz(6) = now()`.
- **calls:** `id text`; `lead_id text`; `user_id uuid`; `twilio_call_sid text?`; `status CallStatus = initiated`; `disposition text?`; `duration_seconds integer?`; `recording_url text?`; `started_at timestamptz(6) = now()`; `ended_at timestamptz(6)?`.
- **tasks:** `id text`; `lead_id text`; `user_id uuid`; `note text`; `due_at timestamptz(6)`; `status TaskStatus = open`; `created_at timestamptz(6) = now()`.
- **smart_views:** `id text`; `user_id uuid`; `name text`; `filters jsonb = '{}'::jsonb`; `created_at timestamptz(6) = now()`.
- **org_settings:** `id text = default`; `ghl_enabled boolean = false`; `ghl_location_id text?`; `ghl_api_key text?`; `use_ghl_calendar boolean = false`; `use_ghl_workflows boolean = false`. No settings values were read.

There are no database-generated ID defaults except `org_settings.id`. Prisma's `cuid()` generates IDs in the client; lack of a database CUID default is not itself a mismatch.

### Constraints and indexes

Each table has `<table>_pkey` on `id` with its corresponding unique B-tree index.

| Table | Additional constraints | Additional indexes |
|---|---|---|
| profiles | `profiles_email_key`: UNIQUE(email) | corresponding unique index `profiles_email_key` |
| leads | `leads_setter_id_fkey`, `leads_closer_id_fkey` → profiles(id), ON DELETE SET NULL | `leads_segment_idx` (segment), `leads_setter_id_idx` (setter_id), `leads_phone_idx` (phone), `leads_external_idx` (external_id, external_source) |
| calls | `calls_twilio_call_sid_key`: UNIQUE(twilio_call_sid); `calls_lead_id_fkey` → leads(id), `calls_user_id_fkey` → profiles(id), both ON DELETE CASCADE | corresponding unique `calls_twilio_call_sid_key`; `calls_lead_id_idx` (lead_id); `calls_user_started_idx` (user_id, started_at) |
| tasks | `tasks_lead_id_fkey` → leads(id), `tasks_user_id_fkey` → profiles(id), both ON DELETE CASCADE | `tasks_user_due_idx` (user_id, due_at); `tasks_status_idx` (status) |
| smart_views | `smart_views_user_id_fkey` → profiles(id), ON DELETE CASCADE | `smart_views_user_id_idx` (user_id) |
| org_settings | none beyond primary key | none beyond primary-key index |

All observed indexes use B-tree. Existing FK definitions omit ON UPDATE, meaning NO ACTION. No additional CHECK constraints were returned. There is no observed profiles(id) foreign key to auth.users.

Enums match the local enumerations and their order:

- `UserRole`: admin, sales_manager, hiring_manager, sales_rep, closer, project_manager, hybrid, client.
- `LeadSegment`: active, won, trashed.
- `LeadSource`: native, csv, ghl, manual.
- `CallStatus`: initiated, ringing, in_progress, completed, no_answer, busy, failed, canceled.
- `TaskStatus`: open, completed, canceled.

### Privilege and count limitations

`information_schema.role_table_grants` filtered to anon/authenticated/service_role returned an empty array, but this view is privilege-filtered for the read-only execution role. **Do not interpret that as proof these roles lack access.** An effective `has_table_privilege`/schema-USAGE follow-up was blocked before execution. Direct Data API exposure and effective grants still require verification; no client data was fetched to test exposure.

`information_schema.triggers` returned an empty array. This too may be privilege-limited; the stronger `pg_trigger` follow-up was blocked. No definitive claim of trigger absence is made.

| Requested aggregate | Result |
|---|---|
| profiles row count / role counts | **Not verified: follow-up command denied** |
| leads, calls, tasks, smart_views, org_settings row counts | **Not verified: follow-up command denied** |

No profile identities, emails, phone numbers, lead rows, settings values, or call records were output. Do not assume any table is empty.

## 3. Migration metadata and local drift

GET `/v1/projects/{ref}/database/migrations` returned HTTP 200 with one migration:

- version `20260711144218`, name `initial_crm_schema`.

Catalog evidence confirms `supabase_migrations.schema_migrations` with columns `version text NOT NULL`, `statements text[]`, `name text`, `created_by text`, `idempotency_key text`, and `rollback text[]` (remaining columns nullable). Statements, creators, and rollback bodies were not fetched. Applied-migration statement/rollback counts were not verified because the follow-up command was denied.

No `_prisma_migrations` relation appeared in the public/supabase_migrations inventory. A whole-database relation-name follow-up was not executed. Local `prisma/migrations` and `supabase/migrations` directories do not exist.

Compared against the current uncommitted `prisma/schema.prisma` and `docs/schema-drafts/tags-lists.sql`:

1. **Missing additive tables:** `tags`, `lead_tags`, `lead_lists`, `lead_list_memberships` are absent live. Their associated composite primary keys, organizer uniqueness/indexes, FKs, and deny-by-default RLS statements have not been applied. Existing lead/profile ID types are compatible with the draft references (text/uuid respectively).
2. **Timestamp drift:** all nine existing live date/time columns use `timestamptz(6)`, while local Prisma DateTime fields lack explicit native types, implying PostgreSQL `timestamp(3)` defaults. The additive draft explicitly uses `TIMESTAMP(3)`. Resolve and baseline this deliberately; do not let a broad migration silently rewrite live timestamp types/timezone semantics.
3. **Updated-at defaults:** live profiles.updated_at and leads.updated_at default to `now()`. Local fields use `@updatedAt` without `@default(now())`; Prisma-managed updates and database defaults are distinct behaviors.
4. **FK update-action drift:** existing live FKs use default NO ACTION for updates, while Prisma relations without an explicit onUpdate use Cascade; the additive draft explicitly uses ON UPDATE CASCADE. Preserve or deliberately reconcile the baseline instead of inferring full equivalence from matching field names.
5. **Index naming drift:** live `leads_external_idx`, `calls_user_started_idx`, and `tasks_user_due_idx` have the expected column coverage but differ from Prisma-generated default names (`leads_external_id_external_source_idx`, `calls_user_id_started_at_idx`, `tasks_user_id_due_at_idx`). Baseline/map them rather than unintentionally rebuilding equivalent indexes.
6. **Core field shape:** reviewed core column names, nullability, enum values, text/UUID/integer/boolean/JSON shapes, uniqueness, and FK delete actions otherwise align with the six local core models. This is a catalog/manual comparison, not an executed Prisma migration diff against production.
7. **Blocking SQL syntax contamination:** draft lines **74–83** contain an uncommented Prisma upgrade-notification box (`Update available 6.19.3 -> 8.0.0-rc.19` and npm commands). This is not SQL and will fail execution before its RLS statements and COMMIT. Remove/regenerate the artifact and validate in isolation before any application. The audit left it untouched as instructed.
8. **RLS is not solved by the additive draft:** it enables RLS only for new organizer tables, with no public policies. It does not harden the six existing tables. A server role that owns tables or bypasses RLS must still enforce route-level scope; its actual staging privileges must be verified.

## 4. Vercel deployment and environment metadata

Authenticated GET project/env/deployment-list endpoints returned HTTP 200 for project `prj_AoND6Ud9hrFjIQay40k14J2qO9p8`, team `team_NB981ddsKAGTAJtm4O1A14X1`.

- Project name: `crm`; GitHub link: `bkelly623/crm`, **production branch `main`** (from `link.productionBranch`; top-level productionBranch was null).
- Current production target: `dpl_Ga6ZmQ86cFWgGjoywDmK76Hu1VHS`, state `READY`, URL `crm-37kedwucd-b-kellys-projects.vercel.app`.
- Source: Git; deployed SHA `9c871dcb2d6559df84fe3e3d815c6e4004f943ae`, branch `main`. This matches local HEAD, **not the uncommitted changes**.
- Deployment list returned **8 deployments**, all target `production`, pagination `next = null`; no preview deployment was returned. READY is platform build/deployment status, not proof of authenticated CRM runtime readiness.
- Protection metadata: `ssoProtection.deploymentType = all_except_custom_domains`; `passwordProtection = null`; `trustedIps = null`. Vercel Authentication is configured with a custom-domain exception. This is not an assertion that every custom domain is protected. Actual staging URL access controls, domain assignments, and authenticated collaborator access still need to be tested once a staging target exists. No protection bypass was attempted.

### Environment names and target scope (values not inspected)

The project environment endpoint returned **17 names**, no pagination continuation:

| Target | Names |
|---|---|
| production + preview | `OPENAI_API_KEY` |
| production only | `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_USER`, `POSTGRES_HOST`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE`, `SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |

No listed variable had a git-branch-specific override. No database/Supabase variable was scoped to preview in this response. No `TWILIO_*`, `GHL_*`, or `NEXT_PUBLIC_APP_URL` name appeared in this project-level list. Shared/team-level configuration and values in existing deployment snapshots were not independently enumerated; the names alone do not prove working values, database identity, safe feature-flag values, or complete runtime configuration.

The preview-scoped OpenAI credential is a potential paid-external-service dependency, not staging readiness. Do not exercise paid endpoints merely to test a preview.

## 5. Access and readiness gaps

- **Management OAuth does not automatically provide the PostgreSQL password.** Successful catalog SQL via the Management API does not prove a working Prisma direct/pooler connection, credentials available locally, or the server database role. Vercel's production `POSTGRES_PASSWORD` name is evidence of a configured name only. Its value was not read, copied, or validated. No reset is authorized.
- Need approved **isolated** Supabase project/branch credentials, matching browser and server keys, correct direct/pooler URLs, and validated runtime identity. Never wire preview to the existing production database as a shortcut.
- Need explicitly authorized test accounts/roles and actual authenticated application checks; existing profile-role and table counts remain blocked/unverified.
- Need an effective-grants review, API exposure review, and RLS/route authorization plan for the existing core tables, including sensitive org_settings columns.
- Need baseline migration reproducibility, corrected organizer SQL, and isolated migration/rollback rehearsal.
- Need a verified recoverable backup and restore procedure before production changes; listing an enabled backup subsystem is insufficient.
- Need billing/plan/project-slot confirmation and a budget before any new paid resource. Branch listing success is not branch-creation entitlement.
- Need protected preview routing and safely scoped secrets. Current project env metadata lacks preview Supabase/database configuration.

## 6. Least-risk staging path (recommendation only; not executed)

1. **Keep current production untouched.** Do not push uncommitted work to main merely to test it: main is the Vercel production branch. Preserve the live inbound URL and its existing missed-call text-back behavior.
2. **Prefer an independent, explicitly approved Supabase staging project** with no production data and no automatic production-merge coupling. Confirm available organization/project slots and exact cost first; a separate project is not assumed free. Reconstruct a reviewed, versioned baseline from metadata, preserving intentional native types and constraints. Use synthetic fixtures and staging-only auth identities; do not copy production contacts, secrets, storage, or integrations.
3. **Alternative: a persistent Supabase branch**, after entitlement/budget confirmation. Official docs describe independent Supabase instances/credentials and data-less defaults; persistent branches suit staging. Do not choose “include data.” Disable/avoid automatic production merge or deployment workflows until reviewed. Ephemeral branches suit bounded PR tests, but lifecycle and billing still need an owner. No branches currently exist for this project.
4. **Budget-free interim:** keep offline synthetic tests; a local disposable Supabase/Postgres environment may be considered only after separately checking available disk/resources. The known host disk constraint makes a full Docker stack a capacity decision, not a default. Local Postgres alone does not verify Supabase Auth or Vercel runtime behavior.
5. **Before any schema application:** remove SQL banner contamination, reconcile/baseline drift, review grants/RLS, and obtain explicit authorization. Apply only to the approved isolated target, then read back schema/constraints/policies. Prove restore/rollback using synthetic staging data. Production work remains separately gated.
6. **Then configure a protected Vercel preview or separate staging Vercel project** with staging-only Supabase/db credentials and callback URLs. A separate Vercel project offers clearer secret isolation but its plan implications must be confirmed. Verify protection on the actual URL, including any custom domain; do not broadly bypass protection. Keep calling/recording disabled, GHL/webhooks fail-closed, and paid integrations unused until explicitly approved.
7. **Readiness acceptance:** approved isolation/budget, verified connection identity, aggregate baseline counts, effective grants/RLS, corrected and rehearsed migration, working test-role login, cross-role denial tests, persisted synthetic lead/notes/task/tag/list flow, mobile authenticated checks, safe webhook behavior, and documented restore/rollback. Offline tests/builds or READY deployment metadata do not substitute for these gates.

### Paid-feature uncertainties

Official branching usage documentation currently advertises default Micro branch compute starting at **$0.01344/hour**, plus applicable resource usage. Treat this as a published starting rate, not an account quote or spending cap. Confirm eligibility, persistent-branch billing, included resources, cleanup/lifecycle, and spend-cap coverage in this account before creation. Backup/PITR availability and pricing are plan/add-on dependent. Billing-addons access failed in this audit, so **no paid feature is verified available or approved**.

## Sources and reproducibility

Official references consulted on 2026-10-03:

- Management authentication: https://supabase.com/docs/reference/api/introduction
- Current OpenAPI JSON: https://api.supabase.com/api/v1-json
- Read-only SQL: https://supabase.com/docs/reference/api/v1-read-only-query (database:read; supabase_read_only_user)
- General query documentation (not used for queries): https://supabase.com/docs/reference/api/v1-run-a-query
- Branch inventory: https://supabase.com/docs/reference/api/v1-list-all-branches
- Branch behavior: https://supabase.com/docs/guides/deployment/branching
- Branch usage/pricing: https://supabase.com/docs/guides/platform/manage-your-usage/branching
- Backup capabilities: https://supabase.com/docs/guides/platform/backups
- Vercel Authentication: https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication

Authenticated read endpoints used: Supabase project, branches, database/backups, database/migrations, billing/addons; read-only SQL catalog SELECTs; Vercel `/v9/projects/{id}`, `/v10/projects/{id}/env`, `/v6/deployments` with team/project filters. No API keys endpoint, deployment creation, migration application, data export, or application writes were used.

**Audit completeness:** schema/provider metadata verified as detailed above; aggregate data counts and effective-grant follow-ups blocked by approval denial. Renew authorization for those bounded reads before treating this audit as complete. Staging itself remains unprovisioned and unverified.
