# Production release report

## Released and read back
- Canonical production: **https://crm-sepia-xi.vercel.app**.
- Application release commit: `35c2dcb74e91ea236a88ec68f684081986759038`, pushed and independently read from `bkelly623/crm` main.
- Application release deployment: `dpl_9jYWtQR7bGSfMic7e1StkNCX3RG8`, **READY / production**; immutable URL: https://crm-qezlacro1-b-kellys-projects.vercel.app.
- Vercel deployment metadata matched the exact application commit and canonical alias. This report is a subsequent documentation-only commit; later documentation deployments do not change application source.

## Database protection and applied changes
- Target independently identified: Supabase `fzjsgerhohsfxwsqkjdu`, active CRM project. Source uses Supabase Auth and server Prisma for CRM data. Vercel integration login read back as `postgres`; catalog confirms login/bypass-RLS and observed pooler activity under that role.
- Recovered the private six-public-table export into a **new isolated local database** `crm_production_recovery`. Existing staging was not reset. Typed rows, all 63 core columns, 15 constraints and 17 indexes matched the export; exact native timestamp types/defaults and FK actions retained. This is tested six-table recovery, **not** a full Auth/Storage/Supabase backup.
- Rehearsed additive DDL rollback and commit on that recovery database. All 12 Prisma models queried successfully; organizer writes and transaction rollback succeeded against recovered schema.
- Applied `docs/migrations/20261004-production-cutover.sql` in one transaction, with lock/statement timeouts. Added `tags`, `lead_tags`, `lead_lists`, `lead_list_memberships`, `call_intents`, `call_intent_leases`, including lifecycle, unique, FK and terminal-proof checks.
- Minimal core hardening: revoked table privileges from `PUBLIC`, `anon`, `authenticated` across the six core and six new tables. Existing core RLS flags unchanged; new tables have deny-by-default RLS. Auth schema/service roles untouched. Server `postgres` read/write privilege probes succeeded before and after.
- Exact core row and catalog readback unchanged: profiles **1**, leads **5**, org_settings **1**, calls/tasks/smart_views **0**. New tables empty. No db push, reset, core type change, core FK change or data deletion.
- Anonymous Supabase Data API HEAD requests for **all six core tables returned 401** after hardening. Effective anonymous/authenticated table privileges false for all 12 tables. Public Auth settings remained HTTP 200.

## Production configuration and verification
- Existing Vercel project retained; only explicit production variables configured. Canonical app/webhook origin is the URL above. Twilio account/key secrets are server-only sensitive variables. `.env.local`, production exports, private credentials and local test credentials were not uploaded.
- `TWILIO_CALLING_ENABLED=false`; recipient allowlist empty. Actual deployed token endpoint returned **503 / Outbound calling disabled**.
- Dedicated Outpost TwiML app Voice and parent-status callbacks now use canonical production `/api/twilio/voice` and `/api/twilio/status`, POST, verified by fixed-resource GET. Public application connect disabled; SMS/fallback routes empty. Legacy HighLevel apps, LC key metadata and incoming-number objects remained byte-for-byte equivalent as parsed JSON before/after. Existing get247roi.com inbound Voice/SMS routing preserved.
- **583 tests passed (39 files)**; lint and typecheck passed. Vercel production build reached READY. Local preview/.next were not overwritten by a competing build.
- Live login HTTP 200; dashboard redirects to canonical login. Unauthenticated lead/task/organizer/queue/intent/number routes denied 401; users denied 403. Eleven referenced JS/CSS/font assets returned 200.
- Production login visually inspected at **390×844**: readable inputs/button, viewport and document width both 390, no horizontal overflow.
- Reviewed staged authorization/lifecycle changes and known-secret scan. GitHub push protection caught Twilio account/key **identifiers in historical docs**; removed them from the unpushed commit and retried normally. No protection bypass. Push succeeded. Optional extra Codex/Claude reviews both failed with expired OAuth/HTTP 401; no claim those reviews passed.

## Remaining gates — calling is NOT activated
1. Real-user authenticated production walkthrough: existing login, profile, leads, tag/list changes and follow-up persistence. Browser vault had no login and its secure prompt was unavailable in this headless session; no auth bypass, password reset, generated user/session or local test login was used. Authenticated dashboard/mobile acceptance is therefore not claimed.
2. Explicitly approved, independently answerable E.164 test recipient and eligible test lead; configure narrow allowlist, supervised window/stop conditions and usage/spend limits, then deliberate flag activation/redeployment with readback. No prospect dialing.
3. Actual phone microphone/two-way audio, caller ID, mute/DTMF/hangup, busy/no-answer, duplicate callbacks, both-leg release, manual wrap-up/Next; app switching, screen lock, cellular interruption and Wi-Fi recovery.
4. Inbound missed-call text-back **exactly once** and opt-out regression. Unchanged legacy routing alone is not end-to-end acceptance. Recording remains off; consent/legal/retention controls required before any recording feature activation.

No calls, SMS or recordings were initiated. CRM deployment is live; calling remains intentionally unavailable.

## Recovery and private evidence
Evidence is mode 0600 outside Git under `~/.config/crm/production-backups/`: original export, immediate pre-cutover rows, recovery/security/env evidence, deployment readback, public smoke results, staged scan and Twilio pre/post metadata. Keep exports private. Local recovery data uses the existing bounded local PostgreSQL storage and is not a durable disaster-recovery backup. If app rollback is necessary, redeploy a prior compatible application while retaining additive tables and hardened grants; do **not** reopen anonymous table access or drop new tables with user data.
