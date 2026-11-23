# MCP OAuth connection — source-grounded enhancement specification

**Status:** DRAFT / not approved / not implemented. **Source snapshot:** `development@561ae3054fb69665534685f8f3d9481681225073`, 2026-11-23. **Purpose:** enable a user to connect ChatGPT and other conforming remote MCP clients to their chosen Tesbo project via a secure OAuth authorization flow, while preserving existing API-token clients, project permissions, governed publication and immutable QA evidence. This is an extension of the existing API & MCP surface, not a new integrations product or shadow MCP server.

**Authority:** current existing API-token/MCP services and their owner-reviewed policies control deployed behavior; this document proposes changes and does not amend ASER's eight canonical specifications by itself. Any incompatible change to canonical policy requires a separate governed review. No active OAuth provider, actual ChatGPT handshake, connected Tesbo MCP in this session, or native Tesbo QA execution is claimed.

## 1. Outcome, boundaries and observed reuse

Desired user journey: select **Connect Tesbo** from a supported client, authenticate using existing Tesbo login, select the accessible project (e.g., existing TESBOPROJECT), inspect client identity/tool permissions and consent, return to the client, and use only authorized MCP tools. Users can later see and revoke that specific connection without revoking unrelated credentials. Project and tool access remain subject to live membership, policy, plan locks, Skills governance and human-only approval.

| Existing source owner (inspected at pinned commit) | What already exists; mandatory reuse | Gap to implement |
| --- | --- | --- |
| `Tesbo-Backend-Nest/src/mcp/mcp.controller.ts` | `POST /api/mcp` and `POST /api/projects/:projectId/mcp`, existing JSON-RPC and catalog/session protocol; API bearer token is currently mandatory | OAuth bearer principal selection, compliant auth challenges and well-known discovery, without duplicating MCP transport or tool registry |
| `Tesbo-Backend-Nest/src/mcp/mcp.service.ts` | Project identity, named-client consent, allowed-tools, live rechecks, tool visibility, plan lock, agent provenance and tool dispatch | Accept a normalized, evidence-backed OAuth principal with the **same** domain authorization pipeline; never treat OAuth scopes as override grants |
| `Tesbo-Backend-Nest/src/mcp/mcp-access.ts` | `externalMcpAccess` settings, revision, `McpClientGrant` (tokenId, clientName, read/write scopes, allowedTools, expiry), fail-closed defaults and update validation | Preserve same project consent and policy owner; extend credential association to OAuth grant identity without fake API-token IDs; compatibility migration/dual-read plan |
| `Tesbo-Backend-Nest/src/common/request.types.ts` | Typed `ApiTokenContext` and `AuthenticatedRequest`; machine/auth domain identity distinguished from human session | Discriminated machine principal, preserving authenticated human and project identities and all refusal checks |
| `Tesbo-Frontend/app/(app)/projects/[id]/settings/api-tokens/page.tsx`, `ExternalMcpAccessPanel.tsx`, `lib/api.ts` | Token issuance/revocation, read-only defaults, one-time reveal, copied MCP URLs/config, named clients and role-aware access | Add one connected-client/consent section and Connect-with-Tesbo guidance; retain existing clients and secrets UX |
| `e2e/api/requirements.spec.ts`, `src/mcp/mcp-publication.spec.ts`, `docs/reviews/API-MCP-HUMAN-OUTCOME-ACCEPTANCE-2026-11-21.md` | Protected apply / cannot self-approve, scope/consent and user-outcome test designs | New OAuth acceptance and negative tests, using the existing suite/test-case and report owners |
| Existing `legacy.service.ts` provider integration OAuth flows | Reusable login/session, existing secret-handling, outbound provider OAuth patterns where genuinely applicable | **Not** an inbound MCP authorization server: do not reuse provider refresh tokens, callback bindings or external provider identity as MCP-client authorization |

**Known API token behavior:** the API & MCP page generates a project-scoped URL and sends `Authorization: Bearer <YOUR_API_TOKEN>`; OpenCode configuration declares `oauth: false`. The original bearer clients must continue functioning. A reported OAuth login for Jira/other outbound integrations is **not** evidence of inbound MCP OAuth implementation.

## 2. Architectural decision and reuse gate

The MCP endpoint acts as an **OAuth protected resource**. An authorization server performs user login/consent, client validation and token issuance. Prefer extending Tesbo's existing login/session and organization/project authorization surface with a narrowly scoped OAuth authorization-server adapter **only after source archaeology has proved that the platform has no reusable standards-compliant inbound AS or deployable existing identity provider**. Otherwise integrate an established AS/IdP and keep Tesbo solely the resource server. Do not copy outbound-integration OAuth handlers into a second credential issuer. Resolve and document ownership of client registration, secret storage, token lifetime, keys, schema and rotation before coding.

No second MCP server, no parallel project client-grant system, no separate human approval authority, no direct test-case writes disguised as user approval, and no automatic cross-project grant. A single policy evaluation must combine OAuth credential/identity validity, selected resource, project-specific named consent, user membership/role, tool allowlist, scope, live project state and existing publication controls.

**Principal resolution:** machine bearer credential resolves to an explicit kind (`api_token` or `oauth_access`), stable credential/grant ID, user ID, project ID, client ID, authorized scopes, expiry, authorization/consent revision, audience/resource, and verified issuer. It must not populate `req.apiToken` with invented `tokenId`; adapt the existing dispatcher to an authenticated machine-principal abstraction. Only the credential authenticator knows the token type; domain handlers cannot privilege one client class.

## 3. Protocol and compatibility contracts

- Publish RFC 9728 OAuth Protected Resource Metadata for each supported MCP resource URL (including path-aware metadata where required) and RFC 8414 authorization-server metadata at the selected authoritative issuer. Resource IDs and issuer must be exact stable HTTPS identifiers; correct proxy-aware external origin, host and forwarded-header trust are mandatory.
- Unauthenticated `POST /api/mcp` and project MCP calls respond with an appropriate HTTP 401 `WWW-Authenticate: Bearer` challenge identifying the resource metadata; insufficient valid scope yields HTTP 403 with a standards-compatible scope challenge. No browser-session authorization substitutes for an MCP bearer token. Avoid redirects that forward bearer credentials.
- Authorization Code with **PKCE S256** for public clients; require CSRF `state`, short-lived single-use code, exact verified redirect URI, issuer binding (RFC 9207), resource binding (RFC 8707), strict client and scope validation, and proof of active Tesbo user login. No implicit grant or password-grant fallback.
- Prefer Client ID Metadata Documents (CIMD) when supported by the deployed client/spec; support client registration via explicit trusted metadata/pre-registration or bounded Dynamic Client Registration fallback only where required by a verified target client. DCR must not accept arbitrary privileged client capabilities or unvalidated redirects. Verify actual ChatGPT client behavior in a live contract test instead of assuming a specific scheme.
- Access tokens must be signed-and-audience-verified or opaque-and-introspected via trusted issuer; short-lived, revocable, and not reusable as Tesbo REST browser/session tokens. Refresh-token rotation/reuse detection, encrypted-at-rest secrets, logout/revoke semantics, issuer/key rotation, skew handling, rate limits, storage retention, and replay prevention require explicit testable policy. Prefer reusing existing credential/secret/storage infrastructure.
- Preserve the already supported API-token MCP path and both endpoints; no forced user migration. The resource-specific endpoint must bind its URL project to the token grant; the dynamic endpoint resolves exactly one authorized project from the credential or fails closed if ambiguous. OAuth token issued for Project A must not call Project B even when the user belongs to both.
- Review current MCP protocol version compatibility **independently** of OAuth: source currently uses `initialize` and `Mcp-Session-Id`; newer MCP revisions changed these. Avoid silently rewriting transport/session behavior in the authorization PR; create a version-negotiated compatibility decision and separate tests for currently deployed clients and ChatGPT.

References for standards validation: MCP Authorization spec and TypeScript SDK authorization guidance, OAuth RFC 9728/8414/7636/8707/9207/6750, and the MCP 2026-07-28 revision notice. Record exact spec date/version and live consumer behavior during implementation, rather than coding only against an undated blog example.

## 4. Consent, policy and human outcomes

**Connect:** user sees verified client name, identity, verified redirect origin, exact Tesbo workspace/project, read scope (default), optional write scope (separate explicit opt-in), allowed tool classes, grant expiry, material effects and revocation location. Consent is not inferred from logging in. Owner/manager authorization and existing per-project MCP access controls remain effective; decide whether ordinary project members may request read-only grants subject to owner policy. Consent requests that exceed the user's/project's effective permission must fail, not silently expand privilege.

**Status:** existing API & MCP page shows active/revoked/expired OAuth connections beside (not replacing) named API-token clients, readable owner/actor, last access, scopes/tools, project, creation/expiry, policy revision, and a clear **Disconnect** action. Human outcomes: know what is connected, what it can do, which project it can reach, when it last acted and how to revoke it. Do not expose token values, refresh tokens or full request bodies.

**Write and approvals:** a write-scoped grant may perform only tools that the existing MCP path allows for machine callers and only within assigned scopes/allowlists. Native human-only approval, Skill version assignment/activation, protected selected apply, release approval and published test-run results retain their separate true-human authority. No user-session proxy, OAuth consent, or high scope silently transforms a machine agent into a human approver.

**Disconnect:** revoke grant and related refresh sessions so future MCP requests stop; preserve required immutable audit and previously accepted test cases/runs. If a refresh, scope reduction, project lock, membership removal, consent disablement or Skill assignment change races with an in-flight tool call, check at the same transaction/lock boundary as existing domain writes and leave rejected operations unchanged.

## 5. Proposed bounded schema/owner changes

Extend the **existing** API-token/MCP consent/policy and session persistence owners rather than creating separate auth policy tables for each client. Store OAuth client metadata/registration trust, authorization code hash and one-use state, grant/consent identity and revision, token/refresh family hashes or signing identifiers, project/user/client binding, scope/tool restrictions, revocation/expiry, and auditable provenance. Choose a minimal migration plan only after inventorying current tables and service methods. No production schema shape is approved by this design note. Do not backfill consent or grant OAuth access to preexisting tokens.

Read-only and OAuth metadata can deploy first behind disabled-by-default feature configuration; issuance and credential acceptance activate only after exact CI and owner-authorized staging verification. Fail closed on missing issuer/signing configuration. Feature-off leaves all existing API-token responses, authorization and tooling unchanged.

## 6. Implementation slices / prerequisites

| Slice | Deliverable | Gate |
| --- | --- | --- |
| 0 — archaeology and decisions | Inventory existing inbound/outbound OAuth, middleware, token DB/migration, roles, reverse-proxy deployments, client behavior and current MCP spec; select AS owner and registration model | Blue/Red/Security review; no code before owner decisions with material consequences |
| 1 — discovery & principal | Feature-gated RFC metadata, challenges, OAuth principal verification to existing MCP policy, backwards-compatible bearer API token tests | No write token issuance yet, exact audience/project/issuer rejects |
| 2 — login/consent & lifecycle | Existing Tesbo human login, project picker, explicit scopes, code/PKCE, token/refresh, disconnect, audit, frontend settings | Human review of scope/role and issuer policies; replay, CSRF, metadata and redirect adversarial suite |
| 3 — client E2E | Actual ChatGPT and another supported MCP client: connect, consent, list authorized tools, read Tesbo project, authorized stage, revoke, refresh, reconnect, fail closed | Real deployed service/callback; authenticated screenshot/network traces redacted; no fictitious success |
| 4 — persistent Tesbo regression | Reuse TESBOPROJECT, search native suites/cases, stage and link revised/new OAuth regressions to requirement version and criteria, request human publication, run and retain per-build attempts | Actual native case IDs, immutable runs and evidence; do not count CI alone as Tesbo execution |

## 7. Minimum acceptance matrix: source + live browser/API/MCP

| ID | Test obligation; explicitly test both success and denial | Evidence |
| --- | --- | --- |
| OAUTH-01 | Existing API bearer tokens still connect; OAuth-off metadata/endpoint behavior does not regress old clients | Exact-head API and MCP test; actual `tools/list` |
| OAUTH-02 | Unauthenticated/expired/revoked/tampered/wrong-signature/wrong-issuer/wrong-resource requests get bounded 401 challenges | HTTP status/headers; no domain writes |
| OAUTH-03 | Discovery through exact project and shared URLs yields canonical issuer/resource; no forwarded-host injection | Metadata contract and allowed proxy topology |
| OAUTH-04 | PKCE S256 enforced, code single-use, redirect exact match, state and issuer bound, resource invariant | Tamper/replay/race tests; no token for refused paths |
| OAUTH-05 | Client registration/trust rejects redirect SSRF, forged CIMD, untrusted DCR and cross-client token issuance | Client metadata provenance, registration logs without secrets |
| OAUTH-06 | Explicit human consent shows correct project/client/read/write/allowed tools; cancellation or wrong role produces no grant | UI capture, native grant readback, refusal audit |
| OAUTH-07 | Different project/tenant or stale membership, revoked project consent, downgraded scope/allowlist, expired grant and locked plan refuse before write | Same existing domain authorizer; DB before/after invariants |
| OAUTH-08 | Machine caller cannot approve Skill versions, change active assignments, perform protected human apply or forge a human actor | HTTP/MCP refusal, zero official writes, immutable actor receipt |
| OAUTH-09 | OAuth access-token refresh, rotation, concurrent retry, lost response and reuse of old refresh token cannot restore revoked privilege | Family state, timestamps, denial and no leaked secrets |
| OAUTH-10 | MCP `initialize`, tool discovery and session/cache rebind after client/grant/catalog change follow agreed supported protocol versions | Exact catalog fingerprints and per-version MCP client tests |
| OAUTH-11 | Disconnect or user/project revocation instantly denies subsequent calls; historic cases, runs and audits remain readable to authorized users | Native records, new call refusal, preserved old results |
| OAUTH-12 | Actual supported ChatGPT connection works with current advertised registration method, scopes, refresh and callback origin | Real handshake, read-only tool call, authorized staged write if client supports it |
| OAUTH-13 | Outbound Jira/Linear/Notion OAuth remains isolated; provider tokens cannot authenticate to Tesbo MCP | Existing integration regressions |
| OAUTH-14 | Accessibility, cancellation, expiry/reconnect guidance and meaningful human comprehension of the permission screen | Grey/Purple user journey and keyboard/screen reader check |

**Native regression rule:** Case definitions are persistent Tesbo test cases in the existing TESBOPROJECT; each required scenario has repeatable steps, expected/refused state, prerequisite identities and reset. Preserve stable case identities and version linkage, with each execution/retest its own real Run/attempt and evidence. Do not claim a published Tesbo case/run merely from this source document.

## 8. Decision register — surface before committing interpretations

- **D1 Authorization server:** in-app narrowly bounded Tesbo AS vs existing suitable external IdP; ownership, audit, credentials, deployment and recovery consequences.
- **D2 Client registration:** CIMD, pre-registered client ID, or bounded DCR based on *actual* ChatGPT/client acceptance; redirect policy and trust verification.
- **D3 Consent authority:** what may ordinary members grant themselves for read? Who enables/approves write? Scope step-up behavior and exact settings UI.
- **D4 Connection selection:** project-scoped URL default vs shared endpoint project picker; one grant per project; cross-project reconnection and account switching.
- **D5 Tokens:** TTL, refresh rotation, revocation SLA, opaque vs JWT, key management, session and evidence retention; reconnect UX.
- **D6 Transport version:** support legacy `initialize`/session alongside the newer MCP revision or upgrade separately; live ChatGPT compatibility proof.
- **D7 Release:** which connected staging/production provider controls issuer HTTPS redirects; actual connected repo/branch, backend authorization-server availability, rollback and key-rotation drill.
- **D8 Client entitlement:** whether a specific ChatGPT account/workspace supports remote custom MCP *writes*; a read-only successful connection is not proof of native writes.
- **D9 Governance:** reuse P-07 human publication and governed Skills/ASER contracts, not agent bypass; specify behavior when Skills or suite/case publication are blocked.

**Owner feedback requested for D1/D3/D4/D5 before implementation** where no existing approved policy settles them; other decisions require evidence, not assumptions. Default design direction for review: single project-scoped OAuth grant, read-only first, machine writes optional with explicit owner-controlled permission, no autonomous human-only decisions, OAuth-off by default, existing API-token clients preserved.

## 9. Independent assurance challenge / acceptance gate

Blue: prove reuse and no duplicate identity/policy/record owner. Red: challenge premises, redirect and consent authority, confused-deputy flows. Security: OAuth mix-up, PKCE bypass, token exfiltration, SSRF, grant escalation, rotation and privilege revocation race. Green: REST/MCP/UI/DB/provider/CI seams and old-client compatibility. QA: every positive/negative/boundary/state/concurrency/restart path and exact before/after invariant. Grey: Connect→permissions→tool outcome→disconnect without misleading claims. Purple: in-place UI, clear safe copy/reveal and accessibility. Graph: represent grant-to-client-to-project-to-tool obligations and invalidation consequences. White: independent exact-source completeness and unresolved decision ledger. Observability: safe diagnostic events, rate limits, troubleshooting and no credential leakage. Each team must supply actual original findings/evidence; this table is a charter, **not a fabricated completed review**.

**Definition of done:** approved owner decisions; protocol-conformant documented source; negative-first security CI; real deployed ChatGPT authorization and revoked-client test; no API-token or outbound OAuth regression; persisted native TESBOPROJECT cases and at least one genuine version-bound execution; independent review and approved release authority. No merging into main solely on green unit tests.
