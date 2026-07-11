# CRM — Outbound Sales + Power Dialer

Rebuilt from Work Optional CRM audit. Phase 0 foundation: auth, dashboard shell, leads, GHL-ready integration layer.

## Stack

- **Next.js 15** (App Router)
- **Supabase** (Auth + Postgres)
- **Prisma** (ORM)
- **Tailwind CSS 4**
- **Vercel** (deploy)

## Quick start

### 1. Clone & install

```bash
git clone git@github.com:bkelly623/crm.git
cd crm
npm install
cp .env.example .env.local
```

### 2. Supabase setup

1. Open [Supabase Dashboard](https://supabase.com/dashboard/project/fzjsgerhohsfxwsqkjdu)
2. **Settings → API** — copy `anon` key and `service_role` key
3. **Settings → Database** — copy connection strings:
   - **Transaction pooler** (port 6543) → `DATABASE_URL`
   - **Session/direct** (port 5432) → `DIRECT_URL`
4. **Authentication → Users** — create your first user (email + password)
5. Push schema:

```bash
npx prisma db push
```

6. (Optional) Set your user as admin in Supabase SQL editor:

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';
```

### 3. Run locally

```bash
npm run dev
```

Open http://localhost:3000

### 4. Vercel deploy

Import `bkelly623/crm` in Vercel. Set all env vars from `.env.example`.  
`NEXT_PUBLIC_APP_URL` should be your Vercel URL (e.g. `https://crm.vercel.app`).

## Environment variables

See [`.env.example`](.env.example) for the full list.

| Variable | Required | Where to get it |
|----------|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase → Settings → API (server only) |
| `DATABASE_URL` | Yes | Supabase → Database → Pooler (6543) |
| `DIRECT_URL` | Yes | Supabase → Database → Direct (5432) |
| `NEXT_PUBLIC_APP_URL` | Yes | Your Vercel URL |
| `TWILIO_*` | Phase 1 | Twilio Console |
| `GHL_*` | Optional | Go High Level |

## Project structure

```
src/
├── app/
│   ├── dashboard/     # CRM modules
│   ├── api/           # REST routes + webhooks
│   └── login/
├── components/
├── lib/
│   ├── integrations/  # GHL adapter (swappable)
│   ├── supabase/
│   └── nav.ts         # Role-based navigation
prisma/
└── schema.prisma
docs/
└── audit/             # Original CRM discovery
```

## Roadmap

See `docs/audit/04-rebuild-roadmap.md`

- **Phase 0** ✅ Foundation (this commit)
- **Phase 1** — Twilio dialer, CSV import, SmartViews
- **Phase 2** — Appointments, pipeline, GHL sync
- **Phase 3** — Stripe payments, pay views
- **Phase 4** — Admin (users, phone numbers, reports)
