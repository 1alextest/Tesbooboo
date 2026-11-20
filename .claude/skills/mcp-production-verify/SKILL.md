---
name: mcp-production-verify
description: Verify a deployed Tesbo MCP endpoint (gitSha, catalog fingerprint, required tools and schemas) with the credential handled safely and the human-only consent step called out. Use after a release, after changing MCP tools, or when a client reports a tool as missing or stale in production.
---

# Verify a deployed Tesbo MCP endpoint

This exists because `/api/health`, tool counts and a client's cached catalog can all look plausible
against a stale or half-configured deployment. The check is only trustworthy when it runs against a
fresh protocol session, compares the reported build with the commit that should be live, and
recomputes the catalog fingerprint from the tools actually returned.

Run the procedure in order. Do not skip the human checkpoint, and do not "help" by enabling project
consent or approving a credential yourself.

## Non-negotiables

- **The consent step belongs to a human.** External MCP access starts off; credentials must be
  approved by a project owner/manager in the product UI. Never call the consent endpoint with an
  agent session, never reuse an admin/privilege bypass, and never ask another session to do it.
- **The token never enters argv, chat, logs or a file you write.** It is read by the wrapper from a
  file and exported only to the checker. Do not paste it into a command, a tool call body, or an
  evidence file.
- **Verify the endpoint you mean.** The MCP URL carries the project id; confirm host and project id
  match the deployment being checked (the frontend proxy may point at a differently-named host than
  the one in an old note). Only the host is printed, never the token.
- **Pin the expected commit.** `EXPECTED_GIT_SHA` must be the commit that should be running. Default
  is `origin/development`; pass `VERIFY_BRANCH` for a release check, and never accept `local`.
- **A tool-count mismatch is a warning, not the requirement.** Scopes and named-client grants filter
  the catalog. Missing required names/schemas, fingerprint mismatch, or a gitSha mismatch fail.
- **State what was not proven.** This checks discovery, schemas, provenance and the negative consent
  path. It does not execute a test run, call write tools, or prove business behaviour.

## Inputs

| Input | Source |
|---|---|
| `TESBO_MCP_URL` | `https://<backend-host>/api/projects/<projectId>/mcp` |
| Token file | `TESBO_MCP_TOKEN_FILE`, default `~/.config/opencode/secrets/tesbo.token` |
| Expected commit | `EXPECTED_GIT_SHA`, else resolved from `VERIFY_BRANCH` (default `development`) |

## Procedure

1. **Establish the expected build.**
   ```bash
   git fetch origin development --quiet && git rev-parse origin/development
   ```
   For a release check use the promoted commit, not the branch tip.

2. **Confirm the deployment reports it.** `GET <origin>/api/health` → `status: "ok"` and
   `gitSha` equal to the expected commit. A different SHA means a stale service or the wrong
   service/host — stop and resolve that before judging the catalog.

3. **Human checkpoint — approve the credential (only if the negative probe below says consent is
   missing).** Send the user this exact runbook and wait:
   - Open `<frontend>/projects/<projectId>/settings/api-tokens`.
   - In **External AI & MCP Access**, press **Enable external MCP** when it is off.
   - Under **Approve a named client**, select the token the verification file holds, give it a
     recognisable name (e.g. `Production verification`), enable **Allow write tools** only if that
     token already has write scope, and press **Approve client**.
   - Say when done. Do not create a new token unless the user asks; if they do, have them update
     the token file themselves.

4. **Negative probe (before approval).** An unapproved credential must be refused, not served an
   empty catalog:
   ```bash
   TESBO_MCP_URL="https://<backend-host>/api/projects/<projectId>/mcp" node scripts/mcp-consent-probe.mjs
   ```
   It prints only `{status, code, message}` (or the tool count if a catalog was served); the
   credential never reaches stdout or argv.
   Expect HTTP 201 with JSON-RPC `-32001` "External MCP access requires an enabled project and a
   current approved client credential". Success here means the gate is live; a served catalog means
   consent was already granted (fine) or the gate regressed (fail loudly).

5. **Run the checker.**
   ```bash
   TESBO_MCP_URL="https://<backend-host>/api/projects/<projectId>/mcp" \
   VERIFY_BRANCH=development \
     scripts/verify-production-mcp.sh
   ```
   It prints the host, expected SHA and credential source, then delegates to
   `scripts/mcp-deploy-check.mjs`, which verifies:
   - health `gitSha` equals the expected commit;
   - required tool names are discoverable and their input schemas are present and closed
     (`additionalProperties: false` where required);
   - the catalog fingerprint recomputed from the returned tools equals the one the server reported
     at initialize;
   - proposal-review tools stay absent unless `REQUIRE_PROPOSAL_PREVIEW=1` is deliberately set.

6. **Read the result, not just the exit code.** Successful output must show `health: <expected sha>`
   and a fingerprint that is not `unavailable`. Required tools list is authoritative; the count line
   is informational.

7. **Record an evidence line (no secrets).** Example:
   `MCP production verified 2026-11-20: host <host>, gitSha <sha>, fingerprint <fp>, <n> tools, exit 0.`
   Do not commit raw checker output containing URLs of private projects unless the user asks.

## Failure taxonomy

| Symptom | Meaning | Action |
|---|---|---|
| `-32001 … approved client credential` | Consent off, or this token not approved | Human checkpoint step 3 |
| `health gitSha … does not match` | Stale deployment or wrong host | Confirm service/branch; wait for redeploy or redeploy deliberately |
| `health did not report gitSha` / `gitSha=local` | Build provenance missing | Treat as unverifiable; fix deployment env (`RAILWAY_GIT_COMMIT_SHA` first) |
| `missing tool: <name>` | Catalog older than the code, or a grant filters it | Check deploy SHA and the credential's scopes/grant allowlist |
| `schema` errors | Tool ships without the required input contract | Product defect; fix the tool schema, not the check |
| fingerprint mismatch | Proxy/stale catalog or inconsistent server | Investigate the proxy path and the deployed build |
| count warning only | Scopes/grants narrowed the catalog | Confirm the expected scopes; not a failure by itself |

## Done means

- [ ] `/api/health` gitSha equals the intended commit, with the host named in the report.
- [ ] Checker exited 0 against a fresh session.
- [ ] Negative consent probe behaved fail-closed (or consent was knowingly already on).
- [ ] Report states host, SHA, fingerprint and tool count, and says what was not proven.
