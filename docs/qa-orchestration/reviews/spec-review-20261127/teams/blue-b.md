# Blue B original review — Tesbo v1.4.49 C1

**Review date:** 27 November 2026  
**Reviewer:** /root/blue_b, separately dispatched independent Blue member B  
**Evidence mode:** source/document inspection and isolated document-integrity calculations  
**Target:** frozen v1.4.49 C1, 1alextest/Tesbooboo; application source f92c3341eadc03f274becbead3b0f45d0a86539e  
**Original-output status:** frozen on save; no other member's report was read before this report was written.

## 1. Individual conclusion

The amendment has a coherent **Proposed / Backlog / NOT FROZEN** scope. Its contribution profiles correctly preserve native knowledge, Skills, Tasks/proposals, Runs, evidence and authorization responsibilities. The inspected source supplies substantial reusable infrastructure, but does not establish a general installable plugin host, a complete external-executor lifecycle, uniform package admission, or generation fencing across all integration effects.

I identify **one Must-Fix clarity finding for implementation/design freeze**, PLUG-BB01: the removal paragraph can be read as automatically revoking access to all retained source derivatives, although ordinary native integration disconnection deliberately preserves imported project knowledge. The proposal elsewhere preserves current native permissions and permitted history. These readings must be reconciled by naming the actual read authority being withdrawn. This is a specification ambiguity with concrete existing-behavior consequences, not a reproduced runtime incident.

This finding does not prevent retaining the amendment as an attributable research/backlog candidate. It prevents treating its source/removal contract as an unambiguous implementation instruction or issuing an unqualified freeze. No first plugin, executable hosting model, marketplace, package format, new persistence owner or implementation priority is justified by this report.

**Recommendation to the coordinator:** retain the proposed scope, reconcile PLUG-BB01 at canonical 03 with its requirement, workflow and acceptance consumers, and carry the existing implementation gates forward. This is an individual Blue recommendation. It is not a formal team quorum verdict, White disposition, deployed-owner signoff, human product decision, Graph CLEAN result, or method-effectiveness finding.

## 2. Exact commission and independence

The assignment supplied to this member was:

> Act as independent Blue Team member B for a source-based delta review of proposed Tesbo specifications. Read /workspace/scratch/e50b253d95e4/review-candidate-v149/RUN_CONTEXT.md and INPUTS.json, then unchanged Blue charter /workspace/scratch/e50b253d95e4/methods/.kiro/steering/teams/blue-team-charter.md plus orchestration and portability policy. Target candidate is frozen; unchanged product source is f92c3341 in /workspace/scratch/e50b253d95e4/tesbo. Derive your own connected v1.4.49 reuse/ownership/current-state review without other reviewers' findings. Source/document review only; no product mutation or test execution. Save complete original report /workspace/scratch/e50b253d95e4/team-reviews/blue-b.md, preserving exact assignment, methods/input identities, inspected scope, evidence, counterexamples and limits. Do not read other reports until yours is frozen. Two separately invoked members are commissioned, but do not claim deployed-owner participation or native human authority.

The dispatch was a no-history commission: this member received the assignment, workspace/system instructions and supplied input locations, not the author's prior conversation or another reviewer's conclusions. I derived the questions and source traces in this report independently. The frozen specifications and supporting research themselves contain historical judgments, named prior work and proposed mechanisms; that exposure was unavoidable and is disclosed. This is informed delta reconciliation, not blind opportunity discovery or a held-out comparison of review methods.

I did not read another team report, ask another reviewer for findings, or delegate this original judgment. The coordinator received progress and my independently derived clarification candidate. No candidate, charter, repository file, native Tesbo record, database or application state was changed. Only this original report is written.

The Blue charter requires two members for formal verdict and grounds membership in actual implementation participation. The coordinator commissioned two separately invoked reviewers; I do not claim to be a developer/deployer of Tesbo or that my participation supplies the missing deployed-owner evidence. The independent reports must be reconciled by the coordinator and White without relabeling agents as human authorities.

## 3. Input and method identities

### Frozen inputs

Root for this review: /workspace/scratch/e50b253d95e4/review-candidate-v149/.

INPUTS.json SHA-256 is **dd8fa57f48ebcfe054dc98c69215539ea669ac932136291a622f5fe123233bfb**. I independently recomputed it and verified all 13 listed byte counts and hashes.

| Input | SHA-256 |
| --- | --- |
| AGENTS.md | 8ae63e3c1d2a763cbde8ea60e7155bfca86487e16ec4823784175a5fb122920c |
| CLAUDE.md | 28b88704ded3772166d1764ab686794d2a2972b55cc3b6f0e20921be5be21e47 |
| docs/specs/agent-synchronized-engineering/skills-governance.md | e587d6754c58c8de33f67fbb0277c8814c8575ce8359a336b8f92a0a55cb6375 |
| docs/qa-orchestration/source-manifest.json | 702bb7c24023322e6ed9728ca90af87a001fb4964756fd3202f869e994753e27 |
| docs/qa-orchestration/00_README.md | 3d8723750db6bb3caeeb776ffac31baaa93017ba3777ee3921a10226bce93d70 |
| docs/qa-orchestration/01_PRODUCT_REQUIREMENTS.md | a552c1c310b75895a8fe852c78ce163606b3fd619dc180af06e4c98b42ea9d36 |
| docs/qa-orchestration/02_WORKFLOW_AND_UX_SPEC.md | e0cb04ab8fdba94b79f18d46a184b417e49565c56ee3b50492988116ce0c3b25 |
| docs/qa-orchestration/03_TECHNICAL_DESIGN.md | a9230d4d7bb64efb4ba2e247e66d0254f069b5e8303ac802ee67927f7d6c60a8 |
| docs/qa-orchestration/04_MCP_API_CONTRACTS.md | e87f1e9ddb2ac70c17ad2d06d7538e49c838ec71a8c7df7e314a5c6370d3c6fa |
| docs/qa-orchestration/05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md | ae7e1e160d8f10ad7c58fb56fc57fc05460784bc6475c8f65734a1a095481357 |
| docs/qa-orchestration/06_IMPLEMENTATION_AGENT_BRIEF.md | 279edcd5d6b941a3cd35e3fc877748d875efd36a967143b5b00a0cd5db512c17 |
| docs/qa-orchestration/07_UI_DESIGN_TASKS.md | a17f91dadbcf3e22c3f420126303d2ca7921d44665911fa50df423c0adaf8878 |
| docs/qa-orchestration/reviews/plugin-ecosystem-obsidian-review.md | c93d89f7e2e233bc0ceceaa34bbd9fe366473e6fafa7b2567e2d11acf818a5e1 |

The source manifest identifies research parent 7539a739243167b2d6709df1d644bd5b955f6ffc and the historical v1.4.48 archive, version 33, 707,628 bytes, SHA-256 6665ba660aa208bd35db51b90052fc0b69abc01c6922c197544003e3480b1bef. I used the unpacked v1.4.48 bodies for a delta comparison; I did not independently download or certify the archive or its publication state.

### Unchanged methods

Method source: **NesberryEnterprise/Nesberry@d83549c85a4dcd047fb40dc4fba4ec62737ab0fc**, recovered under /workspace/scratch/e50b253d95e4/methods/. These three complete method documents were read, and their bytes/hashes independently matched recovered-methods-manifest.json.

| Method | Version/authority | SHA-256 |
| --- | --- | --- |
| .kiro/steering/teams/blue-team-charter.md | Blue v2.7 | 1d6d78da69b3c55533740005a48082b6fc5f27c620ce66f50917fd180523c816 |
| .kiro/steering/teams/review-orchestration.md | Canonical orchestration, including portability and anti-overfitting admission rules | 8fd41f22e1909afd48d8af95120d03a0f52e30a1bf9976a639fb6cca67bb4729 |
| docs/policies/governance/POL-GOVERNANCE-ASSURANCE-PORTABILITY/v001.md | Active v001; documentation-only enforcement | 33c69cba82f7d98773e85a30fa1afff15cc0dbcec0d88302a0295ce06e2c8524 |

I applied capability reuse, ownership, problem reconstruction, consequence tracing, scope classification, current-source grounding and stage honesty. Nesberry marketplace categories, deployment commands and founder powers were not imported into Tesbo. This post-design review cannot retrospectively satisfy Blue's pre-architecture timing gate.

## 4. Inspected scope and evidence notation

In the remainder, **C00–C07** mean the respective frozen canonical files under docs/qa-orchestration/. **B/** means Tesbo-Backend-Nest/ and **F/** means Tesbo-Frontend/, always at the pinned application commit above. Source references identify code inspected with git show or git grep against that commit; they are not observations of a running service.

I read all eight supplied canonical diffs completely, including every v1.4.49 addition and the inserted canonical 06 quality/transfer paragraphs. An independent unified-diff calculation verified that each supplied diff exactly matches its frozen candidate and saved v1.4.48 bodies. I did **not** read all historical text in all eight large files.

Additional document inspection comprised:

- RUN_CONTEXT.md, INPUTS.json, source-manifest.json, AGENTS.md and CLAUDE.md completely.
- The supporting plugin-ecosystem-obsidian-review.md completely, including the research scope, source ownership, conditional source journey, precedents and unresolved decisions.
- Skills governance headings and section 13.1 through 13.4.1, including the subordinate canonical-method reference.
- C01 FR-058 and selected T-422/FR-107 Skills context; C05 T-408–410 and delivery sequencing.
- C03 revisions 1.4.46, 1.4.47 and 1.4.48 by selected ranges, including their source/maturity, authority, telemetry, lifecycle, isolation, recovery and coordination boundaries. An initially truncated combined read was not treated as a complete file read; the omitted 1.4.47 source/maturity opening was reread separately.
- C04 source namespace clause at line 493; ASER-C02 and ASER-C03 through the opening of ASER-C04, lines 943–978; selected retry/permission and source-history references located by search.
- Targeted searches for disconnect, retained-source access, namespaces, requirement/task ownership and historical implementation claims. Search hits do not imply full inspection of all surrounding historical contracts.

### Source evidence ledger

| Ref | Actual inspected source | Material evidence and scope limit |
| --- | --- | --- |
| S1 | B/package.json and F/package.json, complete | NestJS/TypeScript, PostgreSQL and BullMQ backend dependencies; Next/React frontend. No dependency installation or lockfile-resolution audit. |
| S2 | B/migrations/V47_integration_connections.sql, complete | Organization/provider unique connection; migration collapses former project Jira connections and repoints mappings/tickets. |
| S3 | B/migrations/V72_integration_sync_pipeline.sql, complete; targeted migration-chain key search | Project/provider/external-ID/source-role mirror uniqueness and active project/provider sync-run uniqueness. Search found the V45 predecessor, V72 replacement and V73 commentary; no broader database migration execution. |
| S4 | B/migrations/V73_knowledge_document_comments.sql, complete | Human comments have their own owner; edited legacy Notes survive as ordinary native documents; untouched skeleton Notes are retired. |
| S5 | B/src/integration-sync/integration-sync.types.ts, complete; integration-sync.client.ts lines 1–240 | Fixed Jira/Linear/Notion provider union; queue payload lacks connection/configuration generation; connection lookup is organization/provider and token refresh uses a row lock. Provider implementations after line 240 were not fully read. |
| S6 | B/src/integration-sync/integration-sync.processor.ts targeted capability search and lines 453–625 | Ticket processing reloads current provider connection, reads prior mirror by project/provider/external ID, and upserts native KB mirror with V72 key; preserves separate comments and enqueues embedding. The rest was searched, not fully audited. |
| S7 | B/src/integration-sync/integration-sync.service.ts lines 86–194 and 260–326, plus named-method search | Native run receipt, scoped queue job identities, bounded retries, active-run status settlement and progress/readback owner. No proof of a universal effect fence. |
| S8 | B/src/legacy/legacy.service.ts lines 14878–14947 and 12421–12525 | Workspace-owner disconnect clears credentials, disables mappings, preserves source records; project-authorized knowledge/history reads remain native. |
| S9 | B/src/skills/skills-governance.ts, complete, lines 1–190 | Native project assignment resolution to approved immutable KB versions, exact basis digest, conflict/stale/unavailable handling. |
| S10 | B/src/legacy/legacy.service.ts lines 17284–17372 and 17421–17505; targeted resolver-consumer search | Candidate skill uses native draft KB document/profile and scoped retry identity; human-only assignment rechecks authority and approved immutable version. Selected slices only, not the full approval implementation. |
| S11 | B/src/mcp/mcp-access.ts, complete; mcp.service.ts lines 1–240 | Native grant schema/predicate; default-off project access; current grant/credential/project checks; declaration/discovery independent of authority. Final transaction coverage for every tool not established. |
| S12 | B/src/mcp/mcp.tools.ts named-tool and selected description search | Existing case, Run/execution, KB and proposal exposure; fixed native dispatch, not evidence of a generic plugin loader or complete executor claim/report/retest protocol. Tool declarations are not discovery receipts. |
| S13 | B/src/automation/automation.service.ts lines 1–200 and named create/attach/result/close/evidence/lock searches | Existing cycles/cycle_items/executions, project case IDs, approved-case admission, finalization and evidence owner; full bodies of later methods not audited. |
| S14 | sdk/playwright-reporter/src/index.ts lines 1–180 | An external reporter already exists, with case tags, optional configuration, CI-preservation behavior and per-case result accounting. Packaging/runtime acceptance not executed. |
| S15 | B/src/rag/rag-retrieval.service.ts lines 1–205 | Native hybrid retrieval and diagnostic distinction; existing explicit-source path remains separate. Full SQL filters and all callers not audited. |
| S16 | B/src/app.module.ts, legacy/legacy.module.ts and mcp/mcp.module.ts, targeted wiring search | Source imports/registers native modules. Wiring is stronger than an unused file but does not prove a deployed path. |
| U1 | F/components/settings/IntegrationsTab.tsx, complete | Three built-in provider cards, owner-managed disconnect, billing presentation, state loader and handlers. Failed status requests are locally converted to disconnected. |
| U2 | F/components/integrations/ProjectIntegrationMapping.tsx, complete; Notion project integration route, complete | Shared source-mapping component, selected provider binding, sync/native KB navigation, context-specific copy, one remote mapping, preserved imported docs after rebind. |
| U3 | Workspace integration redirect route, complete; workspace settings route targeted tab/role search; F/lib/api.ts lines 3980–4038 | Actual route/tab and API consumers, disconnect endpoint and current status interface. Workspace settings route was searched rather than fully read. |
| U4 | F/components/ui/Button.tsx, Card.tsx and PageLoader.tsx, complete; F/app/layout.tsx, complete; globals.css lines 1–110 and font references | Shared button/focus/loading primitives, theme tokens, local Inter/JetBrains fonts. This is partial style inspection; no viewport/render/accessibility outcome is established. |

Any originally truncated search or inventory output was used only for the displayed matches. No whole-repository, complete code audit, full UI reconstruction, current deployed schema, or production absence claim follows.

## 5. Independently derived review questions and problem model

I used these connected questions, rather than requiring a particular plugin shape:

1. What useful outcome survives removal of the word “plugin,” and which native record must remain authoritative when its producer disappears?
2. Can an existing importer, external client, declarative Skill candidate or report reader supply the outcome without an executable package?
3. Which identity is stable across release, connection replacement, project enablement and retry? Which can change without rewriting history?
4. What actually grants a source read, native proposal, approved case, Run admission or effect? Are these independent of installation?
5. What changes when a connector stops, an underlying source grant is revoked, a person loses project access, or a renderer is removed?
6. Which consumers would break if provider-name lookup or one installed flag were promoted to the shared owner?
7. What evidence can this documentation review establish, and which claims require a real selected implementation and actor?

### Actors and jobs

The observed source distinguishes workspace owner control over integration credentials from project-level access and human owner/manager controls over MCP grants and Skill assignment. Members need to read permitted knowledge, create or review native work, and reopen useful results. External clients, source-sync workers and automation reporters produce different observations/effects. A human review is not interchangeable with the credential issuer, common MCP actor, plugin publisher or model.

The independent user outcomes are: obtain selected external knowledge; apply an authorized method; execute an approved test and retain evidence; inspect an analysis or report; and withdraw or replace a contribution without corrupting native work. None requires that every contributor be executable, installed in the host, or displayed through one catalog.

### Semantic completeness matrix

| Problem dimension | Evidence | Target representation | Disposition | Owner or remaining gap |
| --- | --- | --- | --- | --- |
| Useful outcome and optional core path | C01/C02/C05/C07 v1.4.49; S14 | Profiles begin with a task, allow existing/manual/client paths | REPRESENTED | Selected native domain; first delivery deferred |
| Identity across source, package and native artifact | C03/C04 v1.4.49; S2–S6 | Separate release, instance, connection, project generation and operation basis | REPRESENTED | Actual namespace/generation schema is conditional design work |
| Native authorship and human reliance | S9–S11; C04 ASER-C02/C03 | Approved version, assignment, candidate and result remain separate | REPRESENTED ELSEWHERE | Existing KB, Skills, proposal and native review owners |
| Contribution composition | C03/C04 v1.4.49 | Singleton/additive/ordered alternatives | REPRESENTED | No runtime registry presumed |
| Stop versus data-read authority | C03 line 2141; S8; U2 | Lifecycle and retention partly separate, revocation scope ambiguous | MISSING clarity | PLUG-BB01; source and knowledge authorization owners |
| Asynchronous replacement and stale work | S5–S7; C03/C04 | Current-generation fencing required | REPRESENTED, implementation DEFERRED | Native connection/configuration owner and actual effect writer |
| Historic interpretation after removal | C02/C03/C04/C05 | Preserve permitted history; renderer loss explicit | REPRESENTED | Native evidence reader; exact profile fallback still to qualify |
| Workload and support | C03/C05 v1.4.49; inherited v1.4.47 | Require selected budgets, measured degradation and support decision | DEFERRED | Applicable operator/technical owner before implementation |
| New install/enable permission powers | C05 and research decision table | Must resolve against existing authority | DEFERRED | Actual accountable owner, not this reviewer |
| UI and human comprehension | C07; U1–U4 | Existing surface extension with later authentic proof | UNKNOWN — NEEDS EVIDENCE | SOURCE-INSPECTED / VISUAL-BASELINE BLOCKED |
| Empirical advantage of new method | C05/C06 and Skills subordinate view | Separates proposed, implemented and demonstrated effective | UNKNOWN — NEEDS EVIDENCE | Existing evaluation/review owner; this run is not an experiment |

## 6. Capability-reuse matrix and as-is ownership

Maturity below is relative to the proposed complete contribution contract. **PARTIAL** means concrete native implementation supplies a subset, with runtime/deployment unverified here. I do not label wired source BUILT+LIVE without running/deployment evidence, or BUILT+DARK-UNWIRED merely because I did not execute it. SPECIFIED ONLY refers to the added contract, not a claim that all adjacent implementation is absent.

| Required capability | Existing owner | Maturity | Reusable | Extend | Extract | Missing/evidence | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Connect one built-in provider and map it to projects | Native integration connection/configuration/mapping | PARTIAL | Credential handling, workspace/project split | Selected source binding and generation only when needed | No extraction yet justified | S2/S5/S8/U1/U2; general installation is not present in these owners | EXTEND EXISTING SUBSTRATE |
| Track intake, progress and native source readback | IntegrationSyncService/Processor, KB | PARTIAL | Jobs, run receipts, mirror rows, comments, embedding enqueue | Source namespace, binding freshness, committed-effect fence | Provider adapter seam is plausible; do not create a scheduler | S3–S7; exact plugin profile enforcement unqualified | EXTEND EXISTING SUBSTRATE |
| Preserve human annotations across source refresh | Native KB comment owner | PARTIAL | V73 comments rather than obsolete Notes siblings | Adapter-specific anchoring if needed | None shown | S4/S6; runtime anchor behavior untested | REUSE UNCHANGED |
| Candidate method import and effective assignment | Native KB versions, skill_profiles, skill_assignments, resolver | PARTIAL | Draft identity, immutable approved version, human assignment, digest | Package assets/dependency semantics only if selected | No second method resolver | S9/S10; package loader and efficacy not proved | COMPOSE |
| Scoped tool invocation | Existing MCP/authorization/native domain writers | PARTIAL | Current project/client grants, per-tool permissions, native handlers | Any selected adapter's protected-effect admission | No parallel MCP authority | S11/S12; request-entry check is not all-worker commit proof | EXTEND EXISTING SUBSTRATE |
| External test result/evidence handoff | AutomationService and existing reporter | PARTIAL | Native cases, cycles/items/executions, attachments, case tags | Actual additional executor capabilities and lifecycle | Optional adapter, not second Run store | S13/S14; complete T-408 protocol is not established | COMPOSE |
| Report/analysis projection | Native result/evidence readers and proposals | PARTIAL | Read existing native facts, keep inference attributed | Chosen renderer/export and its destination controls | No independent result truth | C03/C04; report reader source not fully audited | INSUFFICIENT REPO EVIDENCE — DO NOT FREEZE |
| Arbitrary UI or executable plugin lifecycle | No complete existing owner established by this bounded inspection | SPECIFIED ONLY | Existing native surfaces and effect owners remain | Choose only after profile/threat-model decision | No generic host extraction justified yet | No build/run evidence or broad absence proof | INSUFFICIENT REPO EVIDENCE — DO NOT FREEZE |
| Precedent/transfer decision record | Existing AGENTS principles and C06 procedure | SPECIFIED ONLY as new refinement | Existing work/review record and method owner | Applicability, alternatives, evidence and recheck trigger | No registry/service needed | No comparative efficacy proof from this review | COMPOSE |

The absence of a complete plugin platform is not an argument to create one immediately. A first-party compiled importer, inert content package, ordinary API client or native report can each be a valid answer. Conversely, “reuse the integration service” does not make its provider-name lookup sufficient for multiple account namespaces or prove queued-effect revocation.

### Orthogonal axes and Brand Deletion Test

| Proposed noun | Facts/invariants claimed | Nearest native siblings | Classification after deleting the brand |
| --- | --- | --- | --- |
| General plugin | Package identity, admitted contributions, compatibility, optional lifecycle | Integration connection, Skill version, task executor, native module | Cross-cutting delivery/admission dimension; no new QA business-truth owner justified |
| Source plugin | Source selection, namespace, provenance, sync | Existing integration plus knowledge source | Supporting input to knowledge/authoring; source identity belongs to its native source owner |
| Skill plugin | Reusable method content and package provenance | KB Skill candidate/version and assignment | Content distribution; approval and effective method remain native |
| Executor plugin | Actual permitted execution and report | Task/attempt contract and AutomationService | Execution participation; package cannot own a case oracle or official result |
| Report/UI plugin | Presentation or selected action | Native reader and action owner | Projection when read-only; action remains the native module's effect |

Package dependencies and task prerequisites are distinct because one governs admission/compatibility of a contribution and the other governs a particular piece of work. A relationship between them may be traced, but combining them into one independently mutable graph owner is not justified.

### Participation scope matrix

| Relationship/context | Primary subject | Semantic role | Source context / attachment | Independent acceptance | Canonical owner / projection | Maturity |
| --- | --- | --- | --- | --- | --- | --- |
| Use selected external notes | Source bytes and native snapshot | Supporting dependency | Source connection plus exact selection/revision | Source acceptance does not approve a native requirement | Integration/KB; picker and native source link | PARTIAL + proposed adapter |
| Apply an imported method | Approved method version | Intrinsic method content, supporting authoring dependency | Project/module/operation assignment | Human version approval and assignment remain separate | KB/Skills resolver; contextual guidance view | PARTIAL |
| Execute a test through an external runner | Native approved case and execution | Execution-only contribution | Authorized project/task/attempt/target | Run admission/result rules independent of package admission | Native Runs/evidence; reporter/status view | PARTIAL |
| Open a contributed report | Native permitted observations | Presentation/projection-only when read-only | Exact result/evidence scope | Export destination may need its own authority | Native readers; optional renderer | Design-only profile qualification |
| Disable a source connector | Future collection capability | Lifecycle control, not automatically all historic read access | Connection or enablement scope | Source-reader revocation is a different decision if scope differs | Integration control plus knowledge authorization | PLUG-BB01 |
| Package-to-package dependency | Required contribution capability | Supporting dependency | Contribution admission closure | No automatic task or human approval | Selected admission owner, not a new business domain | SPECIFIED ONLY |

A commercial “exchange leg” is not demonstrated in this problem; no marketplace, purchasing or settlement capability was selected. That classification is N/A for this bounded review, rather than borrowed from Nesberry.

## 7. Consumer and semantic consequence sweep

| User expression / semantic truth | Authored, observed or derived | Owner and scope | Readers/writers and mutation consequence |
| --- | --- | --- | --- |
| “Connected” | Connection configuration plus observed validity, not approval | Integration connection at workspace/provider | Workspace UI, project mapping, sync jobs; reconnect may change source identity and cannot relabel history |
| “This project uses this source” | Authored mapping | Project mapping and source binding | Intake, requirements/KB, RAG, history and delayed jobs; replace mapping requires old-event disposition |
| “Imported content” | Observed received/provider bytes; native retained record | Knowledge source/document and its versions/comments | KB UI, source history, authoring context, embeddings/retrieval; refresh must preserve independent human annotations |
| “Approved method” | Human decision on exact native version | Skill version plus independent assignment | Resolver and protected authoring/apply consumers; package import alone does not activate |
| “Run passed” | Admissible actual execution result | Native execution/result owner | Run/history/report/traceability readers; an analysis, rendering or receipt upload cannot synthesize execution |
| “Disabled/removed” | Requested control and separately effective effect | Selected contribution/connection and native writer | Queue admission, queued work, external in-flight effects, history readers; must not imply either physical termination or universal history erasure |
| “Current health” | Timestamped observation / projection | Actual runtime observer | UI and operator diagnostics; failed lookup cannot become a definite absent connection |

The most important existing consumer seam is visible in S6: a ticket job reloads a connection by organization/provider after being queued, and the native mirror upsert uses project/provider/external-ID/source-role. Merely adding a connection identifier to a future manifest would not change those consumers. S7 stores a connection ID on a run but the queued payload and ticket processing need the selected immutable binding/generation contract. This is a concrete future extension seam, not a reproduced cross-account collision.

S7's failActiveRunsForConnection updates run state. The inspected final KB write in S6 does not visibly consume a run-generation fence. Therefore, a terminal run row cannot be used as evidence that all effects are stopped. C03 v1.4.47 and v1.4.49 already require effect-boundary fencing; that existing requirement is the right owner. This source review does not declare that guard implemented or a live bypass demonstrated.

## 8. Unlike-profile traces and counterexamples

These are source-grounded design traces, **not executed acceptance**.

### Trace A — selected source to retained native knowledge

**Actor and goal:** an authorized member wants selected notes available to the project and optionally to native authoring. No first provider is selected.

**Trace:** exact selected bytes/source context → authorized intake at integration/KB owner → native source identity and receipt → optional candidate creation under current Skills/authoring rules → separate human apply/approval → native source/history readback.

**Required observation:** source receipt, native record and any proposal independently identify the selected bytes, destination and authority. A changed source is not a changed approved oracle.

**Forbidden effect:** source metadata such as “approved” cannot publish a case or activate a Skill; another connection's equal external ID cannot replace the record; a lost response cannot create a duplicate blind retry.

**Conforming alternative:** a manual selected upload can be sufficient and may carry declared provenance rather than verified original-vault provenance. It needs no plugin install, vault credential or arbitrary code execution.

**Existing seam:** S2–S7 show reusable queue/source owners with a conditional namespace/generation extension. S4 protects human comments as an independent fact. Source permission revocation and plain disconnect must be distinguished as in PLUG-BB01.

### Trace B — inert method package to approved effective guidance

**Actor and goal:** a permitted author wants to propose reusable guidance; an authorized human may later adopt it.

**Trace:** supplied package/text as untrusted candidate → native KB Skill draft/profile → exact submitted/approved immutable version → separate human project assignment → resolver computes active approved basis → native protected operation pins/rechecks that basis.

**Required observation:** native draft identity, exact version/digest and assignment are separate. S9/S10 establish a real native subset for those boundaries.

**Forbidden effect:** importing text, approving its prose, observing repeated success, or installing package scripts cannot activate code or silently become a governing assignment.

**Conforming alternative:** decline, defer or keep the candidate for read-only inspection. A useful method can be a reviewed document and need no executable package.

**Limit:** this source inspection did not prove arbitrary package resource loading, every module consumer, full instruction delivery or comparative effectiveness. Existing resolver success is not evidence of improved QA.

### Trace C — existing external reporter to native execution evidence

**Actor and goal:** an independently operated runner reports actual results for native cases.

**Trace:** existing approved case IDs and authorized project target → external execution under its own permitted environment → reporter submits result/evidence → native cycles/items/executions retain case identity → current authorized readback and reporting.

**Required observation:** independent native result readback and evidence explain what really ran, against which case/build/environment, including absent or failed ingestion.

**Forbidden effect:** package or report success cannot create an approved case, become proof of target execution, or bypass the native result owner. A denied/unknown/partial result must remain distinguishable.

**Conforming alternative:** the current external reporter/client can continue without a Tesbo-installed plugin. S14 explicitly separates CI success from reporter ingestion behavior; downstream integration proof must therefore reopen the native result.

**Limit:** S13/S14 show implemented reporting substrate. They do not prove T-408's complete task-claim/progress/retest/cancel contract, an installed general adapter, arbitrary runtime stopping, or end-to-end native acceptance.

### Counterexample to a universal plugin architecture

A declarative method package never executes a process, while an external executor may cause effects in a separately operated environment that Tesbo cannot physically stop. A universal “installed/running/stopped” enum would misrepresent at least one. The proposal correctly treats these as distinct meanings and profile-specific transitions, allowing no-plugin paths. This is a supported architectural constraint, not a recommendation to implement every profile.

## 9. Finding

### PLUG-BB01 — Name the revoked read authority separately from connector removal

**Severity:** Must-Fix before implementation/design freeze; backlog publication can remain Proposed with the issue open  
**Category:** Clarity / Consistency / Implementation-Grounding  
**Status:** Open  
**Affected owner:** canonical 03 lifecycle/removal contract, with C01/C02/C04/C05/C07 consumers

**Observation.** C03 v1.4.49 line 2141 instructs the reader to separate uninstall from purge, honor retention/holds, and “revoke access to retained snapshots, caches, embeddings and derived metadata.” In that paragraph the direct subject is disable/remove. It does not name whether the withdrawn right is the removed package's access, a person's current project/source read grant, or the external connection's future collection authority.

The existing native meanings are materially different. S8, LegacyService.integrationDisconnect lines 14887–14933, clears connection credentials and disables mappings while explicitly leaving imported knowledge visible. getKnowledgeDocument lines 12431–12440 checks project access and reads the native document; it does not depend on the connection remaining active. U2 lines 285–291 likewise says switching the remote mapping leaves already-synced documents in place. These are source-observed ordinary behaviors, not a deployed verification.

**Impact if implemented under the broad reading.** A routine connector removal could deny legitimate project reads or invalidate knowledge used by authoring even though no native read grant was revoked. Under the opposite weak reading, an implementer might preserve derivatives after a genuine source/project read revocation merely because historical records survive. Both readings are plausible from “retention” plus unqualified “revoke access,” and they have different authority and migration consequences.

**Counterevidence and narrowed claim.** C01 obligation 5 says access revocation still applies to retained data; C02 preserves governed history and existing retention rules; C04 requires current permission before returning old sensitive output; C05's historical-result scenario distinguishes permitted history from revoked derivatives. Those clauses support the intended separation. The finding is the missing explicit scope in C03 and its future transition mapping, not a claim that the entire amendment demands deletion or that every retained mirror is lawfully readable forever. Existing code itself is not the oracle for a new privacy policy.

**Recommendation.** At canonical 03, explicitly distinguish:

1. stopping collection or disabling/removing an executable contribution;
2. revoking that contribution's own credentials and scoped access;
3. revoking a person's/source's governing read grant for retained material;
4. retention, deletion and lawful independent native historical access.

Apply retained-source and derivative denial when the actual governing read authority is withdrawn; do not infer a universal knowledge-read revocation from a connector lifecycle change. Preserve the existing native disconnect meaning unless its accountable policy owner explicitly changes it. If the selected profile introduces source-specific retained-data ACLs beyond current project access, name that migration and all reader/index/export consumers before implementation.

**Discriminating conceptual check.** Same project/reader and imported record, two scenarios: (A) disconnect collection while retaining the same valid native project/data rights; (B) revoke the actual right that governs reading those source bytes. A must preserve the legitimately permitted record/readback; B must deny its restricted source/derivatives, including search/snippet/cache/embedding-derived exposure, while separately authorized native history follows its own policy. Do not use one “disconnected” boolean as the oracle for both.

**Verification needed.** First reconcile the documented meaning and accountable authority. Then the selected implementation needs actual reader/worker/cache/export tests under both scenarios and a native history check. None was executed here.

## 10. Current UI KEEP / EXTEND / EXTRACT map

**Evidence label: SOURCE-INSPECTED / VISUAL-BASELINE BLOCKED.** No screenshot, actual component render, browser interaction, viewport comparison, keyboard test, accessibility audit or human comprehension session was performed.

| Current source surface | KEEP | EXTEND if a profile is selected | EXTRACT decision |
| --- | --- | --- | --- |
| Workspace IntegrationsTab and its redirect/settings-tab entry | Native connection management, current role/billing semantics, native Manage paths and shared primitives | Distinguish unknown status from disconnected; add only admitted capability/state information | No marketplace/catalog engine justified by three cards |
| ProjectIntegrationMapping and Notion route adapter | Source-specific field/copy adapters, one selected remote source, return links, sync progress and native KB/requirements destinations | New source scope/cardinality only with native contract and migration; truthful dependency/readiness state | Existing shared component already demonstrates composition; keep different outcomes contextual |
| Shared Button/Card/PageLoader and app theme/fonts | Existing tokens, real controls, focus styling and loading announcements | Verify selected errors, focus return, zoom/reflow and responsive states in actual render | No new UI primitive justified by branding |
| Future executor or report surface | Preserve native task/Run/evidence owner and destination | Must inspect that chosen route/components/data/permissions at implementation pin | Not fully inspected here; no current-pixel or parity claim |

U1 lines 77–86 catches integration-status errors into connected=false. That is a **current-source limitation relevant to the proposal's truthful-state acceptance**. It is not a new v1.4.49 regression, and this report does not authorize a product fix. A selected implementation must extend the real loader/state contract rather than assume existing provider cards already satisfy unknown/degraded/freshness requirements.

The selected source UI inspection is intentionally narrower than all future plugin profiles. Once an executor, report or product/UI contribution is actually selected, its full current route, shared consumers, style/permissions and authentic running baseline must be reconstructed. A source-inspired mock would not close that gate.

## 11. Remaining gates, qualifications and methods disposition

These are explicit future proof obligations or evidence limits, not additional discovered defects:

- **Profile and authority:** select the real outcome and distribution/execution model, then resolve install/connect/enable/upgrade/remove powers against native roles. A reviewer cannot supply those powers.
- **Source evolution:** prove exact connection/configuration identity, namespace and delayed-work handling. S2/S3 confirm the proposed conditional multi-source migration concern; no live collision was reproduced. Serial rebind/rotation also needs current-generation qualification even when only one connection is active.
- **Effect fencing:** current request authorization and run-status settlement do not establish universal commit-time denial. Use the real protected writer, queue and external boundary. Preserve unknown external effects.
- **Package admission:** test the actual distribution artifact, manifest/interface/runtime/dependency closure, conflict semantics and required hooks when any are selected. Logical fields in C04 are not advertised tools.
- **Runtime and UI:** no runtime tests, native approvals, effective Skill activation, component render or human tasks ran. The package is not implementation-ready merely because its documents connect.
- **Resource budgets:** C03/C05 defer actual volume, completion deadlines, queue-age/fairness/retry/cost limits to the selected workload. That is proportionate while no profile/runtime has been selected; the same deferral would be unacceptable as an implementation exit.
- **Method qualification:** C06's single procedure owner and subordinate references avoid another independent method store. Reuse/no-change/reject/unknown remain valid research results. The unchanged orchestration's cross-application admission and anti-overfitting obligations still apply before a broader reusable rule is admitted as validated. This informed review does not prove those outcomes, improved discovery or causal benefit.
- **External precedent:** I read the supplied research, including its version/date/evidence limits, but did not independently retrieve upstream vendor documentation or reproduce third-party source findings. My finding and source conclusions depend on Tesbo's frozen artifacts and pinned code, not on unverified vendor performance claims.
- **Operational participation:** no current deployed owner participated in this member's review. No callable authorized native Tesbo connector was supplied. Native requirement/case duplicate discovery, synchronization, publication and Test Run execution remain unperformed.
- **Coverage:** this is a connected v1.4.49 delta review with selected dependencies, not full historical eight-file assurance, all journeys, a complete security audit or whole-repository proof. Grey/QA/Security/Purple/Graph/White own their additional evidence.

## 12. Actual verification receipt

| Check actually performed | Observed result | What it establishes |
| --- | --- | --- |
| SHA-256 and byte count of the 13 INPUTS.json artifacts | 13/13 matched | The reviewed local target corresponds to the frozen manifest |
| INPUTS.json SHA-256 | dd8fa57f48ebcfe054dc98c69215539ea669ac932136291a622f5fe123233bfb | Exact manifest identity |
| Three applicable method files versus recovered-methods-manifest.json | 3/3 hashes and byte counts matched | Unchanged supplied method bytes for this review |
| Git commit resolution | f92c3341eadc03f274becbead3b0f45d0a86539e resolved | The pinned source object exists locally |
| Unified diffs recomputed from the saved v1.4.48 bodies and frozen candidate | 8/8 exactly matched supplied delta files | The fully read diff text describes the actual frozen canonical changes |
| Capability/owner, identity and consumer tracing | Per sections 4–10 | Bounded source/document conclusions; not runtime behavior |
| Application tests, builds, package installs, database/API writes, browser execution | NOT RUN | No product or runtime acceptance claim |
| Native Tesbo synchronization and approvals | NOT PERFORMED | No native case/result/approval fabricated |
| Graph harness / computed CLEAN | NOT RUN | Manual review cannot supply this receipt |
| Method comparison or held-out effectiveness trial | NOT RUN | No superiority, discovery-rate or causal claim |

Original findings, contrary evidence and limitations are preserved here. Later informed reconciliation must append a separately identified addendum or create a separate report; it must not overwrite this original.

