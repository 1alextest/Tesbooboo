# ASER — Requirements v0.4 (canonical integration view)

**Canonical home:** Tesbo specification package revision **1.4.38 (proposed; NOT FROZEN)**, the same eight files `00_README.md` through `07_UI_DESIGN_TASKS.md`. This repository file is a subordinate integration view, not a ninth normative specification. The validated eight-file package and its review receipt control requirements, owners, contracts and proof obligations. No implementation, deployment or active-skill claim follows from this text. P-07 human publication, P-14 eight-file ownership and P-18 project MCP consent remain unchanged. Earlier independent reviews retain their original source/revision scope in [the existing assurance record](reviews/2026-11-18-charter-guided-spec-challenge.md); the current 1.4.38 continuation requires exact-revision receipts.

**State:** Proposed requirements, mapped individually to canonical owners, tasks and falsifiers in `05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md` revision 1.4.29. The 48 R-ASE identifiers are preserved as a scoped namespace in the same canonical package; existing FR/AC/T/QA identifiers are not renumbered.

## R-ASE-01 — One change, many authoritative artifacts

When a project-bound agent or human initiates a feature/change/fix, Tesbo shall allow a single **Change Packet** to reference the originating user request/task, source binding, code revision, existing requirements, cases, documents, policies, defects, work items and verification evidence by **stable native identities plus specific revisions**. `changeId` is the existing canonical FR-115/T-455 changeset identity. Change Packet is its assembled coordination view, not a second persisted completion or approval owner. One changeset can reference multiple versioned source bindings, proposals, tasks, impacts and runs; independently scoped release decisions compose those references. Graph captures remain observations and FR-027–037 owns proposal/review/apply.

**Acceptance:** A reviewer follows change → requirement revision → approved or draft case → actual execution/evidence → code/PR without ambiguous IDs. A missing link is shown as missing, not fabricated.

## R-ASE-02 — Determine applicability, do not force updates

For each domain (requirements, test cases, manuals/docs, policies/rules, work items/bugs, files/evidence, and cross-cutting skills governance), record `applicability=change_required|unchanged|not_applicable|undetermined`, with source/rationale. Separately record each artifact operation and its exact proposal/review/apply state, plus `workDisposition=active|blocked|deferred|resolved`. A domain can contain several artifacts with mixed outcomes. Deferral records an authorized owner, reason, scope, due/review trigger and any approved exception; it is not a passing approval. Non-update outcomes need evidence or an explicit unknown. The single contract and derived completion predicate are in canonical API/design revision 1.4.28.

**Acceptance:** A CSS-only correction can properly mark policy `not_applicable`; a changed permission rule cannot be silently marked `unchanged` without comparing applicable sources.

## R-ASE-03 — Reuse-first source reconciliation

Before proposing an artifact, the agent shall be able to list/search relevant project records and their version/status, inspect authority, compare existing sources and use **update existing** whenever the canonical record already exists. Unknown identity stays unresolved rather than creating duplicates.

**Acceptance:** Replaying an agent session or switching to a second agent does not create a second requirement/manual/case for the same stable source identity.

## R-ASE-04 — Native requirements

Tesbo shall support authoring, browsing and revising **native requirements** without an obligatory Jira/Linear/Notion connection. A requirement has stable identity; title/description; normative acceptance criteria; state; owning project; immutable reviewable revisions; rationale/actor/source; and typed links to cases, policies, work items, code changes and evidence. Use/extend existing Knowledge Base and Requirements surfaces, not a second wiki.

**Acceptance:** Create native requirement, create a revised criterion, view both revisions, link exact case to exact requirement revision, and see stale/missing coverage. An external ticket remains attributable to its provider and cannot be overwritten by a native update.

## R-ASE-05 — Correct traceability semantics

A typed requirement-to-test-case relation shall be different from `sourceRefs` (authoring citation), `jiraIssueKey`/other external ticket keys, a generated draft, an execution verdict and actual product coverage. Reporting shall expose these separately.

**Acceptance:** A draft case linked to a requirement must not count as approved/executed/passing coverage. Archiving a case preserves history and removes eligibility for current coverage according to policy.

## R-ASE-06 — Cases and verification

Agent-generated case changes enter **FR-027–037 shared unpublished staging**, using stable logical operation identities. A candidate is not a native Draft testcase. New official IDs are allocated only at protected apply; existing approved cases remain unchanged until their exact selected amendment is applied. Extend native case approval and run admission so eligibility requires the exact current human-reviewed definition and relevant dependency revisions, not an `Approved` label alone. Publication, approval and eligibility are distinct facts, even when an explicit human action requests their permitted combination. Preserve steps, expected results, postconditions, classification, technique, reviewer views, source provenance and edit revision. Reuse existing Model Studio when behavior models apply; never require model-first development.

**Acceptance:** Source code change proposes a negative-path case and a regression update; reviewer can accept either, reject either, and see exactly which persisted approved case changed. An unapproved case cannot enter an approved-only run through REST/MCP/automation.

**GEX-03/05/06 extension (proposed):** Reuse FR-117 Model Studio and native case/review/run owners for bounded, deterministic *scenario proposals* from independently accepted expectation revisions. Capability/version metadata distinguishes supported sequential models from proposed guarded/variable/data/composed models; unsupported semantics are refused, not silently simplified. Match existing canonical cases before requesting a new case. A path proposal, published/approved case, selected run and genuinely executed target observation are different records. Generated candidates pin model revision, source of expected behavior, options/digest, fixture assumptions and approvals; never self-publish or set a result.

**GEX manual-first QA design (R-ASE-06/FR-117; proposed):** Tesbo must create and improve **human-executable native Test Cases** from approved requirements, user journeys, policies, specifications, design/UX, previously accepted cases, observed tester sessions and defects *even without Git, CI, code access, formal models or an automation executor*. The graph may propose positive/negative, role/security, forbidden transition, data/boundary, lifecycle/recovery, integration, usability/accessibility and other justified paths; do not force irrelevant techniques or duplicate existing native cases. Each proposed case has purpose and linked normative obligations, preconditions, actor/environment, reusable test data/fixtures, executable step Actions paired to **observable Expected Results**, postconditions/cleanup, provenance, uncertainties and recommended verification mode. The existing reviewer can amend and approve via FR-027–037/native Case owners; a learning score or graph traversal cannot publish, retire or mutate an Approved case. A valid manual case without automation stays available and counts as *designed* obligation coverage, not automatically as *executed* coverage.

**Quality is multidimensional:** actual scenario/risk relevance; expected-result/oracle specificity; missing/negative/forbidden behavior; coverage of actors, roles, states, data and recovery; clarity of preparation/steps; human executability and accessibility; reproducibility; novelty against existing cases; maintenance burden; and *confirmed* historical fault detection where available. Propose meaningful additional cases when they close gaps, improve weak cases rather than simply increasing counts, and retire duplicates only through existing authority. Case count, code coverage, model edge coverage, mutant score, frequency of Failed or an opaque learned score alone cannot certify case quality.

**Acceptance:** QA authors an approved manual case for a requirement-only project with reproducible setup/actions/expected observations and records it under an existing Suite; unsupported automation does not block creation. An existing equivalent case is suggested for update/linking, not duplicated as a new ID. A vague oracle like "system works" is flagged for human correction rather than treated as verified. A separate automation binding can later reuse the same case/revision without overwriting past manual attempts.

**GEX AI graph reasoning and previously-authored QA skill (R-ASE-06; proposed):** Tesbo shall use a permissioned AI reasoning capability over *retrieved, attributed and revision-pinned* project graph context, with governed method guidance from the existing T-422/D-14 effective Skills resolver. It shall reason about relevant **who/what/why** and outcome/actor-or-event/capability/context relationships using the applicable FR-109/110 profile, lifecycle states, allowed/prohibited transitions, preconditions, upstream producer and downstream consumer effects, data/permission boundaries, error/recovery and user-visible consequences; use appropriate test techniques and supported domain knowledge to propose *actual useful* test conditions and human-executable native Cases. AI should identify missing facts and contradiction rather than hallucinate nodes, requirements or execution results. It shall first search existing case/model/requirement identities and propose revisions or links before any new Case; no forced positive/negative case per irrelevant context, no automatic high test-count target.

**Skill provenance and quality:** Reuse the external `manual-test-authoring` skill as a **candidate source**, including its mode selection A–H, state/decision/role/permission/cross-cutting guidance, per-step observable expected results, RTM/PTM and feedback distillation. The exploratory `product-testing` method for user-role journeys is a separate candidate input, not a proven global pack. Before adoption, resolve any conflict where that skill treats **current implementation behavior as authoritative Expected Results**: accepted requirements/policies are the independent oracle, code/UI observed outputs are facts used to detect deviations; intentional approved limited-state requirements are a distinct accepted exception. Any distinct graph-analysis method must be composed explicitly with test-case authoring under existing T-422/D-14 assignments, not silently override or clone it.

**Acceptance:** With only a business requirement, Tesbo explains a potential upstream/downstream and state change with independently grounded sources, identifies an important missing test condition and proposes an actionable human Case, citing accepted oracle and describing uncertainties. A correction to a Draft step refines the existing case, not a duplicate. With source-only evidence and no approved oracle it requests review instead of writing expected behavior as fact. A model/skill response that invents a graph relationship cannot persist it as trusted. Switching a **human-approved effective skill version** may change the AI's candidate analysis on replay without changing native schema, historical Case revisions, authorization or previously recorded results.

**Method selection and improvement:** Apply the [principle-distillation contract](skills-governance.md#1341-portable-method-for-discovery-and-principle-distillation), mirrored in canonical 06, to distinguish desired outcomes, existing capabilities, variable reasoning methods and stable constraints. Prefer the smallest sufficient supported mechanism; no change, an existing manual workflow, deterministic rules, or a requirement clarification can be the correct answer. This graph direction is a target-specific choice, not a universal requirement to add AI. Each method proposal records its evidence, applicability, rejected alternatives, uncertainties and evaluation limits.

## R-ASE-07 — Manuals and technical documents

Tesbo shall distinguish internal staff/operator/admin/support/developer documentation from external/end-user/partner documentation and independently govern audience, access/exposure, authority and product/feature applicability; internal/external is not a two-value replacement for manual type. Each document subtype may resolve distinct approved skills. Tesbo shall support versioned user-manual content with audience/screen/feature applicability, preserved document identity, section-level diff where feasible, reviewer status, and links to affected requirement/behavior. Use the existing Knowledge Base as canonical document owner. Distinguish observed/verified behavior from documentation inferred from code.

**Acceptance:** Updating a user-facing workflow proposes an update to its existing manual section, not a second manual. A purely backend refactor may document `not_applicable`.

## R-ASE-08 — Authority-backed policies and rules

Policies include both internal governance/application-operational rules and externally-facing/externally-mandated policies. Distinguish audience, publication visibility, authority origin, jurisdiction and enforcement locus; external origin does not imply public exposure or agent change authority. Govern each applicable policy subtype with approved skill assignments. A policy shall identify its normative authority, scope, invariant text, effective revision/date, status, predecessor, change reason, decisions and implementing rule/guard/test links. A semantic change creates an immutable successor; a metadata correction is a separately attributed event and cannot mutate a previously relied-on snapshot. Approved and effective are separate; effectivity changes require their own authorized decision. The agent may propose, but only an authorized principal can approve/activate it.

**Acceptance:** A proposed agent policy cannot silently supersede an approved one; a conflicting concurrent policy revision is rejected, not last-writer-wins. A policy without enforceable controls is visibly marked unenforced, not implied to be enforced.

## R-ASE-09 — Decision / policy / rule separation

Tesbo shall distinguish (1) decision and rationale, (2) approved policy/invariant, (3) product rule/enforcement. Maintain typed, directional links and versions; any unsupported target is an explicitly unresolved edge, not a successful link.

**Acceptance:** Reviewer can answer who authorized a permission rule, which version applied to a prior run, how it was enforced and which paths/tests must be re-reviewed after change.

## R-ASE-10 — Work items and issues

A task/issue/change request shall support a general work-item lifecycle with owner, reporter, type, priority, status, blocked-on, PR/commit, related records and activity history. Extend the existing project task board/Zyra task review where structurally applicable; Bugs remain the defect owner. A Zyra testcase-generation task is not automatically the canonical task for implementation.

**Acceptance:** Fixing an existing defect updates the existing bug/work item; creating a new implementation task does not create a duplicate bug or invisible shadow board.

## R-ASE-11 — Files and evidence

The existing Knowledge Base files/evidence service shall support authorized agent references or uploads as needed, preserve file identity, ownership, hash, storage verification state and revision/retention semantics. A metadata row does not prove a binary exists; generated output does not prove target execution.

**Acceptance:** Missing/unretrievable bytes are surfaced independently of metadata; a mismatched tenant cannot download/link the file.

## R-ASE-12 — Delegation without authority escalation

One parent agent may call or delegate to specialized QA/BA/documentation/policy/task subagents. Tesbo shall attribute submissions to the actual authenticated principal and optional delegated actor, retain the same parent Change Packet, enforce per-role tool permissions, and prevent one domain's agent from unilaterally publishing another domain's approvals.

**Acceptance:** A policy-drafting subagent receives no implicit permission to approve policy; its output remains a candidate with provenance.

## R-ASE-13 — Safe retries and concurrency

Every multi-artifact proposal shall carry a stable idempotency key; mutation of existing records shall require a base version/editRevision and detect concurrent changes. Candidate staging and external effects may have durable per-item partial receipts. P-07 selected, dependency-closed **native publication** remains all-or-nothing within the real shared transaction, including mandatory audit and logical-operation commitments; if an adapter cannot participate, refuse or stage before publication. A repeated exact command reads its logical receipt without silently executing more work. An explicit resume rechecks authorization, revisions, skill context and the outcome of uncertain operations; committed operations are never reapplied. External handoffs use outbox/reconciliation and do not turn a partially published native batch into success.

**Acceptance:** Duplicate MCP call creates no duplicate requirement or case; two agents revising the same requirement detect divergence; a failure after staging a case candidate but before staging the manual amendment is safely resumable. This is partial unpublished staging; the later selected native apply remains atomic and cannot leave an official case half-published with its required manual amendment.

## R-ASE-14 — Source, test and release truth

Capture independently: observed source commit/revision, declared expected behavior revision, case approval revision, run selection, execution result, agent report provenance, evidence-byte validity, deployed target build evidence and reviewer sign-off. Do not conflate these states.

**Acceptance:** Code passing local/unit/E2E tests does not change a production-deployment verification status. If the target build is unknown, show it as unknown.

**GEX-07 extension (proposed):** Verification history shall distinguish modeled obligations, linked cases, admitted selections, actually executed attempts, outcome observations and independently verified conformance. Evidence pins exact target build/environment, accepted model/oracle revision, guard/data/actor fixture, original runner receipt, artifact-byte state and decision principal. The denominator and excluded/unknown obligation scope are explicit. An older Passed case, graph edge or governed native Run does not constitute evidence for a newer code/model revision.

**GEX manual evidence parity (R-ASE-14; proposed):** Native Run/Execution accepts genuine human-executed Approved cases, manual exploration when policy allows, and delegated/automated attempts under different authenticated actor and evidence classes. Preserve the case revision, tester identity, timestamp, test data/setup, known or unknown build/environment, actual vs expected observations, original results and applicable evidence/artifact state. A human does not need a machine runner receipt to have a real manual execution; likewise an AI self-reported test cannot impersonate a human or independently witnessed automation. Optional screenshots are not universal proof; unknown build/evidence remains unknown; Bug linking does not rewrite unrelated manual statuses.

## R-ASE-15 — Agent instructions as portable trigger

Publish a short, app-agnostic `AGENTS.md`/`CLAUDE.md` rule that fetches the exact active governing skills (including approved meta-skill when proposing a new skill), refuses absent/conflicting required assignments, and triggers applicable Tesbo updates for any development iteration, chooses the bound project securely, queries capabilities and existing records, respects authority/approval, records disposition of every domain, and closes with truthful links/gaps. Its content shall be phrased as general principles with context-sensitive decisions, not fixed Tesbo/Nesberry business answers.

**Acceptance:** Claude Code and a separate generic coding agent use the same project binding and can produce equivalent change-proposal receipts without hidden agent-specific state.

## R-ASE-16 — Enforced completeness signal

A PR/CI policy shall be able to verify that the change has a traceable packet and assessed artifact domains, or an authorized scoped exception, without requiring unrelated manual/policy edits. A prompt alone is not enforcement. CI shall independently verify refs, statuses and versions against Tesbo's authoritative API or an explicitly validated signed/exported receipt.

**Acceptance:** A change that modifies a governed rule but omits policy disposition is flagged; an absent/offline Tesbo connection yields `blocked`, not a false green check. The gate may initially be informational, with deliberate promotion criteria.

## R-ASE-17 — MCP/client compatibility

Tesbo shall expose capability/schema version and reliable deployed identity. Agent flow shall test tool availability and expected field contracts at runtime, and reject or degrade truthfully when the connected client cached an older catalog.

**Acceptance:** A source branch advertising a newer tool does not cause an agent connected to an older deployed 50-tool catalog to claim it used that tool.

## R-ASE-18 — Security, isolation and data stewardship

All reads/writes shall honor project/organization memberships, immutable skill history, server-only effective skill assignment and human-only governance/promotion, case approval roles, policy authority, KB ownership, token scope, active plan locks, confidentiality, input validation, audit logging and least-privilege uploads. The MCP facade shall call **native application services**, not update tables directly to bypass invariants.

**Acceptance:** Cross-project requirement link, stale update, unauthorized approval, attempts to forge source identity, and tool-call replay with modified payload are rejected and audited.

## R-ASE-19 — Change-impact and freshness

When the underlying source, policy, requirement or manual changes, the existing graph/change-review machinery shall identify affected linked artifacts and signal **review candidates** with freshness/provenance labels, including absent, uncertain and indirect links. A link is not proof of coverage.

**Acceptance:** Changing a requirement revision marks affected case mapping stale pending review; a change with no evidence-backed edge is not invented as a definite impact.

**GEX-02/04 extension (proposed):** For changed source declarations and verified AST-level supported dependency relationships, derive direct/transitive *review candidates* using the existing graph and FR-118/119 link owners; annotate source span, relationship direction/type, parser/model version, origin, freshness and why each native case or uncovered obligation is implicated. Unsupported languages, dynamic dispatch, missing consumers, stale/incomplete parser scope and absent code-to-case bridges remain explicitly UNKNOWN/INCOMPLETE. An empty list cannot mean `no affected tests` without a fully reconciled declared scope. Impact ranking is advisory and must not suppress high-risk, unknown or independently required regression obligations.

**GEX uncovered behavior and weak-test gap discovery (R-ASE-19; proposed):** Graph analysis must distinguish missing behavior obligations, missing/weak *expected-result assertions*, missing test design, Draft-only case, Approved but unexecuted case, manually executed result, agent-reported result, genuine observed result and evidence that is stale for current requirement/build. Detect meaningful negative/forbidden and missing/omitted behaviors even if line, edge, path or mutation coverage appears high; code-less projects remain supported. Record independent normative source vs implementation inference, semantic duplicate possibility and explicit unknown. A question about an undescribed expected behavior becomes a clarification candidate, not a fabricated requirement or defect.

### GEX semantic obligations and consequences (R-ASE-19/40; mirrored from canonical 01, proposed)

The **existing** graph shall support authorized, revision-scoped interpretation of what a linked source *means* to a user, operator or system: actor and audience; goal; normative obligation versus descriptive instruction versus implementation observation; triggering conditions; permissions; state/guard and forbidden effects; upstream prerequisites; downstream effects; exception/recovery behavior; effective scope/time; and evidence provenance. The graph must connect approved **Policies** (normative rules and decision/enforcement provenance) and **User Manuals** (audience-specific procedures and intended user-visible behavior) to requirements, code observations, behavior-model revisions, native cases, runs, defects, tasks and evidence *without transferring authority across edges*. Manuals can reveal potential missing expectations but never independently override an approved policy; external mandates are authority only when separately validated in their governing scope. Conflicts, expired versions, contested meanings and missing links are explicit review candidates rather than resolved by LLM confidence.

**Acceptance:** A changed approval rule triggers explainable potential effects on relevant user instructions, roles, state transitions, downstream audit/notifications and tests; each consequence has an evidenced or hypothetical path with provenance. A manual describing a workflow contrary to current approved policy raises a contradiction for owners; the manual cannot redefine the expected oracle. The same behavior applies when a policy/manual changes without any code change. Unsupported domains, insufficient retrieval or ambiguous language yield UNKNOWN, not a fabricated link.

### GEX evidence-calibrated graph analysis (R-ASE-19/40; proposed)

Across existing native histories and authorized graph views, support (a) **root-cause investigation** that separates temporal co-occurrence, dependency, plausible mechanism, tested falsification and verified cause; (b) **defect-risk prioritization** grounded in labeled historical outcomes with model/version, held-out precision/recall/calibration, prevalence/drift and uncertainty, with a valid rules-only/no-prediction baseline; (c) reproducible **node/edge/branch/transition/selected-path coverage** with a model-revision and actor/data/build/environment-scoped denominator, exclusions, feasibility, status tiers and explicit unknown; (d) **flakiness investigation** using comparable attempts, build/environment/fixture/time differences, independently observed outcomes and alternate setup/product defects, without equating any intermittent failure with flaky test code; and (e) **bounded path exploration** with explicit budget, loop/state/data equivalence, safety-critical and policy-mandated obligations protected, reasons for selection/omission and a truthful incomplete result.

**Acceptance:** High structural coverage with a missing approved business obligation remains a gap; a graph-selected path never becomes an executed or Passed result without genuine evidence; a single failed test does not establish a root cause or flakiness; a risk model with unverified labels/low sample size must abstain; a bounded traversal cannot silently discard a required forbidden-transition check. AI may generate evidence-linked hypotheses and experiment proposals but never authority, official defects or test verdicts by inference alone.

### GEX semantic discovery refinement (R-ASE-07/08/09/19/40; proposed, mapped in canonical 1.4.38)

**Competing applicable obligations (DISC-01):** When several separately approved rules appear applicable to one actor/action, reconcile documented authority, scope, jurisdiction, exceptions and effective periods independently. A genuine overlap with incompatible effects remains `unresolved_conflict` with both exact sources and an accountable authorized decision owner until a valid precedence or exception decision is supplied. Do not infer that the newest, externally sourced, most specific-looking, or AI-preferred text automatically wins. Do not mistake two concurrent revisions of one identity for two independent valid policy authorities.

**Condition-qualified consequences (DISC-02):** An impact proposal must distinguish a link/path from the mechanism that would make an actual behavior change. State the necessary preconditions, affected actor/state, consequence, applicable evidence, plausible alternative/no-effect interpretation and discriminating observation. A correct edge with an unsatisfied guard is not a confirmed effect; an explanatory hypothesis does not establish runtime causality.

**Time-aligned meaning (DISC-03):** Compare Policy, Manual, Requirement, Model, source and tested deployment against a declared *as-of* time, actor and target build; separate effective date from document publication, recorded observation and actual deployment. Historical accuracy, currently applicable, future pending, stale, conflicting and unknown-deployment meanings cannot be silently collapsed. Missing temporal identity must result in incomplete/unknown, not retrospective relabeling.

**Unlinked discovery (DISC-04):** Authorized, scoped reasoning may propose a potentially material semantic relationship between previously unlinked sources using content spans, actor/context/conditions and independent negative comparisons. Similar wording alone is insufficient. The hypothesis remains an unapproved edge candidate; it cannot establish accepted requirement, confirmed impact, coverage or authority until native owner review. Record false positives and deliberately unrelated lookalikes.

**Correction propagation (DISC-05):** When a reviewer contests a derived meaning or impact, preserve the exact original claim, source/Skill versions, correction, reason and reviewer attribution. Recompute or invalidate all known dependent *derived candidates* and explain unresolved consumers; protect accepted authoritative records, historical runs and unrelated graph facts. Neither rejecting a hypothesis nor replacing a Skill version silently edits prior decisions.

**Acceptance:** An independent reviewer can distinguish two valid authorities with conflicting scope, a linked but causally unaffected consumer, historically accurate but not currently effective instructions, a meaningful unlinked obligation versus a lexical decoy, and a rejected inference whose downstream candidates must become stale. Each outcome shows evidence/unknowns and the authorized next owner. A deterministic/no-change outcome is valid. These are proposed additions to existing owners, not a new graph service or a claim of implemented functionality.

## R-ASE-20 — Observable work completion

The derived change view shall contain an independently reviewable closeout summary, with proposal settlement separate from QA impact closure and release decision: implementation status, applicable artifacts proposed/approved/published, actual tests run and results, untouched/unproven areas, blockers, approvals, and exact record/PR links. It must preserve unfinished work when the session ends or is handed off.

**Acceptance:** Another agent can resume from persisted Tesbo records, not ephemeral chat history, and does not treat proposals as final records.


## R-ASE-21 — One Skills Library, independent version streams
Tesbo shall provide Skills Library views inside the existing **D-14 QA Standards & Playbooks / T-422** owner, extending FR-076/077 and FR-106–113 for independent asset versions, workspace pins and project context. There is one effective-method resolver. Project content reuses KB identity with an explicit immutable governed submission/acceptance boundary; platform packs are not copied into fake project KB records. This provides each governed skill with one stable skill ID, immutable candidate and published snapshots, explicit version/predecessor, content digest, creator/provenance, applicability metadata, supporting files, dependencies and version-specific evaluation. Agents can read authorized versions and **create new candidate skill identities or successor versions through MCP**, never modify an existing skill-version payload, published history or approve candidate status.

**Acceptance:** Agent creates candidate S1 and reads it back. An attempt to edit that candidate in place, edit published v1, or publish a candidate with the agent credential is refused. Creating proposed v2 leaves v1 active and unmodified.

## R-ASE-22 — Human-governed effective module assignments
Skill assignment is a first-class record **separate from skill identity/version**, with workspace/project scope, module/subtype/audience/context, pinned approved version, active/inactive, precedence/composition, effective interval, actor and review receipt. An approved but unassigned version is inert. An inactive assignment does not remove or invalidate the skill record. No automatic "latest" or agent-supplied override.

**Acceptance:** An agent proposing v3 does not affect active v2; human can approve v3 without activating it; only authorized interactive human action can change the binding or activation state, with exact audit history.

## R-ASE-23 — Machine credential non-escalation
No MCP tool or agent-callable REST path may update an effective skill assignment, activation, precedence, approval, trust root, or existing skill-version payload. This is true **even if the machine token was created by a project owner/administrator**. Interactive human governance requires independent trusted authorization/assent beyond token ownership; caller-supplied "human approved" assertions are untrusted.

**Acceptance:** An admin-owned MCP token cannot approve, assign or activate through either MCP or REST/GraphQL variants; all attempts leave state unchanged and produce auditable denials.

## R-ASE-24 — Governed meta-skill and nonrecursive bootstrap
A protected, human-approved Skills-authoring meta-skill shall govern new skill candidates. It requires purpose/scope, principle vs app-context separation, evidence, activation triggers, exceptions, false-positive cases, evaluation, authority boundary and counterexamples. Its approved root and its promotion mechanism cannot be overwritten, bypassed or self-promoted by an agent or candidate; detect invalid/self-referential dependencies.

**Acceptance:** Agent proposes a weaker meta-skill but cannot use its candidate to govern itself or authorize subsequent proposals; a required reference cycle yields an explicit error.

## R-ASE-25 — Exact resolved effective skill set before every applicable write
For each governed authoring task/context Tesbo shall resolve active assignments deterministically based on authenticated project/workspace, module, subtype, audience, operation, phase, actor and applicable capability constraints. Return assigned version IDs, digests, basis and conflicts to the agent; pin them to candidate artifact and Change Packet. Unassigned/ambiguous/expired/revoked/incompatible resolution must be visible and handled by explicit project policy, never arbitrary fallback to a library draft or "latest".

**Acceptance:** Distinct internal-operator vs external-user manuals resolve their configured active skills; candidate/inactive skills are absent from effective instructions; unresolved conflicts block the governed authoring action. Authorized raw observations, failure reports and byte intake retain independent permission/provenance rules and are not blocked solely by an unavailable or revoked authoring skill.

**Team-authoring acceptance (proposed).** Each authoring agent receives the complete approved instructions applicable to its project, operation and artifact before starting governed work. The native writer verifies delivery, current authority and conformance. On identical frozen inputs, two separately authorized contributors get equivalent canonical case content and the same rule decisions. The project can require exact wording for specified fields. Each contributor remains separately attributable. See the [governed workflow, comparison fields and two-client fixtures](skills-governance.md#mandatory-skill-delivery-and-cross-member-authoring-conformance).

## R-ASE-26 — Skill composition with an enforceable precedence contract
Multiple assigned skills may compose only under a human-approved explicit rule (portable core, project adapter, specialized contract). Validate dependency DAG, incompatibilities, version constraints, root protections, context overlap and an approved precedence order. A project adapter may specialize but not weaken mandatory provenance, approval or authorization constraints. Semantic conflicts that cannot be mechanically resolved remain **BLOCKED for review**.

**Acceptance:** Two overlapping contradictory required skills do not produce an arbitrary winner; incompatible adapter/root versions cannot publish.

## R-ASE-27 — In-flight assignment drift, revocation and cache safety
A candidate records the resolved assignment set and content hashes at its authoring base; submission/approval/publication revalidates current effective assignments. On drift, revocation, permission change or stale offline MCP catalog, Tesbo preserves the candidate but blocks/requests reconciliation (unless a separately authorized exception permits it). Caches include project/actor/context/assignment version and invalidate on assignment/promotion/revocation.

**Acceptance:** Human switches Requirements skill v1→v2 while the agent edits a requirement under v1; agent does not publish silently, historical proposal remains attributable to v1, current resolution returns v2.

## R-ASE-28 — Classified internal/external manual semantics
Manual subtype, audience, distribution and confidentiality are independent axes. Support internal staff/admin/support/developer/operations and external end-user/partner/public guidance without presuming that "internal" implies one skill or that a publicly viewable document has public draft/history/evidence. Manual proposals use the proper active skill plus existing KB ACL and review rules.

**Acceptance:** Publishing external customer instructions does not expose restricted internal troubleshooting notes, even when both refer to the same feature.

## R-ASE-29 — Classified internal/external policy semantics
Policy audience/exposure, authority source (organizational decision, contractual, law/regulator, external provider), enforcement locus and effective jurisdiction/date are independent. Policies affecting how the application behaves, policies governing staff/agents, and obligations communicated externally may use distinct governing skills and review authorities. External sources are attributed; agent may not invent acceptance by a regulator or governance board.

**Acceptance:** An external-facing data policy can have an internal policy decision, private enforcement evidence and linked external legal source while preserving permission boundaries.

## R-ASE-30 — Every authored artifact pins its governing skill provenance
Each **authored or transformed** requirement, case, manual, policy, task, file/evidence description and skill candidate revision shall pin the **specific** effective skill revisions and assignment IDs that governed its creation, with digest and resolution outcome. Review and history display this provenance separately from substantive product authority. Skills are authoring guidance, not a substitute for approved source requirements or evidence of correct implementation. Raw external evidence/source observations use truthful `skillUsage=not_applicable` with a reason where no Tesbo-governed authoring occurred; preserve their actual source, submitter, hash and custody. Unknown historical skill use remains unknown.

**Acceptance:** Revising a skill cannot relabel a historical case/run as having used the new version; imported legacy records without known skill provenance remain UNKNOWN, never backfilled by guess.

## R-ASE-31 — No skill-text authority escalation or prompt-injection bridge
Agent-visible skill text is authoritative only if server-verified approved and assigned for that task; imported skill proposals, referenced KB content, examples and attachments remain untrusted inputs. Reject attempts to embed tool-call authority changes, secret extraction, silent rule overrides or cross-project access in candidate documents. Preview must not execute embedded content. Readability is separate from authority: authorized candidates may be inspected as untrusted data, but all context assembly, RAG, recent/folder reads, direct/history reads, exports and caches must preserve server-owned authority and visibility metadata. Neither a subtype label nor a new resolver protects bypassing retrieval consumers. Semantic maliciousness cannot be completely proved absent by lint or model review; actual tool permissions remain enforced independently.

**Acceptance:** Malicious candidate content remains inert and is never returned by `resolve_effective_skills` as a governing instruction, including when a second agent names its candidate ID.

## R-ASE-32 — Skill evaluation and promotion evidence
Every proposed skill change shall preserve structural lint results, discriminating fixtures, counterexamples, positive/negative/valid-N/A examples, authoring source and any held-out comparative evidence against prior effective version. Distinguish validator pass from empirical improvement and untested hypotheses. Promotion thresholds are set by separately governed policy, not by the candidate text or authoring agent.

**Acceptance:** A candidate that validates formatting but misses held-out requirements cannot claim proven quality or auto-approve.

**GEX Skills-governed graph intelligence (R-ASE-32; proposed):** Learning from use shall generate **versioned graph-analysis/test-design method candidates**, with source/rationale, exact skill source package and dependencies, applicable module/subtype/mode, testing persona, expected bounded tool operations and evaluation data. Use existing `resolve_effective_skills` contract and server-owned assignment/approval: separate skill *read*, candidate *author*, independent *evaluate*, human *approve*, human *activate* and eventual *rollback/revocation*. A method skill can change reasoning strategies, prompt guidance and output expectations using already permitted tools; it cannot define new protected graph edge types, grant code/DB access, run scripts, approve models/tests, falsify source/runs, bypass node validation, or alter the existing API/CI admission gates. No active Skill is claimed merely because an SKILL.md file is found.

**Acceptance:** Two eligible manual/test-design skill versions operate over the same frozen graph snapshot and yield different candidate coverage proposals with their skill digests recorded; the native graph and cases are unchanged until a human applies an accepted proposal. An agent-authored stronger-looking skill cannot install/assign itself, bypass direct REST/MCP rules or label its own benchmark a pass. A configuration change that needs a missing graph query or parser capability is explicitly blocked as a code feature, not silently injected through a skill.

## R-ASE-33 — UI library versus governance permissions
Tesbo shall expose searchable skills, draft/version diffs, usage, reference attachments, evaluations and approval status for authorized users; only a separately permissioned **Skill Assignments** governance surface may activate/deactivate, pin versions, set composition or retire bindings. The library offers agent-accessible read/candidate workflows and honest inactive/unassigned/conflicted states.

**Acceptance:** Direct URL/API access to the human assignment page cannot be repurposed with machine credentials; keyboard/touch users can inspect and manage permitted assignments without hover-only controls.

## R-ASE-34 — Universal writer compatibility and migration
Enumerate every existing writer—both MCP aliases, REST/entity routes, native UI, Zyra, bulk/import/clone/restore, automations, SDKs, background tasks and integrations—and every material reader/projection/cache. Converge protected mutations at the native owner, preserve actual machine versus interactive human identity, and prevent bypass of publication, exact-version approval and applicable skill guards. Case status writes, dependent custom fields/tags/links, Bug association side effects and run admission are explicitly included. P-18 project opt-in and named-client grants apply before MCP discovery and calls; current membership/read-write checks alone are insufficient. Migration cannot fabricate previous skill use or change already-approved case/requirement states. Stage rollout against compatible client capability versions, with explicit controlled exception/legacy handling.

**Acceptance:** An old token calling legacy `create_testcase` cannot silently evade a required skill/approval gate; imported historical cases show `governingSkill: unknown` if provenance is unavailable.

## R-ASE-35 — Skill governance linked to change impact
A new approved/assigned skill version shall signal candidate review of affected current artifacts and authoring workflows using the existing graph/change-review owner. No automatic mass rewriting, regeneration or retrospective invalidation of executed runs; current scope and historic usage remain distinct.

**Acceptance:** Requirement skill upgrade identifies applicable new writing tasks and review candidates, while pre-upgrade test executions retain their exact original evidence and verdict.

## R-ASE-36 — Skill lifecycle and scale
The proposal shall define bounded version/assignment scans, indexed contextual resolution, retry/timeout behavior, max payload/dependency depth, archive/revocation effects and measurable cache/latency budgets before code ships. When skill resolution fails or is unavailable, workflows remain safely resumable with explicit blocked/unassigned receipts rather than unverifiable publication.

**Acceptance:** A revoked skill or unavailable resolver cannot be bypassed by requesting an old cached version; failure handling preserves draft work and produces bounded diagnostics.


## R-ASE-37 — Change capture from complementary coding agents and source providers
Tesbo shall support multiple **optional** authenticated change observers, including coding-agent hooks where available (for example Kiro agent/file/task hooks), repository push/PR/merge provider events, CI status callbacks and verified deploy facts. One project may bind multiple repos/branches with stable binding IDs, immutable configuration revisions and source lineage; release candidates reference sets of those exact revisions. Rebinding must not relabel delayed events or history. The current single project-keyed source binding requires a migration; a first slice may advertise single-source capability, but must explicitly refuse/mark incomplete multi-source claims until supported. Ingested events shall be idempotent, source-attributed, ordered where source supports ordering, and durable. A missing hook, unsupported client or failed provider event must not imply the application was unchanged; mark source freshness `UNKNOWN` or `STALE` relative to the latest verified provider revision. The hook is neither the security boundary nor the only way Tesbo learns of changes.

**Acceptance:** A commit pushed without any agent hook produces a visible unmatched change or missing-observation gap through the configured provider reconciliation; duplicate/out-of-order PR callbacks do not duplicate Change Packets; a deleted source binding cannot silently capture another project.

**GEX-01 extension (proposed):** Authorized optional *local* watchers can report provisional add/edit/delete/rename events, but must not submit trusted server checkout paths, immutable Git attestations, accepted behavior or approvals. Provider source revision reconciliation remains independently available without a running agent. Recovery handles missed notifications, atomic-write replacements, offline intervals, restarts, force-pushes, renamed/deleted files, selection/ref changes, duplicate/out-of-order events and scope/authorization drift. Source snapshots remain pinned to verified Git objects; event coalescing must not erase distinct material revisions, and a partial/inaccessible scan cannot become a complete no-change certificate.

## R-ASE-38 — Verified agent activity and understandable progress
Tesbo shall provide one attributable human-readable activity timeline for an application change, using existing Zyra agent sessions/tasks, graph observations, native logs and authorized external agent event adapters. Each event explicitly distinguishes `tesbo_observed`, `provider_attested`, `agent_reported`, `derived_inference` and `unobserved`; record source, authenticated actor vs delegated agent, time, context/revision, status, retained evidence and privacy scope. Do not claim visibility into local/remote tool actions Tesbo never observed, reconstruct hidden agent reasoning or expose private context to unauthorized reviewers. Support liveness, interruption and unknown status without treating silence as success.

**Acceptance:** A BA can tell what request changed behavior, QA can locate actual test evidence, PM can identify the owner of a blocker, and security can inspect authorized tool events. A self-reported "tests passed" without a runner receipt remains unverified.

**Multi-member attribution acceptance (proposed).** A permitted reviewer can reconstruct who proposed each field or operation, who revised it, which verified human decided it, what native version changed, and who later retried an external effect. Distinguish delegated person, client, credential, technical writer and reviewer. Preserve the role and authority at the time and evaluate current rights before the next action. An ambiguous historical operator remains unknown. Verify two people sharing an application and one person using two applications through native history and scoped export. See [team attribution and handoff](mcp-team-attribution.md).

## R-ASE-39 — Task-oriented MCP context and composite operations
Tesbo shall extend the **existing** MCP registry with capability-discoverable, bounded project/context bootstrap and composite agent workflows over canonical native services, including a proposed change+requirements/case draft and a verified run-result/defect triage flow. These are **orchestration adapters**, not new independent writers or permission bypasses. Each underlying action shall be authorized and revision-checked, with a stable overall idempotency key and per-item deduplication, explicit committed/failed/not-attempted/uncertain outcome and resumable receipts. Partial staging is not partial official publication: the existing P-07 selected native apply remains atomic and dependency-closed. Receipt lookup and explicit resume are separate operations as defined by the canonical API contract. External effects use a durable handoff/outbox, with uncertain outcomes reconciled before retry.

**Acceptance:** One tool call cannot create a published case that an equivalent direct REST action would deny; failure after the requirement draft but before case linking reports exact partial persistence; replay with the same request key does not duplicate records; a changed payload with a reused key conflicts.

## R-ASE-40 — Independent cross-artifact consistency and contradiction checks
Before recommending publication or release, Tesbo shall be able to check typed relationships and discrepancies among *approved* requirements/policies, submitted proposals, source declarations/code observations, manual versions, test cases/models, tasks and run/evidence status. The analyzer is **read-only until an authorized proposal is explicitly created**; it must classify `confirmed_conflict`, `unresolved_conflict`, `missing_link`, `stale_reference`, `unknown_source`, `not_applicable` and `no_detected_issue` without pretending the last means complete correctness. A requirement inferred solely from code is an observation or candidate, not an approved independent oracle. Correct source owners, not the consistency analyzer, own amendments.

**Acceptance:** A coding agent implements a permission behavior forbidden by an approved policy; Tesbo flags the contradiction rather than generating a matching "requirement" and passing its own check. A missing requirement does not automatically prove one should exist or that the code is invalid.

**GEX-03/04/07 extension (proposed):** Consistency checks compare three distinct, revision-aware axes: observed source structure, independently accepted expected behavior and witnessed execution/evidence. A correct Git blob is not a semantically correct implementation; an agent-suggested transition is not an approved oracle; a graph-to-case link is not execution coverage. Proposed guarded models, bounded variable/data effects and composed journeys must undergo accepted-oracle review and capability validation before use in verification. Preserve disagreement, incomplete source, missing links and changed/stale basis as explicit review items.

**GEX graph learning and human correction (R-ASE-40; proposed):** Learn by recording and evaluating **versioned candidate** graph relationships, behavior questions, test ideas and risk/quality predictions from attributable inputs: QA case edits/rejections with rationale; native human/agent attempts and actual observations; confirmed direct/side defects, resolutions and escaped bugs; requirement/policy changes; runtime/implementation observations when permitted; flaky/setup classifications; and falsified recommendations. Keep distinct classes for observation, inferred hypothesis, accepted requirement/model, published case and executed result. A learned hypothesis may be proposed for human case/model/policy/Skill review but cannot ratify itself, override approved policy, change skill assignments, alter historical results or infer a clean bill of health from passing/unknown evidence. Link every learning use to tenant/source/version/actor/feedback-quality/consent and store model/policy revision, rationale and conflict state. Support explicit accept/reject/correct/ignore reasons, cold start, disagreement and opt-out, drift detection and rollback of learned suggestions.

**Acceptance:** A human rejects ten redundant vague generated tests and approves one strong forbidden-path case; subsequent learning treats decisions as attributed training *candidates*, not proof of a superior model. A human manually discovers a side issue: original execution is unchanged, separate candidate case/issue and root-cause signal are linked after review. A test failure reclassified as environment/flaky is not learned as a confirmed product defect. An observed code behavior contradicting approved requirements remains a conflict, not a new norm. Learned ranker missing held-out confirmed bugs is refused promotion.

## R-ASE-41 — One role-sensitive Change Workspace
The existing Tesbo project/Zyra/graph shall expose a single navigable, role-authorized view of the change, with common immutable record identities and revision links. Developer, solo creator, QA, BA/product, PM, policy/security, support/operations and authorized executive views use the same underlying records, customized to their decisions—not different record stores. Show observed agent activity versus self-report, dependencies, requirements/policy impact, test and documentation draft/review state, task owners, release blockers and next actionable review steps. A user must be able to drill into evidence and return to context without a raw log or a separate agent product.

**Acceptance:** Three role views on the same Change Packet show consistent revision IDs, differentiated visibility and no cross-role confidentiality leaks. A low-knowledge reviewer can answer what changed, why, who is accountable and what remains unproven.

**GEX-04/08 extension (proposed):** Present change→affected dependency→potentially affected requirement/model element→existing native case or unknown gap→subsequent original execution/evidence as one authorized, navigable explanation. Show observed/inferred/accepted status, direct/transitive provenance, limitations and next allowed reviewer action. Never fabricate additional native records to complete the diagram, leak another project, or mistake a proposed path for a runnable case.

**GEX intelligible graph analysis (R-ASE-41; proposed):** The AI graph view shall expose a **reasoned, inspectable relationship chain** for a change/test objective: user type/actor → applicable requirement and accepted criterion → relevant state/transition/guard or business rule → upstream inputs and dependencies → downstream effects and consumer obligations → existing test conditions/Cases/previous attempts → missing/weak/contradictory/unknown coverage. The AI may expand graph context selectively by authorized query/revision and bounded traversal, distinguish explicit accepted link from observed edge vs inferred hypothesis, point to direct source text/record IDs, and make it easy for a human to correct or reject a misinterpretation. Graph retrieval or semantic embeddings are candidate relevance aids, **not proof a relationship exists**. If context is unavailable, truncated, conflicting, inaccessible or missing, report the gap—not a fluent fabricated conclusion.

## R-ASE-42 — Evidence-aware release readiness and human decision
Tesbo shall provide a **computed, explainable release-readiness projection** bound to a specific source/PR/commit, build/deployment candidate, approval and evidence scope. Its `readiness` is `not_assessed|insufficient_evidence|blocked|ready_for_authorized_decision`, with reason codes and freshness. Human decision, deployment observation and post-deployment verification are separate axes. `released_with_known_risks` is a derived presentation of an observed deployment plus its exact authorized risk decision, never the only release state or a pre-deployment readiness value. Assessment phase is explicit: pre-deployment evidence concerns the tested candidate build; post-deployment acceptance requires the observed deployed build and smoke/monitoring evidence. Do not require future production evidence to approve an initial deployment, or infer it from that approval. Evidence inputs shall include approved expectation versions, coverage scope, case/run approval, executed selections and results, observed target-build identity, blocking defects, policy conflicts, unresolved changes, rollout/rollback plan and responsible release owner. A green CI check or count of linked cases cannot by itself make an application "safe" or verified. Original human controlled publication (P-07) stays in force pending any separately ratified amendment.

**Acceptance:** With no relevant tested-build proof or required negative-path execution, readiness is insufficient/blocked even when unit tests are green. A pre-deployment decision cannot claim production verification, and missing after-deploy evidence prevents post-deployment acceptance. An authorized release decision pins current evidence and risk owner; changing a critical policy afterward visibly stales that decision.

## R-ASE-43 — Post-deployment verification and incident continuation
An application change remains traceable through deployment, post-deploy smoke/health checks, operational monitoring, rollback or fix-forward, and any subsequently reported production defect. Tesbo shall distinguish source change, PR merge, deployment attempt, successfully deployed build, test observations, incident and recovered state. An unavailable provider or missing telemetry yields `UNVERIFIED` rather than a synthetic successful release.

**Acceptance:** An agent's feature passed CI, deployed, then failed smoke: Tesbo links the precise build, regression, affected case/requirement/manual, incident owner, remediation and later retest. Pre-deploy success is preserved historically but does not imply post-deploy acceptance.

## R-ASE-44 — Delivery throughput, instability and human comprehension measures
Tesbo shall calculate or ingest **source-grounded** delivery measures with exposed source, denominator, scope, timestamp, missing data and confidence: change lead time, deployment frequency, failed deployment recovery time, change fail rate and deployment rework rate (DORA's five delivery measures). It shall additionally measure developer/BA/QA/PM time-to-understand a change, review burden, artifact freshness, unsupported agent claims, duplicate records and escaped defects when observable. No performance benefit may be claimed from created-document/testcase counts or by selectively excluding failed work; these measures are **descriptive**, not proof Tesbo caused improvement.

**Acceptance:** A failed deployment is counted in stability and recovery metrics, not excluded to flatter lead time. A sample project with no deployment integration shows `NO_DATA` and source limitations rather than invented zero failures.

## R-ASE-45 — Source and event semantics under failures
For relevant sources and agents, define receipt identities, source/event version, capability flags, clock skew, out-of-order status, event loss and retry/cancellation. Tesbo shall use native graph history and notification writers to deliver change candidates and review tasks with idempotency, dead-letter/recovery and observable queue age. Do not require an always-running local coding agent; provider reconciliation and manual resync must be possible where permitted.

**Acceptance:** A code change observed by provider after the agent process exited still appears in impact review; reconnecting two clients with the same event does not duplicate a requirement; dropped notifications remain visible as pending/failed delivery.

**GEX operational scope (proposed):** Watched sources, parser inventory, dependency traversal, model exploration, scenario generation, tenant fanout and data/evidence checks shall have measurable configurable work/size/depth/latency budgets, cancellation, backpressure and honest partial receipts. No `complete` status after timeout/budget exhaustion. Set baseline recall/false-negative and false-positive measures against independently authored/held-out target changes before claiming faster regression selection or a quantified improvement; avoid extrapolating published third-party benchmarks.

**GEX quality measurement (R-ASE-44; proposed):** Measure justified unique behavioral/test-design gaps identified and human accepted; manual/agent/CI case usability and oracle quality; semantic overlap/duplication; confirmed defect-discovery strength and escaped regressions under stated denominators; false-positive and missed-risk recommendations; stale requirements/cases; flakiness/setup confounders; author/review/execution/maintenance effort; and manual-versus-automated execution evidence and obligations separately. Never optimize merely for number of cases, smaller suites, artificial failure frequency or claimed 100% graph coverage. Actual quality requires independent held-out adjudication and authentic QA/evidence where available.

## R-ASE-46 — Privacy and least-privilege agent trace visibility
Tesbo shall distinguish operational trace metadata from optional sensitive prompt/tool payloads. Session logs, evidence, skill text, source snippets and externally linked files obey project/role/retention/redaction/access rules. Access to a high-level release summary does not grant access to private agent prompts, documents, secrets or protected QA evidence; collection and retention of detailed agent traces shall be configurable and bounded.

**Acceptance:** A PM can see a failed agent task and its owner without viewing redacted secrets or a restricted policy draft; cross-project reads and raw tool-event export are denied and audited.

## R-ASE-47 — Comparative acceptance, not copy-by-feature
Delivery of the first integrated Tesbo Change Workspace shall be validated against a real coding-agent workflow using an existing application and a direct QA management baseline (Qase/TestRail where available). Reuse complementary Kiro/Spec Kit/GitLab patterns only where actual compatibility and maintenance/security tradeoffs support adoption. Record measured effectiveness: successful user jobs, erroneous agent claims, human correction effort, time to understand/review/release, test completeness, incomplete-sync recovery, CI/deploy outcomes and costs. A source review or a prototype does not establish production improvement.

**Acceptance:** Two distinct authorized coding-agent clients can produce equivalent change receipts, and at least one BA/QA/PM review flow can be completed without manual record reconstruction. Any benchmark limitation is explicit.

**GEX evidence-based learning evaluation (R-ASE-47; proposed):** Before promoting advanced graph learning, use a shadow-mode comparison against baseline human QA authoring, deterministic graph suggestions and any candidate learned-ranking/model-inference approach; where applicable compare conventional, graph and full-suite regression tests. Test across meaningful code-free/manual and automated projects, with genuinely confirmed historical faults, separately classified mutants, independent human review of case novelty/clarity/oracle strength, time/project-split held-out data, false negatives, resources and maintenance. Distinguish published experimental results from reproduced Tesbo outcomes; a trained model cannot assess itself on examples it generated.

**GEX skill-guided experimentation and trial-and-error (R-ASE-47; proposed):** The long-term quality engine shall compare **current accepted method versus candidate method** on fixed or time-split **held-out** requirement sets, real/manual QA cases, known defects, role-state interactions, upstream/downstream misses, invalid/forbidden paths, alternate valid behaviors and unknown cases. Record inputs, exact skill/prompt/model/runtime/graph snapshot, test-case candidate outputs, human adjudication and confirmed defects, with privacy boundaries and the rate of missed high-risk obligations. Randomize or counterbalance evaluation where feasible and retain a stable champion baseline and rollback. Treat rejection reasons as attributed feedback; do not assume every human correction is universal or that a repeated generated answer is ground truth. Promotion remains independent human-controlled T-422 governance, not automatic trial-success. No changing skill may weaken mandatory coverage, approvals, case identity or evidence rules even if its quality metric improves.

## R-ASE-48 — No forced ceremony, no governance bypass
Agents may begin with spontaneous feature development, a defect fix, a requirement, an investigation or a policy change. Tesbo shall not require a formal model or approved requirement to be authored *before* any code edit, but must apply required authority checks before official publication/release, identify missing policy/requirement context, and preserve the approved test-case and skill-governance boundaries. Every change domain may legitimately be unchanged or N/A with evidence, and the user-facing workflow shall surface the smallest safe next action rather than forcing all modules to generate records.

**Acceptance:** A cosmetic patch does not create fake policy and manual updates. A security-sensitive change cannot obtain a green readiness badge merely because its case author used an approved skill.

**GEX no-code entry (R-ASE-48; proposed):** A project can begin with only business requirements, manual QA feedback, a user journey, UX evidence or a reported defect. Code-first and model-first are both optional modes. Missing repository/CI means code-dependent graph checks are unavailable/UNKNOWN, not that test design, case approval, manual execution or graph learning from permitted QA observations is blocked.

## First integrated scenario matrix — mandatory implementation proof (proposed, NOT RUN)
| ID | Starting point | What must be independently observed |
| --- | --- | --- |
| ASE-FLOW-01 | Spontaneous Kiro/OpenCode feature implementation | Source/agent/project binding, versioned Change Packet, native requirement candidate and linked case draft using active skills |
| ASE-FLOW-02 | Coding agent stopped before calling Tesbo | Provider/CI source observer detects unknown/unreconciled change; no false current state |
| ASE-FLOW-03 | Two concurrent delegated agents | Same change identity, distinct actor and permission receipts, no duplicate official record |
| ASE-FLOW-04 | Agent reports successful tests without runner receipt | Report remains agent-reported, QA result unverified |
| ASE-FLOW-05 | Approved policy contradicts changed implementation | Independent discrepancy, approved requirement remains authoritative, no self-generated oracle |
| ASE-FLOW-06 | Composite MCP write fails after first item | Exact partial receipt, idempotent resume, same native authorization |
| ASE-FLOW-07 | BA, QA and PM inspect one change | Cross-role status consistency and confidential-source filtering |
| ASE-FLOW-08 | Test case linked to requirement but never executed | Current release not reported verified; coverage reasons readable |
| ASE-FLOW-09 | Skill assignment revoked mid-change | Candidate preserved, no unapproved promotion, stale/version conflict surfaced |
| ASE-FLOW-10 | PR merged without deployment | Production status UNKNOWN/NOT DEPLOYED, no fabricated release metrics |
| ASE-FLOW-11 | Failed deployment and rollback | Correct change fail/recovery/rework classification with referenced provider events |
| ASE-FLOW-12 | Native Copilot as an admin user | AI tool cannot perform human-only skill governance without exact independent human action |
| ASE-FLOW-13 | Low-risk solo coder and high-governance organization | Same product truth, different presentation and approval configuration, no security bypass |
| ASE-FLOW-14 | Support reports post-deploy regression | Accurate deployed build, incident, affected requirement/case/manual and retest lineage |
| ASE-FLOW-15 | Wrong project token or disabled MCP | No cross-project read, discovery, candidate submission or effective skill resolution |
| ASE-FLOW-16 | Lost hooks, out-of-order provider events, duplicate agent submission | Dedupe, freshness gaps, bounded retries and no false complete/approved records |

**Evidence gate:** these rows are planned acceptance definitions, not executed tests or formal assurance-team verdicts. Revision 1.4.28 held ASE-FLOW-01..16; the same eight-file 1.4.29 amendment includes the additional ASE-FLOW-17..54 alongside preserved FR/T/QA/AC and MBT namespaces. Definitions, canonical integration, independent review and runtime execution remain separate claims.

| ASE-FLOW-17 | No agent/watch process runs while an authorized source commit lands | Provider reconciliation finds the change or records source-gap/UNKNOWN; no fabricated unchanged state |
| ASE-FLOW-18 | Local file save/atomic rename before commit | Provisional watcher signal remains distinct from pinned Git capture; no client path accepted as server source authority |
| ASE-FLOW-19 | Delete/rename, source selection change or forced branch movement | Version/tombstone/discontinuity is visible; historical links preserved; no false no-impact |
| ASE-FLOW-20 | Unsupported AST or dynamic call prevents complete mapping | Partial/unknown parser scope and possibly affected tests remain visible, not an empty safe-to-skip claim |
| ASE-FLOW-21 | Change has direct, transitive, explicit native-case and unlinked consumers | Candidate paths and missing links have truthful, typed explanations; no invented case coverage |
| ASE-FLOW-22 | Implementation violates accepted model guard or policy | Expected revision stays independent; contradiction is referred for human decision |
| ASE-FLOW-23 | Bounded guarded/data/composed model with invalid and cyclic paths | Supported semantics generate reproducible proposals, unsupported semantics refuse, traversal budget cannot certify full coverage |
| ASE-FLOW-24 | Generated scenario overlaps an existing native case | Identify existing case and request review; avoid duplicate publication or undocumented semantic equivalence |
| ASE-FLOW-25 | Model approved but case stale/Draft or no executor is available | Native run admission respects approved/revision eligibility, no target-executed status without a runner |
| ASE-FLOW-26 | Case Passed on previous build, missing evidence bytes or new expected model | Historical result remains intact; new obligation stays stale/unverified |
| ASE-FLOW-27 | Missed provider events, repeated/delayed callbacks, cancelled long scan | Reconciliation has bounded recovery and one canonical history, no duplicate official writes |
| ASE-FLOW-28 | Unauthorized cross-project relation or multi-repository request on single-binding deployment | Cross-project denial; honest unsupported/partial multi-source status and preserved binding generations |

**GEX acceptance note:** ASE-FLOW-17..54 extend the **existing** planned suite, not a second native test-case repository. All outcomes are PROPOSED / NOT RUN; preserve ASE-FLOW-01..16, all historical QA/MBT IDs and P-14 canonical ownership. Independent assurance teams receive outcome, unchanged charter and grounded sources; these definitions are reviewed artifacts, not a prescribed findings list or substitute for their independently derived journeys.

| ASE-FLOW-29 | Approved requirement/user journey, no code, CI, formal model or browser agent | Graph proposes relevant human-executable native manual cases with setup, action/expected observations, actor/data and trace links; existing approval still governs |
| ASE-FLOW-30 | Human QA manually runs an approved case | Genuine attributable native Run/actual result, known/unknown build and policy-appropriate evidence; no invented machine-runner receipt |
| ASE-FLOW-31 | Many generated steps but vague/tautological Expected Result | Weak oracle exposed and improved by human; no false quality/verified-conformance status |
| ASE-FLOW-32 | New suggestion semantically duplicates an existing manual test | Existing case identified for link/refine; no automatic second ID or historical overwrites |
| ASE-FLOW-33 | 100% implementation line/model edge coverage while negative permission journey missing | Accepted expectation yields an uncovered/forbidden behavior candidate for manual test review; coverage does not suppress it |
| ASE-FLOW-34 | QA corrects a proposed expected result and rejects an unrelated case | Both reasons/history persist as scoped learning feedback; later proposal can improve, no automatic approved-case mutation |
| ASE-FLOW-35 | User discovers a side finding while performing another manual case | Original case attempt and status preserved; linked new case/Bug proposed separately under native review |
| ASE-FLOW-36 | Initially Failed manual/agent attempt later classified as setup error or flaky | Original observation remains, attributable correction history and training labels separate from confirmed product defect |
| ASE-FLOW-37 | Repeatedly observed implementation conflicts with accepted policy | Learning never auto-adopts behavior; explicit conflict remains reviewable |
| ASE-FLOW-38 | Ten proposed duplicates and one novel high-risk negative case | Quality/novelty review prioritizes meaningful gap, not numerical case generation or automatic deletion |
| ASE-FLOW-39 | Independent analyst receives only test objective and actual source context | Exploration not steered toward predetermined findings; published manual case still has reproducible detailed steps |
| ASE-FLOW-40 | New project has no historic outcomes | Cold start uses authorized sources and approved QA techniques; predicted defect confidence marked uncalibrated/UNKNOWN |
| ASE-FLOW-41 | Active inference would need unsafe production probing or exceed query budget | No unauthorized probe; bounded/partial learned model, unproven completeness exposed |
| ASE-FLOW-42 | Feedback from another project/tenant is sensitive or consent is revoked | No private examples or derived leakage across boundary; training provenance/retention access preserved |
| ASE-FLOW-43 | New ranker is superior on its own generated data, misses held-out confirmed fault | Independent evaluation fails, original method/required tests retained, false negative exposed |
| ASE-FLOW-44 | Learned graph or Skills guidance degrades after model/source changes | Exact historical version available, stale predictions flagged, human-controlled rollback/review |

**GEX learning research:** the [quality survey](https://doi.org/10.1007/s11219-024-09698-w), [behavioral-gap preprint](https://arxiv.org/abs/2606.10417), [ML testing review](https://doi.org/10.1002/stvr.1845) and [industrial automata-learning study](https://doi.org/10.1007/978-3-319-25423-4_5) are research leads. Verify primary-source content and setting before using statistics or claiming transferable effectiveness; no research result is a Tesbo acceptance pass.

| ASE-FLOW-45 | Graph analyst receives approved user journey and old manual cases, no source checkout | Explains user/role, upstream/downstream, states and missing test conditions with pinned sources, creates only reviewable native manual-case candidate |
| ASE-FLOW-46 | Graph sees current UI behavior that contradicts accepted policy | Preserves independent expected oracle, reports discrepancy, never writes expected result to match faulty behavior |
| ASE-FLOW-47 | Sparse graph and semantic similarity suggest a nonexistent dependency | Source/version/link UNKNOWN is visible; LLM cannot persist a trusted invented edge or silently imply test coverage |
| ASE-FLOW-48 | Two candidate skill versions run on identical frozen graph and human-rated cases | Different proposed cases traced to exact skill/model/graph versions; native content unchanged before human review; paired evaluation identifies actual gains and misses |
| ASE-FLOW-49 | Agent proposes its own next Skills version based on rejected QA cases | Inert candidate with provenance; no automatic approval, activation or existing-skill history mutation |
| ASE-FLOW-50 | Project manual-case guidance conflicts with broader graph-analysis instructions | Explicit composition/precedence conflict; no arbitrary order, inherited authorization or hidden override |
| ASE-FLOW-51 | AI graph analyst attempts unauthorized native case/model update through invented tool or prompt | Denied by capability and server auth; no writer-side effect; no false tool success report |
| ASE-FLOW-52 | Relevant upstream/downstream source is inaccessible or graph query truncated | Partial/unknown impact, bounded query/provenance receipt and human follow-up; no full coverage verdict |
| ASE-FLOW-53 | Candidate method scores highly on its own examples but misses an independently known critical forbidden transition | Held-out evaluation and authorized reviewer reject promotion; baseline retained with recorded false negative |
| ASE-FLOW-54 | Human manually corrects a proposed case, then governance activates improved method | Correction is traceable, new skill effective only on later authorized work, earlier case/run/skill digests preserved and rollback available |

**GEX knowledge and skill evidence:** Existing external source skill `manual-test-authoring` (longer 525-line edition) has mode A–H, RTM/PTM, role-state-crosstechnique quality/feedback rules; it is not claimed to be an installed, approved Tesbo Skill. Separate `product-testing` notes require source verification before adoption. Existing ASER GEX-01..08, FR-115–119, T-422/D-14, P-07/P-14/P-18 and all prior ASE-FLOW IDs remain authoritative owners; these ten proposed scenarios are NOT RUN.

## Skills governance executable acceptance scenarios (proposed, not run)
See [skills-governance.md](skills-governance.md) `SK-E2E-01..28` (v1.4.28 baseline) and the additional proposed `SK-E2E-29..40` (v1.4.29 amendment) for the authorization, lifecycle, audience, composition, concurrency, stale-binding and malicious-candidate test contract. Those scenarios are required in the disposable-project gate; source-spec text alone is not execution evidence.

## Scenario-based cross-domain acceptance suite

| Case | Input | Must prove |
| --- | --- | --- |
| ASE-E2E-01 | New feature, no prior requirement | native requirement draft, linked draft cases, manual candidate, work item; policy assessed; reviewer owns publication |
| ASE-E2E-02 | Fix existing regression | updates same requirement/case/bug identities, preserves history and actual run scope |
| ASE-E2E-03 | Policy-changing authorization fix | authority-backed policy proposal, linked rule/tests, blocked activation until authorized |
| ASE-E2E-04 | Cosmetic-only refactor | defensible `not_applicable` for manual/policy/requirements; no fake docs |
| ASE-E2E-05 | Two agents edit same record | optimistic conflict, no lost update, visible reconciliation |
| ASE-E2E-06 | Mid-batch write failure and replay | no duplicate artifacts, correct partial receipts and resumable state |
| ASE-E2E-07 | Wrong project token or role | denial, zero cross-project writes |
| ASE-E2E-08 | Agent calls missing/stale MCP tool | explicit blocked/degraded state; no claims of update |
| ASE-E2E-09 | Evidence metadata exists, bytes missing | separate evidence unavailable status; no false verification |
| ASE-E2E-10 | Source version differs from deployed app | local test truth remains separate from deployment truth |
| ASE-E2E-11 | KB synced external requirement | remains read-only, no native overwrite; correct external attribution |
| ASE-E2E-12 | Unapproved case added to run | prohibited by backend regardless of writer surface |
| ASE-E2E-13 | Policy proposal rejected | old policy head stays authoritative; rejection/history preserved |
| ASE-E2E-14 | One agent delegates four disciplines | same parent packet; separate contributors, permissions and review receipts |
| ASE-E2E-15 | Existing source record removed/renamed | stale/dangling relation detected; no silent remap |

**Exit criterion:** Actual authenticated disposable-project MCP lifecycle + native UI + backend/DB tests must pass against the same relevant commit. External agent catalog and target deployment identity require separate verification. Independent assurance teams review the **spec** without guided findings; their actual receipts and unresolved gates are recorded separately, and do not constitute runtime execution.

**ASER context-extension note:** The seventh domain is Skills Governance. The earlier six-domain `ASE-E2E` scenarios remain required but are not sufficient for governed authoring; `SK-E2E` extends them, and every published artifact must pin applicable skill provenance. Canonical revision 1.4.28 incorporates this scope in the original eight files; design reconciliation does not ratify undecided policy or authorize implementation, publication or deployment.

### Source-fit application of the retained requirements

The same R-ASE and MBT contracts govern reuse. Existing model/source/native case/run code requires the concrete convergence in the design and implementation plan before CURRENT selection, true-human approval, unpublished AI candidate handling, atomic provenance, mapping history, source entitlement or immutable learning can be claimed. Existing matching/lookup and Bug/result side effects must not become false learning labels. This clarifies implementation admission for retained requirements; it creates no new requirement, graph or approval owner.

### Method portability preserves the target contract

Reuse an imported method only within an explicit supported authoring/output profile. Separate reusable test-design reasoning from target actors, interfaces, artifact formats, classification vocabulary and lifecycle operations. A target without accounts, a browser, a repository, a formal model or an automated driver must not acquire fabricated prerequisites. Technique applicability follows the actual obligation and supported capability; a narrow specialist method may legitimately be not applicable.

The method must preserve an accepted current restriction, release window or user-visible notice when it is part of the applicable requirement. Incidental planning labels may be omitted; wording alone cannot supersede an accepted obligation. A reusable case's intended actor/data/channel scope is distinct from the subset actually observed. Representative execution supports only its evidenced scope or an explicitly justified equivalence claim, never an implicit all-context pass.

Native definition status, execution outcome, approval, active applicability and presentation layout remain independent. Imported workbook conventions cannot renumber canonical case identities, reset prior attempts, promote a Draft, overwrite relied-on revisions or bypass native selected review/apply. These are refinements of existing T-422, native case/history and accepted-oracle requirements, not new record owners.

### Reconciliation with published canonical revisions 1.4.30 and 1.4.31

## Revision 1.4.31 — graph contracts and assurance findings

Extend FR-115–119 and FR-124 through exact-revision typed relationships to governing policy obligations and user-manual sections. For each applicable obligation, show the approving authority, scope and effective interval. A manual explains intended operation and is linked as guidance. Conflicting requirements, policy, observed behavior and manuals remain visible and require an accountable disposition. A reviewed change may create linked review candidates for affected policies, guides or tests. Publication remains with the respective native owner.

Graph analysis may rank root-cause hypotheses, surface inconsistent execution cohorts and prioritize defect investigation. Root-cause confirmation requires independent distinguishing evidence and an authorized disposition. Risk scores and inconsistency flags are informational. They cannot change test verdicts, defect status or release approval.

**Historical reconciliation boundary:** canonical revision 1.4.32 preserves the published 1.4.30/31 obligations and the source-convergence and imported-method refinements above. Earlier subordinate draft wording does not supersede that current canonical contract. All architecture/authority, implementation, runtime, visual and method-efficacy gates retain their recorded scope.


### Retained published Graph Analytics proposal

Extend FR-115–119 and FR-124 with a ranked, permission-scoped Graph Analytics view. Explain the meaning of a relationship, its applicable obligation or guidance, the plausible consequence of a change, evidence strength, alternatives where material, and the next verification step. Initial views are Change impact and Coverage gaps. Later failure investigation and stability use the same reporting surface and existing analytics owners.

**Historical integration boundary:** the prepared 1.4.33 v7 candidate preserved the published 1.4.32 Graph Analytics proposal and reviewed portability corrections. Its exact receipts remain historical; the current canonical authority and later incoming amendments are stated below.


### Retained published Graph Analytics assurance amendments (1.4.33)

FR-115–119 and FR-121–124 apply. Each finding explains the affected outcome, exact obligation or evidence basis, relationship direction, plausible consequence, uncertainty and next check. An effective approved policy or requirement can establish an obligation without a model. Manual guidance, observed behavior and inferred dependencies retain their separate meaning. Where applicable, a finding links to the existing FR-119 impact and its current status. Viewing or drafting leaves acknowledgment and closure to that workflow.

**Historical canonical checkpoint:** revision 1.4.34 preserves the complete published 1.4.33 and the assessed portability correction. The historical 125 ASER and eight GEX-AC definition rows remain unchanged; five GA-AC acceptance rows supersede the four earlier summaries. At that checkpoint GEX-SEM and GEX-DISC were pending subordinate proposals; the revision 1.4.38 allocation below now maps their conditions to existing canonical obligations. Incoming Graph Analytics refinements and later DISC content do not inherit earlier cold, UI, runtime or empirical review. All remain subject to their declared gates; the package is NOT FROZEN.

### Canonical revision 1.4.38 existing-requirement clarification


This is a clarification of FR-115–119, R-ASE-06/14/19/21–32/34/37/40/45, P-07/P-11/P-18 and MBT-C-12, not a new requirement namespace. A source checkout's platform allowlist and a project's administration privilege do not alone establish source-to-project entitlement. Governed source capture requires the applicable source and destination grants or an evidenced deployment policy making that source shareable to the eligible projects; absence remains a blocked source-dependent operation.

Model applicability has a single native owner: saving and approving a successor do not change the separately activated current revision. Existing model and case identities, relied-on mappings and original attempts survive migration and rollback. Correcting or rejecting an authored candidate is useful work even when optional generation is unavailable; preserve that correction and the compared versions without requiring model-provider credit. Matching uncertainty must remain visible and cannot become a declaration that no similar case exists. All these requirements bind applicable entrances and consumers through the existing owners; they do not make a model, code repository, AI backend or automation mandatory for ordinary manual or case-free QA.


### Preserved canonical 1.4.31 contracts within revision 1.4.38

Extend FR-115–119 and FR-124 through exact-revision typed relationships to governing policy obligations and user-manual sections. For each applicable obligation, show the approving authority, scope and effective interval. A manual explains intended operation and is linked as guidance. Conflicting requirements, policy, observed behavior and manuals remain visible and require an accountable disposition. A reviewed change may create linked review candidates for affected policies, guides or tests. Publication remains with the respective native owner.

Graph analysis may rank root-cause hypotheses, surface inconsistent execution cohorts and prioritize defect investigation. Root-cause confirmation requires independent distinguishing evidence and an authorized disposition. Risk scores and inconsistency flags are informational. They cannot change test verdicts, defect status or release approval.


**Current canonical authority — revision 1.4.38:** The same eight canonical files preserve the saved v1.4.37 Graph Analytics/profile amendments and this continuation's source/review reconciliation. The count boundaries are 125 scoped ASER definitions, eight supplemental GEX-AC obligations and five unique GA-AC IDs with fifteen cumulative fixture rows; none is an execution total. SK-E2E-41..44, GEX-SEM-01..08 and GEX-DISC-01..05 are aliases/variations mapped to existing canonical owners, not extra definitions. Original and later informed receipts keep exact byte/source scopes. The package remains PROPOSED / NOT FROZEN.

### Current continuation checkpoint — revision 1.4.38

The current canonical parent is the saved eight-file v1.4.37 archive, version 17, SHA-256 `1ed8afd0a978ab9b257c10d61549f6085c7f1f593713a26b0ae56a4540562848`. Preserve all v1.4.35–37 Graph Analytics amendments, including the separate applicability/evidence/outcome/impact axes, bounded frontier witness, mixed governing obligations, permission-safe visible snapshots, native operation receipts and source-index convergence. The pilot is a synthetic DMIS approval-to-posting fixture; it establishes neither a universal application schema nor live DMIS testing.

PR168 and PR167 were merged externally as `f43013473b3a8b725bb547187e21b4459d0e8838` and `1fe100588be6c3a1627ee39a4b0bbc1c0d9da2ea`. This continuation performed neither merge. Its repository-view parent is open draft PR169 at `bddd97971637a54c6e2aff9e7686cfb9c9f25d8e`, based on that merged development commit. The later PR169 head `c07d4c2a16912ca71fbc319aec9a23e68a452edd` adds only a separate executable-preflight review record; all six view bytes remain bddd-identical. Preserve that record and its distinct candidate/executor limits; it is not another role receipt or a verdict on this continuation’s independently pinned reviews. Statements in preserved incoming review chapters about their own source6897 inspection retain that historical scope. This continuation independently inspected source419 and compared full trees through e3d0, b07 and merged1fe: no backend changes across those intervals; b07→1fe changes only ten documentation blobs and no frontend blobs. Thus the qualified source findings in §18.2.1 of canonical03 remain applicable at that merge checkpoint. This is source continuity, not deployment, runtime or acceptance certification. The separately observed b07 CI results retain their exact executed-test scope.

Retain 125 unique scoped ASER definitions, eight supplemental GEX-AC obligations and five unique GA-AC IDs. The five GA IDs carry fifteen cumulative table rows from revisions33/35/37; later fixtures extend the same checks, without adding ten test identities or erasing earlier assertions. Repeated GEX-SEM-01..08 allocations are cumulative fixture/proof-owner contributions to the same eight aliases. Apply the union of their stated assertions and existing owner allocations; they are not competing definitions or alternative authorities. SK-E2E-41..44 and GEX-DISC-01..05 likewise remain mapped aliases. All new product acceptance outcomes remain NOT RUN. Original cold receipts remain unchanged; later target-specific reconciliation is explicitly informed. The package is PROPOSED / NOT FROZEN.

### Preserved Graph Analytics boundary — revision 1.4.38

Canonical02/03/04/05/07 retain the v1.4.35–37 contracts. Keep applicability, evidence sufficiency, observed outcome and impact disposition independent. Matching FAIL is verified/unmet; admissible PASS plus FAIL is verified/mixed, regardless of arrival order. An authorized correction remains attributable and never silently overwrites the original report. Count reviewed equivalent obligations once while their decision applies; withdrawing equivalence recomputes current scope and preserves historical counts. Unresolved authority conflicts stay outside the known eligible denominator and keep scope incomplete.

An asserted no-impact result requires an independently grounded bounded frontier witness; missing or unexamined consumers remain limited/unknown. Initial entry is a native human project session. Read-only tokens receive no Graph Analytics metadata under AC-092; later credential access requires its own explicit grant. Authorized-visible content determines pagination/freshness identity: a hidden-only rebuild must not leak through cursor expiry or status. Recheck current grants at deferred AI and native attachment delivery. Exact native operation commitment and idempotent receipts govern handoffs, changed-payload conflicts and revocation; an unknown outcome needs safe readback before repetition. Recorded history and retrospective recomputation declare distinct cutoffs. Source binding, desired cursor/profile and rebuild epoch fence publication, with worker progress, budgets and an owner-approved operational envelope. Viewing/staging has no implicit Run side effect; an exact authorized native creation can legitimately prepare a Run before later dispatch. Retain partial later-stage receipts and atomic Run-plus-manifest semantics at their existing native owners.


### Proposed R-ASE-09/12/15/16/40 refinement — discover unasked decisions before governed implementation (not ratified)

**Scope and canonical ownership:** This is a proposed clarification of existing R-ASE-09 (decision/policy/rule separation), R-ASE-12 (delegation), R-ASE-15 (agent trigger), R-ASE-16 (completeness signal) and R-ASE-40 (independent contradiction checks), **not a new R-ASE identifier, approval system, status owner or ninth normative spec**. Promote only through the canonical eight-file package and its review process.

- An applicable specialist agent must **independently generate** candidate consequential decisions from a feature's actual actors, states, transitions, parent/child dependencies, access paths and human outcomes, even when its starting specification has no open question. Agents must not rely on Claude's question UI or team consensus as evidence that omissions have been found.
- A coordinating agent reconciles candidates against versioned prior decisions, requirements, policies, manuals, code and evidence; merges true duplicates while retaining independent origin/provenance and different consequences. No speculative candidate may be represented as an approved product rule.
- For each candidate, record a *proposed* disposition of `already_decided`, `delegated`, `human_required` or `evidence_blocked`, with source references, authority, alternatives, impacted objects/operations, safe continuation scope and known unknowns. These discovery labels are **not** replacements for native artifact approval states, `applicability` or `workDisposition`.
- `already_decided` must cite a current authoritative revision; `delegated` must identify delegated scope; `human_required` remains unapproved until a real authorized user decision; `evidence_blocked` must name inaccessible or absent evidence. The affected consequential interpretation cannot be counted complete while unresolved; unaffected authorized work continues.
- An agent lacking interactive questioning or MCP write access returns the candidate through the existing orchestrator/PR work record. When supported, the authorized coordinator stages a decision reference and linked effects through the **existing** task/Change Packet/requirement proposal owner. No invented persistence or self-approval.
- **Acceptance to be designed in canonical package:** two agents independently detect different cross-policy questions; coordinator deduplicates shared meanings without discarding provenance; prior approved rule resolves one; another requires human authority and blocks only its affected requirement proposal; read-only agent reports the question without claiming a write; an authorization change after discovery invalidates stale authority; downstream case approval and run eligibility remain unchanged. “No open candidates within inspected scope” is not a guarantee of completeness.

**Origin evidence:** Nesberry ISS-9482/D-115 exposed the conflation of branded profile publication and seller eligibility; this demonstrates the missing-question generation failure mechanism, **not** a Tesbo visibility rule. Current MCP guidance at `Tesbo-Backend-Nest/src/mcp/mcp.types.ts` is a prompt-level trigger, not hard evidence or enforcement.


## Canonical revision 1.4.46 — behavioral evaluation refinement (proposed)

Apply [canonical 01's current amendment](../../qa-orchestration/01_PRODUCT_REQUIREMENTS.md#revision-1446--behavioral-assurance-for-governed-skills-and-agent-workflows-proposed) through the existing R-ASE-21–36/38/39/44/46–48 and FR-124 owners; no new requirement family is created. Assess independent outcome quality, observable process obligations, attempted/actual effects, evidence sufficiency and effort separately. Controlled active/candidate and repeated unchanged-method comparisons retain required governance; removing optional treatment guidance needs authorized isolation. Full assigned/attempted/graded/ungraded accounting, false blockers/misses, independent expectations, cost provenance and hidden-rubric separation govern effectiveness claims. Existing native Tasks, Skills versions, Runs and evidence own the workflow; telemetry, popularity and a schema pass cannot establish competence or approve adoption. Source support, later model adaptations, admission decisions and NOT RUN acceptance are qualified by canonical 03/05. Historical claims retain their original dates and scope.
