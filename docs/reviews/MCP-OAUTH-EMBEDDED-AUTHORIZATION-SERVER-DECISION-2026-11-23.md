# Tesbo MCP OAuth — embedded authorization-server architecture decision challenge

**Status: CONDITIONAL DESIGN DIRECTION; NOT RATIFIED; NOT IMPLEMENTED.** Review date 2026-11-23. Source pinned to Tesbo `development@0222ed20d9ddff4e05c97177977babb108d1833d`; current merge head checked as `c2561acbe16ac3031178ec9b02a5788342049054` (six subsequent commits change requirements/testcase/UX paths, **not** the inspected auth/MCP modules). This report is a **subordinate architecture review** to the existing `docs/specs/mcp-oauth-chatgpt-connection.md`, not a new normative specification, project, service or authorization authority.

**Decision under challenge.** Keep Tesbo's existing account/login, tenant/project membership, external MCP consent, tool authorization and approval workflow; integrate a **vetted standards-conformant OAuth authorization-server library within the existing NestJS/Express backend**, instead of building a separate identity platform or hand-writing an issuer.

**Verdict.** Approve a **bounded, feature-off compatibility/security spike** toward the embedded design. Do **not** yet approve a library as production-ready, grant issuance, ChatGPT write access or production activation. Continue the architecture only after the gates below pass. A self-written OAuth server and any grant policy that bypasses Tesbo's current project authority are rejected. If embedded integration fails materially, return to the owner with the evidence and compare a separately managed established IdP before changing architecture; do not silently build another microservice.

## Review execution, independence and evidence

Four separately executed analytical research challenges covered eleven lenses:

| Analytical challenge | Lenses | Research receipt ID |
| --- | --- | --- |
| Reuse and semantic governance | Blue, Graph, one-owner/enforcement | `resp_a24f97cf-2659-4d56-8d15-0381da7ffdd4` |
| Adversarial trust and authority | Red, Security, lifecycle attack | `resp_25125eba-68c2-46ce-a4d0-cfd44c3fb6eb` |
| Client, server, runtime and end-to-end seams | Green, QA, protocol compatibility | `resp_ffa1a44f-placeholder` (see method note below) |
| Human outcome, operability and completeness | Grey, Purple, Observability, White | `resp_e029f86d-86d9-44c0-ae10-c1c1d7c5c0e1` |

**Method/qualification.** Each research challenge received the same source-anchored architecture facts and a different adversarial charter. Reviewers could research external standards and library documentation but **could not independently read the private Tesbo repository**; their findings are hypotheses until reconciled against code by the coordinating reviewer. The Green/QA response identifier was not retained in the tool summary and is deliberately **UNRECORDED**, not authenticated by the placeholder above. These research passes are independent *analytical challenges*, not independently authenticated GitHub contributors, real Tesbo reviewer receipts, a human owner decision or White signoff. No OAuth code, live ChatGPT sign-in, official TESBOPROJECT test run, database migration or deployment was executed by this review.

### Repository owner map — source verified

| Current owner and inspected evidence | Existing behavior | Mandatory OAuth integration boundary |
| --- | --- | --- |
| `src/auth/auth.module.ts` (blob `cfbceabdee19ebfa2739c039b236e0b1dfbd7265`) | `AuthMiddleware` + `ActivityMiddleware` applied to all Nest routes | Decide exact embedded-provider mount/order; never assume Express middleware receives Nest global guards |
| `src/auth/auth.middleware.ts` (blob `ab9ec0bb930f411b205cd169567fa3c0d058b0cf`) | Bearer API-token precedence over browser cookie; invalid bearer cannot inherit session | Explicit credential kind and route-bound OAuth validation; never fall back to cookie, token-prefix guess, or privileged REST session |
| `src/auth/otp.service.ts` (blob `ef76f3dbd1b31068426878a26aaea12526d114cb`) | Tesbo user sessions in Postgres with Redis cache | Reuse existing human user/account and session for **interactive** login; AS code/refresh/interaction storage is distinct *protocol state*, not a second user directory |
| `src/auth/auth.service.ts` | HttpOnly, SameSite=Lax secure-session-cookie policy | Separate AS interaction cookies, CSRF, session fixation, logout and account switch; secure cross-origin browser round trip |
| `src/app.module.ts` and `src/auth/api-token-rest.guard.ts` | Global `ApiTokenRestGuard` recognizes `req.apiToken`; without that it treats request as browser | **P0:** an OAuth bearer stored only as `req.userId` and not recognized as a machine principal could bypass REST machine restrictions. OAuth access tokens must not grant arbitrary REST/browser authority. |
| `src/plan-limits/project-write-lock.guard.ts` | Global per-project write lock; MCP tool writes require specialized check | Preserve it; OAuth authorization must be subject to the same current plan lock and commit-bound domain checks |
| `src/mcp/mcp.controller.ts` (blob `80dd94d5b06870bc2f11459e8fa76a456d7d81c4`) | `/api/mcp` and `/api/projects/:id/mcp`; currently requires API token and uses 2024/2025 `initialize`/session behavior | Add valid OAuth bearer challenge and resource validation while preserving old API-token clients; separately verify 2026 stateless transport |
| `src/mcp/mcp.service.ts` (blob `711020288ee39e2e84eeab89e430be45e6b947e1`) | Current project membership, token row, named `externalMcpAccess` grant and tool scope intersection | **One Tesbo domain-authorization owner**; never rely on OAuth token scope/consent alone |
| `src/mcp/mcp-access.ts` (blob `89b1a8c3e0c6625015ee2f0ee2741b1997991c82`) | Owner/manager managed, revisioned client grants keyed by API token ID | Add reviewed credential-kind-aware grant association without fabricating API-token IDs or defaulting legacy grants to OAuth |
| Native proposal owner in `legacy.service.ts`, `testcase-proposal-review.ts` | Immutable provenance/replay key; `issuerId` means Tesbo user ID; human-only protected publication | Separate OAuth AS `iss`, subject `sub`, client/grant, Tesbo linked user and agent actor; preserve historic receipt/retry meaning |
| `src/main.ts` + config | Node 22, Express, `trust proxy=1`, global cookie/body/CORS middleware and deployment proxy | Canonical external issuer/resource from server-owned config; test real proxy and header trust, cookie and callback origins |
| `Tesbo-Backend-Nest/tsconfig.json` + Dockerfile | TypeScript CommonJS compilation; Node 22 runtime | Prove compatibility with the pinned ESM authorization-server library in the actual production image, not just a TS typecheck |
| Current API & MCP settings UI and `ExternalMcpAccessPanel` | Token creation/revocation, named client grants, scopes/tools/expiry | Enhance this same page with OAuth connections and effective permissions, not a parallel integrations app |

**Verified overlap correction (Blue/White):** OAuth user consent **and** Tesbo project-owner grant are not redundant competing authorization engines. They represent different independent obligations. The required effective permission is their **intersection** with authenticated client, subject, project, resource, membership, plan, tool and human-only publication policies. The Blue research proposal to choose *either* OAuth scope *or* externalMcpAccess as the sole decision authority is **REJECTED**. The resource service remains the sole domain policy evaluator, and must require all applicable gates. OAuth consent cannot automatically enable project MCP access or assign owner privileges.

## Architecture alternatives and decision

| Option | Advantage | Disadvantage / gate | Status |
| --- | --- | --- | --- |
| **A. Vetted AS library embedded in existing NestJS process** | Single Tesbo deployment, reuse existing accounts/sessions/database, no new microservice | Express/Nest guard boundaries, AS persistence, shared failure domain, CommonJS/ESM compatibility, experimental CIMD support | **Preferred for a gated spike**, not production approval |
| **B. Existing, established managed/external AS/IdP** | Operationally mature identity/issuer boundaries; no in-process AS maintenance | New provider dependence/cost, Tesbo user federation/consent mapping, verify CIMD + RFC 8707 + refresh + ChatGPT compatibility | **Fallback candidate** if A fails nontrivially; new owner decision |
| **C. Dedicated self-hosted AS service** | Process/isolation and independent scaling | New operational service, deployment boundary and identity integration, conflicts with no-parallel-service goal | Defer unless evidence proves necessary and owner authorizes |
| **D. Handwritten OAuth issuer added to AuthService** | Apparent minimal dependency | High standards/security maintenance; duplicate protocol logic and uncertain review | **Reject** |

### Candidate library due diligence (not a final selection)

`panva/node-oidc-provider` v9.15.1 is actively maintained and MIT-licensed; official package metadata identifies `type: module`. Its documentation supports Express/Nest mounting, PKCE, RFC 8707 resource indicators, RFC 9207 issuer identification, metadata, refresh tokens and revocation; production requires an external persistent adapter and integration-provided login/consent interactions. Its CIMD support is **experimental** and may change across minor versions. Sources:
- https://github.com/panva/node-oidc-provider (features, license, mounting)
- https://github.com/panva/node-oidc-provider/blob/main/docs/README.md (account lookup, interaction and persistent adapter obligations)
- https://github.com/panva/node-oidc-provider/blob/main/CHANGELOG.md (CIMD experimental evolution)

**Conclusion:** use `oidc-provider` only as a **spike candidate** with an exact pinned dependency, lockfile, software bill of materials and negative test suite. Its feature list does **not** establish MCP 2026-07-28 or ChatGPT interoperability without a working implementation. If its ESM/CommonJS integration, adapter atomicity or CIMD interoperability cannot pass, stop and reassess—not a home-grown compatibility workaround.

## Cross-team findings and required closure

| ID | Lens | Severity | Specific finding | Closure evidence / owner |
| --- | --- | --- | --- | --- |
| AD-01 | Blue, Graph | P0 | Avoid second Tesbo user directory, owner grants or domain authorization service; AS protocol-state tables are necessary, but are not project-role authorities | Written single-owner mapping and same-user binding; Blue/Graph |
| AD-02 | Security, Green | P0 | Mounted AS routes can bypass Nest global guards and middleware; OAuth bearer stored only as user ID could bypass `ApiTokenRestGuard` on REST paths | Explicit route/middleware diagram plus live tests for MCP-only tokens, all REST admin/human-only denies, cookie-only MCP deny; Security/Green |
| AD-03 | Security, Red | P0 | AS consent is not owner-managed `externalMcpAccess` approval; user click cannot grant unavailable rights | Authorization matrix (actual credential ∩ owner-grant ∩ user member ∩ scopes ∩ tool ∩ plan); transaction-bound revoked/changed tests; Security |
| AD-04 | Red, QA | P0 | `oidc-provider` ESM v9 against CommonJS TS output and Node22 can fail at runtime | Actual Docker production image startup and import test, not typecheck alone; Green/QA |
| AD-05 | Security, lifecycle | P0 | Default in-memory AS adapter is unacceptable; concurrent authorization-code redemption, refresh rotation and revocation require durable atomic semantics | Postgres-backed tested adapter: restart, simultaneous code use, token replay, expiry, key rotation, outage/failure rollback; Security/QA |
| AD-06 | Security, Red | P0 | CIMD metadata fetch can SSRF, cache stale redirects, or permit deceptive client branding; library CIMD experimental | HTTPS/public-IP enforcement, DNS re-resolution and redirect validation, JSON/time/size bounds, exact `client_id`/redirect, localhost warning tests; Security |
| AD-07 | Security, Green | P0 | Resource and issuer confused deputy: ChatGPT must obtain token for exact MCP resource, no cross-project or other service privilege | RFC9728 PRM / RFC8414 metadata, PKCE S256, `iss`, RFC8707 resource/audience, project-specific deny tests; Security/Green |
| AD-08 | Green, QA | P0 | AS support does not fix Tesbo's legacy MCP 2024/2025 handshake vs 2026 stateless protocol; current controller also uses HTTP 201 for ordinary responses | Explicit dual-era or verified compatibility plan, protocol/HTTP conformance and real ChatGPT-shaped live tool call; Green/QA |
| AD-09 | Security, QA | P0 | AS token mapped to `req.userId` may be interpreted as human on native REST; prevent external-agent promotion to owner or testcase approval | Authenticated machine union, REST route-denial regression and exact provenance; Security |
| AD-10 | Lifecycle, Graph | P0 | AS `iss` vs proposal `issuerId` meanings collide; history/replay keys are authoritative | Distinct subject/issuer/client/grant/user/actor fields; no fake API-token ID; old receipts immutable; Graph/Blue |
| AD-11 | Grey, Purple | P1 | ‘Connected’ may misrepresent requested vs actual effective permissions and ChatGPT write support | Existing UI shows client origin, Tesbo account/project, approved tools, pending-owner, read/write grant, disconnect and failures; Grey/Purple |
| AD-12 | Observability, SRE | P1 | One process means AS traffic can affect Tesbo API responsiveness; key rotation/outage can break all MCP flows | Separate AS rate limits/route budgets, bounded metadata fetch, latency/error metrics, kill switch, incident/key rotation/rollback drills; Ops |
| AD-13 | White, QA | P0 | Green unit CI or generic OAuth library certification is not real ChatGPT/Tesbo acceptance | End-to-end HTTPS OAuth handshake, denied variants, existing bearer compatibility, connected TESBOPROJECT case/run and genuine Independent/White receipts; White/QA |
| AD-14 | Grey, Security | P1 | Prompt-injected tool content and frozen ChatGPT tool catalog can mislead about allowed actions | Treat tool data as untrusted; still authorize per request; admin-reviewed tool catalog refresh and correct permission messaging; Grey/Security |
| AD-15 | Purple, Security | P0 | Existing browser SameSite cookie and AS interaction cookies must be separately CSRF-protected; redirects must be exact, not client-provided destinations | Cancel/deny/relogin/account switch/cross-site requests tested on real browser and external domain; Security/Purple |

**No confirmed live exploit was identified.** These are architecture/implementation risks with concrete regression oracles. Avoid treating hypothetical attack paths as an observed production defect.

## Required source-to-runtime spike before implementation approval

1. **Source/contract preflight.** Preserve the current `development` SHA and existing exact API-token MCP, REST human session, and native proposal results. Pin the prospective library version and license/SBOM. Trace Nest/Express mounting order and current guards.
2. **Isolation/runtime.** Behind a **default-off** `MCP_OAUTH_ENABLED` configuration, mount vetted AS routes in the existing Nest process with explicit named middleware/CSRF/session ownership. Demonstrate production Docker startup with CommonJS output and Node22, failing closed on missing configuration. No production tokens.
3. **Durable adapter and login.** Integrate `findAccount` to the existing Tesbo user ID and authenticated login session; use existing Postgres/Redis infrastructure via a documented, durable AS adapter. Create only the OAuth protocol state that is genuinely necessary. Test startup/restart, atomic code consume/refresh rotation and logout; never import provider user identities as a new Tesbo account authority.
4. **Discovery and client trust.** Static, server-owned canonical HTTPS issuer/resource; RFC9728 metadata for the chosen project-scoped MCP URL, RFC8414/OIDC metadata with S256, exact RFC9207 issuer response and RFC8707 resource binding. Bound CIMD/DCR behavior (CIMD preferred when validated; DCR only if required for a verified client). No metadata-derived authorization or client-name-as-trust.
5. **Read-only resource proof.** Test actual OAuth bearer on the existing MCP controller/service for `tools/list` and one read tool, with a real current Tesbo project membership + explicit owner-managed grant. Confirm wrong resource, issuer, project, audience, scope, expired/revoked client and cookie-only requests are denied; existing `tsbo_` API tokens remain working.
6. **Write and review boundary proof (separate gate).** An authorized OAuth agent may stage only after the native producer owner supports true OAuth provenance and transaction-bound grant rechecks. Human-only apply, Skills assignment/approval, testcase acceptance and release remain inaccessible to machine credentials. Revocation while waiting at a lock must prevent unauthorized effects.
7. **Client and rollout proof.** Live ChatGPT and at least one other supported MCP client in the actual tested workspace; verify which tools the account/workspace can invoke. Save actual native regression cases in existing TESBOPROJECT, link them to requirements/criteria, and retain real run attempts/evidence. No fake Pass or publication based on GitHub CI.
8. **Operational exit.** Simulate AS/JWKS/DB/Redis outages, metadata flooding, token/key rotation, multiple backend instances, rollback flag, recovery and audit readback. Release only after real independent security/identity/QA/White review and owner approval.

### Negative-first acceptance IDs

- **AS-D01:** OAuth bearer against unrelated REST/admin/approval path → 403/401, no writes, existing cookie-only MCP → 401.
- **AS-D02:** Inconsistent redirect/client metadata, PKCE/plain/no verifier, wrong `iss`/resource/audience → no code/token or tool dispatch.
- **AS-D03:** Authorization-code consume/refresh rotated concurrently and across restarts → exactly one valid successor, no replay resurrection.
- **AS-D04:** Member removed, project archived, named grant revoked, plan locked while a write is blocked → no unauthorized staging or official writes.
- **AS-D05:** Multiple Tesbo users/projects with same external subject string under different issuers → separate identities; no cross-project authorization.
- **AS-D06:** Project consent off + valid OAuth access token; OAuth consent on + missing owner grant → denied, no effective permission widening.
- **AS-D07:** Legacy API token and human browser logins still behave identically after enabling/disabling embedded AS.
- **AS-D08:** ChatGPT client discovery/PKCE/refresh/cancel/reconnect/expiry and older MCP client regression → exact protocol evidence.
- **AS-D09:** CIMD SSRF to private, loopback, link-local, redirect-to-private, DNS rebinding, huge/slow metadata → blocked and rate-limited.
- **AS-D10:** Live Tesbo case staging then separate human approval; stable case ID and version-bound test run; previous failures retained.
- **AS-D11:** AS outage or key-rotation partial state → OAuth denies safely, existing API-token access not spuriously denied or escalated.
- **AS-D12:** Consent screen accurately distinguishes authenticated, awaiting owner approval, connected read-only, authorized staging write, expired/revoked, and published case (separate human decision).

## Owner decisions and remaining authority

**D1 — library:** Review `oidc-provider` as preferred spike candidate, not selected production dependency. Alternatives require owner approval if material library/external-provider change.
**D2 — AS issuer:** Canonical public HTTPS issuer and project-scoped resource URI must be deployment-configured, not inferred from incoming Host/forwarded headers. Validate staging/prod reverse proxy separately.
**D3 — consent:** Recommend project owner/manager must enable and approve a named client grant; human end-user OAuth consent only delegates within that allowed envelope. Whether ordinary members may request read-only grants remains a product authority decision, not silently chosen.
**D4 — OAuth lifecycle:** Determine access TTL, refresh rotation/reuse response, key custody, retention and incident SLOs after security review; no invented universal safe numbers.
**D5 — ChatGPT capability:** Confirm target plan/workspace/admin action permissions. OpenAI currently restricts full write-capable custom MCP integration by workspace eligibility; OAuth sign-in alone does not provide those permissions (https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt).
**D6 — protocol:** Keep legacy MCP clients functional, but independently verify the modern stateless era and correct HTTP challenge/response codes before any claim of modern conformance.
**D7 — release:** Feature-off rollout and rollback without forcing API-token migration; separate main assurance bootstrap #191 and release #155 remain blocked by their own gates.

**White analytical adjudication:** **Conditionally viable, not frozen.** The first safe next deliverable is a small, reviewable *feature-off compatibility/security spike* proving library import/mount, durable adapter, discovery and single read-only current-policy call. No real delegated Independent/White signoffs exist for this decision yet. This report itself is not a human release approval.
