# Environment setup — CRM

## Fast path: Supabase ↔ Vercel integration (recommended)

If your Supabase project is **connected** to your Vercel `crm` project, env vars sync automatically:

1. [Supabase Dashboard](https://supabase.com/dashboard/project/fzjsgerhohsfxwsqkjdu/settings/integrations) → **Integrations** → **Vercel** → connect to project `crm`
2. Vercel receives: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, etc.

This app uses those names (not legacy `anon` / `DATABASE_URL`).

## Manual env vars (if not using integration)

### Supabase API keys (2026 UI)

**Project Settings → API Keys → tab "Publishable and secret API keys"**

| Vercel variable | Supabase value |
|-----------------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://fzjsgerhohsfxwsqkjdu.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` (key named `default`) |
| `SUPABASE_SECRET_KEY` | `sb_secret_...` (key named `default`) |

There is **no "anon public" key** in the new UI — that's the **publishable** key now.

### Database (Prisma)

**Project Settings → Database → Connection string**

| Vercel variable | Connection type |
|-----------------|-----------------|
| `POSTGRES_PRISMA_URL` | **Transaction pooler** (port 6543) + `?pgbouncer=true` |
| `POSTGRES_URL_NON_POOLING` | **Session mode** (port 5432) |

### App URL

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_APP_URL` | `https://crm-b-kellys-projects.vercel.app` (or your custom domain) |

## Auth redirect URLs

Supabase → **Authentication → URL Configuration**:

- Site URL: your Vercel production URL
- Redirect URLs: `https://crm-b-kellys-projects.vercel.app/**` and `http://localhost:3000/**`

## Git remote

This repo uses **HTTPS** (same as `audit_app`), not SSH:

```
https://github.com/bkelly623/crm.git
```

## Agent / CI automation (recommended)

The Vercel Cursor plugin **cannot write** env vars. For fully automated deploys, use:

```bash
cp .env.vercel-sync.example .env.vercel-sync
# Fill VERCEL_TOKEN, SUPABASE_SECRET_KEY, POSTGRES_* in .env.vercel-sync
bash scripts/sync-vercel-env.sh
```

**One-time human step (unavoidable for security):** create a [Vercel API token](https://vercel.com/account/tokens) and copy Supabase secrets into `.env.vercel-sync` (gitignored). After that, agents and CI can sync env vars without the dashboard.

Alternative: store the same file at `~/.config/crm/deploy.env` to share across projects on this VM.

## First user

Supabase → **Authentication → Users** → Add user → sign in at `/login`

Make admin (SQL Editor after first login):

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';
```
