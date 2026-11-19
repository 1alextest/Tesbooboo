# ASER — Reuse-first technical design v0.3 (human-facing assurance and interoperable change capture)

**Status:** Architecture proposal only. Existing source owners must be re-verified at implementation head. No migration approved by this document.

## 1. Architecture

An application change produces a **Change Packet**: a versioned, project-scoped *coordination receipt* that links canonical records without becoming a duplicate source of truth. Work may start from spontaneous coding, an approved requirement, a QA finding or a policy decision. This is a **cross-role software delivery assurance architecture**, not a replacement coding agent/IDE.

```text
App repository + human intent + external/embedded coding agent
              /                         \
   optional local event hooks       repository/CI/deploy provider events
              \                         /
        Source Change Observer & scope/freshness receipts
                   |   (missing event != no change)
          app AGENTS.md / CLAUDE.md
                   |  (guidance only)
                   v
       Tesbo MCP + Zyra shared domain services (bound project)
                   |
     Resolve approved active module skills
      (human-governed assignments only)
                   |
     Discover existing source/policy/records
                   |
     Existing Zyra orchestration + change review
                   |
            Change Packet / links
          /        |           \
  requirements   cases/tests   docs/policy/tasks/files
  native/external native owners existing Tesbo services
          \        |           /
         Review + apply + verification receipts
                   |
  Graph change impact + native traceability reporting
                   |
    Human Change Workspace + release-readiness projection
                   |
     deployment observation + incident/retest feedback
```

Do **not** introduce a new chat assistant, a shadow test case writer, a disconnected project board, a second Knowledge Base or an AI-owned policy authority. Reuse `graph_history`, current cache graph, Model Studio revisions, Zyra task/feedback history, existing notification writers, `LegacyService` business rules, and versioned KB documents; extend them only at evidenced gaps.

## 2. Current evidence and actual gaps

Inspected `development` source: `Tesbo-Backend-Nest/src/mcp/mcp.tools.ts`, `mcp.service.ts`, `docs/FEATURE_DOCUMENTATION.md`, and `graph-change-review.controller.ts`.

- Existing MCP: `create_testcase`, `update_testcase`, `sourceRefs`, `link_requirement_to_testcase`, `create_knowledge_document`, `update_knowledge_document`, graph change capture/history, behavior model drafts. The source currently registers 58 tools; this is **not** proof the deployed client sees them.
- Existing `link_requirement_to_testcase` accepts **exactly one** `jiraIssueKey`, `linearIssueKey`, or `notionPageId`. It does not accept a native Tesbo requirement ID. The `get_requirement_matrix` endpoint largely reports cases/runs/bugs; external Requirements UI counts linked non-deleted cases, which is not executed coverage.
- Existing KB `requirement_note` and feature-requirements templates can hold content, but do not constitute a first-class native requirement object with accepted criteria/revision-aware typed testcase edges.
- The KB already owns documents, folders, version history and files; the MCP source includes KB **document/folder** tools but does **not** advertise binary file-upload tools.
- Zyra has a generation-specific Kanban/task review; Bugs have their own records. Neither is yet a general work-item system covering implementation and policy/documentation tasks.
- Graph history/capture, Zyra change review and Model Studio provide a reuse substrate; source-declared behavior and model/case mappings are not proof of deployed or executed behavior.
- The 2026-11-15 assurance manifest explicitly records no independent team run. This proposal does **not** inherit unexecuted review verdicts.

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
| Governed Skills Library and approved assignments | existing KB/version owner where compatible + narrow skill/assignment metadata with separate human authority | read-only effective-skill resolver, candidate MCP tools and human-only Skill Assignments UI |
| Cross-artifact link and review | native graph/link services + change review history | Change Packet and summary read model |

Before adding columns/tables, inspect existing migration indexes, KB version identities, Zyra tables and current graph link schema. The storage implementation is not pre-decided: prove reuse/extend/new options against required invariants first.

## 4. Change Packet contract

Proposed fields (exact API/storage decided by discovery; **not** currently available):

```json
{
  "changeId": "uuid",
  "projectId": "uuid",
  "sourceBindingId": "uuid-or-null",
  "workItemId": "uuid-or-null",
  "trigger": "feature|bugfix|refactor|policy|docs|infra",
  "source": {
    "repository": "owner/repo",
    "baseCommit": "sha-or-null",
    "candidateCommit": "sha-or-null",
    "deployedTarget": "unverified"
  },
  "participants": [{"principalId":"id","role":"coding-agent","parentSessionId":"id"}],
  "effectiveSkillSet": [{"assignmentId":"governed-binding-id", "skillVersionId":"approved-revision-id", "sha256":"approved-content-digest", "resolvedFor":"module/subtype/audience"}],
  "artifactAssessments": [
    {
      "domain": "requirements",
      "disposition": "proposed",
      "artifactId": "native-id",
      "baseRevision": "rev-3",
      "candidateRevision": "rev-4",
      "reason": "changed acceptance criterion",
      "evidenceRefs": []
    }
  ],
  "idempotencyKey": "stable-client-generated-key",
  "status": "open|review|partially_applied|completed|blocked",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

There is no claim that this is the final database shape. Link records shall include `fromType, fromId, fromRevision, relationType, toType, toId, toRevision, provenance, confidence/evidence, linkStatus`, scoped to the same project. Use existing graph edges where semantics match; a graph projection must not invent the authoritative relation.

Suggested typed edges: `implements`, `specified_by`, `verified_by`, `documented_by`, `governed_by`, `caused_by`, `tracked_by`, `evidenced_by`, `supersedes`, `depends_on`, `affects`. Distinguish typed durable relationships from `sourceRefs` contextual citations.

## 5. Agent work cycle

**Preflight** (read only): Verify project binding, token permissions, runtime server identity, `tools/list` contract, source commit, existing applicable records **and the exact approved effective skill assignments for each selected module/subtype/audience**. Do not load a skill proposal or stale cached version as authority. Missing or conflicting mandatory binding blocks the affected governed authoring action; no automatic choice of another project when binding fails.

**Assess**: Find source and behavior changes, existing artifacts, affected stakeholders, applicable policy versions and tasks. Classify each domain as update/unchanged/not applicable/blocked/deferred, with rationale. For spontaneous code changes, this can occur incrementally; no prerequisite formal spec ceremony.

**Plan**: Establish affected requirement acceptance criteria and verification strategy. Preserve existing IDs, define potential manual/policy impact, list cases before automation. A specialist can draft one area but inherits no extra publishing authority.

**Build and prove**: Code, unit/integration/E2E tests and actual observations remain within the coding tool's execution environment. Record what was **run**, not just authored, and distinguish CI, local, and live target.

**Propose**: Generate/update *draft* native requirement revisions, test case candidates, internal/external manual edits, internal/external policy/decision/rule proposals, work item changes and (when requested) *new skill candidates/successor proposals* using existing services and the pinned governing skill versions. An agent can propose a new skill version but **cannot mutate any existing skill version, assign/reassign it, activate/deactivate it or approve it**, even through an admin-owned machine token. Hash source inputs; keep base revisions and exact source citations. Never unilaterally rewrite an approved policy.

**Reconcile**: Link coherent candidate revisions, identify duplicates/conflicts, mark impacted existing cases stale, and surface QA/BA/policy/manual review through existing Zyra and notifications.

**Approve/publish**: Each domain's authorized reviewer approves exact revisions. Skill promotion and module assignment require independently authenticated interactive human governance, not an MCP credential issued by a human. Publishing occurs through authoritative services with optimistic concurrency and validation; an unapproved case cannot be introduced into a run.

**Close out**: Save exact persisted receipt(s), links, missing evidence, blocked/deferred work and next actions; support resume after interruption.

## 6. Multistep reliability and security

- Server: all tool handlers call native services; verify project identity and role per operation, not only at the initial client handshake. Explicitly bind reads and writes to the token's project.
- Proposal idempotency: `(projectId, operationKind, idempotencyKey)` must return the prior result when payload hash matches; a reused key with a different payload is a conflict.
- Revision guard: every update carries `expectedRevision` (or an equivalent version token); concurrent disjoint changes may merge only when semantically safe and reviewed.
- Batch safety: where a native DB transaction is possible, use it; otherwise persist a durable per-item journal/receipt and compensating/retry strategy. Do not describe a partially committed multi-artifact batch as atomic.
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
- **Skills Library:** one versioned searchable library, candidate creation/proposed successor via MCP, dependency/evaluation and usage history; only a separately authorized human governance view may approve versions, activate or reassign effective bindings, or change root meta-skill.
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

**Observation channels and trust:** (a) client-side optional event hook (Kiro `PostFileSave`, `PostTaskExecution`, `AgentStop` or equivalent, with capabilities checked at client version), (b) source provider webhooks for push/PR/merge and repository identity, (c) CI build/check callbacks, (d) deployment/incident provider events when installed, (e) explicit Tesbo MCP capture or human rescan. These channels are complementary, not redundant claims of exhaustive coverage. Not all tools/IDE surfaces support hooks. **Do not require a client hook to prove that a commit exists.**

**Logical normalized receipt** (exact schema delegated to native data/service discovery):
```json
{
  "projectId": "from-authenticated-source-binding",
  "sourceBindingId": "current-approved-binding",
  "sourceType": "agent_hook|repository|ci|deployment|manual_reconciliation",
  "sourceEventId": "stable-provider-id",
  "deliveryId": "dedupe-key",
  "sourceRevision": "git-sha-or-provider-version",
  "sourceScope": {"repository": "owner/repo", "ref": "refs/heads/..."},
  "observedAt": "UTC",
  "sourceOccurredAt": "UTC-or-unknown",
  "actor": {"principalId": "verified-or-null", "agentId": "attributed-or-null"},
  "evidenceClass": "observed|authenticated-provider|agent-reported|inferred",
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
- `unobserved` / `unknown`: no trustworthy observation (not a failed test, success or "agent did nothing").

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
- `get_project_authoring_context`: bounded read of permitted project scope, active governed skills, applicable approved requirement/policy references, current cases, live source binding and ability/limitation flags; pagination/cursors for large projects. Caller cannot choose a different project.
- `propose_change_bundle`: permissioned creation or revision of a Change Packet, a native requirement candidate, linked testcase candidate(s), and optional manual/task/policy applicability dispositions. Each operation explicitly records its base revision, governing skill version and approval state.
- `submit_verification_bundle`: record only actually observed run receipts/evidence against existing native cycles/executions, with independent agent report status and optional Bug candidate triage.
- `get_change_readiness`: compute linked source, case, approval, verification and risk/unknown read model without any write or implicit approval.

Tool selection/discovery should advertise capability/schema versions, permission boundaries, scoped mutation classes, size/latency budget and required manual approvals. Do **not** create an arbitrary REST escape hatch that bypasses native writers; alias and legacy endpoint paths must share authorization. A composite request is **not one guaranteed atomic transaction** across external systems: within the same PostgreSQL transaction use real atomicity; across multiple native/service/provider writes preserve a durable operation journal, `committed|failed|not_attempted|uncertain` per item, idempotent resume and compensating actions where safe. On duplicate key+same digest return same receipt; duplicate key+different payload is conflict. Prevent an unapproved draft from entering a protected run.

## 14. Cross-artifact consistency and independent truth — Spec Kit precedent
A read-only cross-artifact analyzer operates on typed **approved source obligations and their known revisions** plus code/source/graph observations, case/model links, docs, issue tasks and run evidence. Correct semantic disagreements at the owning artifact, never silently change the authoritative policy to match current code.

**Classification:** `confirmed_conflict`, `candidate_conflict`, `missing_requirement_or_link`, `stale_dependency`, `unsupported_source`, `not_applicable`, `no_detected_issue`; the last classification means **only** that this bounded analysis found no supported discrepancy. A source diff can propose a new requirement interpretation, but it cannot itself become a normative oracle. Semantic comparisons require rationale, evidence tier, uncertainty and responsible reviewer, not a blanket LLM pass.

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

**Result vocabulary:** `not_assessed`, `insufficient_evidence`, `blocked`, `ready_for_authorized_decision`, `released_with_known_risks`; final vocabulary must reconcile with the original eight canonical Tesbo specs and any existing release lifecycle. A release authority approves a fixed readiness snapshot, candidate build and risk set. Changed evidence after approval creates a new decision context, never silently replaces the historical approval. Unknown deployment/monitoring is not marked passed.

**Five evidence-backed delivery measures:** change lead time (commit to successful production deployment), deployment frequency (successful production deploy count per interval), failed-deployment recovery time (duration to restore after a production change failure), change fail rate (qualifying failed production changes / qualifying production changes), deployment rework rate (unplanned remediation deployments / deployments, under an explicitly documented measurement rule). Source IDs, time zone, event censoring/missing data, denominator and per-project configuration are visible. These two outcome groups—throughput and instability—must not be collapsed into a misleading single score. A configured project without deployment integration gets `NO_DATA` not zero failures. Improvements in those figures do not alone establish a causal effect of Tesbo.

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

**Canonical reconciliation remains mandatory:** This ASER document is a proposal and does not replace or silently amend the original eight Tesbo canonical specifications or change existing P-07 human publication and P-18 project MCP consent rules.
