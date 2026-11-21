#!/usr/bin/env bash
#
# Post-deploy MCP verification with the credential kept out of argv and out of the output.
#
# Everything this runs lives in scripts/mcp-deploy-check.mjs (health gitSha, catalog fingerprint,
# required tool names and schemas, proposal-preview gating). This wrapper only supplies the inputs
# safely and refuses to guess:
#
#   TESBO_MCP_URL        required — the exact project endpoint, e.g.
#                        https://<backend-host>/api/projects/<projectId>/mcp
#   TESBO_MCP_TOKEN_FILE optional — defaults to ~/.config/opencode/secrets/tesbo.token
#   EXPECTED_GIT_SHA     optional — the commit that should be running; when unset it is resolved
#                        from VERIFY_BRANCH (default: development) via git fetch
#
# Exit codes: 2 = missing/invalid input, otherwise the checker's own status (1 = failed requirement).
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

if [[ -z "${TESBO_MCP_URL:-}" ]]; then
  echo "verify-production-mcp: set TESBO_MCP_URL to the project MCP endpoint." >&2
  exit 2
fi

token_file="${TESBO_MCP_TOKEN_FILE:-$HOME/.config/opencode/secrets/tesbo.token}"
if [[ ! -s "$token_file" ]]; then
  echo "verify-production-mcp: token file missing or empty: $token_file" >&2
  echo "verify-production-mcp: a human must approve the credential for the project first (see the mcp-production-verify skill)." >&2
  exit 2
fi

# Bind the private credential to a separately approved origin before the first
# authenticated request. The origin file lives next to the token and is never
# inferred from the caller-provided MCP URL.
MCP_TOKEN_FILE="$token_file" node --input-type=module -e '
  import { requireApprovedMcpEndpoint } from "./scripts/mcp-approved-origin.mjs";
  try {
    requireApprovedMcpEndpoint(process.env.TESBO_MCP_URL, process.env.MCP_TOKEN_FILE);
  } catch (error) {
    console.error("verify-production-mcp: " + (error instanceof Error ? error.message : "unapproved MCP origin"));
    process.exit(2);
  }
'

if [[ -z "${EXPECTED_GIT_SHA:-}" ]]; then
  branch="${VERIFY_BRANCH:-development}"
  git fetch origin "$branch" --quiet
  EXPECTED_GIT_SHA="$(git rev-parse "origin/$branch")"
fi

# Only the host and the expected commit are printed. The checker reads the
# validated private credential file itself; this wrapper never reads the bearer.
host="$(node -e 'process.stdout.write(new URL(process.env.TESBO_MCP_URL).host)')"
echo "verify-production-mcp: endpoint host ${host}"
echo "verify-production-mcp: expected gitSha ${EXPECTED_GIT_SHA}"
echo "verify-production-mcp: credential source ${token_file}"

unset TESBO_MCP_TOKEN
TESBO_MCP_TOKEN_FILE="$token_file" \
EXPECTED_GIT_SHA="$EXPECTED_GIT_SHA" \
  exec node scripts/mcp-deploy-check.mjs
