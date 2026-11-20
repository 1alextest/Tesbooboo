# ASER — Implementation roadmap and assurance plan

**Canonical home:** Tesbo specification package revision **1.4.29 (proposed; NOT FROZEN)**, the same eight files `00_README.md` through `07_UI_DESIGN_TASKS.md`. This repository file is a subordinate integration view, not a ninth normative specification. The validated eight-file package and its review receipt control requirements, owners, contracts and proof obligations. No implementation, deployment or active-skill claim follows from this text. P-07 human publication, P-14 eight-file ownership and P-18 project MCP consent remain unchanged. Earlier independent reviews retain their original source/revision scope in [the existing assurance record](reviews/2026-11-18-charter-guided-spec-challenge.md); the 1.4.29 rerun requires its own receipts.

**State:** Proposed; not a delivery report. Do not merge unimplemented acceptance statements into deployment claims. Use Tesbo `development` → reviewed PR → green checks; never write directly to `main`.

## Step 0 — Grounding / ownership challenge (before schema work)

1. Pin exact `development` commit and inspect current Tesbo source and earlier governed-asset evolution proposal, plus the original eight canonical Tesbo specs: `legacy` case/KB/bugs/requirements routes, `mcp.tools.ts`, `mcp.service.ts`, `behavior-graph`, `Model Studio`, Zyra task/activity/approval, files, migrations, sidebar and current tests.
2. For each user job (create native requirement, link case, maintain internal/external manual, propose internal/external policy, track task, attach file, author skill candidate, read assigned skills, human activate skill), create **reuse / extend / transform / new / unresolved** decision with evidence; check whether some existing feature already satisfies it through a different UI.
3. Compare deployed authenticated MCP `tools/list` and schema/fingerprint with this exact source, using a **separately authorized disposable test project**. Existing client observation of 50 tools vs source's 58 is an explicit outstanding gap.
4. Use the same eight canonical files at revision 1.4.29 and their explicit owner/contract/trace amendments. Recheck them against the implementation head before adding schema or tools. The six repository views and the review record are not replacement canonical authorities or altered assurance methodology.
5. Create a source-backed mapping from affected page/API/DB/graph artifact → rightful owner → existing tests → missing acceptance evidence.

**Exit:** no competing owners; persisted source/deploy/capability receipts; authority/approval and unresolved questions explicit.

## Integrated vertical milestone before full module expansion

**Purpose:** demonstrate an end-to-end application change progressing from coding agent through Tesbo to independently reviewable, known-build verification and an authorized release decision. This order is an implementation **sequence**, not permission to defer security, QA or required skill governance. Build the smallest reusable S0 governance/security foundation before exposing new agent writes; deliver the full Skills Library UX/version evaluations later.

| Milestone | Reuse and specific additions | Testable exit |
| --- | --- | --- |
| I0 — authority/source truth | Reconcile ASER/GAE into the exact latest eight Tesbo original specs (preserve P-07/P-14/P-17/P-18), bind one disposable project and known Git source, inspect existing Zyra/requirements/KB/case/graph routes | No competing canonical spec; explicit project access and approved expectation source |
| I1 — change observed | Existing source binding + graph capture/history; optional Kiro-like agent hook and source-provider/CI reconciliation, stable source event identity, dedupe, unknown/stale gaps | Push with no hook remains visible; duplicate/out-of-order event not fabricated as two changes |
| I2 — agent activity visible | Extend Zyra session/task/activity and graph read model with event tiers, identity, timestamps, redaction/access | Human reviewer distinguishes agent-reported run from verified execution, and can identify who owns stalled work |
| I3 — governed authoring | **Minimum** human-controlled active skills version resolution; original P-07 official case protection; existing KB/native requirement extension and case draft, exact version-aware link; bounded project context and composite MCP adapter | One code-first external agent proposes linked requirement/case under pinned active skills; REST and legacy writers cannot bypass review |
| I3-Q — retained original QA loop | T-201–207/T-301–308/T-401: ChatGPT task → assigned executor/own driver → original report → analysis/retest → exact human review/apply | QA-135–138 and ASE-INT-12 prove a case-free/no-native-model-key loop, original byte retrieval, linked new retest and selected official writes; a coding-source demo cannot substitute for it. |
| I4 — independent consistency | Extend existing graph/change-review read model with accepted oracle vs code observation, contradictory policy/requirement detection, bounded unknown/negative-scope accounting | Implementation conflicting with approved policy is flagged, not ratified by generated requirement |
| I5 — cross-role Change Workspace | Existing Zyra change review + test cases, KB, Bugs, requirements and tasks; role-sensitive projection, review owners, next actions, evidence navigation | BA/QA/PM see same change revision and can review, disagree, accept/reject without hidden duplicate stores |
| I6 — release & aftercare | Readiness reasons, actual run/build/deployment identity, human release approval, post-deploy smoke/incident/retest links; project reports integration | Code/CI green without target proof remains insufficient; failed deployment/rollback updates correct change and risk owner |
| I7 — metric and portability proof | DORA five metrics with definitions and source fields, human comprehension/defect rework measures; two coding-agent runtimes and Qase comparison | Metrics do not hide failed releases or invent missing data; measured benefit or explicit limitation |
| I8 — broaden implemented domain capabilities | Complete remaining D-14 skills views, classified manuals/policies, native work items, evidence adapters and integrations | Every domain is already assessed from I1/I3 onward. A required but unimplemented domain stays blocked or has an explicit accountable scoped exception; I8 cannot be used to mark an incomplete release ready. |

**Original-loop priority:** I3-Q is a shared integration exit, not a dependency on a native requirement/model or full I8 expansion. Deliver it alongside the first coherent integration using its existing Phase 1–3 foundations; a source-sync demo cannot replace it.

**Independence:** all milestones have separate source-code review, authenticated API/MCP/DB/UI tests and role/permission negative tests; actual assurance team review of the **specification** is separate from implementer desk testing. The absence of an installed team runner must be labelled BLOCKED rather than simulated as executed.

### Proposed GEX continuation of existing I0–I8 — not a parallel phase plan

The outcome is *observed change → scoped code-dependency analysis → reasoned impacted native cases and unknowns → selected verification → original runner evidence → authorized QA/human decision*. Its implementation reuses existing F1–F6 and I3-Q; the proposed GEX labels are navigation tags, not new FR/T owners, schemas or Tesbo repositories.

| GEX | Integrate with current owner | Independent outcome to prove |
| --- | --- | --- |
| 01 | I1/F1, FR-115/116; existing source binding/history, Zyra review | Hookless source commit appears through reconciliation; local uncommitted event has separate trust tier; restart recovers gaps |
| 02 | I1/F1 + I4/F4, FR-116/118; existing observation graph | Scoped supported-language AST dependencies and explicit parser/dynamic/selection unknowns, with byte-backed identities |
| 03 | I4/F4; FR-117/MBT-C Model Studio | Accepted model/guard/data/composed semantics are versioned, bounded and distinct from code observation; unsupported semantics refuse |
| 04 | I4/F4; FR-118/119; `deriveQaReviewCandidates` | Direct/transitive candidates and unlinked/unknown scope explained against current native cases; no trust laundering or silent drop |
| 05 | I3/F3 + I4/F4; model generator, shared native proposal workflow | Repeatable proposals, case matching, negative/recovery obligations, human approval and zero duplicate official publication |
| 06 | I3-Q, T-201–207, native Run and external executor | Actual target action/assertion, build/oracle/fixture, immutable original report and linked retest; native model dispatch alone is insufficient |
| 07 | I4/F4 + I6/F5; FR-118/119, evidence and run projections | Traceable obligation numerator/denominator, historical vs current, missing bytes/build and authorization-aware coverage |
| 08 | I2/F2 + I3/F3 + I5/F5; Zyra/MCP/T-422 governance | One readable Change Packet, seven-domain applicability, honest actor evidence and human decisions; original case-free task loop remains mandatory |

**Deployment/correctness gates:** Inspect current graph, model, notification, MCP, Run, file and review code/migrations at each implementation head. PR #167 remains separately open and owns some native model/run and P-07/P-18 corrective work; do not duplicate or silently supersede it. For each vertical slice, independently exercise authorized operations and denied operations with no writes; verify observer interruption and restart recovery, stale source/model revisions, parser uncertainty, duplicate or delayed events, source/target build mismatch, real attempt/evidence and authentic reviewer workflow. Model/workload budgets and weighted-selection value are measured rather than guessed. Old green CI or successful scenario discovery is not a release proof.

### GEX manual-test quality and graph-learning continuation (existing I0–I8/F1–F6/I3-Q)

**Product proof must begin with a native manual QA journey**, not a coding PR or CI. For a project containing only an accepted requirement/UX workflow and no repository/model/automation, deliver a meaningful reviewed manual test with complete actionable steps, observable Expected Results, repeatable data/actor/setup, negative/forbidden and risk-relevant coverage, semantic overlap check, native case approval, human execution/Actual Result, original status/evidence/defect and distinct retest. The graph's impact/quality obligations attach to **existing FR-117/118/119 and native Case/Run/Evidence owners**; all seven ASER domains are assessed as applicable, not fabricated. The same case may later have an authorized agent/CI adapter binding without duplication or loss of manual provenance.

| Existing owner | Proposed graph quality/learning capability and independent exit |
| --- | --- |
| R-ASE-06, FR-117, native Case/Suite, shared review | Good manual, exploratory and automated *design* from code-free sources, accepted expected behavior, forbidden paths and nonduplicate coverage; weak oracles challenged |
| Native Runs/Executions/Evidence/Bugs, I3-Q | Distinguish authentic human/manual observation from agent report and machine execution; preserve direct/side finding, result history, exact case/expected versions |
| FR-118/119, F4 change/consistency views | Gap quality: missing behaviors, untested approved cases, weak expected results, unsupported test modes, stale links, unknown source; no reliance on 100% line/edge coverage |
| Existing Zyra/graph history, F2/F4 | Attributed QA corrections, accepted/rejected case proposals, flaky/setup cause classification, real defects and drift enter **candidate** relationship/model updates, not self-authorizing expected truth |
| T-422/D-14 Skills, F3 | Human-accepted reusable manual/automation authoring guidance, immutable candidates/assignments; learned examples cannot bypass a governed skill, test-case or model review |
| I7 evaluation | Compare manual QA baseline vs rules-only graph vs learned graph and supported active inference; held-out human judgments, real defects, separate mutants, usability, oracle strength, unique gaps, duplicate rate, quality/cost and false negatives |

**Proof sequencing:** read-only structural/requirements graph → independent behavioral gap/weak-oracle review → human-editable manual case candidates and protected native publication → authentic manual/agent attempts → feedback classification/review → project-scoped versioned candidate graph learning → optional statistical/active algorithms only after held-out comparison. These are **capability-gated increments of the same intended whole**, not a decision to omit manual testing, graph learning or future graph intelligence. Learning must work in cold-start mode with explicit uncertainty; automation and CI are optional for manual QA value. Unsafe active probing, leaked cross-project examples, duplicate-case autopublication, retroactive editing of real results, self-trained expected oracles and unmeasured defect recall are release blockers.

**Research context, not Tesbo test proof:** the [quality survey](https://doi.org/10.1007/s11219-024-09698-w), [behavioral-gap preprint](https://arxiv.org/abs/2606.10417), [ML testing review](https://doi.org/10.1002/stvr.1845) and [industrial automata-learning study](https://doi.org/10.1007/978-3-319-25423-4_5) remain leads whose primary-source scope must be checked before empirical claims. ASE-FLOW-29..44 remains part of the existing planned suite; the later reasoning extension adds ASE-FLOW-45..54. All are NOT RUN and belong in the same P-14 eight-file owner/proof mapping.

### GEX semantic/consequence analysis proof (existing I4/F4, I3/F3, I7; proposed)

Extend the existing FR-118/119 graph, policy/manual owners, native Case/Run/Bug/Evidence and T-422 method resolver; no new canonical graph or autonomous policy author. The initial proof is **read-only**, from current approved policy and audience-scoped manual revisions, a business requirement and authentic evidence. Agents independently interpret the requested user outcome and explain grounded or disputed obligations, upstream/downstream consequences and affected native records without prespecified fault targets. Both code-first and code-free workflows must work.

**Proposed subordinate scenarios for P-14 acceptance mapping (NOT RUN; IDs not canonical):**
- `GEX-SEM-01`: Approved policy conflicts with a current user manual and observed code. Explain distinct source authority, impacted actor/journey and unresolved requirement; refuse to rewrite policy or manufacture execution proof.
- `GEX-SEM-02`: Approved policy changes without a code commit. Trace manual audience/version, permissions, states, downstream consumers, case coverage and uncertain links; distinguish stale manual from changed normative requirement.
- `GEX-SEM-03`: Manual wording changes without any binding workflow change. Preserve a valid unchanged outcome and avoid duplicate requirements/cases.
- `GEX-SEM-04`: Intermittent failure history mixes different environments and fixtures. Preserve individual attempts and causal alternatives; do not assert flaky test or root cause until evidence permits.
- `GEX-SEM-05`: Defect-risk model sees sparse/biased labels or a new project. Abstain, explain uncertainty and use legitimate human/rules-only prioritization without dropping mandatory regression.
- `GEX-SEM-06`: High graph edge/path coverage still misses a policy-required forbidden transition. Show independent normative gap and separated designed/mapped/executed/verified denominators.
- `GEX-SEM-07`: Finite path budget exhausts mid-search with loops and data-state combinations. Report truncation and omitted candidates; retain critical obligations and don't claim completeness.
- `GEX-SEM-08`: Agent infers a downstream consequence without an accepted link or source evidence. Keep hypothesis reviewable, explicitly UNKNOWN, and prohibit unauthorized write/Passed results.

**Independent evaluation:** Compare existing deterministic graph projections, governed AI interpretation and no-change/manual baselines on held-out dissimilar systems and withheld critical scenarios. Measure unique actionable gaps, consequence trace accuracy, false claims, missed obligations, root-cause discrimination, risk calibration where data permits, flakiness false attribution, review labor, token/latency cost, privacy and rollback. First-run assurance teams get outcome plus pinned sources, not the scenarios above as suggested findings; these scenarios are for later engineering acceptance. The existing eight canonical documents, approval boundary, original I3-Q execution loop and CI/security gate remain mandatory.

### Outcome-discovery diagnostic triage and targeted acceptance (DISC-01..05; NOT RUN)

The diagnostic at `reviews/2026-11-20-semantic-skill-diagnostic.md` is an informed author application, **not** a blind assurance-team receipt. Against existing R-ASE-07/08/09/19/40 and FR-117/118/119, all five issues are *partly addressed* by present ownership, provenance and graph gap contracts; their missing discriminators are clarified here and in the subordinate requirements/design. None establishes a new database or a confirmed runtime defect.

| Finding | Reused owner | Candidate specification clarification / proposed acceptance |
| --- | --- | --- |
| DISC-01 | R-ASE-08/09/40; governed Policy KB | Differentiate same-record CAS collision from conflicting independent effective obligations; preserve applicable versions and explicit authorized human ruling or unresolved result |
| DISC-02 | FR-118/119; R-ASE-19 | Require conditional consequence mechanism, counterexample, genuinely unaffected connected neighbor and bounded independent falsification |
| DISC-03 | Policy/Manual/Requirement revisions and source/build evidence | Interpret historical versus current versus future applicability using time-aligned records; unknown deployment cannot certify conformance |
| DISC-04 | FR-118/119, scoped search, staged proposals | Find missing semantic link and reject lexical decoy without authorizing invented relationship or coverage |
| DISC-05 | graph review, native history, derived projections, T-422 | Preserve correction, invalidate dependent candidates, constrain cache freshness and keep historical accepted records unchanged |

**Proposed engineering acceptance identifiers (not canonical P-14 IDs):** `GEX-DISC-01..05` map one-to-one to the table. Each requires a positive neighbor and a negative control; record actual authorization, source/revision/actor, before/after graph views, unknown/truncated scope, outcome, cost and evidence. Evaluate separate current and candidate reasoning methods on unseen tasks and multiple domains using the original unchanged reviewer charters, without supplying these specific diagnoses to blind reviewers. An author checking these examples is not proof of independent skill effectiveness or full spec validation.

**Admission boundary:** These clarifications are subordinate proposals until exact eight-file canonical reconciliation; after that, independently validate against current owner contracts and deployed capabilities. Do not assert full causal inference, infer policy hierarchy, change native test statuses or hide existing PR security/CI blockers.

### GEX governed AI reasoning and authored skill reuse — continuation, no new top-level product

1. **Source/identity reconciliation:** inspect source artifact `manual-test-authoring` (525-line revision with A–H modes, state/role/permission/cross-cutting/test-condition/RTM/PTM and improvement journal), identify any contradictory earlier version, its missing referenced files and whether it is installed/approved anywhere; inspect the canonical D-14/T-422 ownership contract and verify its actual implementation and running MCP capabilities. Review `product-testing`/Primary User Type → Module → Context only from accessible exact source; do not claim local Nesberry edits are merged or live.
2. **One method owner:** classify full reusable manual-test-authoring method and any graph-specific interpretation profile into *reuse / extend / compose / separate candidate only if justified*. Preserve effective resolver, version digests, authoring method governance and protected human approval. A method change can alter AI querying and case ideas using installed tools, not change protected data/algorithms/auth. Keep project-specific adapters and optional specialist methods distinct from general approved core.
3. **Outcome-based graph insight:** add supported agent reasoning over permission-filtered, revision-pinned graph subgraphs; preserve state/transition/forbidden, upstream/downstream, user type/module/context, missing independent oracle, risk, existing Case matches, test-quality strength and source/provenance/uncertainty. Output proposed native Cases for human or delegated execution without requiring CI/code. Build no "shadow QA graph" or extra authoritative record store.
4. **Real feedback/distillation:** capture case author review/correction reasons, meaningful manual/agent results, confirmed findings, false positives, inaccessible links and drift in existing history; derive inert Skill/graph/model hypotheses, promote only after independent trial and human approval. Project-specific lessons never automatically become global defaults. Run a fixed and held-out suite against champion/candidate method versions and at least two different app contexts.
5. **Proof and rollout:** establish actual MCP read/candidate writer contract and client compatibility, negative auth, malicious source prompt-injection, invented edge rejection, stale skill/graph invalidation, pinned-input/output comparison with disclosed LLM variation (deterministic replay only for algorithms whose contract guarantees it), withheld oracle/no-code cases, human-readable manual case quality, no duplicate case writes, true manual run/evidence and rollback. Record exact LLM/version, Skill digest, graph revision, budget, outputs and independent reviewer decision. First rollout may be read-only, then governed proposals; no autonomous protected writes.

**Implementation work still prohibited in this draft:** no production agent grants, automatic Skill activation, background model retraining, migrations, branch merges or target application's uncontrolled active probing. Final eight-file P-14 validation, fresh assurance closeout and current PR #167 concurrency/security overlap reconciliation remain separate gates.

### Method improvement and independent review admission

Use [§13.4.1 of the Skills view](skills-governance.md#1341-principle-distillation-and-contextual-instantiation), mirrored by canonical 06, to classify a material miss before changing a skill: missing rule, ambiguity, rule not reached, rule not applied, or result not checked. Preserve observed evidence separately from causal hypotheses. Repair the existing guidance or evaluation mechanism that owns the issue; do not add feature-shaped universal rules or modify team charters to manufacture the desired result.

For a candidate method, record the intended outcome, relevant existing capability comparison, variation/invariant boundary, feasible alternatives, grounded choice and remaining uncertainty. Validate with independent tasks from differing contexts, a legitimate deterministic/no-AI outcome, a counterexample and an insufficient-evidence case. Keep authoring examples separate from held-out tasks; retain complete outputs and exact method/model/input identities. A document review can verify contract consistency but cannot prove the method would independently discover this particular direction or improve a deployed product.

Rerun the existing nine specialist roles and separate Graph closeout under their unchanged charters and original ordering/quorum rules. Give cold reviewers the objective and pinned sources without prior findings, preferred architecture or prescribed journey list; freeze their initial receipts before comparison or informed deltas. Report actual independent executions, membership/quorum, scope and evidence limits. A missing capability, quorum or runtime observation remains explicit, never converted into a pass.

## Work package S — Skills Library and human-only governance substrate (bounded security foundation before agent writes)

**Scope:** Reconcile existing proposed governed test/requirement/skill assets in `docs/reviews/governed-asset-evolution-reconciliation.md` against the eight Tesbo canonical specs and actual KB versions/ACL, case approval, Zyra, MCP and graph writers. Implement only a justified incremental extension. Inventory and lock all user/agent/REST/MCP/import/background/legacy publication entrances **before** claiming the guard can be enforced.

**Slice S0 (no agent-write exposure):** Implement the **minimum** immutable/versioned effective-skill reader, human-controlled assignment and protected bootstrapped Skills-authoring meta-skill required for integrated milestone I3. Full library search/evaluation and advanced UI should not hold back I1/I2 source/agent visibility, but no new governed agent writer may bypass active assigned skills or approved publication. Extend immutable skill identity + version history and public metadata read by authorized clients, authenticated context resolver with deterministic approved active assignments (module, subtype, audience, workspace/project), explicit unassigned/conflict behavior, and a protected bootstrapped Skills-authoring meta-skill. Define human governance authentication and separation of duties; implement revoke/disable, rollback-as-new-version, concurrency, cache invalidation, stale-work handling, ACL and audit. Human-only assignment API and UI must be denied to every MCP/machine principal, including tokens owned by admins.

**Slice S1 (candidate-only):** Extend D-14 QA Standards & Playbooks with Skills Library and Assignments subviews, plus MCP `list/get/resolve`, `create_skill_candidate`, `propose_skill_version` through existing native domain boundaries, with immutable and idempotent candidate receipts. Candidates remain inert, unavailable for authoritative resolution regardless of ID or author. No agent activation, assignment, approval, priority or active-version edits through *any* route. Protect against candidate instruction injection and secret/data leakage.

**Slice S2 (integration):** Pin skill version+digest and assignment IDs into authored or transformed candidate requirements/cases/manuals/policies/tasks/file descriptions and their change context; raw external evidence/source observations retain truthful not_applicable/unknown skill provenance and independent authorized intake; implement human review, evaluate/preview comparisons, stale assignment handling and backward-compatible migration. Backfill unknown provenance as UNKNOWN. Integrate with existing authoring, Zyra, graph and notifications; prove every bypass path closed. Do not require every module capability to be built before a read-only resolver pilot, but no governed write may bypass enforcement.

**Ship together at each slice:** migration/ownership evidence, typed contracts, authorization (including direct URL/API), negative tests, realistic UI, conflict/revocation/partial failures, schema drift probe, CI test accounting, disposable-project authenticated lifecycle and a separate human-review proof. See `skills-governance.md` `SK-E2E-01..28` and `requirements.md` R-ASE-21..36.

**Blockers:** proof of existing canonical skill asset ownership; human-only credential/authZ boundary distinct from the token owner's identity; approval model for root bootstrap and composition; policy on no active skill; compatibility with current MCP clients and direct REST writes. No automatic schema claim, release claim or authority migration before these are resolved.

## Work package A — Native requirements and testcase links (first authored-artifact integration)

Extend the existing Requirements UI and KB `requirement_note` document/version owner with a stable typed native requirement and acceptance criteria. Resolve and pin **approved active requirement and test-case skills**, including subtype-specific composition, to generated/updated candidates; missing/stale/conflicting required skills block guarded publication. Extend native relationship services and MCP to create/read/revise native requirements, author case candidates and link them by native ID/revision. Preserve external Jira/Linear/Notion ownership and synced mirrors, and existing testcase history. Recompute separate authored/approved/executed coverage.

**Ship together:** migration only if actually needed; REST + MCP adapters; native UI; permissions; optimistic versions; idempotency; audit; reader migration/compatibility; API/UI/database tests; disposable agent create→read→update→link→approve/reject checks. Prove ASE-E2E-01, -02, -05, -07, -08, -11, -12.

**Blockers:** demonstrate how the existing graph canonical link layer represents the native case relation without misusing `sourceRefs` or external ticket keys.

## Work package B — Governed manuals and policies

Use existing Knowledge Base documents/versions/folders. Implement internal/external and audience/subtype-classified user manual views and section review/update workflow, separately from source authority, exposure and confidentiality. Effective approved manual skills govern candidate drafts, with version pins. Add internal/external/externally mandated policy applicability and skill composition; keep audience, authority and distribution independent. Add decision/policy/rule governance and immutable accepted policy revisions, authority, previous/effective history, enforcement refs, and semantically valid corrections. Reuse Tesbo's actual reviewer/notification/audit services; adapt Nesberry policy triad by principle, not path or status vocabulary.

**Ship together:** UI views + diffs, REST + MCP proposal interfaces, enforcement of human approval, history immutability, stale-impact notifications, missing-verification status and tests for both legitimate changes and adversarial unauthorized attempts. Prove ASE-E2E-03, -04, -13.

**Blockers:** settle which existing KB version representation supports immutable accepted revisions and whether a narrow metadata extension is needed. Agent cannot assign its own normative authority.

## Work package C — General work items and file/evidence access

Use applicable approved task/issue and files/evidence skills to govern agent candidates and provenance. Extend existing Zyra task board/activity and Bugs relationships into one general project work-item/task journey, without changing the meaning of existing AI-generation tasks or duplicating Bugs. Add safe upload/link/metadata/byte-verification MCP/REST path over existing KB file/storage owner; use existing evidence links.

**Ship together:** work-item classification/ownership/status, board UX, source-aware reopen/close rules, MCP integration, project membership/role limits, file size/type/content validation, provenance/hash and storage-exists truth. Prove ASE-E2E-02, -07, -09.

**Blockers:** existing KB restore/download semantics and exact files/evidence owner must be re-verified. No speculative file service rewrite.

## Work package D — Connected Change Packet and reviews

Compose the existing FR-115/T-455 changeset identity, FR-119 impact lifecycle, FR-027–037 proposals and FR-118/T-426 typed relationships into the Change Packet view, using existing graph history/review, Zyra activities and notification delivery with exact effective skill-assignment/version/digest pins per applicable proposal, applicability dispositions, typed edges and durable review receipts. Handle idempotent resume, conflicting revisions, partial writes and per-domain approval. Surface the change in a **single** Zyra review screen and project traceability report rather than creating a second Copilot.

**Ship together:** bounded batch API and thin MCP orchestration, atomic selected native publication with a shared transaction client; partial staging/external-effect journals and explicit resume under ASER-C03–05, stale/current links, history, deduplication and notifications, error recovery, exact typed report views. Prove ASE-E2E-01 through -10 and -14 through -15.

**Blockers:** prove candidate vs approved vs executed vs deployed identity distinctions from the current graph and native runs before enabling completion badges.

## Work package E — Agent adoption and CI guardrails

Publish app-agnostic agent installation template with mandatory effective-skill resolution, conflict/absence/stale failure and meta-skill authoring controls; support Claude Code and a distinct `AGENTS.md`-reading agent. Inspect actual tool catalog at runtime, secure project binding, existing-record reconciliation, delegation and N/A reasoning. Add source/PR linkage verification and opt-in CI policy that reports missing domain assessments without mandating unnecessary updates.

**Ship together:** negative tests for cached catalogs, token mismatch, no MCP connection, replay, conflicting revisions, human rejection, cross-project links and offline resolution. Prove ASE-E2E-04, -06, -07, -08, -14.

**Blockers:** project-aware secure secrets and reconnect flow; avoid requiring always-on remote calls for builds without bound Tesbo integration.

## Independent specification assurance (separate from implementation author)

Use the **actual canonical** Nesberry team charters/orchestration as an independent review method applied to this Tesbo specification. Preserve original isolated findings and evidence before reconciling them. Do not reword the teams' instructions to elicit expected issues, and do not describe a written list of hypothetical objections as team findings.

Review targets: the exact same eight canonical specification files and all six subordinate repository views (README, requirements, design, skills-governance, agent-rule template and this plan), plus the pinned Tesbo source/living baseline and the unchanged applicable Nesberry charters and referenced methodology. Confirm input hashes, source and charter revisions in every invocation; record sampling and unexamined areas rather than implying full-file or runtime coverage.

For each invoked team preserve: role/charter SHA, input SHA, invocation identity, original findings, counterexamples, user/engineering consequence, evidence tier, proposed falsifiable test, explicit unknowns and false positives. Follow the canonical role order and **Graph then White closeout** using actual delegated reviewer invocations. Record any incomplete formal quorum or missing target verifier; an analytical agent receipt is not an operational human approval. An unexecuted review stays `not_run`.

The *specification* is the review target; the teams' methodology is not being rewritten as part of this PR.

## Verification gates

- **Architecture:** no duplicate owner for requirements/cases/documents/policies/bugs/tasks/files; call native services with existing validation/authorization.
- **Correctness:** reuse-first no-duplicate scenario; native requirement versioning/traceability; approval/publish exact-version checks; stale edit conflict; idempotency; partial failure recovery.
- **Security:** project and token isolation; delegated principal has no elevated authority; target source binding; file access and byte verification; role/plan/approval bypass attempts.
- **User experience:** correct modules/records visible to QA/BA/coding agent/PM/manual owner, accessibility and single Zyra workflow.
- **Execution:** selected unit/integration/E2E suites actually execute; approved cases only; attached evidence and target revision truthful.
- **Operations:** tool schema/version deployed identity, notification idempotency, rollback/cancel/retry, audit and history.
- **Documentation:** descriptions match verified source and current UI; unimplemented features explicitly labeled proposed.

- **Graph-extension falsifiers:** watcher/provider outage, duplicate/reordered/cancelled events, renamed/deleted source, unsupported/dynamic parse, direct/transitive/unlinked consumers, source/model/guard contradiction, cyclic/bounded path generation, existing-case equivalence and no duplicate write, native dispatch without target assertions, stale build/old Passed history, unavailable evidence bytes, foreign-project graph edge, revoked source binding and accessible role-specific UI.
- **Evidence rule:** register new outcomes as ASE-FLOW-17..54 in the existing scenario matrix; map each to original FR/T/MBT/QA IDs under P-14 before canonical acceptance. Proposed tests, static source selection and prior successful CI do not constitute executed acceptance of these outcomes.

## Non-authorized actions in this PR

Do not modify production tenants, delete/migrate live data, mark tests passed, claim target E2E verified, silently revise approved policies, assume all 58 source tools are deployed, alter agent charters, or merge before review and green checks. No actual assurance-team execution is recorded by writing this plan.


## Work package F — Event, human-activity, consistency and release additions (integrates I1-I7)
**F1. Source observation and idempotent event reconciliation (I1):**
- Inventory current graph/source bindings, graph capture, notification writers and provider integrations; define source event IDs/scope, observer schemas and subscribed source revisions; Kiro-like optional hook is **advisory**, never the only trigger or authorization.
- Add or reuse provider/CI event intake, permissioned manual reconciliation and durable reconciliation cursor. Deduplicate same event, tolerate out-of-order delivery, preserve event gaps and `stale/unknown` state; audit unauthorized source and project.
- Tests: source commit with no agent hook; duplicate webhook; forced gaps; hidden/unbound repo; changed deployed version without source PR; delayed source review notifications.

**F2. Agent activity and trust-tiered timeline (I2):**
- Reuse Zyra task/agent session/history and graph receipts, map external submitted events to observed/provider-attested/agent-reported/inferred/unknown without collecting unnecessary full prompts or hidden reasoning.
- Add UI and API read models with actor attribution, correlation IDs, tool capability metadata, outcome, timestamps, privacy scope and access limits.
- Tests: no runner receipt, delegated actor identity, missing agent event, wrong-project trace read, redacted restricted policy evidence, QA versus PM view.

**F3. Compact context and safe composite MCP (I3):**
- Select 1–2 compound operations that remove genuine agent round trips; extend the existing proposed `get_quality_context` and T-422 `get_effective_testing_method` owners; authoring/skill names are aliases/profiles until actual capabilities are advertised. A composite proposal adapter must not create a second context resolver or writer.
- Keep native CRUD and reviewed apply as owners; introspection/scopes and project/plan locks apply to each suboperation. Use revision guard, payload digests, idempotency and per-item partial receipts.
- Tests: authorization parity with direct endpoints, partial write/retry, concurrent updates, stale skill binding, legacy bulk bypass, disabled per-project MCP, old client catalog.

**F4. Read-only cross-artifact consistency/negative-space analysis (I4):**
- Existing graph/Model Studio and requirement/case/KB/policy references provide candidate relationships; define source authority, expected behavior vs observation, typed links and current revision.
- Compare approved requirement/policy with changed code/agent inference and docs, output conflicts, unknowns, stale references and missing coverage; do not auto-edit authoritative artifacts or claim exhaustive semantic proof.
- Tests: deliberate policy contradiction, stale linked case, missing documented customer journey, permitted N/A, no target build and false-positive challenge.

**F5. Role-sensitive change/release workspace (I5-I6):**
- Extend Zyra change-review page and existing project navigation/reports; no separate Copilot, independently writable readiness state or duplicate document system. Use the concrete ASER-UX01–03 capability/recovery mapping in canonical 02/07 and retain the existing exact-link, pending discovery and dirty-state contracts. Define role-specific decision needs for solo/developer, BA, QA, PM, policy/security, support and executives; preserve field/evidence ACL.
- Release readiness includes specific source/deploy candidate, approved expectations, case/run results, verified evidence, known defects and risks, human sign-offs, rollback/forward and monitoring. Native policy P-07 and MCP P-18 remain binding.
- Tests: three roles consistent identities, accessible status/navigation, no leaks, approval version drift, merged-not-deployed, degraded after smoke, wrong build, postdeploy incident and resumed QA.

**F6. Delivery improvement measurement (I7):**
- Integrate deployment/source/incident facts into existing reports, preserving provider attribution. Define DORA change lead time, deployment frequency, failed-deployment recovery time, change fail rate and deployment rework rate; avoid combining throughput and instability into a false safety score.
- Add human-level time-to-understand, review effort, unmatched code changes, missing artifacts, inaccurate agent assertions, production defects and release rework only when observable.
- Tests: blank deployment integration yields NO_DATA; failed release not excluded; rework deployment counted under explicit rule; clock normalization and period denominator; no causality claim from one snapshot.

**GEX integration under F1:** first prove provider and optional local watcher observations remain distinct from immutable Git capture; support add/modify/delete/rename, missed-hook reconciliation, stale/out-of-order delivery and verifiable incremental/full source re-index without client-controlled server roots. Reuse current graph history and project source binding. An unhandled language, repository scope or dynamic relation is UNKNOWN, not a false no-impact candidate.

**GEX integration under F4:** extend FR-117 Model Studio's current sequential generator only through versioned guarded/data/composed capabilities, then link verified source dependency paths to existing accepted model/requirement/case relationships under FR-118/119. Preserve original source/oracle/edge revisions, explicit unlinked candidate disclosure, coverage denominator and no duplicate native case creation. The internal Tesbo CI impact planner is not a new target-project graph owner.

**GEX integration under F3/I3-Q:** native model-run creation is dispatch only. Join model obligations to the independently assigned executor with its own driver, original report bytes, verified assertions/build/fixture/oracle, separate retest attempt and exact human selection/review. Require real target proofs for conformance. Skill assignment and authoring governance do not arise from a watcher, graph path or code-derived test result.

**Integration exits in order:** (1) source revision without agent is visible or explicitly UNKNOWN; (2) code-dependency links nominate native cases and preserve unlinked impact gaps; (3) bounded accepted behavior models propose nonduplicative scenarios; (4) target runner returns verifiable outcomes and coverage basis; (5) one source→QA→original evidence→retest→decision journey is proven in a disposable project. Different increments may ship partial capabilities, each labelled with unsupported semantics and unexecuted obligations; I3-Q cannot be skipped.

**I1-I7 acceptance fixtures:** `requirements.md` R-ASE-37..48 and canonical-baseline ASE-FLOW-01..16, plus proposed GEX ASE-FLOW-17..54. These are **proposed tests**, not CI E2E executions or a new official canonical QA numbering authority. Bind every implementing task to existing original Tesbo FR/T/QA IDs after reading the current eight-file baseline.

## Skills quality/acceptance and cross-module release gates
1. **Version and assignment separation:** candidate/version, approval and effective binding are different states; older effective version remains active until independently authorized assignment changes.
2. **Agent must be non-governing:** MCP and all machine-principal API paths cannot edit prior skill text, approve or assign/activate/deactivate, even if bearer token belongs to owner/admin. Reject client-supplied human assent.
3. **Authority is not audience:** internal/external manuals and policies preserve independent source/authority, distribution and access rules and subtype-specific effective skills.
4. **Root cannot self-authorize:** protected meta-skill bootstraps through human-only authority; new agent-authored meta candidates are inert; dependency cycles and weaker adapters are rejected.
5. **Effective selection is deterministic:** version pin, context filters, composition/precedence, conflicts and missing required assignment are testable and observed, including after revocation and cache invalidation.
6. **No historical fabrication:** new publication uses exact skill assignment/version/digests; historical artifacts without known pins remain UNKNOWN; frozen runs do not change retroactively.
7. **Evaluation is not self-certification:** lint/pass-through examples don't prove improved output; held-out test cases and counterexamples, reviewer records and real verification required.
8. **All write entrances covered:** regression tests exercise direct UI/REST/MCP, Zyra, imports, automation and older client routes rather than assuming a new Skills module implicitly gates them.
9. **Green quality checks are distinct from deployment:** no actual implementation E2E/test/review claim until authenticated runtime checks and independent sign-off exist.

### PR #167/#168 integration and security verification gate (2026-11-19 checkpoint)

The two Tesbo PRs change overlapping integration surfaces. PR #167 owns the current security, MCP principal/consent, reviewed publication, transaction and recovery implementation. PR #168 is a proposed subordinate graph/Skill documentation extension. Keep #167's implementation and tested invariants authoritative until any later proposal is independently reviewed and deliberately implemented; **do not treat a documentation-only PR as deployment evidence**.

Before #168 can be marked ready: (1) reconcile the eight canonical 1.4.29 files from verified exact original bytes with P-14 owner receipts; (2) diff both PRs against the updated `development` head, not their shared historic merge base; (3) preserve #167's native authorization, source/provenance and human-review rules; (4) resolve PR #168's current-tree secret finding using its actual location/rule or verified upstream mitigation, without broad scanner exclusion; (5) prove approved-versus-activated lookup, race revalidation and correction-history invariants through proposed SK-E2E-41..44 or canonically assigned equivalents; (6) obtain genuine independent, source-pinned team receipts rather than a self-authored role simulation; (7) pass fresh CI after final reconciliation.

A failed security check is a merge blocker even for documents until its underlying match is identified and disposed of correctly. A passing PR #167 check does not certify the different #168 tree. GitHub's `mergeable` flag is not a sufficient release gate. Record remaining proof as BLOCKED/NOT RUN rather than infer success.

### Specification assurance rerun obligation
After any material Skills-governance spec revision run each of the established teams against the **spec itself** (Blue reuse, Red premises, Green seams, White completeness, QA lifecycle, Grey user journeys, Security trust boundary, Purple UX, Graph evidence, Elephant-Gold cold read) with Simulation performed as Grey’s declared G0/G1 activity, not an invented additional formal team. Record per-role evidence, falsifiers, findings, unresolved risks and outcome in a review receipt. **Charter-guided desk inspection by the specification author is NOT independently executed agent/team review**; log that distinction if no delegated independent-run capability is available. Do not modify the team charters to lead them to expected answers.

## Integrated source prerequisites and rollout gates (revision 1.4.28)

| Existing task / scope | Concrete prerequisite before affected capability is exposed | Required proof / evidence boundary |
| --- | --- | --- |
| T-002/103/104/305/430 + A/S0 | All case/status/approval/dependency writers retain principal kind and exact reviewed meaning; staged candidate IDs resolve only at apply | Positive and denied tests across UI, both MCP aliases, REST/entity, bulk/import/clone/restore, Zyra, SDK/jobs/integrations; valid human CAS and stale refusal; new-run eligibility and preserved old snapshots |
| T-411/439 + E/F3 | P-18 opt-in/named-client policy at external initialization/discovery/calls, plus current membership/scope | OFF/unknown/revoked/cached-client probes on both aliases; legitimate enabled client works; native authorized access remains independent |
| T-438/422/448–452 + B/S | Immutable governed snapshots and one guide resolver/binding owner; current coalesced KB history is not exact accepted history | Two edits inside snapshot window, intervening submission/review, concurrent base/assignment change, history/restore readback; global/workspace/project scope and reader authority checks |
| T-307/207/433/459 + C/F3 | Bug association is separate from execution/result correction | Side finding linked to Passed/Untested keeps result/time/performer; explicit valid correction has its own approval and preserved prior attempt; sealed automated positive control |
| T-455/456 + F1 | Stable source binding/configuration revisions and explicit multi-source capability | Rebind then delayed old event; two repos in one release and one source in two releases; configuration-only/source-free change; no false complete first slice |
| Requirements owner + A/F4/F5 | Successful empty versus unavailable/partial/denied/stale linkage and coverage | Timeout/403/partial provider response, successful empty, source/project switch and late response; no duplicate suggestion or false zero/ready |
| T-301–306/457 + D/F3 | Full operation lifecycle, native atomic apply, readback and explicit resume | Uncertain acknowledgement, partial staging, changed skills before resume, cancellation/rejection/supersession and required audit failure; no duplicated or half-published official records |
| T-461 + F5/F6 | Phase-aware release/readiness and versioned deployment metric normalization | Tested candidate before deploy; actual build after deploy; failed smoke retained in production-change population; independently scoped risk/decision; missing data and censored recovery |

These source conditions are not repaired by this documentation change. They are coupled implementation prerequisites already belonging to the named native owners. Their runtime regressions, migration and current UI checks are **NOT RUN** in this specification-only change. The archive preserves the previous scoped implementation evidence without expanding its claims.

### Required evidence record per implementation task

Keep fixture/project and principal/capability, exact source/build/schema, initial native IDs/revisions, action and injected fault, required and forbidden effects, authoritative readback/DB assertion, evidence bytes and cleanup in the task/PR. Verify the negative case and a valid neighboring path. A source check, structural document check, model agreement or scenario count is not executed product acceptance. Existing runtime limits, external client compatibility, root recovery/quorum, actual authority mappings, retention and operating budgets must be explicitly closed by their accountable owner before exposure; unknown remains a named gate.

### R-ASE requirement → canonical owner/design → work → proof crosswalk

All 48 scoped requirements are represented individually. Existing FR/T identifiers remain unchanged. `D` is the ASER design in canonical 03; `Cnn` is ASER-Cnn in canonical 04; `UXnn` is ASER-UXnn in canonical 02/07. Work packages S/A–F are integration slices of the listed existing task owners, not a second implementation backlog. Slash/range scenario shorthand denotes individual existing IDs in the same family. All scenario evidence remains **NOT RUN** unless a separate exact-revision runtime receipt says otherwise.

| Requirement | Existing canonical allocation | Design / contract / UX | Work slice | Falsifiers / proof obligations |
| --- | --- | --- | --- | --- |
| R-ASE-01 | FR-115/118/119; T-455/457 | D §4/18; C02/C05 | D/F1 | ASE-E2E-01; ASE-FLOW-03; ASE-INT-07 |
| R-ASE-02 | FR-119/124; T-457/461 | D §4; C01/C05 | D/F5 | ASE-E2E-04; ASE-INT-16 |
| R-ASE-03 | FR-110/118; T-303/426/450 | D §2/5/18; C06 | A/E | ASE-E2E-02/11; ASE-INT-06 |
| R-ASE-04 | FR-110/112; T-104/304/438 | D §3/18; C03 | A | ASE-E2E-01/11; ASE-INT-02/04 |
| R-ASE-05 | FR-118/121; T-426/458 | D §4/14; C02 | A/F4 | ASE-E2E-12; ASE-FLOW-08 |
| R-ASE-06 | FR-027–037; T-103/104/305/430 | D §5/18; C03 | A/S0 | ASE-E2E-12; ASE-INT-03/04 |
| R-ASE-07 | P-05; T-438 | D §3/7/18; C03 | B | ASE-E2E-01/04; ASE-INT-02/13 |
| R-ASE-08 | P-07; FR-112; T-304/438 | D §8/18; C03 | B | ASE-E2E-03/13; ASE-INT-02/11 |
| R-ASE-09 | FR-118; T-426 | D §8; C02 | B/F4 | ASE-E2E-03; ASE-FLOW-05 |
| R-ASE-10 | FR-071–079; T-201/206/307 | D §3/18; C03/C05 | C | ASE-E2E-02; ASE-INT-03 |
| R-ASE-11 | FR-018–025; T-204/205/443 | D §3/6; C03/C06 | C | ASE-E2E-09; ASE-INT-09/14 |
| R-ASE-12 | FR-010–017/060–063; T-102/105/203 | D §5/12; C03 | D/E | ASE-E2E-14; ASE-FLOW-03; ASE-INT-03 |
| R-ASE-13 | FR-030/035; T-301/305 | D §6/13; C04 | D/F3 | ASE-E2E-05/06; ASE-INT-05 |
| R-ASE-14 | FR-122; T-207/433/459 | D §15; C01/C03 | F5 | ASE-E2E-10; ASE-FLOW-04; ASE-INT-08/12 |
| R-ASE-15 | P-10/P-18; T-401/411 | D §5/17; C03/C04; agent brief | E | ASE-E2E-08; ASE-FLOW-01; ASE-INT-12 |
| R-ASE-16 | FR-115/119; T-456/457 | D §11/14; C01/C05 | E/F1 | ASE-FLOW-02; ASE-INT-16 |
| R-ASE-17 | FR-065/066; T-005/401/439 | D §6/17; C04/C06 | E/F3 | ASE-E2E-08; ASE-FLOW-15 |
| R-ASE-18 | FR-010–017/123; T-102/103/106/411/439 | D §6/18; C03/C06 | S0/E | ASE-E2E-07/12; ASE-INT-03/06/09 |
| R-ASE-19 | FR-115–119; T-455/457/458 | D §11/14; C02/C05 | D/F4 | ASE-E2E-15; ASE-FLOW-05 |
| R-ASE-20 | FR-030/119; T-206/306/457 | D §5/12; C05; UX03 | D/F5 | ASE-E2E-06; ASE-FLOW-07; ASE-INT-05 |
| R-ASE-21 | FR-076/077/112; T-422/452 | D §10/18; Skills §2/12; C03 | S | SK-E2E-01/02/12/13; ASE-INT-01/02 |
| R-ASE-22 | FR-107/108; T-449/450 | D §10/18; Skills §2/5; C03 | S | SK-E2E-04/05/06; ASE-INT-01 |
| R-ASE-23 | P-07; FR-033; T-102/103 | D §10/18; Skills §3; C03 | S0 | SK-E2E-03/18; ASE-FLOW-12; ASE-INT-03 |
| R-ASE-24 | FR-108/113; T-422/448 | D §10; Skills §4/12; C03 | S0 | SK-E2E-09/10/17; ASE-INT-01/11 |
| R-ASE-25 | FR-108/111; T-450 | D §10; Skills §5/13; C03 | S0/S2 | SK-E2E-06/08/16; ASE-INT-09 |
| R-ASE-26 | FR-108; T-422/450 | D §10; Skills §5/12; C03 | S | SK-E2E-08/09/17/22 |
| R-ASE-27 | FR-112; T-452 | D §10; Skills §5; C03/C04 | S2 | SK-E2E-05/11/15; ASE-INT-05 |
| R-ASE-28 | P-05; FR-123; T-438 | D §7/10; Skills §1/6; UX02 | B/S2 | SK-E2E-07; ASE-INT-06 |
| R-ASE-29 | P-07; FR-118; T-438/426 | D §8/10; Skills §1; C02 | B/S2 | SK-E2E-07; ASE-FLOW-05 |
| R-ASE-30 | FR-112/122; T-452/459 | D §10; Skills §12/13; C03 | S2/C | SK-E2E-15/28; ASE-INT-09 |
| R-ASE-31 | FR-123; T-102/106/450 | D §10/18; Skills §6/14; C06 | S0/S1 | SK-E2E-09/14/21/25; ASE-INT-06 |
| R-ASE-32 | FR-114; T-453 | D §10; Skills §8/13 | S1/F6 | SK-E2E-20/27 |
| R-ASE-33 | FR-108/111; T-451 | D §7/18; UX02/03 | S1/F5 | SK-E2E-03/04/06; ASE-INT-13 |
| R-ASE-34 | FR-037; P-17; T-002/103/430/439 | D §18; Skills §7/14; C06 | S0/S2 | SK-E2E-19; ASE-E2E-12; ASE-INT-11 |
| R-ASE-35 | FR-119; T-457 | D §10/14; Skills §5/14; C05 | S2/D | SK-E2E-05/15; ASE-FLOW-09 |
| R-ASE-36 | FR-108; T-450 | D §10/18; Skills §12; C06 | S0/S2 | SK-E2E-11/16; ASE-INT-14 |
| R-ASE-37 | FR-115/116; T-455/456 | D §11/18; C02 | F1 | SK-E2E-23; ASE-FLOW-02/16; ASE-INT-07 |
| R-ASE-38 | FR-060–063/122; T-203/206/433 | D §12; C01; UX02 | F2 | ASE-FLOW-04/07/12; ASE-INT-09/13 |
| R-ASE-39 | FR-120/030/035; T-301/305/401 | D §13; C03/C04 | F3 | SK-E2E-24; ASE-FLOW-06; ASE-INT-04/05 |
| R-ASE-40 | FR-115/118; T-455/458 | D §14; C01 | F4 | SK-E2E-26; ASE-FLOW-05; ASE-INT-10 |
| R-ASE-41 | FR-119; T-306/460 | D §12; UX01–03 | F5 | ASE-FLOW-07/13; ASE-INT-13 |
| R-ASE-42 | P-07; FR-124; T-461 | D §15; C01/C05 | F5 | ASE-FLOW-08/10; ASE-INT-08/16 |
| R-ASE-43 | FR-122; T-207/433/459/461 | D §15; C01/C02 | F5 | ASE-FLOW-11/14; ASE-INT-08/15 |
| R-ASE-44 | FR-124; T-461 | D §15; C01 | F6 | ASE-FLOW-11; ASE-INT-15 |
| R-ASE-45 | FR-116/119; T-203/456/457 | D §11; C02/C04/C06 | F1 | ASE-FLOW-16; ASE-INT-07/14 |
| R-ASE-46 | FR-123; T-106/440 | D §12; C06; UX02/03 | F2/F5 | ASE-FLOW-07/15; ASE-INT-06/13 |
| R-ASE-47 | FR-114/124; T-005/453/461 | D §17; UX01/02 | F6/E | ASE-FLOW-01/07; ASE-INT-12/13 |
| R-ASE-48 | P-07; FR-115; T-201/455 | D §5/18; C01/C05; UX01 | A–F | ASE-E2E-04; ASE-FLOW-13; ASE-INT-16 |

### Additional integration falsifiers — planned, NOT RUN

These 16 cases close specific integration seams exposed by independent review. They complement, not replace, ASE-E2E-01–15, ASE-FLOW-01–16, SK-E2E-01–28 and the existing canonical QA/MBT suites. Each runs only in an authorized isolated fixture with real native persistence where claimed. The oracle is the applicable contract, not the implementation or an agent summary. Every denied action must preserve forbidden state, and every refusal has a valid neighboring positive control.

| ID | Fixture and steps / fault | Required effect and forbidden effect |
| --- | --- | --- |
| ASE-INT-01 | Approved platform guide G1, workspace pin and project overlay; read through old method entry and new skill/context profile; propose/approve G2 without assigning, then explicitly assign | Same T-422 identity/resolver and exact hashes from both entries; G1 remains effective until assignment; no fake project, copied core, implicit MCP enablement or model-key dependency. Candidate read is data only. |
| ASE-INT-02 | Mutable KB draft A; submit B; edit C within 15 minutes; concurrently submit stale base and change skill assignment; approve/retrieve B and restore a permitted draft | B's exact governed content/semantic metadata/attachment and method hashes persist unchanged; stale submit refuses; ordinary autosave remains usable; no invented historic approval or mutation of the accepted snapshot. |
| ASE-INT-03 | Current approved case A plus independent custom fields/links; machine token owned by admin and a permitted human; exercise create/update/status/bulk/clone/import/restore/approval and new-run entrances. Separately link a side Bug to a Passed/Untested attempt | Every protected path retains principal kind and exact reviewed meaning; machine cannot approve/publish; legitimate exact human transition works. A changed definition cannot inherit approval, skipped run items are disclosed, old run remains unchanged. Side association changes no verdict/time/performer; explicit valid correction has its own reviewed receipt. |
| ASE-INT-04 | Shared staged requirement/case/suite operations, one already committed dependency and one unapproved dependency; select a batch and inject mandatory audit failure | New native IDs only inside valid apply; selection is dependency-closed; existing commitment reused exactly once. Unapproved dependency or audit failure produces zero official partial writes, no orphan suite and no independent audit success. |
| ASE-INT-05 | Composite stages requirement, fails manual and loses case response; change effective skill; repeat same key/digest, then request explicit resume with stale/current journal revision | Duplicate only reads logical receipt; uncertain item is read back before action; committed operations never replay. Stale resume/skill blocks affected remaining work, preserves history and requires new candidate revision where intent changed; reused key with different payload conflicts. |
| ASE-INT-06 | Approved assigned skill, authorized draft candidate and restricted policy/evidence across two projects; exercise direct/list/history/RAG/recent/folder/Zyra/export/graph/cache reads, then revoke access | Only approved assigned manifest is governing instruction; authorized candidates remain inspectable as data; no cross-project bytes/identity/count leak or cached privilege renewal. Missing access is permission-safe uncertainty, not successful empty or activation. |
| ASE-INT-07 | Source A/configuration1, rebind B/configuration2; deliver duplicate/out-of-order A events; one release combines two repos and two releases consume one shared commit | Historical event retains A/config1; unrelated current head is not advanced; receipts dedupe without erasing distinct revisions. Release decisions/results remain independently scoped. Single-source capability refuses/incompletely labels multi-source claims. |
| ASE-INT-08 | Known tested candidate B1 before deployment; exact human decision; deploy observed B2 or unknown build; later critical policy change and smoke failure | Initial decision can proceed with proper pre-deploy evidence without invented production proof. Wrong/unknown deployed build prevents post-deploy acceptance; changed context visibly stales prospective reliance. Original decision, failed observation and subsequent retest remain immutable. |
| ASE-INT-09 | Revoke authoring skill while authorized runner/provider submits a raw failure; external MCP OFF in a separate branch; use agent-reported claim without independent target proof | Raw observation is retained only through its independently authorized route with truthful skill N/A/provenance; stale authored promotion remains blocked. MCP OFF denies its discovery/calls; a separately granted provider channel is not conflated with MCP. Receiving a report does not certify its described execution. |
| ASE-INT-10 | Feed every ASER-C01 consistency value, unknown future schema value, approved-policy/code conflict and a valid cosmetic N/A | All consumers preserve exact meanings/reason/source/scope; unsupported schema refuses or truthfully degrades. Analyzer stays read-only; no generated requirement auto-ratifies code and no-detected-issue never means complete correctness. |
| ASE-INT-11 | Legacy approved-looking rows with unknown provenance; adopted governed project, old client/import/job writer, revoked human capability and failed migration/audit | No fabricated approvals, skill pins or source history; explicit compatibility/rollout state. Old entrance cannot bypass the same native guard; denied/retried work preserves drafts and exact history. Root recovery requires separately authorized human policy, never agent emergency assent. |
| ASE-INT-12 | Zero official cases and no Tesbo model key; external ChatGPT task/prompt → assigned executor own driver → original bytes → analysis → linked retest → human edits/rejects/selectively approves/applies | Exact task/attempt fences, immutable R1/R2 originals and true actor; analyst can consume actual permitted evidence. Only selected reviewed native effects persist once; manual fallback retains attribution. No run/model/case prerequisite, copied report substituted for original, or false local/production verification. |
| ASE-INT-13 | Same change viewed by BA, QA, PM and solo multi-role human; restricted evidence, stale deep link, dirty comment, revoked action and project switch with delayed response | Common exact IDs with permission-filtered payloads; real next owner/action and recoverable denial. Native drill-down returns to same valid context, drafts/focus preserved; no private counts or stale cross-project content. Authentic UI, keyboard, reflow/zoom and AT checks are separate required runtime evidence. |
| ASE-INT-14 | Resolver/source outage, lost notification acknowledgement, queue redelivery/dead-letter, expired claim, interrupted upload and unavailable bytes; also successful empty provider read | Distinct bounded states, durable obligations and safe readback/resume; no silent empty fallback, duplicate publication, false delivered/verified bytes or claim that local executor was killed. Measured task-specific resource/retry/retention limits and recovery owner are recorded before deployment. |
| ASE-INT-15 | Fixed event fixture: production activations D1,D2; D2 later fails smoke, remediation deployment D3; duplicate D2 delivery; failed pre-production pipeline P; one unresolved incident and one unavailable provider | Normalize/dedupe at documented deployment grain: D2 stays in qualifying production population; P is separate, D3 classified consistently. Preserve denominators, source/time window, missing data and censored recovery; NO_DATA is not zero; no claimed Tesbo causality. |
| ASE-INT-16 | Cosmetic change with no policy/manual effect; separately security-sensitive change requiring an unavailable policy/manual capability; mixed rejection and authorized deferral | All seven domains assessed; cosmetic N/A has reason with no fake record. Required unsupported work blocks relevant readiness unless a valid scoped authority permits an explicit exception. Rejected-only proposal can settle while independent QA/release obligations stay open; I8 is not a waiver. |

### Full material-journey inventory for this integration

Grey independently reconstructed 49 material journeys from actors/jobs, surfaces/entrypoints, requirements/states and available code/data paths. These are scoped review IDs, not new native test IDs. Initial evidence was 37 G0 simulations + 12 G1 source-grounded traces, with 24 HOLDS / 21 INCONCLUSIVE / 4 FAILS and **zero runtime observations**. The 43 high-risk and 6 medium-risk journeys each retain an explicit execution obligation below. A bounded HOLD does not establish full branch coverage or implementation; FAILS include source behavior that requires extension before the intended contract can hold. Independent QA challenge, delta results and exact branch omissions belong to the existing assurance record. This is not a line-by-line audit of the whole historic package or repository.

| Journey | Goal | Risk | Original bounded evidence | Current implementation proof obligation |
| --- | --- | --- | --- | --- |
| GJ-01 | Create/adopt a workspace/project with one approved method reference and usable secure access; no accidental MCP enable or execution | High | G0: HOLDS | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-02 | Enable, scope, inspect, rotate and revoke external access; disabled/foreign projects stay undiscoverable | High | G1: INCONCLUSIVE | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-03 | Register/select an actually capable analyst backend and independent executor, then swap runtime without losing identity or granting privileges | High | G0: HOLDS | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-04 | Start, switch, resume and hand off one durable project/session with truthful native/external summaries and intact drafts | High | G0: HOLDS | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-05 | Retrieve exact authorized requirement, guide, case, report and skill context with explicit completeness | High | G1: INCONCLUSIVE | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-06 | Ask a zero-case exploratory testing question and dispatch the exact reviewed prompt without a Tesbo AI key | High | G0: INCONCLUSIVE | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-07 | Execute assigned authorized scope using the executor's own driver and report tested/blocked/not-tested truth | High | G0: INCONCLUSIVE | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-08 | Clarify, cancel, expire, reassign or resume interrupted testing without widening scope or restoring stale authority | High | G0: HOLDS | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-09 | Return and independently consume original case-free report/evidence, including manual fallback and supplements | High | G0: INCONCLUSIVE | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-10 | Critique evidence, ask a precise linked retest and compare independent new report before revising proposals | High | G0: HOLDS | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-11 | Human edits, rejects, approves and separately applies exact selected dependency-closed operations | High | G1: FAILS | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-12 | Author/revise a case in existing editor while preserving structured content, reference images and unsaved work | High | G0: INCONCLUSIVE | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-13 | Import/migrate/export cases losslessly and reconcile identities without silently publishing or corrupting history | High | G0: INCONCLUSIVE | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-14 | Maintain suite placement and project metadata without unintended child/case changes | High | G0: HOLDS | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-15 | Prepare/associate a plan and run using eligible approved cases, including scheduled/automation entrances | High | G1: FAILS | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-16 | Perform a pinned test definition and record independently verified condition results, not just action checkmarks | High | G0: HOLDS | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-17 | Triage direct/side/unresolved observations into correct existing/new defect and coverage action | High | G1: FAILS | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-18 | Correct an accepted result or verify a reported fix while preserving all prior failures and exact history | High | G0: HOLDS | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-19 | Create/revise native requirements and exact criterion/case relationships without requiring an external tracker | High | G1: INCONCLUSIVE | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-20 | Read/sync an external requirement, distinguish stale/unavailable source and preserve provider authority | High | G1: HOLDS | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-21 | Maintain the correct manual/document section for its audience with exact history, independent access and review | High | G1: FAILS | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-22 | Propose and human-authorize a policy change with decision, effective revision and enforcement evidence | High | G0: HOLDS | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-23 | Track implementation/documentation/policy work and blockers without misclassifying generation tasks or duplicating Bugs | Medium | G1: INCONCLUSIVE | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-24 | Upload/link/retrieve/retain general files and evidence with bytes, provenance and permission truth | High | G0: HOLDS | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-25 | Start from spontaneous/prepared code and assess each relevant engineering domain in one resumable change | High | G0: INCONCLUSIVE | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-26 | Observe/reconcile source changes without hooks and preserve multi-repo/branch scope, event ordering and gaps | High | G1: INCONCLUSIVE | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-27 | Delegate work to multiple agents and resume with correct actual principal and common parent identity | High | G0: HOLDS | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-28 | Recover a multi-artifact partial/ambiguous write and offline session without duplicating committed records | High | G0: HOLDS | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-29 | Independently detect cross-artifact contradictions and unresolved obligations without rewriting the approved oracle | High | G0: HOLDS | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-30 | Find, claim, assess and close durable QA impact work despite failed notifications and stale links | High | G1: INCONCLUSIVE | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-31 | Discover/import/create/repair a skill candidate while retaining stable identity and inert immutable revisions | High | G0: HOLDS | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-32 | Human reviews/promotes a skill and separately assigns/activates/revokes/recovers its effective binding | High | G0: INCONCLUSIVE | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-33 | Govern an artifact write using exact contextual composed skills and recover in-flight drift/conflict | High | G0: INCONCLUSIVE | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-34 | Evaluate a skill/method improvement against independent fixtures and preserve unknown/valid alternatives | Medium | G0: HOLDS | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-35 | BA/QA/PM/support understand one change, inspect permitted proof and return to their next action | High | G0: INCONCLUSIVE | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-36 | Release owner assesses exact candidate evidence and makes a fixed accountable decision | High | G0: HOLDS | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-37 | Follow deployment through smoke failure, incident, rollback/fix-forward and independent later retest | High | G0: HOLDS | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-38 | Read/export truthful delivery, coverage and instability measures with clear scope/denominators | Medium | G0: HOLDS | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-39 | Inspect/correct/discard a bounded ephemeral model candidate without implied persistence or execution | Medium | G1: INCONCLUSIVE | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-40 | Create/import, review, approve, activate, retire or roll back a persisted behavior-model revision | High | G0: INCONCLUSIVE | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-41 | Map/reuse cases, generate bounded model paths and explicitly prepare an authorized native run | High | G0: HOLDS | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-42 | Traverse exact typed requirement/model/case/attempt/Bug/evidence relationships, including missing/deleted historical sources | High | G0: INCONCLUSIVE | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-43 | Capture/reconcile product-learning observations and approve an exact amendment without self-authorized implementation | Medium | G0: HOLDS | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-44 | Share/revoke a run or evidence projection while keeping source/private history inaccessible | High | G0: HOLDS | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-45 | Archive/delete/restore a project or record with truthful retention and link consequences | High | G0: INCONCLUSIVE | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-46 | Restore identity/access and recover work after membership, token, session or entitlement changes | High | G0: INCONCLUSIVE | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-47 | Roll out new governed writers and migrate old records/clients without fabricated provenance or hidden bypass | High | G0: INCONCLUSIVE | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-48 | Deliver a scheduled/outbound project report or notification with authorized recipients and retry truth | High | G0: HOLDS | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |
| GJ-49 | Derive target actors/module/context and draft source-backed stories without imposing Tesbo or pilot categories | Medium | G0: HOLDS | NOT RUN — fixture, before/after native truth, required/forbidden effect, alternate entrance and denied/retry branch; QA oracle and exact build evidence required. |

The three independently identified major mechanism families are exact case approval versus status, Bug association versus independent execution truth, and governed snapshots versus ordinary KB edit history. ASE-INT-02/03 and the existing native task gates cover their implementation falsifiers. The original case-free QA loop is a separate capability gate (ASE-INT-12/QA-135–138). The full writer/reader inventory, actual human authority/root policy, migration, source/deployment/MCP compatibility, operational budgets and authentic UI/AT evidence remain required. The case list does not replace those gates or declare them passed.

