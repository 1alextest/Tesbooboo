# ASER — Reuse-first technical design v0.4 (canonical integration view)

**Canonical home:** Tesbo specification package revision **1.4.28**, the same eight files `00_README.md` through `07_UI_DESIGN_TASKS.md`. This repository file is a subordinate integration view, not a ninth normative specification. Current requirements, owners, contracts, implementation gates and proof obligations are reconciled in those eight files. This is a **proposed design; NOT FROZEN and not an implementation/deployment claim**. P-07 human publication, P-14 eight-file ownership and P-18 project MCP consent remain unchanged. The independent review and its evidence limits are recorded in [the existing assurance record](reviews/2026-11-18-charter-guided-spec-challenge.md).

**Status:** Architecture proposal only. Existing source owners must be re-verified at implementation head. No migration approved by this document.

## 1. Architecture

An application change produces a **Change Packet**: a versioned, project-scoped *coordination receipt* that links canonical records without becoming a duplicate source of truth. Work may start from spontaneous coding, an approved requirement, a QA finding or a policy decision. This is a **cross-role software delivery assurance architecture**, not a replacement coding agent/IDE.

Source providers, optional coding-agent hooks and explicit human/MCP observations feed the existing source/change owners. Tesbo MCP and Zyra obtain scoped context and effective guidance, prepare shared staged operations over native records, and expose human review. Actual execution, deployment and incident receipts feed the same traceable change view; none of those observations automatically approves an expectation. The canonical ownership and lifecycle contracts in §18 define the relationship, including failure and recovery.


Do **not** introduce a new chat assistant, a shadow test case writer, a disconnected project board, a second Knowledge Base or an AI-owned policy authority. Reuse `graph_history`, current cache graph, Model Studio revisions, Zyra task/feedback history, existing notification writers, `LegacyService` business rules, and versioned KB documents; extend them only at evidenced gaps.

## 2. Current evidence and actual gaps

Source inspection pinned to `0c54b8ed28c9dec51ed0ca3bbb3cd3b7b8ab12d8` (not a deployed-build claim): `Tesbo-Backend-Nest/src/mcp/mcp.tools.ts`, `mcp.service.ts`, `docs/FEATURE_DOCUMENTATION.md`, and `graph-change-review.controller.ts`.

- Existing MCP: `create_testcase`, `update_testcase`, `sourceRefs`, `link_requirement_to_testcase`, `create_knowledge_document`, `update_knowledge_document`, graph change capture/history, behavior model drafts. The source currently registers 59 tools; this is **not** proof the deployed client sees them.
- Existing `link_requirement_to_testcase` accepts **exactly one** `jiraIssueKey`, `linearIssueKey`, or `notionPageId`. It does not accept a native Tesbo requirement ID. The `get_requirement_matrix` endpoint largely reports cases/runs/bugs; external Requirements UI counts linked non-deleted cases, which is not executed coverage.
- Existing KB `requirement_note` and feature-requirements templates can hold content, but do not constitute a first-class native requirement object with accepted criteria/revision-aware typed testcase edges.
- The KB already owns documents, folders, version history and files; the MCP source includes KB **document/folder** tools but does **not** advertise binary file-upload tools.
- Zyra has a generation-specific Kanban/task review; Bugs have their own records. Neither is yet a general work-item system covering implementation and policy/documentation tasks.
- Graph history/capture, Zyra change review and Model Studio provide a reuse substrate; source-declared behavior and model/case mappings are not proof of deployed or executed behavior.
- The historical 2026-11-15 manifest did not record an independent team run. The separate 18 November rerun now has original independent receipts; it does not retroactively execute old tests or establish runtime/UI assurance.

## 3. Canonical ownership map

| Record/relationship | Authoritative owner | Projection/adapter |
| --- | --- | --- |
| Code diff, PR, commit, deployment | repository/CI/deployment provider | project source binding and graph observation |
| Native requirement content/version | existing KB document identity + typed requirement rules; approved DB mapping if necessary | native Requirements UI and MCP |
| Jira/Linear/Notion requirement | provider and existing synced cache | integration adapters, external key mapping |
| Case, approval and execution | native case/suite/plan/run/result services | MCP, Zyra generation, Model Studio, reports |
| Manual/API/operations documentation | versioned KB document, classified by audience/access and subtype | internal/external manual views, governed skill-specific authoring and MCP |
| Decision, policy, enforcement rule | typed governed KB content with immutable authority-backed revisions | internal/external policy views, effective skill resolution, lifecycle and impact reports |
| Work item/task | unified native project task service derived from existing task/board infrastructure | agent work queue and board; Bugs remain defects |
| Bug | native Bugs service | work-item relation and graph link |
| File/evidence | existing KB file/storage/evidence services | MCP safe-upload/download/ref adapter |
| Governed Skills Library and approved assignments | T-422 QA Standards & Playbooks, existing guide/workspace/project bindings, immutable governed KB snapshots for project content and separate human authority | read-only effective-skill resolver, candidate MCP tools and human-only Skill Assignments UI |
| Cross-artifact link and review | native graph/link services + change review history | Change Packet and summary read model |

Before adding columns/tables, inspect existing migration indexes, KB version identities, Zyra tables and current graph link schema. The storage implementation is not pre-decided: prove reuse/extend/new options against required invariants first.

## 4. Change Packet contract

The canonical identity is FR-115/T-455 `changesetId`; `changeId` is its API alias. Packet/Workspace is a projection over that owner, shared proposal operations, independent impact/task decisions and native evidence. It is not a second writable lifecycle. Illustrative response, with the actual schema still subject to implementation and capability discovery:

```json
{
  "changeId": "existing-canonical-changeset-uuid",
  "projectId": "authenticated-project",
  "inputRevisionFingerprint": "digest-of-authoritative-input-revisions",
  "sourceRefs": [{"bindingId":"stable-binding-id","configurationRevision":"exact-config","repositoryId":"provider-id","ref":"refs/heads/feature","baseCommit":"sha-or-unknown","candidateCommit":"sha-or-provisional-digest"}],
  "proposalRefs": [{"proposalId":"shared-staging-id","revision":"exact-revision","logicalOperationIds":["operation-id"]}],
  "workItemRefs": [],
  "impactRefs": [],
  "releaseCandidateRefs": [],
  "artifactAssessments": [{"domain":"requirements","applicability":"change_required","workDisposition":"active","reason":"criterion changed","evidenceRefs":[],"operationRefs":["operation-id"]}],
  "coordinationState": "review_required",
  "readiness": "not_assessed",
  "scopeCompleteness": "partial",
  "unexaminedScope": ["additional configured dependency"],
  "asOf": "UTC-time"
}
```

All seven domains have assessment entries; the single row above is illustrative. A valid source-free change records that reason instead of inventing a commit. Many-to-many source/release scope, candidate-to-native target resolution, derived lifecycle, rejection/cancellation/deferral/reopen and exact resume behavior are normative in canonical API revision 1.4.28 (ASER-C01–06). Typed edges use FR-118/T-426 and exact revision/occurrence identity; citations and observed graph links never become approved coverage by proximity.

## 5. Agent work cycle

**Preflight** (read only): Verify project binding, token permissions, runtime server identity, `tools/list` contract, source commit, existing applicable records **and the exact approved effective skill assignments for each selected module/subtype/audience**. Do not load a skill proposal or stale cached version as authority. Missing or conflicting mandatory binding blocks the affected governed authoring action; no automatic choice of another project when binding fails.

**Assess**: Find source and behavior changes, existing artifacts, affected stakeholders, applicable policy versions and tasks. Classify each domain as update/unchanged/not applicable/blocked/deferred, with rationale. For spontaneous code changes, this can occur incrementally; no prerequisite formal spec ceremony.

**Plan**: Establish affected requirement acceptance criteria and verification strategy. Preserve existing IDs, define potential manual/policy impact, list cases before automation. A specialist can draft one area but inherits no extra publishing authority.

**Build and prove**: Code, unit/integration/E2E tests and actual observations remain within the coding tool's execution environment. Record what was **run**, not just authored, and distinguish CI, local, and live target.

**Propose**: Submit immutable **shared staged** requirement revisions and testcase logical operations (not direct official rows), internal/external manual edits, internal/external policy/decision/rule proposals, work item changes and (when requested) *new skill candidates/successor proposals* using existing services and the pinned governing skill versions. An agent can propose a new skill version but **cannot mutate any existing skill version, assign/reassign it, activate/deactivate it or approve it**, even through an admin-owned machine token. Hash source inputs; keep base revisions and exact source citations. Never unilaterally rewrite an approved policy.

**Reconcile**: Link coherent candidate revisions, identify duplicates/conflicts, mark impacted existing cases stale, and surface QA/BA/policy/manual review through existing Zyra and notifications.

**Approve/publish**: Each domain's authorized reviewer approves exact revisions. Skill promotion and module assignment require independently authenticated interactive human governance, not an MCP credential issued by a human. Protected selected publication occurs through the actual shared native transaction with optimistic concurrency, exact approval/dependency validation, logical commitments and mandatory audit. An eligible new run item must match the reviewed semantic definition; a status label alone is insufficient. Ordinary receipt ingestion and official publication are distinct actions.

**Close out**: Save exact persisted receipt(s), links, missing evidence, blocked/deferred work and next actions; support resume after interruption.

## 6. Multistep reliability and security

- Server: all tool handlers call native services; verify project identity and role per operation, not only at the initial client handshake. Explicitly bind reads and writes to the token's project.
- Proposal idempotency: `(projectId, operationKind, idempotencyKey)` must return the prior result when payload hash matches; a reused key with a different payload is a conflict.
- Revision guard: every update carries `expectedRevision` (or an equivalent version token); concurrent disjoint changes may merge only when semantically safe and reviewed.
- Batch safety: partial candidate staging/external effects use the existing operation journal; selected protected native apply must be all-or-nothing with one real transaction client. If a native adapter cannot participate, fail or remain staged before any official mutation. Explicit resume rechecks unresolved items; receipt lookup never silently resumes.
- Permissions: `read`, `propose`, `edit`, `review`, `publish`, `approve_policy` are distinct **capabilities** enforced by Tesbo role/authorization rules. Avoid assuming all existing tokens support these granular scopes.
- Auth and secrets: server-side source allowlist, stored source binding, no user-supplied URL/bearer tokens in free-text prompts, file content/byte checks, tenant isolation and audit trails. An agent is never the policy authority by virtue of being the proposer.
- Client version drift: compare deployed `serverInfo.version` / tool fingerprint and introspected schemas; reconnect or mark blocked if the needed capability is absent. Tool catalog advertised in a branch is not runtime verification.

## 7. Modules and user experience

Use the **existing project navigation** and domain services, with modules or views as needed:

- **Requirements:** Native + External tabs; details and revision diff; acceptance criteria; linked cases and gaps; approval/status. Proposal UI shows effective requirements-authoring skill version.
- **Test Cases:** Existing editor and Zyra review; “Requirement coverage” links are separate from source citations.
- **Knowledge Base / User Manual:** existing document editor; internal/external plus functional-audience subtypes; grouped Manual/Policy/API documentation views without another document store. Audience, source authority and visibility are independent axes.
- **Policies:** governed KB-backed policy index, internal application-governance and external-facing/externally sourced policies, active/draft/history, decision and enforcement reference details, review/activation permission checks, skill-specific authoring rules.
- **Tasks & Issues:** existing task board extended to general project work; defect links continue to native Bugs; a single card exposes cross-artifact change status.
- **Files & Evidence:** existing KB file browse/upload/preview; verifiable byte metadata and canonical source linkage.
- **Skills Library inside D-14 QA Standards & Playbooks:** one versioned searchable view in existing settings, candidate creation/proposed successor via MCP, dependency/evaluation and usage history; only a separately authorized human governance view may approve versions, activate or reassign effective bindings, or change root meta-skill.
- **Zyra Change Review:** one change packet and per-domain proposals, diffs, missing verification, approvals, timeline and reports. No new independent Copilot.

UI status must never collapse `draft`, `linked`, `approved`, `executed`, `passed` and `deployed-verified` into one “complete” badge.

## 8. Policy design extracted from Nesberry (context-sensitive)

Nesberry's Policy Ledger uses distinct *Decision* → *Policy Version* → *Business Rule/enforcement*, append-only semantic versions, provenance/authority, version predecessor validation, session effects and link integrity. Port that **contract**, not its file layout/ID namespace:

- In Tesbo, the KB document owns approved policy text and immutable revision identity. Typed projections expose active/draft/history.
- A decision explains who/why; the policy states normative invariant and effective scope; rules/tests/guards prove some degree of enforcement.
- Session manifest principle becomes a persisted Change Packet activity/effect receipt. Approval and publication remain authorized and audited.
- Policy change impacts graph-linked requirements/cases/manuals/tasks; unknown/dangling links remain explicitly uncertain.
- Source completeness matters: Nesberry's policy-ledger tasks show some phases built and some pending. Do not transplant incomplete features as "already implemented."

Nesberry's concurrent issue-filing lesson becomes **per-record isolation**, collision checks and optimistic locking in Tesbo's DB, not an `ISS-NNNN.md` store.

## 9. Evidence tiers

| Assertion | Minimum evidence |
| --- | --- |
| Proposed artifact | Persisted draft ID + readable revision |
| Approved artifact | Authorized review event binding the precise revision |
| Code changed | Pinned repository diff/commit |
| Test authored | Saved case/spec ID, not a pass |
| Test executed | Actual runner/run receipt + result + selected scope |
| Target validated | Known deployed target identity + test evidence against it |
| File verified | Retrieved/checksummed bytes, not metadata count |
| Change complete | Domain dispositions, accepted revisions, residual risks and reviewer sign-off as applicable |

No artifact count or generated graph equals a proof of real target behavior.

## 10. Skills governance architecture and seven-domain lifecycle
The complete, testable contract is [skills-governance.md](skills-governance.md); this design adopts it as a **governing layer**, not a seventh duplicate document store.

### 10.1 Two separable invariants
1. **Skill identity and immutable revisions:** skills are versioned native content; the agent's only skill mutations are additive candidate creation/proposed successors. Creation, editing existing version payload, approving and publishing are distinct verbs.
2. **Effective assignment authority:** a separate typed binding resolves exact approved skill versions to module/subtype/audience/project operations. Activation/deactivation/assignment, precedence and root protection are *never MCP-writable*. The human-governance endpoint must reject machine principals even when the token owner is a human administrator.

A Skills-authoring meta-skill is itself a governed artifact, but initial bootstrap and successor promotion use an independent human-controlled root trust anchor, not a recursive skill loop. The root can be replaced only by a separately authorized and evidenced governance decision.

### 10.2 Application and source boundaries
- **Manual:** module/user group/internal-external distribution/ACL and artifact subtype are orthogonal. Internal instructions, developer manuals, external customer instructions, partner manuals and support runbooks are not one indiscriminate template.
- **Policy:** internal application/business/governance policies and external-facing or externally mandated policies are distinct in audience, source of authority, required sign-off, jurisdiction and scope; an externally mandated rule can be handled by an internal enforcement policy while external-public display remains separate.
- **Project-specific adaptations:** portable core and scoped adapter may compose by a human-approved rule. No "last matching skill wins" and no candidate skill can override the root, change the module assignment or supply its own authority.
- **Agent control:** a governed authoring call pins effective assignment IDs, skill version IDs and hashes in the candidate and Change Packet. The native service revalidates binding before submission/promotion; stale means `SKILL_CONTEXT_STALE`, ambiguity means `SKILL_ASSIGNMENT_CONFLICT`, and absent mandatory mapping means `SKILL_UNASSIGNED`.
- **Prompt injection:** a skill candidate is untrusted input until approved and assigned, and external files never inherit instruction authority just by being cited. Effective skills are signed/digest-bound read results; references, assets and examples remain data.

### 10.3 End-to-end authoring flow
```text
coding agent / optional specialist delegates
           |
      MCP identity + project/source binding
           |
  resolve_effective_skills (read-only)
    -> exact approved versions, assignments and hashes
           |
   read existing records + actual target behavior
           |
   create draft per applicable module, pin governing skill set
    -> requirements  -> native testcase candidates
    -> internal/external manuals, internal/external policies
    -> tasks/issues, evidence/files, optionally skill candidate
           |
   native writer validation, typed links, idempotency, audit
           |
     human review for artifact publication
     separate trusted human skill activation/assignment
           |
    graph impact + historical version/skill provenance
```

New skill candidates do not change any active effective assignment. A skill assignment change mid-flight preserves the candidate and records a blocking stale context unless specifically re-reviewed; the prior exact skill version stays in historical records and frozen executions. Old MCP/REST/AI writers **must not** bypass server-enforced skill applicability: inventory and compatibility/migration gate precedes rollout.

### 10.4 Proposed conceptual governance model (no migration asserted)

All names below are logical attributes/relations of the existing T-422 guide/asset and binding owners, not new independent registries. §18 and canonical 03/04 give the exact owner mapping; do not create a second resolver or Skills database.
- `skills`: stable identity, owning scope, shared KB document identity if compatible, lifecycle and metadata.
- `skill_versions`: immutable content snapshot, predecessor, hash, references, candidate/published/rejected event identity; no in-place overwrite.
- `skill_assignments`: independently versioned binding of approved skill-version(s) to module/context plus activation/precedence/owner/approval.
- `skill_reviews`: human decision and source of authority binding exact reviewed payload hash to version/assignment.
- `artifact_skill_usages`: durable immutable provenance edge per artifact/content version; migration unknown marked UNKNOWN.
- `skill_effective_resolution`: derived read model only, no authored parallel truth.
These are **logical entities**, not a mandate to create six new tables. Use existing KB/history/graph/audit models first, add narrow constrained metadata where proven necessary.

### 10.5 Admission and completeness criteria
Design isn't ready until library version lineage, composition conflict, root-meta bootstrap, inaccessible/inactive skill, revocation/rollover, per-role privilege checks, cache consistency, externally sourced obligations, all existing REST/MCP/UI writer paths, candidate poisoning, historical provenance and a realistic human approval flow are specified with independently falsifiable tests. The `SK-E2E` test matrix in the Skills document is mandatory for implementation admission, **not** proof of execution.

No implementation or current deployment claim is implied by this section.

## 11. Hybrid source-change detection and reconciliation — Kiro precedent, Tesbo implementation
**Source-owner reuse:** The existing project source binding, current-cache graph capture/history, `GraphChangeReviewController`, native notification writers and Zyra review feed remain the canonical Tesbo sources. Integration adapters supply observations only; no second repository record system.

**Observation channels and trust:** (a) optional client events such as file save, task completion or agent stop, with exact supported wire event names and security scope discovered for the installed client/version, (b) source provider webhooks for push/PR/merge and repository identity, (c) CI build/check callbacks, (d) deployment/incident provider events when installed, (e) explicit Tesbo MCP capture or human rescan. These channels are complementary, not redundant claims of exhaustive coverage. Not all tools/IDE surfaces support hooks. **Do not require a client hook to prove that a commit exists.**

**Logical normalized receipt** (exact schema delegated to native data/service discovery):
```json
{
  "projectId": "from-authenticated-source-binding",
  "sourceBindingId": "stable-binding-id",
  "configurationRevision": "immutable-configuration-at-original-observation",
  "sourceType": "agent_hook|repository|ci|deployment|manual_reconciliation",
  "sourceEventId": "stable-provider-id",
  "deliveryId": "dedupe-key",
  "sourceRevision": "git-sha-or-provider-version",
  "sourceScope": {"repository": "owner/repo", "ref": "refs/heads/..."},
  "observedAt": "UTC",
  "sourceOccurredAt": "UTC-or-unknown",
  "actor": {"principalId": "verified-or-null", "agentId": "attributed-or-null"},
  "evidenceClass": "tesbo_observed|provider_attested|agent_reported|derived_inference|unobserved",
  "processing": "received|reconciled|incomplete|rejected|superseded",
  "gap": "none|unknown-range|unsupported-source|stale|authorization-failed"
}
```

- Verify source/project binding on each receive and on reconciliation. Reject an unbound remote repository, spoofed source IDs, replaying stale head across environments and cross-project scope.
- Deduplicate by provider/scope/sourceEventId+content identity; record gaps and conflicting branch/head observations; do not order by local arrival time as if it were causality. Repeated file-save events for the same eventual commit may coalesce, but never erase meaningful separate source revisions or reported errors.
- Provider reconciliation detects source commits with no corresponding current successful capture for *known authorized tracked sources*. Where the repository is unreachable or permissions are revoked, result is `UNKNOWN`, not `UNCHANGED`.
- Source-change detection may suggest *review*, never directly mutate approved requirements/testcases/policies or set release readiness to ready. Capture acknowledgments and queue delivery use the existing graph history/notifications and outbox/worker substrate, backed by replay and dead-letter monitoring.
- Multi-repository/dependency scopes are configured explicitly; report `impact_incomplete` for unbound sibling repos. Historical captures are never rewritten by later source events.

## 12. Agent activity, claims and the human Change Workspace — GitLab precedent
**Existing owner:** Zyra's sessions/task/activity, graph review and native change linkage; no separate assistant/agent database. Externally connected coding agents may publish authenticated telemetry or scoped MCP calls without being granted UI-human powers.

**Evidence-level event vocabulary:**
- `tesbo_observed`: authenticated Tesbo MCP/REST operation, authorized native UI action or internally executed job with durable receipt.
- `provider_attested`: signed/authenticated repository/CI/deployment event with verifiable origin and scoped payload.
- `agent_reported`: content submitted by an agent describing work or execution not independently observed by Tesbo.
- `derived_inference`: graph/LLM analysis whose premise and confidence/limitations are inspectable.
- `unobserved`: no trustworthy observation (not a failed test, success or "agent did nothing").

Each timeline entry carries work/change/session/attempt identity, originating authenticated principal (distinct from delegated model/runtime), operation type/target/scope, source revision/build, causality parent, event time/ingestion time, retention/visibility class, redaction policy, outcome, linked evidence and explicit missing observation. Do **not** claim access to hidden chain-of-thought, uninstrumented local tool calls or secret agent prompts. Detailed traces are opt-in/permissioned; project owners can review aggregate progress without seeing restricted evidence.

**Human experience:** Reuse Tesbo project navigation and existing `Zyra` change review. A Change Workspace summarizes one change as:
1. intent/approved expectation vs proposed interpretation;
2. source diff/PR/build/deployment identities with observed/unknown markers;
3. current agent/session and task status; next responsible humans;
4. impacted requirements, cases/models, policies, manuals, files, issues and skills with version/diff status;
5. verification scope and actual results/evidence/known target;
6. blocked/unconfirmed links, risk, decision trail and pending approvals;
7. release-readiness reasons and post-deploy monitoring/incident follow-through.

The same canonical records support role-appropriate developer, solo coder, QA, BA, PM, policy/security, operations and executive views. A high-level release view must **not** reveal private document history or raw tool trace content. `Blocked`, `Awaiting approval`, `Unknown` and `Observed success` remain visibly distinct; users can drill into the proof.

## 13. Composite MCP operations and compact context — Qase precedent
**Reuse:** Existing `McpService` JSON-RPC engine/project tokens and `mcp.tools.ts`, native LegacyService, case/KB/cycle/Bug/project routines, Zyra reviewed drafts, graph history and RBAC. More tool names are not automatically better; a **small discoverable set of task-oriented operations** may improve agent reliability without duplicating native writers.

Conceptual adapters (not yet implemented):
- `get_quality_context` authoring profile (the earlier conceptual `get_project_authoring_context` is an alias, not a second owner): bounded read of permitted project scope, active governed skills, applicable approved requirement/policy references, current cases, live source binding and ability/limitation flags; pagination/cursors for large projects. Caller cannot choose a different project.
- `propose_change_bundle`: permissioned creation or revision of a Change Packet, a native requirement candidate, linked testcase candidate(s), and optional manual/task/policy applicability dispositions. Each operation explicitly records its base revision, governing skill version and approval state.
- `submit_verification_bundle`: record only actually observed run receipts/evidence against existing native cycles/executions, with independent agent report status and optional Bug candidate triage.
- `get_change_readiness`: compute linked source, case, approval, verification and risk/unknown read model without any write or implicit approval.

Tool selection/discovery should advertise capability/schema versions, permission boundaries, scoped mutation classes, size/latency budget and required manual approvals. Do **not** create an arbitrary REST escape hatch that bypasses native writers; alias and legacy endpoint paths must share authorization. Candidate staging and external handoffs can be partial and must expose `committed|failed|not_attempted|uncertain` per item. This does **not** weaken P-07: selected protected native apply is atomic within a real shared transaction or is refused before official publication. Exact duplicate commands read the logical receipt; an explicit resume uses an expected journal revision and new resume-attempt identity after readback/reauthorization. Changed intent gets an attributable new proposal revision without replaying committed logical operations. See ASER-C03–05 for the complete contract.

## 14. Cross-artifact consistency and independent truth — Spec Kit precedent
A read-only cross-artifact analyzer operates on typed **approved source obligations and their known revisions** plus code/source/graph observations, case/model links, docs, issue tasks and run evidence. Correct semantic disagreements at the owning artifact, never silently change the authoritative policy to match current code.

**Classification:** `confirmed_conflict`, `unresolved_conflict`, `missing_link`, `stale_reference`, `unknown_source`, `not_applicable`, `no_detected_issue`; the last classification means **only** that this bounded analysis found no supported discrepancy. A source diff can propose a new requirement interpretation, but it cannot itself become a normative oracle. Semantic comparisons require rationale, evidence tier, uncertainty and responsible reviewer, not a blanket LLM pass.

**Completeness boundaries:** first inventory material user goals, actors, states, interfaces, upstream/downstream consumers and negative/recovery paths. Maintain a denominator of assessed vs missing/unverified scope. All change candidates point to canonical records and existing graph; none automatically reclassifies historical executions. Report coverage separately for authored cases, approved cases, execution, deployed target validation and currently reviewed requirement revision. Re-run bounded consistency on relevant source/policy/requirement/skill head changes.

## 15. Release readiness, after-release outcomes and DORA-style metrics
**Reuse:** existing runs/executions/bugs, reports/dashboards, project releases and Graph/Zyra change review as applicable; extend one project-level role-sensitive reporting projection. Do **not** invent a new release-authority database or allow an LLM to determine whether production is "safe."

**Proposed readiness evidence dimensions:**
- source PR/commit and signed/observed target deployment identity;
- applicable current approved requirements and policies; missing or conflicting obligations;
- case candidates vs approved revisions and selected run manifest;
- actually run tests, pass/fail/block status, independent evidence bytes and environment/build;
- active high-severity Bugs, change/regression scope, unresolved impact and known exclusions;
- outstanding role approvals, rollback/forward plan, responsible human and accepted risks;
- post-deployment smoke/monitoring/incident visibility and freshness.

**Readiness vocabulary:** `not_assessed`, `insufficient_evidence`, `blocked`, `ready_for_authorized_decision`. Deployment and human decision are separate axes under ASER-C01. `released_with_known_risks` is a derived observed-release label, not a readiness value. Pre-deployment assessment uses the tested candidate build; post-deployment acceptance requires the observed deployed build. This prevents both fabricated production verification and a circular requirement for production evidence before initial deployment approval. A release authority approves a fixed readiness snapshot, candidate build and risk set. Changed evidence after approval creates a new decision context, never silently replaces the historical approval. Unknown deployment/monitoring is not marked passed.

**Five evidence-backed delivery measures:** change lead time (commit to successful production deployment), deployment frequency (qualifying successful production deployment/activation events per interval under a versioned provider-normalization rule; a later smoke failure or incident does not remove that deployed change), failed-deployment recovery time (duration to restore after a production change failure), change fail rate (qualifying failed production changes / qualifying production changes), deployment rework rate (unplanned remediation deployments / deployments, under an explicitly documented measurement rule). Source IDs, service/production-environment scope, time zone, observation window, denominator, normalization version and missing/censored data are visible. Distinguish pipeline attempts that never reached production from deployed changes that subsequently fail. Deduplicate delivery events, retain rollbacks/remediation as qualifying changes under the declared rule, and leave unresolved recovery intervals censored. Do not exclude a production failure to improve an apparent rate. These two outcome groups—throughput and instability—must not be collapsed into a misleading single score. A configured project without deployment integration gets `NO_DATA` not zero failures. Improvements in those figures do not alone establish a causal effect of Tesbo.

**Human oversight measures:** time to understand/approve a change, review cycles, unverified-agent-assertion corrections, stale-manual/requirement detection, duplicate artifact rate, incident escape and cost per synchronized change. Collect only what the user/organization authorizes, and avoid incentive gaming (e.g., fewer tests to improve apparent lead time).

## 16. Architecture invariants and release-blocking failure injections
| ID | Injection/contradiction | Expected invariant |
| --- | --- | --- |
| D-ASE-OBS-01 | Kiro hook never runs; webhook delivered later | No fabricated `synchronized` status; rescan/provider gap detects unobserved scope |
| D-ASE-OBS-02 | Duplicate/out-of-order PR and agent events | One bounded source revision identity, replay-safe graph captures |
| D-ASE-ACT-01 | Agent claims it ran tests, but no runner receipt exists | Timeline says `agent_reported`, release verdict unverified |
| D-ASE-ACT-02 | BA/QA/PM inspect same change | Common canonical IDs and independent permitted visibility |
| D-ASE-MCP-01 | Composite proposal partially fails then retries | Exact per-item receipt and zero duplicate or unauthorized publication |
| D-ASE-CONS-01 | Code implements behavior disallowed by approved policy | Conflict rather than a new, automatically approved requirement |
| D-ASE-REL-01 | PR merged, no target deploy observation | Production remains unverified and DORA deployment count unchanged |
| D-ASE-REL-02 | Smoke fails after deploy; rollback succeeds | Original CI result remains historical; incident/recovery tracked on correct build |
| D-ASE-GOV-01 | Native Copilot in owner browser session tries assigning skill | Server denies delegated action lacking exact interactive human consent |
| D-ASE-PRIV-01 | PM views general release status | No private prompt, secret, legal attachment or draft history leak |

**Minimum proof:** backend authorization/db/queue checks + real project MCP and native UI, provider event fixture, source/deploy identity, independent QA observed evidence and at least two role-specific user journeys. Executed proof and independent assurance-team review remain separate from this proposed design.

## 17. Interoperability and competitor-informed implementation limits
Kiro hooks are one optional event adapter, not a Tesbo dependency; GitLab audit methods inform evidence tiering, not imported audit authority; Qase composite tools inform MCP ergonomics, not permission shortcuts; Spec Kit analysis informs read-only semantic checks, not mandatory model-first behavior. The DORA measures are a method for measuring project outcomes, not a substitute for human release risk decisions. Reuse existing Tesbo components first, then evaluate external libraries/plugins and licenses against a proven gap.
**Primary external references:** [Kiro hooks](https://kiro.dev/docs/hooks/), [GitLab AI Governance](https://docs.gitlab.com/user/ai-governance/), [Qase MCP](https://docs.qase.io/en/articles/14984302-qase-mcp-server), [Spec Kit analysis](https://github.github.com/spec-kit/reference/agentic-sdd.html), [DORA metrics](https://dora.dev/insights/dora-metrics-history/).

**Canonical reconciliation:** the same original eight files now contain revision 1.4.28. This file is a subordinate view of that proposed integration baseline; P-07 and P-18 remain unchanged. Formal freeze and runtime admission depend on the separate assurance and implementation gates.

## 18. Canonical convergence, source gaps and controlled implementation

### 18.1 Owner and axis decision

The following is the explicit integration allocation. Existing logical canonical names do not assert that every table or API is built. Read the same current contract in canonical 03/04; historical alternatives such as a standalone `QualityImpactModule` are not instructions to create a competing owner alongside today's `behavior-graph` services.

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

### 18.2 Existing substrate needs specific extensions

At the pinned input source, MCP exposes caller-supplied case status and optional row revision; native generic writers can preserve Approved, and new-run admission checks status. Dedicated approval does have CAS and a receipt, but its controller passes issuer `userId` without the machine-principal distinction. Its hash does not cover every independent custom/tag/link value. Reuse those owners and extend their shared authorization, semantic dependency manifest and final-write guards; do not call their present state universal P-07 enforcement.

Ordinary KB history coalesces edits in a 15-minute window, updates the latest cached diff and lacks a caller expected-revision condition in the inspected writer. Preserve draft autosave behavior, but create immutable submitted/accepted governed snapshots with CAS and complete semantic metadata at reliance. KB recent/folder/RAG consumers must distinguish candidate data from effective instructions; ordinary project visibility is not proof of the new classification policy. No historical exact approval or skill usage may be backfilled by guess.

The inspected MCP request chain verifies project, current membership and read/write scope, but does not establish P-18 project opt-in/named-client enforcement. T-411/T-439 must close both aliases, initialization/discovery, calls and cached-client bypasses before this integration is exposed. Existing provider event intake can remain separately authorized when external MCP is OFF; that is not an MCP bypass.

`createBug`/`addBugLink` currently reach `failLinkedExecutions`, which can change status, execution time and actor for manual/open automated runs; finalized automated runs have a narrower protection. A side-finding association must retain independent result truth. T-307/T-207/T-433 must separate association from explicitly authorized correction, including composite triage and native writers. This is a source-supported integration prerequisite, not an executed deployed defect report.

The Requirements page's linked-provider reads convert failures to empty keys/counts/tasks in the inspected source. Before that projection informs reuse/coverage/readiness, retain successful-empty versus unavailable/stale/denied/partial states at the existing owner and preserve project/request identity across responses. A failed lookup must not prompt duplicate authoring or certify zero coverage.

Current source-binding storage has one mutable project-keyed row; preserve the actual server-provisioned checkout guard while extending immutable historical identity and declared multi-source scope. Inspect migrations and all consumers before implementing the transition. The specific source anchors and independent receipts are in the existing review record, not a claim of exhaustive source/runtime assurance.

### 18.3 Invariants and migration boundary

ASER-C01–06 in the canonical API file define state vocabulary, identity/cardinality, staged-to-native publication, immutable governed snapshots, receipt/resume, derived completion and reader/writer coverage. These contracts take precedence for this amendment's field meanings; they do not supersede unchanged P-07/P-18 or invent new model/run/guide owners.

Before enabling a governed writer, record its actual entrypoint → principal/permission → native transaction/validation → persisted revision → outbox/index/cache → read/UI/export consumers. Include imports, bulk, clone, restore, legacy endpoints, SDKs, automation, Zyra and maintenance. For each, record reuse/extension, legacy policy, positive and denied-effect tests, and rollout boundary. Unknown legacy approvals/provenance remain UNKNOWN. A read-only pilot may precede authored-domain rollout; a required manual/policy/task capability that is not yet supported remains a blocker or explicit accountable exception, not a silent I8 deferral.

Root meta-skill approval/recovery quorum, native requirement/policy/release authority assignments, narrow no-skill exceptions, retention/holds and measured operating limits remain **named policy/implementation gates**. The safe default is no governed promotion without the required authority, no script execution from a skill, and no claim beyond observed scope. No proposed rule grants an agent emergency authority. The existing task/decision record must identify the accountable human before enabling the affected action.

## 19. Canonical API contract mirror (ASER-C01–06)

### ASER-C01 — One vocabulary and one owner per state

All ASER schemas are **proposed** until implemented and advertised through the existing project gateway. This section is the single contract owner for the following fields; repository views and UI labels map to it. A client encountering an unsupported schema/enum returns an explicit compatibility error, not a success or `no_detected_issue`.

ASER consistency enum: confirmed_conflict, unresolved_conflict, missing_link, stale_reference, unknown_source, not_applicable, no_detected_issue

| Field / value | Meaning and required consumer behavior |
| --- | --- |
| `confirmed_conflict` | A supported contradiction between identified revisions, with evidence and the applicable deterministic rule or accountable review decision. Correct the owning artifact; the analyzer cannot approve a replacement oracle. |
| `unresolved_conflict` | A suspected semantic disagreement needs an accountable review; it is not silently resolved by a model. |
| `missing_link` | A required relation is unresolved within the declared scope. `reason=missing_requirement` does not itself prove that code is invalid or that a requirement must be invented. |
| `stale_reference` | The relied-on revision differs from the current relevant source. Preserve both and require the affected reassessment. |
| `unknown_source` | `reason=unbound|unavailable|inaccessible|unsupported|unverified|scope_incomplete`; uncertainty and capability limitations remain distinguishable. Do not expose foreign identities/counts through the reason. |
| `not_applicable` | An evidence-backed applicability decision for this exact scope; not a fallback for failed retrieval. |
| `no_detected_issue` | No supported discrepancy in the declared examined scope. It is not exhaustive correctness, execution or release approval. |

Every analysis result also carries source/expectation revisions, assessed scope, unexamined scope, evidence class, rationale, checker/version, timestamp/freshness and next responsible review. Scope denominators must not leak inaccessible records. A denied or failed lookup is not an empty successful dataset.

**Activity evidence class:** `tesbo_observed|provider_attested|agent_reported|derived_inference|unobserved`. A Tesbo receipt proves the operation Tesbo witnessed (for example report submission), not the truth of every target action described in its payload. Agent claims about test execution retain their own evidence tier. `unobserved` represents a scoped observation gap, not an invented agent event. Preserve authenticated principal, credential kind and delegated actor separately.

**Domain assessment:** `applicability=change_required|unchanged|not_applicable|undetermined`; separately `workDisposition=active|blocked|deferred|resolved`. Assess all six engineering-record domains plus skills governance, even in the first slice. Each artifact points to its stable logical operation or native identity and exact revision, with the shared review/apply outcome. A domain is not forced into one approval state when it has mixed artifacts. Non-update decisions have reason/source; a deferral has owner, scope, review/due trigger and an independently authorized exception where one is needed. Unsupported required work blocks the relevant readiness claim; I8 sequencing does not waive it.

**Readiness:** `not_assessed|insufficient_evidence|blocked|ready_for_authorized_decision`. Keep `assessmentPhase=pre_deployment|post_deployment`, immutable decision receipt, deployment observation and verification separately. An approved pre-deployment decision needs the tested candidate and required evidence, not a future production observation. After deployment, acceptance needs the observed deployed build and required smoke/monitoring. `released_with_known_risks` is a derived label for an observed deployment and its approved nonempty risk set; a release with no recorded known risks uses the ordinary deployment label. Neither label guarantees defect-free behavior.

### ASER-C02 — Identity, cardinality and historical scope

`changeId` is the FR-115/T-455 `changesetId`; do not allocate a second packet identity. One changeset has one or more source revision references when applicable, zero or more observations, proposals, independent tasks/impacts and native attempts. A source-free policy/document change may have no Git revision with an explicit reason. One proposal can cover several domains using existing logical operations; one domain can have several proposals. Case/requirement candidates use logical target references until native apply resolves and records official IDs. A native Draft case is not an unpublished proposal.

A release candidate composes exact changeset/source/build/configuration/dependency references. Changesets and release candidates are many-to-many: a shared-library commit used by two releases does not share their approval or outcome. Policy effectivity, skill assignment and case approval are independently scoped decisions, not inherited packet approval. Trace edges retain source and target kind/ID/revision or exact attempt/occurrence, direction, project/scope, provenance, authority class and validity. No link to mutable `latest` substitutes for a relied-on revision.

**Typed relationship semantics:** FR-081/118 and T-426 remain the registry/projection owner; each native endpoint owner retains its content and decision authority. The meanings below are the admissible integration relationships, not permission to invent a new graph store or silently change an installed wire enum. Bind each meaning to the existing registry schema and migrations before exposure. Every edge has its own proposed/accepted/rejected/superseded decision history, separately from whether its pinned endpoints are current, stale, unavailable or revoked for current reliance. A changed endpoint can invalidate current applicability without erasing the historical link or silently accepting a successor.

| Meaning and direction | Cardinality and native authority | Required historical grain and limit |
| --- | --- | --- |
| Requirement criterion → covered by → case assertion/condition | Many-to-many; requirement, case and authorized mapping reviewers | Exact criterion and assertion/condition revisions plus mapping rationale. Designed coverage is not execution or a passing result. |
| Policy obligation → enforced by → guard/control; separately → checked by → test assertion | Many-to-many; policy, source/control and test owners | Approved obligation revision, source/guard revision and entrypoint scope; a check's actual attempt is separate. A policy citation alone proves neither enforcement nor verification. |
| Manual section → describes → requirement/behavior | Many-to-many; KB/manual and subject owners | Stable section identity or anchored content digest, audience and exact approved subject revision. A changed subject creates review work rather than rewriting the manual. |
| Authored revision → authored under → effective guidance resolution | One immutable operation resolution can contain many skill/assignment revisions; artifact and T-422 owners | Exact skill/assignment revisions, digests, resolved scope, actor class and outcome. Raw observations can truthfully use not_applicable; skill use never confers product authority. |
| Source/change observation → observed from → binding configuration and provider event/revision | Many-to-many with explicit deduplication; source/change owners | Stable binding ID and immutable configuration revision, repository/ref, event identity and evidence tier. Rebinding never relabels a past observation. |
| Human readiness decision → relied on → fixed evidence/build/risk context | One immutable context per decision, containing many scoped references; existing authorized decision owner | Exact candidate/build, obligations, attempt/evidence versions and accepted risks. New material evidence requires a new context; the link does not authorize deployment. |
| Finding occurrence → observed on → build/deployment; remediation → retested by → native attempt | Many-to-many; Bugs/findings and native execution owners | Occurrence, target and actual attempt identities, cause confidence and independent result. Task closure, a Bug link or current case status cannot substitute for retest proof. |
| Derived/redacted evidence → derived from → original file revision/object | Many-to-many; existing file/evidence owner | Immutable input/output digests, transformation and inspection status, custody and relevant attempt. A fixture, expected reference or derivative is not automatically observed execution evidence. |

Ordinary project-owned artifact links remain within the authorized project. A narrow exception permits **approved shared platform/workspace guidance through an authorized assignment/binding** under FR-106–113/T-422; it does not permit arbitrary cross-project links or access to private candidate/history payloads. Authorize endpoint existence/disclosure, edge metadata and payload independently. Revoked or unavailable shared guidance stops new effective reliance as applicable policy requires; retain only the historical references permitted by access/retention policy, without copying restricted content into a project. Read access to a redacted derivative likewise does not grant access to its confidential source. There is no universal `verified_by` edge that equates a planned mapping, a current Passed status and exact-build assertion proof.

Existing source bindings are currently one mutable row per project. Extend that owner with a stable binding identity and immutable configuration revision containing provider/repository identity, ref/scope, activation history and source fingerprint. Existing current-row storage may remain a pointer. Migration uses observed legacy metadata with declared provenance; unavailable historic configuration remains UNKNOWN. Never invent a historically verified binding or move history to the new repository after rebind. Delayed events must resolve their original binding/configuration, then be retained, quarantined or rejected under current permissions; they cannot advance an unrelated active binding. Deletion/rotation suspends current capture without erasing lawful historical references. Single-source pilots advertise that limit and cannot report a multi-repo release complete.

### ASER-C03 — Exact protected submission, decision and apply

1. Resolve current project/principal/capabilities, source/base revisions and applicable effective-method manifest. Authenticated identity includes machine versus independently authorized interactive human; issuer user ID alone is insufficient. Check P-18 before external MCP initialization/discovery/calls, on both aliases and cached sessions. Native read/governance remains independently usable when external MCP is OFF.
2. Submit immutable candidate snapshots to shared staging. Governed KB submission captures exact title/body/semantic metadata, references and attachment hashes, authority/applicability, base revision and skill/assignment manifest. This is an explicit boundary separate from coalesced autosave history. Later repairs create new candidate iterations; old submitted or accepted content never changes. Required CAS and transaction locks reject stale submission without losing the local draft.
3. A human decision binds exact logical operation/revision, payload digest, target, semantic dependency manifest and approval authority. Skill approval, activation/assignment, policy effectivity and release decisions remain distinct. Job labels, ownership of a machine token, caller `isHuman`/approval fields or a native AI tool running in an owner's session are not assent. Protected methods require server-owned action-bound review evidence, current authorization and replay/expiry controls; exact interactive proof/root recovery policy is an explicit implementation-admission gate.
4. Apply only selected approved dependency-closed operations, under one actual native transaction/client. Recheck current permissions, approval/base/dependency/skill revisions, plan locks, operation kind and target. Allocate official new IDs at apply; record logical-operation commitments and exact target mappings with the same mandatory audit/outbox transaction. Reject unsupported transaction participation before official writes. An audit failure rolls back this protected apply; do not broaden that requirement into an undocumented rewrite of unrelated legacy logging.
5. Preserve previous approved case and run snapshots until their valid transition. Current case eligibility requires a valid review of the exact semantic definition plus relevant dependency versions; generic create/update/bulk/clone/import/restore cannot set or inherit approval merely by status. New semantic edits cannot carry old approval to new meaning. An old run remains historical. Read back the actual selected run manifest; skipped missing/foreign entries are not performed coverage.
6. Raw reports/provider observations and evidence intake remain independent authorized observation operations. A revoked authoring skill blocks stale candidate promotion, not truthful authorized failure evidence. An observation receipt cannot publish a testcase, policy or official result. Result correction and Bug linking use their own native rules: associating a side finding must not change result, execution time or performer; any real correction needs an explicit, separately reviewed effect and immutable history.

### ASER-C04 — Partial staging, uncertain outcomes and controlled resume

A composite is an orchestration adapter over existing owners, never an arbitrary REST escape hatch. Its manifest fixes scope, payload digest, stable logical operation IDs, dependency graph and per-item base/skill revisions. Use existing `get_quality_context` for bounded authoring/change context and the T-422 `get_effective_testing_method` resolver for governing content. ASER names such as `get_project_authoring_context` and `resolve_effective_skills` are semantic aliases/profiles of these owners, not orders for duplicate tools or resolvers. Advertise actual versioned tool names and capabilities; the current 58 source declarations do not prove these proposed capabilities exist.

| Operation/event | Authoritative result and safe next step |
| --- | --- |
| New proposal command | Journal acceptance and each staging result under the existing proposal/operation owner. `committed|failed|not_attempted|uncertain` describes that item's attempted effect, not official approval. |
| Exact duplicate key + digest | Reauthorize access and return the same logical receipt identity plus its current journal revision/history. Do not silently execute additional items. Original attempts and actor attribution remain immutable. |
| Same key, different payload | Conflict with no overwrite. An amended proposal is a new revision/command referencing the same relevant logical operation; it is not permission to recreate an already committed target. |
| Lost response / `uncertain` item | Read back the native operation commitment/provider receipt before retry. If outcome cannot be established, retain uncertainty and route to reconciliation; do not guess failure. |
| Explicit resume | Requires original command/manifest identity, expected journal revision, a new resume-attempt ID and eligible failed/not-attempted items. Recheck permissions, dependencies, source and skill context. Do not replay committed operations. |
| Changed remaining intent, base or required skill | Preserve earlier commitments; create/review the necessary new candidate revision. New key does not erase the old logical-operation commitment. Reconcile dependencies using exact prior target mappings. |
| Cancellation / expiry / withdrawal | Stop not-yet-committed eligible work at the actual owner. Record who/why; do not pretend an external action was undone. Preserve committed records, observations and residual obligations. |
| Native protected publication | All selected official mutations, commitments and mandatory audit succeed atomically or none do. Partial candidate staging never weakens P-07. |
| External handoff or notification | Outbox + provider/native receipt + bounded retries/dead-letter/reconciliation. Queued/read/zero-row return is not delivered, assessed or verified. Compensating semantic changes require a new authorized operation; do not undo unrelated accepted work. |

Every mutation reauthorizes at the final owner, including resume and long-running jobs. The idempotency namespace is project/operation and scoped receipt access; permission to guess another key never grants access to its record. Stable workflow operation IDs allow an authorized handoff without changing original actor provenance.

### ASER-C05 — Derived coordination and completion

`coordinationState=open|review_required|blocked|settled|cancelled|superseded` is a **derived view**, computed from existing change events, seven domain assessments, logical operations, impact/work obligations and explicit terminal decisions. It is not independently settable through MCP, UI, a task close or a graph capture.

| Condition / transition | Derived behavior and what does not follow |
| --- | --- |
| New or changed scope; assessment incomplete | `open`; missing/unknown domain scope remains visible. |
| Coherent candidates awaiting human decisions | `review_required`; per-item mixed decisions remain visible. |
| A required unresolved conflict, unavailable dependency, uncertain mutation or unhandled obligation | `blocked`, with owner/recovery reason. No aggregate success hides it. |
| Every domain assessed; each relevant operation applied, rejected, cancelled, superseded or otherwise terminal under the native contract; residual work resolved or validly deferred | `settled` for coordination. Rejected-only work can settle without publishing anything. Disclosed deferral never satisfies an unmet mandatory release requirement. QA verification, policy effectivity and release decision remain independent. |
| Explicit cancellation or supersession | Derived `cancelled`/`superseded` only from the changeset owner's attributable terminal event/lineage. Existing official artifacts and unfulfilled independent impacts are preserved. |
| Reopen / new evidence / source or authority change | Append the new event/revision to the same correct owner and recompute affected scope; preserve the prior settlement/decision snapshot. A new unrelated release has its own context. |

Precedence for an active view is blocked → review_required → open → settled; an explicit terminal cancellation/supersession is shown with surviving obligations, never as a green release. Persist a revision/freshness fingerprint of the **inputs** for reproducibility, not a second authored answer.

### ASER-C06 — Readers, privacy, errors and resource limits

Apply the shared visibility and instruction-authority contract to direct/list/history/search, RAG keyword/vector retrieval, recent/folder context, Zyra fallback snapshots, graph traversal, notifications, exports/public sharing, generated summaries and caches. An authorized candidate can be returned as data with server-owned candidate status; only the exact approved active resolved manifest is governing instruction. Current ordinary KB read semantics do not prove the future finer disclosure policy. Cache by authenticated scope/role/context and binding revisions; reauthorize and invalidate on membership/assignment/source changes. Required inaccessible evidence yields a permission-safe incomplete/unknown assessment, not zero or N/A.

Every existing writer/reader must have an owner, contract, legacy disposition and discriminating proof before its new governed capability is exposed. Do not retrofit fictitious approval/skill/source pins into old records. Maintain explicit capability versions and fail safely for unsupported clients. Pending uploads, quarantined/unavailable bytes, source fetch failures, expired leases and resolver outages remain distinct from successful empty results or completed work.

Before an implementation slice ships, its existing task must record and test the resource envelope: supported workload and concurrency; payload/archive expansion/file limits; dependency depth/fanout; pagination and source scan bounds; queue/retry/dead-letter age; timeout/cancellation; retention/holds; measured latency/error budgets; and recovery responsibility. Reuse applicable existing evidence limits and platform controls. Numeric SLOs are not invented by this review; absent approved limits block the affected deployment. Imported scripts/resources are inert by default, safely rendered, path/size/network constrained, and cannot grant tool or network authority through skill text.

## 20. Canonical workflow/UX mirror (ASER-UX01–03)

### ASER-UX01 — Preserve the intended workflow and both entry paths

The central principle remains: **the codebase and its supporting engineering records evolve together**. A developer or coding agent may start from a feature, defect, refactor or investigation. Tesbo MCP supplies shared project/change context; native record owners and reviewers determine what must change.

| Stage | Usable human/agent outcome | Existing owner and retained boundary |
| --- | --- | --- |
| Understand the change | Identify project, source scope, request, current records and applicable decisions; disclose unknowns | Source binding + FR-115 changeset + bounded context; no guessed project or automatic requirement inferred from code |
| Requirements | Propose expected behavior/criteria against the existing native or externally owned revision | Requirements / governed KB + shared staging; provider authority and human acceptance remain explicit |
| Test Cases | Reuse/update cases and exact requirement coverage, then prepare and actually execute permitted scope | Native cases, Models where useful, Plans/Runs/attempts; drafted, approved, selected and executed are separate |
| User Manual | Update the correct existing audience-specific section when behavior changed | KB identity and exact reviewed revision; access is not inferred from audience label |
| Policies | Record applicable authority, decisions, invariants and enforcement/unknowns | Governed KB + shared review and typed links; no agent self-approval |
| Tasks & Issues | Assign implementation/review/defect work and retain unresolved follow-up | Existing Tasks, Bugs and impact obligations with distinct lifecycles |
| Files & Evidence | Preserve original reports, source references and actual accessible bytes | Existing file/report/evidence owners; raw observations are not invented skill-authored artifacts |
| Trace, verify and decide | See one versioned history of what changed, why, which build/scope was tested, who decided and what remains | Existing Zyra Change review composes the native facts; separate release decision and post-deploy verification |

Skills governance is cross-cutting: each governed authoring operation resolves the exact approved assigned method; a change does not need to create a skill, policy or document merely to satisfy a checklist. Seven domain assessments are mandatory, seven mutations are not.

**Original QA round trip remains mandatory and additive:** ChatGPT creates a durable exact prompt/task through Tesbo MCP → assigned OpenCode or another capable instance claims the fenced attempt → executor uses its own authorized Chrome/Playwright MCP or equivalent driver → immutable original report/evidence returns through Tesbo MCP → ChatGPT reads original evidence, analyzes uncertainty and can request a linked retest/new report → human edits/rejects/approves exact selected operations → protected apply updates native cases/results/Bugs. No existing cases, formal model, Tesbo AI key or new browser engine is required for case-free exploration. Manual receipt/synthesis fallback preserves true attribution. A local agent cannot be assumed stopped merely because its server lease expired. The broader coding-change flow does not replace this contract (FR-001–037, T-201–207/T-301–308/T-401, QA-135–138).

### ASER-UX02 — One role-sensitive workspace, capabilities rather than invented roles

Extend **Zyra → Change review**, its existing task/review discovery and native record destinations. Skills Library and separately protected Assignments are subviews of **D-14 QA Standards & Playbooks** in existing settings, with contextual links; no new top-level Skills navigation or second Copilot is introduced. A solo person can perform several jobs. These job labels do not grant new roles or permissions.

| User job | Safe information / decision | Required server capability and next owner |
| --- | --- | --- |
| Developer / coding agent | Authorized source/change context, own permitted draft operations, actual tool receipts and blockers | Current project read/propose grants; machine principals cannot acquire human approval through token ownership. Request review through the existing queue. |
| BA / product | Exact requirement/criteria versions, proposed behavior change and coverage gaps | Requirement read/propose; acceptance requires the separately configured human requirement-review authority. If absent, preserve candidate and identify that configuration gate. |
| QA | Test definition diff, selected manifest, actual attempt/evidence, blocked/untested scope and Bug relationship effects | Case review/run/report/correction capabilities are separate; the configured authorized tester or reviewer supplies the missing decision/evidence. |
| Policy / security | Permitted source obligation, decision, policy effectivity and control/test evidence | Policy read/propose does not grant policy activation or skills governance. Current explicit authority and exact scope are required. |
| PM / delivery / executive | Authorized summary of progress, responsible owner and permitted blocker/risk reasons | Project summary permission grants only its allowlisted fields. It does not grant restricted document/history/prompt/evidence access or release approval. |
| Support / operations | Published relevant guidance, deployed build, incident and remediation/retest links | Native document/incident/report capabilities; restoration and release decisions remain with their independently authorized owner. |
| Workspace/project governance human | Approved method versions, binding diffs, exact scope/precedence, emergency recovery state | Independent trusted human governance action plus current configured capability. Existing KB edit ownership and project membership are not automatic skill/root/policy/release authority. |
| Release decision maker | Candidate build, evidence snapshot, required sign-offs, known risks and rollout/rollback responsibility | Current explicitly configured human release-decision capability. Decision is pinned; observed deployment and later smoke/incident results remain independent. |

Implementation must map these capabilities to Tesbo's actual existing principal/role/ownership checks and approved project policy; **unknown mapping means denied for the affected action**, not an invented role or a new permission service. The inspected KB UI currently allows owner/manager mutation or creator-owned mutation; that is a current editing rule, not proof of the future governance rights. Before exposing protected actions, record the actual mapping and positive/denied API/UI tests in T-004/T-102/T-103 and the relevant work package.

### ASER-UX03 — Recovery, disclosure and continuity at every decision

| State | What the user can know | Safe action / accountable next actor |
| --- | --- | --- |
| Successful empty lookup | No authorized records in the successfully queried scope, with pagination/completeness | Create a permitted candidate only after reconciliation; do not confuse with failed discovery. |
| Unavailable / partial / stale source | Last permitted data, labelled stale when retained, failed scope and retry/reconnect guidance | Retry the read or ask the source/integration owner. Preserve draft work; no inferred zero coverage or duplicate record creation. |
| Permission unknown / denied / revoked | Permission-safe denial and any explicitly shareable next-owner information | Current owner restores a valid grant if appropriate. Do not auto-switch project, reveal hidden counts or renew privileges from cache. |
| Required skill absent, conflicted or revoked | Affected authoring operation and human-governed recovery path | Governance owner resolves/assigns approved guidance; preserve the candidate. Authorized raw evidence may still be received through its independent permitted route. |
| Stale proposal / changed base or dependency | Exact reviewed, current and proposed versions where authorized | Compare/rebase and obtain the needed new review; retain typed comments and unsaved edits, never silent overwrite. |
| Partial or uncertain operation | Each known committed/failed/not-attempted/uncertain item, without inaccessible metadata | Read the authoritative receipt first; explicitly resume only eligible work. Generic Retry must not duplicate an unknown committed action. |
| Restricted evidence | Only the approved summary/disclosure fields; never the protected payload or an existence leak | An authorized reviewer assesses it or publishes a permitted summary. Restricted does not mean no evidence, passed or N/A. |
| Rejected / cancelled / validly deferred work | Exact terminal decision and surviving impact/work obligations | Keep original records and review history; show next owner/trigger. Proposal settlement does not imply QA closure or release. |
| No deployment/monitoring data | Pre-deployment candidate evidence versus unverified production state | Configure authorized observation or perform the appropriate validation; no fabricated success or zero-failure metric. |

Every drill-down carries project, changeset, exact artifact/revision/operation or attempt and a validated return context. Preserve queue filters, selection/scroll where applicable, draft comments and keyboard focus when returning. Direct deep links and old pending work must remain discoverable with pagination. A stale link offers a permitted exact historical view and current comparison; it does not silently open latest. On project switch, cancel/fence stale responses so data, permissions and unsaved work do not cross contexts. A bell read is not an assessment decision. Inherited canonical shared-dialog, exact-link, dirty-state and review contracts apply here rather than being reinvented.

Before UI acceptance, capture the authentic current app at a known build, role, fixture, browser, viewport and theme; document KEEP/EXTEND and compare the real After. Exercise keyboard/focus, screen-reader status/error announcements, touch, 320 CSS-pixel reflow, 200% text zoom, long content and loading/empty/denied/stale/partial states. Current status is **SOURCE-INSPECTED / VISUAL-BASELINE BLOCKED**; no new mockup is approved by this amendment.
