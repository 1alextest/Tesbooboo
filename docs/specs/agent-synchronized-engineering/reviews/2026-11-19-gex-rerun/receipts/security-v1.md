# Security original receipt — GEX-ASER-2026-11-19

**Assessor:** `/root/security_review`, one analytical Security reviewer applying all four operational lenses. **Signed/frozen:** 2026-11-20 04:44 UTC. **Target:** `1.4.29-candidate-v1`, design adequacy and material integration, not whole-product certification. Grey/White pre-gate closure was pending at dispatch; this read-only assessment grants no design, freeze, activation or release permission.

## Identity, scope and evidence discipline

The input is the immutable `input-v1` manifest: all eight canonical and six subordinate files matched their recorded byte counts and SHA-256 values. The manifest identifies original archive `6094687758ebf1e5dfa3c6ed8e2209b8967a190523815ba1e1197d11867374ef`, application `1alextest/Tesbooboo@6897f989b055a955280f810c7daace86f74057fa`, and view input `b906a22ae84e170061a9e19ab37063e6f58b608d`. Application reads used that Git object, never the mutable checkout.

Method identity is `NesberryEnterprise/Nesberry@d83549c85a4dcd047fb40dc4fba4ec62737ab0fc`: unchanged `.claude/agents/security-team.md` (SHA-256 `17e4fa6ea24cca2626badf4875d32e82b66e3bb4a2a2d09e0b13f019a07fbf3a`), `guard-security-privacy.md` (`a16daa45da7cfe0a6cc5501d988497f2d3bf4bdf4a876966ff390dd30865fc00`), and `teams/review-orchestration.md` (`8fd41f22e1909afd48d8af95120d03a0f52e30a1bf9976a639fb6cca67bb4729`). Also read applicable shared vocabulary, spec-writing §0.5 lenses 4–6, and recovered Critical Preflight (`NESBERRY_AI_CODING_GUARD.md`, hash `7e351122a9821ec1331b8b795ceaa565590b7c2221efc3aa533e1a957da11528`). The initially missing preflight was recovered before closeout.

**Actually inspected:** every canonical 1.4.29 amendment; relevant P-07/P-17/P-18, AD-02/10, R-ASE-18/21–36, source-security and native-owner contracts; ASER-C01–06; relevant planned ASE-INT/ASE-FLOW/SK-E2E definitions; security/source/authority portions of the six views. Read pinned `AGENTS.md` and `CLAUDE.md`, authentication/token/MCP entry paths, source registry/configuration/capture/history/comparison, model approval/dispatch, KB create/list/detail/history, RAG keyword/vector queries, Zyra fallback and graph notifications. References below use `Cnn` for the numbered canonical file and `B/` for `Tesbo-Backend-Nest/src/` at the application pin.

Checks were document/source inspection and bounded G0/G1 counterexample tracing. No app tests, target requests, database access, dependency execution, live writes, UI captures or code changes occurred. The output file is the only authored artifact. No runtime, human-observation, cross-model or independent operational-approver evidence exists.

**Independence qualification:** no author retrospective, current reviewer output, method-transfer output or old review file was consulted. A range read of C05 acceptance definitions incidentally exposed its historical inventory introduction and first six GJ rows at 1538–1548; historical evidence summaries also appear in governing primary bodies. They were not used as findings or coverage. Boundary probes had already been derived. This is an original source-derived receipt with that disclosed exposure, not wholly unexposed discovery.

The operational Security agent is advisory. Orchestration's portability, consequence, completeness, sequencing and evidence obligations remain mandatory; canonical 06's new method is a candidate, not its replacement. Tesbo's actual authorization and shared-database restrictions control. Nesberry marketplace roles, financial rules, deployment assumptions, exact scripts and proposed guards were not imported. No extra Security membership or quorum is invented.

## 1. Threat-model delta

The proposal makes private requirements, source observations, native cases/results and feedback more reachable through graph retrieval and reusable methods; it can also influence which expectations and tests people accept. The principal risks are authority laundering, unauthorized source selection, cross-project inference/disclosure, poisoned feedback, forged human/execution evidence and resource abuse across delayed work.

The relevant principals are interactive reviewers, project members, machine credentials and delegated executors, platform/workspace guidance authorities, provider integrations and background services. The protected subjects are project/source records and exact revisions; beneficiaries of an unsafe action may include another project or a shared-method audience, not merely the requesting user. Project ownership, source entitlement, provider credentials, method approval, assignment and execution authority are separate decisions.

## 2. Boundaries crossed

| Boundary / independent probe | Authorization owner and evidence opened | Fail closed? / disposition |
| --- | --- | --- |
| Token → project REST/MCP; foreign project, revoked issuer, discovery while OFF | `B/auth/api-token-rest.guard.ts:22–54`; `B/mcp/mcp.service.ts:129–165,209–258`; C00:38, C04:964–970 | Project/scope checks exist. P-18 named-client/OFF enforcement is an acknowledged unimplemented gate. |
| Project owner → configured repository; own project with another checkout | `B/behavior-graph/graph-change-review.controller.ts:24–35`; `project-source-binding.management.ts:72–126`; `graph-change-review.module.ts:27–50` | Global allowlist enforced; source entitlement to this project unresolved. S0-01. |
| Verified capture → immutable source history; rebind/revoke/ref movement | `project-source-binding.ts:45–124`; `current-cache-graph.history.ts:110–174,207–228` | Binding/ref and membership rechecks exist; immutable configuration-generation extension remains planned. |
| Machine → human model approval → native run | `B/auth/auth.middleware.ts:24–37`; `B/behavior-graph/model-studio-models.controller.ts:85–104`; `model-studio-repository.ts:259–318,523–564` | Current principal-kind protection insufficient. S5-01; exact-hash checks do not establish human assent. |
| KB/import/graph text → effective instruction → proposal | `B/rag/rag-retrieval.service.ts:270–280,319–336`; `B/legacy/legacy.service.ts:21430–21514`; C04:1006–1036 | Candidate specifies separation correctly; current broad KB retrieval is not an implemented effective-method resolver. |
| Raw/manual/executor observation → coverage or corrected result | C01:1016–1028; C03:1573–1587; C04:970,1040 | Proposed trust classes preserve genuine human evidence and prohibit agent impersonation; runtime proof outstanding. |
| Feedback/shared guidance → new audience, activation or rollback | C04:960,1032–1036; C06:556–605 | Approval/assignment separate; private transfer forbidden; actual data/retention enforcement unproven. |
| Delayed work → notification/readback/cache/egress | `graph-change-review.delivery.ts:43–114`; C04:973–1012 | Existing notification membership/dedupe/readback are source-supported. New readers, exports, provider egress and budgets still require admission proof. |

S0 and S5 have findings below. **S8: PASS at design level, with gates** for Tesbo's applicable abuse mechanisms: enumerating hidden nodes, repeated scans/inference, poisoning quality signals and forging trustworthy completion. Marketplace credit/contact-specific attacks are inapplicable to this amendment. **S12: PASS at contract level, implementation unproven**: untrusted content cannot grant tools, scripts or publication; candidates cannot approve themselves or supply sole gold labels. Lint cannot prove semantic harmlessness. These PASS labels are not runtime passes.

## 3. Findings, most consequential first

### S0-01 — Source allowlisting is not a demonstrated project entitlement

**Severity HIGH if private sources share the registry; confidence HIGH in source behavior, UNKNOWN in deployed exposure. Evidence: source-read plus reasoned conditional attack; not reproduced. Classification: source-fit/admission gap, not proof of a live incident.**

The registry accepts only `root` and `repositoryId`; it carries no project/workspace grant (`graph-change-review.module.ts:37–48`). `setForOwner` authorizes ownership of the destination project and calls the global `isApprovedCheckout(checkoutKey, repositoryId)` check; capture subsequently trusts that binding (`project-source-binding.management.ts:75–126`; `project-source-binding.ts:39–42,84–119`). A qualifying project owner who knows a configured key/repository/ref can therefore select it without a distinct source-entitlement check in this path.

**Prerequisites:** a registry containing a source that is not approved for that owner's project, knowledge of identifiers/ref, and a supported bounded capture. The source is read and materialized under the destination project. When comparable source revisions change, receipts expose changed node IDs containing repository/file paths (`implementation-observation-graph.ts:102–109`; `qa-change-review-receipt.ts:75–95`; `current-cache-graph.history.ts:83–99`). I do not claim current code-body/secret exfiltration: inspected projections contain identities/digests, and a first baseline has no change receipt. Deployment registry contents were not inspected.

**Invariant:** permission to administer project A cannot itself authorize reading/promoting source B. C03:659 already requires source and destination ACLs; C03:1368/1384/1559–1561's instruction to preserve the checkout guard needs this additional source-fit decision. **Mitigation:** bind permitted source scope to the destination at configuration and capture/finalization, or document an accountable policy proving every registry entry intentionally shareable to all eligible projects. The latter is a legitimate alternative; no new service or mandatory table is required.

### S5-01 — Current model approval loses machine identity

**Severity HIGH; confidence HIGH; evidence source-read, not runtime-reproduced. Classification: confirmed existing prerequisite already covered by the candidate, not a new 1.4.29 contract omission.**

Bearer authentication puts the issuer in `request.userId`. The global token guard permits matching-project write routes except its narrow administration exclusions (`app.module.ts:59–61`; `auth.middleware.ts:24–37`; `api-token-rest.guard.ts:15–16,35–54`). The model approval controller passes only that user ID. Its owner checks project access and expected content hash, then records `approved_by=userId` (`model-studio-models.controller.ts:85–94`; `model-studio-repository.ts:266–304`).

**Prerequisites/blast radius:** an existing matching-project write token whose issuer remains eligible; an active model/current revision and its readable hash. The effect is a human-looking approval within that project, potentially becoming a later model-run basis, not platform-admin access or automatic target execution. **Invariant:** a machine credential must not stand in for independent action-bound human assent. C00 AD-10, C04:966–970 and R-ASE-23/34 already require the correction. Preserve principal kind through the shared owner and enforce the authorized exact-action decision there, including native AI paths operating inside a person's session. Merely adding an MCP-tool denial is insufficient.

## 4. Attack chains

S0-01 composes destination-project ownership, a globally selectable checkout and authorized-to-destination history reads into conditional source-metadata disclosure/materialization. S5-01 composes token-to-user attribution with model approval and later dispatch into false human authority. Their severity is the resulting confidentiality/integrity effect, not the highest component label. Neither chain was executed. No chain to arbitrary server filesystem reads, platform-root takeover or proven target Passed results was established.

## 5. Closure plan and retained gates

Both HIGH items remain **OPEN**; neither has an accepted residual risk or executed closure test.

- **S0-01 → regression closure:** extend T-455/456's existing ASE-FLOW-28/ASE-INT-07 acceptance with two authorized projects and distinct private source entitlements. An A owner submitting B's valid checkout/ref must leave binding, history, notifications and source disclosure unchanged. Pair with permitted A capture, revoked/rebound grants, and a deliberately approved shared-source positive control. Require actual native API/database proof in an authorized isolated fixture; static registry validation alone is insufficient.
- **S5-01 → regression closure:** extend ASE-INT-03 under existing native authorization/Model Studio tests. Deny admin-owned machine credentials on both MCP aliases and direct REST approval, with zero approval/status/audit-success effects; allow exact independently authorized interactive review. Include replay, stale hash/dependencies, revoked authority and native-AI-in-human-session cases. Bind proof to the implemented head and actual configured assent policy.
- Retain **P-18** before external discovery/calls, actual human/root-recovery authority, transaction/audit failure proof, every-writer migration and compatibility, and truthful historical unknowns. A release gate cannot be satisfied by naming a future guard.
- Retain **reader/egress proof** across direct/history/list, RAG, recent/folder fallback, graph, caches, exports and notifications. Ordinary non-`ai_memory` documents pass current retrieval filters; that is not evidence they are approved governing instructions. Prove no hidden names/counts/bytes after revocation and no sensitive prompt/evidence leakage into provider telemetry.
- Retain approved **numeric budgets**, token lifetime/revocation policy, source/provider authentication, retention/holds and recovery ownership. The inspected token service hashes tokens, deletes them for revocation and has no expiry check in authentication (`api-token.service.ts:123–174`); do not assume future consent expiry exists today.
- Retain Grey/White pre-gates, Graph closeout, exact-runtime original QA-loop/manual-case evidence and authentic UI/security interaction checks. No source-only receipt substitutes for any of these.

## 6. Residual risk and legitimate alternatives

Even correct server enforcement cannot guarantee an LLM's interpretation, evaluation labels or claimed improvement. Review fatigue, confidentiality after legitimate export, provider handling and operational detection remain separately accountable risks. No new provider/package was adopted here; related supply-chain and deployment claims remain unassessed rather than imported from Nesberry's deferrals.

A source-free manual workflow, deterministic graph projection, bounded read-only pilot, rejected method candidate or unchanged incumbent can all satisfy legitimate outcomes. Required authoring-method failure must not discard independently authorized raw failures or genuine manual observations (C04:970,1030). Unknown deployed policy is neither accepted risk nor proof of exposure.

## 7. Verdict

**RELEASE-BLOCK for exposing the proposed governed workflow on the pinned substrate.** This is advisory Security vocabulary, not CI authority or a product-release decision. The target's security direction is broadly coherent; S5-01 and the named reader/P-18 controls are expressly unimplemented prerequisites. S0-01 requires explicit source-entitlement disposition before private-source use. No additional broad security subsystem is justified. This receipt supplies neither a freeze nor proof that the candidate method improves discovery.

## 8. False-positive log

Direct client filesystem-root selection is prevented by server registry construction and strict binding fields. Git commands use `execFile`, scrub Git overrides, reject unsafe refs/paths and refuse symlink/submodule entries (`local-pinned-git-source.ts:12–16,33–101`). Forged JSON cannot substitute for the branded verified-source object (`current-cache-graph.history.ts:116–124`). Source projection explicitly asserts no execution/coverage (`implementation-observation-graph.ts:158–165`). These real controls do not answer the separate source-entitlement question.

Foreign-project MCP calls and invalid-bearer fallback to a browser cookie are refused in the inspected chain. Readable candidates, high confidence, repeated feedback and model-run dispatch receive no normative authority under the proposed C04 contract. Those design defenses are credited without pretending they have shipped.

## 9. Side findings and receipt preservation

No unrelated defect is promoted from this pass. Incomplete egress, browser, operational and whole-writer coverage remains named above; absence of a finding there is not a pass. Preserve this original unchanged. Any reconciliation, correction or later evidence belongs in a separately labeled informed delta.
