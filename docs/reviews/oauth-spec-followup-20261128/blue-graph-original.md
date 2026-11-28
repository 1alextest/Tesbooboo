# Blue / Graph — original OAuth continuation review

Date: 28 November 2026. Reviewer: independent Blue/Graph invocation, combining the two existing lenses, not two independent reviewers. This first pass was written before reading any new peer original or synthesis.

**Result:** no new blocking documentation error established in the amended OAuth continuation or canonical06 handoff method within the inspected scope. The continuation correctly distinguishes existing owners from the missing connection joins. Implementation and activation remain blocked on the applicable owner decisions and proof below. This is a disclosed-case, informed application/regression review; it provides no blind-discovery, empirical method-efficacy, computed graph CLEAN, implementation acceptance or release claim.

## Input identity and method

- Candidate HEAD: `07469c1d8ccd721fc7c2dcb96b7fbd6c5699a490`, plus the exact uncommitted documentation bytes enumerated in `inputs.json`.
- Product reference HEAD: `2e91c8e95dbf90ced664ca4f35af207abaa56941`, at `/workspace/scratch/49b3f13cfc23/tesbo-oauth-teams`.
- `inputs.json` SHA-256: `0cba2bb837eb439367d59a6d1c9e2318684601dc46c8ddc4cf36475595ff93e4`. Independently recomputed byte counts and SHA-256 for **all 26 listed files: 26 match, zero mismatches**. This verifies the supplied source identity, not source correctness or deployment.
- OAuth specification SHA-256: `c5ee4fd6ffde8e58cdecd1b308d77e49383ed02d71e5f261b0f3487e8b3f00db`; canonical06 SHA-256: `6542bd5c9296eb33c56ba33bc7c655a77fec802b60472a07fae8ae36900a2f17`.
- Applied AGENTS principles, applicable CLAUDE constraints, source-first decision guidance, and the unchanged Blue/Graph charters in `docs/specs/mcp-oauth-chatgpt-connection.md:218`, canonical06 `:866`, `:873`, and `:892`. Blue investigates existing contracts, ownership and reuse; Graph traces semantic obligations, authority and invalidation without becoming their owner.
- Followed the actual producer/consumer joins called for by canonical06 `:884–888`. Read the historical assurance addendum as attributed prior analysis, then checked applicable product sources independently. No new external protocol conclusion is made from an unread link or from the historical report.

Product/native execution: **NOT RUN**. No tests, provider requests, native queries/writes, consent, login, environment/configuration changes, product/spec edits, merge or deployment were performed. Read-only source inspection and hashing are the executed checks. The only authored file is this report.

## Actual owners, maturity and reuse decisions

All product paths below are relative to the product-reference checkout; documentation paths are relative to the candidate checkout. Line references bind those pinned inputs.

| Capability / relationship | Actual owner and source evidence | Maturity and disposition |
| --- | --- | --- |
| Inbound issuer and provider state | `src/auth/mcp-oauth-server.ts:177–240` mounts the library with the existing PostgreSQL adapter; `src/main.ts:117–121` invokes it before listener startup | Present in source; deployment/activation unverified. **Reuse** embedded issuer. A second issuer or credential store is unjustified. |
| Credential kind → protected route | `src/auth/auth.middleware.ts:23–48` keeps browser, API-token and OAuth contexts separate; `src/mcp/mcp.controller.ts:65–94` routes verified OAuth on the project endpoint while retaining the API-token shared endpoint | Present in source; runtime unverified. **Reuse/extend** the existing entrance. Stale service comments at `src/mcp/mcp.service.ts:279–283` saying OAuth is not accepted over HTTP are contradicted by actual wiring, so those comments cannot justify another implementation. |
| Canonical resource → project | `src/auth/mcp-oauth-server.ts:131–145`, `:266–290` reconstruct the exact resource, verify token/Grant/client and return a distinct OAuth principal | Present in source. Preserve exact project/resource/issuer identity. An ambient frontend workspace or guessed token ID supplies no equivalent relationship. |
| Project/client permission | `src/mcp/mcp-access.ts:14–25`, `:81–103`, `:136–144`; `src/mcp/mcp.service.ts:233–276`, `:467–520` | Existing revisioned `externalMcpAccess` remains the authority; OAuth is read-only. **Reuse** current CAS and tool predicate, not a new permission service. |
| Human consent → current authority | `src/mcp/mcp-oauth-interaction.controller.ts:99–127`, `:203–238`; `src/auth/mcp-oauth-grant-binding.ts:38–108`; V167 `:5–22` | Present in source: consent proof includes current membership identities; binding rechecks under row locks. The binding is subordinate evidence, not independent permission. **Reuse** this owner for the selected login continuation. |
| Settings save → old-family invalidation | `src/mcp/mcp.service.ts:483–510`; strict adapter reads at `src/auth/mcp-oauth-postgres.adapter.ts:96–104` | Present in source. ANY successful project policy save advances revision and tombstones previous bindings. **No policy change** recommended; explain its broad effect. |
| Individual history/revoke | `src/mcp/mcp.service.ts:348–448` requires current membership, limits to own/project records, distinguishes freshness, and atomically records self-revoke/audit; `ExternalMcpAccessPanel.tsx:53–109` presents the distinction | Present in source; native/runtime proof not rerun. **Reuse** existing owner. History is neither a session inventory nor observed client liveness. |
| Setup entry points | `Tesbo-Frontend/app/(app)/projects/[id]/settings/page.tsx:916` and `settings/api-tokens/page.tsx:392` mount the same `ExternalMcpAccessPanel` | Present in source. **Extend shared presentation** if authorized; separate copies of readiness or policy state are unnecessary. |
| Connection URL and login return | `Tesbo-Frontend/lib/api.ts:2007–2008`; `lib/redirect.ts:85–101`; `src/mcp/mcp-oauth-interaction.controller.ts:138–145` | Current URLs still depend on ordinary `API_BASE`, and login still goes to frontend origin. Required continuation is specified, not implemented/proven. Extend the appropriate configuration/continuation owners after architecture selection. |
| Concurrency of work | Review brief `:10`; OAuth spec `:242–243` identify #337 and separate delegated-authority work #292/#338 | Preserve existing ownership. #337 commit `1631eee76547bef602b23b278d8e4e35d881d1b5` is not available as a local Git object here; its 33 successful checks/one skip are attributed input, not independently fetched or rerun evidence. No competing test or delegated-authority implementation is proposed. |

Backend `src/` and migration references in the table are under `Tesbo-Backend-Nest/`.

## Material joins and bounded dispositions

### BG-P1 — canonical URL, fresh authentication and consent remain an implementation prerequisite

**Class:** implementation prerequisite; already specified, not a new documentation defect. **Decision:** HUMAN_REQUIRED for topology/adapter; EVIDENCE_BLOCKED for runtime completion. **Affected scope:** the fresh-browser connection slice.

The actual chain is copied resource URL → provider interaction on backend origin → frontend `/login?redirect=…` → session establishment → return navigation → backend consent → exact callback/exchange/project read. `getMcpUrl` and `navigateAfterSignIn` both derive their origin from ordinary `API_BASE` (`lib/api.ts:2007–2008`; `lib/redirect.ts:92–96`). The interaction controller chooses frontend login (`mcp-oauth-interaction.controller.ts:138–145`), while `AuthService.setSessionCookie` uses a host-only Lax cookie (`auth.service.ts:289–296`). A successful frontend login or a corrected navigation destination alone does not establish the backend-session join.

The amended spec explicitly covers this at `:249–255` and OAUTH-15 `:281`; the deployment guide `:193–217` preserves the ordinary API route and identifies the topology boundary. No additional issuer, copied session or global API-base replacement is justified. The owner selected the backend origin but has not selected the login adapter/topology (`spec:251`). A focused backend-host adapter reusing current authentication and suitable same-site domain work remain legitimate alternatives. Keeping OAuth off with permitted token clients is also valid.

**Discriminating witness:** start at the actual external client with an empty browser session; independently observe the canonical resource/issuer, actual cookie storage/send and current human account, then complete consent, callback, exchange and a permitted exact-project read. Retain an existing-session positive neighbor, ordinary frontend-login neighbor, wrong-account/cancel/expiry/blocked-cookie controls, and malformed/foreign continuation refusal. Do not seed the missing session before testing its production path. If OTP/profile is offered, its continuation and shared safety obligations stay in scope; a deliberately restricted pilot needs its own honest scope decision.

The existing browser source mocks password/OTP/profile responses (`e2e/ui/oauth-login-continuation.spec.ts:15–56`); the provider fixture resumes using a saved session (`scripts/ci/oauth-interaction-redirect.cjs:155–168`). Those are useful narrower proofs. Their limited starting conditions do not make them defective, and their combination does not prove actual browser cookie delivery.

### BG-P2 — owner preapproval, human consent and permitted use need separate evidence

**Class:** implementation prerequisite/owner scope decision, not a demonstrated disclosure. **Decision:** HUMAN_REQUIRED for pilot tools/data and offline lifetime; existing grant intersection is ALREADY_DECIDED. **Affected scope:** understandable/read-only admission and use.

`mcp-oauth-server.ts:148–159` checks current owner approval; `mcp-oauth-interaction.controller.ts:99–127` separately checks human membership/review; the verifier and `McpService` independently recheck the binding/current grant; `mcp-access.ts:136–144` intersects scopes and tools. Neither metadata, project On, nor a personal history row supplies all these facts. The continuation correctly requires independent provider/project/client/personal/use states (`spec:259–261`) and limits unsafe inference. No new readiness endpoint, role or database is required by that contract.

The current OAuth form sets `allowedTools:null` (`ExternalMcpAccessPanel.tsx:210–216`), meaning all tools admitted by the shared read predicate, including future qualifying tools. Existing read-tool surfaces include full testcase details, knowledge documents and proposal reads (`mcp.tools.ts:544–557`, `:1669–1714`, `:1968–1980`, `:2049–2057`). Thus read-only is not itself a minimal data boundary. This is expressly recognized by `spec:263`, not an omitted obligation. An explicit existing-tool allowlist is supported by `mcp-access.ts:90–103`; keep broad read as a legitimate choice only with the applicable owner decision and accurate consent. Do not silently narrow current grants or invent permanent artifact exclusions.

**Discriminating witness:** hold provider readiness constant while varying exact client admission, current member, personal consent and tool restriction independently; show a legitimate authorized read, a denied disallowed tool with no data returned, another project denied, and unchanged token-client behavior. For a wildcard grant, introduce a qualifying future tool in an isolated authorized fixture and verify the documented effect; for an explicit list it must remain excluded. A successful checker must still say client authorization is unverified. Proof belongs to policy/UI/client owners, not to a new Graph authority.

### BG-N1 — retain the project-wide revocation epoch and subordinate consent records

**Class:** supported no-change, with an implementation/UI explanation prerequisite. **Decision:** ALREADY_DECIDED in the current candidate.

The spec deliberately invalidates every earlier OAuth family on ANY project MCP policy revision (`:51`, `:263`). The actual save increments revision and tombstones bindings in one transaction (`mcp.service.ts:483–510`), and strict model reads consult the same binding (`mcp-oauth-postgres.adapter.ts:96–104`). A newly inserted binding cannot reuse an existing fingerprint (`mcp-oauth-grant-binding.ts:100–108`). This supports the specified ownership mechanism and avoids a competing client-permission store. It does not prove all concurrent HTTP redemptions or deployment schema.

An unrelated API-token-client edit causing OAuth reconsent is therefore intentional conservative behavior, not evidence of an accidental OAuth bug. Explain the project-wide consequence before save through the shared panel. Narrower client epochs could reduce burden, but that is a separate authorized design with equivalent same-ID revocation guarantees; it is not a routine correction. OAUTH-18 `:284` already provides the relevant regression obligation.

**Controls:** approve two distinct clients and retain both old families; change one client or an unrelated token entry; both old families stay denied after same-ID reapproval; fresh explicit consent produces a distinct usable family; another project/member population stays isolated as applicable. Exercise stale-CAS refusal and rollback without claiming that simultaneous adapter reads establish HTTP refresh serialization.

### BG-N2 — membership generation is present; do not reopen an already implemented owner as absent

**Class:** supported no-change to the specified owner; implementation acceptance prerequisite remains. **Decision:** source mechanism ALREADY_DECIDED; transactional/runtime assurance EVIDENCE_BLOCKED.

Historical text discusses a live-membership-only gap and candidate mechanisms (`spec:37–49`). Current code binds both project and organization membership row IDs in the consent proof and persisted binding (`mcp-oauth-interaction.controller.ts:109–127`, `:224–228`; V167 `:12–15`) and requires equality on reads (`mcp-oauth-grant-binding.ts:43–61`). Current history permits a rejoined member to see their own earlier record while separately computing membership freshness (`mcp.service.ts:354–384`). This is the intended separation of current access, historical consent and current-family eligibility, not a reason to create another membership store.

The historical receipts do not establish authoritative removal/rejoin API behavior, competing consent/removal order or all account events. Preserve the original success/failure attempts. Verify removal/rejoin with old artifacts retained, new membership IDs observed independently, old family denied and fresh new consent usable. Another member/organization and a role change that retains eligibility are necessary neighbors; do not assume they share removal semantics. Archive/restore and password/compromise recovery remain the distinct owner decisions called out by `spec:45`, `:263`.

### BG-H1 — shared-auth races remain hypotheses until controlled proof

**Class:** hypothesis, already accurately labelled by the continuation (`:273`); no confirmed runtime defect or authority to rewrite authentication.

`OtpService.verifyOtpCode` selects an unused code and later marks it used in separate calls (`otp.service.ts:48–59`, `:130–132`); `resolveSession` returns a positive cache hit before PostgreSQL (`:94–114`), while invalidation deletes DB state then invalidates cache (`:117–127`). These source mechanisms justify targeted investigation if the selected login path relies on them. They do not establish the observed concurrency outcome in the deployed database/cache stack.

**Proof:** for OTP, arm an operation-bound gate before two verifications select/consume the same isolated code; observe the held phase and count independently usable resulting sessions, with sequential legitimate/replayed-code neighbors. For cache invalidation, gate the relevant fill/invalidation ordering, observe DB and cache preconditions, then attempt a protected consent/session read after committed invalidation; include cache-disabled and unrelated-session controls. Release and await all operations on every exit. Only a confirmed coupled gap belongs in the selected increment; a password-only pilot cannot be used to erase a supported OTP path without a deliberate scope decision.

## Method assessment and remaining frontier

The amended method is coherent for this bounded application: canonical06 `:842` permits evidence-grounded findings, supported no-change and bounded unknown, while `:884–890` separates reconstructed cause, independently derived axes, proof at the actual join, preserved neighbors, and exact-candidate reconciliation. The present review found the useful conditional principle in the source: independently correct components do not close their cross-origin/session or revocation/refresh joins. The controlled transformation counterexample at `:890` appropriately limits transfer; no browser exercise is universally required for every change. No new method or mandatory graph rendering is justified.

The decision guidance retains strong wording to report a candidate question (`docs/agent-skills/evidence-grounded-decisions/SKILL.md:109`), but also expressly permits no candidate in the inspected scope (`:141–143`). Read with canonical06 `:842`, this does not justify a question/finding quota. No evidence here establishes that the wording caused earlier reviewers to miss anything; no new blocker is asserted from that ambiguity.

Unexamined or unavailable material boundaries remain explicit:

- Deployed backend/frontend build identity, actual environment, network/edge protections, replicas, production schema, operator keys, client account/entitlement and real browser/client behavior were not inspected. A source declaration is not a deployed observation.
- The pinned provider's transitive remote-JWKS implementation and observed public ChatGPT metadata in `spec:267` were not independently retrieved in this pass. They remain attributed qualification work under existing Security/provider owners, with OAUTH-17's legitimate-key/rotation and zero-prohibited-fetch controls. This report neither closes nor rejects that concern.
- Real competing provider HTTP refresh/exchange, timeout/lost-response/replay, key-class rotations and backup restore were not executed. `crypto.util.ts:59–77` independently confirms encryption-key-derived lookup fingerprints; rotating ciphertext alone cannot be assumed to migrate those persisted identities. Preserve OAUTH-19/20 and the deployment-guide gates.
- #337's live checks and #292/#338's current diffs/status were not independently retrieved. The review brief's ownership state is preserved, with no competing work started. A later changed head requires targeted reconciliation.
- The external living application baseline and native TESBOPROJECT requirements/policies/manuals/cases/runs were unavailable in this source-only invocation. Their existence, approval, synchronization and completeness are unknown. **Tesbo sync not performed.** No native IDs were invented.
- Review scope followed the material ownership/session/permission/invalidation joins above. It did not perform a full code audit, complete eight-file canonical package review, full read-tool data-field inventory, scanner reconciliation, runtime graph evaluation or release assurance.

Next permissible step: coordinator reconciles frozen independent reports against this exact candidate, retains valid no-change/unknown dispositions, and obtains only the decisions needed by the bounded increment. Resolve the login architecture and pilot scope at their accountable owners before implementing the dependent interpretation; reuse the existing issuer, authentication, policy, history, UI, test and workstream owners. This original supplies no permission for activation, deployment or native publication.

## Supplemental source identities

These additional product-reference sources were followed beyond `inputs.json`; hashes bind the observations above, not runtime claims.

| Path | Bytes | SHA-256 |
| --- | ---: | --- |
| `Tesbo-Backend-Nest/src/mcp/mcp.controller.ts` | 12244 | `1e82e05505fc92d9cd5ab1f884fe322198f0644beeff46a2a2102487e1fb7058` |
| `Tesbo-Backend-Nest/src/auth/auth.middleware.ts` | 3387 | `dec29a387f11376c56388c97bafc52c623f6f93ce64e5359d05ee1205a979aa0` |
| `Tesbo-Backend-Nest/src/auth/mcp-oauth-grant-binding.ts` | 6004 | `b105960b51201c59a5af4ce0976ca413bf07bc4d3e3ad20c892b776b5e591315` |
| `Tesbo-Backend-Nest/src/auth/mcp-oauth-postgres.adapter.ts` | 8917 | `2b6c0f95dd3ce286f30b258a28625b1cbdb5128661c95415e67fbf38892a9d34` |
| `Tesbo-Backend-Nest/migrations/V167_oauth_grant_approval_binding.sql` | 1579 | `3dc697b87097849f6271d76d77a5d5163849520d2548acae51c7c0c24c1dcc9e` |
| `Tesbo-Backend-Nest/src/mcp/mcp.tools.ts` | 121412 | `99e7e60471a420660f5ebeff0aef45f297e44d377b0c068f2cdfea70fa1efc19` |
| `Tesbo-Backend-Nest/src/common/crypto.util.ts` | 3098 | `bcce9f73c5bc16606fb2064c2b31b4f82a8a47e1fc7e32f32c15430eed1ec037` |
| `Tesbo-Frontend/app/(app)/projects/[id]/settings/page.tsx` | 63692 | `ed59f08d0ec50800ff29bd64b4320affb4e1d793054a16631f68f04a807b8e00` |
| `Tesbo-Frontend/app/(app)/projects/[id]/settings/api-tokens/page.tsx` | 43835 | `7f409fd8d282e872f49d6cd6d294a235e69b8efc446b27ab9d314e6096d23838` |
