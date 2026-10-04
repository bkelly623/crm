# Tags/lists SQL draft review

**Status: cleaned review-only draft; not applied, not staging-ready.** Evidence: [staging readiness audit](STAGING_READINESS_REPORT.md), sections 2–3. No new database observations were made. This review updates only the audit's historical banner finding; its remaining readiness gates still apply.

## Exact change and DDL review

- Removed the ten uncommented Prisma upgrade-banner lines (original SQL lines 74–83) from `schema-drafts/tags-lists.sql`. SQL statements, types, indexes, FK actions, transaction boundaries and RLS statements are unchanged. Reviewed the whole file; no other CLI output, Markdown fences, escape sequences or box-drawing artifacts found.
- The draft adds four tables (`tags`, `lead_tags`, `lead_lists`, `lead_list_memberships`), four primary keys, four explicit indexes (two unique), five FKs and four RLS enables inside `BEGIN`/`COMMIT`. Only the new tables are created/altered; existing tables are reference targets, not alteration targets. This is not a rerunnable/idempotent migration.
- Both membership `lead_id` columns are `TEXT`, matching the audit-verified `leads.id text` primary key. `lead_lists.owner_id UUID` matches the verified `profiles.id uuid` primary key. Internal `tag_id` and `list_id` references match their new `TEXT` primary keys. Composite membership primary keys prevent duplicate links; unique indexes enforce global tag keys and per-owner list keys. Reverse membership indexes cover `tag_id`/`list_id` lookups.
- IDs still require client-supplied values; the draft introduces no SQL ID generator. All five new FKs retain `ON DELETE CASCADE ON UPDATE CASCADE`; cascade effects require isolated rehearsal. RLS without policies restricts ordinary roles, but owners/BYPASSRLS roles can bypass it. No effective grants or server-role behavior were verified, and existing tables are not hardened by this draft.

## Offline checks and limitations

- Whole-file structural assertions passed: 19 statements = two transaction boundaries, four CREATE TABLEs, four CREATE INDEXes, five FK ALTERs and four RLS ALTERs. Assertions also checked all five FK type pairs against the draft plus audited core types, four primary keys, alteration targets, RLS coverage and absence of the banner/artifacts. These are structural checks, **not SQL syntax validation**.
- No available parser found: `pglast`, `pg_query`, `sqlglot`, `sqlparse` absent from system Python 3.11, Python 3.13 and the tool interpreter; Node resolution found none of `pgsql-parser`, `pg-query-parser`, `libpg-query`, `node-sql-parser`, `pgsql-ast-parser`. `postgres`, `psql` and `pg_config` were not on PATH. No dependencies were installed.
- **Parser-based syntax validation and PostgreSQL execution remain unverified.** No database calls, credentials, migrations, deployments, commits, builds or application tests were used for this review. Structural checks cannot prove database object resolution, privileges, runtime semantics or successful application.

## Unresolved baseline: no broad migration allowed

**Native timestamp/index/FK baseline drift remains unresolved. No broad migration or `db push` is allowed.** Existing live timestamps are `timestamptz(6)`, while the draft retains `TIMESTAMP(3)` and the audited Prisma defaults differ from the native baseline. Existing FK updates are `NO ACTION`, unlike the draft's `CASCADE` and implicit Prisma actions. Existing index names (`leads_external_idx`, `calls_user_started_idx`, `tasks_user_due_idx`) need deliberate baseline mapping, not incidental rebuilding. Live `updated_at` defaults versus Prisma-managed updates also remain unresolved.

Do not infer migration safety from matching FK types or this cleanup. Preserve the existing native schema until its baseline is deliberately reviewed/reconciled. Before any application, require explicit authorization, an isolated staging target, recoverable backup/restore evidence, grant/RLS and cascade review, authentic PostgreSQL validation, and migration/rollback rehearsal. Production and `schema.prisma` remain untouched by this task.
