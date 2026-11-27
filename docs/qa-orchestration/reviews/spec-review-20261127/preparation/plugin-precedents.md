# Plugin precedent challenge — original researcher record

## Identity, scope and checkpoint history

- Reviewer: `/root/plugin_precedents`, delegated researcher; Purple/Blue precedent challenge.
- Research and report date: 27 November 2026. Report-save time observed at 11:53 UTC / 06:53 America/Bogota, immediately before report preparation.
- Repository inspected read-only: `/workspace/scratch/e50b253d95e4/tesbo`.
- Reviewed research revision: PR315, `7539a739243167b2d6709df1d644bd5b955f6ffc`.
- Reviewed file: `docs/qa-orchestration/reviews/plugin-ecosystem-obsidian-review.md`.
- Verified branch reference: `origin/docs/plugin-ecosystem-obsidian-review-20261126` resolved to that exact commit during inspection.
- The document's own implementation audit remains historically bound to `63648aa2166cb456bae3ac6695d8dc0a4a475cc3`. This researcher did not rerun that implementation audit and does not refresh those implementation claims by reviewing the newer document.
- Current task is research/specification reconciliation. The plugin platform remains proposed/backlog. No selected delivery profile, runtime, framework, marketplace, third-party execution or Obsidian-first implementation is approved by this report.

### Original checkpoint

The researcher's original final response ended: “No files or GitHub resources were changed. This research is ready to reconcile into the existing specification and research PRs. Parent should open the cited sources itself before using the retrieval references in the user-facing answer.” That statement accurately described the earlier checkpoint before this local report was requested.

### Dated report-save amendment

On 27 November 2026, following the explicit parent request below, the researcher saved this complete record as a temporary local review note. This is the only written artifact in this task. No repository file or remote GitHub resource was edited. The earlier checkpoint is preserved rather than rewritten as if a file had already existed then.

## Complete original assignment

> Research established plugin/extension architectures for Tesbo spec review. Read-only; do not mutate GitHub or files other than temporary notes. The user clarified that Obsidian is only one example; plugins are general possible extension categories, not an Obsidian-specific system. Plugin work is research/proposed backlog, not implementation authorization. Find primary official sources (VS Code, Backstage, Grafana, Jenkins/HashiCorp, optionally one test-tool ecosystem) covering successes, limits, pitfalls, lifecycle, compatibility, security/isolation, capability permissions, dependency and host API contracts, UX clarity, operability. Prefer 5-7 high-quality sources; identify precise mechanisms versus unsupported inference. Distill domain-agnostic principles with conditions and Tesbo-specific implications. Give URLs and source ref IDs, evidence limitations, adopt/adapt/reject/defer recommendations, no invented incident claims. Use web tools, source reviews current. Will send existing spec paths when recovered. Goal is useful challenge to existing specification, not a new parallel plugin architecture.

### Subsequent scope clarification and preservation requests

> Please inspect current research doc via local git: repo /workspace/scratch/e50b253d95e4/tesbo; git show origin/docs/plugin-ecosystem-obsidian-review-20261126:docs/qa-orchestration/reviews/plugin-ecosystem-obsidian-review.md. Own targeted Purple/Blue precedent challenge: identify exact corrections/new source matrix that fits this owner. Need no fabricated outcome evidence. Primary researcher evidence should be retained as full report in /workspace/scratch/e50b253d95e4/review-notes/plugin-precedents.md (temporary allowed). Include exact original assignment, methods/queries/sources, scope and uncertainty, reviewed input commit 7539a739, findings/adopt-adapt-reject-defer, recommendations. Do not edit repo. Later can perform White/fresh-eyes final review of changes.

> Please now persist your complete original assignment, method, sources with exact URLs, input revision (PR315 7539a739243167b2d6709df1d644bd5b955f6ffc), findings and limitations to /workspace/scratch/e50b253d95e4/review-notes/plugin-precedents.md. Your previous final said no files changed; preserve that as original checkpoint and add a dated report-save note. Inspect actual research via git show origin/docs/plugin-ecosystem-obsidian-review-20261126:docs/qa-orchestration/reviews/plugin-ecosystem-obsidian-review.md in /workspace/scratch/e50b253d95e4/tesbo to provide exact reconciliation suggestions. No repo or remote edits.

## Method and execution record

1. Used official-domain web searches through `mcp__codex_apps__search_service_web_run` with `system1_search_query` to locate current primary architecture, security and lifecycle documentation.
2. Opened selected official pages directly, then used targeted find operations for the decisive passages. Source dates/crawl metadata were read where returned; a crawl date is not treated as a publication date.
3. Separated documented mechanisms/limitations from this researcher's inference about Tesbo. No packages were installed and no upstream runtime behavior or quantitative success claim was independently reproduced.
4. Sent two early findings to the parent: Grafana's documented sandbox deprecation; VS Code's broad extension-host authority and HashiCorp's non-security magic cookie.
5. Delivered an initial research synthesis before repository inspection. That synthesis was a candidate challenge, not a claim that every candidate gap existed in the Tesbo document.
6. Located the shared checkout read-only with `rg --files`, then read the specified research file using `git show` at the named remote reference. The first output was truncated around the common contract, so the missing material was read separately at the exact commit with numbered ranges. `git rev-parse` confirmed the remote reference equalled the supplied input revision.
7. Compared candidate implications against the actual existing clauses to avoid recommending duplicate controls. The exact reconciliation section below supersedes generic gap assumptions in the initial synthesis.
8. Saved this temporary record only. No tests, source edits, GitHub comments, reviews, branch changes, native Tesbo writes, or approval actions were performed.

### Exact web search queries

- `site.code.visualstudio.com api advanced-topics extension-host workspace trust extensions`
- `site.backstage.io docs backend-system architecture plugins services dependencies extension points`
- `site.grafana.com developers plugin-tools frontend sandbox plugin signatures compatibility`
- `site.developer.hashicorp.com terraform plugin architecture separate processes protocol version`
- `site.jenkins.io doc book managing plugins uninstall dependencies restart`
- `site.backstage.io docs backend-system architecture plugins isolation security module startup failure`
- `site.github.com/hashicorp/go-plugin README not secure plugins full access`
- `site.code.visualstudio.com docs configure extensions extension runtime same permissions vscode`

Targeted find patterns were `breaking`, `fail to boot`, `Major versions`, `A command can still`, `SHA256`, and `Stability` on the matching primary pages below. Search results from Reddit and Debian mirrors were not relied on; all retained substantive claims use primary project/vendor sources.

## Source register and factual findings

These are documented mechanisms and limits, not independently verified outcome studies. No blanket claim that a product is successful or secure is inferred from its popularity or documentation. Retrieved identifiers below are provided for reproducibility; parent must open the sources itself before citing them in a user-facing response.

### S1. VS Code runtime permissions

- URL: https://code.visualstudio.com/docs/configure/extensions/extension-runtime-security
- Refs: `turn500269113view0`, `turn102213399search3`.
- Verified: the extension host has the same permissions as VS Code; examples include files, network requests, external processes and workspace settings.
- Decision: **adapt** execution separation; **reject** an unqualified security-sandbox analogy.
- Principle: identify actual resource enforcement separately from execution placement, publisher trust and fault containment.
- Transfer limit: a desktop extension ecosystem has different tenant and credential boundaries from a shared Tesbo backend.

### S2. VS Code Workspace Trust

- URL: https://code.visualstudio.com/api/extension-guides/workspace-trust
- Refs: `turn441897051view4`, `turn623881937view3`.
- Verified: declared trust support can be full, limited or unavailable; sensitive workspace configuration can be withheld. Hidden commands can still be invoked, so execution checks or conditional registration are required.
- Decision: **adopt** centralized, operation-level enforcement; **adapt** its authorization model to existing Tesbo owners.
- Principle: presentation must not substitute for enforcement at every callable path.
- Transfer limit: workspace trust does not grant organization/project rights or authority to act for another user.

### S3. Backstage extension points

- URL: https://backstage.io/docs/backend-system/architecture/extension-points/
- Refs: `turn441897051view1`, `turn623881937view0`.
- Verified: small extension interfaces and separately exported contracts reduce coupling. Breaking changes can use a newly named/versioned extension point. A singleton task-runner example rejects a second registration.
- Decision: **adapt** narrow native-owner extension points and explicit cardinality/composition.
- Principle: an extensible boundary needs a maintained contract and deterministic ownership.
- Transfer limit: Backstage's addition-only interface guidance depends on its installation model; it does not remove Tesbo's lifecycle/revocation obligations.

### S4. Grafana signed artifacts

- URL: https://grafana.com/developers/plugin-tools/publish-a-plugin/sign-a-plugin
- Refs: `turn441897051view5`, `turn623881937view4`.
- Verified: signed manifests contain metadata and file checksums; signing and development loading are distinct workflows.
- Decision: **adapt** exact artifact identity and provenance verification.
- Principle: approved metadata must remain tied to the bytes that execute.
- Transfer limit: authenticity/integrity does not prove safe behavior, tenant permission or fitness. The existing Tesbo research already states this distinction and should be preserved, not duplicated as a newly discovered omission.

### S5. Grafana frontend sandbox lifecycle warning

- URL: https://grafana.com/docs/grafana/latest/administration/plugin-management/plugin-frontend-sandbox/
- Ref: `turn441897051view0`.
- Verified: the current page marks the public preview deprecated and says it will be removed in Grafana 13.4. It documents compatibility/performance qualifications and warns against untrusted plugin sources.
- Decision: **defer/reject as a selected implementation dependency**, retain as a cautionary precedent.
- Principle: verify support maturity, lifecycle and transfer conditions before adopting a mechanism.
- Transfer limit: this page does not establish the reason for deprecation. No failure narrative is invented. The existing Tesbo document does not cite Grafana, so this is a newly discovered transfer warning, not a correction of an existing false Grafana claim.

### S6. Jenkins lifecycle and dependencies

- URL: https://www.jenkins.io/doc/book/managing/plugins/
- Refs: `turn441897051view2`, `turn623881937view1`.
- Verified: the manager identifies safe uninstall candidates through dependency knowledge; deleting a required plugin can impair startup. Removal may become effective only after restart. Configuration retention and old-data purge are distinct.
- Decision: **adapt** dependency impact, effective lifecycle status and explicit retention consequences.
- Principle: requested removal, effective cessation and data erasure are different events.
- Transfer limit: Jenkins's restart model is not a requirement for Tesbo. Tesbo must specify its own effective transition for each admitted profile.

### S7. Terraform plugin protocol

- URL: https://developer.hashicorp.com/terraform/plugin/terraform-plugin-protocol
- Refs: `turn441897051view3`, `turn623881937view2`.
- Verified: protocol version is a separate compatibility input to registry selection. Major protocol versions delineate compatibility; minor changes are additive.
- Decision: **adapt** explicit compatibility dimensions and rejection before activation.
- Principle: the extension's release version does not fully describe its contract compatibility.
- Transfer limit: this does not select Terraform protocols, gRPC, Go, version numbering or any executable SDK for Tesbo.

### Supporting primary sources

- VS Code extension hosts and lazy activation: https://code.visualstudio.com/api/advanced-topics/extension-host ; refs `turn441897051view6`, `turn623881937view5`. Useful runtime-placement and loading-on-demand precedent; not proof of a security sandbox.
- HashiCorp plugin architecture: https://docs.hashicorp.com/terraform/plugin/how-terraform-works ; ref `turn939952930search0`. Describes separate-process plugins using RPC; this alone does not establish filesystem/network confinement.
- HashiCorp go-plugin README: https://github.com/hashicorp/go-plugin/blob/main/README.md ; ref `turn102213399search0`. Describes subprocess RPC, protocol versions, logs, checksums and transport qualifications; its local reliable-network assumption must not silently become a WAN design.
- HashiCorp handshake implementation: https://github.com/hashicorp/go-plugin/blob/main/server.go ; refs `turn500269113view1`, `turn102213399search2`. The magic cookie is identified as a UX check, not a security measure.
- Backstage overview: https://backstage.io/docs/backend-system/ ; refs `turn901246745search3`, `turn939952930search3`. Supporting owner/service/module vocabulary only; not a decision to adopt Backstage.
- Backstage architecture overview: https://backstage.io/docs/overview/architecture-overview/ ; ref `turn939952930search5`. Supporting distinction between deployment, plugins, modules and services; no Tesbo database split is recommended from it.
- Backstage next documentation, startup behavior: https://backstage.io/docs/next/backend-system/building-backends/index/ ; ref `turn939952930search4`. It is explicitly a `next` documentation route and is not used as evidence that a stable released implementation has the described configuration.

## Initial synthesis, preserved with its limits

The strongest precedents support small, versioned extension interfaces; explicit authority checks; lifecycle controls; and evidence tied to the installed artifact. They do not establish that Tesbo needs a marketplace, a universal runtime or an Obsidian-first implementation.

The initial research proposed asking the specification to identify: native owner authority; direct API/MCP permission enforcement; exact executing code/configuration/dependency identity; incompatible runtime/API rejection; singleton versus ordered/composable contribution registration; disabling/revocation behavior for queued/in-flight/late work; removal versus purge; dependency impact; attributable diagnostics; and distinct availability, installation, assignment, activation and health. These were candidate questions before reading the Tesbo file. The file inspection below found many already answered.

### Proposed verification conditions from that synthesis

All conditions are proposed and UNRUN; they are not native case IDs, executed tests or implementation claims.

| Area | Candidate observable outcome |
| --- | --- |
| Native owner | An extension cannot create a competing approval or result truth through another entry point. |
| Authority | Direct API/MCP invocation is refused when effective authorization denies the equivalent UI action. |
| Identity | Historical work retains enough artifact/configuration/contract identity to explain results after an update. |
| Compatibility | Activation rejects an incompatible requirement before effects and supplies an actionable reason. |
| Registration | Conflicting singleton contributions fail explicitly instead of depending on load order. |
| Revocation | New admission stops and stale effects cannot commit under a revoked grant. |
| Removal | Retained historical evidence remains understandable and its unavailable dependencies are identified. |
| Dependencies | A change identifies affected dependents and applies a declared block, disable or migration policy. |
| Operability | Diagnostics attribute plugin/version and correlation while respecting secret boundaries. |
| UX | Installed status alone cannot imply authorization, activation or health. |

## Exact reconciliation against PR315 at the pinned revision

### P1 — Broaden the evidence base at the current research owner

**Finding:** The file's `Evidence scope and existing work` and `Lessons to transfer` sections principally compare the supplied AQE/Quality Forge/Nagual ecosystem and Obsidian. The general model is appropriately proposed, but the wider mature-extension precedent the user requested is not yet represented there.

**Recommendation:** Add a compact `Established extension-system precedents` subsection between `Lessons to transfer` and `Existing Tesbo capability ownership`, or immediately after the current lesson table. Use S1–S7 as a source/mechanism/transfer-limit/disposition matrix. Record the 27 November read date, support/deprecation state, and distinguish documentation from tested outcomes. Preserve the supplied-source review, rather than replacing it or creating a competing architecture file.

**Claim limit:** Say these sources document mechanisms and pitfalls. Do not claim comparative success rates, measured performance, proven compatibility with Tesbo, or independent corroboration of AQE results.

### P2 — Remove residual delivery-priority ambiguity

**Finding:** Under `Obsidian: one illustrative knowledge-integration journey`, the heading at reviewed line 125 remains `First slice: selected source snapshots to linked proposals`. The surrounding disclaimers are correct, but this heading can still read as selecting Obsidian for first delivery.

**Recommendation:** Change the heading to `Illustrative snapshot flow: selected sources to linked proposals` or equivalent. Retain all scenario substance and the existing future-selection gate. This is a Purple clarity correction, not a change to user-approved scope.

### P3 — State extension-point ownership and composition semantics

**Finding:** The proposed contract table's `Contributions and effects` row defines named typed operations and output/effect declarations. It does not explicitly state whether an extension point has one implementation, deterministic composition, ordering or conflict resolution.

**Recommendation:** Extend that existing row or add a narrowly scoped contract row: each admitted point declares cardinality and composition/ordering; conflicting exclusive registrations are refused visibly; the current native owner remains authoritative. Cite Backstage as a design precedent, with its transfer limit.

**Scope:** Proposed contract refinement only. Do not add a registry, SDK, runtime or dependency solver now.

### P4 — Clarify compatibility dimensions rather than add another version system

**Finding:** `Identity and package integrity` already includes immutable version/digest, dependency pins and compatible host/API/schema versions. This is good coverage. Terraform adds an explicit reason to distinguish plugin release identity from the interface/protocol compatibility that the host admits; VS Code shows execution target can also change what is runnable.

**Recommendation:** Clarify that required runtime targets and contract compatibility are checked before activation, and incompatible inputs have an actionable refusal. Preserve the existing identity owner and avoid introducing a mandatory protocol technology.

### P5 — Include reverse-dependency impact in existing lifecycle/removal clauses

**Finding:** The document already preserves shared credentials/resources during removal and records dependency pins/health. It does not clearly require checking which other enabled contributions depend on an extension/version being changed or removed.

**Recommendation:** Extend the existing lifecycle/removal clause to identify affected dependents and the supported action (refuse, disable/drain or migrate). Surface when a requested change becomes effective for the selected profile, including restart only where actually required. Use Jenkins as a documented pitfall; do not impose Jenkins's restart model.

### Controls already present — preserve, do not duplicate

- Line 95 explicitly says module placement or declared permissions is insufficient isolation.
- Line 107 already distinguishes provenance from inherent safety.
- Line 109 already intersects tenant/project/actor permissions and checks authority at dispatch and commit.
- Line 111 preserves partial/refused/failed/cancelled/unknown outcomes without green defaults.
- Line 112 binds version, grant, inputs, target revision, environment, producer and observation time.
- Lines 113–115 cover idempotency, uncertain effects, bounded recovery, disable/revocation and in-flight cancellation limits.
- Line 114 already distinguishes installed, configured, authorized, enabled and healthy.
- Line 116 already separates uninstall from purge and protects shared resources and retained-history access.
- Line 117 already calls for freshness, backlog, failures, budgets, dependency health and affected-record visibility.
- Lines 119 and 161 explicitly keep qualification/acceptance proposed rather than implemented; no test result should be synthesized from them.

### Preserve historical/current distinctions

The source audit and PR status table in `Evidence scope and existing work` are explicitly historical. Any refreshed current status must be separately verified by the parent and labeled; this precedent review does not establish current deployed schema, owners, live authorization, merged PR status or test execution.

## Distilled engineering principle and contextual use

**Principle:** Learn from established mechanisms before choosing a solution, then prove that the lesson transfers to the present context.

For significant new capabilities or changes to shared contracts:

1. State the user outcome, constraints, existing owner and important failure conditions.
2. Inspect current implementation and approved proposals for reuse before proposing a subsystem.
3. Research comparable mechanisms and failure experience from primary documentation, source, advisories and postmortems; distinguish implemented behavior, vendor intention, experiment and measured outcome.
4. Extract a conditional principle: causal mechanism, assumptions, costs, counterexamples and known limits.
5. Choose adopt, adapt, reject or defer with a reason tied to the current context.
6. Link that decision to an observable behavior, adverse scenario, responsible owner and verification method.
7. Recheck freshness when adoption is imminent; retain prior evidence and explain any changed decision.

Research should be proportional to consequence. Routine local corrections can reuse a still-applicable record. New security boundaries, public contracts, lifecycles or architectural dependencies need fresh evidence. The principle does not require a fixed source quota, a new document for every edit, or large-company imitation.

### Assurance-team applications

- Blue: current implementation/reuse and source-owner map.
- Red: failure cases, non-transferable assumptions and counterexamples.
- Green: seams, contract change and compatibility.
- Security: actual resource and authority enforcement.
- QA: lifecycle, concurrency, recovery and discriminating assertions.
- Purple/Grey: user comprehension and complete task outcomes.
- Graph: ownership, conflicting contributions and traceability.
- Observability/operability: attribution, degradation, diagnosis and recovery.
- EG: challenge the analogy, hidden assumptions and excluded alternatives.
- White: inspect evidence strength, dissent and maturity; ensure research/spec merge is not reported as implementation or native acceptance.

These are recommended lenses, not a claim that separate independently qualified reviewers executed each role during this researcher task.

## Outcome, uncertainty and remaining work

**Research outcome:** Seven core primary-source records plus supporting references support targeted reconciliation P1–P5 at the existing research owner. Most baseline lifecycle/security obligations already exist and should be retained.

**No execution outcome:** No plugin, package, browser UI, Tesbo runtime, native records or external project was tested. No source was adopted as a runtime dependency. No security isolation or production behavior was certified. Evidence consists of current documentation/source reads and static review of the pinned Tesbo research file.

**Open uncertainty:** Actual support matrices, maintenance quality, licensing applicability to code reuse, performance costs, deployment model and permission enforcement require qualification if an implementation profile is selected. The wider source list is not a ranking of frameworks for purchase or adoption.

**Parent action:** Reconcile only accepted findings into current canonical owners and existing research PR; keep the four maturity states distinct. Preserve this raw assignment/method/findings record, read the external sources independently before citing them, and request final White/fresh-eyes review against the actual revised inputs if needed.

## Subsequent method-recovery qualification — 27 November 2026

After saving the precedent report, the parent requested exact recovery of the existing assurance methods. Those source files were fetched unchanged from `NesberryEnterprise/Nesberry@d83549c85a4dcd047fb40dc4fba4ec62737ab0fc` and verified against the historical archive manifest; see `/workspace/scratch/e50b253d95e4/methods/recovered-methods-manifest.json` and `review-notes/method-recovery.md`.

The original research assignment used Purple/Blue as scoped lens descriptions. This inherited-context researcher was not dispatched with the canonical cold-start method and no formal quorum was commissioned. This report is supporting research and contextual challenge, not a retroactively qualified formal Blue/Purple or Elephant-Gold receipt. The earlier recommended observability/operability item is a cross-cutting concern for the established owners, not an eleventh canonical team. Subsequent formal review must use the recovered methods, actual invocation evidence, the final pinned candidate and the documented quorum; inherited historical findings inside the candidate must be disclosed rather than described as blind discovery.
