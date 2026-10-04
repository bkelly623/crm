import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Never source a shell file or load application/production .env files.
export function assertLocalUrl(raw: string) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("Invalid local database URL (value redacted)"); }
  if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" ||
      url.port !== "55437" || url.pathname !== "/crm_local_staging" ||
      url.search !== "?connection_limit=2" || url.hash) {
    throw new Error("Refusing database outside exact local staging allowlist (value redacted)");
  }
  return raw;
}

export function configureLocalDatabase() {
  const file = join(homedir(), ".config/crm/local-staging.env");
  if ((statSync(file).mode & 0o777) !== 0o600) throw new Error("Local credentials must be mode 0600");
  const env: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line);
    if (!match || Object.hasOwn(env, match[1])) throw new Error("Invalid local credential file format (redacted)");
    env[match[1]] = match[2];
  }
  if (env.PGHOST !== "127.0.0.1" || env.PGPORT !== "55437" || env.POSTGRES_DB !== "crm_local_staging" ||
      !env.POSTGRES_USER || !env.POSTGRES_PASSWORD) throw new Error("Local staging identity guard failed (redacted)");
  const url = new URL("postgresql://127.0.0.1:55437/crm_local_staging?connection_limit=2");
  url.username = env.POSTGRES_USER;
  url.password = env.POSTGRES_PASSWORD;
  const safe = assertLocalUrl(url.toString());
  // Override inherited DB URLs; never fall back to a production environment.
  for (const key of Object.keys(process.env)) {
    if (/SUPABASE|TWILIO|GHL|VERCEL|POSTGRES|DATABASE_URL|^PG(HOST|PORT|USER|PASSWORD|DATABASE)$/.test(key)) delete process.env[key];
  }
  process.env.POSTGRES_PRISMA_URL = safe;
  process.env.POSTGRES_URL_NON_POOLING = safe;
  process.env.DATABASE_URL = safe;
  return safe;
}
