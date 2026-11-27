# Tesbo Test Manager Deployment Guide

This guide describes the deployment artifacts and environment settings in this repository.
Confirm the actual deployment provider, service, connected repository and branch before using them
for a release. The presence of a template does not establish how the live application is deployed.

## DigitalOcean templates

| Component | Target | Port |
|-----------|--------|------|
| Frontend | Droplet with Nginx + Docker Compose | 443 -> Nginx -> 127.0.0.1:3000 |
| Backend | Droplet with Nginx + Docker Compose | 443 -> Nginx -> 127.0.0.1:7000 |
| PostgreSQL | Managed database or self-hosted PostgreSQL | 5432 |

The DigitalOcean Compose templates reference images in DigitalOcean Container Registry (DOCR).
These settings describe a possible target, not a verified live registry or installation.

The templates bind application containers to localhost behind Nginx. The repository includes
`deploy/nginx/setup-ssl.sh` for Nginx and Certbot setup; an operator must supply and verify the
deployment integration that invokes it.

## Available deployment artifacts

- Root `docker-compose.yml` builds the local/OSS stack from source and orders the backend after
  its migration service. It is separate from the DigitalOcean registry-image templates.
- `deploy/Tesbo-Frontend/docker-compose.yml` and `deploy/Tesbo-Backend/docker-compose.yml`
  are DigitalOcean deployment templates.
- `Jenkinsfile` and `Jenkinsfile.stage` are inherited pipeline definitions that reference
  `QAbleHQ/Tesbo-Test-Manager-Private` and its branches. Their presence does not establish an
  installed pipeline for `1alextest/Tesbooboo`; review their repository, branch and environment
  bindings before considering them for a deployment.

There is no `.github/workflows/deploy.yml` in this repository. The previously documented
**Deploy Tesbo Test Manager to DigitalOcean** Actions trigger is unavailable. No deployment
workflow is installed by this guide.

## DigitalOcean configuration

A deployment integration for the DigitalOcean templates needs the following configuration.
Store credentials in that integration's secret store; this repository does not provide the
previously described Actions workflow to consume GitHub secrets.

| Secret | Description |
|--------|-------------|
| `DO_API_TOKEN` | DigitalOcean API token |
| `DOCR_REGISTRY` | e.g. `registry.digitalocean.com/your-registry` |
| `DOCR_REPO_FRONTEND` | Frontend image repo name |
| `DOCR_REPO_BACKEND` | Backend image repo name |
| `DROPLET_FRONTEND_IP` | Frontend droplet IP |
| `DROPLET_BACKEND_IP` | Backend droplet IP |
| `SSH_PRIVATE_KEY` | SSH key for droplet access |
| `NEXT_PUBLIC_API_URL` | Public backend URL, e.g. `https://api.example.com` |
| `FRONTEND_DOMAIN` | Frontend domain |
| `BACKEND_DOMAIN` | Backend domain |
| `CERTBOT_EMAIL` | Email for Let's Encrypt certificate notifications |

Backend runtime secrets:

- `DATABASE_URL`, `DATABASE_USER`, `DATABASE_PASSWORD`
- `CORS_ALLOWED_ORIGINS`
- `FRONTEND_URL`, `SESSION_DAYS`
- `POSTMARK_API_TOKEN`, `POSTMARK_FROM_EMAIL`
- `JIRA_CLIENT_ID`, `JIRA_CLIENT_SECRET`, `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET` — platform OAuth apps (see [Jira / Linear OAuth](#jira--linear-oauth) below)
- `JIRA_REDIRECT_URI`, `LINEAR_REDIRECT_URI` — optional; default to `FRONTEND_URL` + `/integrations/callback`
- `UPLOAD_DIR`, `MAX_UPLOAD_SIZE`
- `STORAGE_DRIVER`, `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`, `S3_PRESIGNED_URL_TTL_SECONDS` (see [Knowledge Base File Storage](#knowledge-base-file-storage) below)

## Jira / Linear OAuth

Register **one** OAuth app per provider for the whole deployment, put its credentials in the backend
env, and every workspace owner connects by clicking **Connect** — they never see or enter a client
id, client secret, or callback URL.

**Jira** — in the [Atlassian Developer Console](https://developer.atlassian.com/console/myapps/):

1. Create an app and add the **OAuth 2.0 (3LO)** authorization type.
2. Set the callback URL to `FRONTEND_URL` + `/integrations/callback`
   (e.g. `https://app.example.com/integrations/callback`).
3. Under Permissions → Jira API, add the scopes
   `read:jira-work`, `read:jira-user`, `write:jira-work`, `offline_access`.
4. Copy the Client ID and Secret into `JIRA_CLIENT_ID` / `JIRA_CLIENT_SECRET`.

**Linear** — Settings → API → OAuth applications: same callback URL, then
`LINEAR_CLIENT_ID` / `LINEAR_CLIENT_SECRET`.

Notes:

- **This is the only way to configure it.** There is no per-workspace OAuth app and no personal
  access token option — if the client id/secret aren't set, the Integrations page tells the workspace
  owner to ask whoever runs the instance, and Connect stays unavailable. Self-hosted installs use the
  exact same flow with their own app's credentials.
- `*_REDIRECT_URI` only needs setting when the callback must differ from `FRONTEND_URL` — for
  example a proxy that terminates on another host. Whatever value is used must match the provider
  console exactly.
- `SECRETS_ENCRYPTION_KEY` must be set: it encrypts the OAuth tokens at rest and derives the key
  that signs the OAuth `state`. Rotating it invalidates stored tokens, so workspaces must reconnect.
- **Jira Server / Data Center is not supported** — cloud OAuth via `auth.atlassian.com` requires a
  Jira Cloud site. Only `*.atlassian.net`-style cloud instances can be connected.

## Knowledge Base File Storage

Files uploaded to the project Knowledge Base are stored via a pluggable backend, controlled by `STORAGE_DRIVER`:

| `STORAGE_DRIVER` | Behavior |
|---|---|
| `local` (default) | Files are saved to disk under `UPLOAD_DIR` (`/app/uploads` in the container, mounted to a volume in both `docker-compose.yml` and `deploy/Tesbo-Backend/docker-compose.yml`). No further setup needed — this is fine for a single backend instance. |
| `s3` | Files are stored in an S3-compatible bucket instead. Works with real AWS S3 as well as DigitalOcean Spaces, MinIO, Cloudflare R2, Backblaze B2, or anything else that speaks the S3 API. |

To enable S3-compatible storage, set:

- `STORAGE_DRIVER=s3`
- `S3_BUCKET` — the bucket name (required)
- `S3_REGION` — defaults to `us-east-1`; some providers ignore this but the SDK still requires a value
- `S3_ENDPOINT` — only needed for non-AWS providers (e.g. `https://nyc3.digitaloceanspaces.com` for DO Spaces, or your MinIO URL). Leave blank for real AWS S3.
- `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` — leave both blank to fall back to the default AWS credential chain (IAM role, instance profile, shared config) instead of static keys
- `S3_FORCE_PATH_STYLE=true` — required by MinIO and some other S3-compatible services; leave `false` for AWS S3 and most others
- `S3_PRESIGNED_URL_TTL_SECONDS` — how long a generated download/preview link stays valid (default `300`)

Files are stored under a per-project key prefix (`knowledge-base/<projectId>/...`), and are never served as public/durable links — every download or preview request is checked against the requesting user's project membership and role first, and only then is a short-lived presigned URL issued (or, in local mode, the file is streamed directly). Switching `STORAGE_DRIVER` does not migrate files already stored under the previous driver.

## Compose migrator runtime

The backend production image intentionally removes npm and npx. Root Compose runs migrations
with the installed Node runtime: `node dist/database/migrate.js`, the same compiled owner used
by the package's `migrate` script. Backend startup still requires the migration service to
complete successfully. A missing `DATABASE_URL` fails before a database connection is attempted;
the migrator never defaults to a local database.

The existing `container-security` CI job builds that image, checks npm/npx remain absent, and
executes the actual Compose migrator command in a read-only container with networking disabled,
blank database settings and no host mounts. It must reach the exact missing-database refusal.
This checks runtime command compatibility; it does not run SQL migrations or prove successful
deployment, database compatibility or rollback. The existing vulnerability scan follows it.

## Release evidence

Before deploying, identify the actual provider/service and its source branch, the exact commit
and image being released, and the target database's migration ledger and recovery point. Run
deployment and migration verification only in the explicitly selected environment. Passing
repository CI alone does not establish the state of a live installation.

The migrator commits each migration separately. A later failure rolls back that migration, not
earlier committed migrations. An application-image or traffic rollback therefore does not by
itself restore the database; compatibility and database recovery need their own evidence.

## Droplet Prep

For a selected DigitalOcean droplet target, run once per droplet:

```bash
curl -fsSL https://get.docker.com | sh
```

Open firewall ports: `22`, `80`, `443`.

## DNS Setup

Point each domain to the corresponding droplet IP as a plain A record.

| Record | Type | Value | Proxy |
|--------|------|-------|-------|
| `app.example.com` | A | `<FRONTEND_IP>` | DNS only |
| `api.example.com` | A | `<BACKEND_IP>` | DNS only |

## Verification

- Backend `/health` and `/api/health` report process health and build provenance. They do not query
  the database or certify schema compatibility; verify migrations and database-dependent behavior
  separately for the selected deployment.
- Frontend: `https://app.example.com/`
- Backend health: `https://api.example.com/health` — `gitSha` must be the deployed commit, not `local`. The value is resolved from `RAILWAY_GIT_COMMIT_SHA` first (a Railway deployment triggered from GitHub; it describes the running deployment) and falls back to `GIT_SHA` (Jenkins/compose, or a `railway up` upload where the operator sets it), then `local`; see `Tesbo-Backend-Nest/src/build-provenance.ts`. A service-level `GIT_SHA` persists across Railway deploys, so it must never outrank the injected Railway value.
- Railway deployments: the backend service redeploys from its connected GitHub branch whenever a service variable changes or someone presses Redeploy. A `railway up` upload is superseded by that next GitHub-triggered deployment, even though the upload may have been the newer code. Deploy from the connected branch when possible; when an upload is the only option, set `GIT_SHA` to the uploaded commit and do not change variables until the connected branch catches up.
- MCP catalog and field contracts, from a fresh protocol session: use a private credential file and its separately approved sibling `tesbo-approved-origin` file. Follow the [verification skill's origin setup](../.claude/skills/mcp-production-verify/SKILL.md#local-approved-origin-security-precondition); never derive approval from the URL supplied to the probe. The wrapper passes the file path, and the checker reads the bearer only after origin and build checks.

  ```bash
  TESBO_MCP_URL="https://api.example.com/api/projects/<projectId>/mcp" \
  TESBO_MCP_TOKEN_FILE="$HOME/.config/opencode/secrets/tesbo.token" \
  EXPECTED_GIT_SHA="<full 40-character deployed commit>" \
  scripts/verify-production-mcp.sh
  ```

  It refuses an unapproved origin, a missing or unidentified expected build, or a health/build mismatch before any authenticated request. Missing required tools or authoring fields fail verification. When proposal preview is exposed, the checked `stage_testcase_changes` create/update fields include `attachments`, `postconditions`, `estimatedDuration` and `sourceRefs`, with a required request key and update `expectedRevision`.

  It also recomputes the catalog fingerprint from the tools and initialize instructions the server actually returned. Missing instructions, a missing/malformed reported fingerprint, or a mismatch fails verification; an unavailable comparison cannot produce `OK`. A mismatch means the observed catalog differs from the one the server claims. Tool count is informational: capabilities, not the number, are the requirement.

## Connecting ChatGPT to the existing MCP OAuth server

The merged embedded `McpOAuthServer` is disabled by default and currently grants only
`mcp:read`. A working API token, the API & MCP page's bearer-token connection check, and
a healthy MCP catalog do not establish OAuth readiness. Keep the existing API-token clients
and human-only publication/approval rules unchanged.

Choose and verify one canonical public API origin before configuring the client. The documented
split-host topology uses the backend's public HTTPS origin. The copied project MCP URL,
`NEXT_PUBLIC_API_URL`, `TESBO_MCP_OAUTH_RESOURCE_ORIGIN` and the issuer must agree with that choice;
the issuer is that same origin plus `/oauth`. `FRONTEND_URL` remains the web login origin.
`NEXT_PUBLIC_API_URL` is a frontend build-time setting, so changing a service variable without
rebuilding the frontend does not update the copied URL or login continuation.

The web app's existing `/api` rewrite alone does **not** expose root `/.well-known` or `/oauth`
routes. If the web origin is selected instead, an operator must review and verify the complete
proxy topology: path-aware protected-resource metadata, both issuer discovery forms, issuer
endpoints, interaction requests, cookies, redirects and forwarded headers. Preserve host-only
cookies and the configured issuer/resource checks. Do not mix origins, add a broad catch-all
proxy, or change the canonical token audience merely to make a metadata request succeed.

Before an authorized activation, verify the exact backend/frontend builds, migrated OAuth
tables, stable operator-managed asymmetric `TESBO_MCP_OAUTH_PRIVATE_JWKS`, distinct
`TESBO_MCP_OAUTH_COOKIE_KEYS_JSON`, and the existing encryption key. Use the already implemented
reviewed `TESBO_MCP_OAUTH_REGISTERED_CLIENTS` or separately approved bounded
`TESBO_MCP_OAUTH_CIMD_ENABLED` mechanism. Obtain the real client identity and callback from the
client setup; do not guess them or put secrets in source, commands, chat or evidence.

`TESBO_MCP_OAUTH_DISCOVERY_PREVIEW=true` exposes metadata only. It does not mount the issuer.
`TESBO_MCP_OAUTH_ENABLED=true` requires the complete provider configuration and is a separately
authorized production access change. A named project OAuth-client preapproval and the user's
own consent remain separate requirements. Key custody/rotation, refresh policy, client
compatibility, deployment and rollback retain their existing release decisions.

Verify the public discovery chain using the existing checker in its **unauthenticated** mode:

```bash
TESBO_MCP_OAUTH_READINESS=1 \
TESBO_MCP_URL="https://<approved-api-origin>/api/projects/<projectId>/mcp" \
EXPECTED_GIT_SHA="<exact 40-character deployed backend commit>" \
node scripts/mcp-deploy-check.mjs
```

This mode needs no token file and never registers a client, logs in, consents, requests a token
or invokes a tool. It verifies exact-build health, JSON protected-resource metadata, the same-origin
read-only issuer/PKCE contract, valid public signing keys and the exact unauthenticated **POST**
challenge. Redirects, HTML, oversized metadata, foreign endpoints, private key fields and preview-only
issuers fail. `clientAuthorization: "not_verified"` remains explicit even on success. An expected
404 on an OAuth-off deployment is a failed readiness check, not permission to enable the provider.

After readiness succeeds, complete the authorized ChatGPT setup in the user's own browser,
review the actual requested scopes, exercise a permitted project read and verify revocation.
Retain the actual client protocol and source/build receipts. Metadata alone does not prove
interoperability or refresh behavior. Read-only OAuth does not enable case-staging writes;
that capability needs its separately reviewed machine-write scope and producer contract.
