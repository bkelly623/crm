/**
 * Supabase API keys (2025+): publishable + secret keys replace anon + service_role.
 * @see https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys
 */

export function getSupabaseUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL;
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL from Supabase↔Vercel integration)");
  }
  return url;
}

/** Client-safe key: publishable (sb_publishable_...) or legacy anon JWT */
export function getSupabasePublishableKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or SUPABASE_PUBLISHABLE_KEY from Supabase↔Vercel integration)",
    );
  }
  return key;
}

/** Server-only key: secret (sb_secret_...) or legacy service_role JWT */
export function getSupabaseSecretKey(): string {
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error(
      "Missing SUPABASE_SECRET_KEY (Dashboard → Project Settings → API Keys → Secret key, starts with sb_secret_)",
    );
  }
  return key;
}
