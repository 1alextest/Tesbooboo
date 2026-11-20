# ASER — Governed Skills Library and Effective Skill Assignments

**Canonical home:** Tesbo specification package revision **1.4.28**, the same eight files `00_README.md` through `07_UI_DESIGN_TASKS.md`. This repository file is a subordinate integration view, not a ninth normative specification. Current requirements, owners, contracts, implementation gates and proof obligations are reconciled in those eight files. This is a **proposed design; NOT FROZEN and not an implementation/deployment claim**. P-07 human publication, P-14 eight-file ownership and P-18 project MCP consent remain unchanged. The independent review and its evidence limits are recorded in [the existing assurance record](reviews/2026-11-18-charter-guided-spec-challenge.md).

**State:** Proposed contract for specification review, not implemented. **Scope:** Tesbo project/workspace authoring governance; no change to authoritative product behavior until explicit approval and implementation.
**Relationship to existing work:** Reconciled at the logical-contract level in the same eight canonical files, revision 1.4.28, with `docs/reviews/governed-asset-evolution-reconciliation.md` (noncanonical v0.5), the eight original Tesbo canonical specs, existing Knowledge Base/versioning, case approval, Zyra and MCP. This is an ASER proposal, **not** a new ninth canonical spec, a second AI agent, or an independent skill database.

## 1. User jobs, actual categories and orthogonal axes
A human project/workspace owner assigns governed instructions to the modules and narrower contexts that agents author. Agents consult those instructions when proposing requirements, test cases, manuals, policies, tasks/issues, and files/evidence. Humans govern which instructions are active. Skills themselves are also authored under a *skills-authoring meta-skill*.

**Classification dimensions must not be conflated:**
- `module`: requirements | test_cases | user_manuals | policies | tasks_issues | files_evidence | skills.
- `subtype` within a module: requirements functional/nonfunctional/business/technical/regulatory; tests manual/automated/API/security/performance/accessibility; manuals end-user/staff/admin/support/developer/operations; policies product/business/organizational/security/regulatory/customer-facing; tasks work/bug/investigation/change; files evidence/source/test data/attachments; skills authoring/distillation/evaluation/maintenance.
- `audience`: internal, external, partner, public, mixed (multiple audience bindings allowed).
- `authority_origin`: internal decision, contractual, regulator/statute, standard, external provider; **not** synonymous with whether a policy is externally published.
- `exposure`: private/restricted/shared/public, independently governed by native authorization and information classification.
- `applicability`: workspace/project, system/module/feature, actor, operation, jurisdiction/locale, environment, phase and product domain, as supported/verified.
Examples: an internal operator manual with an external legal source; an external-facing privacy policy that is internally approved; a customer manual for administrators only. A label must not grant public access or normative authority.

## 2. Canonical owner and records
The canonical governed-guide/skill owner is **T-422 / D-14 QA Standards & Playbooks**, extended by FR-076/077/106–113 and T-448–453. One resolver serves native UI, Zyra, REST and MCP. Project-specific authored text reuses current KB document/attachment identity with an explicit immutable submitted/accepted snapshot extension. Ordinary coalesced edit history alone does not meet that invariant. The platform-approved pack and workspace pin retain their distinct scopes; no fake project or copied global core content is permitted. Add typed governance metadata and indexed assignment relations only where necessary. Never duplicate byte stores or let a graph projection become the authority.

Each **skill identity** has stable `skillId`, name, purpose, origin (native/imported), provenance, owning scope, owner, compatibility constraints and zero or more immutable version records. Each **skill version** has `skillVersionId`, parent/head reference, revision number/content digest, normative instructions, references/assets, creation actor and source evidence, supported modules/subtypes, applicability predicate, dependencies, anti-patterns, examples/counterexamples, required input/output contract, validation/evaluation evidence, and status. A newly created skill is a **candidate**, not an active instruction. Version sequence and draft-iteration sequence are distinct; rejected/abandoned candidates never become published versions.

A **skill assignment** is a *separate governed record*: `assignmentId`, exact `skillId+approvedVersionId`, target workspace/project/module/subtype/context predicate, priority or composition rule, active/inactive state, effective interval, assignment policy/approval receipt, actor and immutable history. Disabling one assignment does not delete/inactivate the underlying skill or silently disable its use in other contexts. Global skill availability, version approval, binding activation, and per-project applicability are four different facts.

An artifact revision and Change Packet record the exact **resolved effective skill set**: assignment IDs and versions, skill version IDs, digests, resolution outcome (matched/not applicable/conflict/unavailable) and timestamp/revision. A later skill or assignment change cannot rewrite historical provenance.

## 3. Authorized operations: separate creation from governance
| Operation | Agent via project MCP | Authorized interactive human |
| --- | --- | --- |
| `list_skills`/`get_skill`/read approved and allowed candidates | YES, per visibility | YES |
| `resolve_effective_skills` for its bound operation/context | YES, read-only | YES |
| `create_skill_candidate` (new identity, draft only) | YES, least-privilege | YES |
| `propose_skill_version` (successor/branch, draft only) | YES, with base-version precondition | YES |
| Alter an existing skill-version payload, including one's own submitted candidate | **NO**; create another candidate/draft-iteration record | **NO**; immutable revisions |
| Approve/publish skill candidate or its successor | **NO** | YES with separate trusted review action |
| Assign/reassign a module to a skill/version | **NO** | YES with review |
| Activate/deactivate an assignment, default, precedence or policy | **NO** | YES |
| Change meta-skill, governance constraints, trust/role policy, or revoke approvals | **NO** | Governance administrator through an authorized independent process |

**Hard boundary:** MCP bearer tokens and any agent-operable REST token must have *no mutation path* to approve, assign, activate/deactivate, retire/revoke, reorder/priority-change or edit historical skill versions, including a token issued by a human owner. A human-owned service token is not proof of interactive human assent. Publish/assignment methods require separate trusted interactive authorization and durable review receipt, including CSRF/session/re-authentication or equivalent controls appropriate to the action, plus separation of duties where policy requires. Do not rely on a client-provided `isHuman`, role name, header, review flag, or a prompt instruction.

MCP may expose only additive candidate submissions, strictly project-scoped and audited. Submitted candidates are inert for effective-skill resolution, including when an agent explicitly references their IDs. Candidate display/preview never makes them authoritative. Skill proposals may be rejected/withdrawn without deleting history. An agent may be granted access to propose skills but never to promote or route them.

## 4. Governing Skills itself: protected bootstrap
A governed **skill-authoring meta-skill** tells agents how to structure a candidate: goal, scope/trigger, reusable principle, context-specific application, required evidence, invariants, prohibited assumptions, input/output examples and counterexamples, admissible exceptions, validation/evaluation and review receipt. **Principle-based generalisation** means distilling the transferable reasoning/failure mechanism, not importing application-specific conclusions or merely accumulating incident instructions.

The root meta-skill plus its promotion rules are **human-governed and server-protected**. Changes use a separately reviewed successor with independent approver(s), version pin, executable negative fixtures and a non-self-referential trust anchor (e.g. reviewed release/security policy). An agent-created meta-skill candidate cannot validate, approve, supersede, enable or assign itself. There is no automatic `skills -> skills -> ...` recursion: resolve the designated approved root once per authoring operation; reject unresolved cycles or self-dependencies.

Projects may extend the portable core with versioned, lower-precedence project adapters. Adapters cannot relax root security, provenance, required evaluation or approval constraints. An external agent instruction (`AGENTS.md`/`CLAUDE.md`) is only a trigger; it never supersedes the server-enforced effective assignment.

## 5. Resolution, composition and changes mid-flight
The effective-skill resolver takes **server-verified** project/workspace, module/subtype, operation, audience, context/scope, current authority version and principal. It returns immutable skills in a deterministic order and an input digest. Candidate-only, inactive, expired, revoked, inaccessible, incompatible-engine or unrelated-context skills do not become active. If no skill is assigned, record `UNASSIGNED` (and refuse governed writes where the module policy requires a skill); never silently select a library "latest".

Multiple active skills are legal only when their *composition* is explicitly approved: e.g. portable testing core + project adapter + security specialization. Encode precedence, applicability, required vs optional, compatible versions and conflicts. Validate no contradictory required rules, invalid inheritance, cycles, duplicate effective owners or privilege-escalating adapter. Ambiguous matches fail closed with `SKILL_ASSIGNMENT_CONFLICT`, not arbitrary lexicographic selection.

A proposal pins the effective skill set at creation. Recheck at submission, approval and publication. If an assignment changes or a version is revoked during work, leave the candidate/revision and evidence intact; mark `SKILL_CONTEXT_STALE` and require reassessment/rebase or an independently authorized, scoped and expiring exception under actual project policy. Historical records remain bound to the versions actually used. For exceptional urgent disabling/revocation, policy defines effect on in-flight proposals, downstream agents and previously published artifacts; no silent retroactive rewrite.

## 6. Trust, confidentiality and external inputs
Read skill text and attachments as *instructions only if* they come from an approved, assigned version. Imported skills, reference examples, linked files and KB content are **untrusted data**, including content that claims to be a higher-priority policy. Quarantine candidate uploads and prevent them from injecting secret-exfiltration instructions, tool calls, hidden overrides, network destinations or capability expansion into active agent contexts. A formatter or preview must not execute embedded code, scripts, HTML or untrusted tool invocations. Keep secrets out of prompts, audit and exported receipts.

Use separate authenticated project/org scope for listing, creation, reading and assignment management. A public manual or policy label must not expose private source notes or history; review access to candidate drafts and diff metadata separately. Audit actor/source, exact before/after assignment, version hash, reviewer decision, and rejected authorization attempts. Validate cache keys/ETags against project, context, assignment-head and role; invalidate on approval/assignment/revocation events. Explicitly expire offline copies.

## 7. User interface and API surface
**Skills Library**, inside existing D-14 QA Standards & Playbooks settings (not new top-level navigation): categorized search/filter by module/subtype/audience/owner; skill detail with stable ID, version timeline, source and artifacts, draft comparisons, effective usage/assignments, review status, evaluation evidence and dependencies; create-candidate and propose-next-version surfaces for permitted actors. Never make an active binding editable from the agent-facing library UI.

**Skill Assignments**, a separately permissioned subview of that same settings owner: project/workspace module rows (including manual internal/external and policy internal/external), exact pinned version, effective rules, active toggle, precedence, compatibility warnings, preview of the resolved skill set, provenance, change history, staged approval. This is human-only. Provide a clear `No active skill` state, not misleading "configured" or defaulting to draft.

**MCP proposal (not yet implemented)**: read-only `list_skills`, `get_skill`, `resolve_effective_skills`, `list_skill_versions`; additive write `create_skill_candidate`, `propose_skill_version`. No MCP assignment or promotion tools. REST/GraphQL other endpoints must also enforce this boundary server-side. Pin version/digest on `create_requirement_draft`, `create_testcase_candidate`, `propose_manual_revision`, `propose_policy_revision`, `propose_work_item`, `attach_evidence`, and Change Packets where applicable. Reuse Tesbo's existing native writer/approval services; these are conceptual contracts, not claims of current endpoint names.

**Compatibility and progress:** project tokens may currently expose broad `read/write` and some KB/case writers can save directly. Do not claim skill governance is safe by adding new MCP tools while older REST/MCP writers bypass it. Inventory every entry point and sequence enforcement rollout/migration, including existing draft/publication paths, integrations, imports, background jobs, Zyra, third-party adapters and old clients.

## 8. Evaluation and quality without self-certification
Every candidate skill should carry a testable sample set: conforming, nonconforming, adversarial input, counterexample and valid not-applicable case; version-to-version diff; expected vs observed results; who evaluated and where. Score improvements on quality and false positives, omission/novel harm, format validity, source fidelity, agent ability to comply, cost/latency and dependency drift. A candidate passing template checks is **not** proof of effectiveness. Promotion criteria and thresholds are set by governed human policy, not by the candidate itself. Held-out evaluation must not be contaminated by the authoring agent's examples; record UNKNOWN where evidence is unavailable.

## 9. Selected acceptance scenarios for this domain
| ID | Independent test / falsifier | Expected |
| --- | --- | --- |
| SK-E2E-01 | Agent creates skill for Requirements | New draft, read back; no assignment or effective change |
| SK-E2E-02 | Agent proposes v2 of active v1 | v1 remains immutable/active, v2 candidate inert |
| SK-E2E-03 | Agent with admin-owned MCP token tries assign/activate/approve via MCP and REST | All denied, no state change, audit receipt |
| SK-E2E-04 | Authorized human approves v2 but does not assign it | Approved yet v1 remains effective |
| SK-E2E-05 | Human switches module binding v1->v2; in-flight proposal authored under v1 | Current binding resolves v2, proposal flagged stale, history still pins v1 |
| SK-E2E-06 | Inactive external-manual skill and active internal-manual skill | Correct audience only; inactive never selected |
| SK-E2E-07 | External-facing policy with internal authority and private supporting evidence | Authority/exposure/audience independent, no private data leakage |
| SK-E2E-08 | Overlapping active skills with contradictory instructions | Conflict surfaced, no arbitrary auto-choice |
| SK-E2E-09 | Unauthorized adapter claims to override root meta-skill | Rejected and not loaded as governing instruction |
| SK-E2E-10 | Agent proposes a weaker meta-skill and immediately references it | Candidate never establishes its own authority |
| SK-E2E-11 | Assignment revocation mid-flight and stale/offline catalog | Block/reassess, not silent use of removed skill |
| SK-E2E-12 | Replay same proposal idempotency key with changed content | Conflict, no duplicate/mutation |
| SK-E2E-13 | Two distinct agents propose same skill successor concurrently | No lost revision; explicit conflict or parallel candidates |
| SK-E2E-14 | Rogue skill attachment embeds tool/secret instructions | Treated as untrusted, not executed or loaded as approved |
| SK-E2E-15 | Changed skill published after prior test-case execution | Past test/run/history remains pinned to original revision |
| SK-E2E-16 | A skill with no approved binding for a governed write | Visible unassigned and blocked or explicitly authorized exception |
| SK-E2E-17 | A project-specific adapter depends on incompatible core skill | Fail closed with dependency diagnostic |
| SK-E2E-18 | Human attempts to publish modified payload after review | Must obtain fresh approval of new hash |
| SK-E2E-19 | Legacy REST or Zyra direct write bypasses skill enforcement | Rejected or recorded under a specifically allowed transition policy; no invisible bypass |
| SK-E2E-20 | Candidate skill says "pass" but held-out bad cases fail | Evaluation remains FAIL/UNPROVEN; cannot self-approve |
| SK-E2E-21 | Stored skill body contains unauthorized cross-project links | Rejected on write/read resolution; no cross-project disclosure |
| SK-E2E-22 | Requirement type has both general skill and subtype-specific skill | Deterministic explicit composition with no silent override |

These are **proposed acceptance tests**, not executed tests.

## 10. Reconciliation/implementation gates
1. Prove reuse against prior Tesbo governed-asset evolution spec, eight canonical specs, native KB history and MCP writer surfaces, and any existing "skills" concepts. Document exact reuse/extend/new decision per invariant.
2. Preserve per-item stable identity, independent revisions, granular field/link audit and approved current state.
3. Write human-only authorization boundary **before** exposing candidate skills via MCP; test against human-owned machine tokens and alternative REST paths.
4. Implement deterministic resolver, including conflict, missing, revoked and stale paths; derive cache invalidation from actual assignment owner.
5. Integrate active-version pins and invalidation with existing Change Packet, Zyra review, graph history and notifications.
6. Add UI and accessibility support for library/version/assignment management and manual/policy subtypes, preserving current native component patterns.
7. Run backend DB/permission tests, actual UI tests, and disposable-project MCP create->read->propose->review lifecycle on same known deployment/tool catalog. No production writes for verification.
8. Independent assurance teams review this **specification**; implementation/release sign-off requires separate actual test evidence and White/Graph closeout.

## 11. Decisions needing authoritative specification review
- Exact canonical storage choice and whether current KB version snapshots can be immutable at publication without a shadow skill table.
- Approved precedence/combination grammar and rule conflict detection (machine-validatable subset vs human review for semantic contradictions).
- Whether a project is allowed to operate with no active assigned skill, and per-module default behavior.
- Human-only interactive approval design; independent authority boundaries for root-meta changes and initial bootstrap.
- Controlled migration path for existing authored cases and documents with no historical skill pin.
- Historical export/retention and allowed read visibility across workspace/global/project scopes.

## 12. Source-challenge clarifications (2026-11-18)
The specification's reviewer-operated preliminary risk record is [reviews/2026-11-18-charter-guided-spec-challenge.md](reviews/2026-11-18-charter-guided-spec-challenge.md). This section adds **testable corrections**, not independent team sign-off.

### 12.1 Candidate repair without mutable history
An agent may create one new skill candidate or propose successor version under a stable skill identity; after submission, its specific content snapshot/digest is immutable. Repair requires an explicit **new candidate iteration/version proposal**, referencing its predecessor and base revision, or withdrawal/abandonment of the candidate; no overwrite of the same accepted/submitted snapshot, no fabricated published version, no duplicate skill logical identity for a retry. The UI/MCP must expose these states, provenance, revision guards, idempotency and deterministic conflict receipts. Only accepted publication increments the public version sequence.

### 12.2 Separate Skills promotion from case/document publication

Skill approval, assignment, activation, precedence and root-meta promotion require protected human governance. Other protected artifacts follow their own native authorization and P-07 exact human review/apply. A proposal for bounded automatic asset publication is **not adopted** by this amendment and cannot override P-07. Skill resolution establishes authoring provenance; it grants no publication or execution authority. Candidate creation/ingestion, ordinary draft editing, exact human decision, native publication and case run eligibility remain separate facts. UI can combine explicitly selected permitted actions without collapsing their receipts or inventing extra mandatory ceremony.

### 12.3 Machine-checkable rules versus semantic review
The server can enforce a deterministic rule grammar, matching, version compatibility, dependency/precedence DAG, authorization, immutable hashes and explicit required fields; it **cannot reliably decide whether every pair of free-text skills has contradictory normative meaning or malicious instructions**. Treat unsupported semantic consistency as UNKNOWN/REVIEW REQUIRED; no claim that lint, static scan or a generated safety summary proves malicious content impossible. Protect execution with provenance+review, least-privilege tools and containment, safe rendering, separate secret/tool permissions, and a controlled declassification/publishing workflow. Reject definite schema/authorization violations mechanically.

### 12.4 Proper evidence ownership
Files that merely contain externally sourced data or raw evidence are **not necessarily authored under a Tesbo skill**. Where an agent transforms, classifies or reports on them, capture the applicable skill/assignment; otherwise mark skill `not_applicable` with an explanation and preserve independent provenance, bytes hash, chain-of-custody and inspection status. No skill association proves target runtime authenticity, evidence completeness or test passage.

### 12.5 Root skill recovery and extraordinary operations
Initial trusted root meta-skill installation, emergency revocation, replacement, loss of all active bindings and break-glass governance need an independently authorized human recovery mechanism with durable audit, explicit scope/expiry and post-event review. No agent may create its own emergency exception, no offline writer may promote a stale binding, and no implicit "latest" assignment is an emergency fallback. The exact decision owner, approval quorum and normal/emergency behavior must be resolved from Tesbo's approved project policy before implementation.

### 12.6 Cross-workspace access and history visibility
Sharing a skill across projects does not share all its candidate files, audit history, external references, secret source material or internal documents. Resolve effective assignments and read visibility at each scope; losing access to the parent/global skill makes affected project bindings invalid/unavailable, without fabricating a replacement. Historic version identifiers remain durable but payload and confidential metadata require original/access-policy authorization.

### 12.7 Truthful implementation/evaluation limits
Before shipping, specify actual workload inputs (scale, peak concurrent agents, assignment fanout, dependency depth), bounded resolver/cache/dependency limits, measured response-time targets and fallback/error budgets. Do not manufacture SLO values. The first authenticated production-like disposable-project tests must include a denied admin-owned MCP approval and alternate REST route, a real interactive human promotion, and rerunning a stale agent client against the new effective assignment.

## 13. Skills within the connected delivery assurance workflow
The governed Skills Library exists to make the **entire Tesbo human-and-agent delivery lifecycle more trustworthy**. It is not itself the product's only objective or a substitute for the native requirements, QA, manual, policy and task services.

### 13.1 Role of skill versus role of tool/event
- A **skill** prescribes a reviewed authoring/evaluation method for an applicable module, versioned and assigned only through human governance.
- An **agent hook** is an optional client-side event producer (e.g. Kiro-style task/file events), never a module-skill assignment tool, evidence of full external agent behavior or official write approval.
- A **source/CI provider event** is a scoped, separately authenticated observation of code/build/deployment state, not a request to invent requirements from observed code.
- A **composite MCP tool** invokes several native Tesbo domain actions under the same effective skills and role/approval checks; it has no elevated governance authority simply because it is one call.
- A **consistency analyzer** compares observed/inferred behavior against independently authorized requirements/policies; its output is a review candidate, not a newly approved normative source.
- A **release-readiness calculation** combines independently sourced status/evidence and human decisions, never an AI certification or automatic proof of defect-free software.

**GEX boundary:** an observed code dependency, model path, optional watcher or scored impact suggestion may inform a test-design *candidate*. None creates an effective governed skill, authorization for a script/executor, approved requirement, automatically published case, native Passed result or certified coverage. Imported GraphWalker/CodeGraphContext/TDAD-style packages require ordinary dependency/skills review and stay inert until authorized. Independent agents receive an outcome and source context, not an expected finding list or scripted assurance answer. The canonical T-422/D-14 effective-skill resolver and P-07/P-18 controls remain unchanged.

### 13.2 Governing skill resolution in a multi-step composite workflow
Before authoring, the agent retrieves approved effective skill IDs, immutable version IDs and digests per **applicable** module and subtype. Server-side compound operations check each sub-operation's skill constraints, project scope, changed content revision and native writer. A requirements skill cannot silently govern test-case publication, and the skills-authoring meta-skill cannot override project P-07 approval, P-18 external MCP consent or actual run evidence.

A partial transaction preserves skill provenance for items that committed and leaves all other items explicitly failed, uncertain or not-attempted. An exact duplicate reads the existing logical receipt; explicit resume follows ASER-C04 and never replays committed operations. On resume, changed effective skill heads require conflict/reassessment; restoring client cache alone cannot authorize stale publication. A raw provider/agent event does not become a newly skill-authored artifact solely because it was observed.

### 13.3 Source-package interoperability and safety boundary
Evaluate the portable [Agent Skills](https://agentskills.io/specification) `SKILL.md` format and auxiliary `references/`, `assets/` and optional `scripts/` as interchange representations rather than inventing a Tesbo-exclusive skill syntax. Library records must preserve a versioned package digest, attachment hashes, supported agent/engine capabilities and dependency/version constraints. **Executable skill resources are disabled by default** until independently authorized sandbox execution and scan/policy controls are implemented. A human approving skill text does not grant executable scripts/network/MCP tool privileges.

An imported skill is an inert candidate. It does not become active because an external agent includes it in its local context or uploads it to KB. Only explicitly approved Tesbo assignment records govern the module.

### 13.4 Quality and learning boundaries
Compare candidate skills using held-out task fixtures, failure patterns, omission rates, evidence fidelity, false positives, human corrections and cost/latency, without letting agent-authored evaluation examples self-prove improvement. Correlate project changes with DORA throughput/instability and review effort only as a measurement **hypothesis**, never as direct proof that a specific skill reduced defects. Skill effectiveness should use actual authoring and QA outcome receipts.

**Graph-learning governance and manual testing quality:** The T-422/D-14 Skills owner supports test design for human-manual, exploratory, mobile/Appium, browser/Playwright, API, security, accessibility, performance and CI contexts without privileging one executor. Governed techniques guide clear setup, Actions and observable Expected Results, relevant risks, negative/forbidden/boundary scenarios, semantic uniqueness and accepted-review boundaries. Repeated QA edits, rejected duplicates, improved oracles, human execution observations and defect feedback may produce a **candidate Skills revision** or a project graph quality hypothesis; only separately authorized existing human workflows may promote/assign/activate a skill, approve a testcase, revise expected behavior or alter verification status. Evaluation must compare independently adjudicated human-executable case quality, behavior-gap novelty, false negatives, real-defect evidence, maintenance and reviewer effort—not auto-generated test counts or the same model's training cases. Cross-project learning shares only approved generalized guidance, not private raw records or inferred permissions. No unexplained "quality score" grants authority.

### AI-powered graph analysis method and skill-composition proposal (GEX; NOT ACTIVE)

**Reconcile existing Skill artifacts before new identities:** `manual-test-authoring` is an earlier standalone SKILL.md authoring method, including 525-line developed version with Mode A requirement challenge, B test conditions, C manual case actions + expected observations, D/E review/restructure, F RTM, G exploration and H execution review, plus per-module role/state/permission/cross-cutting guidance and `IMPROVEMENTS.md`. It is **not verified installed/approved/assigned in Tesbo**. The Nesberry-local experimental `product-testing` method adds Primary User Type → Module → Context and user journeys but its live source/version must be verified and its project-specific adapters excluded from general defaults. Resolve the observed early "trust shipped behavior over requirement" wording against the later accepted-oracle policy before either method can govern authoring. No new repository-only method becomes effective merely by naming it in a specification.

**Skill purpose:** a governed graph-reasoning method determines *how* an AI should interpret relevant node/edge content, follow meaningful upstream/downstream/state/actor/journey context, identify weak/missing conditions, choose reviewable scenarios and explain uncertainty. It should **not** require the same test sequence, focus on every lens mechanically, or dictate preselected findings to an independent tester. Compose it with the approved test-case authoring Skill where the responsibilities differ, using T-422 existing module/subtype/mode assignments and explicit approved precedence. If the same method can be extended coherently, prefer an immutable successor over creating an arbitrary second Skill. A Skill changes reasoning configuration but cannot extend graph schema, write protected testcases, bypass source/permission checks, self-approve or execute attached scripts.

**Distillation/experimentation:** collect reasons for accepted/rejected cases, confirmed outcomes, false positives/negatives, weak oracles, upstream/downstream missed effects and UI/runtime mismatch **as versioned evidence**, separate project-specific lessons from broadly supported method changes and guard against contaminated self-generated labels. Human-curated candidate Skill versions may be evaluated (using approved frozen target graph snapshots, held-out cases, independent test designers and dissimilar projects), rejected, or separately approved and activated. Pin model/version, Skill/version/digest, graph/retrieval snapshot, exact tool capabilities, reviewer evaluation and future rollback. Historical approved cases/runs do not change with skill activation. Quality is unique useful coverage, correct expected oracle, human executability, missing critical behavior, false claims and review/cost, not a raw test count or flattering model assessment.

### 13.5 Skills-and-integration acceptance
| ID | Scenario | Expected proof |
| --- | --- | --- |
| SK-E2E-23 | A Kiro-style event hook invokes Tesbo while a skill is disabled | Event may be recorded as authorized observation; it cannot reactivate skill or publish governed records |
| SK-E2E-24 | Composite MCP creates requirement and test-case candidates | Per-sub-operation approved skill version pinned, no bypass of individual guards, precise partial result |
| SK-E2E-25 | Agent imports external `SKILL.md` package containing scripts | Package remains inert until reviewed; scripts not executed or given network access |
| SK-E2E-26 | Requirements skill conflicts with actual approved policy | Skill format is not a policy override; consistency checker raises authoritative conflict |
| SK-E2E-27 | Post-release metrics worsen after a skill upgrade | Historical skill and release facts remain accurate; no fabricated skill effectiveness or silent version rollback |
| SK-E2E-28 | External source event arrives without any agent session | Source revision may enter graph review, but no fictional agent skill-use or action history is attached |

| SK-E2E-29 | An approved testing skill is used when graph impact has missing code-to-case links | Skill-guided candidate design is allowed, but UNKNOWN remains visible; no unreviewed new requirement/case or fake coverage |
| SK-E2E-30 | A skill/tool claims a native model run was automatically executed successfully | Without original target action/assertion receipt, verified build/oracle/fixture and evidence, coverage stays unverified; no skill can self-certify |

| SK-E2E-31 | Tester corrects a weak manual case's action/expected results | Candidate improvement and original correction reason/version persisted; active skill/case does not change without human review |
| SK-E2E-32 | A meaningful case cannot be automated | Correct manual-testing method, legitimate human execution and distinct evidence class; no artificial automated failure |
| SK-E2E-33 | Learned testing method appears strong only on self-generated examples | Held-out independent human quality and real-defect evaluation blocks unjustified promotion |
| SK-E2E-34 | Code-derived behavior conflicts with approved policy but ML gives high confidence | Existing accepted oracle stays authoritative, model/skill candidate inert and conflict visible |

| SK-E2E-35 | Prior `manual-test-authoring` SKILL.md supplied without current Tesbo assignment | Source is inert candidate until verified imported, reviewed, approved and assigned; no automatic instruction authority |
| SK-E2E-36 | Skill proposes Expected Result matching shipped faulty behavior despite approved requirement | Accepted oracle remains independent; proposed case flagged for revision; no self-trained expected norm |
| SK-E2E-37 | Graph reasoning and manual-case Skills conflict about test technique/output | Resolver reports composition conflict, no arbitrary hidden override or native write |
| SK-E2E-38 | Feedback creates a promising graph skill successor version | Candidate evaluated on independent held-out coverage/manual case quality; only human approval and separate activation make effective |
| SK-E2E-39 | Activated skill v2 changes suggested cases for same pinned graph | Both output histories pin exact Skill/model/version; prior cases/runs unchanged, rollback to v1 permitted and reviewable |
| SK-E2E-40 | Skill attempts tool invocation beyond actual deployed capability or uses untrusted source instructions | Unsupported/unauthorized effect denied at native service, no invented successful tool receipt or secret/cross-project disclosure |

GEX work extends this **same** governed skills test suite; it does not create another Skills/Graph authority.

**Implementation boundary:** P-14 remains authoritative. Canonical revision 1.4.28 contains the previously reconciled Skills contracts through SK-E2E-28. The GEX additions (SK-E2E-29/30 and source/impact clarification) are a separate **unratified proposal for the next in-place eight-file update**; this view is not an independent specification owner. Undecided authority/root recovery and operating policies still gate implementation. No actual MCP/REST capability or skill authority is granted by this text.

## 14. Integration of all authoring and retrieval consumers

Use ASER-C01–06 (canonical 04) for state, immutable submission, exact human review, atomic selected apply, explicit resume and raw-observation exceptions. Candidate read access is distinct from governing authority. List/get/history/search, recent/folder snapshots, RAG keyword/vector retrieval, native Zyra fallback, graph/export/report projections and caches must carry truthful server-owned authority/visibility metadata. A candidate may be inspected as untrusted data when authorized; it must not enter the effective manifest merely because it is readable, its document type is not `ai_memory`, or its text claims approval.

The global/workspace/project bindings extend the same T-422 owner and use CAS/immutable history. Approval and current assignment are independent. Snapshot digests cover the relied-on text/package and material semantic metadata, attachment hashes, dependency versions and usage manifest; metadata corrections cannot silently alter prior accepted meaning. A change of required skill blocks the affected authored candidate's promotion, while authorized raw source events and failure evidence continue under their own grants and provenance.

The existing all-writer/read-consumer inventory and the same native review transaction are release gates. This includes old endpoints, bulk/import/clone/restore, settings, jobs, integration callbacks and generated summaries; adding a new resolver alone is insufficient. Exact mapping to current role/ownership checks is explicit and deny-by-default where undecided. Required root recovery/quorum and no-active-skill exceptions must be decided by the accountable human before enabling those paths, not inferred from a candidate or an administrator-owned token.
