# Local PostgreSQL rehearsal — verified

**Executed:** 2026-10-03 UTC; full SQL/restore evidence captured at 23:22:48 UTC.

**Result:** isolated local PostgreSQL 17 is healthy and available. The corrected organizer SQL executed successfully against a reconstructed synthetic baseline. Real FK/uniqueness/membership/RLS/rollback tests and a dump/restore comparison passed. **This is a database rehearsal, not full application or Supabase staging readiness.**

## Isolation, cost and resources

- Only existing-VM Docker resources were created. No Supabase, Vercel, Twilio, GHL or other cloud API was called; no cloud project, paid service, VM, disk or subscription was provisioned. This adds no new billable cloud resource; existing VM billing is outside this test.
- Container: `crm-local-staging`; published **only** at `127.0.0.1:55437` → container port `5432`. Port availability was checked before creation; the binding was inspected afterward. An authenticated PostgreSQL TCP query through that actual host-loopback port returned database `crm_local_staging`, role `postgres`, server port `5432`.
- Official Docker Hub `library/postgres:17-alpine` was pulled, its repository digest inspected, and startup pinned to:
  ```text
  postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24
  ```
- Actual server: **PostgreSQL 17.11**, Alpine x86_64. Audit-confirmed production is engine 17 / provider version `17.6.1.141`; this is not the identical Supabase build. Inspected image size: **117,212,703 bytes** (image metadata, not a measurement of all Docker layer storage).
- Enforced limits read back: memory **536,870,912 bytes**, memory+swap **536,870,912 bytes** (no extra swap), **1 CPU**, **100 PIDs**. Shared buffers 32MB, max connections 20, work memory 2MB, maintenance memory 16MB; WAL targets 32–64MB, per-process temporary-file limit 16MB. Docker log rotation: 5MB × 2. Restart policy: **no**.
- Named volume `crm-local-staging-data` uses Docker's local driver with `type=tmpfs`, `device=tmpfs`, `o=size=256m,uid=70,gid=70,mode=0700`.
- **Important: PGDATA is a hard-bounded, VOLATILE 256MiB tmpfs volume, not durable disk storage. Stopping/recreating the container or rebooting may erase it.** Leave the healthy container running for subsequent local staging. A tested synthetic dump is retained outside the repo for recovery. Do not treat this as a production backup or durable staging service.
- SQL/restore evidence sample: **83.64MiB / 512MiB**, CPU **0.02%**; PGDATA **50,972 KiB used / 262,144 KiB capacity**. Later readback: healthy, `OOMKilled=false`.
- Initial host: RAM 15,986MiB total / 6,064MiB available; swap 8,187MiB used / 8,191MiB total; disk 7.1GiB available. Final sample: RAM 6,184MiB available, swap full, disk **6.7GiB available**. Other activity was concurrent, so host deltas are not attributed entirely to this container. Full swap and tight disk remain reasons **not** to install a complete Supabase stack here.
- All nine pre-existing containers remained running with their prior names/status patterns; none was stopped, recreated, pruned or reconfigured.

## Credentials

Generated a random local-only password using Python `secrets.token_urlsafe(48)`. File:

```text
~/.config/crm/local-staging.env
```

Verified mode **0600**. Contains local `POSTGRES_*` and loopback `PGHOST`/`PGPORT` values; it is outside the repository. No password or connection URL was printed or committed. The container receives the file, with internal `PGPORT=5432` explicitly overriding the host port. Host PostgreSQL authentication rules were read back as SCRAM-SHA-256. The SQL owner connection is intentionally local `postgres`; Docker-access users are privileged and can inspect container configuration. This is not hardened multi-user credential isolation.

No application `.env`, production credentials, app source, Prisma schema or package files were edited by this task.

## Baseline and additive migration

Reviewable **local rehearsal only** baseline: `docs/schema-drafts/local-baseline.sql`. It reconstructs metadata from `docs/STAGING_READINESS_REPORT.md`, not production rows:

- **6 tables, 63 columns, 15 constraints, 17 indexes**, verified by PostgreSQL catalogs before the additive migration.
- Audit enum labels/order, UUID profile IDs, text lead IDs, nullability, defaults, delete actions and exact audited index/constraint names.
- All **9** core datetime columns remain `timestamptz(6)`. Core FK update actions remain **NO ACTION**, not Prisma's implicit cascade.
- Preserves `leads_external_idx`, `calls_user_started_idx`, `tasks_user_due_idx` and other audited names.
- No invented FK to `auth.users`; no auth schema, migration history, unverified triggers or production grants reconstructed.
- Core RLS stays disabled to mirror the audit; **this is not an endorsement of production access safety**.

Applied the corrected `docs/schema-drafts/tags-lists.sql` **only to the local primary database**. It contained no Prisma upgrade banner. Readback found **10 tables, 24 constraints, 25 indexes**, with RLS enabled precisely on `tags`, `lead_tags`, `lead_lists`, `lead_list_memberships` and no policies. Core columns/constraints/indexes/enums/RLS metadata were compared before/after and remained unchanged.

The additive SQL itself was not edited. Its header's historical “NOT APPLIED” remains true for production, but it **has now been rehearsed locally**. The historical staging-audit warning about the old contaminated SQL is superseded only for this corrected local artifact. New organizer timestamps remain `timestamp(3)` and new FKs use `ON UPDATE CASCADE`; those deliberate draft-versus-core differences are **not resolved by this rehearsal**.

SHA-256 of applied additive SQL:

```text
d345e5ab43e9648bd71b698e7070214c5844a3c3d68587ac53b7c06d9204b16d
```

## Real SQL checks

Executed with `psql -X -v ON_ERROR_STOP=1`; tests raise exceptions on unexpected acceptance or incorrect counts. Reviewable tests: `docs/schema-drafts/local-database-tests.sql`.

| Check | Actual result |
|---|---|
| Synthetic inserts across all core and new tables | Committed; read back in primary and restore |
| All five new FKs | Each invalid parent reference rejected with `foreign_key_violation` / SQLSTATE 23503 |
| Tag normalized-name uniqueness, per-owner list-name uniqueness, both membership composite keys | Four duplicate writes rejected with `unique_violation` / SQLSTATE 23505 |
| Same list name for another owner | Accepted as intended |
| Repeat list/tag membership with `ON CONFLICT DO NOTHING` | Both retries affected zero rows |
| One master lead in two named lists | One lead row, two memberships; no duplicate lead |
| Lead delete cascade | Tag/list memberships, synthetic call and task disappeared inside transaction |
| Data rollback | Lead, both memberships, tag membership, call and task all returned |
| Additive DDL rollback | In second DB, baseline + migration reached 10 tables; savepoint rollback returned to 6 core tables and absent `tags`; outer rollback restored the empty database catalog |
| Non-owner RLS on every new table | See below: all four CRUD operations tested |

### RLS is genuinely tested, but only locally

Created `crm_local_rls_probe` with **NOLOGIN, NOSUPERUSER, NOBYPASSRLS**; tables remain owned by `postgres`. Granted explicit schema usage and SELECT/INSERT/UPDATE/DELETE privileges so missing grants could not masquerade as RLS protection. Under `SET ROLE crm_local_rls_probe`:

- SELECT returned zero rows on each of the four populated organizer tables.
- INSERT on each table failed with insufficient privilege **and an explicit row-level-security error message**.
- UPDATE and DELETE each affected zero rows on each table.

Reset role and revoked the deliberate probe grants afterward. The inert no-login role remains in this local cluster. Readback confirmed superuser=false, bypassrls=false, login=false. Table owner/superuser bypass is expected; **this is not proof of application authorization, Supabase JWT role behavior, or per-owner RLS policies**.

## Dump/restore proof

Created a real `pg_dump -Fc` of `crm_local_staging`, then `pg_restore --exit-on-error --single-transaction` into the second local DB **`crm_local_restore`**. Both live databases remain available.

- Synthetic custom-format dump: `~/.config/crm/local-staging.dump`, mode **0600**, **24,517 bytes**.
- Dump SHA-256: `60bb1222b8c4d5b5bbea6381f521bcfbdb79fb71ade88a60a9bca78e3ae15779`.
- Exact catalog comparisons passed for columns/defaults/types, constraints, indexes, enums, RLS owner/flags and policies.
- Every table's row count and canonical row-content checksum matched.
- Full `pg_dump --schema-only` text matched after removing **only** random `\restrict` / `\unrestrict` tokens. Normalized schema SHA-256: `17baeebb06d9fb63d6e6acc53269ccb86110e5af3c767341e5997c54b752bd85`.
- This proves this small synthetic dump restores in the **same local PostgreSQL cluster**. It does not prove Supabase project restore, cross-version restore, roles/global-object backup, PITR, storage-object recovery, or production recoverability.

| Table | Primary | Restored |
|---|---:|---:|
| profiles | 2 | 2 |
| leads | 1 | 1 |
| calls | 1 | 1 |
| tasks | 1 | 1 |
| smart_views | 1 | 1 |
| org_settings | 1 | 1 |
| tags | 1 | 1 |
| lead_tags | 1 | 1 |
| lead_lists | 3 | 3 |
| lead_list_memberships | 2 | 2 |

Fixtures use `example.invalid`, synthetic IDs, no destination phone numbers and disabled integration defaults. No real contact/profile/settings rows were copied.

## Files and operation

Created:

- `docs/schema-drafts/local-baseline.sql` — auditable core reconstruction.
- `docs/schema-drafts/local-database-tests.sql` — executable synthetic SQL tests.
- `docs/local-staging-start.py` — pinned, capacity-checked, bounded creation; refuses existing resources/credential files.
- `docs/local-staging-verify.py` — local identity/limit checks, real SQL execution and dump/restore/catalog comparisons; rejects populated completed schemas rather than overwriting them.
- `docs/local-database-evidence.json` — actual catalog snapshots, checksums, counts, limits and measurements; no credentials.
- `docs/LOCAL_DATABASE_REPORT.md` — this report.

Creation/rehearsal commands used (already completed; **do not rerun against the populated retained container**):

```bash
python3 /home/precision_focused_solutions/crm/docs/local-staging-start.py
python3 /home/precision_focused_solutions/crm/docs/local-staging-verify.py
```

Safe current read-only checks:

```bash
docker inspect crm-local-staging --format '{{.State.Health.Status}}'
docker stats --no-stream crm-local-staging
docker exec crm-local-staging psql -X -h /var/run/postgresql -p 5432 -U postgres -d crm_local_staging -Atc 'SELECT current_database(), version();'
```

Do not dump the credential file or full Docker inspect into chat/logs. Application wiring and use of a least-privileged server role are separate work; no local app connection configuration was changed here.

## Issues encountered and remaining gates

1. Initial startup attempts exposed a host/internal `PGPORT` collision: the server listened internally on 55437 while the publish/healthcheck expected 5432. Logs proved the cause. Only those failed owned container/volume/credential resources were removed; explicit internal port override fixed it. Current container is healthy.
2. The first verifier run encountered multi-line JSON aggregation parsed as a single scalar line after successfully creating the empty baseline. Full JSON parsing fixed it. A proposed local reset command was **blocked/pending approval and did not execute**; it was not retried. The verifier instead resumed the untouched empty baseline without destructive reset. **Do not approve that obsolete reset command now**: the completed synthetic test databases are retained. DDL rollback/restore was redesigned to need no DROP command.
3. Database durability is intentionally limited by volatile tmpfs. The retained tiny dump is the recovery artifact; monitor volume capacity before expanding fixtures. No large imports/load testing.
4. **Not verified:** Supabase Auth, Data API/PostgREST, real JWT roles, Vercel preview/deployment/protection, Prisma runtime wiring, authenticated app behavior, mobile browsers/audio, live calling/recording, inbound missed-call text-back, callbacks, production schema/data/permissions/backup recovery. No external calls or SMS were made.
5. No production approval is implied. Original staging, production backup, core RLS, authorization, timestamp/FK/index drift and approved-recipient gates remain open.
