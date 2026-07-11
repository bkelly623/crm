# CRM — Outbound Sales + Power Dialer

## Stack

Next.js 15 · Supabase (Auth + Postgres) · Prisma · Twilio · Vercel

## Setup

**Full env instructions:** [`docs/ENV_SETUP.md`](docs/ENV_SETUP.md)

### Required Vercel env vars

| Variable | Notes |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://fzjsgerhohsfxwsqkjdu.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` — **not** "anon" |
| `SUPABASE_SECRET_KEY` | `sb_secret_...` — **not** "service_role" |
| `DATABASE_URL` | Supabase **transaction pooler** (port 6543) |
| `DIRECT_URL` | Supabase **direct/session** (port 5432) |
| `NEXT_PUBLIC_APP_URL` | Your Vercel URL |

Get keys: Supabase Dashboard → **Project Settings** → **API Keys** → tab **Publishable and secret API keys**.

### First deploy

```bash
npm install
npx prisma db push
```

Create a user in Supabase → Authentication → Users, then sign in at `/login`.

## What's built

**Phase 0** — Auth, dashboard shell, role-based nav, settings  
**Phase 1 (in progress)** — Leads CRUD, CSV import, SmartViews API, dialer UI, Twilio routes, GHL webhook stub

## Roadmap

See `docs/audit/04-rebuild-roadmap.md`
