#!/usr/bin/env bash
# Sync CRM env vars to Vercel via REST API (no Vercel CLI required).
# One-time setup: copy .env.vercel-sync.example → .env.vercel-sync and fill secrets.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Load secrets (first match wins)
for f in "${DEPLOY_ENV_FILE:-}" "$ROOT/.env.vercel-sync" "$HOME/.config/crm/deploy.env"; do
  if [[ -n "$f" && -f "$f" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$f"
    set +a
    break
  fi
done

: "${VERCEL_TOKEN:?Set VERCEL_TOKEN in .env.vercel-sync or ~/.config/crm/deploy.env}"
: "${SUPABASE_SECRET_KEY:?Missing SUPABASE_SECRET_KEY}"
: "${POSTGRES_PRISMA_URL:?Missing POSTGRES_PRISMA_URL}"
: "${POSTGRES_URL_NON_POOLING:?Missing POSTGRES_URL_NON_POOLING}"

VERCEL_PROJECT_ID="${VERCEL_PROJECT_ID:-prj_AoND6Ud9hrFjIQay40k14J2qO9p8}"
VERCEL_TEAM_ID="${VERCEL_TEAM_ID:-team_NB981ddsKAGTAJtm4O1A14X1}"
GITHUB_REPO_ID="${GITHUB_REPO_ID:-1297444940}"

NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-https://fzjsgerhohsfxwsqkjdu.supabase.co}"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-sb_publishable_ML3IVUtLcjVD4lRuX15D9A_5zKJvQ0p}"
NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-https://crm-b-kellys-projects.vercel.app}"

API="https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/env?upsert=true&teamId=${VERCEL_TEAM_ID}"
TARGETS='["production","preview","development"]'

upsert_env() {
  local key="$1"
  local value="$2"
  local type="${3:-encrypted}"

  local payload
  payload=$(jq -n \
    --arg key "$key" \
    --arg value "$value" \
    --arg type "$type" \
    --argjson target "$TARGETS" \
    '{key: $key, value: $value, type: $type, target: $target}')

  local http_code
  http_code=$(curl -sS -o /tmp/vercel-env-response.json -w "%{http_code}" \
    -X POST "$API" \
    -H "Authorization: Bearer ${VERCEL_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$payload")

  if [[ "$http_code" != "200" && "$http_code" != "201" ]]; then
    echo "Failed to set ${key} (HTTP ${http_code}):" >&2
    cat /tmp/vercel-env-response.json >&2
    exit 1
  fi
  echo "  ✓ ${key}"
}

echo "Syncing env vars to Vercel project crm..."

upsert_env "NEXT_PUBLIC_SUPABASE_URL" "$NEXT_PUBLIC_SUPABASE_URL" "plain"
upsert_env "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" "$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" "plain"
upsert_env "NEXT_PUBLIC_APP_URL" "$NEXT_PUBLIC_APP_URL" "plain"
upsert_env "SUPABASE_SECRET_KEY" "$SUPABASE_SECRET_KEY" "encrypted"
upsert_env "POSTGRES_PRISMA_URL" "$POSTGRES_PRISMA_URL" "encrypted"
upsert_env "POSTGRES_URL_NON_POOLING" "$POSTGRES_URL_NON_POOLING" "encrypted"

if [[ "${REDEPLOY:-true}" == "true" ]]; then
  echo "Triggering production redeploy..."
  deploy_payload=$(jq -n \
    --arg name "crm" \
    --arg project "$VERCEL_PROJECT_ID" \
    --argjson repoId "$GITHUB_REPO_ID" \
    '{
      name: $name,
      project: $project,
      target: "production",
      gitSource: { type: "github", repoId: ($repoId | tonumber), ref: "main" }
    }')

  deploy_code=$(curl -sS -o /tmp/vercel-deploy-response.json -w "%{http_code}" \
    -X POST "https://api.vercel.com/v13/deployments?teamId=${VERCEL_TEAM_ID}" \
    -H "Authorization: Bearer ${VERCEL_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$deploy_payload")

  if [[ "$deploy_code" != "200" && "$deploy_code" != "201" ]]; then
    echo "Env vars synced, but redeploy failed (HTTP ${deploy_code}). Push a commit or redeploy in Vercel dashboard." >&2
    cat /tmp/vercel-deploy-response.json >&2
    exit 1
  fi

  deploy_url=$(jq -r '.url // .alias[0] // empty' /tmp/vercel-deploy-response.json)
  echo "  ✓ Redeploy started${deploy_url:+ → ${deploy_url}}"
fi

echo "Done."
