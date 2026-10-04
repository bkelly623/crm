# CRM access status

## Supabase OAuth resolved
- User completed Supabase OAuth for Outpost CRM - Dirty Harry. Parent independently re-read project `fzjsgerhohsfxwsqkjdu`: name `crm`, status `ACTIVE_HEALTHY`, region `us-west-2`, organization `ruckmkufeqsevptzvjsy`.
- Access/refresh tokens: `/home/precision_focused_solutions/.config/crm/supabase-oauth.json` (verified mode 0600). Client registration secret: adjacent `supabase-oauth-client.json`. Read in-process only, never print or commit. OAuth does not itself reveal the Postgres password.
- Temporary callback listener exited after success; Cloudflare tunnel was explicitly stopped.
- Authenticated read-only staging readiness audit is in progress. No remote configuration/database writes made.
- Earlier Supabase blockers below describe the superseded discovery attempts, not current management access.

## Verified read-only discovery
- Git SSH: `git ls-remote origin HEAD` returned the CRM baseline commit; `git push --dry-run origin HEAD:refs/heads/main` succeeded without changing remote refs.
- Vercel CLI auth store: `/home/precision_focused_solutions/.local/share/com.vercel.cli/auth.json`. Use the existing store; do not copy its short-lived token into source or logs.
- Vercel authenticated project lookup succeeded: project `prj_AoND6Ud9hrFjIQay40k14J2qO9p8`, name `crm`, account `team_NB981ddsKAGTAJtm4O1A14X1`, GitHub link `bkelly623/crm`.
- Vercel environment inventory and public URL reads succeeded. Production Supabase URL is `https://fzjsgerhohsfxwsqkjdu.supabase.co`.
- Production DB URLs and server keys are stored as sensitive Vercel variables; a targeted read returned no value. Do not weaken sensitive-variable protection or deploy code to expose these secrets.
- No preview/development database variables were present in the fetched CRM environment inventory. Do not use production as isolated staging.

## Supabase blocker
- Management tokens found in `/home/precision_focused_solutions/.config/hermes/247-ops-dashboard.env` and `/home/precision_focused_solutions/.openclaw/workspace-hermes/.secrets/platform.env` each received HTTP 401 from Supabase project listing.
- George Washington/1776 responded: no current valid Supabase access verified. Cursor mcp-auth.json files contain client registration metadata only, not access/refresh tokens. Its discovery was partially limited by approvals.
- Browser Supabase and GitHub OAuth both require sign-in; local vault has no saved logins. No browser authentication was completed.
- Supabase MCP install via manage_connections could not proceed because this Telegram session has no approval surface. Tool-provided recovery commands are `hermes -p dirtyharry mcp install supabase` and `hermes -p dirtyharry mcp login supabase`; CLI help confirms install/login subcommands. User OAuth approval is still required.
- No credentials rotated, roles changed, databases modified or remote deployment triggered.

## Next gate
Locate and verify current Supabase management access, then inspect CRM project state and choose an isolated test environment. Verify staging migrations, persistence and backups before production cutover. Existing Twilio inbound routing and missed-call text-back remain untouched.
