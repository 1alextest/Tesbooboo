# Agent-Synchronized Engineering Records (ASER) — Integrated specification view

**Canonical home:** Tesbo specification package revision **1.4.36 (proposed; NOT FROZEN)**, the same eight files `00_README.md` through `07_UI_DESIGN_TASKS.md`. This repository file is a subordinate integration view, not a ninth normative specification. The validated eight-file package and its review receipt control requirements, owners, contracts and proof obligations. No implementation, deployment or active-skill claim follows from this text. P-07 human publication, P-14 eight-file ownership and P-18 project MCP consent remain unchanged. Earlier independent reviews retain their original source/revision scope in [the existing assurance record](reviews/2026-11-18-charter-guided-spec-challenge.md); the 1.4.29 rerun requires its own receipts.

**Status:** Proposed integration design for canonical revision 1.4.29; NOT FROZEN. Existing native capabilities, specified extensions and unverified source artifacts retain separate maturity labels. The new assurance rerun must identify its actual input snapshot and scope; no earlier review or scenario count certifies this amendment.
**Target repository/branch:** `1alextest/Tesbooboo` / `development`.
**Purpose:** Tesbo is the shared human-and-agent engineering assurance and delivery platform: help QA, BA, developers, PM, policy/security reviewers and release owners understand what AI agents did, reconcile what an application should do with what actually changed, verify real behavior, and release faster with defensible evidence. Keep the code and its relevant engineering records evolving together for every relevant change.

## Product positioning and guiding outcome

Tesbo **complements coding agents and IDEs** (Kiro, Claude Code, OpenCode, Codex) rather than replacing them. Its native case/run/bug, Knowledge Base, requirements, Zyra, graph, activity and existing project workflows are foundations for one connected cross-role experience. Test-management products such as Qase and TestRail are direct QA-category competitive benchmarks; GitLab, Polarion and other delivery/ALM platforms are sources of reusable methods and integration targets, not assumed direct substitutes.

**North-star outcome:** A human who did not watch the coding session can open Tesbo and accurately answer: what was requested and authorized, what the agent actually did or only reported, what requirements/policies it may affect, what tests really ran against which build, who must act next, and whether the release has sufficient evidence for an authorized decision. Neither release speed nor a high case count is a guarantee of software correctness.

The primary unit of coordination is an **application change moving from intent and implementation to human review, verification, release and post-release outcome**. Role-specific views should be projections on the same canonical objects and versioned graph, not replacement BA/PM/QA/policy stores. A solo developer may follow a lightweight path while an organization activates stronger policies without weakening server-side permissions.

**Five external patterns are implementation inputs, not new subsystems:** Kiro-style event hooks (advisory); GitLab-style witnessed agent activity/audit; Qase-style compact context and composite MCP workflows; Spec Kit-style cross-artifact consistency analysis; DORA-style separate delivery-throughput and instability measurement. Each must be reconciled with Tesbo's current source and existing eight authoritative specifications before build, with executable negative acceptance tests.

## User outcome

A coding agent implementing a feature, defect fix, refactor, or operational change must be able to use **Tesbo MCP** to discover existing authoritative records and, **where applicable**, prepare versioned changes to:

1. **Requirements** — behavior and acceptance criteria, including requirement-to-case traceability.
2. **Test cases and verification** — cases, test techniques, test suites, executions and supporting evidence.
3. **User manuals and technical documentation** — distinct internal staff/admin/support/developer/operations guidance and external end-user/partner/public instructions, with separate audience and access control.
4. **Policies, decisions and enforceable rules** — internal governance and application rules, external-facing policies and externally mandated obligations, keeping audience, exposure and authority distinct; no self-approval.
5. **Tasks, defects and project issues** — owners, lifecycle, acceptance, blockers and remaining work.
6. **Files and evidence** — immutable references to uploads, reports and observations when applicable.
7. **Skills Library and assignments** — versioned, searchable skills governing each module/subtype; agents read approved active assignments and may submit **new candidate skills or successor versions** but never edit existing versions, approve/publish, activate/deactivate, or reassign effective bindings through MCP. A protected meta-skill governs creation of skills.

A single agent may perform these activities or delegate to specialist agents. The records, permissions, history and reviews belong to **Tesbo's native services**, not to the coding model or a new parallel assistant. Extend **Zyra** as the human-facing coordinator.

**Completion is not defined as "all seven domains were changed."** Each domain must be assessed. Applicability (`change_required|unchanged|not_applicable|undetermined`), each artifact operation’s review/apply state and work disposition (`active|blocked|deferred|resolved`) are separate; the canonical API contract defines their aggregation. Human labels such as “Updated”, “Awaiting review” and “Deferred” are derived from those facts. Never create a meaningless document or ticket to satisfy a checklist.

## Source-backed reuse inventory (2026-11-18)

| Area | Tesbo existing owner | Specific extension |
| --- | --- | --- |
| Skills governance | Canonical T-422 / D-14 QA Standards & Playbooks and FR-106–113 guide/asset bindings; project KB identity is reusable, coalesced edit history needs a governed snapshot extension | Human-governed effective skill assignments, immutable skill revisions, candidate-only MCP skill authoring, bootstrap meta-skill, per-artifact revision pins and independent evaluation. |
| Requirements | Jira/Linear/Notion test-case keys; Requirements/coverage UI; Knowledge Base `requirement_note` documents; change-aware cache graph | First-class **native requirement identity + version/acceptance criteria + typed case relation**. An MCP `sourceRefs` citation is not coverage. Keep external integration caches as external owners. |
| Test cases | Native case/suite/version/history and MCP authoring; run lifecycle; Model Studio drafts and graph-review links | Draft-by-default agent changes and approved-only publication/eligible run membership; source/requirement version pins and stale-change review. |
| User manuals | Knowledge Base document, folder, version and MCP read/write services | Internal and external audience/subtype skill bindings, scoped edits, previews, review, and UI access; never start another document store. |
| Policies | Knowledge Base plus approval/history and existing review/audit substrate | Distinguish internal application/governance and externally-facing/externally sourced policy contexts; typed, immutable, authority-backed **policy revisions** with decision/rule/enforcement links, effective state, change impact and approval. Reuse the Nesberry Policy Ledger *principles*, not its filesystem as Tesbo's database. |
| Tasks/issues | Zyra task board/activity/review, Bugs and integrations | General work items/issue tasks integrated into existing board with type-specific lifecycle; Zyra generation task remains a subtype or linked activity, not a competing board. |
| Files/evidence | Knowledge Base files, uploads, evidence/attachments, storage | Project-safe MCP or REST upload adapter, hash/byte existence truth, provenance, retention and permissions; no duplicate file service. |
| Cross-record change | Committed graph history, Zyra change review/notifications, native project authorization | **Change Packet is the view of the existing FR-115/T-455 changeset**; proposals use FR-027–037, impacts FR-119, typed relationships FR-118/T-426 and observations current graph history. No separately writable packet completion or approval. |

The inspected source at `0c54b8ed28c9dec51ed0ca3bbb3cd3b7b8ab12d8` declares **58 tool names**, including native case and KB-document writes; a prior external client reported a **50-tool deployed catalog**. Source inspection alone does not prove client visibility or the deployed contract. Require a fresh deployment/tool fingerprint before an external pilot.

## Portable lessons from Nesberry (research input, not code copied)

- **Policy triad:** distinguish *who decided and why*, *what invariant/version is binding*, and *how a rule is enforced*. Nesberry's source is `NesberryEnterprise/Nesberry/.kiro/specs/policy-ledger/` and `docs/policies/README.md`; foundational phases are built, later integration/impact phases remain incomplete.
- **Immutable meaning, versioned change:** a semantic policy or skill change creates a successor revision; audit history cannot be silently rewritten.
- **Skill methodology reuse:** Existing Nesberry and Tesbo skills/versioning work illustrates a portable core + project adapter, principle-based generalisation, version-specific provenance and objective evaluation. Copy no Nesberry-specific business authority into Tesbo.
- **Avoid write hotspots:** Nesberry's per-issue files fixed parallel editing of a shared issue log (ISS-7166). In Tesbo, instantiate the principle as per-record version locking and conflict-aware writes; do **not** copy a repository issue-file schema into the database.
- **Reuse canonical owners:** decisions, policies, rules, tests, issues, documentation, code and evidence are distinct truths connected by typed relationships. A traceability projection is not an authoritative duplicate.
- **Principle distillation:** generalize the underlying *why* and re-apply based on Tesbo's actual context, ownership and source evidence.

## End-to-end quality and product-learning contract

A coding agent may begin without a formal specification; it still must not turn observed code into an automatically approved requirement. Use project source binding, graph observations and approved requirement/policy history as separate evidence planes. A source change can be observed through an optional agent hook, source-provider event or CI integration; **missing capture** must be reported as stale/unknown, not silently treated as no change.

Tesbo distinguishes trusted server-observed events, externally authenticated event receipts, agent self-reports, inferred impacts, and unobserved activity; only show “agent did X” at the evidence tier actually available. Sensitive prompt/tool data require permissioned retention and redaction. Governed multi-operation MCP calls may make work easier but must reuse existing native services and preserve per-item authorization, idempotency, partial-result truth and review.

The shared Change Workspace and release-readiness view must distinguish case drafted, approved, selected, executed, passed on a known build, deployed and post-deployment verified. Show blockers and accepted risk; release approval is an explicit accountable decision, not a generated green badge.

Measure project outcomes in two axes: delivery throughput and instability, plus human comprehension, review burden, change-to-record freshness, false claims, duplicated records and defects escaping to production. Metrics are descriptive and baseline-aware; no causal success claim without comparison.

## Non-negotiable boundaries

- Never create a shadow test-case, requirements, KB, task or policy owner merely to feed agents.
- Never grant an agent authority to approve normative decisions or bypass existing QA reviewer controls.
- MCP agents may read authorized candidate content as untrusted data for review, but effective governing instructions come only from assigned approved skill versions. Agents may create additive skill candidates/proposed successors. **Never** allow agent/machine credentials to edit existing skill versions, approve/publish skill candidates, alter activation, precedence or module assignments—even when the token belongs to a human administrator. A skill candidate is not an instruction authority.
- Skills-authoring meta-skill is human-governed, with nonrecursive root protection; active/inactive and approved/unapproved are separate. Conflicting mandatory skills block governed authoring rather than causing arbitrary selection.
- Do not equate **drafted**, **linked**, **CI-pass**, **target-tested**, **evidence verified** and **approved**.
- Persist source/project/commit/revision provenance; never infer a target deployment version from a local commit.
- Reject project-crossing references and stale writes. On partial failure record exactly what persisted and allow safe recovery.
- The target application's `AGENTS.md`/`CLAUDE.md` is a **trigger and operating guide**, not a security boundary or proof of completion.

## Deliverables in this proposal

- [Requirements and falsifiable acceptance criteria](requirements.md)
- [Governed Skills Library, active assignments, protected meta-skill and test matrix](skills-governance.md)
- [Reuse-first technical design](design.md)
- [Implementation and independent assurance plan](implementation-plan.md)
- [Portable agent-rule template](AGENT_RULE_TEMPLATE.md)
- [Preliminary charter-guided specification challenge and independent team-run status](reviews/2026-11-18-charter-guided-spec-challenge.md)

No application code, schemas, migrations, MCP catalog, user data or production configuration is changed by this documentation increment. Revision 1.4.29 extends the same eight canonical files and preserves their historical bodies, IDs and decisions. These six repository files remain subordinate views. [The prior governed-asset evolution review](../../reviews/governed-asset-evolution-reconciliation.md) and earlier source receipts retain their historical scope; they do not override the current amendment or establish implementation/freeze.

## Proposed GEX graph-continuation crosswalk — 19 November 2026

**Status: PROPOSED, NOT FROZEN, NOT IMPLEMENTED BY THIS DOCUMENT.** GEX-01..08 are capability/navigation tags, not new functional-requirement numbers, modules, graph databases or independent authority. The exact v1.4.28 eight-file ZIP was recovered (SHA-256 `6094687758ebf1e5dfa3c6ed8e2209b8967a190523815ba1e1197d11867374ef`); this delta belongs in the same eight-file 1.4.29 amendment under P-14. Earlier notes about unavailable raw bytes describe the earlier attempt only. Canonical content and final review status follow the validated package and new receipt, not the presence of this subordinate view.

| GEX capability | Existing authoritative owner / identifiers | Existing capability → missing verified extension |
| --- | --- | --- |
| GEX-01 source observation | FR-115/116, T-455/456, R-ASE-37/45; project source bindings, pinned Git capture and graph history | Manual authorized capture and recovery of notifications exist. Optional local watch/provider reconciliation, interruption recovery and exact source-generation history are not an always-on observer today. |
| GEX-02 code dependencies | FR-116/118, T-426/455; implementation observation graph, graph comparison, current CI impact selector | Byte-scoped source declarations exist, but complete AST-based import/call/data/event/API/test dependency mapping for arbitrary target projects is unproven. Tesbo's CI test-impact selector is not customer-project semantic coverage. |
| GEX-03 expected behavior | FR-117 / existing MBT-C/MBT-AC; Model Studio revision and graph services | Approved sequential model revisions and bounded path proposals exist. Guards, data/variable effects, composed models and independently accepted advanced semantics remain proposed. |
| GEX-04 code→test impact | FR-118/119, T-457/458, R-ASE-19/40; native graph/case reference reader | Current `deriveQaReviewCandidates` uses changed cases/cached requirements and explicit references; there is no general verified code-callgraph-to-native-case traversal. |
| GEX-05 scenario discovery | FR-117 generator, native Test Cases, FR-027–037 shared staging/review | Deterministic bounded path proposals and Draft conversion exist; accepted guard/data/negative-path obligations, duplicate-case checks and safe budgets are not yet proven. |
| GEX-06 model-guided execution | Native Tasks, Runs/Executions, T-201–207/T-301–308, model `run_behavior_model`; I3-Q | Governed model dispatch creates a native Test Run. It is **not** execution of a target action or assertion. Reuse original external executor/report/evidence/retest loop, not another runner. |
| GEX-07 verified coverage | FR-118/119, native attempt/evidence/defect owners; model run manifests | Model mapping and recorded case result rollups are distinct from witnessed behavior. Build/oracle/fixture/element and retrievable evidence must support any conformance claim. |
| GEX-08 agents and humans | R-ASE-01..48, FR-115 Change Packet, Zyra/MCP, T-422/D-14 Skills | Existing approval/generation/run substrate is reused; true-human governance and all-writer target controls require the explicit source-convergence proof in design/implementation-plan. Model and source work joins the same seven-domain applicability/approval loop; original case-free I3-Q remains its own mandatory exit. |

**One graph architecture:** implementation dependencies, independently accepted behavior and traceability/evidence are distinct *views over existing owners*, not a mandate for three stores. Every relation has type, evidence grade, revision and scope; a source-observed edge is not an approved behavior oracle, a linked case is not verified coverage and a generated path is not a passed result. Supported/unknown/partial must remain visible.

**Research only, no automatic dependency decision:** GraphWalker (https://graphwalker.github.io/graphwalker-rs/model-based-testing.html), CodeGraphContext watching (https://codegraphcontext.github.io/CodeGraphContext/watching/), and TDAD graph impact analysis (https://arxiv.org/html/2603.17973v1) inform requirements but are not adopted engines, performance guarantees or Tesbo authorization surfaces. Confirm license, support, language/graph fit and reproducible local evidence before adding a dependency.

**Pinned source truth:** application-source observations below are bounded to `development@6897f989b055a955280f810c7daace86f74057fa`; the existing graph proposal was read at PR #168 head `b906a22ae84e170061a9e19ab37063e6f58b608d`. PR #167 was open at that observation and overlaps governance/model/run work; recheck its current head and reconcile overlap before merge. These dated observations do not establish the current deployment or a live target-test outcome.

### Graph-quality and learning clarification (GEX-01..08; PROPOSED, not canonical-frozen)

**Tesbo is a native QA management, test-design, execution and engineering-assurance platform—not a CI test selector or a test-count optimizer.** Graph capabilities must work even when a project supplies only authorized business requirements, user journeys, policies, observations, designs and past defects, **without a repository, code access, existing behavior model, CI or automation driver**. Manual QA tests are first-class **native Test Cases**: a human can review/edit/approve, follow action/expected-result steps, record original actual observations and evidence in a native Run, and file distinct direct/side findings. The same approved case may later be executed by a delegated agent (including browser, Playwright, Appium, API) or CI through separately authenticated/versioned execution bindings—**not a duplicate case store**.

**Quality precedes quantity and automation:** derive independent expected-behavior obligations; find missing/weak assertions, forbidden/negative and recovery paths, unusual roles/states/data, stale mappings, and cases that are redundant or not reproducible. A useful high-value extra case may be better than removing hundreds; eliminating genuine duplication may also improve maintainability. Cases need clear objective, setup/data, actionable steps and observable expected results, source/revision rationale, owner and human review. Keep authored, approved, manually/agent-executed and evidence-confirmed coverage separately labeled. A genuine **human-observed execution** requires actor/attempt/actual-result provenance, not a fictitious machine-runner receipt; an AI self-report is not human testimony.

**Learning is a feedback cycle over existing owners, not a new authority:** accumulate versioned project-specific facts from requirements, source/runtime observations, manual QA corrections, accepted/rejected case proposals and reasons, actual human/agent test outcomes, confirmed defects, side findings, false positives, flaky/setup failures, release regressions and skills feedback. Derive *hypotheses* for missing behavior, case improvements, new graph edges and risk/test-priority predictions; route material changes through the existing model, case, FR-118 relationships, Zyra review and human/Skills authority. The approved expected behavior must not silently learn from faulty implementation or agent-authored training examples. Keep false, disputed, rejected, stale and unobserved conclusions visible; retain historic receipts, data scope, training version and reversibility.

**Four complementary learning modes:** source-graph reconciliation; observed-journey/model hypothesis discovery; test-design pattern refinement from reviewers/defects; and optional risk/selection modeling from confirmed outcomes. Rules and reviewer feedback work from cold start; opt-in ML, active automata learning and runtime tracing must earn admission through held-out human/real-defect evaluation, authorizations, query/cost limits, isolation, drift checks and safe fallback. Structural model coverage, number of cases or prediction confidence alone are not quality.

**Research leads and limits:** [test-case quality survey](https://doi.org/10.1007/s11219-024-09698-w), [behavioral-gap preprint](https://arxiv.org/abs/2606.10417), [historical-outcome test selection](https://doi.org/10.1109/ICSE-SEIP.2019.00018), [industrial automata learning](https://doi.org/10.1007/978-3-319-25423-4_5), and [ML/test-generation review](https://doi.org/10.1002/stvr.1845) remain research inputs requiring primary-source and applicability verification before numerical claims or adoption. This amendment supplies no independently reproduced Tesbo benefit, defect-recall estimate or justification for unattended production probing.

This is **one extension of GEX-01..08 and R-ASE-06/14/19/40/44/47/48**, not GEX-09, an additional FR/T owner, a new graph database, a separate manual test system or a ninth normative specification. The proposal is reconciled through the existing 00–07 owners in revision 1.4.29; recovery of the prior bytes removes the earlier access blocker, without satisfying review or implementation gates.

### AI-powered graph reasoning and Skills composition — candidate direction, 19 November 2026

**User outcome:** Tesbo can explain the **meaning** of a project, its users and roles, intended outcomes, state/transition rules, prerequisites, upstream producers, downstream consumers, data ownership, alternate/forbidden paths, risks and existing verification gaps, then create *high-quality native manual or executable cases* without behaving like a blind path enumerator. It must know whether a source describes an accepted requirement, a current implementation observation, a hypothesis or a disputed assertion; the AI is a reasoner that proposes changes, not a new authoritative graph database, testing engine, source of expected results or approver.

**Skill reuse decision:** the previously authored **`manual-test-authoring` skill** exists as an available *source artifact*, not as a verified installed/active Tesbo Skill. It already covers modes A–H (requirement review, conditions, detailed manual cases, case review, restructuring, RTM, exploratory charter and result review), role/suite/permission matrices, state transitions, cross-cutting concurrency/recovery, Action→Expected Result and iterative `IMPROVEMENTS.md`. A separately explored **`product-testing` method** for Primary User Type → Module → Context and end-user journeys is valuable *source input*, but its Nesberry adaptation and locally uncommitted pieces are not a verified active transferable skill. Do not copy project-specific policies into the general method, clone duplicate skills or publish either package without review.

**Proposed governed integration:** use **the existing canonical T-422/D-14 owner and its proposed immutable skill versions, effective resolver, human assignments and protected meta-skill**. Their specification ownership is established; their installed/runtime availability must be independently verified before use. A graph-interpretation *method profile* (candidate, e.g. `graph-qa-reasoning`) may explicitly compose a suitable version of `manual-test-authoring` or extend that same skill if no separate stable responsibility exists. Decision is **reuse/extend/compose first; new skill identity only for an independently justified, nonoverlapping purpose**, never a new Skills Library. Scope assignment by project, module/subtype, task/mode and audience using existing versioned bindings. Pin the exact effective skill/rule/model versions and provenance for each proposal.

**What can change through a skill without code:** exploration lens, graph query focus, context selection, scenario-selection heuristics, explanation/report form, case-authoring language, risk questions, matching guidance, learning/evaluation criteria and bounded agent orchestration using **already authorized advertised tools**. What cannot be changed by a skill: node/edge schemas, parser support, persisted authorization, transaction/approval rules, runner capabilities, source-byte verification, or the ability to write protected records. Those changes still require ordinary engineering review and code. Skills and LLM outputs are untrusted input to server-enforced invariants, not executable permissions.

**Continuous experimental improvement:** Tesbo captures human corrections, accepted/rejected/duplicate cases, confirmed bugs, model disagreements and known misses as **scoped evidence**, proposes new skill/graph guidance versions, independently compares them on held-out project/user journeys, and allows explicit human approval and activation with rollback. Trial-and-error is *observed → hypothesize → challenge → evaluate → review → activate or reject → monitor*, not anonymous automatic prompt overwrites or self-training on agent-made answers. No single "quality" score is a correctness certificate; improvements track independent oracle strength, relevant gap discovery, missed defects, duplicate rate, manual executability, review burden and source/evidence integrity.

**Important skill-source conflict to resolve before adoption:** earlier `manual-test-authoring` text advised preferring observed application behavior over a requirement when drafting Expected Results. Later sections correctly distinguish required behavior from work-in-progress and shipped limitations. For Tesbo, **approved expected behavior is the oracle; observed behavior is test evidence or a discrepancy**. Preserve exact UI labels only as observed navigation facts, never as approval to replace a requirement. Mark the candidate skill as *needs reconciliation and independent evaluation* until that contradiction is fixed.

**Status:** SPECIFICATION PROPOSAL ONLY; no installed Skill, graph agent, model/runtime algorithm or deployment is asserted. The canonical 1.4.29 document amendment and a new independent review are separate from implementation. Retain P-07/P-14/P-18 and all source/CI/assurance blockers.

## Current integration details

| Truth / label | One authoritative owner and canonical work | Integration decision |
| --- | --- | --- |
| Change Packet / Change Workspace | FR-115/T-455 changeset + immutable events; FR-119/T-457 impact obligations | Packet is a composed view of `changesetId`, not another mutable completion/approval entity. Source observations may create or relate to a changeset; graph capture alone never accepts behavior. |
| Candidate and human decision | FR-027–037, T-301–306 shared staging/review/apply | Stable logical operations and immutable revisions; exact selected dependency-closed apply. A candidate is not a native Draft row. |
| Native requirements / criteria | Existing project KB identity and typed governed content, surfaced by Requirements; FR-110/112, work package A | Extend immutable submitted/accepted revision and criterion identity, never copy a second wiki. External provider requirements retain provider identity and provenance. |
| Cases / definitions / approval | Native Test Cases, existing version and approval services; T-103/104/305/430 | Extend shared principal and exact semantic revision checks across all writers. Custom fields, reference images and material relationship dependencies participate in the reviewed manifest. |
| Runs / actual attempts / results | Native Runs and execution owners; T-207/433/459 | Selection, actual observation and reviewed correction are distinct. Preserve original attempts and frozen definitions. A Bug link cannot supply execution evidence. |
| Manuals / decisions / policies | Project KB content/version owner + shared review; work package B / T-438 | Typed governed snapshots, authority and effectivity metadata; audience/exposure/authority remain independent. Ordinary draft autosave may continue. |
| Skills Library / Assignments | T-422 / D-14 QA Standards & Playbooks; FR-076/077/106–113; T-448–453 | Extend the same guide/asset identity, workspace/project bindings and one effective-method resolver. Library and assignment controls are subviews of existing settings, not a new top-level app. |
| Global pack versus local guidance | Platform-approved guide revision, workspace pin, project KB overlay | Platform authority does not live in a fake project. Reuse narrow existing bindings; a new relation is justified only for an unrepresented invariant. No per-project core copies. |
| Tasks / work / generation jobs | Existing Tasks service/shell and planned T-201/203/206/306 extensions; Bugs own defects; impacts own QA obligations | General work has a typed task identity, assignee and its own completion criteria; generation completion does not close it. Link distinct independently accepted work rather than overloading one `done` flag or copying impact state. Exact current table fit remains a source/implementation gate. |
| Files / report evidence | Existing storage, KB Files and native attachments; T-204/205/443 | Immutable references and verified bytes where available; no new upload service. Raw ingestion is not automatically authored content. |
| Typed relationship / trace | FR-118/T-426, extended with current graph/native link owners | One typed relationship owner; history pins exact revisions/occurrences. Source citations, accepted coverage mappings and observed graph edges retain distinct meanings. |
| Source binding / capture | Existing `project_source_bindings`, graph capture/history and provider adapters; T-455/456 | Extend stable binding/configuration history and multi-source capability. Preserve current server-provisioned checkout boundary and historical capture fingerprints. |
| Agent activity / session | Existing Zyra sessions/tasks/activity and authenticated receipts | Timeline is a permission-filtered projection; no separate assistant or implied record of unobserved tool use. |
| Release decision / deployment / readiness | Shared human review/audit records a typed decision; provider owns deployment facts; T-461 reports derive readiness | Fixed candidate/evidence/risk scope per decision. Readiness is computed, never another writable release-authority status. One source change may participate in several independently decided releases. |

The v1.4.28 baseline contained 48 requirement mappings, 75 planned ASER scenarios and 49 reviewed material journeys. The 1.4.29 amendment preserves those IDs and adds **38 ASE-FLOW outcomes (17–54) and 12 SK-E2E outcomes (29–40)**: the current definitions comprise 54 ASE-FLOW, 40 SK-E2E, 15 ASE-E2E and 16 ASE-INT scenarios, **125 total planned scenarios**, all without new runtime execution proof. Prior 49-journey findings remain historical; the fresh reviewers must derive their own relevant inventory. Canonical 02/07 owns workflow/UX, 04 owns contracts, 05 owns trace/proof and 06 owns the portable operating method. The [principle-first method](skills-governance.md#1341-principle-distillation-and-contextual-instantiation) guides further changes without prescribing an AI solution.

### Source-fit clarification

The current substrate and the target guarantees are distinct. The source-convergence table in `design.md` and proof allocation in `implementation-plan.md` identify current model-selection, native/provenance transaction, true-principal, exact-mapping, source-entitlement and feedback-history work, plus existing Requirements/Bug-result input-integrity prerequisites. Documentation names that work; it does not close the source findings or make the governed graph implemented. Approval remains separate from activation, dispatch separate from target execution, and a source-based review separate from runtime/visual verification.


## Current canonical reconciliation — revision 1.4.34

The current eight-file package preserves concurrent 1.4.30–1.4.33 additions and the separately reviewed GEX source-convergence corrections. Graph Analytics remains a proposed Reports projection with initial Change impact/Coverage gaps, existing native owners, state-appropriate handoff and AI-independent deterministic ordering. Broader investigation/prediction remains gated. Canonical 02/03/04/05/07 own the exact interface, data, authority and proof obligations. The prior 125 total refers to the ASER core inventory.


**Selection and analytical scope qualification:** The 1.4.31 sentence about model dispatch selecting an active revision applies to **CURRENT** applicability only. Model applicability/CAS generation and T-422 effective Skill assignment generation belong to distinct native owners. Authorized Draft inspection/preview and explicit HISTORICAL selection retain MBT-C02's selected revision, consent, retirement, mapping and permission rules; neither owner silently substitutes for the other. Current-generation checks do not discard legitimate historical work. The initial Graph Analytics Reports slice is Change impact and Coverage gaps. Later diagnosis/stability and optional prediction remain separately gated capabilities, not implied initial UI features. Insufficient or unqualified evidence requires abstention from quantitative defect probability; qualitative hypotheses, explicitly uncalibrated relative heuristics and deterministic/manual prioritization may remain informative without probability or coverage claims. Calling a result advisory does not waive evidence admission.

**Method and evaluation version boundary:** Canonical 06's incoming portable trigger/adoption wording is preserved as an unvalidated candidate. It changes the method text compared with the earlier frozen trial candidate. The completed incumbent/candidate exercise used the original fixed v1–v7 wording on two independently selected synthetic briefs; both arms met their contracts, with no demonstrated superiority. It does not discharge the stricter 1.4.30/31 discovery qualification or validate this successor, the extra contextual wording, a runtime Skill, prediction, or real-user benefit. The original team charters and original outputs remain unchanged. No candidate Skill is installed, approved or activated by this document.

**Proof inventory accounting:** Retain the 125 ASER core definitions (15 ASE-E2E, 54 ASE-FLOW, 40 SK-E2E, 16 ASE-INT), eight incoming GEX-AC obligations and five current GA-AC checks. The 1.4.33 GA-AC table supersedes the four 1.4.32 prose summaries; do not count them twice. The separate GEX-SEM-01..08 and proposed SK-E2E-41..44 labels remain aliases with explicit new fixture assertions allocated below, not twelve more canonical definitions. All product/runtime proof obligations remain NOT RUN in this review. Mechanical checks and isolated helper/query probes retain their narrower identities and cannot satisfy these scenarios.



### Historical concurrent PR #169 annotation (not part of v16 original team input)

The following section is preserved verbatim from the later merged development documentation and records a separately authored v1.4.35 candidate. It is not a new independent sign-off, not the current frozen canonical contract, and not evidence that the original v16 reviewers saw the text. Its contemporaneous reference to earlier open PRs is historical only. See the post-review PR169 delta receipt for provenance.


## Candidate v1.4.35 — semantic consequence and proof follow-up (NOT FROZEN)

The published v1.4.34 canonical eight-file ZIP was verified byte-for-byte at SHA-256 `ac55077842806781223c83c64869b2f55a992155ec12bb9ae4689459961f11f9`. A **separately saved candidate** eight-file v1.4.35 archive (SHA-256 `214e29f6d784e814da12ec417917304a73d373073ef5a1384714b4c1e95b6a0f`) proposes additional semantic-consequence requirements across the same owners without replacing current canonical authority. Library path: `/creating a testing tool to make my job easier/Tesbo_Specifications_v1.4.35_CANDIDATE.zip`. Its 8/8 original bodies and revision headers have been mechanically reconciled; no runtime or independent final-revision assurance is implied.

The refinement addresses F-01 through F-06 documented in [the bounded review record](reviews/2026-11-20-v1435-semantic-remediation.md): conditional effects and multiple applicable policy sources, historical valid time versus deployed behavior, safely inferred missing links, reviewer correction of dependent graph/search/report/notification/agent/release advice, inference privacy and reviewable UX. The historical 49-journey inventory and independent v1.4.29 50-job Grey inventory are **different reviewed scope versions**; neither certifies new 1.4.35 journeys. Reuse the existing GA-AC-03 authorization/hidden-edge test as a starting point for stronger inference-output noninterference rather than creating a separate security owner.

No new graph database, shadow policy/manual/case store, autonomous Skill activation or fabricated test result is authorized. Current PR #167/#168 implementation/source merges require exact-head reconciliation and real native/DB/HTTP/UI/driver proof where applicable. Keep this candidate inert until actual independently invoked unchanged teams, new Grey FJCC, Graph and White review of the exact eight-file snapshot, human approval and relevant CI/security gates.

## Published portability integration and current authority — 1.4.35

The published 1.4.34 canonical predecessor and ac49fa6 repository review are preserved as distinct historical work. The following inherited clauses are subordinate projections of the named canonical owners. Original source packages and raw reviewer receipts retain their own provenance. Neither their assessment nor this run establishes comparative efficacy or installed methods.

### Inherited portability obligations — canonical 00

### Current source-fit boundary for the intelligent graph proposal

The source at `6897f989b055a955280f810c7daace86f74057fa` supplies bounded graph/source capture, sequential model preview/path proposals and native case/run substrate. Separate active model selection, universal true-human approval, unpublished graph-case staging, atomic native effects with provenance, durable exact mapping history, source entitlements and immutable learning feedback still require the convergence work in canonical 03/05. Existing Requirements lookup and Bug/result side effects also affect the trustworthiness of graph inputs. Do not present those target guarantees as already implemented. This remains a proposed, NOT FROZEN documentation amendment with no new runtime or deployment certification.

### Recovered method evidence and bounded portability

The supplementary source review recovered two complete text bodies named `manual-test-authoring` (285 and 525 lines), with distinct immutable hashes. This recovers the bodies inspected; it does not establish repository lineage, installation, effective assignment, or the absent referenced companion package. The experimental `product-testing` package is still not available as a complete verified input. Keep those sources inert. Canonical 06 now makes the import/profile and native-lifecycle boundaries explicit; canonical 03/04 identify the context-resolution and output-adapter admission contract; canonical 05 extends existing proof obligations without adding acceptance IDs. The original eight-file ownership and original team charters are unchanged.

Application-neutral responsibility boundaries are supported by source/document review and independently chosen conceptual counterexamples. That evidence does not demonstrate better discovery, complete cross-application efficacy, live enforcement or an installed Skill. Preserve the original frozen reviewer receipts and label later reconciliation as informed. A scoped UI/workbook profile is a legitimate outcome; no universal testing method or mandatory AI mechanism is implied.


**Current controlling reconciliation:** Canonical revision1.4.35 owns this proposal. Retain the v11 corrections for separate Model CURRENT and effective Skill assignment, explicit Draft/HISTORICAL work, quantitative abstention, intentional prepared Runs, corrected evidence propagation and externally delivered notifications. The GEX-SEM and GEX-DISC assertions now have existing canonical proof owners while their labels remain aliases; older “awaiting canonical reconciliation” statements are historical. Keep 125 ASER definitions, eight GEX-AC obligations and five GA-AC checks distinct. No runtime, visual, human-governance, efficacy or method-activation claim follows. The six views remain subordinate to the same eight canonical files.


### Publication checkpoint — external implementation and documentation merges

After the v12 specification review froze, GitHub reported PR168 merged as f43013473b3a8b725bb547187e21b4459d0e8838 and PR167 merged as 1fe100588be6c3a1627ee39a4b0bbc1c0d9da2ea (implementation head b07def32b725cfa3b71f34d001bbbdc94ed38226). Development now includes both, and the old documentation branch was removed externally. This supersedes earlier statements that those PRs remain open/unmerged. The present work prepares a documentation follow-up on that merged parent and preserves its product changes; it did not perform either merge or verify deployment.

The original source findings and team receipts remain bound to 6897f989b055a955280f810c7daace86f74057fa. Their original OPEN or RELEASE-BLOCK dispositions are not automatically current defects or release judgments about the merged implementation. The separately authored native integration closure and its exact evidence own implementation claims. Newly merged documents report narrower repairs in human approval, native transactions, result-preserving Bug association, requirement lookup states and reviewed document history. Those claims require their own exact-source/runtime evidence; this documentation rerun does not silently re-certify them or rewrite its earlier observations. The broader graph reasoning, effective Skill assignment/resolution, source-event reconciliation, original external QA loop and empirical method benefit retain their explicit unimplemented/unqualified or admission status in that implementation record. Retained proposed contracts continue to govern future work.


## Current canonical36 reconciliation of published35 Graph Analytics closure

The published35 material below is retained through its canonical owners and remains proposed/NOT FROZEN. Evidence-stage and outcome are separate; model-only filtering is explicitly narrower than the full authorized obligation basis. The named DMIS workflow is a scoped pilot, not a portable method prerequisite. Source checkout observations and merged implementation evidence remain attributed to their actual separate reviews. The current run does not inherit their runtime or approval claims.

### Inherited Graph Analytics closure — canonical00

This amendment governs Graph Analytics where earlier chapters differ. It resolves specification findings, with runtime proof pending. The first implementation slice is the DMIS approval-to-posting workflow using native Reports, change review, Cases, Runs and Evidence. The package remains NOT FROZEN.


### Inherited Graph Analytics closure — canonical02

For the DMIS approval-rule change, current-build approval PASS plus prior-build posting PASS leaves current posting unverified. Current matching posting FAIL with admissible evidence removes the missing-evidence label and shows an open discrepancy with native QA triage. Current matching posting PASS meets the selected posting obligation, without automatically acknowledging or closing a native impact. A missing or inadmissible receipt never establishes a verified result. A finding spanning two native impacts shows both statuses and requires selecting the intended impact before any follow-up action.


### Inherited Graph Analytics closure — canonical07

Show evidence stage and outcome independently. On verified FAIL, route to native QA triage; on verified PASS, show posting evidence and preserve impact workflow. Give unknown criticality an explicit label and filter. Display each authorized native impact's status and make action target selection explicit. Show only permission-safe freshness and recovery detail, with a scope explanation for model-only coverage. Rendered and accessibility proof remain pending.


Current canonical authority is revision1.4.36. Preserve all earlier v14 qualifications for method/mode selection, native partial preparation, source-pin versus merged-parent status and existing proof aliases. Original cold signatures remain bound to their exact snapshots; the final informed review binds current bytes. The five GA-AC definitions are extended, not duplicated or executed.
