#!/usr/bin/env bash
# Review Board SANDBOX — an isolated copy of the stack for manual verification.
#
# Nothing here touches the shared database, the repo-root .env, the shared stack's containers or its ports:
#   Postgres (pgvector)  127.0.0.1:55440   container rb-sandbox-pg      database rb_sandbox
#   Redis                127.0.0.1:56440   container rb-sandbox-redis
#   Backend              http://localhost:2021   (run on the host, current source)
#   Frontend             http://localhost:2020   (run on the host, current source)
# The shared stack uses 1020/1021/6389. All sandbox credentials are fixed, public and worthless.
#
# Usage:   bash scripts/review-board-sandbox/sandbox.sh <command>
#   up        start Postgres + Redis, apply every migration, seed the data      (once)
#   backend   build and run the API on :2021        (leave running in its own terminal)
#   frontend  run the web app on :2020              (leave running in its own terminal)
#   plan pro|launch   switch the Pro workspace's plan (immediate; clears the sandbox Redis)
#   bulk truncate     add 70 identical cases: one analysis then finds 2,415 pairs and keeps 2,000 (truncated banner)
#   bulk over         push the repository past the 5,000-case limit: the next analysis FAILS with a clear message
#   status    show containers and ports
#   reset     throw everything away and start again from a fresh seed
#   down      remove the sandbox containers (and with them all sandbox data)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND="$ROOT/Tesbo-Backend-Nest"
FRONTEND="$ROOT/Tesbo-Frontend"
HERE="$ROOT/scripts/review-board-sandbox"

PG_NAME=rb-sandbox-pg
REDIS_NAME=rb-sandbox-redis
PG_PORT=55440
REDIS_PORT=56440
API_PORT=2021
WEB_PORT=2020
PG_DB=rb_sandbox
PG_PASSWORD=sandbox-only
DB_URL="postgresql://postgres:${PG_PASSWORD}@127.0.0.1:${PG_PORT}/${PG_DB}"

die() { echo "error: $*" >&2; exit 1; }

# A .env in the backend directory would be loaded by the app AND override these settings (see
# AppConfigService.loadEnv: parsed .env values win over process.env). Refuse rather than risk it.
guard_no_dotenv() {
  [ ! -f "$BACKEND/.env" ] || die "$BACKEND/.env exists and would override the sandbox settings. Move it away first."
}

# Anything in the caller's shell that points at real services must not reach the sandbox processes.
scrub_shell() {
  unset DATABASE_URL DATABASE_USER DATABASE_PASSWORD REDIS_URL MIGRATIONS_DIR
  unset POSTMARK_API_TOKEN POSTMARK_FROM_EMAIL S3_BUCKET S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY S3_ENDPOINT
  unset JIRA_CLIENT_ID JIRA_CLIENT_SECRET LINEAR_CLIENT_ID LINEAR_CLIENT_SECRET NOTION_CLIENT_ID NOTION_CLIENT_SECRET
  unset STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET STRIPE_PRICE_ID_PRO_MONTHLY STRIPE_PRICE_ID_PRO_ANNUAL
  unset LANGFUSE_PUBLIC_KEY LANGFUSE_SECRET_KEY LANGFUSE_HOST
  unset NEXT_PUBLIC_SENTRY_DSN NEXT_PUBLIC_POSTHOG_KEY NEXT_PUBLIC_POSTHOG_HOST NEXT_PUBLIC_BETTERBUGS_API_KEY NEXT_PUBLIC_BETTERBUGS_PROJECT_ID SENTRY_AUTH_TOKEN
}

export_backend_env() {
  scrub_shell
  export PORT="$API_PORT"
  export DATABASE_URL="$DB_URL"
  export DATABASE_USER=postgres
  export DATABASE_PASSWORD="$PG_PASSWORD"
  export REDIS_URL="redis://127.0.0.1:${REDIS_PORT}"
  export FRONTEND_URL="http://localhost:${WEB_PORT}"
  export CORS_ALLOWED_ORIGINS="http://localhost:${WEB_PORT},http://127.0.0.1:${WEB_PORT}"
  export EMAIL_DELIVERY_MODE=log                       # no email is ever sent; codes are printed to the backend log
  export STORAGE_DRIVER=local
  export UPLOAD_DIR="${TMPDIR:-/tmp}/rb-sandbox-uploads"
  # Throwaway AES key for the sandbox only (32 zero bytes, base64) — protects nothing real.
  export SECRETS_ENCRYPTION_KEY="$(head -c 32 /dev/zero | base64 | tr -d '\n')"
}

pg_psql() { docker exec -i "$PG_NAME" psql -U postgres -d "$PG_DB" -v ON_ERROR_STOP=1 -At "$@"; }

wait_for_postgres() {
  echo "==> waiting for Postgres"
  local ok=0
  for _ in $(seq 1 60); do
    if docker exec "$PG_NAME" pg_isready -U postgres -d "$PG_DB" >/dev/null 2>&1 && pg_psql -c "SELECT 1" >/dev/null 2>&1; then
      ok=$((ok + 1)); [ "$ok" -ge 2 ] && return 0   # the image restarts Postgres once after init; need it stable
    else
      ok=0
    fi
    sleep 2
  done
  die "Postgres did not become ready"
}

cmd_up() {
  command -v docker >/dev/null || die "docker is not available"
  guard_no_dotenv
  for c in "$PG_NAME" "$REDIS_NAME"; do
    if docker ps -a --format '{{.Names}}' | grep -qx "$c"; then die "$c already exists. Use 'reset' to start over, or 'status'."; fi
  done
  echo "==> starting Postgres (pgvector) on 127.0.0.1:${PG_PORT} and Redis on 127.0.0.1:${REDIS_PORT}"
  docker run -d --name "$PG_NAME" -e POSTGRES_PASSWORD="$PG_PASSWORD" -e POSTGRES_DB="$PG_DB" -p "127.0.0.1:${PG_PORT}:5432" pgvector/pgvector:pg16 >/dev/null
  docker run -d --name "$REDIS_NAME" -p "127.0.0.1:${REDIS_PORT}:6379" redis:7-alpine >/dev/null
  wait_for_postgres
  echo "==> applying all migrations to the sandbox database"
  ( cd "$BACKEND" && export_backend_env && npm run migrate:dev 2>&1 | tail -3 )
  cmd_seed
  cat <<EOF

Sandbox data is ready. Next, in two more terminals:
  bash scripts/review-board-sandbox/sandbox.sh backend
  bash scripts/review-board-sandbox/sandbox.sh frontend
Then open http://localhost:${WEB_PORT}/login   (accounts and password: run  sandbox.sh status)
EOF
}

cmd_seed() {
  echo "==> seeding"
  ( cd "$BACKEND" && SANDBOX_DATABASE_URL="$DB_URL" node "$HERE/seed.js" "$BACKEND" )
}

cmd_backend() {
  guard_no_dotenv
  docker ps --format '{{.Names}}' | grep -qx "$PG_NAME" || die "the sandbox database is not running. Run: sandbox.sh up"
  cd "$BACKEND"
  export_backend_env
  echo "==> building the API from the current source (writes to Tesbo-Backend-Nest/dist, which is git-ignored)"
  npm run build
  echo "==> API on http://localhost:${API_PORT}  (database: sandbox, port ${PG_PORT})"
  exec node dist/main.js
}

cmd_frontend() {
  [ -d "$FRONTEND/node_modules" ] || die "run 'npm install' in Tesbo-Frontend first"
  cd "$FRONTEND"
  scrub_shell
  export NEXT_PUBLIC_API_URL="http://localhost:${API_PORT}"
  echo "==> web app on http://localhost:${WEB_PORT}  (API: ${NEXT_PUBLIC_API_URL})"
  exec npx next dev --webpack -p "$WEB_PORT"
}

cmd_plan() {
  local plan="${1:-}"
  case "$plan" in pro|launch) ;; *) die "usage: sandbox.sh plan pro|launch" ;; esac
  pg_psql -c "UPDATE organizations SET plan = '$plan', plan_grace_ends_at = NULL WHERE slug = 'sandbox-pro-workspace'" >/dev/null
  docker exec "$REDIS_NAME" redis-cli FLUSHALL >/dev/null   # the API caches entitlements for ~45 s; this is the sandbox Redis only
  echo "Sandbox Pro workspace is now on the '$plan' plan (takes effect immediately)."
}

cmd_bulk() {
  local kind="${1:-}"
  local project
  project="$(pg_psql -c "SELECT id FROM projects WHERE key = 'SBX'")"
  [ -n "$project" ] || die "the sandbox is not seeded"
  case "$kind" in
    truncate)
      pg_psql -c "INSERT INTO testcases (project_id, external_id, title, preconditions, test_data, steps)
        SELECT '$project', 'DUP-' || g, 'Verify the bulk duplicate flow', 'The system is ready', 'mode=bulk',
               '[{\"action\":\"Open the bulk screen\",\"expectedResult\":\"The screen loads\"},{\"action\":\"Submit the form\",\"expectedResult\":\"A confirmation appears\"}]'::jsonb
        FROM generate_series(1, 70) g" >/dev/null
      echo "Added 70 identical test cases. Run 'Analyse again': expect 'only the most similar pairs are listed'." ;;
    over)
      pg_psql -c "INSERT INTO testcases (project_id, external_id, title, steps)
        SELECT '$project', 'OVER-' || g, 'Filler case number ' || g, '[]'::jsonb FROM generate_series(1, 5100) g" >/dev/null
      echo "Added 5,100 filler cases (over the 5,000 limit). Run 'Analyse again': expect a failed analysis with a clear message." ;;
    *) die "usage: sandbox.sh bulk truncate|over   (use 'reset' to get back to the normal data)" ;;
  esac
}

cmd_status() {
  docker ps -a --filter "name=rb-sandbox" --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
  cat <<EOF

Web   http://localhost:${WEB_PORT}      API   http://localhost:${API_PORT}
Password for every account: Sandbox!2026
  owner.pro@sandbox.test       owner of the PRO workspace   (full access)
  manager.pro@sandbox.test     manager in the PRO workspace (full access)
  qa.pro@sandbox.test          QA engineer in the PRO workspace (must be refused)
  owner.launch@sandbox.test    owner of a LAUNCH workspace  (must see the Pro prompt)
EOF
}

cmd_down() {
  docker rm -f "$PG_NAME" "$REDIS_NAME" >/dev/null 2>&1 || true
  echo "Sandbox containers removed."
}

case "${1:-}" in
  up) cmd_up ;;
  seed) cmd_seed ;;
  backend) cmd_backend ;;
  frontend) cmd_frontend ;;
  plan) cmd_plan "${2:-}" ;;
  bulk) cmd_bulk "${2:-}" ;;
  status) cmd_status ;;
  reset) cmd_down; cmd_up ;;
  down) cmd_down ;;
  *) sed -n 2,24p "${BASH_SOURCE[0]}"; exit 2 ;;
esac
