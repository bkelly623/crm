# Local browser preview

- Application built successfully with gitignored `.env.local` (mode0600).
- Prisma connects only to `127.0.0.1:55437/crm_local_staging`, the synthetic local PostgreSQL database. No production DB URL/password provisioned.
- Supabase PUBLIC URL/publishable key were read from existing Vercel configuration. The existing CRM Supabase is used for normal user sign-in only. This is shared authentication with isolated application data, NOT a wholly independent Supabase environment.
- No Supabase admin/service secret, Twilio credentials or GHL secret is provisioned in the local app. Outbound calling explicitly false; number selector therefore safely reports unavailable inventory after login.
- Production-mode Next server is loopback3090. Temporary HTTPS preview tunnel may expose the app's normal authenticated login, not database ports. Do not overwrite `.next` with another build while it is running; stop/rebuild/restart deliberately.
- HTTP smoke: login200; dashboard redirects to login when unauthenticated; leads401; number inventory401; token503. Phone-size390x844 browser load renders login without horizontal overflow. Authenticated dashboard and physical-phone behavior still unverified; no credentials supplied or authentication bypassed.
- Native direct localhost request to unauthenticated dashboard redirected to localhost:3090/login. Verify reverse-proxy redirect behavior before treating a tunnel as stable deployment. Prefer direct `/login` entry in the temporary preview.
- Existing production inbound text-back and production database unchanged. Local database is volatile tmpfs with synthetic dump retained separately; this is not production-ready hosting.
