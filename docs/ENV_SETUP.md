# Environment setup (July 2026)

Supabase renamed their API keys. **There is no "anon public" key in the new UI** — use **Publishable** and **Secret** keys instead.

## 1. Supabase API keys

Open your project: https://supabase.com/dashboard/project/fzjsgerhohsfxwsqkjdu

1. Click **Project Settings** (gear icon, bottom of left sidebar)
2. Open **API Keys**
3. Select the tab **"Publishable and secret API keys"**
4. If you only see a **"Create new API keys"** button, click it — this creates a `default` publishable + secret pair
5. Copy:
   - **Publishable key** → `sb_publishable_...` → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - **Secret key** → `sb_secret_...` → `SUPABASE_SECRET_KEY`

> **Legacy tab:** Older projects may still show JWT `anon` / `service_role` under a **Legacy** tab. Those still work as fallbacks (`NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`) but prefer the new keys.

Docs: https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys

## 2. Supabase database URLs (Prisma)

Same project → **Project Settings** → **Database** → **Connection string**

| Env var | Which string | Used for |
|---------|--------------|----------|
| `DATABASE_URL` | **Transaction pooler** (port **6543**) | Vercel runtime, app queries |
| `DIRECT_URL` | **Session mode** / direct (port **5432**) | `prisma db push`, migrations |

For `DATABASE_URL`, append if not present:
```
?pgbouncer=true&connection_limit=1
```

Replace `[YOUR-PASSWORD]` with your database password (reset under Database settings if needed).

## 3. Supabase Auth — first user

1. **Authentication** → **Users** → **Add user** → email + password
2. Sign in at your app `/login`
3. Optional — make yourself admin (after first login creates `profiles` row):

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';
```

Run in **SQL Editor**.

## 4. Push database schema

```bash
npx prisma db push
```

## 5. Vercel environment variables

**Vercel** → your project → **Settings** → **Environment Variables**

Add all of these for **Production**, **Preview**, and **Development**:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://fzjsgerhohsfxwsqkjdu.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` from step 1 |
| `SUPABASE_SECRET_KEY` | `sb_secret_...` from step 1 |
| `DATABASE_URL` | Transaction pooler string (6543) |
| `DIRECT_URL` | Direct/session string (5432) |
| `NEXT_PUBLIC_APP_URL` | `https://YOUR-APP.vercel.app` |

Redeploy after saving env vars.

## 6. Twilio (when ready)

| Variable | Where |
|----------|-------|
| `TWILIO_ACCOUNT_SID` | Twilio Console dashboard |
| `TWILIO_AUTH_TOKEN` | Twilio Console dashboard |
| `TWILIO_API_KEY` | Console → Account → API keys → Create |
| `TWILIO_API_SECRET` | Shown once when API key is created |
| `TWILIO_TWIML_APP_SID` | Console → Voice → TwiML Apps → Create app |
| `TWILIO_CALLER_ID` | A Twilio number you own, E.164 format |

**TwiML App voice URL:** `https://YOUR-APP.vercel.app/api/twilio/voice`

## 7. Go High Level (optional)

| Variable | Purpose |
|----------|---------|
| `GHL_API_KEY` | API access |
| `GHL_LOCATION_ID` | Sub-account/location |
| `GHL_WEBHOOK_SECRET` | Verify inbound webhooks to `/api/webhooks/ghl` |

## Quick checklist

- [ ] Publishable key in Vercel (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
- [ ] Secret key in Vercel (`SUPABASE_SECRET_KEY`)
- [ ] Both database URLs set
- [ ] `npx prisma db push` run once
- [ ] User created in Supabase Auth
- [ ] `NEXT_PUBLIC_APP_URL` matches Vercel domain
- [ ] Redeploy on Vercel
